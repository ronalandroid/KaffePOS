/**
 * Loyalty domain helpers: zod schemas, passport/settings bootstrap, and the
 * stamp/redeem transaction cores. Route handlers live in loyalty.ts and call
 * into this module (extracted to keep the route file under the size rule).
 */
import { z } from 'zod';
import {
  ApiError,
  assertStoreOwned,
  insertNotification,
  type PoolClient,
} from '../core';
import {
  rewardTypeSchema,
  normalizePhone,
  serializeSettings,
  serializeReward,
  serializePassport,
  serializeStampEvent,
  serializeCustomer,
  serializeRedemption,
  deriveTier,
} from './loyalty.serializers';

export const storeIdSchema = z.string().uuid();

export const settingsSchema = z.object({
  store_id: z.string().uuid(),
  stamps_required: z.number().int().min(2).max(20).optional(),
  points_per_rupiah: z.number().min(0).max(1).optional(),
  minimum_transaction_amount: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const passportSchema = z.object({
  store_id: z.string().uuid(),
  customer_name: z.string().trim().max(120).optional().nullable(),
  customer_phone: z.string().trim().min(4).max(32),
});

export const stampSchema = z.object({
  store_id: z.string().uuid(),
  passport_id: z.string().uuid().optional(),
  customer_name: z.string().trim().max(120).optional().nullable(),
  customer_phone: z.string().trim().min(4).max(32).optional(),
  transaction_id: z.string().trim().max(120).optional().nullable(),
  transaction_amount: z.number().int().min(0).default(0),
  stamps_earned: z.number().int().min(0).optional(),
  note: z.string().trim().max(240).optional().nullable(),
  idempotency_key: z.string().trim().max(160).optional().nullable(),
});

export const rewardSchema = z.object({
  store_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(240).optional().nullable(),
  type: rewardTypeSchema,
  reward_value: z.number().int().min(0).default(0),
  points_or_stamps_needed: z.number().int().min(0).optional(),
  points_cost: z.number().int().min(0).default(0),
  stamps_cost: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const redeemSchema = z.object({
  store_id: z.string().uuid(),
  passport_id: z.string().uuid(),
  reward_id: z.string().uuid(),
  transaction_id: z.string().trim().max(120).optional().nullable(),
  transaction_amount: z.number().int().min(0).default(0),
  idempotency_key: z.string().trim().max(160).optional().nullable(),
});

export const redeemCompatSchema = z.object({
  store_id: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  passport_id: z.string().uuid().optional(),
  reward_id: z.string().uuid(),
  transaction_id: z.string().trim().max(120).optional().nullable(),
  transaction_amount: z.number().int().min(0).default(0),
  idempotency_key: z.string().trim().max(160).optional().nullable(),
});

export const stampCompatSchema = z.object({
  store_id: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  passport_id: z.string().uuid().optional(),
  name: z.string().trim().max(120).optional().nullable(),
  customer_name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().min(4).max(32).optional(),
  customer_phone: z.string().trim().min(4).max(32).optional(),
  transaction_id: z.string().trim().max(120).optional().nullable(),
  transaction_amount: z.number().int().min(0).default(0),
  stamps_earned: z.number().int().min(0).optional(),
  note: z.string().trim().max(240).optional().nullable(),
  idempotency_key: z.string().trim().max(160).optional().nullable(),
});

export const rewardPatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(240).optional().nullable(),
  type: rewardTypeSchema.optional(),
  reward_value: z.number().int().min(0).optional(),
  points_or_stamps_needed: z.number().int().min(0).optional(),
  points_cost: z.number().int().min(0).optional(),
  stamps_cost: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export async function ensureSettings(client: PoolClient, storeId: string) {
  const result = await client.query(
    `
      insert into public.loyalty_settings (store_id)
      values ($1)
      on conflict (store_id) do update
      set updated_at = public.loyalty_settings.updated_at
      returning *
    `,
    [storeId],
  );
  return serializeSettings(result.rows[0]);
}

export async function resolveStoreId(client: PoolClient, input: unknown, userId: string) {
  const candidate = typeof input === 'string' && storeIdSchema.safeParse(input).success ? input : null;
  if (candidate) {
    await assertStoreOwned(client, candidate, userId);
    return candidate;
  }

  const result = await client.query(
    `
      select s.id
      from public.stores s
      where s.owner_id = $1
        or exists (
          select 1
          from public.cashier_outlet_assignments a
          join public.profiles p on p.id = a.cashier_id
          where a.store_id = s.id
            and a.cashier_id = $1
            and a.status = 'active'
            and p.role = 'cashier'
            and p.account_status = 'active'
        )
      order by s.created_at asc
      limit 1
    `,
    [userId],
  );
  const storeId = result.rows[0]?.id ? String(result.rows[0].id) : null;
  if (!storeId) throw new ApiError(400, 'store_id wajib diisi untuk fitur loyalty.');
  return storeId;
}

export async function ensureDefaultTiers(client: PoolClient, storeId: string) {
  const existing = await client.query(
    `select id from public.loyalty_tiers where store_id = $1 limit 1`,
    [storeId],
  );
  if (existing.rows[0]) return;

  await client.query(
    `
      insert into public.loyalty_tiers (store_id, name, min_visits, benefits)
      values
        ($1, 'Regular', 0, '{"label":"Member baru"}'::jsonb),
        ($1, 'Kopi Lover', 8, '{"label":"Prioritas reward"}'::jsonb),
        ($1, 'VVIP', 24, '{"label":"Benefit terbaik"}'::jsonb)
    `,
    [storeId],
  );
}

export async function upsertCustomerFromPassport(client: PoolClient, passport: ReturnType<typeof serializePassport>) {
  const result = await client.query(
    `
      insert into public.loyalty_customers (
        id, store_id, name, phone, tier, total_points, total_visits, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, now())
      on conflict (id) do update
      set
        name = excluded.name,
        phone = excluded.phone,
        tier = excluded.tier,
        total_points = excluded.total_points,
        total_visits = excluded.total_visits,
        updated_at = now()
      returning *
    `,
    [
      passport.id,
      passport.store_id,
      passport.customer_name,
      passport.customer_phone,
      passport.tier,
      passport.total_points,
      passport.total_stamps,
    ],
  );
  return serializeCustomer(result.rows[0]);
}

export async function insertCompatStamp(client: PoolClient, event: ReturnType<typeof serializeStampEvent>) {
  await client.query(
    `
      insert into public.loyalty_stamps (id, customer_id, transaction_id, stamps_earned, created_at)
      values ($1, $2, $3, $4, coalesce($5::timestamptz, now()))
      on conflict (id) do nothing
    `,
    [event.id, event.passport_id, event.transaction_id, event.stamps, event.created_at ?? null],
  );
}

export async function ensureDefaultRewards(client: PoolClient, storeId: string, stampsRequired: number) {
  const existing = await client.query(
    `select id from public.loyalty_rewards where store_id = $1 limit 1`,
    [storeId],
  );
  if (existing.rows[0]) return;

  await client.query(
    `
      insert into public.loyalty_rewards
        (store_id, name, description, type, reward_value, points_or_stamps_needed, points_cost, stamps_cost, is_active)
      values
        ($1, 'Diskon Rp10.000', 'Tukar poin untuk potongan transaksi berikutnya.', 'discount_amount', 10000, 1000, 1000, 0, true),
        ($1, 'Free Coffee Stamp', 'Tukar stamp lengkap untuk 1 minuman favorit.', 'free_item', 25000, $2, 0, $2, true)
    `,
    [storeId, stampsRequired],
  );
}

export async function findOrCreatePassport(
  client: PoolClient,
  payload: { storeId: string; phone?: string; name?: string | null; passportId?: string },
) {
  if (payload.passportId) {
    const result = await client.query(
      `select * from public.loyalty_passports where id = $1 and store_id = $2 limit 1`,
      [payload.passportId, payload.storeId],
    );
    if (!result.rows[0]) throw new ApiError(404, 'Kopi Passport tidak ditemukan.');
    return serializePassport(result.rows[0]);
  }

  if (!payload.phone) {
    throw new ApiError(400, 'Nomor telepon pelanggan wajib diisi.');
  }

  const phone = normalizePhone(payload.phone);
  const result = await client.query(
    `
      insert into public.loyalty_passports (store_id, customer_name, customer_phone)
      values ($1, nullif($2, ''), $3)
      on conflict (store_id, customer_phone) do update
      set
        customer_name = coalesce(nullif(excluded.customer_name, ''), public.loyalty_passports.customer_name),
        updated_at = now()
      returning *
    `,
    [payload.storeId, payload.name?.trim() || null, phone],
  );
  const passport = serializePassport(result.rows[0]);
  await upsertCustomerFromPassport(client, passport);
  return passport;
}

export function calculateEarned(input: {
  transactionAmount: number;
  settings: ReturnType<typeof serializeSettings>;
}) {
  if (!input.settings.is_active || input.transactionAmount < input.settings.minimum_transaction_amount) {
    return { stamps: 0, points: 0 };
  }
  return {
    stamps: input.transactionAmount > 0 ? 1 : 0,
    points: Math.max(0, Math.floor(input.transactionAmount * input.settings.points_per_rupiah)),
  };
}

export function calculateRewardDiscount(input: {
  reward: ReturnType<typeof serializeReward>;
  transactionAmount: number;
}) {
  if (input.reward.type === 'discount_percent') {
    return Math.min(input.transactionAmount, Math.round(input.transactionAmount * input.reward.reward_value / 100));
  }
  if (input.reward.type === 'discount_amount') {
    return Math.min(input.transactionAmount, input.reward.reward_value);
  }
  if (input.reward.type === 'free_item') {
    return Math.min(input.transactionAmount, input.reward.reward_value);
  }
  return 0;
}

export type StampPayload = z.infer<typeof stampSchema>;
export type RedeemPayload = z.infer<typeof redeemSchema>;

export async function getStoreOwnerId(client: PoolClient, storeId: string) {
  const result = await client.query(
    `select owner_id from public.stores where id = $1 limit 1`,
    [storeId],
  );
  return result.rows[0]?.owner_id ? String(result.rows[0].owner_id) : null;
}

export async function insertLoyaltyRewardNotification(client: PoolClient, input: {
  storeId: string;
  ownerId: string;
  passport: ReturnType<typeof serializePassport>;
  stampsRequired: number;
}) {
  const dedupeKey = `loyalty-reward:${input.passport.id}:${Math.floor(input.passport.available_stamps / input.stampsRequired)}`;
  const existing = await client.query(
    `
      select id
      from public.notifications
      where user_id = $1
        and store_id = $2
        and type = 'loyalty'
        and metadata->>'dedupeKey' = $3
      limit 1
    `,
    [input.ownerId, input.storeId, dedupeKey],
  );
  if (existing.rows[0]) return;

  await insertNotification(
    client,
    input.ownerId,
    'Pelanggan loyalty siap redeem',
    `${input.passport.customer_name || input.passport.customer_phone} sudah mencapai reward Kopi Passport.`,
    'loyalty',
    {
      category: 'business_alert',
      dedupeKey,
      passportId: input.passport.id,
      customerName: input.passport.customer_name,
      customerPhone: input.passport.customer_phone,
      availableStamps: input.passport.available_stamps,
      stampsRequired: input.stampsRequired,
    },
    input.storeId,
  );
}

export async function applyStamp(client: PoolClient, payload: StampPayload, userId: string) {
  await assertStoreOwned(client, payload.store_id, userId);
  const settings = await ensureSettings(client, payload.store_id);
  const passport = await findOrCreatePassport(client, {
    storeId: payload.store_id,
    passportId: payload.passport_id,
    phone: payload.customer_phone,
    name: payload.customer_name,
  });
  const earned = calculateEarned({
    transactionAmount: payload.transaction_amount,
    settings,
  });
  if (payload.stamps_earned !== undefined) {
    earned.stamps = payload.stamps_earned;
  }

  if (payload.idempotency_key) {
    const existing = await client.query(
      `select * from public.loyalty_stamp_events where store_id = $1 and idempotency_key = $2 limit 1`,
      [payload.store_id, payload.idempotency_key],
    );
    if (existing.rows[0]) {
      const currentPassport = await client.query(
        `select * from public.loyalty_passports where id = $1 and store_id = $2 limit 1`,
        [passport.id, payload.store_id],
      );
      const serializedPassport = serializePassport(currentPassport.rows[0]);
      await upsertCustomerFromPassport(client, serializedPassport);
      const event = serializeStampEvent(existing.rows[0]);
      await insertCompatStamp(client, event);
      return {
        passport: serializedPassport,
        customer: serializeCustomer({
          id: serializedPassport.id,
          store_id: serializedPassport.store_id,
          name: serializedPassport.customer_name,
          phone: serializedPassport.customer_phone,
          tier: serializedPassport.tier,
          total_points: serializedPassport.total_points,
          total_visits: serializedPassport.total_stamps,
        }),
        event,
        earned,
        replayed: true,
      };
    }
  }

  const eventResult = await client.query(
    `
      insert into public.loyalty_stamp_events (
        store_id, passport_id, transaction_id, stamps, points,
        transaction_amount, note, created_by, idempotency_key
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
    `,
    [
      payload.store_id,
      passport.id,
      payload.transaction_id || null,
      earned.stamps,
      earned.points,
      payload.transaction_amount,
      payload.note || null,
      userId,
      payload.idempotency_key || null,
    ],
  );

  const nextTotalStamps = passport.total_stamps + earned.stamps;
  const nextTotalPoints = passport.total_points + earned.points;
  const nextLifetimeSpend = passport.lifetime_spend + payload.transaction_amount;
  const nextTier = deriveTier({
    lifetimeSpend: nextLifetimeSpend,
    totalStamps: nextTotalStamps,
    totalPoints: nextTotalPoints,
  });

  const updated = await client.query(
    `
      update public.loyalty_passports
      set
        total_stamps = total_stamps + $1,
        available_stamps = available_stamps + $1,
        total_points = total_points + $2,
        available_points = available_points + $2,
        lifetime_spend = lifetime_spend + $3,
        tier = $4,
        last_visit_at = now(),
        updated_at = now()
      where id = $5 and store_id = $6
      returning *
    `,
    [earned.stamps, earned.points, payload.transaction_amount, nextTier, passport.id, payload.store_id],
  );

  const serializedPassport = serializePassport(updated.rows[0]);
  const customer = await upsertCustomerFromPassport(client, serializedPassport);
  const event = serializeStampEvent(eventResult.rows[0]);
  await insertCompatStamp(client, event);
  const ownerId = await getStoreOwnerId(client, payload.store_id);
  if (
    ownerId &&
    settings.stamps_required > 0 &&
    passport.available_stamps < settings.stamps_required &&
    serializedPassport.available_stamps >= settings.stamps_required
  ) {
    await insertLoyaltyRewardNotification(client, {
      storeId: payload.store_id,
      ownerId,
      passport: serializedPassport,
      stampsRequired: settings.stamps_required,
    });
  }

  return {
    passport: serializedPassport,
    customer,
    event,
    earned,
    replayed: false,
  };
}

export async function redeemReward(client: PoolClient, payload: RedeemPayload, userId: string) {
  await assertStoreOwned(client, payload.store_id, userId);

  if (payload.idempotency_key) {
    const existing = await client.query(
      `select * from public.loyalty_redemptions where store_id = $1 and idempotency_key = $2 limit 1`,
      [payload.store_id, payload.idempotency_key],
    );
    if (existing.rows[0]) {
      const currentPassport = await client.query(
        `select * from public.loyalty_passports where id = $1 and store_id = $2 limit 1`,
        [payload.passport_id, payload.store_id],
      );
      const reward = await client.query(
        `select * from public.loyalty_rewards where id = $1 and store_id = $2 limit 1`,
        [payload.reward_id, payload.store_id],
      );
      const passport = serializePassport(currentPassport.rows[0]);
      await upsertCustomerFromPassport(client, passport);
      return {
        redemption: serializeRedemption(existing.rows[0]),
        passport,
        customer: serializeCustomer({
          id: passport.id,
          store_id: passport.store_id,
          name: passport.customer_name,
          phone: passport.customer_phone,
          tier: passport.tier,
          total_points: passport.total_points,
          total_visits: passport.total_stamps,
        }),
        reward: serializeReward(reward.rows[0]),
        replayed: true,
      };
    }
  }

  const [passportResult, rewardResult] = await Promise.all([
    client.query(
      `select * from public.loyalty_passports where id = $1 and store_id = $2 for update`,
      [payload.passport_id, payload.store_id],
    ),
    client.query(
      `select * from public.loyalty_rewards where id = $1 and store_id = $2 and is_active = true limit 1`,
      [payload.reward_id, payload.store_id],
    ),
  ]);
  const passport = passportResult.rows[0] ? serializePassport(passportResult.rows[0]) : null;
  const reward = rewardResult.rows[0] ? serializeReward(rewardResult.rows[0]) : null;
  if (!passport) throw new ApiError(404, 'Kopi Passport tidak ditemukan.');
  if (!reward) throw new ApiError(404, 'Reward tidak aktif atau tidak ditemukan.');
  if (passport.available_points < reward.points_cost) throw new ApiError(400, 'Poin pelanggan belum cukup untuk reward ini.');
  if (passport.available_stamps < reward.stamps_cost) throw new ApiError(400, 'Stamp pelanggan belum cukup untuk reward ini.');

  const discountAmount = calculateRewardDiscount({
    reward,
    transactionAmount: payload.transaction_amount,
  });
  const redemption = await client.query(
    `
      insert into public.loyalty_redemptions (
        store_id, passport_id, reward_id, transaction_id,
        points_spent, stamps_spent, discount_amount, status, created_by, idempotency_key
      ) values ($1, $2, $3, $4, $5, $6, $7, 'redeemed', $8, $9)
      returning *
    `,
    [
      payload.store_id,
      passport.id,
      reward.id,
      payload.transaction_id || null,
      reward.points_cost,
      reward.stamps_cost,
      discountAmount,
      userId,
      payload.idempotency_key || null,
    ],
  );

  const updated = await client.query(
    `
      update public.loyalty_passports
      set
        available_points = greatest(0, available_points - $1),
        available_stamps = greatest(0, available_stamps - $2),
        updated_at = now()
      where id = $3 and store_id = $4
      returning *
    `,
    [reward.points_cost, reward.stamps_cost, passport.id, payload.store_id],
  );

  const updatedPassport = serializePassport(updated.rows[0]);
  const customer = await upsertCustomerFromPassport(client, updatedPassport);
  return {
    redemption: serializeRedemption(redemption.rows[0]),
    passport: updatedPassport,
    customer,
    reward,
    replayed: false,
  };
}

/**
 * Digital Loyalty routes — Kopi Passport, points, rewards, redemption.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  ApiError,
  assertStoreOwned,
  buildPaginationMeta,
  buildUpdateClause,
  parsePaginationQuery,
  pickDefined,
  requirePermission,
  withTransaction,
} from '../core';
import {
  normalizePhone,
  serializeSettings,
  serializeReward,
  serializePassport,
  serializeTier,
  serializeCustomerFromPassportRow,
} from './loyalty.serializers';
import {
  storeIdSchema,
  settingsSchema,
  passportSchema,
  stampSchema,
  rewardSchema,
  redeemSchema,
  stampCompatSchema,
  redeemCompatSchema,
  rewardPatchSchema,
  ensureSettings,
  resolveStoreId,
  ensureDefaultTiers,
  ensureDefaultRewards,
  findOrCreatePassport,
  applyStamp,
  redeemReward,
} from './loyalty.helpers';

const router = Router();


router.get('/api/loyalty/overview', async (req, res, next) => {
  try {
    const storeId = storeIdSchema.parse(req.query.storeId);
    const result = await withTransaction(async (client) => {
      await assertStoreOwned(client, storeId, req.authUser!.id);
      const settings = await ensureSettings(client, storeId);
      await ensureDefaultRewards(client, storeId, settings.stamps_required);
      await ensureDefaultTiers(client, storeId);
      const [rewards, passports, tiers] = await Promise.all([
        client.query(
          `select * from public.loyalty_rewards where store_id = $1 order by is_active desc, created_at asc`,
          [storeId],
        ),
        client.query(
          `select * from public.loyalty_passports where store_id = $1 order by updated_at desc limit 20`,
          [storeId],
        ),
        client.query(
          `select * from public.loyalty_tiers where store_id = $1 order by min_visits asc, name asc`,
          [storeId],
        ),
      ]);
      return {
        settings,
        rewards: rewards.rows.map(serializeReward),
        passports: passports.rows.map(serializePassport),
        customers: passports.rows.map((row: Record<string, unknown>) => serializeCustomerFromPassportRow(row)),
        tiers: tiers.rows.map(serializeTier),
      };
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/api/loyalty/customers', async (req, res, next) => {
  try {
    const query = String(req.query.search ?? req.query.query ?? '').trim();
    const pagination = parsePaginationQuery(req.query, { defaultLimit: 25, maxLimit: 100 });
    const result = await withTransaction(async (client) => {
      const storeId = await resolveStoreId(client, req.query.storeId ?? req.query.store_id, req.authUser!.id);
      const values: unknown[] = [storeId, pagination.limit, pagination.offset];
      const normalizedQuery = normalizePhone(query) || query;
      const searchSql = query
        ? `and (customer_name ilike $4 or customer_phone ilike $4)`
        : '';
      if (query) values.push(`%${normalizedQuery}%`);
      const passports = await client.query(
        `
          select *
          from public.loyalty_passports
          where store_id = $1
          ${searchSql}
          order by updated_at desc
          limit $2 offset $3
        `,
        values,
      );
      // Derive customers in-memory from passport rows. The loyalty_customers compat
      // table is already kept in sync on every write path (passport create, stamp,
      // redeem), so a read must not re-upsert per row: that was an N+1 (1 + up to 100
      // writes) and a side-effecting write inside a GET.
      return passports.rows.map((row: Record<string, unknown>) => serializeCustomerFromPassportRow(row));
    });
    res.json({
      items: result,
      pagination: buildPaginationMeta({ ...pagination, returned: result.length }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/api/loyalty/settings', async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const storeId = await resolveStoreId(client, req.query.storeId ?? req.query.store_id, req.authUser!.id);
      const settings = await ensureSettings(client, storeId);
      await ensureDefaultRewards(client, storeId, settings.stamps_required);
      await ensureDefaultTiers(client, storeId);
      const [rewards, tiers] = await Promise.all([
        client.query(
          `select * from public.loyalty_rewards where store_id = $1 order by is_active desc, created_at asc`,
          [storeId],
        ),
        client.query(
          `select * from public.loyalty_tiers where store_id = $1 order by min_visits asc, name asc`,
          [storeId],
        ),
      ]);
      return {
        settings,
        rewards: rewards.rows.map(serializeReward),
        tiers: tiers.rows.map(serializeTier),
      };
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/api/loyalty/passports', async (req, res, next) => {
  try {
    const storeId = storeIdSchema.parse(req.query.storeId);
    const query = String(req.query.query ?? '').trim();
    const pagination = parsePaginationQuery(req.query, { defaultLimit: 25, maxLimit: 100 });
    const result = await withTransaction(async (client) => {
      await assertStoreOwned(client, storeId, req.authUser!.id);
      const values: unknown[] = [storeId, pagination.limit, pagination.offset];
      const searchSql = query
        ? `and (customer_name ilike $4 or customer_phone ilike $4)`
        : '';
      if (query) values.push(`%${normalizePhone(query) || query}%`);
      const passports = await client.query(
        `
          select *
          from public.loyalty_passports
          where store_id = $1
          ${searchSql}
          order by updated_at desc
          limit $2 offset $3
        `,
        values,
      );
      return passports.rows.map(serializePassport);
    });
    res.json({
      items: result,
      pagination: buildPaginationMeta({ ...pagination, returned: result.length }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/api/loyalty/passports', requirePermission('can_use_pos'), async (req, res, next) => {
  try {
    const payload = passportSchema.parse(req.body);
    const passport = await withTransaction(async (client) => {
      await assertStoreOwned(client, payload.store_id, req.authUser!.id);
      return findOrCreatePassport(client, {
        storeId: payload.store_id,
        phone: payload.customer_phone,
        name: payload.customer_name,
      });
    });
    res.status(201).json(passport);
  } catch (error) {
    next(error);
  }
});

router.post('/api/loyalty/stamps', requirePermission('can_use_pos'), async (req, res, next) => {
  try {
    const payload = stampSchema.parse(req.body);
    const result = await withTransaction(async (client) => {
      return applyStamp(client, payload, req.authUser!.id);
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/api/loyalty/stamp', requirePermission('can_use_pos'), async (req, res, next) => {
  try {
    const payload = stampCompatSchema.parse(req.body);
    const result = await withTransaction(async (client) => {
      const storeId = await resolveStoreId(client, payload.store_id ?? payload.storeId, req.authUser!.id);
      return applyStamp(client, {
        store_id: storeId,
        passport_id: payload.passport_id ?? payload.customer_id,
        customer_name: payload.customer_name ?? payload.name ?? null,
        customer_phone: payload.customer_phone ?? payload.phone,
        transaction_id: payload.transaction_id ?? null,
        transaction_amount: payload.transaction_amount,
        stamps_earned: payload.stamps_earned,
        note: payload.note ?? null,
        idempotency_key: payload.idempotency_key ?? null,
      }, req.authUser!.id);
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/api/loyalty/redemptions', requirePermission('can_use_pos'), async (req, res, next) => {
  try {
    const payload = redeemSchema.parse(req.body);
    const result = await withTransaction(async (client) => {
      return redeemReward(client, payload, req.authUser!.id);
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/api/loyalty/redeem', requirePermission('can_use_pos'), async (req, res, next) => {
  try {
    const payload = redeemCompatSchema.parse(req.body);
    const result = await withTransaction(async (client) => {
      const storeId = await resolveStoreId(client, payload.store_id ?? payload.storeId, req.authUser!.id);
      const passportId = payload.passport_id ?? payload.customer_id;
      if (!passportId) throw new ApiError(400, 'customer_id wajib diisi untuk redeem reward.');
      return redeemReward(client, {
        store_id: storeId,
        passport_id: passportId,
        reward_id: payload.reward_id,
        transaction_id: payload.transaction_id ?? null,
        transaction_amount: payload.transaction_amount,
        idempotency_key: payload.idempotency_key ?? null,
      }, req.authUser!.id);
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.patch('/api/loyalty/settings', requirePermission('can_manage_settings'), async (req, res, next) => {
  try {
    const payload = settingsSchema.parse(req.body);
    const settings = await withTransaction(async (client) => {
      await assertStoreOwned(client, payload.store_id, req.authUser!.id);
      await ensureSettings(client, payload.store_id);
      const updates = pickDefined(payload as unknown as Record<string, unknown>, [
        'stamps_required',
        'points_per_rupiah',
        'minimum_transaction_amount',
        'is_active',
      ]);
      const { clause, values } = buildUpdateClause({ ...updates, updated_at: new Date().toISOString() });
      const result = await client.query(
        `
          update public.loyalty_settings
          set ${clause}
          where store_id = $${values.length + 1}
          returning *
        `,
        [...values, payload.store_id],
      );
      return serializeSettings(result.rows[0]);
    });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.put('/api/loyalty/settings', requirePermission('can_manage_settings'), async (req, res, next) => {
  try {
    const payload = settingsSchema.parse(req.body);
    const settings = await withTransaction(async (client) => {
      await assertStoreOwned(client, payload.store_id, req.authUser!.id);
      await ensureSettings(client, payload.store_id);
      const updates = pickDefined(payload as unknown as Record<string, unknown>, [
        'stamps_required',
        'points_per_rupiah',
        'minimum_transaction_amount',
        'is_active',
      ]);
      const { clause, values } = buildUpdateClause({ ...updates, updated_at: new Date().toISOString() });
      const result = await client.query(
        `
          update public.loyalty_settings
          set ${clause}
          where store_id = $${values.length + 1}
          returning *
        `,
        [...values, payload.store_id],
      );
      await ensureDefaultTiers(client, payload.store_id);
      const tiers = await client.query(
        `select * from public.loyalty_tiers where store_id = $1 order by min_visits asc, name asc`,
        [payload.store_id],
      );
      return {
        settings: serializeSettings(result.rows[0]),
        tiers: tiers.rows.map(serializeTier),
      };
    });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.post('/api/loyalty/rewards', requirePermission('can_manage_settings'), async (req, res, next) => {
  try {
    const payload = rewardSchema.parse(req.body);
    const reward = await withTransaction(async (client) => {
      await assertStoreOwned(client, payload.store_id, req.authUser!.id);
      const result = await client.query(
        `
          insert into public.loyalty_rewards (
            store_id, name, description, type, reward_value,
            points_or_stamps_needed, points_cost, stamps_cost, is_active
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          returning *
        `,
        [
          payload.store_id,
          payload.name,
          payload.description || null,
          payload.type,
          payload.reward_value,
          payload.points_or_stamps_needed ?? Math.max(payload.points_cost, payload.stamps_cost),
          payload.points_cost,
          payload.stamps_cost,
          payload.is_active,
        ],
      );
      return serializeReward(result.rows[0]);
    });
    res.status(201).json(reward);
  } catch (error) {
    next(error);
  }
});

router.patch('/api/loyalty/rewards/:id', requirePermission('can_manage_settings'), async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const payload = rewardPatchSchema.parse(req.body);
    const reward = await withTransaction(async (client) => {
      const existing = await client.query(
        `select store_id from public.loyalty_rewards where id = $1 limit 1`,
        [id],
      );
      const storeId = existing.rows[0]?.store_id ? String(existing.rows[0].store_id) : null;
      if (!storeId) throw new ApiError(404, 'Reward tidak ditemukan.');
      await assertStoreOwned(client, storeId, req.authUser!.id);
      const updates = pickDefined(payload as unknown as Record<string, unknown>, [
        'name',
        'description',
        'type',
        'reward_value',
        'points_or_stamps_needed',
        'points_cost',
        'stamps_cost',
        'is_active',
      ]);
      const { clause, values } = buildUpdateClause({ ...updates, updated_at: new Date().toISOString() });
      const result = await client.query(
        `
          update public.loyalty_rewards
          set ${clause}
          where id = $${values.length + 1}
          returning *
        `,
        [...values, id],
      );
      return serializeReward(result.rows[0]);
    });
    res.json(reward);
  } catch (error) {
    next(error);
  }
});

export default router;

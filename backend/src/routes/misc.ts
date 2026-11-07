/**
 * Misc routes: AI insights, ops events, local storage import, notifications.
 * Extracted from monolith index.ts — exact same behavior.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  pool,
  withTransaction,
  ApiError,
  requirePermission,
  env,
  opsEventSchema,
  aiInsightRequestSchema,
  mapGeminiError,
  getAiLimitWindow,
  parseGeminiText,
  insertNotification,
  adminEmails,
  sendFeedbackThankYouEmail,
  log,
  serializeError,
  assertStoreOwned,
} from '../core';
import type { PoolClient } from '../core/db';
import { buildEnhancedAiInsights } from './ai-insights';

const router = Router();

const notificationCategorySchema = z.enum(['gamification', 'challenges', 'business_alert', 'stock', 'system']).optional();
const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).max(100).optional(),
  storeId: z.string().uuid().optional(),
});
const pushSubscriptionSchema = z.object({
  store_id: z.string().uuid().optional().nullable(),
  channel: z.enum(['web_push', 'capacitor_android']),
  endpoint: z.string().trim().min(8).max(2000),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  platform: z.string().trim().max(80).optional().nullable(),
});
const betaFeedbackSchema = z.object({
  store_id: z.string().uuid().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  category: z.enum(['Bug', 'Saran', 'Fitur Baru', 'Lainnya']).optional().default('Lainnya'),
  description: z.string().trim().max(2400).optional().default(''),
  screenshot_data: z.string().trim().max(750_000).optional().nullable(),
  liked: z.string().trim().max(1200).optional().default(''),
  improve: z.string().trim().max(1200).optional().default(''),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
}).refine((value) => value.description.length > 0 || value.liked.length > 0 || value.improve.length > 0, {
  message: 'Feedback tidak boleh kosong.',
});

// (assertStoreOwned now imported from ../core — the canonical version also allows an
// assigned cashier, fixing a 404 that previously blocked cashiers on shared store routes.)

async function assertNotificationStoreAccess(client: Pick<PoolClient, 'query'>, storeId: string, userId: string) {
  const result = await client.query(
    `
      select s.id
      from public.stores s
      where s.id = $1
        and (
          s.owner_id = $2
          or exists (
            select 1
            from public.cashier_outlet_assignments a
            join public.profiles p on p.id = a.cashier_id
            where a.store_id = s.id
              and a.cashier_id = $2
              and a.status = 'active'
              and p.role = 'cashier'
              and p.account_status = 'active'
          )
        )
      limit 1
    `,
    [storeId, userId],
  );
  if (!result.rows[0]) {
    throw new ApiError(404, 'Store tidak ditemukan atau bukan akses Anda.');
  }
}

function isSignaturePlan(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return false;
  const expiresAt = profile.pro_expires_at ?? profile.tier_expires_at ?? null;
  const expired = expiresAt ? new Date(String(expiresAt)).getTime() <= Date.now() : false;
  if (expired || (profile.tier !== 'pro' && profile.is_pro !== true)) return false;
  return profile.pro_plan === 'signature' || profile.pro_plan === 'secangkir' || profile.pro_plan === 'founder';
}

router.post('/api/ops/events', async (req, res, next) => {
  try {
    const payload = opsEventSchema.parse(req.body);

    if (payload.store_id) {
      await withTransaction(async (client) => {
        await assertStoreOwned(client, payload.store_id!, req.authUser!.id);
      });
    }

    await pool.query(
      `
        insert into public.ops_event_logs (
          event_name,
          status,
          actor_user_id,
          actor_email,
          store_id,
          transaction_id,
          source,
          error_message,
          metadata,
          ip_address,
          user_agent
        ) values (
          $1, $2, $3, $4, $5, $6, 'app', $7, $8::jsonb, $9, $10
        )
      `,
      [
        payload.event_name,
        payload.status,
        req.authUser!.id,
        payload.email ?? req.authUser!.email ?? null,
        payload.store_id ?? null,
        payload.transaction_id ?? null,
        payload.error_message ?? null,
        JSON.stringify(payload.metadata ?? {}),
        req.ip,
        req.get('user-agent') ?? null,
      ],
    );

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/api/ai-insight', requirePermission('can_view_reports'), async (req, res, next) => {
  try {
    if (!env.GEMINI_API_KEY) {
      throw new ApiError(502, 'GEMINI_API_KEY belum dikonfigurasi di backend.');
    }

    const payload = aiInsightRequestSchema.parse(req.body);
    const now = new Date();

    const profileResult = await pool.query(
      `
        select is_pro, tier
        from public.profiles
        where id = $1
        limit 1
      `,
      [req.authUser!.id],
    );

    const profile = profileResult.rows[0];
    const isPro = profile?.is_pro === true || profile?.tier === 'pro';
    const limitWindow = getAiLimitWindow(isPro, now);
    const usageResult = await pool.query(
      `
        select count(*)::int as usage_count
        from public.ai_insight_logs
        where user_id = $1
          and created_at >= $2::timestamptz
      `,
      [req.authUser!.id, limitWindow.startsAt],
    );

    const usageCount = usageResult.rows[0]?.usage_count ?? 0;
    if (usageCount >= limitWindow.limitMax) {
      throw new ApiError(
        429,
        `Batas analisis AI tercapai (${limitWindow.limitLabel}). ${limitWindow.resetMessage}`,
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;

    let geminiResponse: globalThis.Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: payload.prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 600,
            responseMimeType: 'application/json',
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('abort')) {
        throw new ApiError(502, 'Layanan AI timeout. Sistem akan memakai analisis cadangan.');
      }

      throw new ApiError(502, 'Layanan AI sedang tidak tersedia. Sistem akan memakai analisis cadangan.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!geminiResponse.ok) {
      const errorPayload = (await geminiResponse.json().catch(() => ({}))) as { error?: { message?: string } };
      const message = errorPayload.error?.message ?? `Gemini error ${geminiResponse.status}`;
      throw new ApiError(502, mapGeminiError(geminiResponse.status, message));
    }

    const geminiPayload = await geminiResponse.json();
    let insight;
    try {
      insight = parseGeminiText(geminiPayload);
    } catch {
      throw new ApiError(502, 'Respons AI tidak valid. Coba lagi.');
    }

    await pool.query(
      `
        insert into public.ai_insight_logs (user_id, created_at)
        values ($1, $2)
      `,
      [req.authUser!.id, now.toISOString()],
    );

    res.json(insight);
  } catch (error) {
    next(error);
  }
});

router.get('/api/ai-insights', requirePermission('can_view_reports'), async (req, res, next) => {
  try {
    const storeId = typeof req.query.storeId === 'string' ? req.query.storeId : '';
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    if (!storeId) {
      throw new ApiError(400, 'storeId wajib diisi.');
    }

    await assertStoreOwned(pool, storeId, req.authUser!.id);

    const profileResult = await pool.query(
      `
        select tier, tier_expires_at, is_pro, pro_plan, pro_expires_at
        from public.profiles
        where id = $1
        limit 1
      `,
      [req.authUser!.id],
    );

    if (!isSignaturePlan(profileResult.rows[0])) {
      throw new ApiError(403, 'AI Insights lengkap tersedia mulai paket Signature.');
    }

    if (!forceRefresh) {
      const cacheResult = await pool.query(
        `
          select payload, generated_at, expires_at
          from public.ai_insights_cache
          where store_id = $1
            and expires_at > now()
          limit 1
        `,
        [storeId],
      );
      const cached = cacheResult.rows[0];
      if (cached?.payload) {
        res.json({
          ...(cached.payload as Record<string, unknown>),
          fromCache: true,
          generatedAt: cached.generated_at,
          cachedUntil: cached.expires_at,
        });
        return;
      }
    }

    const [storeResult, transactionsResult, inventoryResult, menuResult] = await Promise.all([
      pool.query(
        `select id, store_name from public.stores where id = $1 and owner_id = $2 limit 1`,
        [storeId, req.authUser!.id],
      ),
      pool.query(
        `
          select id, date, items, subtotal, discount, total, cashier, is_void, created_at
          from public.transactions
          where store_id = $1
            and coalesce(is_void, false) = false
            and date >= now() - interval '60 days'
          order by date desc
          limit 1200
        `,
        [storeId],
      ),
      pool.query(
        `
          select id, name, stock, unit, min_stock, cost_per_unit, is_active
          from public.inventory
          where store_id = $1
            and coalesce(is_active, true) = true
          order by name asc
        `,
        [storeId],
      ),
      pool.query(
        `
          select id, name, price, category, is_available
          from public.menu_items
          where store_id = $1
          order by sort_order asc, name asc
        `,
        [storeId],
      ),
    ]);

    const insight = buildEnhancedAiInsights({
      storeId,
      storeName: storeResult.rows[0]?.store_name ?? 'KaffePOS',
      transactions: transactionsResult.rows,
      inventory: inventoryResult.rows,
      menu: menuResult.rows,
    });

    await pool.query(
      `
        insert into public.ai_insights_cache (
          store_id,
          generated_by,
          payload,
          generated_at,
          expires_at,
          updated_at
        ) values ($1, $2, $3::jsonb, now(), now() + interval '24 hours', now())
        on conflict (store_id) do update
        set
          generated_by = excluded.generated_by,
          payload = excluded.payload,
          generated_at = excluded.generated_at,
          expires_at = excluded.expires_at,
          updated_at = now()
      `,
      [storeId, req.authUser!.id, JSON.stringify(insight)],
    );

    res.json(insight);
  } catch (error) {
    next(error);
  }
});

router.get('/api/notifications', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
    const category = notificationCategorySchema.parse(req.query.category || undefined);
    const storeId = typeof req.query.storeId === 'string' && z.string().uuid().safeParse(req.query.storeId).success
      ? req.query.storeId
      : null;
    const filters = ['user_id = $1'];
    const values: unknown[] = [req.authUser!.id];

    if (storeId) {
      await withTransaction(async (client) => {
        await assertNotificationStoreAccess(client, storeId, req.authUser!.id);
      });
      values.push(storeId);
      filters.push(`store_id = $${values.length}`);
    }

    if (category) {
      values.push(category);
      filters.push(`coalesce(metadata->>'category', type) = $${values.length}`);
    }

    const whereSql = filters.join(' and ');
    const [items, unreadCount] = await Promise.all([
      pool.query(
        `
          select id, user_id, store_id, title, message, type, is_read, metadata, created_at
          from public.notifications
          where ${whereSql}
          order by created_at desc
          limit $${values.length + 1}
        `,
        [...values, limit],
      ),
      pool.query(
        `
          select count(*)::int as unread_count
          from public.notifications
          where user_id = $1
            and is_read = false
        `,
        [req.authUser!.id],
      ),
    ]);

    res.json({
      items: items.rows,
      unreadCount: unreadCount.rows[0]?.unread_count ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/api/notifications/mark-read', async (req, res, next) => {
  try {
    const payload = markNotificationsReadSchema.parse(req.body ?? {});
    const result = await withTransaction(async (client) => {
      if (payload.storeId) {
        await assertNotificationStoreAccess(client, payload.storeId, req.authUser!.id);
      }

      if (payload.ids && payload.ids.length > 0) {
        const update = await client.query(
          `
            update public.notifications
            set is_read = true
            where user_id = $1
              and id = any($2::uuid[])
              ${payload.storeId ? 'and store_id = $3' : ''}
          `,
          payload.storeId ? [req.authUser!.id, payload.ids, payload.storeId] : [req.authUser!.id, payload.ids],
        );
        return update.rowCount ?? 0;
      }

      const update = await client.query(
        `
          update public.notifications
          set is_read = true
          where user_id = $1
            and is_read = false
            ${payload.storeId ? 'and store_id = $2' : ''}
        `,
        payload.storeId ? [req.authUser!.id, payload.storeId] : [req.authUser!.id],
      );
      return update.rowCount ?? 0;
    });

    res.json({ updated: result });
  } catch (error) {
    next(error);
  }
});

router.patch('/api/notifications/read-all', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        update public.notifications
        set is_read = true
        where user_id = $1
          and is_read = false
      `,
      [req.authUser!.id],
    );

    res.json({ updated: result.rowCount ?? 0 });
  } catch (error) {
    next(error);
  }
});

router.post('/api/notifications/push-subscription', async (req, res, next) => {
  try {
    const payload = pushSubscriptionSchema.parse(req.body ?? {});
    if (payload.store_id) {
      await withTransaction(async (client) => {
        await assertNotificationStoreAccess(client, payload.store_id!, req.authUser!.id);
      });
    }

    const result = await pool.query(
      `
        insert into public.notification_push_subscriptions (
          user_id, store_id, channel, endpoint, payload, platform, is_active, updated_at
        ) values ($1, $2, $3, $4, $5::jsonb, $6, true, now())
        on conflict (user_id, channel, endpoint) do update
        set
          store_id = excluded.store_id,
          payload = excluded.payload,
          platform = excluded.platform,
          is_active = true,
          updated_at = now()
        returning id, channel, endpoint, platform, is_active, updated_at
      `,
      [
        req.authUser!.id,
        payload.store_id ?? null,
        payload.channel,
        payload.endpoint,
        JSON.stringify(payload.payload),
        payload.platform ?? null,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post('/api/beta-feedback', async (req, res, next) => {
  try {
    const payload = betaFeedbackSchema.parse(req.body ?? {});
    if (payload.store_id) {
      await withTransaction(async (client) => {
        await assertNotificationStoreAccess(client, payload.store_id!, req.authUser!.id);
      });
    }

    const result = await pool.query(
      `
        insert into public.beta_feedback (
          user_id, store_id, rating, category, description, screenshot_data, liked, improve, metadata
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb
        )
        returning id, user_id, store_id, rating, category, description, liked, improve, metadata, created_at, (screenshot_data is not null) as has_screenshot
      `,
      [
        req.authUser!.id,
        payload.store_id ?? null,
        payload.rating ?? null,
        payload.category,
        payload.description,
        payload.screenshot_data ?? null,
        payload.liked,
        payload.improve,
        JSON.stringify(payload.metadata),
      ],
    );

    const feedback = result.rows[0];
    await withTransaction(async (client) => {
      const recipients = new Set<string>();
      if (payload.store_id) {
        const ownerResult = await client.query(
          `select owner_id from public.stores where id = $1 limit 1`,
          [payload.store_id],
        );
        if (ownerResult.rows[0]?.owner_id) recipients.add(String(ownerResult.rows[0].owner_id));
      }
      if (adminEmails.size > 0) {
        const adminResult = await client.query(
          `select id from public.profiles where lower(email) = any($1::text[])`,
          [[...adminEmails]],
        );
        adminResult.rows.forEach((row) => recipients.add(String(row.id)));
      }
      if (recipients.size === 0) recipients.add(req.authUser!.id);

      await Promise.all([...recipients].map((userId) => insertNotification(
        client,
        userId,
        'Feedback Closed Beta masuk',
        `${payload.category}: ${payload.description || payload.improve || payload.liked}`.slice(0, 180),
        payload.category === 'Bug' ? 'warning' : 'business_alert',
        {
          category: 'beta_feedback',
          feedbackId: feedback.id,
          rating: payload.rating ?? null,
          hasScreenshot: Boolean(payload.screenshot_data),
        },
        payload.store_id ?? null,
      )));
    });

    if (req.authUser?.email) {
      sendFeedbackThankYouEmail(req.authUser.email, payload.category)
        .catch((error) => log('warn', 'feedback.thank_you_email_failed', {
          userId: req.authUser?.id,
          feedbackId: feedback.id,
          error: serializeError(error),
        }));
    }

    res.status(201).json(feedback);
  } catch (error) {
    next(error);
  }
});

export default router;

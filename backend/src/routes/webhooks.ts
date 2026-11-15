/**
 * Pre-authentication payment webhook (Mayar).
 *
 * POST /api/webhooks/mayar
 *   1. Authenticate: `X-Callback-Token` header or `?token=` must equal MAYAR_WEBHOOK_TOKEN.
 *   2. Acknowledge (200) events that are not a payment: membership, shipping, reminders,
 *      dashboard "Test URL" calls and payments that do not belong to KaffePOS.
 *   3. Find the KaffePOS record — a POS payment order or a subscription session.
 *   4. Re-read the payment request from the Mayar API with the reference KaffePOS stored
 *      and settle only when Mayar itself reports it paid (Mayar does not sign webhooks).
 *   5. Settle idempotently: POS → transaction + kitchen order, subscription → activation.
 * Non-2xx answers make Mayar retry, so transient failures recover on their own.
 */
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  broadcastKitchenEvent,
  withTransaction,
  ApiError,
  activatePaidSubscription,
  sendPaymentSuccessEmail,
  log,
  serializeError,
  insertNotification,
  pool,
  isMayarWebhookTokenConfigured,
} from '../core';
import { PaymentService } from '../services/PaymentService';
import { CommissionService } from '../services/CommissionService';
import { isReferralCommissionCreationEnabled } from '../lib/config/feature-flags';
import { alertOnPaymentWebhookFailure } from '../lib/alerting';
import { createPaymentProvider } from '../payments/payment-provider.factory';
import type { PaymentProvider, PaymentStatusResult } from '../payments/payment-provider.types';

const router = Router();

async function applySubscriptionPaymentResult(result: PaymentStatusResult, eventType: string) {
  if (!result.signatureValid || (!result.merchantOrderId && !result.providerReference)) {
    throw new ApiError(401, 'Signature pembayaran tidak valid.');
  }
  const lookupOrderId = result.merchantOrderId ?? result.providerReference!;
  const lookupProviderRef = result.providerReference ?? result.merchantOrderId!;
  const paidEmail = await withTransaction(async (client) => {
    const sessionResult = await client.query(
      `
        select *
        from public.subscription_payment_sessions
        where merchant_order_id = $1
           or midtrans_order_id = $1
           or (provider_reference is not null and provider_reference = $2)
        limit 1
        for update
      `,
      [lookupOrderId, lookupProviderRef],
    );
    const session = sessionResult.rows[0];
    if (!session) throw new ApiError(404, 'Sesi pembayaran tidak ditemukan.');
    const resolvedOrderId = String(
      session.merchant_order_id ?? session.midtrans_order_id ?? lookupOrderId,
    );
    if (result.amount != null && Math.round(Number(session.amount ?? 0)) !== Math.round(result.amount)) {
      throw new ApiError(400, 'Jumlah pembayaran tidak sesuai.');
    }

    await client.query(
      `
        insert into public.payment_events (
          payment_id, provider, event_type, provider_reference, merchant_order_id, raw_status,
          internal_status, payload, signature_valid, processed_at
        ) values ($1, $8, $2, $3, $4, $5, $6, $7::jsonb, true, now())
      `,
      [session.id, eventType, result.providerReference, resolvedOrderId, result.rawStatus, result.internalStatus, JSON.stringify(result.raw), result.provider],
    ).catch((err) => log('error', 'payment_events.insert_failed', {
      kind: 'subscription', merchantOrderId: resolvedOrderId, eventType, error: serializeError(err),
    }));

    const paidAt = result.paidAt ?? new Date().toISOString();
    await client.query(
      `
        update public.subscription_payment_sessions
        set provider = $8,
            provider_reference = coalesce($2, provider_reference),
            payment_method = coalesce($3, payment_method),
            provider_status = $4,
            internal_status = $5,
            transaction_status = $5,
            callback_received_at = case when $6 then coalesce(callback_received_at, now()) else callback_received_at end,
            paid_at = case when $5 = 'paid' then coalesce(paid_at, $7::timestamptz) else paid_at end,
            settled_at = case when $5 = 'paid' then coalesce(settled_at, $7::timestamptz) else settled_at end,
            expired_at = case when $5 = 'expired' then coalesce(expired_at, now()) else expired_at end,
            updated_at = now()
        where id = $1
      `,
      [session.id, result.providerReference, result.paymentMethod, result.rawStatus, result.internalStatus, eventType === 'callback', paidAt, result.provider],
    );

    if (result.internalStatus === 'paid' && !session.subscription_id) {
      const activation = await activatePaidSubscription(client, {
        userId: session.user_id as string,
        plan: session.plan as 'secangkir' | 'kopi_susu' | 'signature' | 'founder',
        billingCycle: session.billing_cycle as 'free' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly',
        paymentAmount: Number(session.amount ?? 0),
        paymentMethod: result.paymentMethod ?? result.provider,
        paymentRef: resolvedOrderId,
        paymentNote: `${result.provider} ${result.paymentMethod ?? 'payment'}`,
        paidAt,
        sessionId: session.id as string,
      });
      if (isReferralCommissionCreationEnabled()) {
        await new CommissionService(client).createFromPayment({
          userId: session.user_id as string,
          paymentId: session.id as string,
          grossAmount: Number(session.amount ?? 0),
          paidAt,
          orderId: resolvedOrderId,
        }).catch((error) => log('warn', 'affiliate.commission_sync_failed', { error: serializeError(error), orderId: resolvedOrderId }));
      }
      return activation;
    }

    // Non-paid terminal status: reverse any pending affiliate commission and tell
    // the user so they can retry (parity with the removed Midtrans failure branch).
    if (result.internalStatus === 'failed' || result.internalStatus === 'cancelled' || result.internalStatus === 'expired') {
      if (isReferralCommissionCreationEnabled()) {
        await new CommissionService(client).cancelForPayment({
          userId: session.user_id as string,
          paymentId: session.id as string,
          status: result.rawStatus ?? result.internalStatus,
          orderId: resolvedOrderId,
        }).catch((error) => log('warn', 'affiliate.commission_cancel_failed', { error: serializeError(error), orderId: resolvedOrderId }));
      }
      await insertNotification(
        client,
        session.user_id as string,
        'Pembayaran subscription gagal',
        'Pembayaran belum berhasil. Kamu bisa coba lagi kapan saja.',
        'warning',
        { paymentRef: resolvedOrderId, status: result.rawStatus },
      );
    }
    return null;
  });

  if (paidEmail?.email) {
    await sendPaymentSuccessEmail(
      paidEmail.email,
      paidEmail.displayName ?? 'KaffePOS User',
      paidEmail.plan.toUpperCase(),
      paidEmail.paymentAmount,
      lookupOrderId,
    ).catch((error) => log('warn', 'email.settlement_failed', { error: serializeError(error), orderId: lookupOrderId }));
  }
}

/** Settle a POS payment_order from a gateway callback. Returns false if the
 *  order id does not belong to a POS order (so the caller can try subscriptions). */
async function applyPosPaymentResult(result: PaymentStatusResult, eventType: string): Promise<boolean> {
  if (!result.merchantOrderId && !result.providerReference) return false;
  const lookupOrderId = result.merchantOrderId ?? result.providerReference!;
  const lookupProviderRef = result.providerReference ?? result.merchantOrderId!;
  const settlement = await withTransaction(async (client) => {
    const orderResult = await client.query(
      `
        select id, user_id, store_id, transaction_id, midtrans_order_id, merchant_order_id,
               gross_amount, subtotal, discount_amount, tax_amount, customer_name, items, status
        from public.payment_orders
        where merchant_order_id = $1
           or midtrans_order_id = $1
           or (provider_reference is not null and provider_reference = $2)
        limit 1
        for update
      `,
      [lookupOrderId, lookupProviderRef],
    );
    const paymentOrder = orderResult.rows[0];
    if (!paymentOrder) return null;

    // A paid/completed order is terminal. Ignore ANY further webhook for it — whether a
    // late failure (never reverse a settled sale) or a duplicate/replayed success (avoid
    // re-finalizing and re-notifying). The settlement already happened on the first paid event.
    if (paymentOrder.status === 'paid' || paymentOrder.status === 'completed') {
      return { storeId: paymentOrder.store_id as string, transactionId: paymentOrder.transaction_id ?? null, kitchenOrder: null };
    }

    if (result.amount != null && Math.round(Number(paymentOrder.gross_amount ?? 0)) !== Math.round(result.amount)) {
      throw new ApiError(400, 'Jumlah pembayaran tidak sesuai.');
    }

    const paidAt = result.paidAt ?? new Date().toISOString();
    const orderStatus = result.internalStatus === 'paid'
      ? 'paid'
      : result.internalStatus === 'cancelled'
        ? 'cancelled'
        : (result.internalStatus === 'failed' || result.internalStatus === 'expired')
          ? 'failed'
          : 'pending';

    await client.query(
      `
        update public.payment_orders
        set provider = $2,
            provider_reference = coalesce($3, provider_reference),
            payment_method = coalesce($4, payment_method),
            transaction_status = $5,
            internal_status = $5,
            provider_status = $6,
            status = $7,
            paid_at = case when $7 = 'paid' then coalesce(paid_at, $8::timestamptz) else paid_at end,
            failed_at = case when $7 = 'failed' then coalesce(failed_at, now()) else failed_at end,
            callback_received_at = coalesce(callback_received_at, now()),
            updated_at = now()
        where id = $1
      `,
      [paymentOrder.id, result.provider, result.providerReference, result.paymentMethod, result.internalStatus, result.rawStatus, orderStatus, paidAt],
    );

    await client.query(
      `
        insert into public.payment_events (
          payment_id, provider, event_type, provider_reference, merchant_order_id, raw_status,
          internal_status, payload, signature_valid, processed_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, true, now())
      `,
      [paymentOrder.id, result.provider, eventType, result.providerReference, result.merchantOrderId, result.rawStatus, result.internalStatus, JSON.stringify(result.raw)],
    ).catch((err) => log('error', 'payment_events.insert_failed', {
      kind: 'pos', merchantOrderId: result.merchantOrderId, eventType, error: serializeError(err),
    }));

    let transactionId: string | null = paymentOrder.transaction_id ?? null;
    let kitchenOrder: Record<string, unknown> | null = null;
    if (orderStatus === 'paid') {
      const finalized = await PaymentService.finalizePaidOrder(client, paymentOrder, { paymentType: result.paymentMethod ?? null, paidAt });
      transactionId = finalized.transactionId ?? transactionId;
      kitchenOrder = finalized.kitchenOrder as Record<string, unknown> | null;
      await insertNotification(client, paymentOrder.user_id as string, 'Pembayaran diterima', 'Pembayaran POS sudah diterima.', 'success', { paymentRef: result.merchantOrderId, transactionId }, paymentOrder.store_id as string);
    } else if (orderStatus === 'failed' || orderStatus === 'cancelled') {
      await PaymentService.voidCompletedOrderTransaction(client, paymentOrder, `Pembayaran ${result.rawStatus ?? orderStatus}`);
      await insertNotification(client, paymentOrder.user_id as string, 'Pembayaran gagal', 'Pembayaran POS belum berhasil. Coba ulang dari kasir.', 'warning', { paymentRef: result.merchantOrderId, status: result.rawStatus }, paymentOrder.store_id as string);
    }
    return { storeId: paymentOrder.store_id as string, transactionId, kitchenOrder };
  });

  if (!settlement) return false;
  if (settlement.kitchenOrder && settlement.storeId && settlement.transactionId) {
    broadcastKitchenEvent({
      id: randomUUID(),
      type: 'order_created',
      store_id: settlement.storeId,
      order_id: String(settlement.kitchenOrder.id),
      created_at: new Date().toISOString(),
      payload: { order: settlement.kitchenOrder, transactionId: settlement.transactionId },
    });
  }
  return true;
}

type MayarPaymentRecord = {
  kind: 'pos' | 'subscription';
  id: string;
  merchantOrderId: string;
  providerReference: string | null;
  amount: number;
  settled: boolean;
};

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)));
}

/** Finds the POS payment order or subscription session a Mayar webhook refers to. */
async function findMayarPaymentRecord(result: PaymentStatusResult): Promise<MayarPaymentRecord | null> {
  const orderIds = uniqueIds([...(result.orderIdCandidates ?? []), result.merchantOrderId]);
  const references = uniqueIds([
    ...(result.referenceCandidates ?? []),
    result.providerReference,
    result.providerTransactionId,
  ]);
  if (orderIds.length === 0 && references.length === 0) return null;

  const posResult = await pool.query(
    `
      select id, coalesce(merchant_order_id, midtrans_order_id) as merchant_order_id, provider_reference,
             gross_amount as amount, status
      from public.payment_orders
      where coalesce(provider, 'mayar') = 'mayar'
        and (
          merchant_order_id = any($1::text[])
          or midtrans_order_id = any($1::text[])
          or provider_reference = any($2::text[])
          or metadata->>'providerTransactionId' = any($2::text[])
        )
      order by created_at desc
      limit 1
    `,
    [orderIds, references],
  );
  const posOrder = posResult.rows[0];
  if (posOrder) {
    return {
      kind: 'pos',
      id: String(posOrder.id),
      merchantOrderId: String(posOrder.merchant_order_id),
      providerReference: posOrder.provider_reference ? String(posOrder.provider_reference) : null,
      amount: Math.round(Number(posOrder.amount ?? 0)),
      settled: posOrder.status === 'paid' || posOrder.status === 'completed',
    };
  }

  const sessionResult = await pool.query(
    `
      select id, coalesce(merchant_order_id, midtrans_order_id) as merchant_order_id, provider_reference,
             amount, coalesce(internal_status, transaction_status) as status, subscription_id
      from public.subscription_payment_sessions
      where coalesce(provider, 'mayar') = 'mayar'
        and (
          merchant_order_id = any($1::text[])
          or midtrans_order_id = any($1::text[])
          or provider_reference = any($2::text[])
          or metadata->>'providerTransactionId' = any($2::text[])
        )
      order by created_at desc
      limit 1
    `,
    [orderIds, references],
  );
  const session = sessionResult.rows[0];
  if (!session) return null;
  return {
    kind: 'subscription',
    id: String(session.id),
    merchantOrderId: String(session.merchant_order_id),
    providerReference: session.provider_reference ? String(session.provider_reference) : null,
    amount: Math.round(Number(session.amount ?? 0)),
    settled: Boolean(session.subscription_id),
  };
}

/**
 * Asks Mayar whether the payment behind this record is really paid. Uses the reference
 * KaffePOS stored when it created the payment; only rows without one fall back to the
 * reference in the webhook, and then Mayar's record must point back at the same order.
 */
async function confirmWithMayarApi(provider: PaymentProvider, record: MayarPaymentRecord, result: PaymentStatusResult) {
  const reference = record.providerReference ?? result.providerReference;
  if (!reference) {
    throw new ApiError(409, 'Referensi pembayaran Mayar tidak ditemukan untuk order ini.');
  }
  const confirmed = await provider.checkTransactionStatus({
    merchantOrderId: record.merchantOrderId,
    providerReference: reference,
    amount: record.amount,
  });
  if (!record.providerReference && !(confirmed.orderIdCandidates ?? []).includes(record.merchantOrderId)) {
    throw new ApiError(409, 'Referensi Mayar tidak cocok dengan order KaffePOS.');
  }
  return confirmed;
}

async function handleMayarWebhook(
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1],
  next: Parameters<Parameters<typeof router.post>[1]>[2],
) {
  try {
    if (!isMayarWebhookTokenConfigured()) {
      log('error', 'mayar_webhook.token_not_configured', {});
      throw new ApiError(503, 'Webhook Mayar belum dikonfigurasi.');
    }

    const provider = createPaymentProvider('mayar');
    const result = await provider.verifyCallback({
      body: (req.body ?? {}) as Record<string, unknown>,
      headers: req.headers,
      rawBody: req.rawBody,
      query: req.query as Record<string, unknown>,
    });

    if (!result.signatureValid) {
      log('warn', 'mayar_webhook.token_rejected', {
        eventType: result.eventType ?? null,
        hasHeaderToken: Boolean(req.headers['x-callback-token']),
        hasQueryToken: typeof req.query?.token === 'string',
      });
      throw new ApiError(401, 'Token webhook Mayar tidak valid.');
    }

    if (result.internalStatus !== 'paid') {
      log('info', 'mayar_webhook.ignored', {
        eventType: result.eventType ?? null,
        rawStatus: result.rawStatus,
        internalStatus: result.internalStatus,
        merchantOrderId: result.merchantOrderId,
      });
      res.status(200).json({
        received: true,
        provider: 'mayar',
        ignored: true,
        reason: 'not_a_paid_event',
        event: result.eventType ?? null,
        status: result.internalStatus,
      });
      return;
    }

    const record = await findMayarPaymentRecord(result);
    if (!record) {
      log('warn', 'mayar_webhook.order_not_found', {
        eventType: result.eventType ?? null,
        merchantOrderId: result.merchantOrderId,
        providerReference: result.providerReference,
      });
      res.status(200).json({ received: true, provider: 'mayar', ignored: true, reason: 'order_not_found', event: result.eventType ?? null });
      return;
    }

    if (record.settled) {
      res.status(200).json({ received: true, provider: 'mayar', status: 'paid', kind: record.kind, duplicate: true });
      return;
    }

    const confirmed = await confirmWithMayarApi(provider, record, result);
    if (confirmed.internalStatus !== 'paid') {
      log('warn', 'mayar_webhook.not_confirmed', {
        kind: record.kind,
        merchantOrderId: record.merchantOrderId,
        apiStatus: confirmed.rawStatus,
      });
      throw new ApiError(409, 'Pembayaran belum terkonfirmasi di Mayar.');
    }

    const settlement: PaymentStatusResult = {
      ...result,
      signatureValid: true,
      merchantOrderId: record.merchantOrderId,
      providerReference: record.providerReference ?? confirmed.providerReference ?? result.providerReference,
      amount: confirmed.amount ?? result.amount,
      paymentMethod: result.paymentMethod && result.paymentMethod !== 'MAYAR' ? result.paymentMethod : confirmed.paymentMethod,
      rawStatus: confirmed.rawStatus ?? result.rawStatus,
      internalStatus: 'paid',
      paidAt: result.paidAt ?? confirmed.paidAt,
      raw: { webhook: result.raw, confirmation: confirmed.raw },
    };

    if (record.kind === 'pos') {
      await applyPosPaymentResult(settlement, 'callback');
    } else {
      await applySubscriptionPaymentResult(settlement, 'callback');
    }

    res.status(200).json({ received: true, provider: 'mayar', status: 'paid', kind: record.kind });
  } catch (error) {
    alertOnPaymentWebhookFailure('Mayar webhook processing failed', { error: String(error) });
    next(error);
  }
}

router.get('/api/webhooks/mayar', (_req, res) => {
  res.status(200).json({
    ok: true,
    provider: 'mayar',
    message: 'Mayar webhook endpoint active.',
    webhookTokenConfigured: isMayarWebhookTokenConfigured(),
  });
});
router.post('/api/webhooks/mayar', handleMayarWebhook);

export default router;

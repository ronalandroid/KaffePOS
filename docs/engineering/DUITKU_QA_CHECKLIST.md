# DOKU QA Checklist

> **DOKU is the active payment gateway.** Authoritative config lives in
> [`backend/src/core/env.ts`](../../backend/src/core/env.ts) and the working
> template [`backend/.env.staging.example`](../../backend/.env.staging.example).
> The old `duitku` provider value is invalid in the env schema and will stop the
> backend from booting.

## Gateway config

- [ ] Set Coolify backend `PAYMENT_GATEWAY_PROVIDER=doku`.
- [ ] Set `PAYMENT_INTEGRATION_ENABLED=true`.
- [ ] Set `DOKU_ENVIRONMENT=sandbox`.
- [ ] Set sandbox `DOKU_CLIENT_ID` and `DOKU_SECRET_KEY` in the **backend service only** (never in the frontend).
- [ ] Set `DOKU_CALLBACK_URL=https://api.kaffepos.my.id/api/webhooks/doku`.
- [ ] Set `SUBSCRIPTION_PAYMENT_MODE=doku_sandbox`.

## Payment flow

- [ ] Start subscription checkout and verify redirect to the DOKU payment URL.
- [ ] Return URL shows pending, not paid.
- [ ] Webhook (`/api/webhooks/doku`) with a valid signature activates the subscription exactly once.
- [ ] Duplicate webhook does not create a duplicate receipt / payment-history row.
- [ ] Invalid webhook signature does not update payment.
- [ ] `POST /api/payments/:paymentId/check` refreshes status only for owner/admin.

## Generic Start QA

- [ ] `POST /api/payments/start` returns `success=true` and `data.paymentUrl`.
- [ ] `/api/subscriptions/payments/create` still returns the legacy payment payload.
- [ ] Frontend checkout does not load or require Midtrans Snap when `VITE_PAYMENT_GATEWAY_PROVIDER=doku`.
- [ ] Settings billing-return view shows the pending/check state and does not mark paid.

## Production cutover

- [ ] Switch to `DOKU_ENVIRONMENT=production` and `SUBSCRIPTION_PAYMENT_MODE=doku_production` with live DOKU credentials.
- [ ] Run one real end-to-end paid transaction before going live.

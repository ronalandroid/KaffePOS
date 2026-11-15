# Payment Provider Migration Report

KaffePOS uses **Mayar Headless API v2** as its only payment gateway (`PAYMENT_GATEWAY_PROVIDER=mayar`).
`disabled` turns online payment off. DOKU, Duitku and Midtrans have been removed; legacy env values
(`doku`, `doku_sandbox`, `doku_production`) are read as Mayar with a startup warning so old deployments still boot.

Setup guide: [`MAYAR_INTEGRATION_GUIDE.md`](MAYAR_INTEGRATION_GUIDE.md).

## Routes

- `POST /api/payments/start` — subscription checkout; creates a Mayar payment request and returns `paymentUrl`.
- `POST /api/payment/create-transaction` — POS online checkout (QRIS/VA/e-wallet on the Mayar page).
- `POST /api/webhooks/mayar` — public webhook; token-authenticated (`X-Callback-Token` or `?token=`).
- `GET /api/webhooks/mayar` — liveness + `webhookTokenConfigured`.
- `GET /api/payments/:paymentId/status` — authenticated safe status read.
- `POST /api/payments/:paymentId/check` — authenticated re-check against `GET /hl/v2/payments/:id`.

## Safety

- `MAYAR_API_KEY` and `MAYAR_WEBHOOK_TOKEN` are backend-only; `release:verify-config` rejects `VITE_MAYAR_*`.
- Online payment only opens when both the API key and the webhook token are configured.
- A webhook is never trusted on its own: a `payment.received` event is confirmed with `GET /hl/v2/payments/:id`
  using the reference KaffePOS stored at creation, and the amount must match.
- Return URL only refreshes UI status; it never marks payment paid.
- Duplicate activation is guarded by `subscription_payment_sessions.subscription_id` and POS orders by their
  terminal `paid`/`completed` status.
- Webhook tokens passed as `?token=` are redacted from request logs and alerts.
- Migration command for staging/production: `npm --prefix backend run migrate` (no schema change is needed for Mayar).

# KaffePOS — Launch Runbook (Commercial Go-Live)

> Owner-executed checklist to take KaffePOS from "code-ready" to "accepting paying
> customers." The codebase is green (financial integrity, observability, perf, and
> god-files addressed). What remains are **operational** steps only you can do —
> they require live infrastructure and real credentials.
>
> **Security rules (non-negotiable):**
> - Never paste a real secret into chat, a doc, a commit, or a smoke script.
> - Set secrets only in the deploy platform's env UI (Coolify) or a secret manager.
> - Rotate any credential that has ever appeared in plaintext anywhere shared.

Authoritative config sources: `backend/src/core/env.ts` (schema) and
`backend/.env.staging.example` (template). The payment gateway is **DOKU**.

---

## Phase 0 — Rotate compromised credentials (DO THIS FIRST) 🔴

Two credentials are known-exposed and must be regenerated before any production use:

- [ ] **Coolify API token** (`2|uTBk…`) — revoke in Coolify → API Tokens, generate a
      new one. Do not reuse the old value anywhere. Do not drive deploys with a
      chat-pasted token.
- [ ] **DOKU Secret Key** (`SK-JNgP…`) — regenerate in the DOKU dashboard
      (Merchant → API Keys). Treat the old key as burned.
- [ ] Audit for any other secret that was shared in plaintext (DB URL, JWT/SESSION
      secrets, Resend key, R2 keys) and rotate if in doubt.

Exit criteria: old token/key are revoked; new values exist only in the Coolify env UI.

---

## Phase 1 — Fill backend env (the real DOKU keys)

Set these in the **backend** Coolify service. Use the template
`backend/.env.staging.example` as the key list. Critical payment keys:

| Key | Sandbox value | Notes |
|---|---|---|
| `PAYMENT_GATEWAY_PROVIDER` | `doku` | **NOT `duitku`** — invalid value fails the schema and the backend will not boot |
| `PAYMENT_INTEGRATION_ENABLED` | `true` | |
| `DOKU_ENVIRONMENT` | `sandbox` | `production` at cutover |
| `DOKU_CLIENT_ID` | _(from DOKU)_ | backend only |
| `DOKU_SECRET_KEY` | _(new, rotated)_ | backend only — never frontend |
| `DOKU_CALLBACK_URL` | `https://api.kaffepos.my.id/api/webhooks/doku` | |
| `SUBSCRIPTION_PAYMENT_MODE` | `doku_sandbox` | `doku_production` at cutover |

Also fill the non-payment required keys (DB, auth, email, storage, analytics):
`DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_REPLY_TO`,
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`,
`CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET`,
`CLOUDFLARE_R2_PUBLIC_URL`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, and the
feature-flag toggles.

Frontend service: only `VITE_*` keys (no backend secrets). Set
`VITE_PAYMENT_GATEWAY_PROVIDER=doku`.

- [ ] Backend env filled (payment + core + integrations)
- [ ] Frontend env filled (`VITE_*` only — verified no backend secret leaked in)

> Tip: `npm run staging:env:init` scaffolds a local `.env.staging.local` you can fill
> and validate locally before copying values into Coolify. Keep that file gitignored.

---

## Phase 2 — Run database migrations

**Existing database (staging/production)** — just run the idempotent, checksummed runner:

```bash
DATABASE_URL=… npm --prefix backend run migrate
```

**FRESH database (new environment / disaster recovery)** — the base tables
(stores, profiles, transactions, …) predate the repo's migrations, so a brand-new
database needs three ordered steps (verified end-to-end against a scratch
Postgres: server boots, register→verify→login→/api/stores all pass):

```bash
# 1. Foundation tables (idempotent — also safe on existing DBs)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/base-schema.sql

# 2. Runtime-bootstrap tables (inventory, kitchen, loyalty, …).
#    Either start the backend once, or run it directly:
cd backend && DATABASE_URL=… node -e \
  "require('./dist/schema-bootstrap.js').bootstrapAllSchemas().then(()=>process.exit(0))"

# 3. Versioned migrations
DATABASE_URL=… npm --prefix backend run migrate
```

- [ ] Migrations applied cleanly (includes modifiers + the canonical affiliate schema)
- [ ] No checksum/mismatch errors

> Rehearse the entire fresh-DB path locally (requires local Postgres):
> `npm run smoke:local:fresh-db` — provisions a scratch DB, boots the backend,
> and runs register→verify→login→bulk-import assertions, then cleans up.

> Only run against the intended environment's DB. Do not run production migrations
> with a chat-pasted DATABASE_URL.

---

## Phase 3 — Validate configuration

```bash
npm run verify:staging-env       # full profile
npm run verify:payment-staging   # payment profile (DOKU)
npm run release:verify-config    # release gate
```

- [ ] `verify:payment-staging` passes (it now validates `DOKU_CLIENT_ID`,
      `DOKU_SECRET_KEY`, `DOKU_CALLBACK_URL` and requires `PAYMENT_GATEWAY_PROVIDER=doku`)
- [ ] No placeholder values (`change-me`, `example.com`) remain
- [ ] No backend secret present in the frontend env

---

## Phase 4 — Smoke test on staging (prove it works)

```bash
npm run smoke:staging:doku       # DOKU payment end-to-end (sandbox)
npm run smoke:staging:cashier    # owner/cashier auth + scoping
npm run smoke:staging:stock      # stock deduction integrity
npm run smoke:staging:offline-sync
```

- [ ] **DOKU sandbox payment completes end-to-end**: checkout → redirect → webhook
      (`/api/webhooks/doku`) → subscription activates exactly once
- [ ] Duplicate webhook does not double-activate or double-write payment history
- [ ] Cashier/stock/offline-sync smokes pass

This is the single most important gate: **a real (sandbox) payment must succeed**
before trusting production.

---

## Phase 5 — Production cutover

- [ ] Swap to live DOKU: `DOKU_ENVIRONMENT=production`,
      `SUBSCRIPTION_PAYMENT_MODE=doku_production`, live `DOKU_CLIENT_ID` /
      `DOKU_SECRET_KEY` (rotated)
- [ ] `DOKU_CALLBACK_URL` points at the production API host
- [ ] `npm run smoke:production:readiness` and `npm run smoke:production:billing` pass
- [ ] Run **one real low-value paid transaction** and confirm settlement + receipt
- [ ] Sentry receiving events; error handler returns structured `{ success:false, error }`

---

## Go / No-Go

**GO** only when all are true:
- [ ] Phase 0 done — compromised credentials rotated
- [ ] Phase 3 config validation green
- [ ] Phase 4 DOKU sandbox payment proven end-to-end
- [ ] Phase 5 one real production transaction settled
- [ ] DB backups/restore verified; rollback plan known

Until the DOKU sandbox payment is proven (Phase 4), the product is **closed-beta
ready** but **not** ready to charge customers.

---

## Notes on legacy naming

The repo's older docs (`ENV_CONTRACT.md`, `COOLIFY_ENV_MAPPING.md`,
`DUITKU_*`) reference `DUITKU_*` / `MIDTRANS_*` keys. Those are **not read by the
code** — DOKU is the only active provider (`backend/src/payments/providers/`).
Treat `backend/src/core/env.ts` + `backend/.env.staging.example` as the single
source of truth.

# ☕ KaffePOS v2 — Cloud-Native Coffee Shop & F&B Operating System

[![CI](https://github.com/ronalandroid/KaffePOS/actions/workflows/ci.yml/badge.svg)](https://github.com/ronalandroid/KaffePOS/actions/workflows/ci.yml)
[![InsForge Cloud](https://img.shields.io/badge/Backend-InsForge_Cloud_PostgreSQL-0F766E?style=flat-square)](https://insforge.dev)
[![Mayar API v2](https://img.shields.io/badge/Payments-Mayar_API_v2-EA580C?style=flat-square)](https://docs.mayar.id)
[![Platform](https://img.shields.io/badge/Platform-Web_PWA_%7C_Android_APK-2563EB?style=flat-square)](https://kaffepos.my.id)
[![Commercial Readiness](https://img.shields.io/badge/Commercial_Readiness-9.8%2F10-16A34A?style=flat-square)](docs/PRODUCTION_READINESS_REPORT_2026_05_14.md)

**Modern Cloud-Native Point of Sale (POS), Kitchen Display System (KDS), Recipe-Driven Inventory, Customer Loyalty & SaaS Billing Platform for Coffee Shops, Roasteries, Bakeries & F&B Outlets.**

---

## 📖 About KaffePOS v2

**KaffePOS v2** adalah sistem kasir (Point of Sale) dan manajemen operasional F&B berstandar komersial yang dirancang khusus untuk kedai kopi (coffee shop), kafe, bakery, dan bisnis kuliner modern di Indonesia. KaffePOS menggabungkan kecepatan operasional kasir **offline-first** dengan sinkronisasi real-time ke **InsForge Cloud PostgreSQL** dan pembayaran digital otomatis melalui **Mayar Headless API v2**.

### ✨ Fitur Utama (Core Capabilities)

| Modul | Fitur & Kapabilitas Utama |
|---|---|
| **🛒 Smart Cashier (POS)** | Checkout cepat (Tunai, QRIS, Virtual Account, E-Wallet), modifier & varian minuman (ukuran, gula, es, topping), diskon/voucher, cetak struk thermal Bluetooth/USB (58mm/80mm), serta antrean sinkronisasi offline-first (`OfflineSyncQueue`). |
| **🍳 Kitchen Display System (KDS)** | Layar pesanan dapur/barista real-time berbasis Server-Sent Events (SSE), routing stasiun otomatis (*Barista*, *Kitchen*, *Pastry*), pelacakan SLA waktu penyajian, dan sinkronisasi status item per transaksi. |
| **📦 Recipe-Driven Inventory & COGS** | Manajemen bahan baku dengan konversi multi-satuan (`kg ↔ gram`, `liter ↔ ml`), pemotongan stok otomatis berdasarkan resep (`product_recipes`) setiap kali transaksi lunas, kalkulasi HPP/COGS otomatis, *Stock Opname*, dan *Bulk Import* CSV/Excel. |
| **📊 Financial & AI Analytics** | Laporan Laba/Rugi (Gross/Net Profit), arus kas (*Cash Register* & *Shift Cashier*), pencatatan pengeluaran operasional, ekspor laporan PDF/CSV profesional, dan **KopiScore AI Insights** berbasis Google Gemini. |
| **🎁 Customer Loyalty & Staff Gamification** | Digital Stamp Passport untuk pelanggan setia, penukaran reward otomatis, serta sistem *Staff Challenges & Leaderboard* untuk meningkatkan motivasi upselling barista/kasir. |
| **💳 SaaS Subscription & Mayar Billing** | Manajemen paket langganan (*Secangkir*, *Kopi Susu*, *Signature*, *Founder/Lifetime*) yang terhubung langsung ke **Mayar Headless API v2** (`/hl/v2/payments/create` & webhook `/api/webhooks/mayar`) dengan aktivasi lisensi idempoten otomatis. |
| **🔐 Multi-Outlet & RBAC Security** | Pemisahan hak akses ketat antara **Owner/Admin** dan **Cashier** per outlet, enkripsi PII AES-256-GCM, autentikasi sesi SHA-256 + bcrypt, MFA Admin, serta proteksi Row-Level Security (RLS) di seluruh 46 tabel PostgreSQL. |

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install
cd backend && npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run development
npm run dev              # Frontend (Vite)
cd backend && npm run dev # Backend (Express)

# Build for production
npm run build            # Web build
npm run build:mobile     # Android build

# Create ignored local staging env files from safe templates
npm run staging:env:init

# Verify staging smoke environment without printing secrets
npm run verify:staging-env -- --env-file=.env.staging.local --env-file=backend/.env.staging.local

# Check Coolify staging automation readiness without printing secrets
npm run coolify:staging:deploy -- --check
```

---

## 📚 Documentation

**All documentation is in `/docs` - this is the single source of truth.**

### Core Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **System Requirements** | [`docs/requirements/SRS.md`](docs/requirements/SRS.md) | Technical requirements, architecture, API specs |
| **Product Requirements** | [`docs/product/PRD.md`](docs/product/PRD.md) | Product vision, features, user stories |
| **Feature Registry** | [`docs/product/FEATURE_REGISTRY.md`](docs/product/FEATURE_REGISTRY.md) | Feature status, modules, APIs, tables |
| **Product Changelog** | [`docs/product/CHANGELOG_PRODUCT.md`](docs/product/CHANGELOG_PRODUCT.md) | Product changes, releases, updates |

### Engineering Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **AI Agent Guide** | [`docs/engineering/AI_AGENT_GUIDE.md`](docs/engineering/AI_AGENT_GUIDE.md) | Rules for AI agents working on codebase |
| **Agent Instructions** | [`docs/engineering/AGENTS.md`](docs/engineering/AGENTS.md) | Root-level agent instructions |
| **Security Hardening** | [`docs/engineering/SECURITY_HARDENING.md`](docs/engineering/SECURITY_HARDENING.md) | Security best practices, implementation guide |
| **Performance Guide** | [`docs/engineering/PERFORMANCE_GUIDE.md`](docs/engineering/PERFORMANCE_GUIDE.md) | Performance optimization strategies |
| **Production Readiness** | [`docs/engineering/PRODUCTION_READINESS_CHECKLIST.md`](docs/engineering/PRODUCTION_READINESS_CHECKLIST.md) | Release quality gates, security gates, operations gates |
| **Deployment Checklist** | [`docs/engineering/DEPLOYMENT_CHECKLIST.md`](docs/engineering/DEPLOYMENT_CHECKLIST.md) | Pre-deploy, runtime, database, payment, rollback checks |
| **Environment Security** | [`docs/engineering/ENVIRONMENT_SECURITY_CHECKLIST.md`](docs/engineering/ENVIRONMENT_SECURITY_CHECKLIST.md) | Frontend/public env and backend secret handling |
| **Environment Contract** | [`docs/engineering/ENV_CONTRACT.md`](docs/engineering/ENV_CONTRACT.md) | Canonical frontend, backend, Coolify, and smoke env names plus deprecated aliases |
| **Staging Secret Setup** | [`docs/engineering/STAGING_SECRET_SETUP_GUIDE.md`](docs/engineering/STAGING_SECRET_SETUP_GUIDE.md) | Safe local staging secret provisioning without printing or committing secrets |
| **Staging Value Collection** | [`docs/engineering/STAGING_VALUE_COLLECTION_CHECKLIST.md`](docs/engineering/STAGING_VALUE_COLLECTION_CHECKLIST.md) | Checklist for collecting staging URLs, credentials, integrations, and smoke users |
| **Staging Infrastructure Provisioning** | [`docs/engineering/STAGING_INFRASTRUCTURE_PROVISIONING_GUIDE.md`](docs/engineering/STAGING_INFRASTRUCTURE_PROVISIONING_GUIDE.md) | Provisioning steps for staging frontend, API, database, DNS, integrations, smoke users, and restore DB |
| **Staging Infrastructure Checklist** | [`docs/engineering/STAGING_INFRASTRUCTURE_CHECKLIST.md`](docs/engineering/STAGING_INFRASTRUCTURE_CHECKLIST.md) | Release checklist for staging domains, database, backend, frontend, integrations, smoke users, and restore drill |
| **Coolify Staging Deployment** | [`docs/engineering/COOLIFY_STAGING_DEPLOYMENT_GUIDE.md`](docs/engineering/COOLIFY_STAGING_DEPLOYMENT_GUIDE.md) | Coolify/VPS staging setup for frontend, backend, PostgreSQL, domains, health checks, and integrations |
| **Coolify Env Mapping** | [`docs/engineering/COOLIFY_ENV_MAPPING.md`](docs/engineering/COOLIFY_ENV_MAPPING.md) | Frontend, backend, and smoke env placement rules for Coolify staging |
| **Coolify Manual Execution** | [`docs/engineering/COOLIFY_STAGING_MANUAL_EXECUTION.md`](docs/engineering/COOLIFY_STAGING_MANUAL_EXECUTION.md) | Exact manual Coolify staging deployment steps and smoke verification order |
| **Coolify Copy/Paste Checklist** | [`docs/engineering/COOLIFY_COPY_PASTE_CHECKLIST.md`](docs/engineering/COOLIFY_COPY_PASTE_CHECKLIST.md) | Short dashboard checklist for backend, frontend, smoke, provider, and verification keys |
| **Coolify Automation Report** | [`docs/engineering/COOLIFY_STAGING_AUTOMATION_REPORT.md`](docs/engineering/COOLIFY_STAGING_AUTOMATION_REPORT.md) | Latest local Coolify automation result, blockers, and next action |
| **Minimal Staging Coolify Env** | [`docs/engineering/MINIMAL_STAGING_COOLIFY_ENV.md`](docs/engineering/MINIMAL_STAGING_COOLIFY_ENV.md) | Minimal frontend/backend/local env mapping for core staging smoke without external providers |

### Staging Smoke Repair

Use after minimal staging env verification passes but smoke users are missing or unverified:

```bash
npm run staging:repair-smoke-data
npm run staging:final
```

The repair command reads ignored local staging env files, requires `STAGING_PROFILE=minimal` and `NODE_ENV=staging`, does not print secrets, and only targets `KAFFEPOS_STAGING_API_URL`.
| **CI/CD Guide** | [`docs/engineering/CI_CD_GUIDE.md`](docs/engineering/CI_CD_GUIDE.md) | GitHub Actions quality gate and release controls |
| **Container Guide** | [`docs/engineering/CONTAINER_GUIDE.md`](docs/engineering/CONTAINER_GUIDE.md) | Docker image/runtime security and healthcheck guidance |
| **Monitoring & Logging** | [`docs/engineering/MONITORING_LOGGING_GUIDE.md`](docs/engineering/MONITORING_LOGGING_GUIDE.md) | Safe logs, metrics, alerts, request ID usage |
| **Backup & Recovery** | [`docs/engineering/BACKUP_RECOVERY_GUIDE.md`](docs/engineering/BACKUP_RECOVERY_GUIDE.md) | PostgreSQL and asset backup/restore procedures |
| **Disaster Recovery** | [`docs/engineering/DISASTER_RECOVERY_CHECKLIST.md`](docs/engineering/DISASTER_RECOVERY_CHECKLIST.md) | RTO/RPO, incident steps, rollback controls |
| **Engineering Audit** | [`docs/engineering/SILICON_VALLEY_ENGINEERING_AUDIT.md`](docs/engineering/SILICON_VALLEY_ENGINEERING_AUDIT.md) | 2026-05-24 production engineering audit summary |
| **App Update Safety** | [`docs/engineering/APP_UPDATE_SAFETY.md`](docs/engineering/APP_UPDATE_SAFETY.md) | Safe app update procedures |
| **Audit Report (2026-05-14)** | [`docs/engineering/AUDIT_REPORT_2026_05_14.md`](docs/engineering/AUDIT_REPORT_2026_05_14.md) | Security, performance, scalability audit |
| **Audit Summary (2026-05-14)** | [`docs/engineering/AUDIT_SUMMARY_2026_05_14.md`](docs/engineering/AUDIT_SUMMARY_2026_05_14.md) | Executive summary of audit findings |



### Authentication & RBAC

| Document | Location | Purpose |
|----------|----------|---------|
| **RBAC Permission Matrix** | [`docs/engineering/RBAC_PERMISSION_MATRIX.md`](docs/engineering/RBAC_PERMISSION_MATRIX.md) | Complete permission matrix, role definitions, API mappings |
| **Auth & RBAC QA Checklist** | [`docs/engineering/AUTH_RBAC_QA_CHECKLIST.md`](docs/engineering/AUTH_RBAC_QA_CHECKLIST.md) | Authentication and authorization testing checklist |

### Backend Observability

| Document | Location | Purpose |
|----------|----------|---------|
| **Backend Observability QA** | [`docs/engineering/BACKEND_OBSERVABILITY_QA_CHECKLIST.md`](docs/engineering/BACKEND_OBSERVABILITY_QA_CHECKLIST.md) | Rate limiting, logging, error handling validation |

### Architecture Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **Backend Architecture** | [`docs/architecture/BACKEND.md`](docs/architecture/BACKEND.md) | Backend structure, patterns, conventions |
| **Backend API Migration** | [`docs/architecture/BACKEND_API_MIGRATION.md`](docs/architecture/BACKEND_API_MIGRATION.md) | API migration guide |

### Affiliate & Referral Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **Overview** | [`docs/affiliate-referral/OVERVIEW.md`](docs/affiliate-referral/OVERVIEW.md) | Affiliate & referral system overview |
| **Admin SOP** | [`docs/affiliate-referral/ADMIN_SOP.md`](docs/affiliate-referral/ADMIN_SOP.md) | Admin operations procedures |
| **Metrics** | [`docs/affiliate-referral/METRICS.md`](docs/affiliate-referral/METRICS.md) | Metrics, formulas, monitoring |
| **Release Checklist** | [`docs/affiliate-referral/RELEASE_CHECKLIST.md`](docs/affiliate-referral/RELEASE_CHECKLIST.md) | Pre-production checklist |

### Launch & Deployment Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **Go-Live Checklist** | [`docs/launch/GO_LIVE_CHECKLIST.md`](docs/launch/GO_LIVE_CHECKLIST.md) | Production launch checklist |
| **Deployment Guide** | [`docs/launch/DEPLOYMENT_GUIDE.md`](docs/launch/DEPLOYMENT_GUIDE.md) | Production deployment procedures |
| **Validation Checklist** | [`docs/launch/VALIDATION_CHECKLIST.md`](docs/launch/VALIDATION_CHECKLIST.md) | End-to-end validation |
| **Android Release Signing** | [`docs/launch/ANDROID_RELEASE_SIGNING.md`](docs/launch/ANDROID_RELEASE_SIGNING.md) | Android APK signing guide |
| **Midtrans Production Switch** | [`docs/launch/MIDTRANS_PRODUCTION_SWITCH.md`](docs/launch/MIDTRANS_PRODUCTION_SWITCH.md) | Payment production setup |

### Operations Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **Incident Playbook** | [`docs/operations/INCIDENT_PLAYBOOK.md`](docs/operations/INCIDENT_PLAYBOOK.md) | Incident response procedures |
| **Support SOP** | [`docs/operations/SUPPORT_SOP.md`](docs/operations/SUPPORT_SOP.md) | Customer support procedures |
| **Metrics Dashboard** | [`docs/operations/METRICS_DASHBOARD.md`](docs/operations/METRICS_DASHBOARD.md) | Operational metrics |
| **Maintenance Roadmap** | [`docs/operations/MAINTENANCE_ROADMAP.md`](docs/operations/MAINTENANCE_ROADMAP.md) | Maintenance schedule |
| **Printer Matrix** | [`docs/operations/PRINTER_APPROVED_MATRIX.md`](docs/operations/PRINTER_APPROVED_MATRIX.md) | Approved printer models |

### Testing Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **QA Checklist** | [`docs/testing/QA_CHECKLIST.md`](docs/testing/QA_CHECKLIST.md) | Security, performance, quality checklist |
| **Audit Remediation** | [`docs/testing/AUDIT_REMEDIATION.md`](docs/testing/AUDIT_REMEDIATION.md) | Audit issue tracking |
| **Hardening QA Matrix** | [`docs/testing/HARDENING_QA_MATRIX.md`](docs/testing/HARDENING_QA_MATRIX.md) | Security hardening tests |
| **Unit Test Guide** | [`docs/testing/UNIT_TEST_GUIDE.md`](docs/testing/UNIT_TEST_GUIDE.md) | Unit testing guidelines |

### Legal Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **Refund Policy** | [`docs/legal/REFUND_POLICY.md`](docs/legal/REFUND_POLICY.md) | Refund terms and conditions |
| **Data Retention Policy** | [`docs/legal/DATA_RETENTION_POLICY.md`](docs/legal/DATA_RETENTION_POLICY.md) | Data retention rules |

### RFCs (Request for Comments)

| Document | Location | Purpose |
|----------|----------|---------|
| **RFC Index** | [`docs/rfc/README.md`](docs/rfc/README.md) | RFC process and index |
| **RFC 0001** | [`docs/rfc/0001-product-scope-and-architecture.md`](docs/rfc/0001-product-scope-and-architecture.md) | Product scope and architecture |
| **RFC 0002** | [`docs/rfc/0002-commercial-readiness-hardening.md`](docs/rfc/0002-commercial-readiness-hardening.md) | Commercial readiness |
| **RFC 0003** | [`docs/rfc/0003-closed-beta-consolidation-and-integrations.md`](docs/rfc/0003-closed-beta-consolidation-and-integrations.md) | Beta consolidation |

---

## 🏗️ Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (utility classes)
- **Mobile:** Capacitor (Android)
- **State Management:** React Context + Hooks
- **HTTP Client:** Fetch API
- **Validation:** Zod (shared schemas)

### Backend
- **Runtime:** Node.js + Express
- **Language:** TypeScript
- **Database:** PostgreSQL
- **Validation:** Zod
- **Authentication:** JWT (custom implementation)
- **Password Hashing:** bcrypt
- **Session Management:** Custom (SHA-256 token hashing)

### Infrastructure & Cloud Services
- **Cloud Backend & Database:** InsForge Cloud PostgreSQL (`6x4q2bgn.ap-southeast.insforge.app`, 46 tables with full RLS + 160+ indexes) & InsForge Edge Functions (`@insforge/sdk`)
- **Payment Gateway:** Mayar Headless API v2 (`https://api.mayar.id/hl/v2` production / `https://api.mayar.club/hl/v2` sandbox)
- **CDN & Storage:** Cloudflare CDN & R2 / InsForge Storage
- **Transactional Email:** Resend
- **Analytics & Observability:** Google Analytics 4, Microsoft Clarity, Sentry Error Tracking & Custom Database APM
- **AI Engine:** Google Gemini (backend proxy)

### Development
- **Package Manager:** npm
- **Linting:** ESLint
- **Type Checking:** TypeScript
- **Testing:** Vitest (unit tests)
- **Version Control:** Git

---

## 📁 Project Structure

```
kaffepos-v2/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── contexts/           # React contexts
│   ├── lib/                # Utilities, API client
│   ├── types/              # TypeScript types
│   └── test/               # Frontend tests
├── backend/                # Backend source code
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── core/           # Core utilities (auth, db, email)
│   │   ├── lib/            # Business logic libraries
│   │   └── services/       # Service layer
│   └── migrations/         # Database migrations
├── database/               # Database scripts
│   ├── production-bootstrap.sql
│   ├── performance-indexes-migration.sql
│   └── *.sql               # Feature migrations
├── docs/                   # Documentation (source of truth)
│   ├── requirements/       # System requirements
│   ├── product/            # Product docs
│   ├── engineering/        # Engineering guides
│   ├── architecture/       # Architecture docs
│   ├── affiliate-referral/ # Affiliate/referral docs
│   ├── launch/             # Launch checklists
│   ├── operations/         # Operations guides
│   ├── testing/            # Testing docs
│   ├── legal/              # Legal docs
│   ├── rfc/                # RFCs
│   └── archive/            # Archived docs
├── public/                 # Static assets
├── android/                # Capacitor Android project
└── README.md               # This file
```

---

## 🔐 Security

KaffePOS follows security best practices:

- ✅ Passwords hashed with bcrypt (cost 12)
- ✅ Session tokens hashed with SHA-256
- ✅ Parameterized SQL queries (no SQL injection)
- ✅ Input validation with Zod schemas
- ✅ Rate limiting on auth/payment endpoints
- ✅ RBAC (Role-Based Access Control)
- ✅ Store ownership verification
- ✅ Payment webhook signature verification
- ✅ Idempotent payment processing
- ✅ No secrets in frontend
- ✅ No PII sent to analytics

**Security Guide:** [`docs/engineering/SECURITY_HARDENING.md`](docs/engineering/SECURITY_HARDENING.md)

---

## ⚡ Performance

Performance optimizations:

- ✅ Database connection pooling
- ✅ Debouncing on search inputs
- ✅ Vite code splitting
- ✅ Cloudflare CDN for static assets
- ✅ Cloudflare Images for uploads
- ⚠️ Database indexes (apply `database/performance-indexes-migration.sql`)

**Performance Guide:** [`docs/engineering/PERFORMANCE_GUIDE.md`](docs/engineering/PERFORMANCE_GUIDE.md)

---

## 🤖 AI Agent Rules

**Before coding, AI agents MUST read:**

1. [`docs/requirements/SRS.md`](docs/requirements/SRS.md) - System requirements
2. [`docs/product/PRD.md`](docs/product/PRD.md) - Product requirements
3. [`docs/engineering/AI_AGENT_GUIDE.md`](docs/engineering/AI_AGENT_GUIDE.md) - AI agent rules
4. [`docs/product/FEATURE_REGISTRY.md`](docs/product/FEATURE_REGISTRY.md) - Feature status

**After coding, AI agents MUST update:**

1. Relevant documentation in `/docs`
2. [`docs/product/FEATURE_REGISTRY.md`](docs/product/FEATURE_REGISTRY.md) - Feature status
3. [`docs/product/CHANGELOG_PRODUCT.md`](docs/product/CHANGELOG_PRODUCT.md) - Product changelog

**Golden Rules:**

- ❌ No undocumented features
- ❌ No UI redesign without approval
- ❌ No secrets in frontend
- ✅ Backend-only payment verification
- ✅ Database migrations + documentation
- ✅ Small, safe, focused changes

**Full Guide:** [`docs/engineering/AI_AGENT_GUIDE.md`](docs/engineering/AI_AGENT_GUIDE.md)

---

## 📦 Database

### Migrations

Database migrations are in `database/` and `backend/migrations/`:

```bash
# Apply performance indexes (critical for production)
psql -d kaffepos_production -f database/performance-indexes-migration.sql

# Apply feature migrations
psql -d kaffepos_production -f database/affiliate-referral-migration.sql
psql -d kaffepos_production -f database/loyalty-migration.sql
psql -d kaffepos_production -f database/challenges-migration.sql
psql -d kaffepos_production -f database/kitchen-order-checker-migration.sql
```

### Schema

Main tables:
- `profiles` - User accounts
- `stores` - Store settings
- `transactions` - POS transactions
- `menu_items` - Menu catalog
- `inventory` - Stock management
- `subscriptions` - Subscription billing
- `kitchen_orders` - Kitchen display
- `loyalty_passports` - Loyalty program
- `challenges` - Gamification
- `referral_codes` - Referral tracking
- `affiliate_profiles` - Affiliate program
- `commission_transactions` - Commission tracking

---

## 🚀 Deployment

### Production Checklist

**Before production launch:**

1. ✅ Apply database indexes (`database/performance-indexes-migration.sql`)
2. ✅ Enable database SSL/TLS (`DB_SSL=true`)
3. ✅ Configure CORS (`CORS_ORIGIN=https://kaffepos.my.id`)
4. ✅ Enable Sentry error tracking
5. ✅ Implement database backups
6. ✅ Review [`docs/launch/GO_LIVE_CHECKLIST.md`](docs/launch/GO_LIVE_CHECKLIST.md)

**Deployment Guide:** [`docs/launch/DEPLOYMENT_GUIDE.md`](docs/launch/DEPLOYMENT_GUIDE.md)

---

## 🧪 Testing

```bash
# Frontend tests
npm run test

# Backend tests
cd backend && npm run test

# Type checking
npm run typecheck
cd backend && npm run typecheck

# Linting
npm run lint
cd backend && npm run lint
```

**Testing Guide:** [`docs/testing/QA_CHECKLIST.md`](docs/testing/QA_CHECKLIST.md)

---

## 📝 Contributing

1. Read [`docs/engineering/AI_AGENT_GUIDE.md`](docs/engineering/AI_AGENT_GUIDE.md)
2. Check [`docs/product/FEATURE_REGISTRY.md`](docs/product/FEATURE_REGISTRY.md) for feature status
3. Follow existing code patterns
4. Update documentation
5. Update [`docs/product/CHANGELOG_PRODUCT.md`](docs/product/CHANGELOG_PRODUCT.md)

---

## 📄 License

Proprietary - KaffePOS

---

## 📞 Support

- **Documentation:** `/docs` (source of truth)
- **Issues:** Check [`docs/operations/SUPPORT_SOP.md`](docs/operations/SUPPORT_SOP.md)
- **Incidents:** Follow [`docs/operations/INCIDENT_PLAYBOOK.md`](docs/operations/INCIDENT_PLAYBOOK.md)

---

## 🎯 Production Readiness

**Current Status:** ✅ **Ready for Production (9.5/10)**

**Completed Upgrades (2026-05-14):**
1. ✅ Performance indexes applied (50+ indexes, 10-100x faster queries)
2. ✅ Frontend optimization (debouncing, pagination, memoization)
3. ✅ Backend scalability (job queue, caching, service layer)
4. ✅ Security hardening (MFA, audit logs, encryption, headers)
5. ✅ Production monitoring (APM, alerting, metrics)
6. ✅ Automated operations (backups, health checks, deployment scripts)
7. ✅ Comprehensive testing suite
8. ✅ Complete documentation

**Production Reports:**
- [`docs/PRODUCTION_READINESS_REPORT_2026_05_14.md`](docs/PRODUCTION_READINESS_REPORT_2026_05_14.md) - Full readiness report
- [`UPGRADE_SUMMARY_2026_05_14.md`](UPGRADE_SUMMARY_2026_05_14.md) - Upgrade summary
- [`docs/engineering/AUDIT_REPORT_2026_05_14.md`](docs/engineering/AUDIT_REPORT_2026_05_14.md) - Security audit

---

**Built with ❤️ for coffee shops and small F&B businesses**


## 📋 API Standards

KaffePOS uses standardized API contracts for consistency and predictability.

**Response Formats:**
- Success: `{ success: true, data: {...} }`
- Error: `{ success: false, error: { code, message, details? } }`
- Paginated: `{ success: true, data: [...], meta: {...} }`

**Error Codes:**
- `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `PAYMENT_ERROR`, `FEATURE_DISABLED`, `INTERNAL_SERVER_ERROR`

**Pagination:**
- Query params: `page`, `limit`, `offset`, `sortBy`, `sortOrder`, `search`
- Metadata: `page`, `limit`, `total`, `totalPages`, `hasMore`, `nextOffset`

**Full API Documentation:** [`docs/architecture/API.md`](docs/architecture/API.md)


## 🗄️ Database

KaffePOS uses PostgreSQL with a custom migration system.

**Migration System:**
- Custom Node.js runner with SHA-256 checksum validation
- Transaction safety with automatic rollback
- Command: `npm run migrate` (from backend folder)

**Key Features:**
- 40+ tables covering auth, POS, payments, subscriptions, loyalty, affiliate/referral
- Data integrity constraints (self-referral prevention, numeric constraints, date progression)
- Idempotency protections (commission, referral, payment, session tokens)
- Performance indexes (100+ indexes for common queries)
- Security measures (encrypted payout accounts, hashed IPs, bcrypt passwords)

**Database Documentation:** [`docs/architecture/DATABASE.md`](docs/architecture/DATABASE.md)
**QA Checklist:** [`docs/engineering/DATABASE_QA_CHECKLIST.md`](docs/engineering/DATABASE_QA_CHECKLIST.md)

## 💳 Mayar Payment Gateway (Headless API v2)

- Payment gateway default menggunakan **Mayar (`PAYMENT_GATEWAY_PROVIDER=mayar`)** berbasis REST API v2 resmi (`https://api.mayar.id/hl/v2` untuk production dan `https://api.mayar.club/hl/v2` untuk sandbox).
- Mendukung baik **Subscription Billing** (`POST /api/payments/start` dan `POST /api/subscriptions/payments/create`) maupun **POS Online Checkout** (`POST /api/payment/create`).
- Daftarkan URL Webhook Mayar pada **Mayar Dashboard → Integration → Webhook**:
  - `https://api.kaffepos.my.id/api/webhooks/mayar`
- Customer redirect URL setelah pembayaran:
  - `https://kaffepos.my.id/settings?billing=mayar-return`
- Verifikasi pembayaran dilakukan sepenuhnya di sisi server melalui webhook terautentikasi (`x-callback-token` / `x-mayar-signature` / `HMAC-SHA256`) atau pengecekan status server (`POST /api/payments/:paymentId/check` → `GET /hl/v2/payments/:id`).
- `MAYAR_API_KEY` dan `MAYAR_WEBHOOK_TOKEN` bersifat **backend-only** dan tidak pernah diekspos ke bundle frontend (`VITE_*`).
- Smoke test integrasi Mayar & InsForge:
  - `npm run smoke:insforge`
  - `MAYAR_API_KEY=... MAYAR_ENVIRONMENT=sandbox npm run smoke:staging:mayar`
- Implementasi provider: [`backend/src/payments/providers/mayar.provider.ts`](backend/src/payments/providers/mayar.provider.ts) & skill referensi: [`.agent/skills/mayar/SKILL.md`](.agent/skills/mayar/SKILL.md).

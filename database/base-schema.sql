-- ############################################################################
-- ## KaffePOS BASE SCHEMA — foundation tables for a FRESH database.         ##
-- ##                                                                        ##
-- ## Why this file exists: the original stores/profiles/... tables were    ##
-- ## created on the legacy hosted database and were never captured in the  ##
-- ## repo. Versioned migrations (backend/migrations/) and the runtime      ##
-- ## bootstrap (backend/src/schema-bootstrap.ts) both ASSUME these tables  ##
-- ## exist, so a brand-new database could not be provisioned from the repo ##
-- ## alone (breaking disaster recovery and new-environment setup).         ##
-- ##                                                                       ##
-- ## Provisioning order for a fresh database:                              ##
-- ##   1. psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/base-schema.sql
-- ##   2. DATABASE_URL=... npm --prefix backend run migrate                 ##
-- ##   3. Start the backend (bootstrapAllSchemas creates remaining tables) ##
-- ##                                                                       ##
-- ## Idempotent: safe to run on an existing database (all IF NOT EXISTS). ##
-- ## Column shapes are reconstructed from the code's column constants      ##
-- ## (backend/src/core/helpers.ts) and insert statements, and verified by  ##
-- ## booting the app against a scratch database.                           ##
-- ############################################################################

create extension if not exists pgcrypto;

-- ── Identity ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username varchar,
  display_name varchar,
  email varchar,
  avatar_url text,
  tier varchar not null default 'free',
  tier_expires_at timestamptz,
  is_pro boolean not null default false,
  pro_plan varchar,
  pro_order_id varchar,
  pro_activated_at timestamptz,
  pro_expires_at timestamptz,
  role varchar not null default 'owner',
  account_status varchar not null default 'active',
  permissions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_username_unique_idx on public.profiles (lower(username)) where username is not null;
create unique index if not exists profiles_email_unique_idx on public.profiles (lower(email)) where email is not null;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  store_name varchar not null,
  address text,
  whatsapp varchar,
  tax_percent numeric not null default 0,
  receipt_header text,
  receipt_footer text,
  logo_url text,
  logo_base64 text,
  logo_position varchar,
  logo_size varchar,
  show_logo_on_receipt boolean not null default false,
  currency varchar not null default 'IDR',
  tagline text,
  email varchar,
  website varchar,
  paper_width varchar,
  receipt_font_size varchar,
  receipt_show_address boolean not null default true,
  receipt_show_whatsapp boolean not null default true,
  receipt_show_tax boolean not null default true,
  receipt_show_cashier boolean not null default true,
  receipt_show_trx_id boolean not null default true,
  receipt_divider varchar,
  receipt_custom_line1 text,
  receipt_custom_line2 text,
  timezone varchar,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stores_owner_id_idx on public.stores (owner_id);

-- ── Catalog & sales ────────────────────────────────────────────────────────
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name varchar not null,
  price numeric not null default 0,
  category varchar,
  image_url text,
  description text,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  recipe jsonb,
  variants jsonb,
  modifiers jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists menu_items_store_id_idx on public.menu_items (store_id);

create table if not exists public.transactions (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  date timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  discount_label varchar,
  tax numeric not null default 0,
  total numeric not null default 0,
  cogs numeric,
  paid numeric not null default 0,
  change numeric not null default 0,
  method varchar not null default 'Tunai',
  customer_name varchar,
  cashier varchar,
  note text,
  is_void boolean not null default false,
  void_reason text,
  void_at timestamptz,
  void_by varchar,
  created_at timestamptz not null default now()
);
create index if not exists transactions_store_date_idx on public.transactions (store_id, date desc);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  date timestamptz not null default now(),
  description text not null default '',
  amount numeric not null default 0,
  category varchar,
  cashier varchar,
  source varchar,
  created_at timestamptz not null default now()
);
create index if not exists expenses_store_date_idx on public.expenses (store_id, date desc);

create table if not exists public.cash_flow (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  date timestamptz not null default now(),
  type varchar not null check (type in ('in', 'out')),
  amount numeric not null default 0,
  description text,
  cashier varchar,
  created_at timestamptz not null default now()
);
create index if not exists cash_flow_store_date_idx on public.cash_flow (store_id, date desc);

create table if not exists public.cash_register (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  date timestamptz not null default now(),
  amount numeric not null default 0,
  note text,
  opened_by varchar,
  created_at timestamptz not null default now()
);
create index if not exists cash_register_store_date_idx on public.cash_register (store_id, date desc);

create table if not exists public.store_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  username varchar not null,
  password_hash text not null,
  role varchar not null default 'cashier',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, username)
);

-- ── Billing ────────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  tier varchar,
  period varchar,
  plan varchar,
  billing_cycle varchar,
  status varchar not null default 'active',
  activated_at timestamptz,
  expires_at timestamptz,
  amount_paid numeric not null default 0,
  payment_amount numeric,
  payment_method varchar,
  payment_note text,
  payment_ref varchar,
  converted_from_subscription_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_payment_ref_idx on public.subscriptions (payment_ref);

create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan varchar,
  billing_cycle varchar,
  amount numeric not null default 0,
  payment_method varchar,
  payment_note text,
  payment_ref varchar,
  status varchar not null default 'success',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payment_history_user_id_idx on public.payment_history (user_id);
create index if not exists payment_history_payment_ref_idx on public.payment_history (payment_ref);

-- ── Auth hardening ─────────────────────────────────────────────────────────
create table if not exists public.admin_mfa_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  secret text not null,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.auth_account_lockouts (
  id uuid primary key default gen_random_uuid(),
  email varchar not null,
  user_id uuid,
  failed_attempts integer not null default 0,
  last_failed_at timestamptz,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);

create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email varchar not null,
  purpose varchar not null,
  code varchar not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_verification_codes_email_idx on public.email_verification_codes (email, purpose);

-- ── Logging ────────────────────────────────────────────────────────────────
create table if not exists public.ai_insight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_insight_logs_user_created_idx on public.ai_insight_logs (user_id, created_at);

create table if not exists public.ops_event_logs (
  id uuid primary key default gen_random_uuid(),
  event_name varchar not null,
  status varchar not null,
  actor_user_id uuid,
  actor_email varchar,
  store_id uuid,
  transaction_id text,
  source varchar,
  error_message text,
  metadata jsonb,
  ip_address varchar,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists ops_event_logs_event_created_idx on public.ops_event_logs (event_name, created_at desc);

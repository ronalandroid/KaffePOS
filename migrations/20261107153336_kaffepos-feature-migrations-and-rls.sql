-- ============================================================================
-- KaffePOS v2 — Feature Migrations, Performance Indexes & Row-Level Security
-- ============================================================================

-- ── 1. Schema Migrations Tracking Table ─────────────────────────────────────
create table if not exists public.schema_migrations (
  version text primary key,
  name text not null,
  checksum text,
  applied_at timestamptz not null default now()
);

-- ── 2. Beta Feedback ────────────────────────────────────────────────────────
create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  rating integer check (rating between 1 and 5),
  category text not null default 'Lainnya'
    check (category in ('Bug', 'Saran', 'Fitur Baru', 'Lainnya')),
  description text not null default '',
  screenshot_data text,
  liked text not null default '',
  improve text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists beta_feedback_store_created_idx
  on public.beta_feedback (store_id, created_at desc)
  where store_id is not null;

create index if not exists beta_feedback_user_created_idx
  on public.beta_feedback (user_id, created_at desc);

-- ── 3.Subscriptions Trial & Grace Columns ───────────────────────────────────
create index if not exists subscriptions_user_plan_status_idx
  on public.subscriptions (user_id, plan, status, activated_at desc);

create index if not exists subscriptions_trial_ends_idx
  on public.subscriptions (trial_ends_at)
  where plan = 'secangkir' and status = 'active';

-- ── 4. Secure Payment Orders, Logs & Events ─────────────────────────────────
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  transaction_id text,
  midtrans_order_id text not null unique,
  midtrans_transaction_id text,
  snap_token text,
  payment_url text,
  payment_provider text not null default 'midtrans',
  payment_type text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'completed', 'failed', 'cancelled')),
  transaction_status text not null default 'pending',
  fraud_status text,
  status_code text,
  currency_code text not null default 'IDR',
  subtotal integer not null default 0 check (subtotal >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  tax_amount integer not null default 0 check (tax_amount >= 0),
  gross_amount integer not null check (gross_amount > 0),
  customer_name text,
  customer_email text,
  customer_phone text,
  items jsonb not null default '[]'::jsonb,
  paid_at timestamptz,
  failed_at timestamptz,
  expires_at timestamptz,
  provider text,
  provider_reference text,
  provider_order_id text,
  merchant_order_id text,
  va_number text,
  qr_string text,
  payment_method text,
  provider_status text,
  internal_status text,
  callback_received_at timestamptz,
  expired_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_orders_user_created_idx
  on public.payment_orders (user_id, created_at desc);

create index if not exists payment_orders_store_status_idx
  on public.payment_orders (store_id, status, created_at desc);

create index if not exists payment_orders_midtrans_order_id_idx
  on public.payment_orders (midtrans_order_id);

create unique index if not exists payment_orders_midtrans_order_id_key
  on public.payment_orders (midtrans_order_id);

create index if not exists payment_orders_provider_idx
  on public.payment_orders (provider);

create index if not exists payment_orders_provider_reference_idx
  on public.payment_orders (provider_reference);

create unique index if not exists payment_orders_merchant_order_id_key
  on public.payment_orders (merchant_order_id)
  where merchant_order_id is not null;

create index if not exists payment_orders_internal_status_idx
  on public.payment_orders (internal_status);

create index if not exists payment_orders_created_at_idx
  on public.payment_orders (created_at);

alter table public.subscription_payment_sessions
  add column if not exists provider text,
  add column if not exists provider_reference text,
  add column if not exists merchant_order_id text,
  add column if not exists payment_url text,
  add column if not exists va_number text,
  add column if not exists qr_string text,
  add column if not exists payment_method text,
  add column if not exists provider_status text,
  add column if not exists internal_status text,
  add column if not exists callback_received_at timestamptz,
  add column if not exists expired_at timestamptz;

create index if not exists subscription_payment_sessions_provider_idx
  on public.subscription_payment_sessions (provider);

create index if not exists subscription_payment_sessions_provider_reference_idx
  on public.subscription_payment_sessions (provider_reference);

create unique index if not exists subscription_payment_sessions_merchant_order_id_key
  on public.subscription_payment_sessions (merchant_order_id)
  where merchant_order_id is not null;

create index if not exists subscription_payment_sessions_internal_status_idx
  on public.subscription_payment_sessions (internal_status);

create table if not exists public.payment_attempt_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  event_type text not null,
  ip text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_attempt_logs_user_created_idx
  on public.payment_attempt_logs (user_id, created_at desc);

create table if not exists public.payment_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'midtrans',
  order_id text,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  signature_valid boolean not null default false,
  transaction_status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_webhook_logs_order_created_idx
  on public.payment_webhook_logs (order_id, created_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid,
  provider text not null,
  event_type text not null,
  provider_reference text,
  merchant_order_id text,
  raw_status text,
  internal_status text,
  payload jsonb not null default '{}'::jsonb,
  signature_valid boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_events_payment_id_idx
  on public.payment_events (payment_id);

create index if not exists payment_events_provider_idx
  on public.payment_events (provider);

create index if not exists payment_events_provider_reference_idx
  on public.payment_events (provider_reference);

create index if not exists payment_events_created_at_idx
  on public.payment_events (created_at);

-- ── 5. App Versioning & Update Events ───────────────────────────────────────
create table if not exists public.app_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  release_channel text not null default 'stable'
    check (release_channel in ('development', 'beta', 'stable')),
  update_policy text not null default 'soft'
    check (update_policy in ('none', 'soft', 'hard')),
  min_supported_web_version text not null default '0.0.0',
  min_supported_apk_version text not null default '0.0.0',
  schema_version text,
  release_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deployed_at timestamptz
);

create table if not exists public.app_update_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  event_name text not null check (
    event_name in (
      'version_checked',
      'update_detected',
      'client_storage_migrated',
      'post_update_sync_started',
      'post_update_sync_completed',
      'post_update_sync_failed'
    )
  ),
  client_version text,
  server_version text,
  platform text not null default 'web'
    check (platform in ('web', 'android', 'apk', 'ios', 'unknown')),
  update_mode text not null default 'none'
    check (update_mode in ('none', 'soft', 'hard')),
  migration_report jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_versions_created_idx
  on public.app_versions (created_at desc);

create index if not exists app_update_events_user_created_idx
  on public.app_update_events (user_id, created_at desc);

create index if not exists app_update_events_store_created_idx
  on public.app_update_events (store_id, created_at desc)
  where store_id is not null;

insert into public.app_versions (
  version,
  release_channel,
  update_policy,
  min_supported_web_version,
  min_supported_apk_version,
  schema_version,
  release_notes,
  metadata,
  deployed_at
) values (
  '2.0.0',
  'beta',
  'soft',
  '2.0.0',
  '2.0.0',
  '20260513_0001_app_versioning',
  'Baseline safe-update release with schema version tracking and client update sync.',
  '{"safeUpdate": true, "backwardCompatible": true, "minSupportedFinalized": true}'::jsonb,
  now()
)
on conflict (version) do update
set
  min_supported_web_version = excluded.min_supported_web_version,
  min_supported_apk_version = excluded.min_supported_apk_version,
  schema_version = excluded.schema_version,
  metadata = public.app_versions.metadata || excluded.metadata;

-- ── 6. Affiliate & Referral Program ─────────────────────────────────────────
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  code varchar not null,
  type varchar not null check (type in ('customer_referral', 'affiliate')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists referral_codes_code_unique_idx
  on public.referral_codes (code);

create unique index if not exists referral_codes_user_type_unique_idx
  on public.referral_codes (user_id, type);

create index if not exists referral_codes_user_id_idx
  on public.referral_codes (user_id);

create index if not exists referral_codes_type_idx
  on public.referral_codes (type);

create index if not exists referral_codes_is_active_idx
  on public.referral_codes (is_active);

create table if not exists public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  ip_hash varchar,
  user_agent text,
  landing_page text,
  utm_source varchar,
  utm_medium varchar,
  utm_campaign varchar,
  clicked_at timestamptz not null default now(),
  constraint referral_clicks_ip_hash_format_check
    check (ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists referral_clicks_referral_code_id_idx
  on public.referral_clicks (referral_code_id);

create index if not exists referral_clicks_clicked_at_idx
  on public.referral_clicks (clicked_at);

create index if not exists referral_clicks_utm_source_idx
  on public.referral_clicks (utm_source);

create table if not exists public.referral_registrations (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  referrer_user_id uuid not null references public.profiles(id) on delete restrict,
  referred_user_id uuid not null references public.profiles(id) on delete restrict,
  referral_type varchar not null check (referral_type in ('customer_referral', 'affiliate')),
  status varchar not null default 'registered'
    check (status in ('registered', 'trial_started', 'paid', 'eligible', 'rewarded', 'rejected', 'cancelled')),
  registered_at timestamptz not null default now(),
  trial_started_at timestamptz,
  first_payment_at timestamptz,
  eligible_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_registrations_no_self_referral_check
    check (referrer_user_id != referred_user_id),
  constraint referral_registrations_dates_valid_check
    check (
      (trial_started_at is null or trial_started_at >= registered_at) and
      (first_payment_at is null or trial_started_at is null or first_payment_at >= trial_started_at) and
      (eligible_at is null or first_payment_at is null or eligible_at >= first_payment_at)
    )
);

create unique index if not exists referral_registrations_referred_user_unique_idx
  on public.referral_registrations (referred_user_id);

create index if not exists referral_registrations_referral_code_id_idx
  on public.referral_registrations (referral_code_id);

create index if not exists referral_registrations_referrer_user_id_idx
  on public.referral_registrations (referrer_user_id);

create index if not exists referral_registrations_status_idx
  on public.referral_registrations (status);

create index if not exists referral_registrations_eligible_at_idx
  on public.referral_registrations (eligible_at);

create table if not exists public.affiliate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  affiliate_code varchar not null,
  status varchar not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'rejected')),
  payout_name varchar,
  payout_bank_name varchar,
  payout_account_number_encrypted text,
  payout_account_holder varchar,
  commission_rate numeric(5,2) not null default 20.00 check (commission_rate >= 0 and commission_rate <= 100),
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists affiliate_profiles_user_id_unique_idx
  on public.affiliate_profiles (user_id);

create unique index if not exists affiliate_profiles_affiliate_code_unique_idx
  on public.affiliate_profiles (affiliate_code);

create index if not exists affiliate_profiles_status_idx
  on public.affiliate_profiles (status);

create table if not exists public.commission_transactions (
  id uuid primary key default gen_random_uuid(),
  referral_registration_id uuid not null references public.referral_registrations(id) on delete restrict,
  affiliate_profile_id uuid references public.affiliate_profiles(id) on delete restrict,
  referrer_user_id uuid not null references public.profiles(id) on delete restrict,
  referred_user_id uuid not null references public.profiles(id) on delete restrict,
  payment_id uuid,
  type varchar not null check (type in ('referral_credit', 'affiliate_cash')),
  amount numeric(14,2) not null check (amount >= 0),
  currency varchar not null default 'IDR',
  rate numeric(5,2) check (rate is null or (rate >= 0 and rate <= 100)),
  status varchar not null default 'pending'
    check (status in ('pending', 'eligible', 'approved', 'rejected', 'paid', 'cancelled')),
  eligible_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  paid_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_transactions_dates_valid_check
    check (
      (approved_at is null or eligible_at is null or approved_at >= eligible_at) and
      (paid_at is null or approved_at is null or paid_at >= approved_at)
    )
);

create unique index if not exists commission_transactions_referral_payment_type_unique_idx
  on public.commission_transactions (referral_registration_id, payment_id, type)
  where payment_id is not null;

create unique index if not exists commission_transactions_referral_type_null_payment_unique_idx
  on public.commission_transactions (referral_registration_id, type)
  where payment_id is null;

create index if not exists commission_transactions_referral_registration_id_idx
  on public.commission_transactions (referral_registration_id);

create index if not exists commission_transactions_affiliate_profile_id_idx
  on public.commission_transactions (affiliate_profile_id);

create index if not exists commission_transactions_referrer_user_id_idx
  on public.commission_transactions (referrer_user_id);

create index if not exists commission_transactions_referred_user_id_idx
  on public.commission_transactions (referred_user_id);

create index if not exists commission_transactions_payment_id_idx
  on public.commission_transactions (payment_id);

create index if not exists commission_transactions_status_idx
  on public.commission_transactions (status);

create index if not exists commission_transactions_eligible_at_idx
  on public.commission_transactions (eligible_at);

create table if not exists public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_profile_id uuid not null references public.affiliate_profiles(id) on delete restrict,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  status varchar not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'failed')),
  payout_method varchar,
  payout_reference varchar,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commission_payouts_affiliate_profile_id_idx
  on public.commission_payouts (affiliate_profile_id);

create index if not exists commission_payouts_status_idx
  on public.commission_payouts (status);

create index if not exists commission_payouts_paid_at_idx
  on public.commission_payouts (paid_at);

create table if not exists public.affiliate_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  affiliate_profile_id uuid references public.affiliate_profiles(id) on delete restrict,
  terms_version varchar not null,
  accepted_at timestamptz not null default now(),
  ip_hash varchar,
  constraint affiliate_terms_acceptances_ip_hash_format_check
    check (ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists affiliate_terms_acceptances_user_id_idx
  on public.affiliate_terms_acceptances (user_id);

create index if not exists affiliate_terms_acceptances_affiliate_profile_id_idx
  on public.affiliate_terms_acceptances (affiliate_profile_id);

create index if not exists affiliate_terms_acceptances_terms_version_idx
  on public.affiliate_terms_acceptances (terms_version);

create index if not exists affiliate_terms_acceptances_accepted_at_idx
  on public.affiliate_terms_acceptances (accepted_at);

-- ── 7. Data Integrity Constraints & Additional Indexes ──────────────────────
create unique index if not exists app_auth_credentials_email_unique_idx
  on public.app_auth_credentials (lower(email));

create unique index if not exists app_auth_sessions_token_hash_unique_idx
  on public.app_auth_sessions (token_hash)
  where revoked_at is null;

create unique index if not exists app_password_reset_tokens_token_hash_unique_idx
  on public.app_password_reset_tokens (token_hash)
  where consumed_at is null;

alter table public.transactions
  drop constraint if exists transactions_total_nonnegative_check,
  drop constraint if exists transactions_subtotal_nonnegative_check,
  drop constraint if exists transactions_discount_nonnegative_check,
  drop constraint if exists transactions_tax_nonnegative_check,
  drop constraint if exists transactions_paid_nonnegative_check,
  drop constraint if exists transactions_change_nonnegative_check;

alter table public.transactions
  add constraint transactions_total_nonnegative_check check (total >= 0),
  add constraint transactions_subtotal_nonnegative_check check (subtotal >= 0),
  add constraint transactions_discount_nonnegative_check check (discount >= 0),
  add constraint transactions_tax_nonnegative_check check (tax >= 0),
  add constraint transactions_paid_nonnegative_check check (paid >= 0),
  add constraint transactions_change_nonnegative_check check (change >= 0);

alter table public.menu_items
  drop constraint if exists menu_items_price_nonnegative_check;

alter table public.menu_items
  add constraint menu_items_price_nonnegative_check check (price >= 0);

alter table public.inventory
  drop constraint if exists inventory_cost_nonnegative_check;

alter table public.inventory
  add constraint inventory_cost_nonnegative_check check (cost_per_unit >= 0);

alter table public.subscriptions
  drop constraint if exists subscriptions_dates_valid_check;

alter table public.subscriptions
  add constraint subscriptions_dates_valid_check
  check (expires_at is null or activated_at is null or expires_at >= activated_at);

alter table public.inventory_unit_conversions
  drop constraint if exists inventory_unit_conversions_ratio_positive_check;

alter table public.inventory_unit_conversions
  add constraint inventory_unit_conversions_ratio_positive_check
  check (ratio > 0);

alter table public.loyalty_passports
  drop constraint if exists loyalty_passports_points_nonnegative_check,
  drop constraint if exists loyalty_passports_stamps_nonnegative_check;

alter table public.loyalty_passports
  add constraint loyalty_passports_points_nonnegative_check
    check (total_points >= 0 and available_points >= 0),
  add constraint loyalty_passports_stamps_nonnegative_check
    check (total_stamps >= 0 and available_stamps >= 0);

alter table public.challenges
  drop constraint if exists challenges_target_positive_check;

alter table public.challenges
  add constraint challenges_target_positive_check check (points_reward >= 0);

alter table public.user_challenge_progress
  drop constraint if exists user_challenge_progress_nonnegative_check;

alter table public.user_challenge_progress
  add constraint user_challenge_progress_nonnegative_check check (current_progress >= 0);

-- ── 8. Audit Logs & Background Jobs ─────────────────────────────────────────
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action varchar(100) not null,
  ip_hash varchar(64),
  user_agent text,
  resource_type varchar(50),
  resource_id varchar(100),
  details jsonb,
  success boolean default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_user_id_created
  on public.audit_logs (user_id, created_at desc);

create index if not exists idx_audit_logs_action_created
  on public.audit_logs (action, created_at desc);

create index if not exists idx_audit_logs_resource
  on public.audit_logs (resource_type, resource_id, created_at desc);

create index if not exists idx_audit_logs_created
  on public.audit_logs (created_at desc);

create table if not exists public.background_jobs (
  id uuid primary key,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  status text not null default 'pending',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists background_jobs_ready_idx
  on public.background_jobs (status, run_after);

-- ── 9. Performance & Foreign-Key Indexes ────────────────────────────────────
create index if not exists idx_transactions_store_date
  on public.transactions (store_id, date desc);

create index if not exists idx_transactions_store_void_date
  on public.transactions (store_id, is_void, date desc);

create index if not exists idx_transactions_store_method
  on public.transactions (store_id, method, date desc);

create index if not exists idx_inventory_store_low_stock
  on public.inventory (store_id, stock)
  where stock <= min_stock and is_active = true;

create index if not exists idx_inventory_store_active_updated
  on public.inventory (store_id, is_active, updated_at desc);

create index if not exists idx_menu_items_store_available_category
  on public.menu_items (store_id, is_available, category);

create index if not exists idx_menu_items_store_name
  on public.menu_items (store_id, lower(name));

create index if not exists idx_kitchen_orders_store_status_updated
  on public.kitchen_orders (store_id, overall_status, updated_at desc)
  where overall_status not in ('completed', 'cancelled');

create index if not exists idx_kitchen_orders_transaction
  on public.kitchen_orders (transaction_id);

create index if not exists idx_loyalty_passports_phone
  on public.loyalty_passports (customer_phone);

create index if not exists idx_loyalty_stamp_events_passport_date
  on public.loyalty_stamp_events (passport_id, created_at desc);

create index if not exists idx_loyalty_redemptions_passport_date
  on public.loyalty_redemptions (passport_id, created_at desc);

create index if not exists idx_subscriptions_user_status
  on public.subscriptions (user_id, status);

create index if not exists idx_subscriptions_expires
  on public.subscriptions (expires_at)
  where status = 'active';

create index if not exists idx_subscriptions_plan_status
  on public.subscriptions (plan, status, created_at desc);

create index if not exists idx_payment_sessions_user_created
  on public.subscription_payment_sessions (user_id, created_at desc);

create index if not exists idx_payment_sessions_status_created
  on public.subscription_payment_sessions (transaction_status, created_at desc);

create index if not exists idx_payment_sessions_pending
  on public.subscription_payment_sessions (expires_at)
  where transaction_status = 'pending';

create index if not exists idx_notifications_user_unread_created
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists idx_notifications_user_type_created
  on public.notifications (user_id, type, created_at desc);

create index if not exists idx_challenges_store_active
  on public.challenges (store_id, is_active, created_at desc);

create index if not exists idx_user_challenge_progress_user_challenge
  on public.user_challenge_progress (user_id, challenge_id);

create index if not exists idx_expenses_store_date
  on public.expenses (store_id, date desc);

create index if not exists idx_expenses_store_category_date
  on public.expenses (store_id, category, date desc);

create index if not exists idx_cash_flow_store_date
  on public.cash_flow (store_id, date desc);

create index if not exists idx_auth_credentials_email
  on public.app_auth_credentials (lower(email));

create index if not exists idx_auth_sessions_user_active
  on public.app_auth_sessions (user_id, expires_at desc)
  where revoked_at is null;

create index if not exists idx_transactions_store_date_total
  on public.transactions (store_id, date, total)
  where is_void = false;

create index if not exists idx_inventory_store_active_cost
  on public.inventory (store_id, is_active, cost_per_unit, stock)
  where is_active = true;

create index if not exists idx_menu_items_active_only
  on public.menu_items (store_id, category, name)
  where is_available = true;

create index if not exists idx_transactions_valid_only
  on public.transactions (store_id, date desc, total)
  where is_void = false;

create index if not exists idx_kitchen_orders_active_only
  on public.kitchen_orders (store_id, updated_at desc)
  where overall_status in ('pending', 'preparing', 'ready');

-- Additional foreign-key covering indexes for optimal Postgres advisor score
create index if not exists idx_subscriptions_store_id
  on public.subscriptions (store_id);

create index if not exists idx_subscriptions_converted_from_id
  on public.subscriptions (converted_from_subscription_id);

create index if not exists idx_payment_history_subscription_id
  on public.payment_history (subscription_id);

create index if not exists idx_cashier_outlet_assignments_store_id
  on public.cashier_outlet_assignments (store_id);

create index if not exists idx_cashier_outlet_assignments_created_by
  on public.cashier_outlet_assignments (created_by);

create index if not exists idx_app_password_reset_tokens_user_id
  on public.app_password_reset_tokens (user_id);

create index if not exists idx_subscription_payment_sessions_store_id
  on public.subscription_payment_sessions (store_id);

create index if not exists idx_subscription_payment_sessions_subscription_id
  on public.subscription_payment_sessions (subscription_id);

create index if not exists idx_transaction_inventory_audit_inventory_id
  on public.transaction_inventory_audit (inventory_id);

create index if not exists idx_inventory_adjustments_adjusted_by
  on public.inventory_adjustments (adjusted_by);

create index if not exists idx_kitchen_orders_created_by
  on public.kitchen_orders (created_by);

create index if not exists idx_kitchen_order_items_menu_item_id
  on public.kitchen_order_items (menu_item_id);

create index if not exists idx_kitchen_order_events_order_item_id
  on public.kitchen_order_events (order_item_id);

create index if not exists idx_kitchen_order_events_changed_by
  on public.kitchen_order_events (changed_by);

create index if not exists idx_loyalty_stamp_events_transaction_id
  on public.loyalty_stamp_events (transaction_id);

create index if not exists idx_loyalty_stamp_events_created_by
  on public.loyalty_stamp_events (created_by);

create index if not exists idx_loyalty_stamps_transaction_id
  on public.loyalty_stamps (transaction_id);

create index if not exists idx_loyalty_redemptions_reward_id
  on public.loyalty_redemptions (reward_id);

create index if not exists idx_loyalty_redemptions_transaction_id
  on public.loyalty_redemptions (transaction_id);

create index if not exists idx_loyalty_redemptions_created_by
  on public.loyalty_redemptions (created_by);

create index if not exists idx_ai_insights_cache_generated_by
  on public.ai_insights_cache (generated_by);

create index if not exists idx_payment_attempt_logs_store_id
  on public.payment_attempt_logs (store_id);

create index if not exists idx_payment_attempt_logs_payment_order_id
  on public.payment_attempt_logs (payment_order_id);

create index if not exists idx_payment_webhook_logs_payment_order_id
  on public.payment_webhook_logs (payment_order_id);

-- ── 10. Sync Backend Schema Migrations Ledger ───────────────────────────────
insert into public.schema_migrations (version, name, checksum)
values
  ('20260430_0001_schema_migrations', '20260430_0001_schema_migrations.sql', '72db747403012802da579fb297a1fbe2d4eda8b99d913d295e6dd8ba8efb9eb9'),
  ('20260430_0002_inventory_adjustments', '20260430_0002_inventory_adjustments.sql', 'e98ca2e824869430ba0c3f25222b8d3f0483923f641272d19e4f1c819d0dcf0b'),
  ('20260510_0001_daily_challenges', '20260510_0001_daily_challenges.sql', '41508e95f8ee20a7d953b656cc93992f29543e530dd4a9b6347d8f0e05fbd5f6'),
  ('20260510_0002_upgrade_prompts', '20260510_0002_upgrade_prompts.sql', 'c69f33ac5c42c06ded9fe7f69e71b411816327029f0eb5b372b9a5aa62153f96'),
  ('20260510_0003_ai_insights_cache', '20260510_0003_ai_insights_cache.sql', '3bf3ac3fc4d179cc03993040dd8580ce7d763d19a87134566200fd5fc3bf612b'),
  ('20260511_0001_notifications_center', '20260511_0001_notifications_center.sql', '5a8bee9cdfce77aecd54435c8989632f8d2ab00657848f688a22f179d5618a1e'),
  ('20260511_0002_beta_feedback', '20260511_0002_beta_feedback.sql', '95762b4b99c6dff8dfe2d5cede895370fa17323b05bb77d88862c0e1dca56a1d'),
  ('20260512_0001_secangkir_trial', '20260512_0001_secangkir_trial.sql', '2dbf5b2768488412cf11aac3403c065825524d741daae25c819e300c259e53e6'),
  ('20260512_0002_secure_payment_orders', '20260512_0002_secure_payment_orders.sql', 'a1d54814cceadcd369ba0d2abf4f98e7621a5b1015299e28b3a0c4715b452337'),
  ('20260513_0001_app_versioning', '20260513_0001_app_versioning.sql', '6412fe7ad451e8c9651702617bc62cb0afd59cd1eb302b0c2d54ed1d6157b1aa'),
  ('20260513_0002_beta_feedback_categories', '20260513_0002_beta_feedback_categories.sql', 'dd004eebde879e64ca6f841d23cf023c244993beb055efde715dc363e77ef99e'),
  ('20260513_0003_app_version_min_supported', '20260513_0003_app_version_min_supported.sql', '8d6d760e5792fac772ffa83e1403460adeb015a529090b2cd4b255f6f9624c4f'),
  ('20260514_0001_affiliate_referral', '20260514_0001_affiliate_referral.sql', '1d0bd6acaebf66c7264d792b4fd3d62052332cea8e2f7a17ee94f836788b240f'),
  ('20260514_0002_data_integrity_constraints', '20260514_0002_data_integrity_constraints.sql', 'b67adb985c2c1cad22b636dfaeb9c8379d7be280ccb73b4637cb2ad44af66f5b'),
  ('20260514_0003_audit_logs', '20260514_0003_audit_logs.sql', 'f572ab10f4e3bc1ad6181714e538fcccbbef97283e213d74064daa70afc91265'),
  ('20260530_0001_duitku_payment_provider', '20260530_0001_duitku_payment_provider.sql', '172f7d08fb3c24f77ce5d7046f4effad4994598ee926d8ebc19e1f954579c32e'),
  ('20260623_0001_background_jobs', '20260623_0001_background_jobs.sql', '6770070b2685ea7fd7e2552c16d5c8c00d2c693e703d01cba8e838a026deb7e2'),
  ('20260624_0001_menu_item_modifiers', '20260624_0001_menu_item_modifiers.sql', '9d83000a10b2225b16fd6b98981fefb643460e83ac2ea32c0d79093db74b0130')
on conflict (version) do update
set
  name = excluded.name,
  checksum = excluded.checksum;

-- ── 11. Row Level Security (RLS) on All Public Tables ───────────────────────
do $$
declare
  tbl record;
begin
  for tbl in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', tbl.tablename);
  end loop;
end $$;

-- Read-only public metadata policy for app_versions (used by pre-auth version check)
drop policy if exists app_versions_read_all on public.app_versions;
create policy app_versions_read_all
  on public.app_versions
  for select
  to anon, authenticated
  using (true);

-- User-scoped policies for authenticated PostgREST sessions (postgres & project_admin bypass RLS)
drop policy if exists profiles_own_select on public.profiles;
create policy profiles_own_select
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists stores_owner_select on public.stores;
create policy stores_owner_select
  on public.stores
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists notifications_own_select on public.notifications;
create policy notifications_own_select
  on public.notifications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

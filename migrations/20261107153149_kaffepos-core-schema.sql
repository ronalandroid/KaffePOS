-- ============================================================================
-- KaffePOS v2 — Core Foundation & Runtime Bootstrap Schema (InsForge Postgres)
-- ============================================================================

-- ── Identity & Stores ───────────────────────────────────────────────────────
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
  role text not null default 'owner_admin',
  account_status text not null default 'active',
  permissions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('owner_admin', 'cashier')),
  constraint profiles_account_status_check check (account_status in ('active', 'inactive'))
);

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

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

create index if not exists stores_owner_id_idx
  on public.stores (owner_id);

-- ── Catalog & POS Sales ─────────────────────────────────────────────────────
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
  modifiers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_store_id_idx
  on public.menu_items (store_id);

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

create index if not exists transactions_store_date_idx
  on public.transactions (store_id, date desc);

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

create index if not exists expenses_store_date_idx
  on public.expenses (store_id, date desc);

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

create index if not exists cash_flow_store_date_idx
  on public.cash_flow (store_id, date desc);

create table if not exists public.cash_register (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  date timestamptz not null default now(),
  amount numeric not null default 0,
  note text,
  opened_by varchar,
  created_at timestamptz not null default now()
);

create index if not exists cash_register_store_date_idx
  on public.cash_register (store_id, date desc);

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

-- ── Subscriptions & Billing ─────────────────────────────────────────────────
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
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  grace_ends_at timestamptz,
  amount_paid numeric not null default 0,
  payment_amount numeric,
  payment_method varchar,
  payment_note text,
  payment_ref varchar,
  converted_from_subscription_id uuid references public.subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create index if not exists subscriptions_payment_ref_idx
  on public.subscriptions (payment_ref);

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

create index if not exists payment_history_user_id_idx
  on public.payment_history (user_id);

create index if not exists payment_history_payment_ref_idx
  on public.payment_history (payment_ref);

-- ── Auth, Sessions, MFA & Notifications ─────────────────────────────────────
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

create index if not exists email_verification_codes_email_idx
  on public.email_verification_codes (email, purpose);

create table if not exists public.ai_insight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_insight_logs_user_created_idx
  on public.ai_insight_logs (user_id, created_at);

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

create index if not exists ops_event_logs_event_created_idx
  on public.ops_event_logs (event_name, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'system'
    check (type in ('system', 'info', 'success', 'warning', 'error', 'challenge', 'stock', 'business_alert', 'gamification')),
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_store_created_idx
  on public.notifications (store_id, created_at desc)
  where store_id is not null;

create table if not exists public.cashier_outlet_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  cashier_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, cashier_id)
);

create index if not exists cashier_outlet_assignments_owner_idx
  on public.cashier_outlet_assignments (owner_id, updated_at desc);

create index if not exists cashier_outlet_assignments_cashier_idx
  on public.cashier_outlet_assignments (cashier_id, status);

create table if not exists public.app_auth_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null unique,
  password_hash text,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  ip_address text,
  user_agent text,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_auth_sessions_user_id_idx
  on public.app_auth_sessions (user_id, expires_at desc)
  where revoked_at is null;

create table if not exists public.app_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_password_reset_tokens_email_idx
  on public.app_password_reset_tokens (email, created_at desc)
  where consumed_at is null;

create table if not exists public.subscription_payment_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan text not null,
  billing_cycle text not null,
  amount integer not null,
  currency_code text not null default 'IDR',
  midtrans_order_id text not null unique,
  midtrans_transaction_id text,
  snap_token text,
  redirect_url text,
  payment_type text,
  transaction_status text not null default 'pending',
  fraud_status text,
  status_code text,
  expires_at timestamptz,
  paid_at timestamptz,
  settled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_payment_sessions_user_id_idx
  on public.subscription_payment_sessions (user_id, created_at desc);

create index if not exists subscription_payment_sessions_order_id_idx
  on public.subscription_payment_sessions (midtrans_order_id);

-- ── Inventory & Stock Audit ─────────────────────────────────────────────────
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  sku text,
  stock numeric not null default 0,
  unit text not null default 'pcs',
  base_unit text,
  purchase_unit text,
  conversion_ratio numeric default 1,
  min_stock numeric not null default 5,
  cost_per_unit numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_store_active_name_idx
  on public.inventory (store_id, is_active, name);

create table if not exists public.inventory_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  ingredient_id uuid references public.inventory(id) on delete cascade,
  from_unit text not null,
  to_unit text not null,
  ratio numeric not null check (ratio > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_unit_conversions_store_idx
  on public.inventory_unit_conversions (store_id, is_active, from_unit, to_unit);

create index if not exists inventory_unit_conversions_ingredient_idx
  on public.inventory_unit_conversions (ingredient_id, is_active);

create table if not exists public.transaction_inventory_audit (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  transaction_id text not null,
  inventory_id uuid references public.inventory(id) on delete set null,
  action text not null check (action in ('sale', 'void', 'opname')),
  qty_delta numeric not null,
  stock_before numeric not null,
  stock_after numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists transaction_inventory_audit_transaction_idx
  on public.transaction_inventory_audit (transaction_id, created_at asc);

create index if not exists transaction_inventory_audit_store_idx
  on public.transaction_inventory_audit (store_id, created_at desc);

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  counted_stock numeric not null check (counted_stock >= 0),
  stock_before numeric not null,
  qty_delta numeric not null,
  reason text not null,
  note text,
  adjusted_by uuid references public.profiles(id) on delete set null,
  adjusted_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_adjustments_store_created_idx
  on public.inventory_adjustments (store_id, created_at desc);

create index if not exists inventory_adjustments_inventory_created_idx
  on public.inventory_adjustments (inventory_id, created_at desc);

-- ── Kitchen Display System (KDS) ────────────────────────────────────────────
create table if not exists public.kitchen_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  transaction_id text references public.transactions(id) on delete set null,
  order_number text not null,
  source text not null default 'cashier',
  customer_name text,
  table_number text,
  overall_status text not null default 'pending'
    check (overall_status in ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  status_version integer not null default 1,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, transaction_id)
);

create index if not exists kitchen_orders_store_status_created_idx
  on public.kitchen_orders (store_id, overall_status, created_at desc);

create index if not exists kitchen_orders_store_updated_idx
  on public.kitchen_orders (store_id, updated_at desc);

create table if not exists public.kitchen_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.kitchen_orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  qty numeric not null check (qty > 0),
  note text,
  station text not null default 'other'
    check (station in ('kitchen', 'bar', 'dessert', 'other')),
  item_status text not null default 'pending'
    check (item_status in ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
  status_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kitchen_order_items_order_idx
  on public.kitchen_order_items (order_id, created_at asc);

create index if not exists kitchen_order_items_station_status_idx
  on public.kitchen_order_items (station, item_status);

create table if not exists public.kitchen_order_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.kitchen_orders(id) on delete cascade,
  order_item_id uuid references public.kitchen_order_items(id) on delete set null,
  event_type text not null,
  old_status text,
  new_status text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_by_name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists kitchen_order_events_store_created_idx
  on public.kitchen_order_events (store_id, created_at desc);

create index if not exists kitchen_order_events_order_created_idx
  on public.kitchen_order_events (order_id, created_at asc);

-- ── Loyalty & Gamification ──────────────────────────────────────────────────
create table if not exists public.loyalty_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  stamps_required integer not null default 8 check (stamps_required between 2 and 20),
  points_per_rupiah numeric not null default 0.01 check (points_per_rupiah >= 0),
  minimum_transaction_amount integer not null default 0 check (minimum_transaction_amount >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  type text not null check (type in ('discount_amount', 'discount_percent', 'free_item')),
  reward_value integer not null default 0 check (reward_value >= 0),
  points_or_stamps_needed integer not null default 0 check (points_or_stamps_needed >= 0),
  points_cost integer not null default 0 check (points_cost >= 0),
  stamps_cost integer not null default 0 check (stamps_cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loyalty_rewards_store_active_idx
  on public.loyalty_rewards (store_id, is_active, created_at asc);

create table if not exists public.loyalty_customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text,
  phone text not null,
  tier text not null default 'regular' check (tier in ('regular', 'kopi_lover', 'vvip')),
  total_points integer not null default 0 check (total_points >= 0),
  total_visits integer not null default 0 check (total_visits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, phone)
);

create index if not exists loyalty_customers_store_phone_idx
  on public.loyalty_customers (store_id, phone);

create table if not exists public.loyalty_tiers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  name text not null,
  min_visits integer not null default 0 check (min_visits >= 0),
  benefits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, name)
);

create index if not exists loyalty_tiers_store_min_visits_idx
  on public.loyalty_tiers (store_id, min_visits asc);

create table if not exists public.loyalty_passports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_name text,
  customer_phone text not null,
  tier text not null default 'regular' check (tier in ('regular', 'kopi_lover', 'vvip')),
  total_stamps integer not null default 0 check (total_stamps >= 0),
  available_stamps integer not null default 0 check (available_stamps >= 0),
  total_points integer not null default 0 check (total_points >= 0),
  available_points integer not null default 0 check (available_points >= 0),
  lifetime_spend integer not null default 0 check (lifetime_spend >= 0),
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, customer_phone)
);

create index if not exists loyalty_passports_store_updated_idx
  on public.loyalty_passports (store_id, updated_at desc);

create index if not exists loyalty_passports_store_phone_idx
  on public.loyalty_passports (store_id, customer_phone);

create table if not exists public.loyalty_stamp_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  passport_id uuid not null references public.loyalty_passports(id) on delete cascade,
  transaction_id text references public.transactions(id) on delete set null,
  stamps integer not null default 1 check (stamps >= 0),
  points integer not null default 0 check (points >= 0),
  transaction_amount integer not null default 0 check (transaction_amount >= 0),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists loyalty_stamp_events_idempotency_idx
  on public.loyalty_stamp_events (store_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists loyalty_stamp_events_passport_created_idx
  on public.loyalty_stamp_events (passport_id, created_at desc);

create table if not exists public.loyalty_stamps (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
  transaction_id text references public.transactions(id) on delete set null,
  stamps_earned integer not null default 1 check (stamps_earned >= 0),
  created_at timestamptz not null default now()
);

create index if not exists loyalty_stamps_customer_created_idx
  on public.loyalty_stamps (customer_id, created_at desc);

create table if not exists public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  passport_id uuid not null references public.loyalty_passports(id) on delete cascade,
  reward_id uuid not null references public.loyalty_rewards(id) on delete restrict,
  transaction_id text references public.transactions(id) on delete set null,
  points_spent integer not null default 0 check (points_spent >= 0),
  stamps_spent integer not null default 0 check (stamps_spent >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  status text not null default 'redeemed' check (status in ('pending', 'redeemed', 'void')),
  created_by uuid references public.profiles(id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists loyalty_redemptions_idempotency_idx
  on public.loyalty_redemptions (store_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists loyalty_redemptions_passport_created_idx
  on public.loyalty_redemptions (passport_id, created_at desc);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  title text not null,
  description text not null default '',
  target_type text not null check (
    target_type in (
      'sell_drink',
      'average_checkout_time',
      'transactions_count',
      'upsell_value',
      'zero_voids'
    )
  ),
  target_value jsonb not null default '{}'::jsonb,
  points_reward integer not null default 0 check (points_reward >= 0),
  is_active boolean not null default true,
  valid_from date not null default current_date,
  valid_to date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists challenges_store_active_valid_idx
  on public.challenges (store_id, is_active, valid_from, valid_to);

create unique index if not exists challenges_store_title_day_idx
  on public.challenges (store_id, title, valid_from);

create table if not exists public.user_challenge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  current_progress numeric not null default 0 check (current_progress >= 0),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

create index if not exists user_challenge_progress_user_idx
  on public.user_challenge_progress (user_id, updated_at desc);

create index if not exists user_challenge_progress_challenge_idx
  on public.user_challenge_progress (challenge_id, is_completed);

create table if not exists public.subscription_upgrade_prompt_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  event_type text not null check (event_type in ('view', 'click', 'dismiss')),
  prompt_key text not null,
  trigger text not null,
  recommended_plan text not null default 'signature',
  current_plan text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_upgrade_prompt_events_user_idx
  on public.subscription_upgrade_prompt_events (user_id, created_at desc);

create index if not exists subscription_upgrade_prompt_events_store_trigger_idx
  on public.subscription_upgrade_prompt_events (store_id, trigger, created_at desc);

create table if not exists public.ai_insights_cache (
  store_id uuid primary key references public.stores(id) on delete cascade,
  generated_by uuid references public.profiles(id) on delete set null,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists ai_insights_cache_expires_idx
  on public.ai_insights_cache (expires_at);

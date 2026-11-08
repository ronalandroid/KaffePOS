/**
 * Idempotent database schema bootstrap for KaffePOS.
 *
 * Each function issues `create table if not exists` (and related) DDL through the
 * shared core pool. Extracted from index.ts so the server entrypoint stays focused
 * on wiring. Call order is preserved by bootstrapAllSchemas().
 */
import { pool } from './core/db';

export async function bootstrapAuthSchema() {
  await pool.query('create extension if not exists pgcrypto');

  await pool.query(`
    do $$
    declare
      profiles_auth_fk text;
      insight_auth_fk text;
    begin
      select con.conname
      into profiles_auth_fk
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      join pg_class ref on ref.oid = con.confrelid
      join pg_namespace refnsp on refnsp.oid = ref.relnamespace
      where con.contype = 'f'
        and nsp.nspname = 'public'
        and rel.relname = 'profiles'
        and refnsp.nspname = 'auth'
        and ref.relname = 'users'
      limit 1;

      if profiles_auth_fk is not null then
        execute format('alter table public.profiles drop constraint %I', profiles_auth_fk);
      end if;

      select con.conname
      into insight_auth_fk
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      join pg_class ref on ref.oid = con.confrelid
      join pg_namespace refnsp on refnsp.oid = ref.relnamespace
      where con.contype = 'f'
        and nsp.nspname = 'public'
        and rel.relname = 'ai_insight_logs'
        and refnsp.nspname = 'auth'
        and ref.relname = 'users'
      limit 1;

      if insight_auth_fk is not null then
        execute format('alter table public.ai_insight_logs drop constraint %I', insight_auth_fk);
      end if;
    end $$;
  `);

  await pool.query(`
    alter table public.profiles
      add column if not exists role text not null default 'owner_admin';

    alter table public.profiles
      add column if not exists account_status text not null default 'active';

    update public.profiles
    set role = 'owner_admin'
    where role is null
       or role not in ('owner_admin', 'cashier');

    update public.profiles
    set account_status = 'active'
    where account_status is null
       or account_status not in ('active', 'inactive');

    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'profiles_role_check'
      ) then
        alter table public.profiles
          add constraint profiles_role_check
          check (role in ('owner_admin', 'cashier'));
      end if;

      if not exists (
        select 1
        from pg_constraint
        where conname = 'profiles_account_status_check'
      ) then
        alter table public.profiles
          add constraint profiles_account_status_check
          check (account_status in ('active', 'inactive'));
      end if;
    end $$;
  `);

  await pool.query(`
    create table if not exists public.notifications (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles(id) on delete cascade,
      title text not null,
      message text not null,
      type text not null default 'system',
      is_read boolean not null default false,
      created_at timestamptz not null default now()
    );

    -- The code reads/writes is_read exclusively (routes/misc.ts), matching migration
    -- 20260511_0001. Guard for tables created by an older bootstrap that used "read".
    alter table public.notifications
      add column if not exists is_read boolean not null default false;

    alter table public.notifications
      add column if not exists store_id uuid references public.stores(id) on delete cascade;

    alter table public.notifications
      add column if not exists metadata jsonb not null default '{}'::jsonb;

    alter table public.notifications
      drop constraint if exists notifications_type_check;

    alter table public.notifications
      add constraint notifications_type_check
      check (type in ('system', 'info', 'success', 'warning', 'error', 'challenge', 'stock', 'business_alert', 'gamification'));

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
  `);

  await pool.query(`
    insert into public.app_auth_credentials (user_id, email, email_verified_at, created_at, updated_at)
    select p.id, lower(trim(p.email)), now(), now(), now()
    from public.profiles p
    where p.email is not null
      and trim(p.email) <> ''
    on conflict (user_id) do update
    set
      email = excluded.email,
      updated_at = now()
  `);
}

export async function bootstrapStockSchema() {
  await pool.query('create extension if not exists pgcrypto');

  await pool.query(`
    create table if not exists public.inventory (
      id uuid primary key default gen_random_uuid(),
      store_id uuid not null references public.stores(id) on delete cascade,
      name text not null,
      stock numeric not null default 0,
      unit text not null default 'pcs',
      min_stock numeric not null default 5,
      cost_per_unit numeric not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table public.inventory
      add column if not exists sku text;

    alter table public.inventory
      add column if not exists base_unit text;

    alter table public.inventory
      add column if not exists purchase_unit text;

    alter table public.inventory
      add column if not exists conversion_ratio numeric;

    alter table public.inventory
      add column if not exists is_active boolean not null default true;

    update public.inventory
    set base_unit = coalesce(nullif(trim(base_unit), ''), unit)
    where base_unit is null or trim(base_unit) = '';

    update public.inventory
    set purchase_unit = coalesce(nullif(trim(purchase_unit), ''), unit)
    where purchase_unit is null or trim(purchase_unit) = '';

    update public.inventory
    set conversion_ratio = 1
    where conversion_ratio is null or conversion_ratio <= 0;

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
      action text not null,
      qty_delta numeric not null,
      stock_before numeric not null,
      stock_after numeric not null,
      created_at timestamptz not null default now()
    );

    do $$
    declare
      audit_transaction_fk text;
    begin
      for audit_transaction_fk in
        select con.conname
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace nsp on nsp.oid = rel.relnamespace
        join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
        where con.contype = 'f'
          and nsp.nspname = 'public'
          and rel.relname = 'transaction_inventory_audit'
          and att.attname = 'transaction_id'
      loop
        execute format('alter table public.transaction_inventory_audit drop constraint %I', audit_transaction_fk);
      end loop;
    end $$;

    alter table public.transaction_inventory_audit
      alter column transaction_id type text using transaction_id::text;

    alter table public.transaction_inventory_audit
      drop constraint if exists transaction_inventory_audit_action_check;

    alter table public.transaction_inventory_audit
      add constraint transaction_inventory_audit_action_check
      check (action in ('sale', 'void', 'opname'));

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
  `);
}

export async function bootstrapKitchenSchema() {
  await pool.query('create extension if not exists pgcrypto');

  await pool.query(`
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
  `);
}

export async function bootstrapLoyaltySchema() {
  await pool.query('create extension if not exists pgcrypto');

  await pool.query(`
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

    alter table public.loyalty_rewards
      add column if not exists points_or_stamps_needed integer not null default 0 check (points_or_stamps_needed >= 0);

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
  `);
}

export async function bootstrapChallengeSchema() {
  await pool.query('create extension if not exists pgcrypto');

  await pool.query(`
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
  `);
}

export async function bootstrapSubscriptionPromptSchema() {
  await pool.query('create extension if not exists pgcrypto');

  await pool.query(`
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
  `);
}

export async function bootstrapAiInsightsSchema() {
  await pool.query('create extension if not exists pgcrypto');

  await pool.query(`
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
  `);
}

export async function bootstrapMajooFnbSchema() {
  await pool.query('create extension if not exists pgcrypto');

  await pool.query(`
    alter table public.transactions
      add column if not exists order_type varchar(32) default 'dine_in',
      add column if not exists table_number varchar(32),
      add column if not exists pax integer default 1,
      add column if not exists service_charge numeric default 0;

    create table if not exists public.open_bills (
      id uuid primary key default gen_random_uuid(),
      store_id uuid not null references public.stores(id) on delete cascade,
      bill_number varchar(64) not null,
      order_type varchar(32) not null default 'dine_in',
      table_number varchar(32),
      pax integer not null default 1,
      customer_name varchar(120),
      cashier varchar(120),
      items jsonb not null default '[]'::jsonb,
      subtotal numeric not null default 0,
      discount numeric not null default 0,
      tax numeric not null default 0,
      total numeric not null default 0,
      note text,
      status varchar(24) not null default 'open',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists idx_open_bills_store_status
      on public.open_bills (store_id, status, updated_at desc);

    alter table public.open_bills
      add column if not exists service_charge numeric not null default 0,
      add column if not exists discount_label text;

    alter table public.open_bills
      alter column bill_number drop not null;
    alter table public.open_bills
      alter column bill_number set default '';

    create table if not exists public.purchase_orders (
      id uuid primary key default gen_random_uuid(),
      store_id uuid not null references public.stores(id) on delete cascade,
      po_number varchar(64) not null,
      supplier_name varchar(160) not null,
      supplier_phone varchar(64),
      status varchar(24) not null default 'ordered',
      items jsonb not null default '[]'::jsonb,
      total_cost numeric not null default 0,
      note text,
      created_by varchar(120),
      received_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists idx_purchase_orders_store_created
      on public.purchase_orders (store_id, created_at desc);

    alter table public.purchase_orders
      add column if not exists total_amount numeric not null default 0,
      add column if not exists notes text,
      add column if not exists ordered_at timestamptz default now();

    create table if not exists public.shift_closings (
      id uuid primary key default gen_random_uuid(),
      store_id uuid not null references public.stores(id) on delete cascade,
      cashier_name varchar(120) not null,
      opened_at timestamptz,
      closed_at timestamptz not null default now(),
      opening_cash numeric not null default 0,
      cash_sales numeric not null default 0,
      non_cash_sales numeric not null default 0,
      cash_in numeric not null default 0,
      cash_out numeric not null default 0,
      expected_cash numeric not null default 0,
      actual_cash numeric not null default 0,
      variance numeric not null default 0,
      note text,
      created_at timestamptz not null default now()
    );

    create index if not exists idx_shift_closings_store_closed
      on public.shift_closings (store_id, closed_at desc);

    alter table public.shift_closings
      add column if not exists cashier_id uuid references public.profiles(id) on delete set null,
      add column if not exists total_sales numeric not null default 0,
      add column if not exists total_non_cash numeric not null default 0,
      add column if not exists transactions_count integer not null default 0,
      add column if not exists notes text;
  `);
}

/** Run every schema bootstrap in dependency order (called once at startup). */
export async function bootstrapAllSchemas() {
  await bootstrapAuthSchema();
  await bootstrapStockSchema();
  await bootstrapKitchenSchema();
  await bootstrapLoyaltySchema();
  await bootstrapChallengeSchema();
  await bootstrapSubscriptionPromptSchema();
  await bootstrapAiInsightsSchema();
  await bootstrapMajooFnbSchema();
}

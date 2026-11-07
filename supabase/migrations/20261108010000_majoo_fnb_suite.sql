-- Migration: Majoo F&B Suite for KaffePOS v2
-- Adds order_type, table_number, pax, service_charge to transactions
-- Creates open_bills, purchase_orders, and shift_closings tables with RLS & indexes

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS order_type varchar(32) DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS table_number varchar(32),
  ADD COLUMN IF NOT EXISTS pax integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS service_charge numeric DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.open_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bill_number varchar(64) NOT NULL,
  order_type varchar(32) NOT NULL DEFAULT 'dine_in',
  table_number varchar(32),
  pax integer NOT NULL DEFAULT 1,
  customer_name varchar(120),
  cashier varchar(120),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  note text,
  status varchar(24) NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_open_bills_store_status ON public.open_bills(store_id, status, updated_at DESC);

ALTER TABLE public.open_bills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'open_bills' AND policyname = 'open_bills_store_isolation'
  ) THEN
    CREATE POLICY open_bills_store_isolation ON public.open_bills
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = open_bills.store_id AND s.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = open_bills.store_id AND s.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  po_number varchar(64) NOT NULL,
  supplier_name varchar(160) NOT NULL,
  supplier_phone varchar(64),
  status varchar(24) NOT NULL DEFAULT 'ordered',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_cost numeric NOT NULL DEFAULT 0,
  note text,
  created_by varchar(120),
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_store_created ON public.purchase_orders(store_id, created_at DESC);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'purchase_orders' AND policyname = 'purchase_orders_store_isolation'
  ) THEN
    CREATE POLICY purchase_orders_store_isolation ON public.purchase_orders
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = purchase_orders.store_id AND s.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = purchase_orders.store_id AND s.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shift_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cashier_name varchar(120) NOT NULL,
  opened_at timestamptz,
  closed_at timestamptz NOT NULL DEFAULT now(),
  opening_cash numeric NOT NULL DEFAULT 0,
  cash_sales numeric NOT NULL DEFAULT 0,
  non_cash_sales numeric NOT NULL DEFAULT 0,
  cash_in numeric NOT null DEFAULT 0,
  cash_out numeric NOT NULL DEFAULT 0,
  expected_cash numeric NOT NULL DEFAULT 0,
  actual_cash numeric NOT NULL DEFAULT 0,
  variance numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_closings_store_closed ON public.shift_closings(store_id, closed_at DESC);

ALTER TABLE public.shift_closings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shift_closings' AND policyname = 'shift_closings_store_isolation'
  ) THEN
    CREATE POLICY shift_closings_store_isolation ON public.shift_closings
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = shift_closings.store_id AND s.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = shift_closings.store_id AND s.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- The supplements store, part two: customers and points, the stock log, the
-- product gallery and the delivery pin.
--
-- Run AFTER 2026-11-04-store.sql (it alters the tables that file creates).
--
--   store_customers        one row per phone number; every order links to one.
--                          `points` is the balance, earned when an order is
--                          marked delivered — see updateOrderStatus in
--                          src/app/admin/store/actions.ts.
--   store_points_log       every change to a balance: an order delivered, an
--                          order taken back, a manual adjustment by the coach.
--   store_stock_movements  every change to a product's stock: received,
--                          counted, taken by a confirmed order, given back.
--   store_products.images  the gallery; the first is the main picture.
--   store_orders.location  where the customer dropped the pin.
--
-- Additive only. New tables and new columns with defaults; nothing existing is
-- dropped or rewritten except copying each product's single image_url into its
-- new gallery. Re-running it is harmless.
--
-- Rollback:  DROP TABLE IF EXISTS public.store_stock_movements, public.store_points_log;
--            ALTER TABLE public.store_orders DROP COLUMN IF EXISTS customer_id,
--              DROP COLUMN IF EXISTS location_lat, DROP COLUMN IF EXISTS location_lng,
--              DROP COLUMN IF EXISTS points_earned, DROP COLUMN IF EXISTS points_awarded;
--            DROP TABLE IF EXISTS public.store_customers;
--            ALTER TABLE public.store_products DROP COLUMN IF EXISTS images,
--              DROP COLUMN IF EXISTS low_stock_threshold;

-- Products: gallery + per-product low-stock line ------------------------------
ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS images              text[]  NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

UPDATE public.store_products
   SET images = ARRAY[image_url]
 WHERE image_url IS NOT NULL AND cardinality(images) = 0;

-- Customers ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_customers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  city        text        NOT NULL DEFAULT '',
  address     text        NOT NULL DEFAULT '',
  points      integer     NOT NULL DEFAULT 0,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_points_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid        NOT NULL REFERENCES public.store_customers (id) ON DELETE CASCADE,
  change          integer     NOT NULL,
  balance_after   integer     NOT NULL,
  reason          text        NOT NULL CHECK (reason IN ('order', 'order_reversed', 'manual')),
  order_reference text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_points_log_customer ON public.store_points_log (customer_id, created_at DESC);

-- Orders: who, where, and the points they carry -----------------------------
ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS customer_id    uuid REFERENCES public.store_customers (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_lat   double precision,
  ADD COLUMN IF NOT EXISTS location_lng   double precision,
  ADD COLUMN IF NOT EXISTS points_earned  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_awarded boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_store_orders_customer ON public.store_orders (customer_id, created_at DESC);

-- Orders placed before this file get their customer from their phone number.
INSERT INTO public.store_customers (phone, name, city, address)
SELECT DISTINCT ON (customer_phone) customer_phone, customer_name, city, address
  FROM public.store_orders
 ORDER BY customer_phone, created_at DESC
ON CONFLICT (phone) DO NOTHING;

UPDATE public.store_orders o
   SET customer_id = c.id
  FROM public.store_customers c
 WHERE o.customer_id IS NULL AND c.phone = o.customer_phone;

-- Stock log -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_stock_movements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid        NOT NULL REFERENCES public.store_products (id) ON DELETE CASCADE,
  change          integer     NOT NULL,
  stock_after     integer,
  reason          text        NOT NULL CHECK (reason IN ('restock', 'count', 'order', 'order_reversed', 'tracking')),
  order_reference text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_stock_movements_product ON public.store_stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_stock_movements_created ON public.store_stock_movements (created_at DESC);

-- Server-only, like the rest of the store.
ALTER TABLE public.store_customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_points_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_stock_movements ENABLE ROW LEVEL SECURITY;

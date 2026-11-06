-- The supplements store: its catalogue and its orders.
--
-- /store shows the products in store_products; the cart sends each order to the
-- coach over WhatsApp and records it in store_orders, which /admin/store/orders
-- lists. Store settings (WhatsApp number, delivery fee, hero text) live in the
-- existing site_settings table under id 'store_settings' and need nothing here.
--
-- Until this file is run, /store shows the products in src/lib/store/seed.ts
-- and orders still reach WhatsApp — they just are not
-- recorded, and the panel's product editor cannot save.
--
-- Additive only. It creates two tables; the products themselves are inserted
-- by 2026-11-04-store-v2.sql. It touches nothing that exists. Re-running it is harmless.
--
-- Rollback:  DROP TABLE IF EXISTS public.store_orders;
--            DROP TABLE IF EXISTS public.store_products;

CREATE TABLE IF NOT EXISTS public.store_products (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text        NOT NULL UNIQUE,
  name             text        NOT NULL,
  tagline          text        NOT NULL DEFAULT '',
  category         text        NOT NULL DEFAULT 'protein',
  brand            text        NOT NULL DEFAULT '',
  description      text        NOT NULL DEFAULT '',
  price            integer     NOT NULL DEFAULT 0 CHECK (price >= 0),
  compare_at_price integer     CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  image_url        text,
  accent           text        NOT NULL DEFAULT '#60A5FA',
  highlights       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  features         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  usage            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  nutrition        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ingredients      text        NOT NULL DEFAULT '',
  flavors          text[]      NOT NULL DEFAULT '{}'::text[],
  sizes            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  stock            integer,
  is_active        boolean     NOT NULL DEFAULT true,
  is_featured      boolean     NOT NULL DEFAULT false,
  sort_order       integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_products_active_sort
  ON public.store_products (is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.store_orders (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text        NOT NULL UNIQUE,
  customer_name  text        NOT NULL,
  customer_phone text        NOT NULL,
  city           text        NOT NULL,
  address        text        NOT NULL,
  notes          text,
  items          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  subtotal       integer     NOT NULL DEFAULT 0,
  delivery_fee   integer     NOT NULL DEFAULT 0,
  total          integer     NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'confirmed', 'delivered', 'cancelled')),
  stock_applied  boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_orders_created ON public.store_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_orders_status  ON public.store_orders (status);

-- Written only by the server through the service connection, like
-- staff_accounts. Row level security with no policies keeps the anon key out.
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders   ENABLE ROW LEVEL SECURITY;


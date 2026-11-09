-- Stock per size and flavour, from the owner's count on 2026-11-10.
--
-- A row says that combination is sold: qty 0 is sold out, no row is not offered
-- at that size (RVIT's unflavoured size has no lemon). `stock` stays their sum,
-- so everything that only asks "how many of this product" keeps working.
--
-- Run this BEFORE deploying the code that reads the column. A missing column
-- makes the storefront fall back to the sample catalogue.
--
-- Do NOT re-run it once orders have been confirmed: it writes the count as it
-- stood, and would put back what has since been sold.

BEGIN;

ALTER TABLE public.store_products ADD COLUMN IF NOT EXISTS variant_stock jsonb NOT NULL DEFAULT '[]'::jsonb;

-- The small pancake tub comes in strawberry, which was not listed.
UPDATE public.store_products
SET flavors = ARRAY['شوكولاتة', 'فانيليا', 'توت العليق', 'خبز الزنجبيل', 'فراولة']::text[], updated_at = now()
WHERE slug = 'protein-pancake-waffle';

WITH counted(slug, rows, total) AS (VALUES
  ('ans-n-whey', '[{"size":"2.27 كغ","flavor":"كريمة الموز","qty":15},{"size":"2.27 كغ","flavor":"شوكولاتة بالحليب","qty":0},{"size":"2.27 كغ","flavor":"فانيليا كريمية","qty":0},{"size":"2.27 كغ","flavor":"ميلك شيك الفراولة","qty":0}]'::jsonb, 15),
  ('protein-pancake-waffle', '[{"size":"1.2 كغ","flavor":"شوكولاتة","qty":3},{"size":"1.2 كغ","flavor":"فانيليا","qty":0},{"size":"1.2 كغ","flavor":"توت العليق","qty":1},{"size":"1.2 كغ","flavor":"خبز الزنجبيل","qty":0},{"size":"1.2 كغ","flavor":"فراولة","qty":1},{"size":"3 كغ","flavor":"شوكولاتة","qty":3},{"size":"3 كغ","flavor":"فانيليا","qty":1},{"size":"3 كغ","flavor":"توت العليق","qty":1},{"size":"3 كغ","flavor":"خبز الزنجبيل","qty":0},{"size":"3 كغ","flavor":"فراولة","qty":0}]'::jsonb, 10),
  ('ans-creatine', '[{"size":"300 غرام","flavor":"بدون نكهة","qty":5}]'::jsonb, 5),
  ('rvit-creatine', '[{"size":"غير مطعّم · 60 حصة","flavor":"بدون نكهة","qty":10},{"size":"مطعّم · 50 حصة","flavor":"كشمش أسود","qty":2},{"size":"مطعّم · 50 حصة","flavor":"برتقال","qty":0},{"size":"مطعّم · 50 حصة","flavor":"ليمون","qty":2},{"size":"مطعّم · 50 حصة","flavor":"علكة","qty":1},{"size":"مطعّم · 50 حصة","flavor":"حلوى مثلجة","qty":0}]'::jsonb, 15),
  ('lusty-preworkout', '[{"size":"30 حصة","flavor":"كشمش أسود","qty":2},{"size":"30 حصة","flavor":"ليمون","qty":2},{"size":"30 حصة","flavor":"فواكه مشكلة","qty":3},{"size":"30 حصة","flavor":"فراولة وباشن فروت","qty":3}]'::jsonb, 10),
  ('vast-mass', '[{"size":"3 كغ","flavor":"فراولة","qty":1},{"size":"3 كغ","flavor":"شوكولاتة","qty":3},{"size":"3 كغ","flavor":"موز","qty":0},{"size":"3 كغ","flavor":"كوكيز","qty":0},{"size":"3 كغ","flavor":"كراميل مملح","qty":0},{"size":"3 كغ","flavor":"خوخ","qty":1},{"size":"3 كغ","flavor":"تشيز كيك بالبرتقال","qty":0}]'::jsonb, 5),
  ('rice-carbs-pure', '[{"size":"2 كغ","flavor":"موز","qty":1},{"size":"2 كغ","flavor":"شوكولاتة بالحليب","qty":1},{"size":"2 كغ","flavor":"فراولة","qty":1},{"size":"2 كغ","flavor":"فانيليا","qty":1},{"size":"2 كغ","flavor":"تفاح وقرفة","qty":1}]'::jsonb, 5),
  ('beta-alanine', '[{"size":"420 غرام","flavor":"كولا","qty":2},{"size":"420 غرام","flavor":"فراولة","qty":2},{"size":"420 غرام","flavor":"بدون نكهة","qty":1}]'::jsonb, 5),
  ('citrulline', '[{"size":"50 حصة","flavor":"كولا","qty":10}]'::jsonb, 10),
  ('ashwagandha', '[{"size":"60 كبسولة","flavor":"بدون نكهة","qty":10}]'::jsonb, 10)
), logged AS (
  INSERT INTO public.store_stock_movements (product_id, change, stock_after, reason, note)
  SELECT p.id, c.total - COALESCE(p.stock, 0), c.total, 'count', 'جرد حسب النكهة والحجم'
  FROM public.store_products p
  JOIN counted c ON c.slug = p.slug
  WHERE p.stock IS DISTINCT FROM c.total
  RETURNING 1
)
UPDATE public.store_products p
SET variant_stock = c.rows, stock = c.total, updated_at = now()
FROM counted c
WHERE c.slug = p.slug;

COMMIT;

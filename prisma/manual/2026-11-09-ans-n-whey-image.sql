-- The photo for the N-Whey protein, on a transparent background.
--
-- 2026-11-04-store-v2.sql inserts this product with no photo and with
-- ON CONFLICT DO NOTHING, so editing that file never reaches the existing row.
-- This sets the main photo and replaces the product's whole gallery with it.
--
-- Run it only once public/images/store/ans-n-whey.webp is deployed, or the
-- store will point at a file that is not there yet.
-- Matches src/lib/store/seed.ts. Re-running it is harmless.

UPDATE public.store_products SET
  image_url  = '/images/store/ans-n-whey.webp',
  images     = ARRAY['/images/store/ans-n-whey.webp']::text[],
  updated_at = now()
WHERE slug = 'ans-n-whey';

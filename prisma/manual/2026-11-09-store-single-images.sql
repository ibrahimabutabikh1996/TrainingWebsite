-- One photo per product, now that the old store photos and the extra gallery
-- photos (*-2.webp, *-3.webp) are gone from public/images/store.
--
-- Run this BEFORE pushing the commit that deletes those files. The ten main
-- file names exist both before and after that commit, so these rows are valid
-- at every moment; the other order leaves galleries pointing at missing files.
--
-- N-Whey is the one row not on a local file: it was showing a photo uploaded
-- from the panel, public-media/images/cms_1794245603989_6cd4b56c.png. This does
-- not delete that upload, so it can be put back from the panel.
--
-- Matches src/lib/store/seed.ts. Re-running it is harmless.

UPDATE public.store_products SET image_url = '/images/store/ans-n-whey.webp',       images = ARRAY['/images/store/ans-n-whey.webp']::text[],       updated_at = now() WHERE slug = 'ans-n-whey';
UPDATE public.store_products SET image_url = '/images/store/protein-pancake.webp',  images = ARRAY['/images/store/protein-pancake.webp']::text[],  updated_at = now() WHERE slug = 'protein-pancake-waffle';
UPDATE public.store_products SET image_url = '/images/store/ans-creatine.webp',     images = ARRAY['/images/store/ans-creatine.webp']::text[],     updated_at = now() WHERE slug = 'ans-creatine';
UPDATE public.store_products SET image_url = '/images/store/rvit-creatine.webp',    images = ARRAY['/images/store/rvit-creatine.webp']::text[],    updated_at = now() WHERE slug = 'rvit-creatine';
UPDATE public.store_products SET image_url = '/images/store/lusty-preworkout.webp', images = ARRAY['/images/store/lusty-preworkout.webp']::text[], updated_at = now() WHERE slug = 'lusty-preworkout';
UPDATE public.store_products SET image_url = '/images/store/vast-mass.webp',        images = ARRAY['/images/store/vast-mass.webp']::text[],        updated_at = now() WHERE slug = 'vast-mass';
UPDATE public.store_products SET image_url = '/images/store/rice-carbs-pure.webp',  images = ARRAY['/images/store/rice-carbs-pure.webp']::text[],  updated_at = now() WHERE slug = 'rice-carbs-pure';
UPDATE public.store_products SET image_url = '/images/store/beta-alanine.webp',     images = ARRAY['/images/store/beta-alanine.webp']::text[],     updated_at = now() WHERE slug = 'beta-alanine';
UPDATE public.store_products SET image_url = '/images/store/citrulline.webp',       images = ARRAY['/images/store/citrulline.webp']::text[],       updated_at = now() WHERE slug = 'citrulline';
UPDATE public.store_products SET image_url = '/images/store/ashwagandha.webp',      images = ARRAY['/images/store/ashwagandha.webp']::text[],      updated_at = now() WHERE slug = 'ashwagandha';

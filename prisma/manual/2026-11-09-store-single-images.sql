-- One photo per product, from the files now in public/images/store. The old
-- store photos and the extra gallery photos (*-2.webp, *-3.webp) are gone.
--
-- Run this right AFTER the commit that renames those files has finished
-- deploying. The new names do not exist on the site until then, and the old
-- ones stop existing at that moment, so keep the gap between the two short.
--
-- N-Whey is the one row not on a local file: it was showing a photo uploaded
-- from the panel, public-media/images/cms_1794245603989_6cd4b56c.png. This does
-- not delete that upload, so it can be put back from the panel.
--
-- Matches src/lib/store/seed.ts. Re-running it is harmless.

UPDATE public.store_products SET image_url = '/images/store/ans-n-whey-banana-cream.png',                images = ARRAY['/images/store/ans-n-whey-banana-cream.png']::text[],                updated_at = now() WHERE slug = 'ans-n-whey';
UPDATE public.store_products SET image_url = '/images/store/protein-pancake.webp',                       images = ARRAY['/images/store/protein-pancake.webp']::text[],                       updated_at = now() WHERE slug = 'protein-pancake-waffle';
UPDATE public.store_products SET image_url = '/images/store/ans-creatine-monohydrate-300g.png',          images = ARRAY['/images/store/ans-creatine-monohydrate-300g.png']::text[],          updated_at = now() WHERE slug = 'ans-creatine';
UPDATE public.store_products SET image_url = '/images/store/rvit-creatine-monohydrate-blackcurrant.png', images = ARRAY['/images/store/rvit-creatine-monohydrate-blackcurrant.png']::text[], updated_at = now() WHERE slug = 'rvit-creatine';
UPDATE public.store_products SET image_url = '/images/store/rvit-lusty-preworkout-blackcurrant.png',     images = ARRAY['/images/store/rvit-lusty-preworkout-blackcurrant.png']::text[],     updated_at = now() WHERE slug = 'lusty-preworkout';
UPDATE public.store_products SET image_url = '/images/store/rvit-vast-mass-strawberry.png',              images = ARRAY['/images/store/rvit-vast-mass-strawberry.png']::text[],              updated_at = now() WHERE slug = 'vast-mass';
UPDATE public.store_products SET image_url = '/images/store/rvit-rice-carbs-pure-banana.png',            images = ARRAY['/images/store/rvit-rice-carbs-pure-banana.png']::text[],            updated_at = now() WHERE slug = 'rice-carbs-pure';
UPDATE public.store_products SET image_url = '/images/store/rvit-beta-alanine-cola.png',                 images = ARRAY['/images/store/rvit-beta-alanine-cola.png']::text[],                 updated_at = now() WHERE slug = 'beta-alanine';
UPDATE public.store_products SET image_url = '/images/store/rvit-citrulline-cola.png',                   images = ARRAY['/images/store/rvit-citrulline-cola.png']::text[],                   updated_at = now() WHERE slug = 'citrulline';
UPDATE public.store_products SET image_url = '/images/store/rvit-ashwagandha.png',                       images = ARRAY['/images/store/rvit-ashwagandha.png']::text[],                       updated_at = now() WHERE slug = 'ashwagandha';

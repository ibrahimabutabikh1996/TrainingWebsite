-- The flavours each product is sold in. The order route drops any flavour that
-- is not in this column, so a flavour shown on the page has to be listed here.
--
-- The names match the labels in src/lib/store/flavorImages.ts exactly: that is
-- how the product page finds each flavour's photo. The first one is the
-- product's main photo.
--
-- Before this ran, every row was empty except rice-carbs-pure ('موز') and
-- beta-alanine ('كولا'). Re-running it is harmless.

BEGIN;

UPDATE public.store_products SET flavors = ARRAY['كريمة الموز', 'شوكولاتة بالحليب', 'فانيليا كريمية', 'ميلك شيك الفراولة']::text[], updated_at = now() WHERE slug = 'ans-n-whey';
UPDATE public.store_products SET flavors = ARRAY['شوكولاتة', 'فانيليا', 'توت العليق', 'خبز الزنجبيل']::text[], updated_at = now() WHERE slug = 'protein-pancake-waffle';
UPDATE public.store_products SET flavors = ARRAY['كشمش أسود', 'برتقال', 'ليمون', 'علكة', 'حلوى مثلجة', 'بدون نكهة']::text[], updated_at = now() WHERE slug = 'rvit-creatine';
UPDATE public.store_products SET flavors = ARRAY['كشمش أسود', 'ليمون', 'فواكه مشكلة', 'فراولة وباشن فروت']::text[], updated_at = now() WHERE slug = 'lusty-preworkout';
UPDATE public.store_products SET flavors = ARRAY['فراولة', 'شوكولاتة', 'موز', 'كوكيز', 'كراميل مملح', 'خوخ', 'تشيز كيك بالبرتقال']::text[], updated_at = now() WHERE slug = 'vast-mass';
UPDATE public.store_products SET flavors = ARRAY['موز', 'شوكولاتة بالحليب', 'فراولة', 'فانيليا', 'تفاح وقرفة']::text[], updated_at = now() WHERE slug = 'rice-carbs-pure';
UPDATE public.store_products SET flavors = ARRAY['كولا', 'فراولة', 'بدون نكهة']::text[], updated_at = now() WHERE slug = 'beta-alanine';
UPDATE public.store_products SET flavors = ARRAY['كولا']::text[], updated_at = now() WHERE slug = 'citrulline';
UPDATE public.store_products SET flavors = ARRAY['بدون نكهة']::text[], updated_at = now() WHERE slug = 'ans-creatine';
UPDATE public.store_products SET flavors = ARRAY['بدون نكهة']::text[], updated_at = now() WHERE slug = 'ashwagandha';

COMMIT;

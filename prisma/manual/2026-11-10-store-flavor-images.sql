-- Each flavour's photo, moved out of src/lib/store/flavorImages.ts so the panel
-- can change it. `flavors` stays the list of what is on sale. An entry here
-- only gives one of those flavours its photo, matched by name. `fit` scales a
-- photo whose tub fills more of its frame, so the hero's row matches.
--
-- Run this BEFORE deploying the code that reads the column. A missing column
-- makes the storefront fall back to the sample catalogue. The column does
-- nothing to code that does not read it. Re-running it is harmless.

BEGIN;

ALTER TABLE public.store_products ADD COLUMN IF NOT EXISTS flavor_images jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.store_products SET flavor_images = '[{"label":"كريمة الموز","src":"/images/store/ans-n-whey-banana-cream.png"},{"label":"شوكولاتة بالحليب","src":"/images/store/ans-n-whey-milk-chocolate.png"},{"label":"فانيليا كريمية","src":"/images/store/ans-n-whey-creamy-vanilla.png"},{"label":"ميلك شيك الفراولة","src":"/images/store/ans-n-whey-strawberry-milkshake.png"}]'::jsonb, updated_at = now() WHERE slug = 'ans-n-whey';
UPDATE public.store_products SET flavor_images = '[{"label":"شوكولاتة","src":"/images/store/protein-pancake.webp"},{"label":"فانيليا","src":"/images/store/rvit-protein-pancake-waffle-3000g-vanilla.png"},{"label":"توت العليق","src":"/images/store/rvit-protein-pancake-waffle-3000g-raspberry.png"},{"label":"خبز الزنجبيل","src":"/images/store/rvit-protein-pancake-waffle-1200g-gingerbread.png","fit":0.88}]'::jsonb, updated_at = now() WHERE slug = 'protein-pancake-waffle';
UPDATE public.store_products SET flavor_images = '[{"label":"كشمش أسود","src":"/images/store/rvit-creatine-monohydrate-blackcurrant.png"},{"label":"برتقال","src":"/images/store/rvit-creatine-monohydrate-orange.png"},{"label":"ليمون","src":"/images/store/rvit-creatine-monohydrate-lemon.png"},{"label":"علكة","src":"/images/store/rvit-creatine-monohydrate-bubble-gum.png"},{"label":"حلوى مثلجة","src":"/images/store/rvit-creatine-monohydrate-ice-candy.png"},{"label":"بدون نكهة","src":"/images/store/rvit-creatine-monohydrate-neutral.png"}]'::jsonb, updated_at = now() WHERE slug = 'rvit-creatine';
UPDATE public.store_products SET flavor_images = '[{"label":"كشمش أسود","src":"/images/store/rvit-lusty-preworkout-blackcurrant.png"},{"label":"ليمون","src":"/images/store/rvit-lusty-preworkout-lemon.png"},{"label":"فواكه مشكلة","src":"/images/store/rvit-lusty-preworkout-multifruit.png"},{"label":"فراولة وباشن فروت","src":"/images/store/rvit-lusty-preworkout-strawberry-passion-fruit.png"}]'::jsonb, updated_at = now() WHERE slug = 'lusty-preworkout';
UPDATE public.store_products SET flavor_images = '[{"label":"فراولة","src":"/images/store/rvit-vast-mass-strawberry.png"},{"label":"شوكولاتة","src":"/images/store/rvit-vast-mass-chocolate.png"},{"label":"موز","src":"/images/store/rvit-vast-mass-banana.png"},{"label":"كوكيز","src":"/images/store/rvit-vast-mass-cookies.png"},{"label":"كراميل مملح","src":"/images/store/rvit-vast-mass-salted-caramel.png"},{"label":"خوخ","src":"/images/store/rvit-vast-mass-peach.png"},{"label":"تشيز كيك بالبرتقال","src":"/images/store/rvit-vast-mass-orange-cheesecake.png"}]'::jsonb, updated_at = now() WHERE slug = 'vast-mass';
UPDATE public.store_products SET flavor_images = '[{"label":"موز","src":"/images/store/rvit-rice-carbs-pure-banana.png"},{"label":"شوكولاتة بالحليب","src":"/images/store/rvit-rice-carbs-pure-milk-chocolate.png"},{"label":"فراولة","src":"/images/store/rvit-rice-carbs-pure-strawberry.png"},{"label":"فانيليا","src":"/images/store/rvit-rice-carbs-pure-vanilla.png"},{"label":"تفاح وقرفة","src":"/images/store/rvit-rice-carbs-pure-apple-cinnamon.png"}]'::jsonb, updated_at = now() WHERE slug = 'rice-carbs-pure';
UPDATE public.store_products SET flavor_images = '[{"label":"كولا","src":"/images/store/rvit-beta-alanine-cola.png"},{"label":"فراولة","src":"/images/store/rvit-beta-alanine-strawberry.png"},{"label":"بدون نكهة","src":"/images/store/rvit-beta-alanine-neutral.png"}]'::jsonb, updated_at = now() WHERE slug = 'beta-alanine';

COMMIT;

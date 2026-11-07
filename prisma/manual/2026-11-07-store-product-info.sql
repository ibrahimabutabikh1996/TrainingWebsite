-- The coach's corrected details for six store products.
--
-- 2026-11-04-store-v2.sql inserts the catalogue with ON CONFLICT DO NOTHING, so
-- editing it never reaches rows that already exist. This file overwrites the
-- written details of these six products — tagline, description, highlights,
-- features, usage, nutrition, ingredients, flavours, sizes and price — with the
-- coach's own. Everything the coach did not give (old flavours, ingredients,
-- usage steps, label facts) is cleared, because the coach said it was wrong.
--
-- Names, photos, brand, colour, stock and visibility are not touched.
-- Matches src/lib/store/seed.ts. Run AFTER 2026-11-04-store-v2.sql.
-- Re-running it is harmless: it sets the same values again.

UPDATE public.store_products SET
  tagline     = '22 غرام بروتين. 120 سعرة فقط.',
  description = 'بروتين واي يحتوي على 22 غرام بروتين في السكوب الواحد و120 سعرة فقط. مناسب لأنظمة التنشيف ونزول الوزن وحرق الدهون، ولبناء العضلات.',
  price       = 180000,
  highlights  = '[{"value":"22g","label":"بروتين بالسكوب"},{"value":"120","label":"سعرة بالسكوب"},{"value":"73","label":"حصة بالعلبة"},{"value":"2.27kg","label":"وزن العلبة"}]'::jsonb,
  features    = '[{"title":"للتنشيف ونزول الوزن","text":"بروتين عالٍ بسعرات قليلة، فيناسب أنظمة التنشيف ونزول الوزن وحرق الدهون."},{"title":"لبناء العضلات","text":"22 غرام بروتين في كل سكوب لدعم بناء العضلات."}]'::jsonb,
  usage       = '[]'::jsonb,
  nutrition   = '[{"label":"حجم الحصة","value":"سكوب واحد"},{"label":"البروتين","value":"22 غرام"},{"label":"السعرات","value":"120 سعرة"}]'::jsonb,
  ingredients = '',
  flavors     = '{}'::text[],
  sizes       = '[{"label":"2.27 كغ","price":180000}]'::jsonb,
  updated_at  = now()
WHERE slug = 'ans-n-whey';

UPDATE public.store_products SET
  tagline     = '777 سعرة. 42 غرام بروتين.',
  description = 'مكمل ماس عالي السعرات، يحتوي على 777 سعرة و42 غرام بروتين في الحصة الواحدة. يساعد على التضخيم وبناء العضلات، ومفيد جداً للمتدربين ذوي الأوزان القليلة ومن يعانون من قلة الشهية وصعوبة تحضير الوجبات. يدخل هذا المكمل ضمن نظام التضخيم.',
  price       = 95000,
  highlights  = '[{"value":"777","label":"سعرة بالحصة"},{"value":"42g","label":"بروتين بالحصة"},{"value":"15","label":"حصة بالعلبة"},{"value":"3kg","label":"وزن العلبة"}]'::jsonb,
  features    = '[{"title":"للتضخيم وبناء العضلات","text":"سعرات وبروتين عاليان يساعدان على التضخيم وبناء العضلات، ويدخل ضمن نظام التضخيم."},{"title":"لأصحاب الأوزان القليلة","text":"مفيد جداً لمن وزنه قليل ويعاني من قلة الشهية وصعوبة تحضير الوجبات."}]'::jsonb,
  usage       = '[]'::jsonb,
  nutrition   = '[{"label":"حجم الحصة","value":"4 سكوبات"},{"label":"السعرات","value":"777 سعرة"},{"label":"البروتين","value":"42 غرام"}]'::jsonb,
  ingredients = '',
  flavors     = '{}'::text[],
  sizes       = '[{"label":"3 كغ","price":95000}]'::jsonb,
  updated_at  = now()
WHERE slug = 'vast-mass';

UPDATE public.store_products SET
  tagline     = 'بانكيك صحي. عالي البروتين.',
  description = 'مكمل مميز جداً يساعدك على عمل بانكيك صحي وعالي البروتين. سهل التحضير، كل ما تحتاجه ماء ومقلاة للطبخ. مفيد لمن يعاني مع وجبة الفطور، ولمن يريد وجبة سهلة وصحية ولذيذة وعالية البروتين.',
  price       = 60000,
  highlights  = '[{"value":"13g","label":"بروتين بالحصة"},{"value":"181.8","label":"سعرة بالحصة"},{"value":"50g","label":"حجم الحصة"}]'::jsonb,
  features    = '[{"title":"سهل التحضير","text":"كل ما تحتاجه ماء ومقلاة للطبخ."},{"title":"حل لوجبة الفطور","text":"وجبة سهلة وصحية ولذيذة وعالية البروتين لمن يعاني مع وجبة الفطور."}]'::jsonb,
  usage       = '[]'::jsonb,
  nutrition   = '[{"label":"حجم الحصة","value":"50 غرام (4 سكوبات)"},{"label":"السعرات","value":"181.8 سعرة"},{"label":"البروتين","value":"13 غرام"}]'::jsonb,
  ingredients = '',
  flavors     = '{}'::text[],
  sizes       = '[{"label":"1.2 كغ","price":60000},{"label":"3 كغ","price":90000}]'::jsonb,
  updated_at  = now()
WHERE slug = 'protein-pancake-waffle';

UPDATE public.store_products SET
  tagline     = 'ضخ دم أكبر. تمرين أفضل.',
  description = 'من أفضل المكملات فعالية لزيادة ضخ الدم إلى العضلات. هذا التأثير يمنحك قوة أكبر أثناء التمرين، ويزيد حجم الأوردة فتظهر أكثر، ويزيد حجم الـ pump الذي يحدث أثناء التمرين. مكمل ممتاز للحصول على تجربة تمرين أفضل.',
  price       = 45000,
  highlights  = '[{"value":"3g","label":"سيترولين بالحصة"},{"value":"1","label":"سكوب للحصة"},{"value":"50","label":"حصة"}]'::jsonb,
  features    = '[{"title":"ضخ دم أكبر","text":"يزيد ضخ الدم إلى العضلات فيمنحك قوة أكبر أثناء التمرين."},{"title":"أوردة أوضح","text":"يزيد حجم الأوردة فتظهر أكثر."},{"title":"Pump أكبر","text":"يزيد حجم الـ pump الذي يحدث أثناء التمرين."}]'::jsonb,
  usage       = '[]'::jsonb,
  nutrition   = '[{"label":"حجم الحصة","value":"سكوب واحد"},{"label":"سيترولين","value":"3 غرام"}]'::jsonb,
  ingredients = '',
  flavors     = '{}'::text[],
  sizes       = '[{"label":"50 حصة","price":45000}]'::jsonb,
  updated_at  = now()
WHERE slug = 'citrulline';

UPDATE public.store_products SET
  tagline     = 'مدعوم بالعلم. سكوب واحد يومياً.',
  description = 'كرياتين مونوهيدرات من RVIT، من أفضل المكملات المدعومة بالعلم لتحسين الأداء. يساعد على زيادة حجم العضلات عن طريق زيادة نسبة الماء داخل العضلة، ويزيد القوة ويحسّن الأداء. كل ما تحتاجه 5 غرام يومياً، أي سكوب واحد من هذا المكمل يومياً يغطي احتياج جسمك من الكرياتين.',
  price       = 65000,
  highlights  = '[{"value":"5g","label":"يومياً"},{"value":"60","label":"حصة · غير مطعّم"},{"value":"50","label":"حصة · مطعّم"}]'::jsonb,
  features    = '[{"title":"حجم العضلات","text":"يزيد حجم العضلات عن طريق زيادة نسبة الماء داخل العضلة."},{"title":"قوة وأداء","text":"يساعد على زيادة القوة وتحسين الأداء."},{"title":"مدعوم بالعلم","text":"من أفضل المكملات المدعومة بالعلم لتحسين الأداء."}]'::jsonb,
  usage       = '["سكوب واحد (5 غرام) يومياً يغطي احتياج جسمك من الكرياتين."]'::jsonb,
  nutrition   = '[{"label":"حجم الحصة","value":"سكوب واحد"},{"label":"كرياتين مونوهيدرات","value":"5 غرام"}]'::jsonb,
  ingredients = '',
  flavors     = '{}'::text[],
  sizes       = '[{"label":"غير مطعّم · 60 حصة","price":65000},{"label":"مطعّم · 50 حصة","price":60000}]'::jsonb,
  updated_at  = now()
WHERE slug = 'rvit-creatine';

UPDATE public.store_products SET
  tagline     = 'طاقة عالية. تركيز أعلى.',
  description = 'مكمل طاقة عالي الكافيين، ممتاز للمساعدة على تحسين أداء التمرين وزيادة القوة والقدرة على حمل الأوزان، وزيادة التركيز في التمرين. تحتوي الحصة الواحدة على 300 ملغ كافيين، و5 غرام بيتا ألانين الذي يساعد على زيادة المطاولة أثناء التمارين الطويلة، و1 غرام إل-تايروسين الذي يساعدك على زيادة التركيز.',
  price       = 60000,
  highlights  = '[{"value":"300mg","label":"كافيين"},{"value":"5g","label":"بيتا ألانين"},{"value":"1g","label":"إل-تايروسين"},{"value":"30","label":"حصة"}]'::jsonb,
  features    = '[{"title":"طاقة وقوة","text":"كافيين عالٍ يحسّن أداء التمرين ويزيد القوة والقدرة على حمل الأوزان."},{"title":"مطاولة أطول","text":"البيتا ألانين يساعد على زيادة المطاولة أثناء التمارين الطويلة."},{"title":"تركيز أعلى","text":"الإل-تايروسين يساعدك على زيادة التركيز في التمرين."}]'::jsonb,
  usage       = '[]'::jsonb,
  nutrition   = '[{"label":"حجم الحصة","value":"2 سكوب"},{"label":"كافيين","value":"300 ملغ"},{"label":"بيتا ألانين","value":"5 غرام"},{"label":"إل-تايروسين","value":"1 غرام"}]'::jsonb,
  ingredients = '',
  flavors     = '{}'::text[],
  sizes       = '[{"label":"30 حصة","price":60000}]'::jsonb,
  updated_at  = now()
WHERE slug = 'lusty-preworkout';

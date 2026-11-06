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

-- The opening catalogue — the coach's real products, the same rows as
-- src/lib/store/seed.ts. Here rather than in 2026-11-04-store.sql because the
-- gallery column only exists from this file on. Prices are placeholders.
INSERT INTO public.store_products
  (slug, name, tagline, category, brand, description, price, compare_at_price,
   image_url, images, accent, highlights, features, usage, nutrition, ingredients,
   flavors, sizes, stock, low_stock_threshold, is_active, is_featured, sort_order)
VALUES
  ('ans-n-whey',
   'إن-واي بروتين',
   'واي فاخر. ثلاث مصادر نقية.',
   'protein',
   'ANS Performance',
   'بروتين مصل اللبن من ANS Performance الكندية، مزيج من ثلاثة مصادر واي عالية النقاء يمنح عضلاتك ما تحتاجه بعد التمرين. خالٍ من الغلوتين ومن المواد المحظورة، بطعم كريمة الموز.',
   95000,
   NULL,
   NULL,
   '{}'::text[],
   '#FBBF24',
   '[{"value":"22g","label":"بروتين بكل حصة"},{"value":"73","label":"حصة بالعلبة"},{"value":"100%","label":"واي بريميوم"}]'::jsonb,
   '[{"title":"ثلاثة مصادر واي","text":"مزيج من مصادر بروتين مصل اللبن عالية النقاء لبناء العضلة واستشفائها."},{"title":"خالٍ من الغلوتين","text":"مناسب لمن يتجنّب الغلوتين، وخالٍ من المواد المحظورة رياضياً."}]'::jsonb,
   '["أضف سكوب واحد إلى 250 مل ماء أو حليب.","رجّ جيداً حتى يذوب تماماً.","تناوله بعد التمرين أو بين الوجبات."]'::jsonb,
   '[{"label":"البروتين","value":"22 غرام"}]'::jsonb,
   '',
   ARRAY['كريمة الموز']::text[],
   '[{"label":"2.27 كغ (5 باوند)","price":95000}]'::jsonb,
   20,
   5,
   true,
   true,
   1),
  ('protein-pancake-waffle',
   'بروتين بانكيك ووافل',
   'فطور بروتين. بدون سكر مضاف.',
   'protein',
   'RVIT',
   'خليط بانكيك ووافل غني ببروتين مصل اللبن المركّز، بدون سكر مضاف. وجبة فطور سريعة وصحية، أو سناك بعد التمرين يرفع بروتينك اليومي بطعم تحبه.',
   40000,
   NULL,
   '/images/store/protein-pancake.webp',
   ARRAY['/images/store/protein-pancake.webp']::text[],
   '#F59E0B',
   '[{"value":"WPC","label":"بروتين واي مركّز"},{"value":"0","label":"سكر مضاف"}]'::jsonb,
   '[{"title":"بروتين عالي","text":"مدعّم ببروتين مصل اللبن المركّز لدعم بناء العضلة والاستشفاء."},{"title":"بدون سكر مضاف","text":"خيار مناسب لفترات التنشيف ولمن يراقب السكر."},{"title":"سناك مثالي","text":"بانكيك أو وافل خلال دقائق، وأضف عليه الفواكه أو العسل أو زبدة الفستق."}]'::jsonb,
   '["اخلط 50 غرام (4 سكوبات) مع 50 مل ماء بارد.","اسكب الخليط على مقلاة ساخنة مدهونة قليلاً.","اقلبه على نار متوسطة حتى يتحمّر الوجهان."]'::jsonb,
   '[{"label":"حجم الحصة","value":"50 غرام"}]'::jsonb,
   'طحين القمح، بروتين مصل اللبن المركّز، دقيق الشوفان، حليب كامل الدسم مجفف، نكهات.',
   ARRAY['شوكولاتة']::text[],
   '[]'::jsonb,
   20,
   5,
   true,
   false,
   2),
  ('ans-creatine',
   'كرياتين مونوهيدرات نقي',
   'قوة إضافية. بكل عدّة.',
   'creatine',
   'ANS Performance',
   'كرياتين مونوهيدرات ميكروني نقي من ANS Performance، 5000 ملغ بكل حصة. أكثر مكمل مدروس علمياً لزيادة القوة والطاقة العضلية. بلا نكهة، يُخلط مع أي مشروب.',
   40000,
   NULL,
   '/images/store/ans-creatine.webp',
   ARRAY['/images/store/ans-creatine.webp']::text[],
   '#22D3EE',
   '[{"value":"5g","label":"بكل حصة"},{"value":"60","label":"حصة"},{"value":"300g","label":"صافي الوزن"},{"value":"0","label":"نكهات مضافة"}]'::jsonb,
   '[{"title":"يبني القوة والعضلة","text":"يرفع مخزون الطاقة السريعة في العضلة، فتكسب عدّات إضافية في كل مجموعة."},{"title":"ميكروني","text":"جزيئات دقيقة تذوب بسهولة وتُمتص بشكل أفضل."},{"title":"بلا نكهة","text":"أضفه للبروتين أو العصير أو الماء — لا يغيّر الطعم."}]'::jsonb,
   '["5 غرام يومياً مع كوب ماء أو عصير.","يُفضّل بعد التمرين، وفي أيام الراحة بأي وقت.","اشرب ماء كافياً خلال اليوم."]'::jsonb,
   '[{"label":"حجم الحصة","value":"5 غرام"},{"label":"كرياتين مونوهيدرات","value":"5000 ملغ"}]'::jsonb,
   'كرياتين مونوهيدرات ميكروني 100%.',
   '{}'::text[],
   '[{"label":"300 غرام","price":40000}]'::jsonb,
   30,
   5,
   true,
   true,
   3),
  ('rvit-creatine',
   'كرياتين مونوهيدرات ميكرونايزد',
   'أداء أعلى. بطعم الكشمش.',
   'creatine',
   'RVIT',
   'كرياتين مونوهيدرات ميكروني من RVIT بنكهة الكشمش الأسود، يرفع القوة والأداء في التمارين القصيرة عالية الشدة. بودرة سهلة الذوبان تشربها قبل التمرين.',
   35000,
   NULL,
   '/images/store/rvit-creatine.webp',
   ARRAY['/images/store/rvit-creatine.webp', '/images/store/rvit-creatine-2.webp', '/images/store/rvit-creatine-3.webp']::text[],
   '#A78BFA',
   '[{"value":"6g","label":"سكوب واحد"},{"value":"50","label":"حصة"},{"value":"300g","label":"صافي الوزن"}]'::jsonb,
   '[{"title":"قوة وانفجارية","text":"يزيد الأداء البدني في التمارين القصيرة عالية الشدة."},{"title":"ميكروني","text":"جزيئات دقيقة تذوب بسرعة في الماء بلا تكتّل."},{"title":"نكهة منعشة","text":"طعم الكشمش الأسود يخلّي الجرعة اليومية أسهل."}]'::jsonb,
   '["أذب 6 غرام (سكوب واحد) في 250 مل ماء.","مرة واحدة يومياً قبل التمرين.","لا تتجاوز الجرعة اليومية الموصى بها."]'::jsonb,
   '[{"label":"حجم الحصة","value":"6 غرام"}]'::jsonb,
   'كرياتين مونوهيدرات، منظّم حموضة، نكهات، محلّيات.',
   ARRAY['كشمش أسود']::text[],
   '[{"label":"300 غرام","price":35000}]'::jsonb,
   30,
   5,
   true,
   false,
   4),
  ('lusty-preworkout',
   'لاستي بري وركاوت',
   'طاقة لا تتوقف. من أول مجموعة.',
   'preworkout',
   'RVIT',
   'بري وركاوت متكامل من RVIT بنكهة الكشمش الأسود. يجمع البيتا ألانين والتايروسين والكافيين مع الكرياتين، ليمنحك طاقة وتحمّل أعلى ويطوّل تمرينك.',
   55000,
   NULL,
   '/images/store/lusty-preworkout.webp',
   ARRAY['/images/store/lusty-preworkout.webp', '/images/store/lusty-preworkout-2.webp', '/images/store/lusty-preworkout-3.webp']::text[],
   '#818CF8',
   '[{"value":"5000mg","label":"بيتا ألانين"},{"value":"1000mg","label":"إل-تايروسين"},{"value":"300mg","label":"كافيين"},{"value":"420g","label":"صافي الوزن"}]'::jsonb,
   '[{"title":"طاقة وتحمّل","text":"الكافيين يرفع الطاقة والتحمّل حتى تكمل تمرينك بقوة."},{"title":"تأخير التعب","text":"البيتا ألانين يؤخّر الإرهاق العضلي ويطوّل وقت التمرين."},{"title":"قوة وأداء","text":"الكرياتين يرفع الأداء في المجاميع القصيرة عالية الشدة."}]'::jsonb,
   '["أذب سكوبين (14 غرام) في 200 مل ماء.","مرة واحدة يومياً قبل التمرين.","لا تتجاوز الجرعة، ولا تتناوله قبل النوم."]'::jsonb,
   '[{"label":"حجم الحصة","value":"14 غرام"},{"label":"بيتا ألانين","value":"5000 ملغ"},{"label":"إل-تايروسين","value":"1000 ملغ"},{"label":"كافيين","value":"300 ملغ"}]'::jsonb,
   'بيتا ألانين، كرياتين مونوهيدرات، إل-تايروسين، كافيين، فيتامينات ومعادن، نكهات، محلّيات.',
   ARRAY['كشمش أسود']::text[],
   '[{"label":"420 غرام","price":55000}]'::jsonb,
   20,
   5,
   true,
   true,
   5),
  ('vast-mass',
   'فاست ماس',
   'حجم حقيقي. سعرات ذكية.',
   'gainer',
   'RVIT',
   'ماس جينر من RVIT أساسه بروتين الواي المركّز والكربوهيدرات المعقّدة. مثالي لمن يصعب عليه زيادة الوزن، أو من يحتاج وجبة بديلة عالية البروتين، بطعم الفراولة.',
   75000,
   NULL,
   '/images/store/vast-mass.webp',
   ARRAY['/images/store/vast-mass.webp', '/images/store/vast-mass-2.webp']::text[],
   '#F87171',
   '[{"value":"42g","label":"بروتين واي"},{"value":"144g","label":"كربوهيدرات"},{"value":"2.3g","label":"دهون فقط"},{"value":"3kg","label":"صافي الوزن"}]'::jsonb,
   '[{"title":"بروتين واي مركّز","text":"مصدر بروتين عالي الجودة يدعم نمو العضلة والمحافظة عليها."},{"title":"كربوهيدرات معقّدة","text":"طاقة مستمرة للتمرين وتعويض مخزون العضلة بعده."},{"title":"وجبة بديلة","text":"حل عملي لرفع سعراتك وبروتينك اليومي خلال فترة التضخيم."}]'::jsonb,
   '["أذب 200 غرام (4 سكوبات) في 400 مل ماء أو حليب.","مرة واحدة يومياً بين الوجبات أو بعد التمرين.","يمكن تقسيم الحصة لنصفين خلال اليوم."]'::jsonb,
   '[{"label":"حجم الحصة","value":"200 غرام"},{"label":"البروتين","value":"42 غرام"},{"label":"الكربوهيدرات","value":"144 غرام"},{"label":"الدهون","value":"2.3 غرام"}]'::jsonb,
   'مالتوديكسترين، بروتين مصل اللبن المركّز، لبن رائب مجفف، نكهات، محلّيات.',
   ARRAY['فراولة']::text[],
   '[{"label":"3 كغ","price":75000}]'::jsonb,
   15,
   5,
   true,
   true,
   6),
  ('rice-carbs-pure',
   'رايس كاربز بيور',
   'كربوهيدرات نظيفة. استشفاء أسرع.',
   'gainer',
   'RVIT',
   'بودرة كريمة الرز من RVIT، مصدر غني بالكربوهيدرات المعقّدة من طحين الرز (96%). تعوّض مخزون الجلايكوجين بعد التمرين الشاق وتساعد العضلة تسترجع، بطعم الموز.',
   35000,
   NULL,
   '/images/store/rice-carbs-pure.webp',
   ARRAY['/images/store/rice-carbs-pure.webp']::text[],
   '#FACC15',
   '[{"value":"22g","label":"كربوهيدرات"},{"value":"2.4g","label":"بروتين"},{"value":"102","label":"سعرة بالحصة"},{"value":"2kg","label":"صافي الوزن"}]'::jsonb,
   '[{"title":"كربوهيدرات معقّدة","text":"من طحين الرز، تعوّض الجلايكوجين في العضلة وتقلل التعب."},{"title":"استشفاء العضلة","text":"تساعد على استعادة الوظيفة الطبيعية للعضلة بعد التمرين الطويل أو الشاق."},{"title":"تحضير سريع","text":"أضف الماء المغلي وحرّك — حلى كريمي جاهز خلال ثوانٍ."}]'::jsonb,
   '["اسكب 200 مل ماء مغلي في كوب أو صحن.","أضف سكوب واحد مستوٍ (30 غرام).","حرّك بقوة وتناوله بعد التمرين."]'::jsonb,
   '[{"label":"حجم الحصة","value":"30 غرام"},{"label":"السعرات","value":"102"},{"label":"الكربوهيدرات","value":"22 غرام"},{"label":"البروتين","value":"2.4 غرام"}]'::jsonb,
   'طحين الرز 96%، قرفة مطحونة، نكهات، محلّيات (أسيسلفام البوتاسيوم والسكرالوز)، حمض الستريك، كاروتين.',
   ARRAY['موز']::text[],
   '[{"label":"2 كغ","price":35000}]'::jsonb,
   20,
   5,
   true,
   false,
   7),
  ('beta-alanine',
   'بيتا ألانين',
   'تحمّل أعلى. تعب أقل.',
   'aminos',
   'RVIT',
   'بيتا ألانين من RVIT بنكهة الكولا. حمض أميني يحسّن انقباض العضلة والتحمّل، يقلل الإرهاق العضلي ويخلّيك تكمل تمرينك بشدة أعلى.',
   45000,
   NULL,
   '/images/store/beta-alanine.webp',
   ARRAY['/images/store/beta-alanine.webp', '/images/store/beta-alanine-2.webp', '/images/store/beta-alanine-3.webp']::text[],
   '#F97316',
   '[{"value":"7g","label":"سكوب واحد"},{"value":"60","label":"حصة"},{"value":"420g","label":"صافي الوزن"}]'::jsonb,
   '[{"title":"قوة وتحمّل","text":"يدعم انقباض العضلة ويرفع التحمّل البدني."},{"title":"تعب أقل","text":"يقلل الإرهاق العضلي في التمارين الشديدة."},{"title":"مضاد أكسدة","text":"يساعد على تقليل الإجهاد التأكسدي أثناء النشاط البدني."}]'::jsonb,
   '["أذب 7 غرام (سكوب واحد) في 200–250 مل ماء.","لا تتجاوز الجرعة اليومية الموصى بها.","الإحساس بالوخز طبيعي ومصدره البيتا ألانين."]'::jsonb,
   '[{"label":"حجم الحصة","value":"7 غرام"}]'::jsonb,
   'بيتا ألانين، مالتوديكسترين، نكهة، مانع تكتّل، محلّيات (أسيسلفام البوتاسيوم والأسبارتام). يحتوي على مصدر للفينيل ألانين.',
   ARRAY['كولا']::text[],
   '[{"label":"420 غرام","price":45000}]'::jsonb,
   20,
   5,
   true,
   false,
   8),
  ('citrulline',
   'سيترولين',
   'ضخ عضلي. دم يتدفّق.',
   'aminos',
   'RVIT',
   'سيترولين مالات من RVIT بنكهة الكولا، 3 غرام سيترولين بكل حصة. يرفع أكسيد النيتريك فيتحسّن تدفّق الدم والضخ العضلي والتحمّل أثناء التمرين.',
   35000,
   NULL,
   '/images/store/citrulline.webp',
   ARRAY['/images/store/citrulline.webp', '/images/store/citrulline-2.webp', '/images/store/citrulline-3.webp']::text[],
   '#FB923C',
   '[{"value":"3g","label":"سيترولين بالحصة"},{"value":"50","label":"حصة"},{"value":"300g","label":"صافي الوزن"}]'::jsonb,
   '[{"title":"ضخ عضلي","text":"يرفع أكسيد النيتريك فيتحسّن تدفّق الدم والامتلاء أثناء التمرين."},{"title":"طاقة وقوة","text":"يدعم مستويات الطاقة والقوة في تمارين الحديد والتحمّل."},{"title":"استشفاء","text":"يساعد على استشفاء العضلة وتحمّلها."}]'::jsonb,
   '["أذب 6 غرام (سكوب واحد) في 250 مل ماء.","مرة واحدة يومياً، ويُفضّل قبل التمرين.","لا تتجاوز الجرعة اليومية الموصى بها."]'::jsonb,
   '[{"label":"حجم الحصة","value":"6 غرام"},{"label":"سيترولين","value":"3 غرام"}]'::jsonb,
   'سيترولين مالات، نكهة الكولا، محلّيات.',
   ARRAY['كولا']::text[],
   '[{"label":"300 غرام","price":35000}]'::jsonb,
   20,
   5,
   true,
   false,
   9),
  ('ashwagandha',
   'أشواغاندا',
   'توازن. طاقة. هدوء.',
   'vitamins',
   'RVIT',
   'مستخلص جذر الأشواغاندا من RVIT بتركيز 7% ويثانوليدات. عشبة متكيّفة تدعم المناعة والطاقة والحيوية، وتساعد الجسم على مقاومة التوتر والإجهاد.',
   25000,
   NULL,
   '/images/store/ashwagandha.webp',
   ARRAY['/images/store/ashwagandha.webp', '/images/store/ashwagandha-2.webp', '/images/store/ashwagandha-3.webp']::text[],
   '#4ADE80',
   '[{"value":"7%","label":"ويثانوليدات"},{"value":"60","label":"كبسولة"},{"value":"1","label":"كبسولة يومياً"}]'::jsonb,
   '[{"title":"مضاد للتوتر","text":"عشبة متكيّفة تساعد الجسم على التعامل مع الضغط والإجهاد."},{"title":"طاقة وحيوية","text":"ترفع مستوى الطاقة وتدعم التركيز خلال اليوم."},{"title":"مناعة ومضاد أكسدة","text":"تدعم جهاز المناعة وتحمي الخلايا من الجذور الحرة."}]'::jsonb,
   '["كبسولة واحدة يومياً، ويُفضّل قبل النوم.","لا تتجاوز الجرعة اليومية الموصى بها."]'::jsonb,
   '[{"label":"مستخلص جذر الأشواغاندا","value":"7% ويثانوليدات"}]'::jsonb,
   'مستخلص جذر الأشواغاندا (Withania somnifera)، غلاف الكبسولة.',
   '{}'::text[],
   '[{"label":"60 كبسولة","price":25000}]'::jsonb,
   30,
   5,
   true,
   false,
   10)
ON CONFLICT (slug) DO NOTHING;

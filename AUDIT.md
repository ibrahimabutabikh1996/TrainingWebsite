# تقرير فحص المشروع

**المشروع:** `gym-website` — Next.js 16.3.3 / React 19.2.8 / Prisma 7.10 (adapter-pg) / Supabase Storage
**تاريخ الفحص:** 2026-09-07 · الفرع `main` · آخر commit `db3b735`
**وضع الفحص:** قراءة فقط. لم يُعدَّل أي ملف باستثناء هذا التقرير.

## ما تم التحقق منه فعلياً

| الفحص | النتيجة |
|---|---|
| `npx tsc --noEmit` | نظيف تماماً — لا أخطاء أنواع |
| `npx eslint .` | نظيف تماماً — لا تحذيرات |
| بحث عن أسرار في الملفات المتتبَّعة بـ git (317 ملفاً) | لا شيء. `.env` غير متتبَّع، و`SUPABASE_SERVICE_ROLE_KEY` محصور خلف `import "server-only"` |
| كل استعلامات SQL الخام (7 مواضع) | كلها Prisma tagged templates بمعاملات — **لا حقن SQL** |
| `dangerouslySetInnerHTML` / `innerHTML` | 3 مواضع، جميعها نصوص ثابتة في الكود — لا مدخلات مستخدم |
| حرّاس الصلاحيات على كل `"use server"` و كل صفحة `/admin` | موجودة كلها بلا استثناء (فُحص كل ملف واحداً واحداً) |
| `npm audit --omit=dev` | 4 ثغرات (2 عالية، 2 متوسطة) — التفاصيل في البند 9 |

**البنية العامة سليمة ومدروسة:** الجلسة موقّعة httpOnly، هناك طبقة `sessionRefusal` للإبطال، تحديد معدّل ببُعدين في Postgres، فحص الملفات المرفوعة من البايتات نفسها لا من الاسم، CSP كاملة + HSTS + `frame-ancestors 'none'`. أغلب ما وجدته أدناه هو **بقايا غير مكتملة** من عمليات إصلاح سابقة، لا ثغرات معمارية.

---

# أولاً: أخطاء تسبب أعطالاً فعلية

## 1. حذف المرفقات لا يحذف أي ملف من التخزين إطلاقاً ⛔

**الملف:** [src/app/admin/profile/actions.ts:80](src/app/admin/profile/actions.ts:80) — دالة `removeFromStorage`

```ts
async function removeFromStorage(url: string): Promise<void> {
  const path = storagePathOf(url);
  if (!path) return;          // ← يخرج دائماً في الوضع الحالي
  ...
}
```

**المشكلة:**
`storagePathOf` معرَّفة في [src/lib/supabaseAdmin.ts:57](src/lib/supabaseAdmin.ts:57) ولا تتعرّف إلا على **عناوين URL عامة كاملة** تحتوي على `/storage/v1/object/public/<bucket>/`.

لكن القيم المخزَّنة اليوم في `profiles.data` ليست عناوين URL، بل **مسارات نسبية داخل الـ bucket** بالشكل `usersData/<sessionId>/<field>_<random>` — يبنيها `issueSlot` في [src/lib/uploadSessions.ts:224](src/lib/uploadSessions.ts:224) ويعيدها `confirmedPathsFor` إلى `/api/submit-form`. وقد تم ترحيل الصفوف القديمة إلى هذا الشكل عمداً عبر `scripts/normalize-attachment-urls.mjs`.

النتيجة: `storagePathOf` تُعيد `null` للمسار النسبي، فتخرج `removeFromStorage` قبل أن تلمس التخزين. **الثلاث عمليات تتأثر:**

| العملية | الموضع | النتيجة الفعلية |
|---|---|---|
| `deleteAttachmentAction` | [actions.ts:155](src/app/admin/profile/actions.ts:155) | يُحذف المرجع من قاعدة البيانات، ويبقى الملف في الـ bucket |
| `deleteAllAttachmentsAction` | [actions.ts:209](src/app/admin/profile/actions.ts:209) | نفس الشيء لكل مرفقات الشهر |
| `deleteSubscriberAction` | [actions.ts:316](src/app/admin/profile/actions.ts:316) | يُحذف المشترك، وتبقى وصولات الدفع وصور الجسم والتحاليل الطبية في التخزين |

**لماذا هي حرجة وليست متوسطة:** بعد `deleteSubscriberAction` تحديداً، حذف صف `profiles` يُسقِط بالتتابع `upload_sessions` ثم `upload_items` (تم التحقق: `onDelete: Cascade` في [prisma/schema.prisma:815](prisma/schema.prisma:815) و[842](prisma/schema.prisma:842)). ومكنسة التنظيف `scripts/cleanup-uploads.mjs` تعمل بربط `upload_items` مع `upload_sessions` — فلا صف يدلّها على الملف. **الملفات تصبح يتيمة نهائياً ولا يوجد أي مسار في المشروع قادر على إزالتها بعد ذلك.** والوعد المكتوب في تعليق الملف نفسه — «"Permanently" means both halves» — غير صحيح.

هذا يعني أن بيانات صحية شخصية لمشترك طلب حذفه تبقى في المخزن إلى الأبد.

* **الخطورة:** حرجة
* **صعوبة الإصلاح:** منخفضة إلى متوسطة — الحل هو قبول المسار النسبي (`isStoragePath` موجودة أصلاً في [src/lib/attachments.ts:117](src/lib/attachments.ts:117)) قبل السقوط إلى `storagePathOf`. يحتاج أيضاً قراراً عن الـ bucket الصحيح. الجزء الأصعب هو تنظيف الملفات اليتيمة الموجودة بالفعل، وهو عمل منفصل.

---

## 2. `courseId` من المتصفح يُكتب في السجل رغم أن التعليق يقول العكس

**الملف:** [src/app/api/workout-logs/route.ts:140](src/app/api/workout-logs/route.ts:140)

```ts
/* Trust the profile's own course over anything the client sends. */
const resolvedCourseId =
  courseId && isValidUUID(courseId) ? courseId : profile.current_course_id;
```

**المشكلة:** التعليق يصف السلوك المعاكس تماماً لما يفعله الكود. الشرط الثلاثي يُفضّل `courseId` القادم من جسم الطلب، ولا يسقط إلى كورس الملف الشخصي إلا إذا كان القادم غائباً أو ليس UUID. لا يوجد أي فحص لملكية هذا الكورس.

`workout_logs.course_id` عليه مفتاح أجنبي إلى `courses` (تم التحقق: [prisma/schema.prisma:626](prisma/schema.prisma:626)). فهناك فشلان مختلفان:

1. UUID صحيح الشكل لكورس **غير موجود** → انتهاك FK (P2003) → استثناء غير معالَج → استجابة 500 «حدث خطأ داخلي في الخادم» لتسجيل وزن سليم تماماً.
2. UUID لكورس **موجود يخصّ متدرباً آخر** → يُقبَل ويُكتب. يفسد نسبة السجل إلى الكورس في تاريخ المدرب.

* **الخطورة:** متوسطة (الحالة 1 عطل مرئي للمستخدم؛ الحالة 2 فساد بيانات صامت)
* **صعوبة الإصلاح:** منخفضة جداً — سطر واحد، والتعليق فوقه يصف الحل بالفعل.

---

## 3. `/api/admin/change-password` يمرّر مدخلاً غير نصّي إلى bcrypt

**الملف:** [src/app/api/admin/change-password/route.ts:23](src/app/api/admin/change-password/route.ts:23)

```ts
if (newPassword.length < 8) { ... }
```

**المشكلة:** `newPassword` لم يُفحص نوعه. إذا وصل رقماً أو كائناً، فـ `.length` تساوي `undefined`، و`undefined < 8` تساوي `false` — يمرّ الفحص، ثم يصل `hashPassword(newPassword)` إلى bcrypt الذي يرمي استثناءً → 500.

هذا **بالضبط** الخطأ الذي أُصلح في المسار الشقيق ووُثِّق هناك صراحةً: [src/app/api/admin/create-account/route.ts:92-101](src/app/api/admin/create-account/route.ts:92) يقول «`password.length` was also read off whatever arrived: a number has no `length`, `undefined < 8` is false, and it went through to bcrypt». المسار هذا لم يُصلَح معه.

مشكلتان ثانويتان في نفس الملف:
* لا يوجد حدّ أعلى للطول (`MAX_PASSWORD_LENGTH` موجود في `@/lib/auth` وغير مستعمل هنا).
* `profileId` غير مفحوص كـ UUID → Prisma ترمي P2023 على عمود `uuid` → 500 بدل 400. (مسار `renew-account` يفحصه ويشرح السبب في [renew-account/route.ts:297](src/app/api/admin/renew-account/route.ts:297)؛ هذا لا.)

* **الخطورة:** متوسطة
* **صعوبة الإصلاح:** منخفضة — استبدال الفحص بـ `credentialError` أو `typeof newPassword !== "string"` + فحص UUID.

---

## 4. `home_equipment_photo` لا يمكن حذفه ولا يُحذف مع المشترك

**الملفات:**
* [src/app/admin/profile/attachments.ts:460](src/app/admin/profile/attachments.ts:460) — `ATTACHMENT_FIELDS`
* [src/lib/uploadFields.ts:32](src/lib/uploadFields.ts:32) — `INTAKE_UPLOAD_FIELDS`

**المشكلة:** `INTAKE_UPLOAD_FIELDS` تعدّ ستة حقول رفع: `payment_receipt`, `analysis_file`, `supplements_photo`, **`home_equipment_photo`**, `diet_history_file`, `body_photos`.

بينما `ATTACHMENT_FIELDS` — القائمة التي تحكم الحذف — تعدّ خمسة فقط، ينقصها `home_equipment_photo`.

النتيجة: `allAttachmentUrls` لا ترى هذا الحقل، و`deleteAllAttachmentsAction` لا تمسحه، و`deleteSubscriberAction` لا تُدرج ملفه في قائمة الحذف. الزر يقول «تم الحذف» وصورة معدات المنزل باقية في الملف وفي التخزين.

(للعلم: قائمة ثالثة في [scripts/normalize-attachment-urls.mjs:33](scripts/normalize-attachment-urls.mjs:33) تحتوي `home_equipment_photo` ولا تحتوي `payment_receipt` — ثلاث قوائم، ثلاثة محتويات مختلفة. انظر البند 16.)

* **الخطورة:** متوسطة
* **صعوبة الإصلاح:** منخفضة جداً — إضافة عنصر واحد، أو الاشتقاق من `INTAKE_UPLOAD_FIELDS` مباشرة.

---

## 5. `GET /api/training-cycles` يكتب في قاعدة البيانات، ويكتب لحساب موقوف

**الملف:** [src/app/api/training-cycles/route.ts:248](src/app/api/training-cycles/route.ts:248)

```ts
const auth = await requireProfileAccess(profileId);
if (!auth.ok) return auth.response;
const current = await ensureCurrentCycle(profileId);   // ← تُنشئ صفوفاً
```

**المشكلة:** `ensureCurrentCycle` ([src/lib/trainingCycle.ts:75](src/lib/trainingCycle.ts:75)) تُنشئ صف `training_cycles` جديداً مع `days_count` صفاً في `training_sessions` عند الحاجة. أي أن طلب GET له أثر جانبي كتابي.

و`subscriptionBlock` — الحارس الذي يمنع الكتابة عن الحساب الموقوف أو المنتهي اشتراكه، والمطبَّق في `PATCH` ([route.ts:369](src/app/api/training-cycles/route.ts:369)) وفي `POST /api/workout-logs` ([route.ts:135](src/app/api/workout-logs/route.ts:135)) — **غير مطبَّق على GET**. فمجرد فتح متدرب موقوف لصفحته (أو المدرب لملفه) ينشئ له جولة تدريبية جديدة.

هذا لا يمنح المتدرب شيئاً يستطيع استعماله — الكتابة الفعلية للأوزان لا تزال محجوبة — لكنه يُلوّث السجل بجولات لم تحدث.

* **الخطورة:** بسيطة
* **صعوبة الإصلاح:** منخفضة، لكنها **قرار منتج وليس قراراً تقنياً**: هل ينبغي أن يرى الموقوف تاريخه القديم بلا إنشاء جولة جديدة؟ يحتاج رأيك قبل التنفيذ.

---

## 6. مسارات إدارية تردّ 500 على مدخل مشوَّه بدل 400

**المواضع:**
* [src/app/api/admin/exercises/route.ts:111](src/app/api/admin/exercises/route.ts:111) — `PUT`، `id` غير مفحوص كـ UUID
* [src/app/api/admin/exercises/route.ts:136](src/app/api/admin/exercises/route.ts:136) — `DELETE`، نفس الشيء
* [src/app/api/admin/suspend-account/route.ts:207](src/app/api/admin/suspend-account/route.ts:207) — `profileId` غير مفحوص
* [src/app/api/mark-read/route.ts:393](src/app/api/mark-read/route.ts:393) — `id` غير مفحوص

**المشكلة:** كل هذه الأعمدة من نوع `uuid`. Prisma ترمي P2023/P2007 على قيمة ليست UUID، والاستثناء يقع في الـ catch العام فيخرج 500 برسالة عامة. `DELETE` على معرّف غير موجود يرمي P2025 (سجل غير موجود) فيخرج 500 بدل 404.

مسار `renew-account` يفحص UUID ويشرح السبب بالتفصيل في تعليقه؛ البقية لم تُحدَّث معه.

* **الخطورة:** بسيطة (كلها خلف `requireAdmin`، فلا يصل إليها إلا المدرب — أثرها رسالة خطأ مضلِّلة، لا أكثر)
* **صعوبة الإصلاح:** منخفضة جداً

---

# ثانياً: ثغرات أمنية

## 7. المقارنة النصية للكلمة السرية ما زالت قائمة في مسارين

**الموضعان:**
* [src/app/api/auth/change-password/route.ts:266](src/app/api/auth/change-password/route.ts:266)
  ```ts
  } else {
    matches = (currentPassword === account.password);
  }
  ```
* [src/app/admin/profile/actions.ts:252](src/app/admin/profile/actions.ts:252)
  ```ts
  return submitted === account.password;
  ```

**المشكلة:** `/api/auth/login` أزال هذا الفرع بالكامل وسجّل قراره صراحةً في [login/route.ts:120-135](src/app/api/auth/login/route.ts:120): «A stored value that is not a bcrypt hash is no longer compared as a password… what is left is a refusal». المساران أعلاه لم يتبعا.

في صفٍّ لا يحمل تجزئة bcrypt، **القيمة المخزَّنة نفسها تصبح كلمة السر المقبولة**. وهذا يقع على:
* تغيير المستخدم لكلمة سره،
* و**تأكيد حذف مشترك نهائياً** — وهو الفعل الذي لا تراجع فيه، ويقول تعليقه بالحرف: «"Same rule as /api/auth/login" is now true rather than aspirational». لم يعد كذلك.

**حدّ الاستغلال:** تسجيل الدخول يرفض هذه الصفوف أصلاً، فلا يستطيع مهاجم خارجي فتح جلسة بها. الخطر يبقى في: صفّ قديم لحساب المدرب نفسه، أو جلسة مسروقة، أو تسريب لقاعدة البيانات.

**هل توجد صفوف كهذه فعلاً؟ لا — تحقّقنا (2026-09-07).** شغّل صاحب المشروع في Supabase:

```sql
SELECT count(*) FROM public.accounts WHERE password NOT LIKE '$2%';
```

والنتيجة **صفر**. فلا يوجد اليوم أي صفّ يستطيع فرع المقارنة النصية أن يقبله، ولا شيء في قاعدة البيانات يحتاج تنظيفاً أو إعادة تجزئة.

**ما يبقى بعد التحقق:** الفرع نفسه ما زال في الكود. أي صفّ يدخل مستقبلاً بقيمة غير bcrypt — استعادة نسخة احتياطية قديمة، إدخال يدوي، أو مسار كتابة يتخطى `hashPassword` — يعيد فتح الباب فوراً، وأخطر ما يحرسه هذا الفرع هو **تأكيد الحذف النهائي**. البند يبقى قائماً هنا بوصفه **إصلاحاً وقائياً**، لا ثغرة مفتوحة.

* **الخطورة:** ~~متوسطة~~ → **وقائية** (لا صفوف قابلة للاستغلال اليوم؛ الخطورة مشروطة بدخول صفّ غير مجزّأ مستقبلاً)
* **صعوبة الإصلاح:** منخفضة جداً — حذف فرع `else` في كليهما ورفض الصف كما يفعل تسجيل الدخول.

---

## 8. `/api/profile` هو القارئ الوحيد الذي لا يمرّ بمرشِّح الاعتمادات

**الملف:** [src/app/api/profile/route.ts:476](src/app/api/profile/route.ts:476) و[571](src/app/api/profile/route.ts:571)

```ts
const data = typeof profile.data === "string" ? JSON.parse(profile.data) : (profile.data || {});
...
raw_answers: data,   // الكتلة الخام كما هي
```

**المشكلة:** [src/lib/intakeData.ts:14](src/lib/intakeData.ts:14) يوصّف دفاعين: تجريد عند الكتابة، و«`withoutCredentials` is applied at **every read**, so a row written before this — or restored from an old backup — cannot leak either»، ويضيف أن «The read side is the one that matters most».

بحثت عن كل القرّاء. **خمسة منهم يمرّون بـ `readIntakeData`:**
`export-diet/page.tsx:81` · `export-profile/page.tsx:38` · `export-workout/page.tsx:112` · `AdminSubscriptionTimeline.tsx:41` · `submit-form/route.ts:297`

**وواحد لا يمرّ:** `/api/profile` — وهو القارئ الذي يذكره التعليق بالاسم («handed to the dashboard as `raw_answers`»).

فلو حمل صفٌّ قديم مفتاح `password` نصياً، يصل إلى المتصفح داخل `raw_answers`، وإلى المدرب أيضاً عبر `?userId=`. الوجهة هي صاحب الملف نفسه في الحالة الشائعة، فالتأثير محدود — لكن الدفاع المعلن مكسور في المكان الذي كُتب من أجله.

**وجود صفوف قديمة كهذه: لا — تحقّقنا (2026-09-07).** شغّل صاحب المشروع في Supabase:

```sql
SELECT count(*) FROM public.profiles WHERE data ? 'password';
```

والنتيجة **صفر**. فلا شيء يتسرّب اليوم عبر `raw_answers`، ويبدو أن التجريد عند الكتابة في `intakeData.ts` أدّى عمله على كل الصفوف الموجودة.

**ما يبقى بعد التحقق:** الدفاع الثاني المكتوب في التعليق صراحةً — «التجريد عند **كل** قراءة» — ما زال مكسوراً في القارئ الوحيد الذي يسمّيه التعليق بالاسم، وهو الدفاع الذي كُتب تحديداً لصفّ مستعاد من نسخة قديمة. البند يبقى قائماً هنا بوصفه **إصلاحاً وقائياً**، لا تسريباً جارياً.

* **الخطورة:** ~~متوسطة~~ → **وقائية** (لا صفوف مسرِّبة اليوم؛ الخطورة مشروطة بصفّ قديم يعود من نسخة احتياطية)
* **صعوبة الإصلاح:** منخفضة جداً — استبدال السطر باستدعاء `readIntakeData(profile.data)`.

---

## 9. اعتماديتان غير مستعملتين إحداهما تحمل ثغرة معلنة

**الملف:** [package.json:19-20](package.json:19)

```json
"docxtemplater": "^3.69.3",
"pizzip": "^3.2.0",
```

**التحقق:** بحثت عن `docxtemplater` و`pizzip` في `src/` و`scripts/` و`tests/` — **صفر إشارة** لكل منهما. وهما في `dependencies` لا `devDependencies`، أي يُشحنان إلى بيئة التشغيل.

`docxtemplater` يجرّ `@xmldom/xmldom@0.9.10` (تحقّقت بـ `npm ls`)، وعليه تنبيه بدرجة **moderate**:
`GHSA-6gmq-8vp8-gcm6` — XML fragment injection.

**نتيجة `npm audit` كاملة (4 ثغرات):**

| الحزمة | الدرجة | المسار | التقييم |
|---|---|---|---|
| `@xmldom/xmldom` | متوسطة | `docxtemplater` → runtime | **حقيقية وقابلة للإزالة بحذف اعتمادية ميتة** |
| `fast-uri` | عالية (SSRF) | `prisma` → `@prisma/dev` → `ajv` | أداة CLI فقط (`devDependencies`) — لا تصل إلى التشغيل |
| `mysql2` | عالية | `prisma` → `mysql2` | نفس الشيء — والمشروع يستعمل `pg` لا mysql |

* **الخطورة:** متوسطة لـ`docxtemplater`/`pizzip`؛ بسيطة للبقية
* **صعوبة الإصلاح:** منخفضة جداً — حذف السطرين. (تنبيه: `npm audit fix --force` سيهبط بـ Prisma إلى 6.19.3 — **لا تفعل ذلك**، فهو تغيير كاسر لعلاج ثغرة لا تلمس بيئة التشغيل.)

---

## 10. حذف من التخزين بلا فحص المسار — الموضع الوحيد الذي يفتقده

**الموضعان:**
* [src/lib/supabaseAdmin.ts:57](src/lib/supabaseAdmin.ts:57) — `storagePathOf` تُقطّع على العلامة ثم `decodeURIComponent` وتُعيد النتيجة مباشرة
* المستدعيان: [src/app/admin/cms/actions.ts:165](src/app/admin/cms/actions.ts:165) و[src/app/admin/profile/actions.ts:81](src/app/admin/profile/actions.ts:81) — كلاهما يمرّر الناتج إلى `supabaseAdmin.storage.remove()`

**المشكلة:** الدالة النظيرة في `attachments.ts` — `storagePathFromPublicUrl` [attachments.ts:217](src/lib/attachments.ts:217) و`pathAfterMarker` [attachments.ts:183](src/lib/attachments.ts:183) — تفحص البروتوكول والمضيف وتمرّر الناتج عبر `isStoragePath` (التي ترفض `..` و`//` و`%` والمحارف التحكمية). `storagePathOf` لا تفعل شيئاً من ذلك.

**حدّ الاستغلال ضيّق:** كلا المستدعيَين خلف `requireAdminAction`، فلا يصل إليهما إلا المدرب، ولا يوجد مصعّد صلاحيات هنا. لكن هذا هو الموضع الوحيد في المشروع الذي يتعامل مع مسار تخزين بلا الحارس الذي كُتب لهذا الغرض بالضبط.

* **الخطورة:** بسيطة
* **صعوبة الإصلاح:** منخفضة جداً — تمرير النتيجة عبر `isStoragePath` قبل إعادتها. (يتقاطع مع البند 1 و15 — يُفضَّل إصلاحها معاً.)

---

## 11. بيانات هوية شخصية مكتوبة داخل الكود

**الموضعان:**
* [src/lib/adminUsernames.ts:162](src/lib/adminUsernames.ts:162)
  ```ts
  export const ADMIN_USERNAMES: readonly string[] = ["admin", "mkm94admin", "ibrahimabutabikh1996@gmail.com"];
  ```
* [src/app/api/submit-form/route.ts](src/app/api/submit-form/route.ts) — سطر `to: "ibrahim1996.im@gmail.com"` داخل `sendMail`

**المشكلة:** ليست أسراراً — لكن `ADMIN_USERNAMES` هي **جدول الصلاحيات الفعلي للمشروع** (`isAdminUsername` تقرّر منها من يفتح لوحة المدرب)، وهي تعيش في الشيفرة المصدرية داخل مستودع git. الملف نفسه يوصّف هذا بدقة: «the names on that list are credentials in everything but name». إضافة أو إزالة مدرب تتطلب نشر إصدار جديد.

وعنوان إشعارات المشتركين مثبّت كذلك، فلا يمكن تغييره دون نشر.

* **الخطورة:** بسيطة (مسألة تشغيل ومرونة أكثر منها ثغرة)
* **صعوبة الإصلاح:** منخفضة إذا كان الحل متغيّر بيئة؛ متوسطة إذا كان عموداً في `accounts` — والملف يشرح لماذا أُجِّل ذلك عمداً.

---

## 12. ملاحظات أمنية للعلم — فُحصت ووُجدت مقبولة

هذه **ليست بنوداً للإصلاح**، أذكرها لأنها تبدو مريبة عند القراءة السريعة وقد فحصتها:

* **`clientAddress` يثق بـ`x-forwarded-for`** ([rateLimit.ts:347](src/lib/rateLimit.ts:347)) — العنوان قابل للتزوير، لكن كل نقطة نهاية تستهلك **مفتاحاً ثانياً** غير قابل للتدوير (اسم المستخدم، معرّف الملف، معرّف جلسة الرفع)، وهناك سقف عام لجلسات الرفع المجهولة. مصمَّم بوعي وموثَّق.
* **`/api/attachments` يفحص الملكية القديمة بـ`blob.includes(path)`** ([attachments/route.ts:98](src/app/api/attachments/route.ts:98)) — فحص خشن معترف به في التعليق، ولا يمنح إلا مساراً يذكره سجلّ المتدرب نفسه.
* **`getLandingContent` مكشوفة بلا حارس** ([cms/actions.ts:71](src/app/admin/cms/actions.ts:71)) — متعمَّد وموثَّق: تعيد محتوى الصفحة الرئيسية الذي يراه كل زائر.
* **CSP تسمح بـ`'unsafe-inline'` في `script-src`** ([next.config.ts:107](next.config.ts:107)) — ضروري لـ Next bootstrap، ولا يوجد `https:` ولا `unsafe-eval` في بناء الإنتاج، فلا يمكن تحميل نص برمجي خارجي.
* **`useWebWorker: true` مع CSP بلا `blob:`** ([imageUpload.ts:53](src/lib/imageUpload.ts:53)) — فحصت شيفرة `browser-image-compression` في `node_modules`: عندها ارتداد إلى الخيط الرئيسي عند فشل إنشاء الـ worker. **ليست عطلاً.**

---

# ثالثاً: كود ميت

كل بند أدناه بُحث عنه باسمه في `src/` و`tests/` و`scripts/` بالكامل، ونتيجة البحث مذكورة.

## 13. ملفان ميتان بالكامل

| الملف | الأسطر | نتيجة البحث |
|---|---|---|
| [src/components/admin/AdminWeightLogs.tsx](src/components/admin/AdminWeightLogs.tsx) | ~40 | `grep -rn "\bAdminWeightLogs\b" src tests scripts` → **إشارة واحدة فقط**، وهي سطر التعريف نفسه (:5). لا استيراد، لا استعمال JSX. |
| [src/components/dashboard/diet-plan.css](src/components/dashboard/diet-plan.css) | 336 | **صفر استيراد** — ليست في أي `import "...css"` في المشروع. وأصنافها الـ29 (`.dpv-*`) → `grep -rn "dpv-" src --include=*.tsx --include=*.ts` أعاد **صفر نتيجة**. الإشارة الوحيدة خارجه تعليق في [courses.css:453](src/app/admin/courses/courses.css:453). |

## 14. تصديرات لا يستدعيها شيء (13 تصديراً)

كل واحد منها: `grep -rhow <name> src tests scripts` أعاد **1** — أي سطر التعريف وحده.

| الاسم | الموضع |
|---|---|
| `ownProfileId` | [src/lib/authGuard.ts:312](src/lib/authGuard.ts:312) |
| `looksLikeAdmin` | [src/lib/clientSession.ts:42](src/lib/clientSession.ts:42) |
| `consumeAttempts` | [src/lib/rateLimit.ts:304](src/lib/rateLimit.ts:304) |
| `checkUploadGroup` | [src/lib/uploads.ts:188](src/lib/uploads.ts:188) |
| `INTAKE_TOTAL_BYTES` | [src/lib/uploads.ts:142](src/lib/uploads.ts:142) |
| `selectableDates` | [src/lib/trainingDates.ts:146](src/lib/trainingDates.ts:146) |
| `relativeDayLabel` | [src/lib/trainingDates.ts:165](src/lib/trainingDates.ts:165) |
| `WEEKDAY_PICKER_ORDER` | [src/lib/trainingDates.ts:68](src/lib/trainingDates.ts:68) |
| `planLabel` | [src/lib/formLabels.ts:106](src/lib/formLabels.ts:106) |
| `cardPrefix` | [src/lib/planCards.ts:123](src/lib/planCards.ts:123) |
| `planIdOf` | [src/lib/planCards.ts:270](src/lib/planCards.ts:270) |
| `CourseData` | [src/types/index.ts:59](src/types/index.ts:59) |
| `AdminWeightLogs` | [src/components/admin/AdminWeightLogs.tsx:5](src/components/admin/AdminWeightLogs.tsx:5) |

**تنبيه قبل الحذف:** `consumeAttempts` مكتوبة صراحةً كـ«shape, named, so the endpoints that were counting only an address can adopt it» — أي أنها واجهة مقصودة لم تُتبنَّ بعد. وثلاثة من `trainingDates` (`selectableDates`, `relativeDayLabel`, `WEEKDAY_PICKER_ORDER`) تخدم منتقي تاريخ يبدو أنه أُعيد بناؤه. **قرار حذفها قرارك لا قراري.**

* **الخطورة:** بسيطة (لا أثر تشغيلياً — الحزمة النهائية تُشذّب معظمها؛ الأثر تشويش على القارئ)
* **صعوبة الإصلاح:** منخفضة جداً

## 15. كتلتا CSS ميتتان في `crm.css`

انظر البند 17 — الكتلتان في الأسطر 522-582 و584-660 لا تصل إلى الشاشة إطلاقاً.

---

# رابعاً: تعارضات بين الملفات

## 16. ثوابت التخزين معرَّفة مرتين في وحدتين — وهي السبب الجذري للبند 1

| الثابت | التعريف الأول | التعريف الثاني |
|---|---|---|
| `STORAGE_PUBLIC_MARKER` | [supabaseAdmin.ts:43](src/lib/supabaseAdmin.ts:43) | [attachments.ts:94](src/lib/attachments.ts:94) |
| `uploads` (اسم الـ bucket) | `UPLOADS_BUCKET` — [supabaseAdmin.ts:37](src/lib/supabaseAdmin.ts:37) | `UPLOADS_BUCKET_NAME` — [attachments.ts:88](src/lib/attachments.ts:88) |
| `public-media` | `PUBLIC_MEDIA_BUCKET` — [supabaseAdmin.ts:40](src/lib/supabaseAdmin.ts:40) | `PUBLIC_MEDIA_BUCKET_NAME` — [attachments.ts:91](src/lib/attachments.ts:91) |
| العلامة القديمة | `LEGACY_PUBLIC_MARKER` (خاصة، :47) | `LEGACY_PUBLIC_MARKER` (مصدَّرة، :99) |

**لماذا هذا مهم وليس تكراراً تجميلياً:** الوحدتان تحتويان دالتَي تحويل عنوان→مسار متنافستين. نسخة `attachments.ts` تفهم المسارات النسبية وتتحقق منها؛ نسخة `supabaseAdmin.ts` لا تفهم إلا العناوين الكاملة ولا تتحقق. **البند 1 (حرج) والبند 10 كلاهما نتيجة مباشرة لاستدعاء النسخة الخاطئة.**

هناك أيضاً نسخة رابعة يدوية من `isStoragePath` في [scripts/normalize-attachment-urls.mjs:49](scripts/normalize-attachment-urls.mjs:49) مع تعليق «Mirrors isStoragePath in src/lib/attachments.ts. Keep the two in step.»

* **الخطورة:** متوسطة (بحدّ ذاته؛ أثره الفعلي حرج عبر البند 1)
* **صعوبة الإصلاح:** متوسطة — الدمج في وحدة واحدة يمسّ 6 ملفات. الحدّ الأدنى الآمن هو إصلاح البند 1 وحده أولاً.

## 17. `crm.css` — كتلة كاملة مكرَّرة حرفياً، وثالثة تنسخها

**الملف:** [src/app/admin/crm.css](src/app/admin/crm.css)

| المحدِّد | الأسطر |
|---|---|
| `.crm-btn-primary` | **523، 586، 849** (ثلاث مرات) |
| `.crm-btn-primary:hover` | 538، 601، 865 |
| `.crm-btn-primary:active` | 543، 606 |
| `.crm-btn-icon` | **547، 610، 889** (ثلاث مرات) |
| `.crm-btn-icon:hover` | 558، 621، 902 |
| `.crm-btn-whatsapp` | 564، 627 |
| `.crm-btn-whatsapp:hover` / `:active` | 575/581، 651/657 |

قارنت النصّ: **الأسطر 584-660 نسخة حرفية من 522-582** (بما فيها تعليق `/* Action Buttons */`)، مع فارق سطر واحد (`border-color` أضيف في الثانية).

ثم تأتي كتلة ثالثة مختلفة جوهرياً عند 845-905 وهي التي تفوز فعلياً (نفس الخصوصية، والأخير يغلب):

| الخاصية | الكتلتان 1 و2 (ميتتان) | الكتلة 3 (الفاعلة) |
|---|---|---|
| `.crm-btn-primary` لون النص | `var(--primary-on-tint)` | `var(--text-inverse)` |
| `.crm-btn-primary:hover` | `translateY(-1px)` + `box-shadow` | لا حركة، لون فقط |
| `.crm-btn-icon` | ممتلئ `--admin-bg-3` بحدود رمادية | شبح شفاف بحدود زرقاء |

الكتلة الفاعلة هي **الصحيحة** وفق `AGENTS.md` (الأزرار الأساسية تستعمل `--text-inverse` وبلا ظل). الكتلتان الميتتان تخالفانه. من يقرأ الملف من أعلى يظن أن الزرّ يرتفع عند المرور وهو لا يفعل.

* **الخطورة:** بسيطة (لا أثر بصري اليوم — الأثر هو أن أي تعديل على الكتلتين الأوليين لن يظهر، وهو مضيعة وقت مضمونة)
* **صعوبة الإصلاح:** منخفضة، لكن **تحتاج نظرة بصرية**: حذف الكتلتين يجب أن يسبقه تأكيد أن الكتلة الثالثة تغطّي كل مواضع الاستعمال.

## 18. أصناف متطابقة الاسم بين `globals.css` وأنماط الصفحات

`globals.css` مستورد في [layout.tsx:2](src/app/layout.tsx:2) أي أنه محمَّل على كل صفحة. هذه الأصناف معرَّفة فيه **وفي** نمط صفحة أيضاً، بنفس الخصوصية — فالفائز يُحسم بترتيب حزم CSS لا بقاعدة صريحة:

| الصنف | globals.css | الملف الآخر | الفرق الفعلي |
|---|---|---|---|
| `.water-btn` | [780](src/app/globals.css:780) | [dashboard.css:188](src/app/dashboard/dashboard.css:188) | **40px مقابل 44px** |
| `.water-glass` | globals | dashboard.css | — |
| `.stat-value` | [705](src/app/globals.css:705) | [dashboard.css:169](src/app/dashboard/dashboard.css:169) | وزن/لون/حجم/محاذاة |
| `.stat-row` · `.stat-label` | globals | dashboard.css | — |
| `.diet-header` | [716](src/app/globals.css:716) | [diet.css:36](src/app/admin/diet/diet.css:36) | `align-items` و`gap` و`padding` مختلفة |
| `.form-card` | [827](src/app/globals.css:827) | [login.css:143](src/app/login/login.css:143) | حشوة فقط مقابل بطاقة كاملة |
| `.ui-grid-2` · `.ui-grid-3` · `.ui-media-thumb` | [1223](src/app/globals.css:1223)، [1323](src/app/globals.css:1323) | cms.css | — |

الترتيب الحالي يجعل نمط الصفحة يغلب غالباً (وهو المقصود على الأرجح)، لكنه اعتماد على تفصيلٍ في مُجمِّع Next لا على قاعدة مكتوبة. `AGENTS.md` يحذّر من هذا الصنف تحديداً: «responsive overrides must match the base rule's specificity».

**هل يظهر خلل بصري اليوم؟ غير مؤكد** — يحتاج فحصاً في المتصفح لكل صفحة، ولم أستطع تشغيله (انظر آخر التقرير).

* **الخطورة:** بسيطة
* **صعوبة الإصلاح:** متوسطة — كل حالة قرار تصميمي منفصل، وليست تنظيفاً آلياً.

## 19. محدِّدات مكرَّرة داخل الملف الواحد

| الملف | المحدِّد | الأسطر |
|---|---|---|
| [landing.css](src/app/landing.css) | `.contact-inner` | 1095، 1693 |
| landing.css | `.coach-image-frame` | 1117، 1155 |
| landing.css | `.price-note` | 1439، 1451 |
| [dashboard.css](src/app/dashboard/dashboard.css) | `.dashboard-page` | 2، 514 |
| [crm.css](src/app/admin/crm.css) | `.admin-modal-foot` | 1044، 1052 |
| crm.css | `.crm-export-btn` | 287، 311 |
| [cms.css](src/app/admin/cms/cms.css) | `.cms-modal-btn-cancel` | 876، 897 |
| [diet.css](src/app/admin/diet/diet.css) | `.diet-btn-secondary` | 83، 120 |
| [plan.css](src/app/admin/diet/plan/plan.css) | `.dplan-note` | 264، 280 |
| [password.css](src/app/account/password/password.css) | `.pw-toggle` | 185، 202 |

بعضها قد يكون مقصوداً (تجاوز داخل استعلام وسائط)، لكن الأسطر أعلاه كلها في المستوى الأعلى.

* **الخطورة:** بسيطة · **صعوبة الإصلاح:** منخفضة، وتحتاج نظرة بصرية

## 20. متغيّرات الخط معرَّفة مرتين بنفس القيم في `globals.css`

**الملف:** [src/app/globals.css](src/app/globals.css) — كتلتا `:root` منفصلتان

* الأسطر **203-207** (داخل `:root` المفتوحة عند 94)
* الأسطر **459-463** (داخل `:root` ثانية تبدأ عند 458)

كلتاهما تُعرّفان `--font-primary`, `--font-display`, `--font-editorial`, `--font-arabic`, `--font-ar` بالقيمة `'Cairo', sans-serif` حرفياً.

بلا أثر تشغيلي (نفس القيمة)، لكنها تعني أن من يغيّر الخط في مكان واحد سيظنّ أنه غيّره — بينما التعريف الثاني (الأدنى) هو الفائز.

* **الخطورة:** بسيطة · **صعوبة الإصلاح:** منخفضة جداً

## 21. ثلاث قوائم لحقول المرفقات، بثلاثة محتويات

| المصدر | المحتوى |
|---|---|
| [uploadFields.ts:32](src/lib/uploadFields.ts:32) `INTAKE_UPLOAD_FIELDS` | payment_receipt, analysis_file, supplements_photo, **home_equipment_photo**, diet_history_file, body_photos |
| [attachments.ts:460](src/app/admin/profile/attachments.ts:460) `ATTACHMENT_FIELDS` | payment_receipt, analysis_file, supplements_photo, diet_history_file, body_photos — **ينقصه home_equipment_photo** |
| [normalize-attachment-urls.mjs:33](scripts/normalize-attachment-urls.mjs:33) `FIELDS` | analysis_file, supplements_photo, home_equipment_photo, diet_history_file, body_photos — **ينقصه payment_receipt** |

الأثر التشغيلي موصوف في البند 4.

* **الخطورة:** متوسطة (عبر البند 4) · **صعوبة الإصلاح:** منخفضة

## 22. تكرارات صغيرة متفرقة

* **حدّ طول كلمة السر مكتوب رقماً في ثلاثة أماكن** بدل استيراد `MIN_PASSWORD_LENGTH` من [auth.ts:17](src/lib/auth.ts:17):
  [auth/change-password/route.ts:195](src/app/api/auth/change-password/route.ts:195) · [admin/change-password/route.ts:23](src/app/api/admin/change-password/route.ts:23) · [account/password/page.tsx:20](src/app/account/password/page.tsx:20)
* **تعبير UUID النمطي منسوخ في 7 ملفات**: `api/live:214` · `api/workout-logs:11` · `api/training-cycles:224` · `api/admin/renew-account:274` · `admin/profile/actions.ts:24` · `admin/profile/[id]/page.tsx:33` · `uploadSessions.ts:113`

* **الخطورة:** بسيطة · **صعوبة الإصلاح:** منخفضة جداً

---

# خامساً: مشاكل أداء واضحة

## 23. قراءة كل سجلات التمارين بلا سقف — على صفحة تُحدَّث كل 5 ثوانٍ

**الملف:** [src/components/admin/AdminSubscriptionTimeline.tsx:93](src/components/admin/AdminSubscriptionTimeline.tsx:93)

```ts
const logs = await prisma.workout_logs.findMany({
  where: { profile_id: profile.id },
  orderBy: [...],
  select: { ... },       // ← لا take
});
```

**المشكلة:** لا حدّ للصفوف. نفس البيانات في `/api/workout-logs` محدودة عمداً بـ`MAX_LOGS = 2000` مع تعليق يشرح السبب ([workout-logs/route.ts:52](src/app/api/workout-logs/route.ts:52)): «four workouts a week of six exercises at four sets is about five thousand rows a year». هذا المسار — وهو **المسار المستعمل فعلاً**، إذ يقول التعليق نفسه إن نقطة `/api/workout-logs` لا يستدعيها شيء في المستودع — بلا سقف.

**والأسوأ:** صفحة `/admin/profile/[id]` تركّب `<LiveRefresh scope="profile" />` ([page.tsx:94](src/app/admin/profile/[id]/page.tsx:94))، الذي يستدعي `router.refresh()` عند كل تغيّر في البصمة، فيُعاد تشغيل مكوّن الخادم هذا بكامله — بما فيه هذا الاستعلام غير المحدود — كلما سجّل المتدرب وزناً وقتما كان المدرب فاتحاً صفحته.

* **الخطورة:** متوسطة (تتفاقم خطياً مع عمر اشتراك المتدرب)
* **صعوبة الإصلاح:** منخفضة جداً لإضافة `take`، لكن **الاختيار الصحيح للسقف قرار منتج**: الخط الزمني يقسّم السجلات على الأشهر، فسقفٌ أعمى سيُفرِّغ الأشهر القديمة بصمت. الأنظف هو الحدّ بنطاق التاريخ لا بعدد الصفوف.

## 24. مسح كامل لجدول `profiles` كل 5 ثوانٍ لكل تبويب لوحة مفتوح

**الملف:** [src/app/api/live/route.ts:284](src/app/api/live/route.ts:284) — `panelFingerprint()`

الاستعلام يجمع 6 تجميعات (`profiles`, `courses`, `exercises`, `nutrition_sources`, `diet_plans`, `site_settings`) **زائد** `string_agg(... ORDER BY p.id)` على كل صف في `profiles`.

`LIVE_POLL_MS` في الإنتاج = **5000ms** ([livePoll.ts:19](src/lib/livePoll.ts:19)). يُضاف إلى كل نداء استعلام `sessionRefusal` من `requireUser` ([live/route.ts:330](src/app/api/live/route.ts:330)).

فكل تبويب لوحة مفتوح ≈ **استعلامان في الثانية الواحدة كل خمس ثوانٍ**، أحدهما يمرّ على الجدول كاملاً.

**إنصافاً:** هذا **تحسين كبير** عن النسخة السابقة (كانت تسحب كل الصفوف إلى Node لتجزئتها) والتعليق يشرح ذلك. الملاحظة هنا أن التكلفة ما زالت O(عدد المشتركين) على إيقاع خمس ثوانٍ، وستُلاحظ عند النمو.

* **الخطورة:** متوسطة (اليوم بسيطة؛ تتحوّل إلى متوسطة مع نمو قائمة المشتركين)
* **صعوبة الإصلاح:** متوسطة — الحلول (عمود `updated_at` + trigger، أو رفع الفاصل، أو SSE) كلها قرارات معمارية موصوفة في التعليق نفسه.

## 25. لوحة المشتركين تقرأ كل الصفوف بلا ترقيم صفحات

**الملف:** [src/app/admin/page.tsx:103](src/app/admin/page.tsx:103)

الاستعلام الخام يقرأ **كل** صفوف `profiles` (`ORDER BY p.created_at DESC` بلا `LIMIT`) ويمرّرها كلها إلى `AdminCRMClient` كـ props.

**إنصافاً:** الاستعلام محسَّن جيداً — ينتقي 8 مفاتيح فقط من عمود `data` داخل Postgres بدل سحب الكتلة كاملة، وهو إصلاح موثَّق بتفصيل. ما يبقى هو أن عدد الصفوف نفسه غير محدود.

* **الخطورة:** بسيطة اليوم (عشرات/مئات المشتركين)
* **صعوبة الإصلاح:** متوسطة — الترقيم يمسّ الفلترة والبحث وتصدير CSV في `AdminCRMClient`.

## 26. تحميل مكتبة التمارين كاملة لبناء خريطتَي بحث

**الملف:** [src/app/export-workout/page.tsx:186](src/app/export-workout/page.tsx:186)

```ts
const allExercises = await prisma.exercises.findMany({
  select: { id: true, name_ar: true, video_url: true, target_muscle: true },
});
```

كل جدول التمارين، على كل تصيير للصفحة، لبناء `videoMap` و`muscleMap` — بينما المطلوب فقط التمارين الواردة في `rawDays` (يوم واحد إلى سبعة أيام).

الصفحة تُستدعى أيضاً من داخل Puppeteer عبر `/api/export-workout/pdf`، فالتكلفة تُدفع مرة أخرى في كل توليد PDF.

* **الخطورة:** بسيطة
* **صعوبة الإصلاح:** منخفضة — جمع معرّفات/أسماء التمارين من `rawDays` وتمريرها في `where: { OR: [...] }`.

## 27. أربعة استعلامات متتابعة بلا ترابط بينها

**الملف:** [src/components/admin/AdminSubscriptionTimeline.tsx](src/components/admin/AdminSubscriptionTimeline.tsx) — الأسطر 33، 50، 64، 93

الثلاثة الأخيرة (`diet_plans`, `client_courses`, `workout_logs`) تعتمد جميعاً على `profile.id` فقط، ولا يعتمد أيٌّ منها على نتيجة الآخر — لكنها تُنفَّذ بـ`await` متسلسلة.

**تحفّظ مهم:** على Vercel يضبط [db.ts:207](src/lib/db.ts:207) الـ pool على اتصال واحد عمداً، فـ`Promise.all` لن تُسرّع شيئاً هناك؛ المكسب يظهر خارج Vercel فقط. لذلك أُدرجها كملاحظة لا كتوصية.

* **الخطورة:** بسيطة · **صعوبة الإصلاح:** منخفضة جداً

---

# ملخّص مرتّب

| # | البند | الفئة | الخطورة | صعوبة الإصلاح |
|---|---|---|---|---|
| 1 | حذف المرفقات لا يحذف من التخزين | عطل | **حرجة** | منخفضة-متوسطة |
| 2 | `courseId` من العميل يُكتب في السجل | عطل | متوسطة | منخفضة جداً |
| 3 | `change-password` يمرّر غير-نصّ إلى bcrypt | عطل | متوسطة | منخفضة |
| 4 | `home_equipment_photo` لا يُحذف | عطل | متوسطة | منخفضة جداً |
| 7 | مقارنة نصية للكلمة السرية في مسارين | أمن | وقائية (كانت متوسطة — صفر صفوف، 2026-09-07) | منخفضة جداً |
| 8 | `/api/profile` بلا مرشّح الاعتمادات | أمن | وقائية (كانت متوسطة — صفر صفوف، 2026-09-07) | منخفضة جداً |
| 9 | `docxtemplater`/`pizzip` ميتتان + ثغرة | أمن | متوسطة | منخفضة جداً |
| 16 | ثوابت التخزين مكرّرة (سبب البند 1) | تعارض | متوسطة | متوسطة |
| 21 | ثلاث قوائم لحقول المرفقات | تعارض | متوسطة | منخفضة |
| 23 | سجلات التمارين بلا سقف + تحديث كل 5ث | أداء | متوسطة | منخفضة* |
| 24 | مسح `profiles` كامل كل 5 ثوانٍ | أداء | متوسطة | متوسطة |
| 5 | GET ينشئ جولة لحساب موقوف | عطل | بسيطة | منخفضة* |
| 6 | 500 بدل 400 على UUID مشوَّه (4 مسارات) | عطل | بسيطة | منخفضة جداً |
| 10 | حذف من التخزين بلا `isStoragePath` | أمن | بسيطة | منخفضة جداً |
| 11 | بريد المدرب داخل الكود | أمن | بسيطة | منخفضة-متوسطة |
| 13 | ملفان ميتان (`AdminWeightLogs`، `diet-plan.css`) | ميت | بسيطة | منخفضة جداً |
| 14 | 13 تصديراً غير مستدعى | ميت | بسيطة | منخفضة جداً |
| 17 | `crm.css`: كتلة مكرّرة ×3 | تعارض | بسيطة | منخفضة* |
| 18 | أصناف متعارضة بين globals وأنماط الصفحات | تعارض | بسيطة | متوسطة |
| 19 | محدِّدات مكرّرة داخل 10 ملفات CSS | تعارض | بسيطة | منخفضة* |
| 20 | متغيّرات الخط معرّفة مرتين | تعارض | بسيطة | منخفضة جداً |
| 22 | تكرار حدّ كلمة السر وتعبير UUID | تعارض | بسيطة | منخفضة جداً |
| 25 | لوحة المشتركين بلا ترقيم | أداء | بسيطة | متوسطة |
| 26 | تحميل كل التمارين لخريطة بحث | أداء | بسيطة | منخفضة |
| 27 | 4 استعلامات متتابعة بلا داعٍ | أداء | بسيطة | منخفضة جداً |

\* منخفضة تقنياً، لكن تحتاج قراراً منك أو تحققاً بصرياً قبل التنفيذ.

---

# ما لم أستطع التحقق منه — «غير مؤكد» صراحةً

1. ~~**وجود صفوف `accounts.password` غير مجزّأة بـbcrypt** (البند 7) — لم أستعلم قاعدة البيانات.~~ **تم التحقق 2026-09-07: صفر صفوف** (استعلام Supabase شغّله صاحب المشروع). البند 7 صار وقائياً.
2. ~~**وجود صفوف `profiles.data` تحمل `password` نصياً** (البند 8) — نفس السبب.~~ **تم التحقق 2026-09-07: صفر صفوف.** البند 8 صار وقائياً.
3. **الأثر البصري الفعلي لتعارضات CSS** (البند 18) — يحتاج فتح كل صفحة في المتصفح. لم أشغّل خادم التطوير: تسجيل الدخول يحجب الصفحات، وقد سجّلتُ في ذاكرتي سابقاً أن هذا التطبيق لا يمكن التحقق منه عبر المتصفح لهذا السبب.
4. **الكميات الحقيقية** (عدد المشتركين، عدد صفوف `workout_logs`، حجم مكتبة التمارين) التي تحدّد إن كانت بنود الأداء 23-26 محسوسة اليوم أم مستقبلية — استنتجتها من التعليقات في الكود لا من قياس.
5. **هل `AdminWeightLogs.tsx` و`diet-plan.css` مقصودان للاستعمال قريباً** — بحثي يثبت أنهما غير مستدعيين اليوم، لا أنهما بلا غرض.
6. **صحّة استنتاجي بشأن الأثر البصري لحذف كتل `crm.css` المكرّرة** (البند 17) — استنتجته من ترتيب المصدر وتساوي الخصوصية، وهو صحيح وفق قواعد CSS، لكنني لم أره على الشاشة.

---

*لم يُصلَح أي بند. في انتظار طلبك ببند محدّد بالرقم — وعندها سأعرض أولاً سبب المشكلة، وأصغر تعديل يحلّها، والملفات الأخرى المتأثرة بعد البحث عنها فعلياً، ثم أنتظر موافقتك.*

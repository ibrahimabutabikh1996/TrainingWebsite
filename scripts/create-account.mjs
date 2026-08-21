/*
 * إنشاء حساب.
 *
 * حسابان لا ثالث لهما في هذا الموقع:
 *
 *   admin    لوحة الكابتن، وتُفتح لحساب اسمه "admin" تحديداً. لا يُنشأ من داخل
 *            الموقع لأن إنشاء الحسابات هناك يتطلّب ملف مشترك موجوداً أصلاً.
 *
 *   trainee  حساب مشترك ومعه ملفه. الطريق الطبيعي أن يملأ المشترك استمارة
 *            التسجيل فيُنشأ ملفه، ثم ينشئ له الكابتن حساباً من لوحته. هذا
 *            الأمر يختصر الطريقين معاً، للتجربة أو لإدخال مشترك يدوياً.
 *
 * كلمة المرور تُكتب في سطر الأوامر وتُخزَّن مشفّرة ولا تُطبع أبداً.
 *
 *   node --env-file=.env scripts/create-account.mjs admin "كلمة-المرور"
 *   node --env-file=.env scripts/create-account.mjs trainee "اسم-المستخدم" "كلمة-المرور" ["الاسم الكامل"] [أيام-التمرين]
 *
 * إعادة تشغيل الأمر على اسم موجود تُحدّث كلمة مروره بدل أن تفشل.
 */
import pg from "pg";
import bcrypt from "bcrypt";

const MIN_LENGTH = 8;
const SUBSCRIPTION_DAYS = 30;
/** يوافق خيارات استمارة التسجيل: opt_days_2 حتى opt_days_6. */
const DEFAULT_WORKOUT_DAYS = 3;

const die = (...lines) => {
  for (const l of lines) console.error(l);
  process.exit(1);
};

const usage = [
  "الاستعمال:",
  '  node --env-file=.env scripts/create-account.mjs admin "كلمة-المرور"',
  '  node --env-file=.env scripts/create-account.mjs trainee "اسم-المستخدم" "كلمة-المرور" ["الاسم الكامل"] [أيام-التمرين]',
];

const [role, ...rest] = process.argv.slice(2);

if (role !== "admin" && role !== "trainee") die("النوع يجب أن يكون admin أو trainee.", ...usage);
if (!process.env.DIRECT_URL) die("لم يُقرأ عنوان قاعدة البيانات. شغّل الأمر مع: --env-file=.env");

const username = role === "admin" ? "admin" : rest[0];
const password = role === "admin" ? rest[0] : rest[1];
const fullname = role === "trainee" ? rest[2] || username : null;
const workoutDays = role === "trainee" ? Number(rest[3] ?? DEFAULT_WORKOUT_DAYS) : null;

if (!username) die("اسم المستخدم مطلوب.", ...usage);
if (!password) die("كلمة المرور مطلوبة.", ...usage);
if (password.length < MIN_LENGTH) die(`كلمة المرور يجب ألا تقل عن ${MIN_LENGTH} خانات.`);
if (role === "trainee" && (!Number.isInteger(workoutDays) || workoutDays < 1 || workoutDays > 7)) {
  die("عدد أيام التمرين يجب أن يكون رقماً بين 1 و 7.");
}

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });

try {
  await client.connect();
  const hashed = await bcrypt.hash(password, 10);

  await client.query("begin");

  /* اسم المستخدم فريد، فالحساب الموجود تُحدَّث كلمته بدل أن يفشل الأمر.

     وعمود password_changed_at يُكتب مع كلمة المرور، مطابقةً لـ reset-password.mjs
     ولمساري تغيير كلمة المرور: أي جلسة فُتحت بالكلمة القديمة تُرفض من طلبها
     التالي. يهمّ هذا في حالة التحديث تحديداً — الحساب الجديد لا جلسات له. */
  const { rows } = await client.query(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now())
     on conflict (username) do update
       set password = excluded.password,
           password_changed_at = now()
     returning id, (xmax = 0) as created`,
    [username, hashed]
  );
  const account = rows[0];

  if (role === "trainee") {
    /* ملف المشترك هو ما تقرأه لوحته؛ حساب بلا ملف يفتح على صفحة فارغة.
       ومدّة الاشتراك تُفعَّل هنا لأن الخدمة تمنع التسجيل على اشتراك منتهٍ. */
    const existing = await client.query(
      `select id from public.profiles where user_id = $1 order by created_at desc limit 1`,
      [account.id]
    );

    const data = JSON.stringify({
      fullname,
      workout_days: `opt_days_${workoutDays}`,
    });

    if (existing.rows.length > 0) {
      await client.query(
        `update public.profiles
         set data = data || $2::jsonb,
             subscription_ends_at = now() + ($3::int || ' days')::interval,
             is_suspended = false
         where id = $1`,
        [existing.rows[0].id, data, SUBSCRIPTION_DAYS]
      );
      console.log("الحساب وملفه موجودان؛ حُدّثت كلمة المرور وجُدّد الاشتراك.");
    } else {
      await client.query(
        `insert into public.profiles (username, data, user_id, subscription_ends_at)
         values ($1, $2::jsonb, $3, now() + ($4::int || ' days')::interval)`,
        [username, data, account.id, SUBSCRIPTION_DAYS]
      );
      console.log("تم إنشاء حساب المشترك وملفه.");
    }
  } else {
    console.log(account.created ? "تم إنشاء حساب الكابتن." : "الحساب موجود، وحُدّثت كلمة مروره.");
  }

  await client.query("commit");

  console.log(`اسم المستخدم: ${username}`);
  console.log(`المعرّف: ${account.id}`);
  if (role === "trainee") {
    console.log(`الاسم الكامل: ${fullname}`);
    console.log(`أيام التمرين أسبوعياً: ${workoutDays}`);
    console.log(`الاشتراك: ${SUBSCRIPTION_DAYS} يوماً من الآن`);
    console.log("يبقى أن يُسند له الكابتن كورساً لتبدأ دورته الأولى.");
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("فشل الأمر:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

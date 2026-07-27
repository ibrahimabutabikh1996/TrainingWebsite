/*
 * إنشاء حساب المدرب.
 *
 * لوحة الكابتن تُفتح لحساب اسمه "admin" فقط، وإنشاء الحسابات من داخل الموقع
 * مخصّص للمشتركين (يحتاج ملف مشترك موجوداً)، فحساب المدرب يُنشأ من هنا.
 *
 * كلمة المرور تكتبها أنت في سطر الأوامر، وتُخزَّن مشفّرة ولا تُطبع أبداً.
 *
 *   node --env-file=.env scripts/create-admin.mjs "كلمة-المرور-التي-تختارها"
 *
 * ولتغييرها لاحقاً: شغّل الأمر نفسه بكلمة جديدة، أو استخدم صفحة
 * «تغيير كلمة المرور» داخل الموقع بعد الدخول.
 */
import pg from "pg";
import bcrypt from "bcrypt";

const USERNAME = "admin";
const MIN_LENGTH = 8;

const password = process.argv[2];

if (!password) {
  console.error("اكتب كلمة المرور بعد اسم الملف:");
  console.error('  node --env-file=.env scripts/create-admin.mjs "كلمة-المرور"');
  process.exit(1);
}

if (password.length < MIN_LENGTH) {
  console.error(`كلمة المرور يجب ألا تقل عن ${MIN_LENGTH} خانات.`);
  process.exit(1);
}

if (!process.env.DIRECT_URL) {
  console.error("لم يُقرأ عنوان قاعدة البيانات. شغّل الأمر مع: --env-file=.env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });

try {
  await client.connect();
  const hashed = await bcrypt.hash(password, 10);

  /* اسم المستخدم فريد، فالحساب الموجود تُحدَّث كلمته بدل أن يفشل الأمر. */
  const { rows } = await client.query(
    `insert into public.accounts (username, password)
     values ($1, $2)
     on conflict (username) do update set password = excluded.password
     returning id, (xmax = 0) as أُنشئ`,
    [USERNAME, hashed]
  );

  const { id, أُنشئ } = rows[0];
  console.log(أُنشئ ? "تم إنشاء حساب المدرب." : "الحساب موجود، وحُدّثت كلمة مروره.");
  console.log(`اسم المستخدم: ${USERNAME}`);
  console.log(`المعرّف: ${id}`);
} catch (error) {
  console.error("فشل الأمر:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

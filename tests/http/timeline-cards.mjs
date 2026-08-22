/* The three month cards on the coach's timeline, after the rework.
 *
 * Each card carries one button now instead of a view/download pair, and the two
 * that used to expand in place (the training sheet and the diet) send the coach
 * to the page those are printed from. The subscriber's own details still open
 * where they are.
 *
 * Also asserts the half that is easy to forget: the trainee's dashboard is a
 * different component and must be exactly as it was.
 *
 * Seeds its own trainee with a course and a diet plan, and deletes everything it
 * made, by id, in a `finally`.
 *
 *   node tests/http/timeline-cards.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const RUN = "CARDS_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const DAY = 86400000;

const { q, end } = await db();

const results = [];
const check = (test, pass, note = "") => {
  results.push({ test, pass, note });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${test}${note ? ` — ${note}` : ""}`);
};

console.log("=".repeat(72));
console.log("TIMELINE CARDS — ONE BUTTON EACH");
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(72));

let exitCode = 0;
let browser;
const made = { accounts: [], profiles: [], courses: [], dietPlans: [] };

try {
  /* --------------------------------------------------------------- seed -- */

  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);
  const [acc] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id, username`,
    [`${RUN}_main`, hash]
  );
  made.accounts.push(acc.id);

  /* A course, so the training card has something to print and takes its live
     branch rather than the "no course" one. */
  const [course] = await q(
    `insert into public.courses (name, days_data) values ($1, $2::jsonb) returning id`,
    [`${RUN} كورس`, JSON.stringify([{ day: "اليوم الأول", exercises: [] }])]
  );
  made.courses.push(course.id);

  const [pro] = await q(
    `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended, current_course_id)
     values ($1, $2::jsonb, $3, $4, false, $5) returning id`,
    [
      `${RUN}_main`,
      JSON.stringify({
        fullname: `${RUN} تجربة`,
        gender: "female", plan: "plan2", plan_type: "both",
        weight: "70", height: "165", age: "28",
        activation_date: new Date(Date.now() - 10 * DAY).toISOString(),
        history: [], renewals: [], __test_run: RUN,
      }),
      acc.id,
      new Date(Date.now() + 20 * DAY),
      course.id,
    ]
  );
  made.profiles.push(pro.id);

  const [diet] = await q(
    `insert into public.diet_plans (profile_id, name, position, meals_data)
     values ($1, $2, 1, $3::jsonb) returning id`,
    [pro.id, "النظام الأول", JSON.stringify({ breakfast: [] })]
  );
  made.dietPlans.push(diet.id);

  console.log(`\nSEEDED  profile ${pro.id}  (course + diet plan)`);

  /* ------------------------------------------------------------ browser -- */

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  /* One browser context per identity: `setCookie` writes to the context's jar,
     so sharing one would have the second sign-in replace the first. */
  const open = async (token, url) => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1400, height: 1400 });
    await page.setCookie({ name: "gym_session", value: token, domain: "localhost", path: "/" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
    await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
    return { ctx, page, errors };
  };

  /* ============================================== A — the coach's timeline */

  console.log("\nA — the coach's page");

  const coach = await open(
    mintSession({ id: acc.id, username: "admin" }),
    `${BASE_URL}/admin/profile/${pro.id}`
  );

  /* The months are an accordion, closed by default; the cards live inside. */
  await coach.page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((n) =>
      n.textContent?.includes("الشهر الأول") && n.getAttribute("title")?.includes("التفاصيل")
    );
    el?.closest("div[style]")?.click();
  });
  await coach.page.evaluate(() => {
    const t = [...document.querySelectorAll('[title="عرض التفاصيل"]')];
    t.forEach((n) => n.click());
  });
  await coach.page.waitForFunction(
    () => document.body.innerText.includes("النظام التدريبي"),
    { timeout: 20000 }
  ).catch(() => {});

  const body = await coach.page.evaluate(() => document.body.innerText);

  check("A.1 card reads 'النظام التدريبي'",
    body.includes("النظام التدريبي") && !body.includes("النظام التدريبي للشهر"));
  check("A.2 card reads 'النظام الغذائي'",
    body.includes("النظام الغذائي") && !body.includes("النظام الغذائي للشهر"));
  check("A.3 card reads 'معلومات المشترك'",
    body.includes("معلومات المشترك") && !body.includes("البيانات الشاملة والقياسات"));

  check("A.4 the header report-download button is gone",
    !body.includes("تحميل التقرير الشامل PDF"));

  /* The destinations, read off the anchors rather than guessed at. */
  const links = await coach.page.evaluate(() =>
    [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"))
  );
  check("A.5 the training card opens the workout export",
    links.some((h) => h?.startsWith("/export-workout?courseId=")),
    links.find((h) => h?.includes("export-workout")) ?? "none");
  check("A.6 the diet card opens the diet export",
    links.some((h) => h?.startsWith("/export-diet?profileId=")),
    links.find((h) => h?.includes("export-diet")) ?? "none");
  check("A.7 nothing links to the profile export any more",
    !links.some((h) => h?.includes("/export-profile")));

  /* One button per card: the pair each used to carry is what this replaces. */
  const cardBtns = await coach.page.evaluate(() => {
    const out = {};
    for (const label of ["النظام التدريبي", "النظام الغذائي", "معلومات المشترك"]) {
      const title = [...document.querySelectorAll("span")].find(
        (s) => s.textContent?.trim() === label
      );
      const card = title?.closest(".timeline-card");
      out[label] = card
        ? card.querySelectorAll("a[href], button").length
        : -1;
    }
    return out;
  });
  check("A.8 the training card has exactly one control", cardBtns["النظام التدريبي"] === 1,
    `count=${cardBtns["النظام التدريبي"]}`);
  check("A.9 the diet card has exactly one control", cardBtns["النظام الغذائي"] === 1,
    `count=${cardBtns["النظام الغذائي"]}`);
  check("A.10 the info card has exactly one control", cardBtns["معلومات المشترك"] === 1,
    `count=${cardBtns["معلومات المشترك"]}`);

  /* The one card that still opens where it stands. */
  const opened = await coach.page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((el) =>
      el.innerText.trim().includes("عرض المعلومات")
    );
    if (!b) return "NO BUTTON";
    b.click();
    return "clicked";
  });
  check("A.11 the info card offers 'عرض المعلومات'", opened === "clicked", opened);
  await coach.page.waitForFunction(
    () => document.body.innerText.includes("إخفاء المعلومات"),
    { timeout: 15000 }
  ).catch(() => {});
  const afterOpen = await coach.page.evaluate(() => document.body.innerText);
  check("A.12 it expands in place, without leaving the page",
    afterOpen.includes("إخفاء المعلومات") && afterOpen.includes("إدارة حساب الدخول والصلاحية"));

  /* The five explanatory sentences the coach asked to be removed. Asserted as
     text absent from a page that still carries the headings and the controls —
     deleting a card wholesale would also make these pass, which is why A.1–A.12
     above check what stayed. */
  const removed = [
    "أرشيف رحلة المتدرب",
    "أرشيف رحلتك البدنية",
    "تمنحك هذه الصلاحية",
    "يحتوي على تفاصيل التمارين",
    "يحتوي على تقسيم الوجبات",
    "يحتوي على كافة قياسات",
  ];
  const stillThere = removed.filter((t) => afterOpen.includes(t));
  check("A.14 the five removed sentences are gone", stillThere.length === 0,
    stillThere.join(" | "));

  /* What must survive them. */
  check("A.15 the timeline heading survived",
    afterOpen.includes("سجل الاشتراك التاريخي والأنظمة السابقة"));
  check("A.16 the coach's history-control heading survived",
    afterOpen.includes("إدارة التحكم بالسجل التاريخي للمدرب"));

  const coachErrors = coach.errors.filter((e) => !/favicon|DevTools|_next\/image/i.test(e));
  check("A.13 no page errors on the coach's page", coachErrors.length === 0,
    coachErrors.slice(0, 2).join(" | "));
  await coach.ctx.close();

  /* ========================================= B — the trainee is untouched  */

  console.log("\nB — the trainee's dashboard (must be unchanged)");

  const trainee = await open(
    mintSession({ id: acc.id, username: acc.username }),
    `${BASE_URL}/dashboard`
  );
  /* The dashboard fetches its profile after mount, so the landmark to wait on
     is the greeting it draws from the response — not the absence of a spinner,
     and not a tab label, which this layout renders as an icon. */
  await trainee.page.waitForFunction(
    () => document.body.innerText.includes("هلا بيك"),
    { timeout: 40000 }
  ).catch(() => {});
  const tBody = await trainee.page.evaluate(() => document.body.innerText);

  /* The dashboard renders TraineeProfileDetails, not this timeline — so none of
     the three cards were ever there, and none of them appear now. */
  check("B.1 the dashboard rendered the trainee's own view", tBody.includes("هلا بيك"),
    `${tBody.length} chars: ${tBody.slice(0, 90).replace(/\s+/g, " ")}`);
  check("B.2 it never carried these cards, and still does not",
    !tBody.includes("سجل الاشتراك التاريخي والأنظمة السابقة") &&
    !tBody.includes("معلومات المشترك") &&
    !tBody.includes("فتح صفحة التحميل"));

  const tErrors = trainee.errors.filter((e) => !/favicon|DevTools|_next\/image/i.test(e));
  check("B.3 no page errors on the trainee's dashboard", tErrors.length === 0,
    tErrors.slice(0, 2).join(" | "));
  await trainee.ctx.close();

  const failed = results.filter((r) => !r.pass);
  console.log("\n" + "=".repeat(72));
  console.log(`RESULT: ${results.length - failed.length} passed, ${failed.length} failed`);
  console.log("=".repeat(72));
  if (failed.length) exitCode = 1;
} catch (error) {
  console.error("\nRUN ABORTED:", error.stack || error.message);
  exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});

  console.log("\nCLEANUP — by id, child-first");
  try {
    const del = async (label, sql, ids) => {
      if (!ids.length) return;
      const r = await q(sql, [ids]);
      console.log(`  ${label.padEnd(12)} ${r.length} / ${ids.length}`);
    };
    await del("diet_plans", `delete from public.diet_plans where id = any($1::uuid[]) returning id`, made.dietPlans);
    await del("profiles", `delete from public.profiles where id = any($1::uuid[]) returning id`, made.profiles);
    await del("courses", `delete from public.courses where id = any($1::uuid[]) returning id`, made.courses);
    await del("accounts", `delete from public.accounts where id = any($1::uuid[]) returning id`, made.accounts);

    const [left] = await q(
      `select (select count(*) from public.accounts where username like $1)
            + (select count(*) from public.profiles where username like $1)
            + (select count(*) from public.courses where name like $1) as n`,
      [`${RUN}%`]
    );
    console.log(`  remaining for this run: ${left.n}`);
    if (Number(left.n) !== 0) exitCode = 1;
  } catch (e) {
    console.error(`  CLEANUP FAILED: ${e.message}`);
    exitCode = 1;
  }

  await end();
  process.exit(exitCode);
}

/* The header line on the two printable sheets, and the hole found under it.
 *
 * Both sheets print "الاسم / تاريخ الاشتراك / الوزن / الطول / الهدف" across the
 * top. Three of those were wrong:
 *
 *   - the training sheet reached by `?courseId=` alone showed "المشترك" and
 *     three dashes, because the page only reads the subscriber when the address
 *     names them;
 *   - both sheets printed `new Date()` under "تاريخ الاشتراك" — today's date,
 *     never the subscription's;
 *   - and `traineeMayPrint` returned on the first key it recognised, so
 *     `?courseId=<mine>&profileId=<theirs>` passed on the course and then
 *     printed another trainee's name, weight, height and goal.
 *
 * Two trainees are seeded because the last of those cannot be shown with one.
 * Everything created here is deleted by id in a `finally`.
 *
 *   node tests/http/export-headers.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { db, mintSession, cookieFor, BASE_URL } from "./_lib.mjs";

const RUN = "EXPHDR_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const DAY = 86400000;

const { q, end } = await db();

const results = [];
const check = (test, pass, note = "") => {
  results.push({ test, pass, note });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${test}${note ? ` — ${note}` : ""}`);
};

console.log("=".repeat(72));
console.log("EXPORT SHEET HEADERS");
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(72));

let exitCode = 0;
const made = { accounts: [], profiles: [], courses: [], dietPlans: [] };

/* Distinct on purpose: every assertion below is "mine appears / theirs does
   not", and identical fixtures would make both halves pass by accident. */
const MINE = {
  name: "سيف الدين",
  weight: "83", height: "179",
  activation: new Date(Date.UTC(2026, 4, 17)).toISOString(),
};
const THEIRS = {
  name: "غريب لا يخصني",
  weight: "61", height: "158",
  activation: new Date(Date.UTC(2025, 10, 3)).toISOString(),
};

try {
  /* --------------------------------------------------------------- seed -- */

  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);

  const seed = async (tag, who) => {
    const [acc] = await q(
      `insert into public.accounts (username, password, password_changed_at)
       values ($1, $2, now() - interval '1 hour') returning id, username`,
      [`${RUN}_${tag}`, hash]
    );
    made.accounts.push(acc.id);

    const [course] = await q(
      `insert into public.courses (name, days_data) values ($1, $2::jsonb) returning id`,
      [`${RUN} كورس ${tag}`, JSON.stringify([{ day: "اليوم الأول", exercises: [] }])]
    );
    made.courses.push(course.id);

    const [pro] = await q(
      `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended, current_course_id)
       values ($1, $2::jsonb, $3, $4, false, $5) returning id`,
      [
        `${RUN}_${tag}`,
        JSON.stringify({
          fullname: who.name, gender: "male", plan: "plan2", plan_type: "both",
          weight: who.weight, height: who.height, age: "30",
          sub_goal: "خسارة الوزن وبناء العضلات", activation_date: who.activation,
          history: [], renewals: [], __test_run: RUN,
        }),
        acc.id, new Date(Date.now() + 20 * DAY), course.id,
      ]
    );
    made.profiles.push(pro.id);

    const [diet] = await q(
      `insert into public.diet_plans (profile_id, name, position, meals_data)
       values ($1, $2, 1, $3::jsonb) returning id`,
      [pro.id, "النظام الأول", JSON.stringify({ breakfast: [] })]
    );
    made.dietPlans.push(diet.id);

    return { acc, course, profile: pro };
  };

  const mine = await seed("mine", MINE);
  const theirs = await seed("theirs", THEIRS);
  console.log(`\nSEEDED  mine=${mine.profile.id}  theirs=${theirs.profile.id}`);

  const myCookie = cookieFor(mintSession({ id: mine.acc.id, username: mine.acc.username }));

  /* The sheets are server-rendered, so the header text is in the HTML — no
     browser needed to read it back. */
  const full = async (path) => {
    const res = await fetch(BASE_URL + path, { headers: { Cookie: myCookie }, redirect: "manual" });
    return { status: res.status, html: await res.text() };
  };

  /* What a refusal looks like on the wire.
   *
   * Not the status code. Both pages are `force-dynamic` and sit behind a
   * loading boundary, so Next has already flushed 200 and the headers by the
   * time the component calls `notFound()`; the not-found UI arrives in the
   * stream that follows. Asserting on the status would have read every refusal
   * as a success. What actually matters is on the page: the sheet did not
   * render, and the not-found boundary did. */
  const refused = (r) =>
    !r.html.includes("تاريخ الاشتراك") &&
    (r.html.includes("This page could not be found") || r.html.includes("404"));

  const expectedStart = MINE.activation.slice(0, 10); // 2026-05-17

  /* ============================================ A — the training sheet ==== */

  console.log("\nA — the training sheet, reached the way the timeline links to it");

  const a = await full(
    `/export-workout?courseId=${mine.course.id}&profileId=${mine.profile.id}`
  );
  check("A.0 the page renders", a.status === 200, `HTTP ${a.status}`);
  check("A.1 the subscriber's real name is on it", a.html.includes(MINE.name));
  check("A.2 it no longer says 'المشترك'", !a.html.includes("النظام التدريبي - المشترك"));
  check("A.3 the real weight is on it", a.html.includes(`${MINE.weight} كغم`));
  check("A.4 the real height is on it", a.html.includes(`${MINE.height} سم`));
  check("A.5 the goal is filled in", !/الهدف:\s*<\/span>|الهدف:<\/strong>\s*—/.test(a.html));
  check("A.6 the subscription date is the real one", a.html.includes(expectedStart),
    `expected ${expectedStart}`);
  check("A.7 it is not simply today's date",
    !a.html.includes(new Date().toISOString().slice(0, 10)) ||
      expectedStart === new Date().toISOString().slice(0, 10));

  /* ================================================ B — the diet sheet ==== */

  console.log("\nB — the diet sheet");

  const b = await full(`/export-diet?profileId=${mine.profile.id}`);
  check("B.0 the page renders", b.status === 200, `HTTP ${b.status}`);
  check("B.1 the subscriber's real name is on it", b.html.includes(MINE.name));
  check("B.2 the real weight is on it", b.html.includes(`${MINE.weight} كغم`));
  check("B.3 the real height is on it", b.html.includes(`${MINE.height} سم`));
  check("B.4 the subscription date is the real one", b.html.includes(expectedStart),
    `expected ${expectedStart}`);

  check("B.5 both sheets print the same start date for the same subscriber",
    a.html.includes(expectedStart) && b.html.includes(expectedStart));

  /* ======================================= C — the disclosure is closed === */

  console.log("\nC — one trainee's course, another trainee's profile");

  const c = await full(
    `/export-workout?courseId=${mine.course.id}&profileId=${theirs.profile.id}`
  );
  check("C.1 the mixed-key address is refused — no sheet rendered", refused(c),
    `HTTP ${c.status}, sheet header present: ${c.html.includes("تاريخ الاشتراك")}`);
  check("C.2 the other trainee's name did not leak", !c.html.includes(THEIRS.name));
  check("C.3 their weight did not leak", !c.html.includes(`${THEIRS.weight} كغم`));
  check("C.4 their height did not leak", !c.html.includes(`${THEIRS.height} سم`));
  check("C.5 their subscription date did not leak",
    !c.html.includes(THEIRS.activation.slice(0, 10)));

  /* The same address through the PDF route, which forwards all three keys and
     leans on the page for the decision. */
  const pdf = await fetch(
    `${BASE_URL}/api/export-workout/pdf?courseId=${mine.course.id}&profileId=${theirs.profile.id}`,
    { headers: { Cookie: myCookie }, redirect: "manual" }
  );
  const pdfBody = Buffer.from(await pdf.arrayBuffer());
  check("C.6 the PDF route does not hand over their sheet either",
    !pdfBody.includes(THEIRS.name),
    `HTTP ${pdf.status}, ${pdfBody.length} bytes`);

  /* ============================================ D — nothing was loosened == */

  console.log("\nD — the legitimate addresses still work");

  const d1 = await full(`/export-workout?profileId=${mine.profile.id}`);
  check("D.1 my own profile alone still prints", d1.status === 200 && d1.html.includes(MINE.name),
    `HTTP ${d1.status}`);

  const d2 = await full(`/export-workout?courseId=${mine.course.id}`);
  check("D.2 my own course alone still prints", d2.status === 200, `HTTP ${d2.status}`);

  const d3 = await full(`/export-workout?courseId=${theirs.course.id}`);
  check("D.3 someone else's course is still refused", refused(d3));

  const d4 = await full(`/export-diet?profileId=${theirs.profile.id}`);
  check("D.4 someone else's diet is still refused", refused(d4));

  const d5 = await full(`/export-workout`);
  check("D.5 an address naming nothing is refused", refused(d5));

  /* The coach prints anyone's — that is the panel's purpose, and it must survive
     the stricter check. */
  const adminRes = await fetch(
    `${BASE_URL}/export-workout?courseId=${theirs.course.id}&profileId=${theirs.profile.id}`,
    { headers: { Cookie: cookieFor(mintSession({ id: mine.acc.id, username: "admin" })) }, redirect: "manual" }
  );
  const adminHtml = await adminRes.text();
  check("D.6 the coach still prints any subscriber's sheet",
    adminRes.status === 200 && adminHtml.includes(THEIRS.name), `HTTP ${adminRes.status}`);

  const failed = results.filter((r) => !r.pass);
  console.log("\n" + "=".repeat(72));
  console.log(`RESULT: ${results.length - failed.length} passed, ${failed.length} failed`);
  console.log("=".repeat(72));
  if (failed.length) exitCode = 1;
} catch (error) {
  console.error("\nRUN ABORTED:", error.stack || error.message);
  exitCode = 1;
} finally {
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

/* Assigning a new programme detaches the old one from that trainee — and only
 * from that trainee.
 *
 * Everything here is created by this run and deleted in the `finally`: two
 * accounts, two profiles, three courses. It never touches a row it did not
 * make, which is why it is safe to point at the working database.
 *
 * The assignment goes through the real server action, driven from the admin UI,
 * rather than through SQL that mimics it — the point is what the product does.
 *
 *   node tests/http/reassign-course.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const { q, end } = await db();
const RUN = "RASG_" + crypto.randomBytes(3).toString("hex").toUpperCase();
let fails = 0;
const check = (n, ok, note = "") => { console.log(`  [${ok ? "PASS" : "FAIL"}] ${n}${note ? " — " + note : ""}`); if (!ok) fails++; };

const made = { accounts: [], profiles: [], courses: [] };
let browser;

const DAYS = (label) => JSON.stringify([{ id: crypto.randomUUID(), name: label, muscles: [], exercises: [] }]);

try {
  /* ── the cast ── */
  const hash = await bcrypt.hash("TestOnly_" + RUN, 10);
  const [adminAcc] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id`, [`${RUN}_admin`, hash]);
  made.accounts.push(adminAcc.id);
  const [tAcc] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id`, [`${RUN}_t1`, hash]);
  made.accounts.push(tAcc.id);
  const [t2Acc] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id`, [`${RUN}_t2`, hash]);
  made.accounts.push(t2Acc.id);

  const mkProfile = async (acc, tag) => {
    const [p] = await q(
      `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
       values ($1, $2::jsonb, $3, now() + interval '30 days', false) returning id`,
      [`${RUN}_${tag}`, JSON.stringify({ fullname: `${RUN} ${tag}`, __test_run: RUN }), acc.id]
    );
    made.profiles.push(p.id);
    return p.id;
  };
  const trainee = await mkProfile(tAcc, "t1");
  const bystander = await mkProfile(t2Acc, "t2");

  const mkCourse = async (name) => {
    const [c] = await q(`insert into public.courses (name, description, days_data, coach_id) values ($1,$2,$3::jsonb,$4) returning id`,
      [`${RUN} ${name}`, "test", DAYS(name), adminAcc.id]);
    made.courses.push(c.id);
    return c.id;
  };
  const oldCourse = await mkCourse("OLD");
  const newCourse = await mkCourse("NEW");

  /* The starting position: the trainee is on OLD, and so is an unrelated
     second trainee. The bystander is the whole point — detaching must be
     surgical. */
  await q(`update public.profiles set current_course_id=$1 where id=any($2::uuid[])`, [oldCourse, [trainee, bystander]]);
  await q(`insert into public.client_courses (client_id, course_id, is_active) values ($1,$2,true),($3,$2,true)`, [trainee, oldCourse, bystander]);

  const snap = async (pid) => (await q(
    `select p.current_course_id,
            (select count(*) from public.client_courses cc where cc.client_id=p.id and cc.is_active)::int as active,
            (select count(*) from public.client_courses cc where cc.client_id=p.id)::int as total
     from public.profiles p where p.id=$1`, [pid]))[0];

  /* ── assign NEW through the admin UI ── */
  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  await page.setCookie({ name: "gym_session", value: mintSession({ id: adminAcc.id, username: "admin" }), domain: "localhost", path: "/" });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  await page.goto(`${BASE_URL}/admin/builder?courseId=${newCourse}&traineeId=${trainee}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => (document.body.innerText || "").trim().length > 60, { timeout: 90000, polling: 500 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  const saved = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((e) => (e.textContent || "").includes("حفظ الكورس"));
    if (!b) return "no save button";
    b.click(); return "clicked";
  });
  check("save control reached", saved === "clicked", saved);
  await new Promise((r) => setTimeout(r, 4000));

  /* ── what the database says now ── */
  const after = await snap(trainee);
  const bys = await snap(bystander);

  check("trainee now points at the NEW programme", after.current_course_id === newCourse);
  check("trainee has exactly one active link", after.active === 1, `${after.active} active of ${after.total}`);
  check("the OLD link is kept but inactive (history survives)", after.total >= 2, `${after.total} links total`);

  const oldStillThere = (await q(`select count(*)::int n from public.courses where id=$1`, [oldCourse]))[0].n;
  check("the OLD course row is NOT deleted from the library", oldStillThere === 1);

  check("the other trainee is untouched", bys.current_course_id === oldCourse && bys.active === 1,
        `current=${bys.current_course_id === oldCourse ? "OLD" : bys.current_course_id} active=${bys.active}`);

  /* ── and what the trainee's own page serves ── */
  const tPage = await browser.newPage();
  await tPage.setCookie({ name: "gym_session", value: mintSession({ id: tAcc.id, username: `${RUN}_t1` }), domain: "localhost", path: "/" });
  /* Navigate first: a fetch from `about:blank` has no origin to send the cookie
     with, which reads as HTTP 0 and looks exactly like a broken endpoint. */
  await tPage.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  const api = await tPage.evaluate(async (base) => {
    const r = await fetch(base + "/api/profile", { credentials: "include" });
    return { status: r.status, body: (await r.text()).slice(0, 4000) };
  }, BASE_URL).catch((e) => ({ status: 0, body: String(e) }));
  check("trainee's own page serves the NEW programme immediately",
        api.status === 200 && api.body.includes("NEW") && !api.body.includes("OLD"),
        `HTTP ${api.status}` + (api.body.includes("OLD") ? " — still shows OLD" : ""));

  console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
} finally {
  if (browser) await browser.close();
  /* Reverse order of creation, and only ids this run recorded. */
  if (made.profiles.length) {
    await q(`update public.profiles set current_course_id=null where id=any($1::uuid[])`, [made.profiles]);
    await q(`delete from public.client_courses where client_id=any($1::uuid[])`, [made.profiles]);
    await q(`delete from public.training_cycles where profile_id=any($1::uuid[])`, [made.profiles]);
  }
  if (made.courses.length) {
    await q(`delete from public.client_courses where course_id=any($1::uuid[])`, [made.courses]);
    await q(`delete from public.courses where id=any($1::uuid[])`, [made.courses]);
  }
  if (made.profiles.length) await q(`delete from public.profiles where id=any($1::uuid[])`, [made.profiles]);
  if (made.accounts.length) await q(`delete from public.accounts where id=any($1::uuid[])`, [made.accounts]);
  console.log(`CLEANUP — ${made.courses.length} courses, ${made.profiles.length} profiles, ${made.accounts.length} accounts removed`);
  await end();
}
process.exit(fails === 0 ? 0 : 1);

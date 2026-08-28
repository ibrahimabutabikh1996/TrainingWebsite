/* The half of the renewal flow that is not an endpoint.
 *
 * `renewal-flow.mjs` drives the two routes and asserts on the database, which
 * leaves three things it cannot reach: whether the coach's card actually
 * renders for a pending request, whether its buttons do what they say, and
 * whether `rejectRenewalAction` — a server action, so not callable over plain
 * HTTP without the build's action id — clears the flags. Those are exercised
 * here by driving a real browser.
 *
 * Same discipline as its sibling: seeds its own trainee, records every insert in
 * a manifest as it goes, and deletes by id in a `finally`.
 *
 *   node tests/http/renewal-ui.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const RUN = "RENEWAL_UI_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const DAY = 86400000;
const MANIFEST = path.join(import.meta.dirname, ".renewal-ui-manifest.json");

const m = { runId: RUN, accounts: [], profiles: [] };
const persist = () => fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));

const { q, end } = await db();

const results = [];
const check = (test, pass, note = "") => {
  results.push({ test, pass, note });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${test}${note ? ` — ${note}` : ""}`);
};

console.log("=".repeat(72));
console.log("RENEWAL UI — COACH'S CARD AND THE REJECT ACTION");
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(72));

let exitCode = 0;
let browser;

const ACTIVATION = new Date(Date.now() - 40 * DAY).toISOString();
const WEIGHT_LOGS = [{ date: "2026-08-01", weight: 81 }];

try {
  /* --------------------------------------------------------------- seed -- */

  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);
  const [acc] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id, username`,
    [`${RUN}_main`, hash]
  );
  m.accounts.push({ id: acc.id, username: acc.username });
  persist();

  /* Seeded straight into the state /api/submit-form leaves behind — the
     endpoint's own path to it is already proven by renewal-flow.mjs, and what
     is under test here is what the panel does with that state. */
  const pendingData = {
    fullname: `${RUN} تجربة`,
    gender: "female",
    plan: "plan2",
    weightLogs: WEIGHT_LOGS,
    activation_date: ACTIVATION,
    payment_receipt: ["usersData/fake-session/payment_receipt_test"],
    history: [{ label: "الشهر الأول", date: new Date(Date.now() - DAY).toISOString(), data: {} }],
    renewals: [],
    is_new: true,
    is_renewal: true,
    renewal_pending: true,
    renewal_requested_at: new Date().toISOString(),
    renewal_requested_month: 2,
    __test_run: RUN,
  };
  const endsAt = new Date(Date.now() + 5 * DAY);
  const [pro] = await q(
    `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
     values ($1, $2::jsonb, $3, $4, false) returning id`,
    [`${RUN}_main`, JSON.stringify(pendingData), acc.id, endsAt]
  );
  m.profiles.push({ id: pro.id });
  persist();
  console.log(`\nSEEDED  profile ${pro.id}  (renewal_pending, month 2, 5 days left)`);

  /* ------------------------------------------------------------ browser -- */

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  let page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });

  /* The coach's session, minted rather than typed: `mintSession` produces the
     token `@/lib/session` verifies, so no password is entered anywhere. The
     cookie the server reads is httpOnly when it sets one, but it only ever
     reads the value — one set here is indistinguishable to it. */
  const adminToken = mintSession({ id: acc.id, username: "admin" });
  await page.setCookie({
    name: "gym_session", value: adminToken, domain: "localhost", path: "/",
  });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));

  const text = async () => page.evaluate(() => document.body.innerText);

  /* =========================================== the card renders for the coach */

  console.log("\nA — the coach's profile page");

  await page.goto(`${BASE_URL}/admin/profile/${pro.id}`, { waitUntil: "networkidle0", timeout: 90000 });
  const bodyA = await text();

  check("A.1 the pending-renewal card is shown", bodyA.includes("طلب تجديد اشتراك بانتظار المراجعة"));
  check("A.2 it names the month asked for", bodyA.includes("الشهر 2"));
  check("A.3 it offers the approval", bodyA.includes("موافقة وتجديد الاشتراك"));
  check("A.4 it offers the rejection", bodyA.includes("رفض الطلب"));
  check("A.5 it links the payment receipt", bodyA.includes("فتح الوصل"));
  check("A.6 it states that nothing is granted yet", bodyA.includes("لا تُحتسب أي أيام قبل موافقتك"));

  /* ============================================ the trainee's own dashboard  */

  console.log("\nB — the trainee's dashboard");

  /* Its own browser context, which is the whole point.
   *
   * `page.setCookie` writes into the browser's cookie jar, not the page's — so
   * the first version opened the trainee's dashboard in a second tab and
   * thereby replaced the coach's session cookie for every tab. Section C then
   * pressed "reject" as a trainee, `requireAdminAction` refused it exactly as
   * it should, and the run read that correct refusal as a broken action. An
   * incognito context has a cookie jar of its own, so the two sessions coexist
   * the way they do on two different machines. */
  const traineeCtx = await browser.createBrowserContext();
  const traineePage = await traineeCtx.newPage();
  await traineePage.setViewport({ width: 1400, height: 1200 });
  await traineePage.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: acc.username }),
    domain: "localhost", path: "/",
  });
  await traineePage.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle0", timeout: 90000 });
  /* The dashboard fetches its profile after mount, so the banner appears on the
     render that follows the response, not on first paint. */
  await traineePage.waitForFunction(
    () => document.body.innerText.includes("طلب التجديد قيد المراجعة"),
    { timeout: 30000 }
  ).catch(() => {});
  const bodyB = await traineePage.evaluate(() => document.body.innerText);

  check("B.1 the trainee is told the request is under review", bodyB.includes("طلب التجديد قيد المراجعة"));
  check("B.2 they are told not to send it again", bodyB.includes("لا حاجة لإعادة إرسال الاستمارة"));
  check("B.3 the renew button is stood down", !bodyB.includes("تجديد الاشتراك وتحديث البيانات"),
    bodyB.includes("طلبك مُرسل") ? "replaced with 'طلبك مُرسل'" : "");
  await traineePage.close();
  await traineeCtx.close();

  /* ============================================== reject, for real this time */

  console.log("\nC — pressing 'رفض الطلب' (the server action)");

  const before = await q(`select subscription_ends_at, data from public.profiles where id = $1`, [pro.id]);
  const endsBefore = before[0].subscription_ends_at.toISOString();

  /* Two clicks: the button arms, then confirms. Neither decision happens on one
     press, which is itself the thing being checked here. */
  const clickByText = async (label) =>
    page.evaluate((t) => {
      const b = [...document.querySelectorAll("button")].find((el) => el.innerText.trim().includes(t));
      if (!b) return false;
      b.click();
      return true;
    }, label);

  /** The stored blob, read fresh. */
  const readBlob = async () => {
    const [r] = await q(`select data from public.profiles where id = $1`, [pro.id]);
    return typeof r.data === "string" ? JSON.parse(r.data) : r.data || {};
  };

  /* Waited on the database, not on the page text.
   *
   * The first version of this waited for the card to leave the DOM and then
   * read the row, and reported the flags uncleared on a run where they had in
   * fact been cleared a moment later — the assertion was racing the action it
   * was meant to be observing. The row is the thing under test; the DOM is how
   * the click was delivered. */
  const waitForBlob = async (predicate, ms = 30000) => {
    const deadline = Date.now() + ms;
    for (;;) {
      const b = await readBlob();
      if (predicate(b)) return b;
      if (Date.now() > deadline) return b;
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  check("C.1 the reject button is present", await clickByText("رفض الطلب"));
  await page.waitForFunction(
    () => document.body.innerText.includes("تأكيد الرفض"), { timeout: 10000 }
  );
  check("C.2 it asks for confirmation before acting", true, "'تأكيد الرفض' appeared");

  /* Nothing may have changed yet — arming is not acting. */
  const midBlob = await readBlob();
  check("C.3 arming the button changes nothing", midBlob.renewal_pending === true);

  check("C.3b the confirm button was found and pressed", await clickByText("تأكيد الرفض"));
  const afterBlob = await waitForBlob((b) => b.renewal_pending === undefined);
  const after = await q(
    `select subscription_ends_at from public.profiles where id = $1`, [pro.id]
  );

  check("C.4 the pending flags are cleared", afterBlob.renewal_pending === undefined,
    `pending=${afterBlob.renewal_pending}`);
  check("C.5 renewal_requested_at cleared", afterBlob.renewal_requested_at === undefined);
  check("C.6 renewal_requested_month cleared", afterBlob.renewal_requested_month === undefined);
  check("C.7 rejection took no days back",
    after[0].subscription_ends_at.toISOString() === endsBefore,
    `${endsBefore}`);
  check("C.8 the weigh-in log was not touched",
    JSON.stringify(afterBlob.weightLogs) === JSON.stringify(WEIGHT_LOGS));
  check("C.9 the archived month was not touched",
    Array.isArray(afterBlob.history) && afterBlob.history.length === 1,
    `history=${afterBlob.history?.length}`);
  /* The row is settled by now; the screen catches up on the `router.refresh()`
     the action fired, which is a second round trip. Checked immediately, this
     read the page as it was before that landed. */
  await page.waitForFunction(
    () => !document.body.innerText.includes("طلب تجديد اشتراك بانتظار المراجعة"),
    { timeout: 30000 }
  ).catch(() => {});
  const bodyC = await text();
  check("C.10 the card leaves the page once the request is decided",
    !bodyC.includes("طلب تجديد اشتراك بانتظار المراجعة"));
  /* ...and gone because the request was decided, not because the page stopped
     being the coach's. The run that prompted this line had lost the admin
     session and was reading a redirect to /login as success. */
  check("C.11 still on the coach's page, not signed out",
    bodyC.includes("إدارة حساب الدخول والصلاحية"),
    bodyC.slice(0, 60));

  /* ================================================= approve, for real too  */

  console.log("\nD — pressing 'موافقة وتجديد الاشتراك'");

  await q(
    `update public.profiles set data = data || $2::jsonb where id = $1`,
    [pro.id, JSON.stringify({ renewal_pending: true, renewal_requested_month: 2, renewal_requested_at: new Date().toISOString() })]
  );

  /* A row changed behind Next's back — no `revalidatePath` ran for this write,
     because it was made with SQL rather than through the app. The cached RSC
     payload for this URL is therefore the one from after the rejection, and a
     plain `goto` is served from it. A fresh page has no such cache. */
  await page.close();
  page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });
  await page.setCookie({ name: "gym_session", value: adminToken, domain: "localhost", path: "/" });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE_URL}/admin/profile/${pro.id}`, { waitUntil: "networkidle0", timeout: 90000 });

  check("D.1 the card is back for the new request",
    (await text()).includes("طلب تجديد اشتراك بانتظار المراجعة"));

  check("D.1b the approve button was found", await clickByText("موافقة وتجديد الاشتراك"));
  await page.waitForFunction(
    () => document.body.innerText.includes("تأكيد — أضف الشهر"), { timeout: 10000 }
  );
  check("D.2 approval also asks for confirmation", true);

  check("D.2b the confirm button was found", await clickByText("تأكيد — أضف الشهر"));
  const doneBlob = await waitForBlob((b) => b.renewal_pending === undefined);
  const done = await q(
    `select subscription_ends_at from public.profiles where id = $1`, [pro.id]
  );
  const added = Math.round((done[0].subscription_ends_at.getTime() - new Date(endsBefore).getTime()) / DAY);

  check("D.3 the month is granted from the panel", added === 30, `+${added} days`);
  check("D.4 exactly one renewal recorded", doneBlob.renewals?.length === 1,
    `renewals=${doneBlob.renewals?.length}`);
  check("D.5 the flags are cleared by the approval", doneBlob.renewal_pending === undefined);
  check("D.6 the weigh-in log survived the approval",
    JSON.stringify(doneBlob.weightLogs) === JSON.stringify(WEIGHT_LOGS));

  /* --------------------------------------------------------------- noise -- */

  const real = errors.filter((e) => !/favicon|Download the React DevTools|_next\/image/i.test(e));
  check("E.1 no page errors during the run", real.length === 0, real.slice(0, 2).join(" | "));

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

  console.log("\nCLEANUP — by id, from this run's manifest, and from nothing else");
  try {
    const p = m.profiles.map((r) => r.id);
    const a = m.accounts.map((r) => r.id);
    if (p.length) {
      const r = await q(`delete from public.profiles where id = any($1::uuid[]) returning id`, [p]);
      console.log(`  profiles   ${r.length} / ${p.length}`);
    }
    if (a.length) {
      const r = await q(`delete from public.accounts where id = any($1::uuid[]) returning id`, [a]);
      console.log(`  accounts   ${r.length} / ${a.length}`);
    }
    const [left] = await q(
      `select (select count(*) from public.accounts where username like $1)
            + (select count(*) from public.profiles where username like $1) as n`,
      [`${RUN}%`]
    );
    console.log(`  remaining for this run: ${left.n}`);
    if (Number(left.n) !== 0) exitCode = 1;
    if (fs.existsSync(MANIFEST)) fs.unlinkSync(MANIFEST);
  } catch (e) {
    console.error(`  CLEANUP FAILED — manifest kept at ${MANIFEST}: ${e.message}`);
    exitCode = 1;
  }

  await end();
  process.exit(exitCode);
}

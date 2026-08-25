/* The panel keeps itself current without a reload.
 *
 * Two halves. The endpoint is checked on its own — who may ask, what it
 * answers, and that the answer moves when the data does. Then the coach's
 * subscriber page is opened and left alone while the trainee's record changes
 * underneath it, and the page is expected to show the change with no
 * navigation of any kind.
 *
 * Everything is created here and deleted in the `finally`.
 *
 *   node tests/http/live-updates.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const { q, end } = await db();
const RUN = "LIVE_" + crypto.randomBytes(3).toString("hex").toUpperCase();
let fails = 0;
const check = (n, ok, note = "") => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${n}${note ? " — " + note : ""}`);
  if (!ok) fails++;
};

const made = { accounts: [], profiles: [] };
let browser;

try {
  const hash = await bcrypt.hash("TestOnly_" + RUN, 10);
  const mkAcc = async (tag) => {
    const [a] = await q(
      `insert into public.accounts (username,password,password_changed_at)
       values ($1,$2,now()-interval '1 hour') returning id`,
      [`${RUN}_${tag}`, hash]
    );
    made.accounts.push(a.id);
    return a;
  };
  const mkProfile = async (acc, tag, name) => {
    const [p] = await q(
      `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
       values ($1, $2::jsonb, $3, now() + interval '30 days', false) returning id`,
      [`${RUN}_${tag}`, JSON.stringify({ fullname: name, __test_run: RUN }), acc.id]
    );
    made.profiles.push(p.id);
    return p.id;
  };

  const adminAcc = await mkAcc("admin");
  const tAcc = await mkAcc("t1");
  const otherAcc = await mkAcc("t2");
  const trainee = await mkProfile(tAcc, "t1", `${RUN} BEFORE`);
  const other = await mkProfile(otherAcc, "t2", `${RUN} OTHER`);

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-gpu"] });

  const ask = (page, qs) =>
    page.evaluate(async (base, tail) => {
      const r = await fetch(`${base}/api/live${tail}`, { cache: "no-store" });
      let body = null;
      try { body = await r.json(); } catch { /* a non-JSON body is a failure the status already reports */ }
      return { status: r.status, v: body && body.v ? body.v : null };
    }, BASE_URL, qs);

  /* ── who may ask ────────────────────────────────────────────────────── */
  const anon = await browser.newPage();
  await anon.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  check("anonymous is refused", (await ask(anon, "?scope=me")).status === 401);

  const tPage = await browser.newPage();
  await tPage.setCookie({ name: "gym_session", value: mintSession({ id: tAcc.id, username: `${RUN}_t1` }), domain: "localhost", path: "/" });
  await tPage.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 1500));

  check("trainee cannot ask for the panel scope", (await ask(tPage, "?scope=panel")).status === 403);
  check("trainee cannot watch another trainee", (await ask(tPage, `?scope=profile&id=${other}`)).status === 403);
  const own = await ask(tPage, `?scope=profile&id=${trainee}`);
  check("trainee may watch themselves", own.status === 200 && typeof own.v === "string", `v=${own.v}`);
  check("a malformed id is rejected", (await ask(tPage, "?scope=profile&id=not-a-uuid")).status === 400);
  check("an unknown scope is rejected", (await ask(tPage, "?scope=everything")).status === 400);

  const aPage = await browser.newPage();
  await aPage.setCookie({ name: "gym_session", value: mintSession({ id: adminAcc.id, username: "admin" }), domain: "localhost", path: "/" });
  await aPage.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2000));
  const p1 = await ask(aPage, `?scope=profile&id=${trainee}`);
  check("coach may watch any trainee", p1.status === 200 && typeof p1.v === "string");

  /* ── the answer is a fingerprint and nothing else ───────────────────── */
  const raw = await aPage.evaluate(
    async (base, id) => (await fetch(`${base}/api/live?scope=profile&id=${id}`, { cache: "no-store" })).text(),
    BASE_URL, trainee
  );
  check(
    "response carries no data, only a hash",
    !raw.includes("BEFORE") && !raw.includes(RUN) && Object.keys(JSON.parse(raw)).join() === "v",
    raw.slice(0, 60)
  );

  /* ── it moves when the data moves ───────────────────────────────────── */
  await q(
    `update public.profiles set data = jsonb_set(data,'{weightLogs}','[{"date":"2026-08-01","weight":81}]'::jsonb) where id=$1`,
    [trainee]
  );
  const p2 = await ask(aPage, `?scope=profile&id=${trainee}`);
  check("fingerprint changes when a weight is logged", p2.v !== p1.v, `${p1.v} -> ${p2.v}`);
  const p3 = await ask(aPage, `?scope=profile&id=${trainee}`);
  check("fingerprint is stable while nothing changes", p3.v === p2.v);

  const oth1 = await ask(aPage, `?scope=profile&id=${other}`);
  await q(
    `update public.profiles set data = jsonb_set(data,'{weightLogs}','[{"date":"2026-08-02","weight":70}]'::jsonb) where id=$1`,
    [trainee]
  );
  const oth2 = await ask(aPage, `?scope=profile&id=${other}`);
  check("one trainee's change does not move another's fingerprint", oth1.v === oth2.v);

  /* ── the page updates itself, with no navigation ────────────────────── */
  const watch = await browser.newPage();
  await watch.setCookie({ name: "gym_session", value: mintSession({ id: adminAcc.id, username: "admin" }), domain: "localhost", path: "/" });
  await watch.goto(`${BASE_URL}/admin/profile/${trainee}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await watch.waitForFunction(() => (document.body.innerText || "").trim().length > 60, { timeout: 90000, polling: 500 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));

  const shows = () => watch.evaluate(() => document.body.innerText);
  check("page shows the original name", (await shows()).includes("BEFORE"));

  /* A marker on `window`, so that "it updated" cannot be confused with "it
     reloaded". Anything that re-executes the document wipes this; a refresh
     that only re-runs the server components and reconciles leaves it. Stronger
     evidence than counting navigations, which Next fires for its own RSC
     round-trip on the same URL. Scroll position is recorded for the same
     reason — a reload sends it to the top. */
  await watch.evaluate(() => {
    window.__liveMarker = "kept";
    /* `.admin-main-content` is the scroller here, not the window: the admin
       shell is `position: fixed; inset: 0; overflow: hidden`, so `window.scrollY`
       on these pages is always 0 and would prove nothing either way. */
    const sc = document.querySelector(".admin-main-content");
    if (sc) sc.scrollTop = 220;
  });

  await q(
    `update public.profiles set data = jsonb_set(data,'{fullname}',$2::jsonb) where id=$1`,
    [trainee, JSON.stringify(`${RUN} AFTER`)]
  );

  /* The poll interval is deliberately long in development. Coming back to a tab
     asks at once, which is the same code path a coach exercises by looking back
     at the window — so the wait is skipped, not the mechanism. */
  await aPage.bringToFront();
  await new Promise((r) => setTimeout(r, 500));
  await watch.bringToFront();

  let updated = false;
  for (let i = 0; i < 40 && !updated; i++) {
    await new Promise((r) => setTimeout(r, 500));
    updated = (await shows()).includes("AFTER");
  }
  check("coach's open page shows the change on its own", updated);

  const after = await watch.evaluate(() => {
    const sc = document.querySelector(".admin-main-content");
    return { marker: window.__liveMarker || null, scroll: sc ? Math.round(sc.scrollTop) : -1 };
  });
  check("and did not reload to do it", after.marker === "kept",
        after.marker === "kept" ? "window state survived" : "marker lost — the document re-executed");
  check("scroll position was left where it was", after.scroll > 0, `scrollTop ${after.scroll}`);

  /* ── and the other direction ────────────────────────────────────────
     The coach changes something; the trainee's own dashboard is a client
     component reading `/api/profile`, so what has to happen there is a
     re-fetch rather than a server re-render. Same hook, different callback. */
  const dash = await browser.newPage();
  await dash.setCookie({ name: "gym_session", value: mintSession({ id: tAcc.id, username: `${RUN}_t1` }), domain: "localhost", path: "/" });
  await dash.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await dash.waitForFunction(() => (document.body.innerText || "").includes("AFTER"), { timeout: 90000, polling: 500 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
  check("trainee's dashboard shows their name", (await dash.evaluate(() => document.body.innerText)).includes("AFTER"));

  await dash.evaluate(() => { window.__liveMarker = "kept"; });
  await q(
    `update public.profiles set data = jsonb_set(data,'{fullname}',$2::jsonb) where id=$1`,
    [trainee, JSON.stringify(`${RUN} COACHEDIT`)]
  );

  await watch.bringToFront();
  await new Promise((r) => setTimeout(r, 500));
  await dash.bringToFront();

  let dashUpdated = false;
  for (let i2 = 0; i2 < 40 && !dashUpdated; i2++) {
    await new Promise((r) => setTimeout(r, 500));
    dashUpdated = (await dash.evaluate(() => document.body.innerText)).includes("COACHEDIT");
  }
  check("trainee's open dashboard picks up the coach's change", dashUpdated);
  check("and it did not reload either",
        (await dash.evaluate(() => window.__liveMarker || null)) === "kept");

  console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
} finally {
  if (browser) await browser.close();
  if (made.profiles.length) await q(`delete from public.profiles where id=any($1::uuid[])`, [made.profiles]);
  if (made.accounts.length) await q(`delete from public.accounts where id=any($1::uuid[])`, [made.accounts]);
  console.log(`CLEANUP — ${made.profiles.length} profiles, ${made.accounts.length} accounts removed`);
  await end();
}
process.exit(fails === 0 ? 0 : 1);

/* Search that finds what the coach meant, and still refuses what they did not.
 *
 * Every search box compared with `includes()` after `toLowerCase()`, which asks
 * for the same characters in the same order. Arabic writes one word several
 * ways — أضخم / اضخم, ة / ه, ى / ي — so a search typed without a hamza found
 * nothing, which is what "لا يعمل" meant.
 *
 * Two halves, and the second is the one that could quietly go wrong: folding
 * too hard makes everything match everything, and a search that answers every
 * query looks like it works until you notice it never says no. So each case is
 * paired — the spelling variants find the course, and a word belonging to no
 * course still finds nothing.
 *
 * Also checks what the coach asked to have removed from the page.
 *
 *   node tests/http/arabic-search.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const RUN = "ARS_" + crypto.randomBytes(3).toString("hex").toUpperCase();

const { q, end } = await db();

const results = [];
const check = (test, pass, note = "") => {
  results.push({ test, pass, note });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${test}${note ? ` — ${note}` : ""}`);
};

console.log("=".repeat(72));
console.log("ARABIC SEARCH — SPELLING VARIANTS, AND STILL DISCRIMINATING");
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(72));

let exitCode = 0;
let browser;
const made = { accounts: [], courses: [] };

/* Each name carries a form that is commonly typed another way: the hamza on the
   alif, the taa marbuta, and the alif maqsura. */
const COURSES = [
  `${RUN} أضخم عضلة`,
  `${RUN} تقوية القوة الكبرى`,
  `${RUN} برنامج الرشاقه`,
];

try {
  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);
  const [acc] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id`,
    [`${RUN}_a`, hash]
  );
  made.accounts.push(acc.id);

  for (const name of COURSES) {
    const [c] = await q(
      `insert into public.courses (name, days_data) values ($1, $2::jsonb) returning id`,
      [name, JSON.stringify([{ day: "يوم", exercises: [] }])]
    );
    made.courses.push(c.id);
  }
  console.log(`\nSEEDED  ${COURSES.length} courses`);
  for (const n of COURSES) console.log(`   ${n}`);

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: "admin" }),
    domain: "localhost", path: "/",
  });
  await page.goto(`${BASE_URL}/admin/courses`, { waitUntil: "networkidle0", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1200));

  /** Types a query and returns how many of this run's courses survive it. */
  const search = async (term) => {
    await page.evaluate(() => {
      const i = document.querySelector(".co-search input");
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      ).set;
      setter.call(i, "");
      i.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const input = await page.$(".co-search input");
    await input.click();
    await input.type(term, { delay: 25 });
    await new Promise((r) => setTimeout(r, 500));
    return page.evaluate((run) => {
      const names = [...document.querySelectorAll(".co-card")].map((c) => c.innerText);
      return names.filter((n) => n.includes(run)).length;
    }, RUN);
  };

  /* ============================================ A — variants are found === */

  console.log("\nA — the same word, spelled the way people type it");

  const cases = [
    ["أضخم", 1, "exactly as stored"],
    ["اضخم", 1, "plain alif for أ"],
    ["الكبرى", 1, "exactly as stored"],
    ["الكبري", 1, "yaa for alif maqsura ى"],
    ["الرشاقه", 1, "exactly as stored"],
    ["الرشاقة", 1, "taa marbuta for ه"],
    ["تقويه", 1, "haa for taa marbuta ة"],
  ];

  for (const [term, expected, why] of cases) {
    const n = await search(term);
    check(`A — "${term}" finds ${expected} (${why})`, n === expected, `got ${n}`);
  }

  /* ================================= B — and it still says no ============ */

  console.log("\nB — folding did not turn the search into a yes-machine");

  const negatives = [
    ["سباحه", "a word in none of them"],
    ["زززز", "nonsense"],
    ["أضخمم", "one letter too many"],
  ];
  for (const [term, why] of negatives) {
    const n = await search(term);
    check(`B — "${term}" finds nothing (${why})`, n === 0, `got ${n}`);
  }

  /* One query must not sweep in the others: "أضخم" belongs to one course only. */
  const one = await search("أضخم");
  check("B — a specific query returns one course, not the whole library",
    one === 1, `got ${one}`);

  /* ========================== C — what the coach asked to be removed ===== */

  console.log("\nC — the page no longer carries what was asked to go");

  await page.evaluate(() => {
    const i = document.querySelector(".co-search input");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value"
    ).set;
    setter.call(i, "");
    i.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 400));
  const body = await page.evaluate(() => document.body.innerText);

  check("C.1 the strapline is gone",
    !body.includes("إدارة الخطط التدريبية وتعيينها للمشتركين"));
  check("C.2 the 'مُعيَّن' count is gone", !body.includes("مُعيَّن"));
  check("C.3 the 'خلال ٣٠ يوماً' count is gone", !body.includes("خلال ٣٠ يوماً"));
  check("C.4 the assignment-state filter row is gone", !body.includes("حالة التعيين"));

  /* What must survive them — deleting the whole toolbar would pass C.1–C.4. */
  check("C.5 the course count survived", /\d+\s*كورس/.test(body));
  check("C.6 the sort control survived", body.includes("الأحدث"));
  check("C.7 the cards are still listed",
    await page.evaluate(() => document.querySelectorAll(".co-card").length > 0));

  check("D.1 no page errors during the run", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();

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
  console.log("\nCLEANUP — by id");
  try {
    if (made.courses.length) {
      const r = await q(`delete from public.courses where id = any($1::uuid[]) returning id`, [made.courses]);
      console.log(`  courses  ${r.length} / ${made.courses.length}`);
    }
    if (made.accounts.length) {
      const r = await q(`delete from public.accounts where id = any($1::uuid[]) returning id`, [made.accounts]);
      console.log(`  accounts ${r.length} / ${made.accounts.length}`);
    }
    const [left] = await q(
      `select (select count(*) from public.accounts where username like $1)
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

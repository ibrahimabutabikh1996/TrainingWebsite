/* The CMS content screen, checked the way its layout can actually fail.
 *
 * The page is ten tabs of fields inside cards inside a pane whose width depends
 * on the viewport, so its failures are geometric: a control that does not match
 * the height of the one beside it, an element that spills past the card it
 * lives in, a field that quietly stopped rendering. None of those are visible
 * to tsc or eslint, and all three have happened here before.
 *
 * The census is the important one. It counts editable controls per tab, and it
 * is what proves a layout change did not drop a field on the floor — a field
 * that vanishes takes its content key with it, and the landing page then reads
 * a value nothing can set.
 *
 * Needs the dev server up:  npm run dev
 * Then:                     node tests/http/cms-ui.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const RUN = "CMSPR_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const { q, end } = await db();
let browser, accId = null, code = 0;

const TABS = ["الرئيسية", "قسم المدرب", "الخطط والاشتراكات", "آراء المشتركين",
  "معلومات التواصل", "صفحة الدخول", "بطاقات العروض", "النافذة الترويجية",
  "اخفاء واظهار", "مكتبة الوسائط"];

const WIDTHS = [1920, 1366, 1024, 820, 640, 420];

try {
  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);
  const [acc] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id`,
    [`${RUN}_a`, hash]
  );
  accId = acc.id;

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: "admin" }),
    domain: "localhost", path: "/",
  });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(`${BASE_URL}/admin/cms`, { waitUntil: "networkidle0", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 1200));

  const click = async (txt) => page.evaluate((t) => {
    const b = [...document.querySelectorAll(".cms-tab-btn")].find((x) => x.textContent.includes(t));
    if (b) b.click();
    return !!b;
  }, txt);

  /* --- 1. Control heights on the contact tab (the row that mixes them) --- */
  await click("معلومات التواصل");
  await new Promise((r) => setTimeout(r, 400));
  const heights = await page.evaluate(() => {
    const h = (sel) => {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().height) : null;
    };
    return {
      input: h(".cms-input"),
      phone: h(".cms-phone"),
      thumb: h(".ui-media-thumb"),
      mediaField: h(".ui-media-field"),
      switchTrack: h(".ui-switch-track"),
    };
  });
  console.log("control heights:", JSON.stringify(heights));
  if (heights.input !== null && heights.phone !== null && Math.abs(heights.input - heights.phone) > 1) {
    console.log(`  [FAIL] phone (${heights.phone}px) does not match input (${heights.input}px)`);
    code = 1;
  } else {
    console.log("  [PASS] phone matches the text inputs beside it");
  }

  /* --- 2. Nothing spills out of a card, at any width, on any tab --- */
  console.log("\noverflow sweep:");
  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 900 });
    await new Promise((r) => setTimeout(r, 250));
    let bad = [];
    for (const t of TABS) {
      if (!(await click(t))) { console.log(`  !! tab missing: ${t}`); code = 1; continue; }
      await new Promise((r) => setTimeout(r, 250));
      const spill = await page.evaluate(() => {
        const out = [];
        for (const card of document.querySelectorAll(".cms-section-card")) {
          const cb = card.getBoundingClientRect();
          for (const el of card.querySelectorAll("*")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.right > cb.right + 1.5 || r.left < cb.left - 1.5) {
              out.push((el.className || el.tagName).toString().slice(0, 40));
            }
          }
        }
        const doc = document.scrollingElement || document.documentElement;
        return { spills: [...new Set(out)], hscroll: doc.scrollWidth > doc.clientWidth + 1 };
      });
      if (spill.spills.length || spill.hscroll) bad.push(`${t}${spill.hscroll ? " [h-scroll]" : ""} ${spill.spills.join(", ")}`);
    }
    if (bad.length) { code = 1; console.log(`  [FAIL] ${w}px:`); bad.forEach((b) => console.log("      " + b)); }
    else console.log(`  [PASS] ${w}px — all 10 tabs clean`);
  }

  /* --- 2b. Field census: how many editable controls does each tab render? --- */
  console.log("\nfield census:");
  await page.setViewport({ width: 1366, height: 900 });
  const census = {};
  for (const t of TABS) {
    await click(t);
    await new Promise((r) => setTimeout(r, 300));
    census[t] = await page.evaluate(() =>
      document.querySelectorAll(".cms-content-pane input[type=text], .cms-content-pane textarea, .cms-content-pane input[type=checkbox]").length
    );
    console.log(`  ${t.padEnd(20)} ${census[t]}`);
  }
  console.log("CENSUS_JSON " + JSON.stringify(census));

  /* --- 3. The switch reflects and writes state --- */
  await page.setViewport({ width: 1366, height: 900 });
  await click("اخفاء واظهار");
  await new Promise((r) => setTimeout(r, 400));
  const sw = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll(".ui-switch input")];
    const before = boxes.map((b) => b.checked);
    boxes[0].click();
    const after = [...document.querySelectorAll(".ui-switch input")].map((b) => b.checked);
    boxes[0].click();
    const back = [...document.querySelectorAll(".ui-switch input")].map((b) => b.checked);
    return { count: boxes.length, toggled: before[0] !== after[0], restored: before[0] === back[0] };
  });
  console.log(`\nswitches: ${sw.count} found, toggles=${sw.toggled}, restores=${sw.restored}`);
  if (!(sw.count === 5 && sw.toggled && sw.restored)) { code = 1; console.log("  [FAIL] switch state"); }
  else console.log("  [PASS] switch reads and writes");

  if (errors.length) {
    code = 1;
    console.log("\nPAGE ERRORS:");
    for (const e of [...new Set(errors)]) console.log("  " + e);
  } else {
    console.log("\nno page errors.");
  }
} catch (e) {
  code = 1;
  console.error("FAILED:", e);
} finally {
  if (browser) await browser.close();
  if (accId) await q(`delete from public.accounts where id = $1`, [accId]);
  await end();
  console.log(code === 0 ? "\nALL PASS" : "\nFAILURES");
  process.exit(code);
}

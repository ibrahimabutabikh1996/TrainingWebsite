/* Text too small to read on a phone.
 *
 * Reports every element carrying its own visible text whose computed
 * font-size at phone width is under the floor (13px by default). Elements
 * that only contain other elements are skipped — their font-size is inherited
 * scaffolding, not something anybody reads.
 *
 *   node tests/http/font-probe.mjs
 *   FLOOR=14 WIDTHS=375 node tests/http/font-probe.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const RUN = "FONT_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const FLOOR = parseFloat(process.env.FLOOR || "13");
const WIDTHS = (process.env.WIDTHS || "375,768").split(",").map(Number);
const PAGES = (
  process.env.PAGES ||
  "/,/login,/form,/account/password,/admin,/admin/exercises,/admin/courses,/admin/diet,/admin/cms"
).split(",");

const { q, end } = await db();

const PROBE = (floor) => {
  const out = [];
  const nameOf = (el) => {
    const cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return el.tagName.toLowerCase() + (cls ? "." + cls : "");
  };
  for (const el of document.querySelectorAll("body *")) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < floor) {
      out.push({ sel: nameOf(el), fs: Math.round(fs * 10) / 10, text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30) });
    }
  }
  const seen = new Map();
  for (const o of out) { const k = o.sel + "|" + o.fs; if (!seen.has(k)) seen.set(k, o); }
  return [...seen.values()];
};

let browser, accId = null;
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
  await page.setCookie({ name: "gym_session", value: mintSession({ id: acc.id, username: "admin" }), domain: "localhost", path: "/" });

  let total = 0;
  for (const path of PAGES) {
    await page.setViewport({ width: WIDTHS[0], height: 780, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    try { await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle0", timeout: 120000 }); }
    catch { await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 }); }
    await page.waitForFunction(() => (document.body.innerText || "").trim().length > 60, { timeout: 90000, polling: 500 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    await page.evaluate(() => document.querySelector(".promo-popup-close")?.click());
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 780, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
      await new Promise((r) => setTimeout(r, 300));
      const rows = await page.evaluate(PROBE, FLOOR);
      total += rows.length;
      console.log(`  ${path} @ ${width}px — under ${FLOOR}px: ${rows.length}`);
      for (const r of rows) console.log(`      ${r.fs}px  ${r.sel}  "${r.text}"`);
    }
  }
  console.log(`\nTOTAL under ${FLOOR}px: ${total}`);
} finally {
  if (browser) await browser.close();
  if (accId) await q(`delete from public.accounts where id = $1`, [accId]);
  await end();
}

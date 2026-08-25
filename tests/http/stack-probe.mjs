/* Which containers are still side-by-side on a phone.
 *
 * `responsive-audit.mjs` answers "does it fit"; a two-column grid squeezed into
 * 375px fits and is still unreadable. This asks the other question: at each
 * width, which grid resolved to more than one track, and which flex row is
 * still laying its children out horizontally when they are narrow enough that
 * they should have stacked.
 *
 *   node tests/http/stack-probe.mjs
 *   WIDTHS=768 PAGES=/,/dashboard node tests/http/stack-probe.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const RUN = "STCK_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const WIDTHS = (process.env.WIDTHS || "375,768").split(",").map(Number);
const PAGES = (
  process.env.PAGES ||
  "/,/login,/form,/account/password,/admin,/admin/exercises,/admin/courses,/admin/diet,/admin/diet/plan,/admin/builder,/admin/cms"
).split(",");
const HEIGHT = parseInt(process.env.HEIGHT || "780", 10);

const { q, end } = await db();

const PROBE = () => {
  const nameOf = (el) => {
    const cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "");
  };
  const vw = document.documentElement.clientWidth;
  const grids = [];
  const rows = [];

  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 10) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;
    if (cs.position === "fixed") continue;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (getComputedStyle(p).position === "fixed") { p = null; break; }
    }

    if (cs.display === "grid" || cs.display === "inline-grid") {
      const tracks = (cs.gridTemplateColumns || "").split(" ").filter((t) => t && t !== "none");
      if (tracks.length > 1) {
        /* A track narrower than ~150px is a chip row or an icon strip, not a
           column of content that wanted to stack. */
        const widest = Math.max(...tracks.map((t) => parseFloat(t) || 0));
        grids.push({ sel: nameOf(el), cols: tracks.length, track: Math.round(widest), w: Math.round(r.width) });
      }
    }

    if (cs.display === "flex" && (cs.flexDirection === "row" || cs.flexDirection === "row-reverse")) {
      const kids = [...el.children].filter((c) => {
        const kr = c.getBoundingClientRect();
        return kr.width > 0 && kr.height > 0;
      });
      if (kids.length < 2) continue;
      if (cs.flexWrap !== "nowrap") continue;
      /* Two or more real children sharing one line, each already under 200px:
         the row is being asked to do more than the width allows. */
      const widths = kids.map((c) => c.getBoundingClientRect().width);
      const tops = kids.map((c) => Math.round(c.getBoundingClientRect().top));
      const sameLine = new Set(tops).size === 1;
      if (sameLine && Math.max(...widths) < 200 && kids.length >= 2 && r.width > 200) {
        rows.push({ sel: nameOf(el), kids: kids.length, widest: Math.round(Math.max(...widths)), w: Math.round(r.width) });
      }
    }
  }

  const dedupe = (arr) => {
    const seen = new Map();
    for (const a of arr) if (!seen.has(a.sel)) seen.set(a.sel, a);
    return [...seen.values()];
  };
  return { vw, grids: dedupe(grids), rows: dedupe(rows) };
};

let browser, accId = null;
try {
  let acc;
  if (process.env.AS) {
    [acc] = await q(`select id, username from public.accounts where username = $1`, [process.env.AS]);
    if (!acc) throw new Error(`No account named ${process.env.AS}`);
  } else {
    const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);
    [acc] = await q(
      `insert into public.accounts (username, password, password_changed_at)
       values ($1, $2, now() - interval '1 hour') returning id`,
      [`${RUN}_a`, hash]
    );
    accId = acc.id;
  }

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: acc.username || "admin" }),
    domain: "localhost",
    path: "/",
  });

  for (const path of PAGES) {
    console.log("\n" + "-".repeat(78));
    console.log(`PAGE ${path}`);
    console.log("-".repeat(78));
    await page.setViewport({ width: WIDTHS[0], height: HEIGHT, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    try {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle0", timeout: 120000 });
    } catch {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    }
    await page
      .waitForFunction(() => (document.body.innerText || "").trim().length > 60, { timeout: 90000, polling: 500 })
      .catch(() => console.log("  (page never filled)"));
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => document.querySelector(".promo-popup-close")?.click());

    for (const width of WIDTHS) {
      await page.setViewport({ width, height: HEIGHT, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
      await new Promise((r) => setTimeout(r, 350));
      const res = await page.evaluate(PROBE);
      console.log(`  ${String(width).padStart(4)}px  multi-col grids ${res.grids.length}   tight rows ${res.rows.length}`);
      for (const g of res.grids) console.log(`      GRID ${g.sel}  ${g.cols} cols  widest track ${g.track}px  (box ${g.w}px)`);
      for (const r2 of res.rows) console.log(`      ROW  ${r2.sel}  ${r2.kids} kids  widest ${r2.widest}px  (box ${r2.w}px)`);
    }
  }
} finally {
  if (browser) await browser.close();
  if (accId) {
    await q(`delete from public.accounts where id = $1`, [accId]);
    console.log("\nCLEANUP — 1 account removed");
  }
  await end();
}

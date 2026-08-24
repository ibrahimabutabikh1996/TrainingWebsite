/* Proof that the desktop layout did not move.
 *
 * The responsive work is meant to be invisible above the phone breakpoints, and
 * "meant to be" is not a measurement. This records the geometry of every
 * element that matters on each screen at desktop widths — box, padding, font
 * size, the grid a container resolved to — and writes it as JSON.
 *
 * Run it twice, once against each tree, and diff the two files:
 *
 *   node tests/http/desktop-invariance.mjs after.json
 *   git stash && node tests/http/desktop-invariance.mjs before.json && git stash pop
 *   node tests/http/desktop-invariance.mjs --diff before.json after.json
 *
 * A clean run prints nothing but the count. Anything listed is a desktop pixel
 * that changed, which on this task is a defect until argued otherwise.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

/* ------------------------------------------------------------------ diff -- */

if (process.argv[2] === "--diff") {
  const before = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
  const after = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  let changed = 0;
  let checked = 0;
  for (const k of [...keys].sort()) {
    const a = before[k];
    const b = after[k];
    if (a === undefined || b === undefined) {
      console.log(`  ONLY IN ${a === undefined ? "after" : "before"}: ${k}`);
      changed++;
      continue;
    }
    for (const prop of new Set([...Object.keys(a), ...Object.keys(b)])) {
      checked++;
      if (String(a[prop]) !== String(b[prop])) {
        console.log(`  ${k}  ${prop}:  ${a[prop]}  ->  ${b[prop]}`);
        changed++;
      }
    }
  }
  console.log(`\n${checked} measurements compared, ${changed} changed.`);
  process.exit(changed ? 1 : 0);
}

/* --------------------------------------------------------------- capture -- */

const OUT = process.argv[2] || "desktop-snapshot.json";
const RUN = "DINV_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const WIDTHS = (process.env.WIDTHS || "1280,1440").split(",").map(Number);

/* Every page, and the selectors on it whose position is the design. */
const PAGES = {
  "/": [
    ".landing-wrapper nav", ".nav-logo", ".nav-logo-mark", ".nav-links", ".nav-links a",
    ".nav-actions", ".nav-cta", ".hero", ".hero-content", ".hero-content h1", ".hero-sub",
    ".hero-btns", ".btn-primary", ".hero-scroll-cue", ".hero-scroll-cue .cue-arrow",
    ".coach-layout", ".coach-image-wrapper", ".coach-img", ".coach-stats li strong",
    ".membership-grid", ".membership-card", ".membership-card-img", ".price-amount",
    ".btn-card", ".testimonials-grid", ".testimonial-card", ".contact-layout",
    ".contact-item", ".footer-top", ".footer-grid", ".footer-brand", "#coach", "#membership",
  ],
  "/login": [".login-panel", ".field", ".field input", ".field-toggle", ".btn-submit", ".form-eyebrow"],
  "/form": [".form-page .control .form-input", ".form-page .card", ".form-page .step-head"],
  "/account/password": [".pw-card", ".pw-input-wrap", ".pw-input-wrap input", ".pw-toggle", ".pw-submit"],
  "/admin": [
    ".admin-bottom-nav", ".admin-nav-container", ".admin-nav-link", ".admin-logout-btn",
    ".admin-collapsed-logo-tile", ".admin-brand-header", ".admin-bottom-actions",
    ".admin-main-content", ".crm-dashboard", ".crm-hero-header", ".crm-hero-title",
    ".crm-toolbar", ".crm-search-box", ".crm-search-input", ".crm-list-card",
    ".crm-card-avatar", ".crm-hero-stat .stat-val",
  ],
  "/admin/exercises": [
    ".ex-page", ".ex-header", ".ex-toolbar", ".ex-search input", ".ex-segment",
    ".ex-segment button", ".ex-grid", ".ex-card", ".ex-icon-btn", ".ex-video",
    ".mtabs", ".mtabs-nav", ".mtabs-track", ".mtabs-tile", ".mtabs-tile-img", ".mtabs-tile-label",
  ],
  "/admin/courses": [".co-page", ".co-toolbar", ".co-search input", ".co-grid", ".co-card", ".co-icon-btn", ".co-segment button"],
  "/admin/diet": [".diet-page", ".diet-header", ".diet-header-actions", ".diet-add-btn", ".diet-btn-secondary", ".diet-toolbar", ".diet-search", ".diet-search input", ".diet-segment button", ".diet-grid"],
  "/admin/cms": [".cms-container", ".cms-tabs", ".cms-sidebar", ".cms-tab-btn", ".cms-tab-nav", ".cms-content-pane", ".cms-section-card", ".cms-input"],
  "/admin/builder": [".bldr-page, .co-page", ".admin-main-content > *"],
  "/admin/diet/plan": [".dplan-page, .diet-page", ".admin-main-content > *"],
};

/* The trainee's dashboard cannot be reached with the session the rest of this
   file uses: `/dashboard` sends an admin username straight to `/admin`, so
   measuring it needs a second cookie and a second page. Named separately rather
   than folded into PAGES because the account is not created here — it is an
   existing trainee, read only, chosen for having a course and a diet plan so
   the tabs have something in them to measure. */
const TRAINEE = process.env.TRAINEE || "mfgym";

const TRAINEE_PAGES = {
  "/dashboard": [
    ".dashboard-page", ".dashboard-main", ".dash-bottom-nav", ".dash-nav-container",
    ".dash-nav-link", ".dash-collapsed-logo-tile", ".dash-nav-link .app-icon",
    ".dashboard-card", ".dashboard-card-title", ".home-overview-container",
    ".home-stats-grid", ".home-stat-card", ".home-card-title", ".home-sub-item",
    ".home-progress-bar-track", ".dashboard-grid",
  ],
};

const MEASURE = (selectors) => {
  const out = {};
  const round = (n) => Math.round(n * 100) / 100;
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) {
      out[sel] = { missing: true };
      continue;
    }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out[sel] = {
      x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height),
      pad: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      mar: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
      font: cs.fontSize,
      weight: cs.fontWeight,
      color: cs.color,
      bg: cs.backgroundColor,
      radius: cs.borderRadius,
      display: cs.display,
      cols: cs.gridTemplateColumns,
      flex: cs.flex,
      overflow: `${cs.overflowX}/${cs.overflowY}`,
      /* The page's own horizontal fit, recorded once per selector so a diff
         cannot miss it. */
      docScrollWidth: document.documentElement.scrollWidth,
    };
  }
  return out;
};

const { q, end } = await db();
let browser;
let accId = null;

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
  await page.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: "admin" }),
    domain: "localhost",
    path: "/",
  });

  const snapshot = {};
  for (const [path, selectors] of Object.entries(PAGES)) {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
      try {
        await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle0", timeout: 120000 });
      } catch {
        await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      }
      await new Promise((r) => setTimeout(r, 1600));
      await page.evaluate(() => document.querySelector(".promo-popup-close")?.click());
      await new Promise((r) => setTimeout(r, 400));

      const res = await page.evaluate(MEASURE, selectors);
      for (const [sel, val] of Object.entries(res)) snapshot[`${path} @${width} ${sel}`] = val;
      console.log(`  captured ${path} @ ${width}px  (${Object.keys(res).length} selectors)`);
    }
  }

  /* The dashboard, as the trainee who owns it. Same measurements, same widths;
     only the cookie differs. A missing account is a skip rather than a failure
     — the snapshot simply will not carry those rows, and the diff reports them
     as absent from both sides. */
  const [trainee] = await q(`select id, username from public.accounts where username = $1`, [TRAINEE]);
  if (!trainee) {
    console.log(`\n  (no account named ${TRAINEE} — dashboard not captured)`);
  } else {
    const tctx = await browser.createBrowserContext();
    const tpage = await tctx.newPage();
    await tpage.setCookie({
      name: "gym_session",
      value: mintSession({ id: trainee.id, username: trainee.username }),
      domain: "localhost",
      path: "/",
    });
    for (const [path, selectors] of Object.entries(TRAINEE_PAGES)) {
      for (const width of WIDTHS) {
        await tpage.setViewport({ width, height: 900, deviceScaleFactor: 1 });
        await tpage.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
        await tpage
          .waitForFunction(() => document.querySelector(".dash-nav-link") !== null, {
            timeout: 90000,
            polling: 400,
          })
          .catch(() => console.log("    (dashboard never mounted)"));
        await new Promise((r) => setTimeout(r, 1400));

        const res = await tpage.evaluate(MEASURE, selectors);
        for (const [sel, val] of Object.entries(res)) snapshot[`${path} @${width} ${sel}`] = val;
        console.log(`  captured ${path} @ ${width}px  (${Object.keys(res).length} selectors)`);
      }
    }
    await tctx.close();
  }

  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 1));
  console.log(`\nWrote ${Object.keys(snapshot).length} entries to ${OUT}`);
  await ctx.close();
} catch (error) {
  console.error("\nRUN ABORTED:", error.stack || error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  try {
    if (accId) await q(`delete from public.accounts where id = $1`, [accId]);
  } catch (e) {
    console.error(`  CLEANUP FAILED: ${e.message}`);
  }
  await end();
  process.exit(process.exitCode || 0);
}

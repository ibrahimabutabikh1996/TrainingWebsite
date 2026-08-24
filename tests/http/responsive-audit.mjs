/* Where the page is wider than the phone holding it.
 *
 * Page-level horizontal scrolling is arithmetic, not taste: `documentElement`
 * reports a `scrollWidth` larger than its `clientWidth` because some box inside
 * resolved wider than the viewport and no ancestor clips or scrolls it. This
 * walks every element, keeps the ones that cross a viewport edge with no
 * scrolling ancestor between them and the document, and names them.
 *
 * Counting the bar is only half of it, and on this site it is the misleading
 * half. `overflow-x: hidden` on `body` and a fixed, clipping
 * `.admin-layout-wrapper` mean the document can never report a bar however wide
 * the content gets — so four things are measured, not one:
 *
 *   BLEED  the document's own overflow, as a visitor would scroll it
 *   TRUE   the same measurement with those masks lifted, which is the number
 *          that says whether the layout actually fits
 *   CUT    text and controls whose box extends past an ancestor that clips
 *          without scrolling — content the mask makes unreachable rather than
 *          merely ugly
 *   TAP    interactive boxes below 44px, the touch-target floor
 *
 * `position: fixed` boxes are listed apart: they do not grow the document's
 * scroll area, so they cannot be the cause, but an off-canvas drawer parked
 * outside the viewport is still worth seeing.
 *
 * Read-only. One throwaway account is created for the session and deleted in
 * the `finally`.
 *
 *   node tests/http/responsive-audit.mjs
 *   WIDTHS=320,390 PAGES=/,/form node tests/http/responsive-audit.mjs
 *   QUIET=1 node tests/http/responsive-audit.mjs     # the verdict only
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const RUN = "RESP_" + crypto.randomBytes(3).toString("hex").toUpperCase();

const WIDTHS = (process.env.WIDTHS || "320,360,375,390,414,430,768,1024")
  .split(",")
  .map((n) => parseInt(n, 10));

const PAGES = (
  process.env.PAGES ||
  "/,/login,/form,/account/password,/admin,/admin/exercises,/admin/courses,/admin/diet,/admin/diet/plan,/admin/builder,/admin/cms"
).split(",");

const QUIET = process.env.QUIET === "1";

/* Portrait by default. `HEIGHT=390` with landscape widths measures the same
   pages turned sideways, which is where the viewport-sized boxes and the fixed
   furniture are actually under pressure. */
const HEIGHT = parseInt(process.env.HEIGHT || "780", 10);

/* `COARSE=1` tells the page it is being driven by a thumb.
   The touch-target rules are gated on `pointer: coarse` rather than on a width,
   because a phone in landscape is 667px wide or more and a tablet is wider
   still — and headless Chrome reports a mouse, so without this flag those rules
   never fire and a run at 768px measures the desktop treatment. With it, the
   same widths answer as the tablet they are standing in for.

   Set through the viewport rather than `page.emulateMediaFeatures`: that API
   accepts only the `prefers-*` family and throws on `pointer`. Touch emulation
   is what Chrome actually derives `pointer: coarse` and `hover: none` from —
   verified, both report true with these two flags set. */
const COARSE = process.env.COARSE === "1";

const { q, end } = await db();

console.log("=".repeat(78));
console.log("RESPONSIVE AUDIT — horizontal fit, clipped content, touch targets");
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(78));

let exitCode = 0;
let browser;
let accId = null;

/** Runs in the page. `unmask` lifts the clipping masks before measuring. */
const PROBE = (unmask) => {
  const docEl = document.documentElement;

  let maskNode = null;
  if (unmask) {
    maskNode = document.createElement("style");
    maskNode.textContent =
      "html, body { overflow-x: visible !important; }" +
      ".admin-layout-wrapper { overflow: visible !important; }" +
      ".admin-main-content { overflow-x: visible !important; }";
    document.head.appendChild(maskNode);
    void docEl.offsetWidth;
  }

  const vw = docEl.clientWidth;
  const nameOf = (el) => {
    const cls = (el.getAttribute("class") || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(".");
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "");
  };
  const chain = (el) => {
    const parts = [];
    let p = el;
    for (let i = 0; p && i < 4; i++, p = p.parentElement) parts.unshift(nameOf(p));
    return parts.join(" > ");
  };
  const label = (el) =>
    (el.textContent || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 34);

  const bleeding = [];
  const fixed = [];
  const cut = [];
  const scrollers = [];
  const taps = [];

  const INTERACTIVE = "a,button,input,select,textarea,[role=button],[role=tab],[tabindex]";

  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;

    /* --- does it cross a viewport edge with nothing to catch it? --- */
    const over = Math.max(r.right - vw, -r.left);
    if (over > 1) {
      let clipped = false;
      let posFixed = cs.position === "fixed";
      for (let p = el.parentElement; p && p !== docEl; p = p.parentElement) {
        const pcs = getComputedStyle(p);
        if (pcs.position === "fixed") posFixed = true;
        if (/^(hidden|auto|scroll|clip)$/.test(pcs.overflowX)) {
          clipped = true;
          break;
        }
      }
      if (!clipped) {
        const row = {
          sel: nameOf(el),
          path: chain(el),
          over: Math.round(over),
          w: Math.round(r.width),
          left: Math.round(r.left),
          right: Math.round(r.right),
          text: label(el),
        };
        (posFixed ? fixed : bleeding).push(row);
      }
    }

    /* --- is it cut off by an ancestor that clips without scrolling? --- */
    const carriesContent =
      el.matches(INTERACTIVE) ||
      (el.children.length === 0 && (el.textContent || "").trim().length > 0);
    if (carriesContent) {
      let clipper = null;
      for (let p = el.parentElement; p && p !== docEl; p = p.parentElement) {
        const pcs = getComputedStyle(p);
        if (pcs.overflowX === "hidden" || pcs.overflowX === "clip") {
          clipper = p;
          break;
        }
        if (pcs.overflowX === "auto" || pcs.overflowX === "scroll") break;
      }
      if (clipper) {
        const cr = clipper.getBoundingClientRect();
        const lost = Math.max(r.right - cr.right, cr.left - r.left);
        if (lost > 3) {
          cut.push({
            sel: nameOf(el),
            path: chain(el),
            lost: Math.round(lost),
            clipper: nameOf(clipper),
            text: label(el),
          });
        }
      }
    }

    /* --- horizontal scrollers, wanted or not --- */
    if (/^(auto|scroll)$/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) {
      scrollers.push({ sel: nameOf(el), by: el.scrollWidth - el.clientWidth, cw: el.clientWidth });
    }

    /* --- touch targets --- */
    if (el.matches(INTERACTIVE) && cs.pointerEvents !== "none" && !el.hasAttribute("disabled")) {
      /* A control's target is not always the box it is drawn in. Where growing
         the button would grow the row around it, the pattern here is an empty
         absolutely-positioned `::after` stretched over the centre — invisible,
         and what the finger actually lands on. Measure that instead. */
      const after = getComputedStyle(el, "::after");
      const grown = after.content !== "none" && after.position === "absolute";
      const w = grown ? Math.max(r.width, parseFloat(after.width) || 0) : r.width;
      const h = grown ? Math.max(r.height, parseFloat(after.height) || 0) : r.height;
      const min = Math.min(w, h);
      if (min > 0 && min < 44 && w < 300) {
        taps.push({ sel: nameOf(el), w: Math.round(w), h: Math.round(h), text: label(el) });
      }
    }
  }

  /* The deepest box is the honest culprit; an ancestor is only wide because of
     it. Keep a leaf only when no other offender sits inside it. */
  const deepest = (rows) =>
    rows.filter((b, i) => !rows.some((o, j) => j !== i && o.path.startsWith(b.path + " > ")));

  const leaves = deepest(bleeding);
  const cutLeaves = deepest(cut);

  const result = {
    vw,
    scrollWidth: docEl.scrollWidth,
    leaves: leaves.sort((a, b) => b.over - a.over).slice(0, 10),
    total: leaves.length,
    fixed: fixed.sort((a, b) => b.over - a.over).slice(0, 3),
    cut: cutLeaves.sort((a, b) => b.lost - a.lost).slice(0, 8),
    cutTotal: cutLeaves.length,
    scrollers: scrollers.slice(0, 6),
    taps: taps.slice(0, 8),
    tapTotal: taps.length,
  };

  if (maskNode) maskNode.remove();
  return result;
};

try {
  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);
  const [acc] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id`,
    [`${RUN}_a`, hash]
  );
  accId = acc.id;

  browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: "admin" }),
    domain: "localhost",
    path: "/",
  });

  const summary = [];

  for (const path of PAGES) {
    console.log("\n" + "-".repeat(78));
    console.log(`PAGE ${path}`);
    console.log("-".repeat(78));

    await page.setViewport({ width: WIDTHS[0], height: HEIGHT, deviceScaleFactor: 1, hasTouch: COARSE, isMobile: COARSE });
    try {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle0", timeout: 120000 });
    } catch {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    }
    /* Wait for the page, not for the clock. Every `/admin/*` route has a
       `loading.tsx`, and `networkidle0` resolves while its Suspense fallback is
       still on screen — an empty page reports no overflow and no small targets,
       which reads exactly like a clean one. */
    await page
      .waitForFunction(() => (document.body.innerText || "").trim().length > 60, {
        timeout: 90000,
        polling: 500,
      })
      .catch(() => console.log("  (page never filled — measuring what is there)"));
    await new Promise((r) => setTimeout(r, 1200));

    /* The landing page opens a promotional window over itself. */
    await page.evaluate(() => document.querySelector(".promo-popup-close")?.click());

    for (const width of WIDTHS) {
      await page.setViewport({ width, height: HEIGHT, deviceScaleFactor: 1, hasTouch: COARSE, isMobile: COARSE });
      await new Promise((r) => setTimeout(r, 350));

      const masked = await page.evaluate(PROBE, false);
      const real = await page.evaluate(PROBE, true);

      const bleed = masked.scrollWidth - masked.vw;
      const trueBleed = real.scrollWidth - real.vw;
      const wrong = trueBleed > 0 || real.cutTotal > 0;

      console.log(
        `  [${wrong ? "FAIL" : " ok "}] ${String(width).padStart(4)}px  ` +
          `bleed +${String(Math.max(bleed, 0)).padStart(4)}  ` +
          `true +${String(Math.max(trueBleed, 0)).padStart(4)}  ` +
          `cut ${String(real.cutTotal).padStart(3)}  ` +
          `taps<44 ${String(real.tapTotal).padStart(3)}`
      );

      summary.push({ path, width, bleed, trueBleed, cut: real.cutTotal, taps: real.tapTotal });
      if (QUIET) continue;

      for (const l of real.leaves) {
        console.log(
          `      WIDE  ${l.sel}  +${l.over}px  w=${l.w} [${l.left}..${l.right}]` +
            (l.text ? `  "${l.text}"` : "")
        );
        console.log(`            ${l.path}`);
      }
      for (const c of real.cut) {
        console.log(
          `      CUT   ${c.sel}  -${c.lost}px by ${c.clipper}` + (c.text ? `  "${c.text}"` : "")
        );
        console.log(`            ${c.path}`);
      }
      for (const s of real.scrollers) {
        console.log(`      SCROLLS ${s.sel}  +${s.by}px inside ${s.cw}px`);
      }
      for (const t of real.taps) {
        console.log(`      TAP   ${t.sel}  ${t.w}x${t.h}` + (t.text ? `  "${t.text}"` : ""));
      }
      for (const f of real.fixed) {
        console.log(`      (fixed) ${f.sel}  +${f.over}px  w=${f.w}`);
      }
    }
  }

  console.log("\n" + "=".repeat(78));
  const bad = summary.filter((s) => s.trueBleed > 0 || s.cut > 0);
  console.log(
    `RESULT: ${summary.length - bad.length}/${summary.length} page x width combinations fit without clipping`
  );
  if (bad.length) {
    console.log("\nStill wrong:");
    for (const b of bad) console.log(`  ${b.path} @ ${b.width}px  true +${b.trueBleed}px  cut ${b.cut}`);
    exitCode = 1;
  }
  const tapped = summary.filter((s) => s.width <= 430 && s.taps > 0);
  if (tapped.length) {
    console.log(
      `\nTouch targets under 44px on phones: ${tapped.map((t) => `${t.path}@${t.width}:${t.taps}`).join(", ")}`
    );
  }
  console.log("=".repeat(78));
  await ctx.close();
} catch (error) {
  console.error("\nRUN ABORTED:", error.stack || error.message);
  exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  try {
    if (accId) {
      await q(`delete from public.accounts where id = $1`, [accId]);
      console.log("\nCLEANUP — 1 account removed");
    }
  } catch (e) {
    console.error(`  CLEANUP FAILED: ${e.message}`);
    exitCode = 1;
  }
  await end();
  process.exit(exitCode);
}

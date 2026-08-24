/* The screens the first audit never sees.
 *
 * `responsive-audit.mjs` walks each route as it loads. Every dialog, drawer and
 * dropdown in this panel is mounted only while it is open, so none of them are
 * in the DOM when that audit runs — and a dialog is exactly where a fixed width
 * survives longest, because nobody drags the corner of a modal.
 *
 * This drives each surface open and measures it there: the landing drawer and
 * promotional window, the CRM subscriber drawer, and the four dialogs behind
 * `AdminModal`. Same three questions as the first audit — does it cross the
 * viewport, is anything clipped away, are the controls big enough for a thumb.
 *
 * Read-only apart from one throwaway account, deleted in the `finally`.
 *
 *   node tests/http/responsive-states.mjs
 *   WIDTHS=320 node tests/http/responsive-states.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const RUN = "RSTA_" + crypto.randomBytes(3).toString("hex").toUpperCase();

const WIDTHS = (process.env.WIDTHS || "320,360,390,430,768").split(",").map(Number);

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

/* `ONLY=dialog` runs just the scenarios whose name contains that string.
   The whole set reloads eleven pages five times each, which is minutes on this
   machine; when one surface is under investigation there is no reason to pay
   for the other eight. */
const ONLY = process.env.ONLY || "";

const { q, end } = await db();

console.log("=".repeat(78));
console.log("RESPONSIVE AUDIT — overlays, drawers and dialogs");
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(78));

let exitCode = 0;
let browser;
let accId = null;

/** Measures the state the page is currently in. Mirrors responsive-audit.mjs. */
const PROBE = () => {
  const docEl = document.documentElement;
  const mask = document.createElement("style");
  mask.textContent =
    "html, body { overflow-x: visible !important; }" +
    ".admin-layout-wrapper { overflow: visible !important; }";
  document.head.appendChild(mask);
  void docEl.offsetWidth;

  const vw = docEl.clientWidth;
  const nameOf = (el) => {
    const cls = (el.getAttribute("class") || "")
      .trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "");
  };
  const label = (el) =>
    (el.textContent || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "")
      .trim().replace(/\s+/g, " ").slice(0, 30);

  const wide = [];
  const cut = [];
  const taps = [];
  const INTERACTIVE = "a,button,input,select,textarea,[role=button],[role=tab],[tabindex]";

  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;

    /* A dialog is `position: fixed`, so it cannot grow the document's scroll
       area — but a fixed box wider than the screen is still off the screen.
       Measure the crossing directly instead of trusting scrollWidth. */
    const over = Math.max(r.right - vw, -r.left);
    if (over > 1) {
      let clipped = false;
      for (let p = el.parentElement; p && p !== docEl; p = p.parentElement) {
        if (/^(hidden|auto|scroll|clip)$/.test(getComputedStyle(p).overflowX)) {
          clipped = true;
          break;
        }
      }
      if (!clipped) wide.push({ sel: nameOf(el), over: Math.round(over), w: Math.round(r.width), text: label(el) });
    }

    const carriesContent =
      el.matches(INTERACTIVE) ||
      (el.children.length === 0 && (el.textContent || "").trim().length > 0);
    if (carriesContent) {
      let clipper = null;
      for (let p = el.parentElement; p && p !== docEl; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "hidden" || ox === "clip") { clipper = p; break; }
        if (ox === "auto" || ox === "scroll") break;
      }
      if (clipper) {
        const cr = clipper.getBoundingClientRect();
        const lost = Math.max(r.right - cr.right, cr.left - r.left);
        if (lost > 3) cut.push({ sel: nameOf(el), lost: Math.round(lost), clipper: nameOf(clipper), text: label(el) });
      }
    }

    if (el.matches(INTERACTIVE) && cs.pointerEvents !== "none" && !el.hasAttribute("disabled")) {
      /* See responsive-audit.mjs: an empty absolute `::after` is the hit area
         where the drawn button could not grow without moving its neighbours. */
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

  const dedupe = (rows, key) => {
    const seen = new Set();
    return rows.filter((r) => !seen.has(r.sel + key(r)) && seen.add(r.sel + key(r)));
  };

  mask.remove();
  return {
    vw,
    /* An empty page produces no findings and reads exactly like a clean one, so
       the run says how much was actually on screen when it looked. */
    chars: (document.body.innerText || "").trim().length,
    dialogs: document.querySelectorAll(
      ".admin-modal-scrim, .cms-modal-overlay, .ex-modal, .diet-modal, [role=dialog]"
    ).length,
    wide: dedupe(wide, (r) => r.over).sort((a, b) => b.over - a.over).slice(0, 8),
    cut: dedupe(cut, (r) => r.lost).sort((a, b) => b.lost - a.lost).slice(0, 8),
    taps: dedupe(taps, (r) => `${r.w}x${r.h}`).slice(0, 10),
    tapTotal: taps.length,
  };
};

/* Each scenario: load `path`, run `open` in the page, then measure. `open`
   returns false when the surface is not reachable in this data set, which is a
   skip rather than a failure — an empty table has no row to click. */
const SCENARIOS = (profileId) => [
  {
    name: "landing — promotional window",
    path: "/",
    open: () => Boolean(document.querySelector(".promo-popup-card")),
  },
  {
    name: "landing — navigation drawer",
    path: "/",
    open: () => {
      document.querySelector(".promo-popup-close")?.click();
      const b = document.querySelector(".burger-menu");
      if (!b) return false;
      b.click();
      return true;
    },
  },
  {
    name: "admin — settings dropdown",
    path: "/admin",
    open: () => {
      const b = document.querySelector(".admin-logout-btn");
      if (!b) return false;
      b.click();
      return true;
    },
  },
  {
    name: "admin — subscriber drawer",
    path: "/admin",
    open: () => {
      const c = document.querySelector(".crm-list-card");
      if (!c) return false;
      c.click();
      return true;
    },
  },
  {
    name: "admin — new account dialog",
    path: "/admin",
    open: () => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /إضافة|حساب جديد|إنشاء/.test(x.textContent || "")
      );
      if (!b) return false;
      b.click();
      return true;
    },
  },
  {
    name: "exercises — form dialog",
    path: "/admin/exercises",
    open: () => {
      const b = document.querySelector(".ex-add-btn");
      if (!b) return false;
      b.click();
      return true;
    },
  },
  {
    name: "courses — course dialog with table",
    path: "/admin/courses",
    open: () => {
      const c = document.querySelector(".co-card, .crm-list-card, [class*='co-'][class*='card']");
      if (!c) return false;
      c.click();
      return true;
    },
  },
  {
    name: "diet — nutrition dialog",
    path: "/admin/diet",
    open: () => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /إضافة|صنف جديد/.test(x.textContent || "")
      );
      if (!b) return false;
      b.click();
      return true;
    },
  },
  {
    name: "builder — day dialog",
    path: "/admin/builder",
    open: () => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /إضافة يوم|يوم جديد|إضافة/.test(x.textContent || "")
      );
      if (!b) return false;
      b.click();
      return true;
    },
  },
  profileId && {
    name: "profile — subscriber page",
    path: `/admin/profile/${profileId}`,
    open: () => true,
  },
].filter(Boolean);

try {
  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);
  const [acc] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id`,
    [`${RUN}_a`, hash]
  );
  accId = acc.id;

  const [someProfile] = await q(`select id from public.profiles order by created_at desc limit 1`);

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: "admin" }),
    domain: "localhost",
    path: "/",
  });

  const problems = [];

  const scenarios = SCENARIOS(someProfile?.id).filter((x) => x.name.includes(ONLY));
  for (const s of scenarios) {
    console.log("\n" + "-".repeat(78));
    console.log(`${s.name}   (${s.path})`);
    console.log("-".repeat(78));

    /* One load, then resize under it.
     *
     * This navigated once per width, and re-entering the same `/admin/*` route
     * a few times over is enough to leave it on its `loading.tsx` fallback for
     * as long as you care to wait — "جاري التحميل...", fifteen characters, no
     * error and no failed request. An empty page has nothing wrong with it, so
     * every one of those reads as a pass. Resizing an open surface exercises
     * the same media queries and asks the server for nothing. */
    await page.setViewport({ width: WIDTHS[0], height: HEIGHT, deviceScaleFactor: 1, hasTouch: COARSE, isMobile: COARSE });
    try {
      await page.goto(`${BASE_URL}${s.path}`, { waitUntil: "networkidle0", timeout: 120000 });
    } catch {
      await page.goto(`${BASE_URL}${s.path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    }
    await page
      .waitForFunction(() => (document.body.innerText || "").trim().length > 60, {
        timeout: 90000,
        polling: 500,
      })
      .catch(() => console.log("       (page never filled — measuring what is there)"));
    await new Promise((r) => setTimeout(r, 1200));

    const opened = await page.evaluate(s.open);
    if (!opened) {
      console.log("  [skip] surface not reachable in this data set");
      continue;
    }
    await new Promise((r) => setTimeout(r, 900));

    for (const width of WIDTHS) {
      await page.setViewport({ width, height: HEIGHT, deviceScaleFactor: 1, hasTouch: COARSE, isMobile: COARSE });
      await new Promise((r) => setTimeout(r, 450));

      const res = await page.evaluate(PROBE);
      const wrong = res.wide.length > 0 || res.cut.length > 0;
      console.log(
        `  [${wrong ? "FAIL" : " ok "}] ${String(width).padStart(4)}px  ` +
          `wide ${String(res.wide.length).padStart(2)}  cut ${String(res.cut.length).padStart(2)}  ` +
          `taps<44 ${String(res.tapTotal).padStart(3)}  ` +
          `dialogs ${res.dialogs}  text ${res.chars}ch`
      );
      if (wrong) problems.push({ name: s.name, width, wide: res.wide.length, cut: res.cut.length });
      for (const w of res.wide)
        console.log(`      WIDE  ${w.sel}  +${w.over}px  w=${w.w}` + (w.text ? `  "${w.text}"` : ""));
      for (const c of res.cut)
        console.log(`      CUT   ${c.sel}  -${c.lost}px by ${c.clipper}` + (c.text ? `  "${c.text}"` : ""));
      for (const t of res.taps)
        console.log(`      TAP   ${t.sel}  ${t.w}x${t.h}` + (t.text ? `  "${t.text}"` : ""));
    }
  }

  console.log("\n" + "=".repeat(78));
  if (problems.length) {
    console.log("Surfaces that do not fit:");
    for (const p of problems) console.log(`  ${p.name} @ ${p.width}px — wide ${p.wide}, cut ${p.cut}`);
    exitCode = 1;
  } else {
    console.log("Every overlay fits its viewport at every width measured.");
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

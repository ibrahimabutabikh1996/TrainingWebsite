/* The trainee's dashboard, measured on a phone.
 *
 * `responsive-audit.mjs` never sees this screen. Its page list is the coach's
 * panel plus the public routes, because the session it mints is the coach's —
 * and `/dashboard` bounces an admin username straight to `/admin`. So the one
 * page a trainee actually opens on a phone is the one page with no numbers
 * against it, and it shows: three media queries across 1800 lines of stylesheet.
 *
 * Two things are measured here that the other audits do not look for:
 *
 *   OCCLUDED  the dashboard's navigation is `position: fixed` at the bottom of
 *             the screen. A fixed bar does not participate in layout, so
 *             nothing stops the last card on the page from ending underneath
 *             it — and the page still reports a perfectly clean scroll width
 *             while doing it. This scrolls to the end of each tab and asks
 *             whether anything readable or tappable is behind the bar.
 *   SAFE      the same bar against the home indicator. A phone reports its
 *             inset through `env(safe-area-inset-bottom)`; headless Chrome
 *             reports zero, so the inset is injected as a custom property and
 *             the bar is re-measured to see whether it moved. A bar that does
 *             not move is a bar that sits under the gesture area on every
 *             iPhone made since 2017.
 *
 * Plus the usual three — crossing the viewport, clipped content, touch targets
 * under 44px — for every tab, since each one mounts a different component tree
 * and only whichever tab happened to be open has ever been looked at.
 *
 * READ-ONLY. This mints a session for an existing trainee and clicks through
 * their tabs. It creates nothing and deletes nothing; the account is named by
 * TRAINEE and must already exist.
 *
 *   node tests/http/dashboard-mobile.mjs
 *   WIDTHS=320,390 node tests/http/dashboard-mobile.mjs
 *   HEIGHT=390 WIDTHS=667,844 node tests/http/dashboard-mobile.mjs   # landscape
 *   TRAINEE=kareem node tests/http/dashboard-mobile.mjs
 */
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const WIDTHS = (process.env.WIDTHS || "320,360,375,390,414,430").split(",").map(Number);
const HEIGHT = parseInt(process.env.HEIGHT || "780", 10);
const TRAINEE = process.env.TRAINEE || "mfgym";

/* The inset a modern iPhone reports in portrait. Chrome headless has no notch
   and reports 0 for every `env()`, so a bar that never reads the variable and a
   bar that reads it correctly measure identically. Injecting a value is the
   only way to tell them apart from here. */
const FAKE_INSET = 34;

const { q, end } = await db();

console.log("=".repeat(78));
console.log("DASHBOARD ON A PHONE — occlusion, safe area, fit, touch targets");
console.log(`Trainee: ${TRAINEE}   ${HEIGHT <= 500 ? "(landscape)" : "(portrait)"}`);
console.log("=".repeat(78));

let exitCode = 0;
let browser;

/** Measures whatever tab is currently open. Runs in the page. */
const PROBE = () => {
  const docEl = document.documentElement;
  const mask = document.createElement("style");
  mask.textContent = "html, body { overflow-x: visible !important; }";
  document.head.appendChild(mask);
  void docEl.offsetWidth;

  const vw = docEl.clientWidth;
  const vh = docEl.clientHeight;
  const nameOf = (el) => {
    const cls = (el.getAttribute("class") || "")
      .trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "");
  };
  const label = (el) =>
    (el.textContent || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "")
      .trim().replace(/\s+/g, " ").slice(0, 30);

  const INTERACTIVE = "a,button,input,select,textarea,[role=button],[role=tab],[tabindex]";

  const wide = [];
  const cut = [];
  const taps = [];
  const occluded = [];

  /* The fixed furniture the page parks over its own content. Anything fixed and
     anchored to the lower half of the screen counts — the nav is the one that
     exists today, but a cookie bar or a save strip would occlude just the same. */
  const bars = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width === 0) continue;
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;
    if (r.top < vh * 0.5) continue;          // not a bottom-anchored bar
    if (r.height > vh * 0.6) continue;       // a full-height scrim, not a bar
    bars.push({ el, r, sel: nameOf(el) });
  }

  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;

    /* --- crosses a viewport edge with nothing to catch it --- */
    const over = Math.max(r.right - vw, -r.left);
    if (over > 1) {
      let clipped = false;
      for (let p = el.parentElement; p && p !== docEl; p = p.parentElement) {
        if (/^(hidden|auto|scroll|clip)$/.test(getComputedStyle(p).overflowX)) { clipped = true; break; }
      }
      if (!clipped) wide.push({ sel: nameOf(el), over: Math.round(over), w: Math.round(r.width), text: label(el) });
    }

    const carriesContent =
      el.matches(INTERACTIVE) ||
      (el.children.length === 0 && (el.textContent || "").trim().length > 0);

    /* --- cut off by an ancestor that clips without scrolling --- */
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

    /* --- behind the fixed bar ---
       Only leaves count. An ancestor overlapping the bar says nothing: a
       section is tall enough to reach the bottom of the page whether or not
       any of its words do. And an element inside the bar is not behind it. */
    if (carriesContent && bars.length) {
      for (const bar of bars) {
        if (bar.el.contains(el)) continue;
        const overlapY = Math.min(r.bottom, bar.r.bottom) - Math.max(r.top, bar.r.top);
        const overlapX = Math.min(r.right, bar.r.right) - Math.max(r.left, bar.r.left);
        if (overlapY > 2 && overlapX > 2) {
          occluded.push({
            sel: nameOf(el),
            by: bar.sel,
            deep: Math.round(overlapY),
            text: label(el),
            tappable: el.matches(INTERACTIVE),
          });
          break;
        }
      }
    }

    /* --- touch targets --- */
    if (el.matches(INTERACTIVE) && cs.pointerEvents !== "none" && !el.hasAttribute("disabled")) {
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
    return rows.filter((r) => {
      const k = r.sel + key(r);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  mask.remove();
  return {
    vw,
    chars: (document.body.innerText || "").trim().length,
    bar: bars[0] ? { sel: bars[0].sel, h: Math.round(bars[0].r.height), gap: Math.round(vh - bars[0].r.bottom) } : null,
    wide: dedupe(wide, (r) => r.over).sort((a, b) => b.over - a.over).slice(0, 6),
    cut: dedupe(cut, (r) => r.lost).sort((a, b) => b.lost - a.lost).slice(0, 6),
    occluded: dedupe(occluded, (r) => r.deep).sort((a, b) => b.deep - a.deep).slice(0, 6),
    occludedTotal: occluded.length,
    taps: dedupe(taps, (r) => `${r.w}x${r.h}`).slice(0, 8),
    tapTotal: taps.length,
  };
};

/* Does the bottom bar move when the phone reports a home indicator?
   Sets the inset as a custom property, then re-reads the bar's distance from
   the bottom of the viewport. Stylesheets here are written against
   `env(safe-area-inset-bottom, 0px)`, which cannot be overridden from script —
   so the convention this checks is `max(Xpx, env(...))` folded into a variable
   the page defines. Where the page reads `env()` directly the fallback below
   still detects it, because a page that never mentions safe areas at all also
   never defines the property. */
const SAFE_AREA = (inset) => {
  const bar = [...document.querySelectorAll("body *")].find((el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed") return false;
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.top > document.documentElement.clientHeight * 0.5;
  });
  if (!bar) return null;

  const vh = document.documentElement.clientHeight;
  const before = vh - bar.getBoundingClientRect().bottom;
  const probe = document.createElement("style");
  probe.textContent = `:root { --safe-bottom: ${inset}px; --sab: ${inset}px; }`;
  document.head.appendChild(probe);
  void document.documentElement.offsetWidth;
  const after = vh - bar.getBoundingClientRect().bottom;
  probe.remove();
  return { before: Math.round(before), after: Math.round(after), reads: after - before > 1 };
};

try {
  const [acc] = await q(`select id, username from public.accounts where username = $1`, [TRAINEE]);
  if (!acc) throw new Error(`No account named ${TRAINEE}. Set TRAINEE= to one that exists.`);

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: acc.username }),
    domain: "localhost",
    path: "/",
  });

  /* Each tab is client state behind a button in the fixed bar, so the tab is
     chosen by clicking rather than by a URL. `more` opens the overflow menu
     first — the weight log is only reachable through it. */
  const TABS = [
    { name: "home", nth: 2 },
    { name: "workout", nth: 1 },
    { name: "profile", nth: 3 },
    { name: "weight", nth: 0, viaMore: true },
    { name: "more-menu-open", nth: 0, leaveOpen: true },
  ];

  const summary = [];

  for (const width of WIDTHS) {
    console.log("\n" + "-".repeat(78));
    console.log(`WIDTH ${width}px`);
    console.log("-".repeat(78));

    await page.setViewport({ width, height: HEIGHT, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page
      .waitForFunction(() => document.querySelector(".dash-nav-link") !== null, { timeout: 90000, polling: 400 })
      .catch(() => console.log("  (dashboard never mounted)"));
    await new Promise((r) => setTimeout(r, 900));

    /* Asked once per width, before any tab is chosen: the bar is the same bar
       on every tab. */
    const safe = await page.evaluate(SAFE_AREA, FAKE_INSET);
    if (safe) {
      console.log(
        `  SAFE AREA  bar sits ${safe.before}px above the bottom; ` +
          (safe.reads
            ? `moves to ${safe.after}px with a ${FAKE_INSET}px inset — respected`
            : `UNCHANGED with a ${FAKE_INSET}px inset — sits under the home indicator`)
      );
      if (!safe.reads) exitCode = 1;
    }

    for (const tab of TABS) {
      /* The overflow menu mounts on a React state change, so the item inside it
         does not exist in the same tick as the click that opens it. Opening and
         choosing have to be two evaluates with a wait between, or the weight
         log reads as unreachable — which is what it did. */
      let opened = await page.evaluate(
        ({ nth, viaMore, leaveOpen }) => {
          const links = [...document.querySelectorAll(".dash-nav-link")];
          if (!links.length) return false;
          if (viaMore || leaveOpen) {
            links[0].click();
            return true;
          }
          if (!links[nth]) return false;
          links[nth].click();
          return true;
        },
        tab
      );
      if (opened && tab.viaMore) {
        await page.waitForFunction(() => document.querySelector(".dash-more-item") !== null, { timeout: 5000 })
          .catch(() => {});
        opened = await page.evaluate(() => {
          const item = document.querySelector(".dash-more-item");
          if (!item) return false;
          item.click();
          return true;
        });
      }
      if (!opened) {
        console.log(`  [skip] ${tab.name} — not reachable`);
        continue;
      }

      /* Wait for the panel to fill rather than for a fixed delay. The workout
         tree is the slow one, and a 500ms guess measured it at 45 characters on
         one width and 752 on the next — the same data, timed differently. */
      await page
        .waitForFunction(() => (document.body.innerText || "").trim().length > 120, {
          timeout: 15000,
          polling: 250,
        })
        .catch(() => {});
      await new Promise((r) => setTimeout(r, 700));

      /* Occlusion is a question about the *end* of the page. At the top there
         is nothing under the bar yet. */
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 400));

      const m = await page.evaluate(PROBE);
      const bad = m.wide.length > 0 || m.cut.length > 0 || m.occludedTotal > 0;
      if (bad) exitCode = 1;

      console.log(
        `  [${bad ? "FAIL" : " ok "}] ${tab.name.padEnd(15)} ` +
          `wide ${String(m.wide.length).padStart(2)}  ` +
          `cut ${String(m.cut.length).padStart(2)}  ` +
          `behind-bar ${String(m.occludedTotal).padStart(3)}  ` +
          `taps<44 ${String(m.tapTotal).padStart(3)}  ` +
          `(${m.chars} chars)`
      );
      summary.push({ width, tab: tab.name, ...m });

      for (const w of m.wide) console.log(`      WIDE  ${w.sel}  +${w.over}px  w=${w.w}  "${w.text}"`);
      for (const c of m.cut) console.log(`      CUT   ${c.sel}  -${c.lost}px by ${c.clipper}  "${c.text}"`);
      for (const o of m.occluded)
        console.log(`      UNDER ${o.sel}  ${o.deep}px behind ${o.by}${o.tappable ? "  [TAPPABLE]" : ""}  "${o.text}"`);
      for (const t of m.taps) console.log(`      TAP   ${t.sel}  ${t.w}x${t.h}  "${t.text}"`);

      /* Close the overflow menu so the next tab starts from a clean page. */
      await page.evaluate(() => {
        const open = document.querySelector(".dash-more-menu");
        if (open) document.querySelector(".dash-nav-link")?.click();
        window.scrollTo(0, 0);
      });
    }
  }

  console.log("\n" + "=".repeat(78));
  const bad = summary.filter((s) => s.wide.length || s.cut.length || s.occludedTotal);
  console.log(`RESULT: ${summary.length - bad.length}/${summary.length} tab x width combinations clean`);
  const tapped = summary.filter((s) => s.tapTotal > 0);
  if (tapped.length) {
    const worst = Math.min(...summary.flatMap((s) => s.taps.map((t) => Math.min(t.w, t.h))).filter(Boolean));
    console.log(`Touch targets under 44px: ${tapped.length} of ${summary.length} combinations; smallest ${worst}px`);
  }
  console.log("=".repeat(78));
  await ctx.close();
} catch (error) {
  console.error("\nRUN ABORTED:", error.stack || error.message);
  exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  await end();
  process.exit(exitCode);
}

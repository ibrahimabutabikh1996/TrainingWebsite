/* One vertical scrollbar per admin page, not two.
 *
 * `.crm-dashboard` was pinned to `calc(100vh - 80px)` inside a shell that adds
 * 152px of its own padding, so it hung 72px past the bottom and the shell
 * scrolled — on every admin page, whatever it held, because the overflow was
 * arithmetic rather than content. `.crm-main-area` scrolling within that fixed
 * height was the second bar.
 *
 * Counting the bars is only half of it. Deleting a scroll container is trivially
 * "successful" if the content below the fold simply becomes unreachable, so the
 * bottom of the page is checked as well: the last card has to be reachable, and
 * nothing may be clipped away.
 *
 * Read-only — it signs in as the coach and looks. One throwaway account is
 * created for the session and deleted in the `finally`.
 *
 *   node tests/http/admin-scroll.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const RUN = "SCROLL_" + crypto.randomBytes(3).toString("hex").toUpperCase();

const { q, end } = await db();

const results = [];
const check = (test, pass, note = "") => {
  results.push({ test, pass, note });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${test}${note ? ` — ${note}` : ""}`);
};

console.log("=".repeat(72));
console.log("ADMIN PAGES — ONE VERTICAL SCROLLBAR");
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(72));

let exitCode = 0;
let browser;
let accId = null;

/* Short on purpose. A tall viewport hides the fault: the pages have to overflow
   before there is anything to count. */
const VIEWPORT = { width: 1366, height: 620 };

const PAGES = ["/admin", "/admin/exercises", "/admin/courses", "/admin/diet"];

try {
  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);
  const [acc] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id`,
    [`${RUN}_a`, hash]
  );
  accId = acc.id;

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(VIEWPORT);
  await page.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: "admin" }),
    domain: "localhost", path: "/",
  });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  /** Every element on the page that can scroll vertically, the document included. */
  const scrollers = () =>
    page.evaluate(() => {
      const found = [];
      const walk = (el) => {
        const cs = getComputedStyle(el);
        const canScroll =
          el.scrollHeight > el.clientHeight + 2 &&
          (cs.overflowY === "auto" || cs.overflowY === "scroll");
        if (canScroll) {
          found.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().split(" ")[0],
            overflow: el.scrollHeight - el.clientHeight,
          });
        }
        for (const child of el.children) walk(child);
      };
      walk(document.documentElement);
      const doc = document.scrollingElement;
      if (doc && doc.scrollHeight > doc.clientHeight + 2) {
        found.push({ tag: "document", cls: "", overflow: doc.scrollHeight - doc.clientHeight });
      }
      return found;
    });

  console.log(`\nViewport ${VIEWPORT.width}×${VIEWPORT.height}\n`);

  for (const path of PAGES) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle0", timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1200));

    const found = await scrollers();
    const label = found.map((f) => `${f.tag}.${f.cls}(+${f.overflow}px)`).join(" + ") || "none";

    check(`${path} — exactly one vertical scroller`, found.length === 1, label);

    if (found.length === 1) {
      check(`${path} — and it is the page shell, not a pane inside it`,
        found[0].cls === "admin-main-content", found[0].cls);
    }

    /* Deleting a scroll container is only a fix if what it held is still
       reachable. Scroll the shell to its end and confirm it arrives. */
    const bottom = await page.evaluate(() => {
      const el = document.querySelector("main.admin-main-content");
      if (!el) return null;
      el.scrollTop = el.scrollHeight;
      return {
        reached: Math.abs(el.scrollTop + el.clientHeight - el.scrollHeight) < 3,
        scrollTop: el.scrollTop,
      };
    });
    check(`${path} — the bottom of the page can be reached`,
      Boolean(bottom?.reached), bottom ? `scrollTop ${Math.round(bottom.scrollTop)}` : "shell not found");

    /* Nothing may have been left hanging outside a box that no longer scrolls:
       an element wider or taller than a clipping ancestor would be unreachable
       rather than scrollable. */
    const clipped = await page.evaluate(() => {
      const area = document.querySelector(".crm-main-area");
      if (!area) return null;
      const cs = getComputedStyle(area);
      return { overflowY: cs.overflowY, hidden: cs.overflowY === "hidden" };
    });
    if (clipped) {
      check(`${path} — the inner pane no longer clips or scrolls`,
        clipped.overflowY === "visible", clipped.overflowY);
    }
  }

  check("no page errors during the run", errors.length === 0, errors.slice(0, 2).join(" | "));
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

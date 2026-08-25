/* The intake help panel: does it open, does it say the right things, and does
 * it refuse what it should.
 *
 *   node tests/http/intake-help.mjs
 *   W=375 node tests/http/intake-help.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const { q, end } = await db();
const RUN = "TIHP_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const W = parseInt(process.env.W || "1280", 10);
const H = parseInt(process.env.H || "900", 10);

const hash = await bcrypt.hash("TestOnly_" + RUN, 10);
const [admin] = await q(
  `insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id`,
  [`${RUN}_a`, hash]
);
const [trainee] = await q(
  `select id, username, data from public.profiles order by created_at desc limit 1`
);

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
let fails = 0;
const check = (name, ok, note = "") => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${note ? " — " + note : ""}`);
  if (!ok) fails++;
};

try {
  const page = await browser.newPage();
  await page.setCookie({ name: "gym_session", value: mintSession({ id: admin.id, username: "admin" }), domain: "localhost", path: "/" });
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1, hasTouch: W < 800, isMobile: W < 800 });

  const go = async (url) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(() => (document.body.innerText || "").trim().length > 60, { timeout: 90000, polling: 500 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2200));
  };
  const openPanel = async () => {
    await page.evaluate(() => document.querySelector(".tih-fab")?.click());
    await new Promise((r) => setTimeout(r, 2200));
    return page.evaluate(() => {
      const modal = document.querySelector(".admin-modal-scrim");
      if (!modal) return null;
      const rows = [...modal.querySelectorAll(".tih-row")].map((r) => ({
        label: r.querySelector("dt")?.textContent?.trim() || "",
        value: r.querySelector("dd")?.textContent?.trim() || "",
        thumbs: r.querySelectorAll(".tih-thumb img").length,
      }));
      return { title: modal.querySelector("h3")?.textContent?.trim() || "", note: modal.querySelector(".tih-note")?.textContent?.trim() || "", rows };
    });
  };
  const close = async () => {
    await page.evaluate(() => document.querySelector(".admin-modal-close")?.click());
    await new Promise((r) => setTimeout(r, 700));
  };

  /* ── builder, no trainee chosen ── */
  console.log("\n--- /admin/builder (no trainee) ---");
  await go(`${BASE_URL}/admin/builder`);
  const fab = await page.evaluate(() => {
    const b = document.querySelector(".tih-fab");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const bar = document.querySelector(".admin-bottom-nav")?.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), gapAboveBar: bar ? Math.round(bar.top - r.bottom) : null,
             insideViewport: r.left >= 0 && r.right <= window.innerWidth };
  });
  check("floating button present", !!fab, fab ? `${fab.w}x${fab.h}` : "absent");
  check("button is a 44px+ target", !!fab && Math.min(fab.w, fab.h) >= 44, fab ? `${Math.min(fab.w, fab.h)}px` : "");
  check("button clears the bottom bar", !!fab && fab.gapAboveBar > 0, fab ? `${fab.gapAboveBar}px` : "");
  check("button inside the viewport", !!fab && fab.insideViewport);
  const none = await openPanel();
  check("asks for a trainee when none chosen", !!none && none.note.includes("اختر مشتركاً"), none?.note || "no panel");
  check("no answers shown when none chosen", !!none && none.rows.length === 0);
  await close();

  /* ── builder, with a trainee ── */
  console.log(`\n--- /admin/builder?traineeId=… (${trainee.username}) ---`);
  await go(`${BASE_URL}/admin/builder?traineeId=${trainee.id}`);
  const workout = await openPanel();
  const wLabels = (workout?.rows || []).map((r) => r.label);
  check("five questions shown", wLabels.length === 5, wLabels.length + " rows");
  for (const want of ["الوزن الحالي", "الوزن الذي تريد الوصول إليه", "الطول", "الهدف من الاشتراك", "صور الجسم"]) {
    check(`shows "${want}"`, wLabels.some((l) => l.includes(want)));
  }
  const leak = (workout?.rows || []).some((r) => /الهاتف|رقم|كلمة المرور/.test(r.label));
  check("no phone or credentials leaked into the panel", !leak);
  console.log("     " + (workout?.rows || []).map((r) => `${r.label}=${r.value.slice(0, 18)}${r.thumbs ? ` [${r.thumbs} صور]` : ""}`).join(" | "));
  await close();

  /* ── diet plan ── */
  console.log(`\n--- /admin/diet/plan?traineeId=… ---`);
  await go(`${BASE_URL}/admin/diet/plan?traineeId=${trainee.id}`);
  const diet = await openPanel();
  const dLabels = (diet?.rows || []).map((r) => r.label);
  check("nine questions shown", dLabels.length === 9, dLabels.length + " rows");
  for (const want of ["الوزن الحالي", "الطول", "الهدف من الاشتراك", "أكلات ممنوعة", "الأكلات المفضلة", "نوع اللحم", "معدل شرب القهوة", "أمراض أو إصابات", "مكملات غذائية"]) {
    check(`shows "${want}"`, dLabels.some((l) => l.includes(want)));
  }
  check("target weight NOT in the diet view", !dLabels.some((l) => l.includes("تريد الوصول")));
  check("body photos NOT in the diet view", !dLabels.some((l) => l.includes("صور الجسم")));
  console.log("     " + (diet?.rows || []).map((r) => `${r.label}=${r.value.slice(0, 14)}`).join(" | "));

  /* ── the page must not ship the intake blob ──────────────────────────────
     The point of the whole design. Both builder pages send `{id, name,
     username}` per trainee and nothing else; this proves the panel did not
     quietly put the answers back into the payload. Loaded fresh, WITHOUT
     opening the panel, and searched for the trainee's own distinctive answers
     across the served HTML and every inline script (the RSC payload included). */
  const secrets = [];
  const d = typeof trainee.data === "string" ? JSON.parse(trainee.data) : trainee.data || {};
  for (const f of ["injuries", "allergies", "fav_foods", "phone"]) {
    if (typeof d[f] === "string" && d[f].trim().length >= 4) secrets.push([f, d[f].trim()]);
  }

  for (const url of [`${BASE_URL}/admin/builder?traineeId=${trainee.id}`, `${BASE_URL}/admin/diet/plan?traineeId=${trainee.id}`]) {
    await go(url);
    const html = await page.evaluate(() => document.documentElement.innerHTML);
    const found = secrets.filter(([, v]) => html.includes(v)).map(([f]) => f);
    check(`no intake answers in the payload of ${url.split("/admin")[1].split("?")[0]}`,
          found.length === 0, found.length ? "LEAKED: " + found.join(", ") : `${secrets.length} values checked`);
  }

  if (process.env.SHOT) { await page.screenshot({ path: `${process.env.SHOT}/intake-${W}.png` }); console.log("  shot"); }

  console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
} finally {
  await browser.close();
  await q(`delete from public.accounts where id=$1`, [admin.id]);
  await end();
}
process.exit(fails === 0 ? 0 : 1);

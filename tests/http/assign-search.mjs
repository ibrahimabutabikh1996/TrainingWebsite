/* The subscriber filter in the "assign a course" dialog.
 *
 *   node tests/http/assign-search.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const { q, end } = await db();
const RUN = "ASRCH_" + crypto.randomBytes(3).toString("hex").toUpperCase();
let fails = 0;
const check = (n, ok, note = "") => { console.log(`  [${ok ? "PASS" : "FAIL"}] ${n}${note ? " — " + note : ""}`); if (!ok) fails++; };

const hash = await bcrypt.hash("TestOnly_" + RUN, 10);
const [admin] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id`, [`${RUN}_a`, hash]);

/* A name with a hamza, so the folding can be tested rather than assumed. */
const [extraAcc] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id`, [`${RUN}_t`, hash]);
const [extra] = await q(
  `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
   values ($1, $2::jsonb, $3, now() + interval '30 days', false) returning id`,
  [`${RUN}_t`, JSON.stringify({ fullname: "أحمد إبراهيم", __test_run: RUN }), extraAcc.id]
);

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox","--disable-gpu"] });
try {
  const page = await browser.newPage();
  await page.setCookie({ name:"gym_session", value: mintSession({id:admin.id,username:"admin"}), domain:"localhost", path:"/" });
  await page.setViewport({ width: parseInt(process.env.W||"1280",10), height: 900, deviceScaleFactor: 1 });
  await page.goto(`${BASE_URL}/admin/courses`, { waitUntil:"domcontentloaded", timeout:120000 });
  await page.waitForFunction(()=> (document.body.innerText||"").trim().length>60, {timeout:90000,polling:500}).catch(()=>{});
  await new Promise(r=>setTimeout(r,2500));

  /* Open the assign dialog from the first course card. */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(e => (e.getAttribute("title")||"").includes("تعيين لمشترك"));
    b?.click();
  });
  await new Promise(r=>setTimeout(r,1800));
  check("assign dialog open", await page.evaluate(()=> !!document.querySelector(".admin-modal-scrim")));

  /* Open the subscriber list. */
  await page.evaluate(() => document.querySelector(".admin-modal-scrim .custom-select-trigger")?.click());
  await new Promise(r=>setTimeout(r,900));

  const opts = () => page.evaluate(() =>
    [...document.querySelectorAll(".admin-modal-scrim .custom-select-option")].map(o => o.textContent.replace(/•/g,"").trim()));

  const hasBox = await page.evaluate(() => !!document.querySelector(".admin-modal-scrim .custom-select-search input"));
  check("search box is present", hasBox);
  check("search box has focus on open", await page.evaluate(() =>
    document.activeElement === document.querySelector(".admin-modal-scrim .custom-select-search input")));

  const clip = await page.evaluate(() => {
    const dd = document.querySelector(".admin-modal-scrim .custom-select-dropdown");
    const body = dd?.closest("[class*='custom-scrollbar']") || dd?.closest(".crm-glass-panel");
    if (!dd || !body) return null;
    const d = dd.getBoundingClientRect(), b = body.getBoundingClientRect();
    const visible = Math.max(0, Math.min(d.bottom, b.bottom) - Math.max(d.top, b.top));
    return { ddH: Math.round(d.height), visible: Math.round(visible), cutBy: Math.round(d.bottom - b.bottom) };
  });
  console.log("     dropdown:", JSON.stringify(clip));
  const reach = await page.evaluate(() => {
    const dd = document.querySelector(".admin-modal-scrim .custom-select-dropdown");
    const sc = [...document.querySelectorAll(".admin-modal-scrim *")].find(e => {
      const c = getComputedStyle(e); return /(auto|scroll)/.test(c.overflowY) && e.scrollHeight > e.clientHeight + 1;
    });
    if (!sc) return { scrollable: false };
    const before = sc.scrollTop;
    sc.scrollTop = sc.scrollHeight;
    const d = dd.getBoundingClientRect(), b = sc.getBoundingClientRect();
    const visibleAfter = Math.round(Math.max(0, Math.min(d.bottom, b.bottom) - Math.max(d.top, b.top)));
    return { scrollable: true, room: sc.scrollHeight - sc.clientHeight, visibleAfterScroll: visibleAfter, before };
  });
  console.log("     reachable:", JSON.stringify(reach));
  const all = await opts();
  check("full list shown before typing", all.length >= 3, `${all.length} options`);

  const type = async (text) => {
    await page.evaluate(() => { const i = document.querySelector(".admin-modal-scrim .custom-select-search input"); i.value=""; i.dispatchEvent(new Event("input",{bubbles:true})); });
    await page.type(".admin-modal-scrim .custom-select-search input", text, { delay: 20 });
    await new Promise(r=>setTimeout(r,500));
    return opts();
  };

  const m = await type("محمد");
  check("filters to matching names", m.length > 0 && m.length < all.length && m.every(x => x.includes("محمد")), `${m.length}/${all.length}: ${m.join(" | ").slice(0,60)}`);

  /* The folding test: "احمد" typed without the hamza must find "أحمد". */
  const folded = await type("احمد");
  check("Arabic folding: 'احمد' finds 'أحمد'", folded.some(x => x.includes("أحمد")), folded.join(" | ").slice(0,60) || "no matches");

  const none = await type("زززززز");
  check("says so when nothing matches", none.length === 0 && await page.evaluate(() =>
    (document.querySelector(".admin-modal-scrim .custom-select-empty")?.textContent||"").includes("لا توجد نتائج")));

  /* Enter must pick the first match and must not submit the dialog. */
  await type("أحمد");
  await page.keyboard.press("Enter");
  await new Promise(r=>setTimeout(r,900));
  const afterEnter = await page.evaluate(() => ({
    stillOpen: !!document.querySelector(".admin-modal-scrim"),
    listClosed: !document.querySelector(".admin-modal-scrim .custom-select-dropdown"),
    chosen: document.querySelector(".admin-modal-scrim .custom-select-label")?.textContent?.trim() || "",
  }));
  check("Enter selects the first match", afterEnter.chosen.includes("أحمد"), afterEnter.chosen);
  check("Enter closes the list, not the dialog", afterEnter.listClosed && afterEnter.stillOpen);

  /* Reopening must not still be filtered. */
  await page.evaluate(() => document.querySelector(".admin-modal-scrim .custom-select-trigger")?.click());
  await new Promise(r=>setTimeout(r,700));
  const reopened = await opts();
  check("filter is cleared on reopen", reopened.length === all.length, `${reopened.length} vs ${all.length}`);

  if (process.env.SHOT) { await page.screenshot({ path: `${process.env.SHOT}/assign-search.png` }); console.log("  shot"); }

  /* Scope: no other select grew a search box. */
  await page.goto(`${BASE_URL}/admin/builder`, { waitUntil:"domcontentloaded", timeout:120000 });
  await page.waitForFunction(()=> (document.body.innerText||"").trim().length>60, {timeout:90000,polling:500}).catch(()=>{});
  await new Promise(r=>setTimeout(r,2200));
  await page.evaluate(() => document.querySelector(".dplan-trainee .custom-select-trigger")?.click());
  await new Promise(r=>setTimeout(r,800));
  const builderHasBox = await page.evaluate(() => ({
    open: !!document.querySelector(".custom-select-dropdown"),
    box: !!document.querySelector(".custom-select-search input"),
  }));
  check("builder's subscriber list is unchanged (no search box)", builderHasBox.open && !builderHasBox.box,
        builderHasBox.open ? "list opened, no box" : "list did not open");

  console.log(`\n${fails===0?"ALL CHECKS PASSED":fails+" CHECK(S) FAILED"}`);
} finally {
  await browser.close();
  await q(`delete from public.profiles where id=$1`, [extra.id]);
  await q(`delete from public.accounts where id=any($1::uuid[])`, [[admin.id, extraAcc.id]]);
  console.log("CLEANUP — 1 profile, 2 accounts removed");
  await end();
}
process.exit(fails===0?0:1);

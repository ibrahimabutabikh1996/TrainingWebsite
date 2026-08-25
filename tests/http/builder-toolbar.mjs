/* What the builder's toolbar offers, after the library link came out of it. */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";
const { q, end } = await db();
const RUN = "BTLB_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const hash = await bcrypt.hash("TestOnly_" + RUN, 10);
const [acc] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id`, [`${RUN}_a`, hash]);
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox","--disable-gpu"] });
let fails = 0;
const check = (n, ok, note="") => { console.log(`  [${ok?"PASS":"FAIL"}] ${n}${note?" — "+note:""}`); if(!ok) fails++; };
try {
  const page = await browser.newPage();
  await page.setCookie({ name:"gym_session", value: mintSession({id:acc.id,username:"admin"}), domain:"localhost", path:"/" });
  await page.setViewport({ width:1280, height:900, deviceScaleFactor:1 });
  await page.goto(`${BASE_URL}/admin/builder`, { waitUntil:"domcontentloaded", timeout:120000 });
  await page.waitForFunction(()=> (document.body.innerText||"").trim().length>60, {timeout:90000,polling:500}).catch(()=>{});
  await new Promise(r=>setTimeout(r,2500));

  const info = await page.evaluate(() => {
    const head = document.querySelector(".dplan-header-actions") || document.querySelector(".diet-header");
    const labels = head ? [...head.querySelectorAll("button, a")].map(e => (e.textContent||"").trim()).filter(Boolean) : [];
    const nav = [...document.querySelectorAll(".admin-bottom-nav a")].map(a => a.getAttribute("href"));
    return {
      labels,
      headHasCoursesLink: head ? !!head.querySelector('a[href="/admin/courses"]') : null,
      anyCoursesLinkInPage: !!document.querySelector('.admin-main-content a[href="/admin/courses"]'),
      navHasCourses: nav.includes("/admin/courses"),
    };
  });
  console.log("  toolbar:", JSON.stringify(info.labels));
  const geo = await page.evaluate(() => {
    const head = document.querySelector(".diet-header");
    const acts = document.querySelector(".dplan-header-actions");
    const kids = acts ? [...acts.children].map(k => Math.round(k.getBoundingClientRect().top)) : [];
    return { headH: head ? Math.round(head.getBoundingClientRect().height) : null,
             actionRows: new Set(kids).size, kidTops: kids };
  });
  console.log(`  header height ${geo.headH}px, controls on ${geo.actionRows} row(s)`);
  if (process.env.SHOT) { await page.screenshot({ path: `${process.env.SHOT}/builder-toolbar.png` }); console.log("  shot"); }
  check("library link gone from the toolbar", info.headHasCoursesLink === false);
  check("no /admin/courses link left in the page body", !info.anyCoursesLinkInPage);
  check("library still reachable from the bottom bar", info.navHasCourses);
  check("'ابدأ من كورس موجود' still offered", info.labels.some(l => l.includes("ابدأ من كورس موجود")));
  check("'حفظ الكورس' still offered", info.labels.some(l => l.includes("حفظ الكورس")));
  check("trainee selector still present", await page.evaluate(()=> !!document.querySelector(".dplan-trainee")));

  /* The kept button must still do its job. */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(e => (e.textContent||"").includes("ابدأ من كورس موجود"));
    b?.click();
  });
  await new Promise(r=>setTimeout(r,2000));
  const modal = await page.evaluate(() => {
    const m = document.querySelector(".admin-modal-scrim");
    return m ? { title: m.querySelector("h3")?.textContent?.trim() || "", items: m.querySelectorAll("button, li").length } : null;
  });
  check("template picker still opens", !!modal && modal.items > 0, modal ? `${modal.title} (${modal.items} controls)` : "did not open");

  console.log(`\n${fails===0?"ALL CHECKS PASSED":fails+" CHECK(S) FAILED"}`);
} finally {
  await browser.close();
  await q(`delete from public.accounts where id=$1`,[acc.id]);
  await end();
}
process.exit(fails===0?0:1);

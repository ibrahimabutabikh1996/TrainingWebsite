/* Content left underneath the fixed admin bar.
 *
 * Scrolls each admin page to its end and measures the gap between the lowest
 * real content box and the top of `.admin-bottom-nav`. A negative gap is
 * content sitting behind translucent glass.
 *
 *   node tests/http/nav-overlap.mjs
 *   WIDTHS=375 PAGES=/admin/builder node tests/http/nav-overlap.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";
const { q, end } = await db();
const RUN = "NAVO_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const WIDTHS = (process.env.WIDTHS || "375,768").split(",").map(Number);
const PAGES = (process.env.PAGES || "/admin,/admin/exercises,/admin/courses,/admin/diet,/admin/builder,/admin/cms").split(",");
const BUILD = process.env.BUILD === "1";

const hash = await bcrypt.hash("TestOnly_" + RUN, 10);
const [acc] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id`, [`${RUN}_a`, hash]);
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox","--disable-gpu"] });
try {
  const page = await browser.newPage();
  await page.setCookie({ name:"gym_session", value: mintSession({ id: acc.id, username:"admin" }), domain:"localhost", path:"/" });
  for (const path of PAGES) {
    for (const w of WIDTHS) {
      await page.setViewport({ width:w, height:parseInt(process.env.VH||"812",10), deviceScaleFactor:1, hasTouch:true, isMobile:true });
      await page.goto(`${BASE_URL}${path}`, { waitUntil:"domcontentloaded", timeout:120000 });
      await page.waitForFunction(()=> (document.body.innerText||"").trim().length>60, {timeout:90000, polling:500}).catch(()=>{});
      await new Promise(r=>setTimeout(r,2000));
      if (BUILD && path === "/admin/builder") {
        const clickText = async (sel, text) => page.evaluate((sel,text)=>{
          const el=[...document.querySelectorAll(sel)].find(e=>(e.textContent||"").includes(text));
          if(el){el.click();return true;} return false;}, sel, text);
        await clickText("button","إنشاء اليوم التدريبي الأول"); await new Promise(r=>setTimeout(r,1200));
        await clickText("button.dplan-add-item","إضافة تمرين");  await new Promise(r=>setTimeout(r,1500));
        await page.evaluate(()=>document.querySelector(".dplan-picker-list li button")?.click()); await new Promise(r=>setTimeout(r,1200));
        if (process.env.KEEPPICKER !== "1") {
          await page.evaluate(()=>document.querySelector(".dplan-picker-head .diet-icon-btn")?.click()); await new Promise(r=>setTimeout(r,1200));
        } else {
          await page.evaluate(()=>document.querySelector("button.dplan-add-item")?.click()); await new Promise(r=>setTimeout(r,1500));
        }
      }
      /* Scroll the real scroller to its end. */
      await page.evaluate((b) => { window.__BACKOFF = b; }, parseInt(process.env.BACKOFF||"0",10));
      await page.evaluate(() => {
        const sc = document.querySelector(".admin-main-content");
        if (sc) sc.scrollTop = sc.scrollHeight - sc.clientHeight - (+(window.__BACKOFF||0));
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      await new Promise(r=>setTimeout(r,800));
      const res = await page.evaluate(() => {
        const bar = document.querySelector(".admin-bottom-nav");
        if (!bar) return { err:"no bar" };
        const barTop = bar.getBoundingClientRect().top;
        const rows = [];
        const chain = (el)=>{const p=[];let n=el;for(let i=0;n&&i<4;i++,n=n.parentElement){const c=(n.getAttribute("class")||"").trim().split(/\s+/).filter(Boolean).slice(0,2).join(".");p.unshift(n.tagName.toLowerCase()+(c?"."+c:""));}return p.join(" > ");};
        let worst = null;
        for (const el of document.querySelectorAll(".admin-main-content *")) {
          if (el.children.length > 0) continue;              // leaves only
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.opacity === "0") continue;
          /* Fixed boxes do not scroll with the page, so they are not what the
             bar can cover. The toast portal is one and is always the lowest. */
          let fixed = false;
          for (let a = el; a && !a.classList.contains("admin-main-content"); a = a.parentElement) {
            if (getComputedStyle(a).position === "fixed") { fixed = true; break; }
          }
          if (fixed) continue;
          /* A box below the fold of an inner scroller is clipped, not covered.
             The CMS pane is one, and without this every field under its fold
             reads as content hidden by the bar. Keep the element only while its
             bottom is still inside every scrolling ancestor. */
          let clipped = false;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const ac = getComputedStyle(a);
            if (/^(auto|scroll|hidden|clip)$/.test(ac.overflowY)) {
              if (r.bottom > a.getBoundingClientRect().bottom + 1) { clipped = true; break; }
            }
          }
          if (clipped) continue;
          if (r.top > window.innerHeight || r.bottom < 0) continue;
          if (r.width < 20) continue;
          const gap = barTop - r.bottom;
          rows.push({ gap: Math.round(gap), path: chain(el), w: Math.round(r.width), h: Math.round(r.height),
                      text:(el.textContent||"").trim().replace(/\s+/g," ").slice(0,26) });
        }
        const sc = document.querySelector(".admin-main-content");
        rows.sort((a,b)=>a.gap-b.gap);
        const susp = document.querySelector(".diet-page.dplan-page");
        let info = null;
        if (susp) {
          const kids=[...susp.children].map(k=>{const r=k.getBoundingClientRect();const c=getComputedStyle(k);
            return { cls:k.getAttribute("class")||"(none)", tag:k.tagName, w:Math.round(r.width),h:Math.round(r.height),
                     top:Math.round(r.top), bottom:Math.round(r.bottom), pos:c.position, bg:c.backgroundColor, kids:k.children.length };});
          info = kids;
        }
        return { barTop: Math.round(barTop), barH: Math.round(bar.getBoundingClientRect().height),
                 padBottom: sc ? getComputedStyle(sc).paddingBottom : "-",
                 scrollTop: sc ? Math.round(sc.scrollTop) : -1,
                 scrollH: sc ? Math.round(sc.scrollHeight) : -1,
                 clientH: sc ? Math.round(sc.clientHeight) : -1,
                 pageKids: info, worst: rows[0], rows: rows.slice(0,3) };
      });
      if (process.env.SHOT) { await page.screenshot({ path: `${process.env.SHOT}/navlap-${w}.png` }); console.log("  shot navlap-"+w+".png"); }
      const g = res.worst ? res.worst.gap : null;
      const mark = g === null ? "????" : g < 0 ? "OVERLAP" : g < 8 ? "TIGHT" : " ok ";
      console.log(`  [${mark}] ${path} @${w}  gap ${g}px   barH ${res.barH}  padBottom ${res.padBottom}`);
      console.log(`           scroller: scrollTop ${res.scrollTop} scrollH ${res.scrollH} clientH ${res.clientH}`);
      for (const k of (res.pageKids||[])) console.log(`           KID ${k.tag}.${k.cls} ${k.w}x${k.h} top ${k.top} bottom ${k.bottom} pos ${k.pos} bg ${k.bg} kids ${k.kids}`);
      for (const r of (res.rows||[])) console.log(`           gap ${String(r.gap).padStart(5)}  ${r.w}x${r.h}  ${r.path}  "${r.text}"`);
    }
  }
} finally {
  await browser.close();
  await q(`delete from public.accounts where id=$1`,[acc.id]);
  await end();
}

/* Each month of the timeline shows its own record, and only its own.
 *
 * The coach's page used to carry three panels below the timeline — the monthly
 * record, the logged weights and the weigh-in chart — each showing the whole
 * subscription at once. They now live inside every month, narrowed to that
 * month's dates. What makes that worth testing is the narrowing: a panel that
 * simply moved would still show month two's weights under month one, and would
 * look right in a screenshot.
 *
 * So the fixture is deliberately two months with disjoint data, and every
 * assertion is a pair — mine appears, the other month's does not.
 *
 *   node tests/http/month-isolation.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL } from "./_lib.mjs";

const RUN = "ISO_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const DAY = 86400000;

const { q, end } = await db();

const results = [];
const check = (test, pass, note = "") => {
  results.push({ test, pass, note });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${test}${note ? ` — ${note}` : ""}`);
};

console.log("=".repeat(72));
console.log("MONTH ISOLATION — EACH TAB SHOWS ITS OWN MONTH");
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(72));

let exitCode = 0;
let browser;
const made = { accounts: [], profiles: [], courses: [], exercises: [] };

/* Month one ran from day -70 to day -40; month two from day -40 to now. Every
   value below is unique to its month so nothing can pass by coincidence. */
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const now = Date.now();
const M1_START = now - 70 * DAY;
const RENEWAL = now - 40 * DAY;

const M1 = { weight: "95", lift: 47.5, log: 94.5, logDate: iso(now - 60 * DAY), exercise: `${RUN}_تمرين_الشهر_الأول` };
const M2 = { weight: "88", lift: 82.5, log: 87.5, logDate: iso(now - 20 * DAY), exercise: `${RUN}_تمرين_الشهر_الثاني` };

try {
  /* --------------------------------------------------------------- seed -- */

  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);
  const [acc] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id, username`,
    [`${RUN}_main`, hash]
  );
  made.accounts.push(acc.id);

  const [course] = await q(
    `insert into public.courses (name, days_data) values ($1, $2::jsonb) returning id`,
    [`${RUN} كورس`, JSON.stringify([{ day: "اليوم الأول", exercises: [] }])]
  );
  made.courses.push(course.id);

  /* A profile that has renewed once: month one archived in `history`, month two
     running. `renewals` is what `buildSubscriptionMonths` counts. */
  const blob = {
    fullname: `${RUN} تجربة`,
    gender: "male", plan: "plan2", plan_type: "both",
    weight: M2.weight, height: "180", age: "30",
    activation_date: new Date(M1_START).toISOString(),
    history: [
      {
        label: "الشهر الأول",
        date: new Date(RENEWAL).toISOString(),
        data: { fullname: `${RUN} تجربة`, weight: M1.weight, height: "180", age: "30", gender: "male" },
      },
    ],
    renewals: [{ date: new Date(RENEWAL).toISOString(), label: "الشهر 2" }],
    weightLogs: [
      { date: M1.logDate, weight: M1.log },
      { date: M2.logDate, weight: M2.log },
    ],
    __test_run: RUN,
  };

  const [pro] = await q(
    `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended, current_course_id)
     values ($1, $2::jsonb, $3, $4, false, $5) returning id`,
    [`${RUN}_main`, JSON.stringify(blob), acc.id, new Date(now + 20 * DAY), course.id]
  );
  made.profiles.push(pro.id);

  /* One lifted weight in each month, under a differently named exercise. */
  const logLift = async (name, weight, date) => {
    const [ex] = await q(
      `insert into public.exercises (name_ar, target_muscle) values ($1, $2) returning id`,
      [name, "صدر"]
    );
    made.exercises.push(ex.id);
    /* `day_id` is not null and forms part of the entry's unique key — it names
       the day of the course the set belongs to. */
    await q(
      `insert into public.workout_logs
         (profile_id, exercise_id, exercise_name, day_id, set_index, reps, weight, session_date)
       values ($1, $2, $3, $4, 1, '10', $5, $6)`,
      [pro.id, ex.id, name, `${RUN}_day`, weight, date]
    );
  };
  await logLift(M1.exercise, M1.lift, iso(now - 55 * DAY));
  await logLift(M2.exercise, M2.lift, iso(now - 15 * DAY));

  console.log(`\nSEEDED  profile ${pro.id}`);
  console.log(`  month 1: weight ${M1.weight}, lift ${M1.lift}, weigh-in ${M1.log} on ${M1.logDate}`);
  console.log(`  month 2: weight ${M2.weight}, lift ${M2.lift}, weigh-in ${M2.log} on ${M2.logDate}`);

  /* ------------------------------------------------------------ browser -- */

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1400, height: 1400 });
  await page.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: "admin" }),
    domain: "localhost", path: "/",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(`${BASE_URL}/admin/profile/${pro.id}`, { waitUntil: "networkidle0", timeout: 90000 });

  /* The three standalone panels are gone from the page body. Checked before
     anything is expanded, which is where they used to render. */
  const pageText = await page.evaluate(() => document.body.innerText);
  check("A.1 the standalone 'سجل الأشهر' panel is gone from the page",
    !pageText.includes("سجل الأشهر"));
  check("A.2 the standalone weigh-in chart is gone", !pageText.includes("سجل الوزن الأسبوعي"));
  check("A.3 the standalone lifted-weights panel is gone",
    !pageText.includes("سجل الأوزان ومتابعة التقدّم"));

  /* Open every month accordion, then every info card in it. */
  await page.evaluate(() => {
    document.querySelectorAll('[title="عرض التفاصيل"]').forEach((n) => n.click());
  });
  await page.waitForFunction(
    () => document.body.innerText.includes("معلومات المشترك"),
    { timeout: 20000 }
  ).catch(() => {});

  const infoButtons = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((b) =>
      b.innerText.trim().includes("عرض المعلومات")
    ).length
  );
  check("A.4 the info card appears in both months, not only the first",
    infoButtons === 2, `found ${infoButtons}`);

  /* Opens each info card in turn and returns {monthName: panelText}.
   *
   * Driven by the buttons rather than by walking up the DOM from a month
   * heading: only one card can be open at a time — `selectedInfoMonth` holds a
   * single number — so clicking each button and reading the panel that appears
   * identifies the month from the panel's own heading, with no assumption about
   * how deeply the markup nests.
   *
   * The record and the lifted weights each render as a collapsed <details>, and
   * a collapsed <details> contributes nothing to innerText. They are opened
   * before reading, or every assertion below would pass for the wrong reason. */
  const readAllMonths = async () => {
    const out = {};
    for (let i = 0; i < infoButtons; i++) {
      const clicked = await page.evaluate((index) => {
        const btns = [...document.querySelectorAll("button")].filter((b) =>
          b.innerText.trim().includes("عرض المعلومات")
        );
        if (!btns[index]) return false;
        btns[index].click();
        return true;
      }, i);
      if (!clicked) continue;

      await page.waitForFunction(
        () => document.body.innerText.includes("إخفاء المعلومات"),
        { timeout: 15000 }
      ).catch(() => {});

      const entry = await page.evaluate(() => {
        const heading = [...document.querySelectorAll("h4")].find((h) =>
          h.innerText.includes("معلومات المشترك (")
        );
        if (!heading) return null;
        const panel = heading.parentElement?.parentElement;
        if (!panel) return null;
        panel.querySelectorAll("details").forEach((d) => (d.open = true));
        const name = (heading.innerText.match(/\(([^)]+)\)/) || [])[1] ?? "?";
        return { name, text: panel.innerText };
      });
      if (entry) out[entry.name] = entry.text;

      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((el) =>
          el.innerText.trim().includes("إخفاء المعلومات")
        );
        b?.click();
      });
      await new Promise((r) => setTimeout(r, 400));
    }
    return out;
  };

  const panels = await readAllMonths();
  console.log(`  read panels: ${Object.keys(panels).join(", ") || "none"}`);

  /* ================================================= B — month one ======= */

  console.log("\nB — the first month's tab");

  const m1 = panels["الشهر الأول"];
  check("B.0 the first month's card opened", Boolean(m1), m1 ? `${m1.length} chars` : "not found");

  if (m1) {
    check("B.1 it shows the first month's own weight", m1.includes(M1.weight),
      `looking for ${M1.weight}`);
    check("B.2 it shows the exercise lifted in that month", m1.includes(M1.exercise));
    check("B.3 it shows that month's lifted weight", m1.includes(String(M1.lift)));
    check("B.4 — and NOT the second month's exercise", !m1.includes(M2.exercise));
    check("B.5 — and NOT the second month's lifted weight", !m1.includes(String(M2.lift)));
    check("B.6 — and NOT the second month's weigh-in", !m1.includes(String(M2.log)));
  }

  /* ================================================= C — month two ======= */

  console.log("\nC — the second month's tab");

  const m2 = panels["الشهر الثاني"];
  check("C.0 the second month's card opened", Boolean(m2), m2 ? `${m2.length} chars` : "not found");

  if (m2) {
    check("C.1 it shows the second month's own weight", m2.includes(M2.weight),
      `looking for ${M2.weight}`);
    check("C.2 it shows the exercise lifted in that month", m2.includes(M2.exercise));
    check("C.3 it shows that month's lifted weight", m2.includes(String(M2.lift)));
    check("C.4 — and NOT the first month's exercise", !m2.includes(M1.exercise));
    check("C.5 — and NOT the first month's lifted weight", !m2.includes(String(M1.lift)));
    check("C.6 — and NOT the first month's weigh-in", !m2.includes(String(M1.log)));
  }

  /* ============================================ E — three tabs alike ===== */

  console.log("\nE — the three sections inside a month are three of a kind");

  /* Re-open one month and inspect the containers themselves rather than their
     text: what changed here is the shape, and text assertions cannot see it. */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((el) =>
      el.innerText.trim().includes("عرض المعلومات")
    );
    b?.click();
  });
  await page.waitForFunction(
    () => document.body.innerText.includes("إخفاء المعلومات"),
    { timeout: 15000 }
  ).catch(() => {});

  const tabs = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h4")].find((h) =>
      h.innerText.includes("معلومات المشترك (")
    );
    const panel = heading?.parentElement?.parentElement;
    if (!panel) return null;
    /* Only the section's own containers, not the <details> nested inside a
       month's attachment list. */
    const own = [...panel.children].filter((c) => c.tagName === "DETAILS");
    return own.map((d) => {
      const cs = getComputedStyle(d);
      return {
        title: d.querySelector("summary")?.innerText.split("\n")[0].trim() ?? "",
        open: d.open,
        radius: cs.borderTopLeftRadius,
        border: cs.borderTopWidth + " " + cs.borderTopColor,
        background: cs.backgroundColor,
        hasChevron: Boolean(d.querySelector("summary .accordion-icon")),
      };
    });
  });

  check("E.1 the month holds exactly three collapsible sections",
    Array.isArray(tabs) && tabs.length === 3,
    tabs ? tabs.map((t) => t.title).join(" | ") : "panel not found");

  if (tabs && tabs.length === 3) {
    check("E.2 the weigh-in chart is one of them — it is a tab now",
      tabs.some((t) => t.title.includes("سجل الوزن الأسبوعي")),
      tabs.map((t) => t.title).join(" | "));
    check("E.3 all three start collapsed", tabs.every((t) => t.open === false),
      tabs.map((t) => `${t.title}:${t.open}`).join(" | "));
    check("E.4 all three carry a chevron", tabs.every((t) => t.hasChevron));
    /* The point of the change: no one of them is styled unlike the others. */
    check("E.5 same corner radius on all three",
      new Set(tabs.map((t) => t.radius)).size === 1,
      tabs.map((t) => t.radius).join(" | "));
    check("E.6 same border on all three — none is picked out in a different colour",
      new Set(tabs.map((t) => t.border)).size === 1,
      tabs.map((t) => t.border).join(" | "));
    /* And a border that can actually be seen. `--border` is #162235 against a
       `--bg2` of #15212E — seven units apart in one channel, which is not a
       visible outline. `--border-strong` is #22334D. Asserted as a distance
       from the background rather than as a hex value, so the check survives a
       change of palette and still means "visible". */
    const seen = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h4")].find((h) =>
        h.innerText.includes("معلومات المشترك (")
      );
      const d = [...(heading?.parentElement?.parentElement?.children ?? [])].find(
        (c) => c.tagName === "DETAILS"
      );
      if (!d) return null;
      const cs = getComputedStyle(d);
      const rgb = (v) => (v.match(/\d+/g) || []).slice(0, 3).map(Number);
      const b = rgb(cs.borderTopColor);
      const g = rgb(cs.backgroundColor);
      if (b.length < 3 || g.length < 3) return null;
      return {
        border: cs.borderTopColor,
        background: cs.backgroundColor,
        distance: Math.max(...b.map((v, i) => Math.abs(v - g[i]))),
      };
    });
    check("E.8 the border stands out from the box it outlines",
      Boolean(seen) && seen.distance >= 20,
      seen ? `${seen.border} on ${seen.background} — max channel gap ${seen.distance}` : "not measured");
    check("E.7 same background on all three",
      new Set(tabs.map((t) => t.background)).size === 1,
      tabs.map((t) => t.background).join(" | "));
  }

  /* ====================================== F — the trainee is untouched === */

  console.log("\nF — the trainee's own weight page is unchanged");

  const tctx = await browser.createBrowserContext();
  const tpage = await tctx.newPage();
  await tpage.setViewport({ width: 1400, height: 1200 });
  await tpage.setCookie({
    name: "gym_session",
    value: mintSession({ id: acc.id, username: acc.username }),
    domain: "localhost", path: "/",
  });
  await tpage.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle0", timeout: 90000 });
  await tpage.waitForFunction(
    () => document.body.innerText.includes("هلا بيك"),
    { timeout: 40000 }
  ).catch(() => {});
  /* The weight tab is one of the dashboard's own tabs. */
  await tpage.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((el) =>
      el.innerText.includes("سجل الأوزان")
    );
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  const tState = await tpage.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find(
      (x) => x.innerText.trim() === "سجل الوزن الأسبوعي"
    );
    return {
      heading: Boolean(h),
      insideDetails: Boolean(h?.closest("details")),
    };
  });
  check("F.1 the trainee still sees the heading, not a summary", tState.heading);
  check("F.2 — and it was not turned into a collapsible tab for them",
    tState.heading && !tState.insideDetails);
  await tctx.close();

  const real = errors.filter((e) => !/favicon|DevTools|_next\/image/i.test(e));
  check("D.1 no page errors during the run", real.length === 0, real.slice(0, 2).join(" | "));

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

  console.log("\nCLEANUP — by id, child-first");
  try {
    const del = async (label, sql, ids) => {
      if (!ids.length) return;
      const r = await q(sql, [ids]);
      console.log(`  ${label.padEnd(12)} ${r.length} / ${ids.length}`);
    };
    /* workout_logs cascade from the profile; exercises do not, so they go last. */
    await del("profiles", `delete from public.profiles where id = any($1::uuid[]) returning id`, made.profiles);
    await del("exercises", `delete from public.exercises where id = any($1::uuid[]) returning id`, made.exercises);
    await del("courses", `delete from public.courses where id = any($1::uuid[]) returning id`, made.courses);
    await del("accounts", `delete from public.accounts where id = any($1::uuid[]) returning id`, made.accounts);

    const [left] = await q(
      `select (select count(*) from public.accounts where username like $1)
            + (select count(*) from public.profiles where username like $1)
            + (select count(*) from public.courses where name like $1)
            + (select count(*) from public.exercises where name_ar like $1) as n`,
      [`${RUN}%`]
    );
    console.log(`  remaining for this run: ${left.n}`);
    if (Number(left.n) !== 0) exitCode = 1;
  } catch (e) {
    console.error(`  CLEANUP FAILED: ${e.message}`);
    exitCode = 1;
  }

  await end();
  process.exit(exitCode);
}

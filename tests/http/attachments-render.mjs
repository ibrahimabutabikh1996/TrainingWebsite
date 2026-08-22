/* Attachments that actually load.
 *
 * The stored value is a path inside a private bucket — `usersData/<session>/…`
 * — and two components put it straight into `src`/`href`. A browser reads a
 * string with no scheme and no leading slash as relative to the current page,
 * so the request went to `/admin/profile/<id>/usersData/…`, which is nothing,
 * and the coach saw a broken-image icon. The trainee's own page had it too.
 *
 * The assertion that matters is not that an <img> exists — it did before, and
 * it was broken. It is that the address resolves and the bytes arrive:
 * `naturalWidth > 0` is the browser saying it decoded an image.
 *
 * A real object is uploaded to storage for this, and deleted again in the
 * `finally` along with every row.
 *
 *   node tests/http/attachments-render.mjs
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import puppeteer from "puppeteer";
import { db, mintSession, BASE_URL, readEnv } from "./_lib.mjs";

const RUN = "ATT_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const DAY = 86400000;

const SUPABASE_URL = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY");

const { q, end } = await db();

const results = [];
const check = (test, pass, note = "") => {
  results.push({ test, pass, note });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${test}${note ? ` — ${note}` : ""}`);
};

console.log("=".repeat(72));
console.log("ATTACHMENTS — DO THE IMAGES ACTUALLY LOAD");
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(72));

let exitCode = 0;
let browser;
const made = { accounts: [], profiles: [], objects: [] };

/* A one-pixel PNG. Small, real, and decodable — which is the whole point:
   `naturalWidth` is only non-zero if the browser actually got an image. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const storage = async (method, path, body, contentType) => {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/uploads/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body,
  });
  return { status: res.status, text: await res.text().catch(() => "") };
};

try {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase keys missing from .env");

  /* --------------------------------------------------------------- seed -- */

  const session = crypto.randomUUID();
  const photoPath = `usersData/${session}/body_photos_${RUN}`;
  const receiptPath = `usersData/${session}/payment_receipt_${RUN}`;

  for (const path of [photoPath, receiptPath]) {
    const up = await storage("POST", path, PNG, "image/png");
    if (up.status >= 300) throw new Error(`upload failed ${up.status}: ${up.text.slice(0, 120)}`);
    made.objects.push(path);
  }
  console.log(`\nUPLOADED  2 objects under usersData/${session.slice(0, 8)}…`);

  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);
  const [acc] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id, username`,
    [`${RUN}_main`, hash]
  );
  made.accounts.push(acc.id);

  const [pro] = await q(
    `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
     values ($1, $2::jsonb, $3, $4, false) returning id`,
    [
      `${RUN}_main`,
      JSON.stringify({
        fullname: `${RUN} تجربة`, gender: "male", plan: "plan2", plan_type: "both",
        weight: "80", height: "180", age: "30",
        activation_date: new Date(Date.now() - 10 * DAY).toISOString(),
        body_photos: [photoPath],
        payment_receipt: [receiptPath],
        history: [], renewals: [], __test_run: RUN,
      }),
      acc.id, new Date(Date.now() + 20 * DAY),
    ]
  );
  made.profiles.push(pro.id);

  /* `/api/attachments` refuses a path the profile does not reference, and reads
     that from the upload record the server wrote — so the rows have to exist. */
  const [upSession] = await q(
    `insert into public.upload_sessions (scope, account_id, profile_id, status, expires_at, client_ip)
     values ('registration', $1, $2, 'consumed', now() + interval '1 hour', '127.0.0.1') returning id`,
    [acc.id, pro.id]
  );
  for (const [field, path] of [["body_photos", photoPath], ["payment_receipt", receiptPath]]) {
    await q(
      `insert into public.upload_items
         (session_id, field, storage_path, status, detected_type, mime, size_bytes, confirmed_at)
       values ($1, $2, $3, 'attached', 'png', 'image/png', $4, now())`,
      [upSession.id, field, path, PNG.length]
    );
  }
  console.log(`SEEDED    profile ${pro.id}`);

  /* ------------------------------------------------------------ browser -- */

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  const open = async (token, url) => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1400, height: 1400 });
    await page.setCookie({ name: "gym_session", value: token, domain: "localhost", path: "/" });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
    return { ctx, page };
  };

  /** Every <img> the page drew, with whether the browser decoded it.
   *
   * Scrolled into view and waited on first. The galleries mark their images
   * `loading="lazy"`, so one below the fold is never fetched at all and reports
   * `naturalWidth === 0` — indistinguishable, from here, from a broken address.
   * That is what this measurement is for, so the lazy case has to be taken off
   * the table before it is read. */
  const readImages = async (page) => {
    await page.evaluate(() => {
      const imgs = [...document.querySelectorAll("img")].filter((i) =>
        (i.getAttribute("src") || "").includes("attachments")
      );
      for (const i of imgs) {
        i.loading = "eager";
        i.scrollIntoView({ block: "center" });
      }
    });
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("img")]
            .filter((i) => (i.getAttribute("src") || "").includes("attachments"))
            .every((i) => i.complete),
        { timeout: 20000 }
      )
      .catch(() => {});
    return page.evaluate(() =>
      [...document.querySelectorAll("img")]
        .filter((i) => (i.getAttribute("src") || "").includes("attachments"))
        .map((i) => ({
          src: i.getAttribute("src"),
          loaded: i.complete && i.naturalWidth > 0,
        }))
    );
  };

  /* ============================================== A — the coach's panel == */

  console.log("\nA — the coach's month record");

  const coach = await open(mintSession({ id: acc.id, username: "admin" }), `${BASE_URL}/admin/profile/${pro.id}`);
  await coach.page.evaluate(() => {
    document.querySelectorAll('[title="عرض التفاصيل"]').forEach((n) => n.click());
  });
  await coach.page.waitForFunction(
    () => document.body.innerText.includes("عرض المعلومات"),
    { timeout: 20000 }
  ).catch(() => {});
  await coach.page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((el) =>
      el.innerText.trim().includes("عرض المعلومات")
    );
    b?.click();
  });
  await coach.page.waitForFunction(
    () => document.body.innerText.includes("إخفاء المعلومات"),
    { timeout: 15000 }
  ).catch(() => {});
  /* The record is a collapsed <details>; the gallery is inside it. */
  await coach.page.evaluate(() => {
    document.querySelectorAll("details").forEach((d) => (d.open = true));
  });
  await new Promise((r) => setTimeout(r, 2500));

  const coachLinks = await coach.page.evaluate(() =>
    [...document.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && h.includes("attachments"))
  );
  check("A.1 the receipt link goes through the authorising reader",
    coachLinks.some((h) => h.startsWith("/api/attachments?path=")),
    coachLinks[0] ?? "none found");
  check("A.2 no element points at a bare storage path",
    await coach.page.evaluate(() =>
      ![...document.querySelectorAll("a[href], img[src]")].some((el) => {
        const v = el.getAttribute("href") || el.getAttribute("src") || "";
        return v.startsWith("usersData/");
      })
    ));

  const coachImgs = await readImages(coach.page);
  check("A.3 the body photo is drawn", coachImgs.length > 0, `${coachImgs.length} image(s)`);
  check("A.4 — and the browser actually decoded it",
    coachImgs.length > 0 && coachImgs.every((i) => i.loaded),
    coachImgs.map((i) => `${i.loaded}`).join(", "));
  await coach.ctx.close();

  /* ============================================= B — the trainee's page == */

  console.log("\nB — the trainee's own profile tab");

  const trainee = await open(
    mintSession({ id: acc.id, username: acc.username }),
    `${BASE_URL}/dashboard`
  );
  await trainee.page.waitForFunction(
    () => document.body.innerText.includes("هلا بيك"),
    { timeout: 40000 }
  ).catch(() => {});
  await trainee.page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((el) =>
      el.innerText.includes("الملف الشخصي")
    );
    b?.click();
  });
  await trainee.page.waitForFunction(
    () => [...document.querySelectorAll("img")].some((i) =>
      (i.getAttribute("src") || "").includes("attachments")
    ),
    { timeout: 25000 }
  ).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));

  const traineeImgs = await readImages(trainee.page);
  check("B.1 the trainee's own photo is drawn", traineeImgs.length > 0,
    `${traineeImgs.length} image(s)`);
  check("B.2 — and it loads for them too",
    traineeImgs.length > 0 && traineeImgs.every((i) => i.loaded),
    traineeImgs.map((i) => `${i.loaded}`).join(", "));
  check("B.3 nothing on their page points at a bare storage path",
    await trainee.page.evaluate(() =>
      ![...document.querySelectorAll("a[href], img[src]")].some((el) => {
        const v = el.getAttribute("href") || el.getAttribute("src") || "";
        return v.startsWith("usersData/");
      })
    ));
  await trainee.ctx.close();

  /* ================================== C — the reader still refuses others = */

  console.log("\nC — the reader has not been loosened");

  const anon = await fetch(
    `${BASE_URL}/api/attachments?path=${encodeURIComponent(photoPath)}`,
    { redirect: "manual" }
  );
  check("C.1 an unauthenticated caller is refused", anon.status === 401,
    `HTTP ${anon.status}`);

  const [other] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id, username`,
    [`${RUN}_other`, hash]
  );
  made.accounts.push(other.id);
  const [otherPro] = await q(
    `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
     values ($1, '{}'::jsonb, $2, $3, false) returning id`,
    [`${RUN}_other`, other.id, new Date(Date.now() + 20 * DAY)]
  );
  made.profiles.push(otherPro.id);

  const stranger = await fetch(
    `${BASE_URL}/api/attachments?path=${encodeURIComponent(photoPath)}`,
    {
      headers: { Cookie: `gym_session=${mintSession({ id: other.id, username: other.username })}` },
      redirect: "manual",
    }
  );
  check("C.2 another trainee cannot fetch this file", stranger.status === 403,
    `HTTP ${stranger.status}`);

  const traversal = await fetch(
    `${BASE_URL}/api/attachments?path=${encodeURIComponent("usersData/../images/x")}`,
    {
      headers: { Cookie: `gym_session=${mintSession({ id: acc.id, username: "admin" })}` },
      redirect: "manual",
    }
  );
  check("C.3 a path climbing out of its folder is refused", traversal.status === 400,
    `HTTP ${traversal.status}`);

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

  console.log("\nCLEANUP — by id and by path, from this run only");
  try {
    for (const path of made.objects) {
      const del = await storage("DELETE", path);
      console.log(`  object   ${del.status < 300 ? "removed" : "FAILED " + del.status}  ${path.slice(-28)}`);
      if (del.status >= 300) exitCode = 1;
    }
    /* upload_items and upload_sessions cascade from the profile. */
    if (made.profiles.length) {
      const r = await q(`delete from public.profiles where id = any($1::uuid[]) returning id`, [made.profiles]);
      console.log(`  profiles ${r.length} / ${made.profiles.length}`);
    }
    if (made.accounts.length) {
      const r = await q(`delete from public.accounts where id = any($1::uuid[]) returning id`, [made.accounts]);
      console.log(`  accounts ${r.length} / ${made.accounts.length}`);
    }
    const [left] = await q(
      `select (select count(*) from public.accounts where username like $1)
            + (select count(*) from public.profiles where username like $1) as n`,
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

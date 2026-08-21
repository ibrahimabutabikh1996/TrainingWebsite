/* VULN-04 — proof that rotating `x-forwarded-for` no longer buys extra attempts.
 *
 * The P0 harness relied on rotation to keep from throttling itself, and it
 * worked — which was the demonstration that the address was the only ceiling.
 * These tests rotate on purpose and assert that the request is refused anyway,
 * by a key the caller cannot choose.
 *
 * Creates its own fixtures, tracks them by id, and removes them at the end. It
 * never touches a row it did not create.
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { db, mintSession, cookieFor, http, record, results } from "./_lib.mjs";

const { q, end } = await db();
const RUN = `SECURITY_TEST_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const DAY = 86400000;

console.log("=".repeat(70));
console.log("VULN-04 — X-Forwarded-For rotation must not bypass the limits");
console.log(`Run ID: ${RUN}`);
console.log("=".repeat(70));

const created = { accounts: [], profiles: [], sessions: [], items: [] };

async function cleanup() {
  /* By id only, child-first. */
  if (created.items.length)
    await q(`delete from public.upload_items where id = any($1::uuid[])`, [created.items]);
  if (created.sessions.length)
    await q(`delete from public.upload_sessions where id = any($1::uuid[])`, [created.sessions]);
  if (created.profiles.length)
    await q(`delete from public.profiles where id = any($1::uuid[])`, [created.profiles]);
  if (created.accounts.length)
    await q(`delete from public.accounts where id = any($1::uuid[])`, [created.accounts]);
  /* The counters this run's synthetic addresses and keys created. */
  const keys = [];
  for (let i = 1; i <= 60; i++) keys.push(`submit-form:198.51.100.${i}`, `upload-session:198.51.100.${i}`, `upload-slot:198.51.100.${i}`);
  for (const p of created.profiles) keys.push(`submit-form:profile:${p}`, `upload-session:profile:${p}`);
  for (const s of created.sessions) keys.push(`submit-form:session:${s}`, `upload-slot:session:${s}`);
  await q(`delete from public.login_attempts where key = any($1::text[])`, [keys]);
}

/* A distinct forged address per call — the exact bypass being tested. */
let n = 0;
const rotatedIp = () => `198.51.100.${(n++ % 60) + 1}`;

const hash = await bcrypt.hash(`TestOnly_${RUN}`, 10);

const [acc] = await q(
  `insert into public.accounts (username, password, password_changed_at)
   values ($1, $2, now()) returning id, username`,
  [`${RUN}_v04`, hash]
);
created.accounts.push(acc.id);

const [pro] = await q(
  `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
   values ($1, $2::jsonb, $3, $4, false) returning id`,
  [`${RUN}_v04`, JSON.stringify({ fullname: `${RUN}_v04`, gender: "female", plan: "plan2", __test_run: RUN }), acc.id, new Date(Date.now() + 20 * DAY)]
);
created.profiles.push(pro.id);
console.log(`fixtures: account ${acc.id} / profile ${pro.id}\n`);

const cookie = cookieFor(mintSession({ id: acc.id, username: acc.username }));

function payload() {
  return {
    fullname: `${RUN}_f`, phone: "07700000000", plan: "plan2", gender: "female",
    age: "28", weight: "70", height: "165", activity: "opt_activity_2",
    residence: "بغداد", employment: "موظفة",
    meas_arm: "30", meas_waist: "70", meas_hips: "95", meas_leg: "50",
    workout_exp: "opt_exp_1", workout_type_exp: ["opt_type_gym"],
    workout_commit: "opt_commit_1", workout_days: "opt_days_3",
    sub_goal: "opt_goal_1", target_weight: "65", allergies: "لا", fav_foods: "دجاج",
    coffee_rate: "opt_coffee_0", buy_supp: "opt_supp_1", injuries: "لا",
  };
}

/* ================================================================= V4-1 == */
console.log("V4-1 — renewal: rotate the address on every request");
{
  /* The per-profile limit is 5. Twelve requests from twelve different forged
     addresses must still be cut off, because the profile key does not rotate. */
  const codes = [];
  for (let i = 0; i < 12; i++) {
    const r = await http("POST", "/api/submit-form", {
      body: { data: JSON.stringify(payload()), profileId: pro.id },
      cookie,
      ip: rotatedIp(),
    });
    codes.push(r.status);
  }
  const throttled = codes.filter((c) => c === 429).length;
  console.log(`      codes: ${codes.join(",")}`);
  record({
    test: "V4-1 renewal, rotated address",
    http: codes.join(","),
    expected: "429 appears despite a fresh address each time",
    actual: `${throttled} of 12 refused with 429`,
    pass: throttled > 0,
    note: "second key = profiles.id, which the caller cannot rotate",
  });
}

/* ================================================================= V4-2 == */
console.log("\nV4-2 — anonymous upload sessions: rotate the address on every request");
{
  /* The per-address limit is 6, so rotation used to give unlimited sessions.
     The global backstop is 200 in fifteen minutes — far above real traffic, so
     this run cannot reach it. What it CAN show is that the counter is being
     consumed globally: read the row before and after and prove it moved by the
     number of requests made, from addresses that were all different. */
  const before = await q(`select attempts from public.login_attempts where key = $1`, ["upload-session:global"]);
  const b = before[0]?.attempts ?? 0;

  const ids = [];
  for (let i = 0; i < 8; i++) {
    const r = await http("POST", "/api/uploads/session", {
      body: { scope: "registration" }, ip: rotatedIp(),
    });
    if (r.json?.uploadSessionId) {
      ids.push(r.json.uploadSessionId);
      created.sessions.push(r.json.uploadSessionId);
    }
  }
  const after = await q(`select attempts from public.login_attempts where key = $1`, ["upload-session:global"]);
  const a = after[0]?.attempts ?? 0;

  console.log(`      global counter: ${b} -> ${a}  (8 requests, 8 different addresses)`);
  record({
    test: "V4-2 anonymous sessions counted globally",
    http: "200 x8",
    expected: "the global counter advances by 8 despite 8 different addresses",
    actual: `counter ${b} -> ${a} (+${a - b}), ${ids.length} sessions issued`,
    pass: a - b === 8,
    note: "a rotated address is still counted — the backstop does not look at it",
  });
}

/* ================================================================= V4-3 == */
console.log("\nV4-3 — upload slots: rotate the address against ONE session");
{
  const sres = await http("POST", "/api/uploads/session", { body: { scope: "registration" }, ip: rotatedIp() });
  const sid = sres.json?.uploadSessionId;
  if (sid) created.sessions.push(sid);

  const before = await q(`select attempts from public.login_attempts where key = $1`, [`upload-slot:session:${sid}`]);
  const b = before[0]?.attempts ?? 0;

  const codes = [];
  for (let i = 0; i < 6; i++) {
    const r = await http("POST", "/api/uploads/create", {
      body: { uploadSessionId: sid, field: "payment_receipt" }, ip: rotatedIp(),
    });
    codes.push(r.status);
    if (r.json?.itemId) created.items.push(r.json.itemId);
  }
  const after = await q(`select attempts from public.login_attempts where key = $1`, [`upload-slot:session:${sid}`]);
  const a = after[0]?.attempts ?? 0;

  console.log(`      per-session counter: ${b} -> ${a}  (6 requests, 6 different addresses)`);
  console.log(`      codes: ${codes.join(",")}`);
  record({
    test: "V4-3 upload slots counted per session",
    http: codes.join(","),
    expected: "the per-session counter advances despite rotated addresses",
    actual: `counter ${b} -> ${a} (+${a - b})`,
    pass: a - b === 6,
    note: "second key = upload_sessions.id, server-minted",
  });
}

/* ================================================================= V4-4 == */
console.log("\nV4-4 — a rotated address cannot spend somebody else's budget");
{
  /* Naming a profile the caller does not own must be refused BEFORE the
     per-profile counter is touched, or an attacker could lock a trainee out of
     renewing by burning their allowance. */
  const strangerCookie = cookieFor(mintSession({ id: crypto.randomUUID(), username: `${RUN}_stranger` }));
  const key = `submit-form:profile:${pro.id}`;
  const before = await q(`select attempts from public.login_attempts where key = $1`, [key]);
  const b = before[0]?.attempts ?? 0;

  const r = await http("POST", "/api/submit-form", {
    body: { data: JSON.stringify(payload()), profileId: pro.id },
    cookie: strangerCookie, ip: rotatedIp(),
  });

  const after = await q(`select attempts from public.login_attempts where key = $1`, [key]);
  const a = after[0]?.attempts ?? 0;
  console.log(`      victim counter: ${b} -> ${a}  (request answered ${r.status})`);
  record({
    test: "V4-4 unauthorised caller cannot burn a victim's allowance",
    http: r.status,
    expected: "401/403 and the victim's counter unchanged",
    actual: `${r.status}, counter ${b} -> ${a}`,
    pass: (r.status === 401 || r.status === 403) && a === b,
    note: "counter consumed only after ownership is proven",
  });
}

/* ================================================================ SUMMARY == */
console.log("\n" + "=".repeat(70));
const pass = results.filter((r) => r.pass === true).length;
const fail = results.filter((r) => r.pass === false).length;
console.log(`VULN-04 RESULTS: ${pass} PASS · ${fail} FAIL`);
for (const r of results.filter((x) => x.pass === false)) {
  console.log(`FAIL  ${r.test}\n      expected: ${r.expected}\n      actual  : ${r.actual}`);
}

console.log("\nCLEANUP");
await cleanup();
const left = await q(
  `select (select count(*) from public.accounts where username like $1) +
          (select count(*) from public.profiles where username like $1) as n`,
  [`${RUN}%`]
);
console.log(`  rows remaining for this run: ${left[0].n}`);
console.log("=".repeat(70));

await end();
process.exit(fail > 0 || Number(left[0].n) > 0 ? 1 : 0);

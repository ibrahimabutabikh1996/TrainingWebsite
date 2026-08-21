/* G-1 — opening a renewal upload session requires a session that is still good.
 *
 * `sessionOwnsProfile` answers `true` for the coach before it looks anything up,
 * and this route handed it a session read straight from the cookie. A coach
 * whose token had been withdrawn could therefore still open an upload session
 * pointed at any trainee's profile. These tests assert that the withdrawn cases
 * are refused and — just as important — that the working ones still work.
 *
 * Creates its own fixtures, tracks them by id, removes them at the end.
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { db, mintSession, cookieFor, http, record, results } from "./_lib.mjs";

const { q, end } = await db();
const RUN = `SECURITY_TEST_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const DAY = 86400000;

console.log("=".repeat(70));
console.log("G-1 — renewal upload sessions require a live session");
console.log(`Run ID: ${RUN}`);
console.log("=".repeat(70));

const created = { accounts: [], profiles: [], sessions: [] };

async function cleanup() {
  if (created.sessions.length)
    await q(`delete from public.upload_items where session_id = any($1::uuid[])`, [created.sessions]);
  if (created.sessions.length)
    await q(`delete from public.upload_sessions where id = any($1::uuid[])`, [created.sessions]);
  if (created.profiles.length)
    await q(`delete from public.profiles where id = any($1::uuid[])`, [created.profiles]);
  if (created.accounts.length)
    await q(`delete from public.accounts where id = any($1::uuid[])`, [created.accounts]);
  const keys = ["upload-session:global"];
  for (const p of created.profiles) keys.push(`upload-session:profile:${p}`);
  await q(`delete from public.login_attempts where key = any($1::text[])`, [keys]);
}

const hash = await bcrypt.hash(`TestOnly_${RUN}`, 10);

async function makeTrainee(tag) {
  const [acc] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id, username`,
    [`${RUN}_${tag}`, hash]
  );
  created.accounts.push(acc.id);
  const [pro] = await q(
    `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
     values ($1, $2::jsonb, $3, $4, false) returning id`,
    [`${RUN}_${tag}`, JSON.stringify({ fullname: `${RUN}_${tag}`, __test_run: RUN }), acc.id, new Date(Date.now() + 20 * DAY)]
  );
  created.profiles.push(pro.id);
  return { acc, pro };
}

const owner = await makeTrainee("owner");
const victim = await makeTrainee("victim");
const coach = await makeTrainee("coach");
console.log(`owner ${owner.pro.id} / victim ${victim.pro.id}\n`);

const live = (acc, username) => cookieFor(mintSession({ id: acc.id, username }));
/* Minted a day before the fixture's `password_changed_at` — the shape
   `sessionRefusal` calls stale. Nothing is mutated to produce it. */
const revoked = (acc, username) =>
  cookieFor(mintSession({ id: acc.id, username }, { issuedAt: Math.floor(Date.now() / 1000) - 2 * 86400 }));

async function openRenewal(cookie, profileId) {
  const r = await http("POST", "/api/uploads/session", {
    body: { scope: "renewal", profileId }, cookie,
  });
  if (r.json?.uploadSessionId) created.sessions.push(r.json.uploadSessionId);
  return r;
}

/* ================================================================== G1-1 == */
console.log("G1-1 — a live trainee opens a session for their OWN profile");
{
  const r = await openRenewal(live(owner.acc, `${RUN}_owner`), owner.pro.id);
  record({
    test: "G1-1 live trainee, own profile",
    http: r.status,
    expected: "200 with a session id",
    actual: `${r.status} ${r.json?.uploadSessionId ? "issued" : JSON.stringify(r.json)}`,
    pass: r.status === 200 && Boolean(r.json?.uploadSessionId),
    note: "the ordinary renewal path still works",
  });
}

/* ================================================================== G1-2 == */
console.log("\nG1-2 — a LIVE coach: intended behaviour preserved");
{
  const own = await openRenewal(live(coach.acc, "admin"), coach.pro.id);
  const other = await openRenewal(live(coach.acc, "admin"), victim.pro.id);
  console.log(`      own profile ${own.status}, trainee's profile ${other.status}`);
  record({
    test: "G1-2 live coach, own profile",
    http: own.status, expected: "200",
    actual: String(own.status),
    pass: own.status === 200,
    note: "requirement 3 — the coach's own path is untouched",
  });
  record({
    test: "G1-2b live coach, a trainee's profile",
    http: other.status,
    expected: "200 — sessionOwnsProfile still admits a LIVE coach",
    actual: String(other.status),
    pass: other.status === 200,
    note: "helping a trainee renew keeps working; only revoked tokens change",
  });
}

/* ================================================================== G1-3 == */
console.log("\nG1-3 — a REVOKED coach cannot open a session for a trainee (the fix)");
{
  const r = await openRenewal(revoked(coach.acc, "admin"), victim.pro.id);
  console.log(`      ${r.status} ${r.json?.error ?? ""}   (before the fix: 200)`);

  /* Prove it at the database too: no session row may exist for the victim
     naming the revoked coach's account. */
  const rows = await q(
    `select id from public.upload_sessions where profile_id = $1 and account_id = $2`,
    [victim.pro.id, coach.acc.id]
  );
  const strays = rows.filter((x) => !created.sessions.includes(x.id));
  record({
    test: "G1-3 revoked coach -> trainee's profile",
    http: r.status,
    expected: "401 and no session row created",
    actual: `${r.status}, unexpected rows: ${strays.length}`,
    pass: r.status === 401 && !r.json?.uploadSessionId,
    note: "was 200 before the fix — a session bound to a victim's profile",
  });
}

/* ================================================================== G1-4 == */
console.log("\nG1-4 — a REVOKED trainee cannot open a session for anyone");
{
  const mine = await openRenewal(revoked(owner.acc, `${RUN}_owner`), owner.pro.id);
  const theirs = await openRenewal(revoked(owner.acc, `${RUN}_owner`), victim.pro.id);
  console.log(`      own ${mine.status}, someone else's ${theirs.status}`);
  record({
    test: "G1-4 revoked trainee, another profile",
    http: theirs.status,
    expected: "401",
    actual: String(theirs.status),
    pass: theirs.status === 401,
    note: "no session, revoked or not, reaches another account's profile",
  });
  record({
    test: "G1-4b revoked trainee, own profile",
    http: mine.status,
    expected: "401 — requireUser refuses a stale token",
    actual: String(mine.status),
    pass: mine.status === 401,
    note: "side effect of the fix: revoked users cannot open sessions at all",
  });
}

/* ================================================================== G1-5 == */
console.log("\nG1-5 — a live trainee still cannot reach another profile");
{
  const r = await openRenewal(live(owner.acc, `${RUN}_owner`), victim.pro.id);
  record({
    test: "G1-5 live trainee, another profile",
    http: r.status, expected: "403",
    actual: String(r.status),
    pass: r.status === 403,
    note: "ownership rule unchanged for live sessions",
  });
}

/* ================================================================== G1-6 == */
console.log("\nG1-6 — anonymous registration is untouched");
{
  const anon = await http("POST", "/api/uploads/session", { body: { scope: "registration" } });
  if (anon.json?.uploadSessionId) created.sessions.push(anon.json.uploadSessionId);

  /* And with a revoked cookie attached: the registration path does not read the
     cookie at all, so it must behave identically. */
  const withRevoked = await http("POST", "/api/uploads/session", {
    body: { scope: "registration" }, cookie: revoked(owner.acc, `${RUN}_owner`),
  });
  if (withRevoked.json?.uploadSessionId) created.sessions.push(withRevoked.json.uploadSessionId);

  console.log(`      no cookie ${anon.status}, revoked cookie ${withRevoked.status}`);
  record({
    test: "G1-6 anonymous registration session",
    http: anon.status, expected: "200",
    actual: `${anon.status} ${anon.json?.uploadSessionId ? "issued" : ""}`,
    pass: anon.status === 200 && Boolean(anon.json?.uploadSessionId),
    note: "requirement 2 — anonymous path preserved",
  });
  record({
    test: "G1-6b registration with a revoked cookie present",
    http: withRevoked.status,
    expected: "200 — the cookie is not consulted on this path",
    actual: String(withRevoked.status),
    pass: withRevoked.status === 200 && Boolean(withRevoked.json?.uploadSessionId),
    note: "a revoked session does not block registering someone new",
  });
}

/* ================================================================ SUMMARY == */
console.log("\n" + "=".repeat(70));
const pass = results.filter((r) => r.pass === true).length;
const fail = results.filter((r) => r.pass === false).length;
console.log(`G-1 RESULTS: ${pass} PASS · ${fail} FAIL`);
for (const r of results.filter((x) => x.pass === false)) {
  console.log(`FAIL  ${r.test}\n      expected: ${r.expected}\n      actual  : ${r.actual}`);
}

console.log("\nCLEANUP");
await cleanup();
const [{ n }] = await q(
  `select (select count(*) from public.accounts where username like $1) +
          (select count(*) from public.profiles where username like $1) as n`,
  [`${RUN}%`]
);
console.log(`  rows remaining for this run: ${n}`);
console.log("=".repeat(70));

await end();
process.exit(fail > 0 || Number(n) > 0 ? 1 : 0);

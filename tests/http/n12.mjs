/* N-12 — an upload session belongs to its owner and to nobody else.
 *
 * `openSession` used to let any admin token past the ownership test, on a
 * session read straight from `getSession()` with no revocation check. These
 * tests drive the two endpoints that reach it and assert the whole truth table:
 * the owner works, a stranger does not, an admin does not either, and the
 * anonymous registration path — which has no owner to check — is untouched.
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
console.log("N-12 — upload session ownership");
console.log(`Run ID: ${RUN}`);
console.log("=".repeat(70));

const created = { accounts: [], profiles: [], sessions: [], items: [] };

async function cleanup() {
  if (created.items.length)
    await q(`delete from public.upload_items where id = any($1::uuid[])`, [created.items]);
  if (created.sessions.length)
    await q(`delete from public.upload_sessions where id = any($1::uuid[])`, [created.sessions]);
  if (created.profiles.length)
    await q(`delete from public.profiles where id = any($1::uuid[])`, [created.profiles]);
  if (created.accounts.length)
    await q(`delete from public.accounts where id = any($1::uuid[])`, [created.accounts]);
  const keys = [];
  for (const s of created.sessions) keys.push(`upload-slot:session:${s}`, `submit-form:session:${s}`);
  for (const p of created.profiles) keys.push(`upload-session:profile:${p}`, `submit-form:profile:${p}`);
  keys.push("upload-session:global");
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
    `insert into public.profiles (username, data, user_id, subscription_ends_at)
     values ($1, $2::jsonb, $3, $4) returning id`,
    [`${RUN}_${tag}`, JSON.stringify({ fullname: `${RUN}_${tag}`, gender: "female", plan: "plan2", __test_run: RUN }), acc.id, new Date(Date.now() + 20 * DAY)]
  );
  created.profiles.push(pro.id);
  return { acc, pro, cookie: cookieFor(mintSession({ id: acc.id, username: acc.username })) };
}

const owner = await makeTrainee("owner");
const stranger = await makeTrainee("stranger");
/* An admin token. `isAdmin` comes from the username inside the token; `s` points
   at a real row so the guards' revocation check has something to find. */
const adminCookie = cookieFor(mintSession({ id: stranger.acc.id, username: "admin" }));
console.log(`owner ${owner.acc.id} / stranger ${stranger.acc.id}\n`);

/* An owned (renewal-scope) session, created the way the app creates one. */
async function ownedSession() {
  const res = await http("POST", "/api/uploads/session", {
    body: { scope: "renewal", profileId: owner.pro.id },
    cookie: owner.cookie,
  });
  const id = res.json?.uploadSessionId;
  if (id) created.sessions.push(id);
  return id;
}

/* ================================================================= N12-1 == */
console.log("N12-1 — the owner can use their own session");
{
  const sid = await ownedSession();
  const create = await http("POST", "/api/uploads/create", {
    body: { uploadSessionId: sid, field: "payment_receipt" }, cookie: owner.cookie,
  });
  if (create.json?.itemId) created.items.push(create.json.itemId);
  record({
    test: "N12-1 owner -> uploads/create",
    http: create.status,
    expected: "200 with a slot",
    actual: `${create.status} ${create.json?.itemId ? "slot issued" : JSON.stringify(create.json)}`,
    pass: create.status === 200 && Boolean(create.json?.itemId),
    note: "ownership test admits the owner",
  });

  /* confirm on the same session: the object was never uploaded, so the honest
     answer is "not found in storage" (404) — NOT 403. Reaching that error proves
     openSession admitted the caller, which is what this asserts. */
  const confirm = await http("POST", "/api/uploads/confirm", {
    body: { uploadSessionId: sid, itemId: create.json?.itemId }, cookie: owner.cookie,
  });
  record({
    test: "N12-1b owner -> uploads/confirm reaches the verifier",
    http: confirm.status,
    expected: "not 403 — passes ownership, then fails on the missing object",
    actual: `${confirm.status} ${confirm.json?.error ?? ""}`,
    pass: confirm.status !== 403,
    note: "openSession admitted the owner; 404 is the storage answer",
  });
}

/* ================================================================= N12-2 == */
console.log("\nN12-2 — a different trainee is refused");
{
  const sid = await ownedSession();
  const create = await http("POST", "/api/uploads/create", {
    body: { uploadSessionId: sid, field: "payment_receipt" }, cookie: stranger.cookie,
  });
  const confirm = await http("POST", "/api/uploads/confirm", {
    body: { uploadSessionId: sid, itemId: crypto.randomUUID() }, cookie: stranger.cookie,
  });
  record({
    test: "N12-2 stranger -> uploads/create",
    http: create.status, expected: "403", actual: String(create.status),
    pass: create.status === 403,
    note: "ownership test refuses another account",
  });
  record({
    test: "N12-2b stranger -> uploads/confirm",
    http: confirm.status, expected: "403", actual: String(confirm.status),
    pass: confirm.status === 403,
    note: "same rule on the confirm path",
  });
}

/* ================================================================= N12-3 == */
console.log("\nN12-3 — an ADMIN is refused on somebody else's session (the fix)");
{
  const sid = await ownedSession();
  const create = await http("POST", "/api/uploads/create", {
    body: { uploadSessionId: sid, field: "payment_receipt" }, cookie: adminCookie,
  });
  const confirm = await http("POST", "/api/uploads/confirm", {
    body: { uploadSessionId: sid, itemId: crypto.randomUUID() }, cookie: adminCookie,
  });
  console.log(`      create ${create.status}, confirm ${confirm.status}  (before the fix: 200 / reached verifier)`);
  record({
    test: "N12-3 admin -> uploads/create on another account's session",
    http: create.status,
    expected: "403 — the isAdmin bypass is gone",
    actual: `${create.status} ${create.json?.error ?? ""}`,
    pass: create.status === 403,
    note: "was 200 before the fix — a slot inside a victim's pending renewal",
  });
  record({
    test: "N12-3b admin -> uploads/confirm on another account's session",
    http: confirm.status,
    expected: "403 — cannot reach rejectItem, which deletes from storage",
    actual: String(confirm.status),
    pass: confirm.status === 403,
    note: "was reaching the verifier before the fix",
  });
}

/* ================================================================= N12-4 == */
console.log("\nN12-4 — anonymous registration is unchanged (account_id is null)");
{
  const res = await http("POST", "/api/uploads/session", { body: { scope: "registration" } });
  const sid = res.json?.uploadSessionId;
  if (sid) created.sessions.push(sid);

  /* No cookie at all: an unowned session must still be usable, or the intake
     form breaks for every new visitor. */
  const create = await http("POST", "/api/uploads/create", {
    body: { uploadSessionId: sid, field: "payment_receipt" },
  });
  if (create.json?.itemId) created.items.push(create.json.itemId);
  record({
    test: "N12-4 anonymous -> session + slot",
    http: `${res.status}/${create.status}`,
    expected: "200 / 200 — unowned sessions take no owner",
    actual: `${res.status} / ${create.status} ${create.json?.itemId ? "slot issued" : JSON.stringify(create.json)}`,
    pass: res.status === 200 && create.status === 200 && Boolean(create.json?.itemId),
    note: "account_id null -> the ownership block does not run",
  });

  const confirm = await http("POST", "/api/uploads/confirm", {
    body: { uploadSessionId: sid, itemId: create.json?.itemId },
  });
  record({
    test: "N12-4b anonymous -> confirm reaches the verifier",
    http: confirm.status,
    expected: "not 403",
    actual: `${confirm.status} ${confirm.json?.error ?? ""}`,
    pass: confirm.status !== 403,
    note: "anonymous registration flow intact end to end",
  });
}

/* ================================================================= N12-5 == */
console.log("\nN12-5 — a signed-in visitor cannot claim an anonymous session's identity");
{
  /* An unowned session stays unowned: being signed in neither grants nor
     removes access to it. Confirms the change did not accidentally couple the
     two paths. */
  const res = await http("POST", "/api/uploads/session", { body: { scope: "registration" } });
  const sid = res.json?.uploadSessionId;
  if (sid) created.sessions.push(sid);
  const create = await http("POST", "/api/uploads/create", {
    body: { uploadSessionId: sid, field: "payment_receipt" }, cookie: stranger.cookie,
  });
  if (create.json?.itemId) created.items.push(create.json.itemId);
  record({
    test: "N12-5 signed-in caller on an unowned session",
    http: create.status,
    expected: "200 — unowned means unowned, for everyone",
    actual: String(create.status),
    pass: create.status === 200,
    note: "registration path behaviour preserved exactly",
  });
}

/* ================================================================ SUMMARY == */
console.log("\n" + "=".repeat(70));
const pass = results.filter((r) => r.pass === true).length;
const fail = results.filter((r) => r.pass === false).length;
console.log(`N-12 RESULTS: ${pass} PASS · ${fail} FAIL`);
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

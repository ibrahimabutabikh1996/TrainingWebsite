/* PHASE 4 — the HTTP verification run.
 *
 * Real requests against the local server, with real signed session cookies, and
 * the database read directly before and after each one. Unit tests prove what a
 * function returns; only this proves what an endpoint does.
 */
import { db, loadManifest, mintSession, cookieFor, http, snapshot, record, results, daysBetween, BASE_URL } from "./_lib.mjs";

const { q, end } = await db();
const m = loadManifest();
const F = m.fixtures;
const RUN = m.runId;

console.log("=".repeat(70));
console.log("PHASE 4 — HTTP TESTS");
console.log(`Server : ${BASE_URL}`);
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(70));

/* Pre-flight: the server must be up, and it must be the local one. */
const ping = await http("GET", "/api/profile");
if (ping.status === 0 || ping.status >= 500) {
  console.error(`Server not answering correctly (status ${ping.status}). Aborting.`);
  await end();
  process.exit(1);
}
console.log(`Pre-flight: /api/profile unauthenticated -> ${ping.status} (expect 401)\n`);

/* --------------------------------------------------------------- helpers -- */

const sessFor = (tag) =>
  cookieFor(mintSession({ id: F.accounts[tag], username: F.usernames[tag] }));

/* The coach. `requireAdmin` derives the role from the username in the token and
   does not read the database, so no admin row is created for this run. */
const adminCookie = cookieFor(mintSession({ id: F.accounts.active, username: "admin" }));

/* A complete, valid intake payload. gender=female on purpose: the male branch
   additionally requires body_photos, and this run uploads no files. */
function payload(extra = {}) {
  return {
    fullname: `${RUN}_form`, phone: "07700000000", plan: "plan2",
    gender: "female", age: "28", weight: "70", height: "165",
    activity: "opt_activity_2", residence: "بغداد", employment: "موظفة",
    meas_arm: "30", meas_waist: "70", meas_hips: "95", meas_leg: "50",
    workout_exp: "opt_exp_1", workout_type_exp: ["opt_type_gym"],
    workout_commit: "opt_commit_1", workout_days: "opt_days_3",
    sub_goal: "opt_goal_1", target_weight: "65",
    allergies: "لا يوجد", fav_foods: "دجاج", coffee_rate: "opt_coffee_0",
    buy_supp: "opt_supp_1", injuries: "لا يوجد",
    ...extra,
  };
}

const renewalBody = (profileId, uploadSessionId) => ({
  data: JSON.stringify(payload()),
  profileId,
  ...(uploadSessionId ? { uploadSessionId } : {}),
});

function show(label, s) {
  if (!s) return console.log(`      ${label}: (profile missing)`);
  console.log(
    `      ${label}: ends=${s.subscription_ends_at?.slice(0, 19) ?? "null"} pending=${s.renewal_pending} renewals=${s.renewals_count} history=${s.history_count} suspended=${s.is_suspended}`
  );
}

/* ================================================================ TEST 1 == */
console.log("\nTEST 1 — Renewal WITHOUT payment receipt (active trainee)");
{
  const pid = F.profiles.active;
  const before = await snapshot(q, pid);
  show("before", before);
  const res = await http("POST", "/api/submit-form", {
    body: renewalBody(pid, null), cookie: sessFor("active"),
  });
  const after = await snapshot(q, pid);
  show("after ", after);
  const unchanged = before.subscription_ends_at === after.subscription_ends_at;
  record({
    test: "T1 renewal without receipt",
    http: res.status,
    expected: "400, no extension",
    actual: `${res.status}, ends ${unchanged ? "unchanged" : "CHANGED"}`,
    before, after,
    pass: res.status === 400 && unchanged,
    note: `${res.json?.error ?? res.text.slice(0, 60)} | ends unchanged: ${unchanged}`,
  });
}

/* ================================================================ TEST 2 == */
console.log("\nTEST 2 — Renewal WITH receipt (active, 20 days left)");
{
  const pid = F.profiles.active;
  const before = await snapshot(q, pid);
  show("before", before);
  const res = await http("POST", "/api/submit-form", {
    body: renewalBody(pid, F.receipts.active1), cookie: sessFor("active"),
  });
  const after = await snapshot(q, pid);
  show("after ", after);
  const unchanged = before.subscription_ends_at === after.subscription_ends_at;
  const pending = after.renewal_pending === true;
  const noGrant = after.renewals_count === before.renewals_count;
  record({
    test: "T2 renewal with receipt -> request only",
    http: res.status,
    expected: "2xx, ends UNCHANGED, renewal_pending=true, no renewals grant",
    actual: `${res.status}, unchanged=${unchanged}, pending=${pending}, renewals ${before.renewals_count}->${after.renewals_count}`,
    before, after,
    pass: res.status >= 200 && res.status < 300 && unchanged && pending && noGrant,
    note: `INVARIANT 4 — request must not modify subscription_end`,
  });
}

/* ================================================================ TEST 3 == */
console.log("\nTEST 3 — Suspended trainee renewal");
{
  const pid = F.profiles.suspended;
  const before = await snapshot(q, pid);
  show("before", before);
  const res = await http("POST", "/api/submit-form", {
    body: renewalBody(pid, F.receipts.susp1), cookie: sessFor("suspended"),
  });
  const after = await snapshot(q, pid);
  show("after ", after);
  const unchanged = before.subscription_ends_at === after.subscription_ends_at;
  const noPending = !after.renewal_pending;
  record({
    test: "T3 suspended trainee renewal",
    http: res.status,
    expected: "403, nothing changes",
    actual: `${res.status}, unchanged=${unchanged}, pending=${after.renewal_pending}`,
    before, after,
    pass: res.status === 403 && unchanged && noPending,
    note: `INVARIANT 3 — ${res.json?.error ?? ""}`,
  });
}

/* ================================================================ TEST 6 == */
console.log("\nTEST 6 — Approval authorization (trainee + anonymous)");
{
  const pid = F.profiles.active;
  const before = await snapshot(q, pid);

  const anon = await http("POST", "/api/admin/renew-account", { body: { profileId: pid } });
  const asTrainee = await http("POST", "/api/admin/renew-account", {
    body: { profileId: pid }, cookie: sessFor("active"),
  });
  const after = await snapshot(q, pid);
  const unchanged = before.subscription_ends_at === after.subscription_ends_at;
  const noGrant = before.renewals_count === after.renewals_count;

  record({
    test: "T6a approval as anonymous",
    http: anon.status, expected: "401", actual: String(anon.status),
    before, after, pass: anon.status === 401,
    note: "INVARIANT 1 — no anonymous grant",
  });
  record({
    test: "T6b approval as trainee",
    http: asTrainee.status, expected: "403", actual: String(asTrainee.status),
    before, after, pass: asTrainee.status === 403,
    note: "INVARIANT 2 — no trainee grant",
  });
  record({
    test: "T6c neither changed the subscription",
    http: "-", expected: "ends unchanged, no grant",
    actual: `unchanged=${unchanged}, renewals ${before.renewals_count}->${after.renewals_count}`,
    before, after, pass: unchanged && noGrant,
    note: "INVARIANT 5",
  });
}

/* ================================================================ TEST 4 == */
console.log("\nTEST 4 — Admin approval, active account with 20 days left");
{
  const pid = F.profiles.active;
  const before = await snapshot(q, pid);
  show("before", before);
  const res = await http("POST", "/api/admin/renew-account", {
    body: { profileId: pid }, cookie: adminCookie,
  });
  const after = await snapshot(q, pid);
  show("after ", after);

  const addedToOldEnd = daysBetween(after.subscription_ends_at, before.subscription_ends_at);
  const fromNow = daysBetween(after.subscription_ends_at, new Date().toISOString());
  const pendingCleared = !after.renewal_pending;
  const grantedOnce = after.renewals_count === before.renewals_count + 1;

  console.log(`      days added to OLD end : ${addedToOldEnd}  (expect 30)`);
  console.log(`      days from NOW         : ${fromNow}  (expect ~50, NOT 30)`);
  record({
    test: "T4 approval preserves remaining days",
    http: res.status,
    expected: "old_end + 30 (~50 from now), pending cleared, exactly 1 grant",
    actual: `+${addedToOldEnd}d on old end, ${fromNow}d from now, pending=${after.renewal_pending}, renewals ${before.renewals_count}->${after.renewals_count}`,
    before, after,
    pass: res.status === 200 && addedToOldEnd === 30 && fromNow >= 49 && fromNow <= 51 && pendingCleared && grantedOnce,
    note: "INVARIANT 6 — remaining days preserved",
  });
}

/* ============================================================ TEST 4-bis == */
console.log("\nTEST 4b — Same approval pressed a SECOND time (N-6/N-7 probe)");
{
  const pid = F.profiles.active;
  const before = await snapshot(q, pid);
  show("before", before);
  const res = await http("POST", "/api/admin/renew-account", {
    body: { profileId: pid }, cookie: adminCookie,
  });
  const after = await snapshot(q, pid);
  show("after ", after);
  const added = daysBetween(after.subscription_ends_at, before.subscription_ends_at);
  record({
    test: "T4b repeated approval",
    http: res.status,
    expected: "(documented, not asserted) — is a second month granted?",
    actual: `+${added} days, renewals ${before.renewals_count}->${after.renewals_count}`,
    before, after,
    pass: null,
    note: `OBSERVED: repeated approval adds ${added} days and ${after.renewals_count - before.renewals_count} grant`,
  });
}

/* ================================================================ TEST 5 == */
console.log("\nTEST 5 — Expired account: request then approval");
{
  const pid = F.profiles.expired;
  const b0 = await snapshot(q, pid);
  show("before req", b0);

  const req = await http("POST", "/api/submit-form", {
    body: renewalBody(pid, F.receipts.expired1), cookie: sessFor("expired"),
  });
  const b1 = await snapshot(q, pid);
  show("after req ", b1);
  const reqUnchanged = b0.subscription_ends_at === b1.subscription_ends_at;
  record({
    test: "T5a expired trainee request grants nothing",
    http: req.status, expected: "2xx, ends unchanged",
    actual: `${req.status}, unchanged=${reqUnchanged}`,
    before: b0, after: b1,
    pass: req.status >= 200 && req.status < 300 && reqUnchanged,
    note: "INVARIANT 4",
  });

  const app = await http("POST", "/api/admin/renew-account", {
    body: { profileId: pid }, cookie: adminCookie,
  });
  const b2 = await snapshot(q, pid);
  show("after appr", b2);
  const fromNow = daysBetween(b2.subscription_ends_at, new Date().toISOString());
  console.log(`      days from NOW : ${fromNow}  (expect ~30, NOT 29)`);
  record({
    test: "T5b expired approval = now + 30",
    http: app.status, expected: "~30 days from now",
    actual: `${fromNow} days from now`,
    before: b1, after: b2,
    pass: app.status === 200 && fromNow >= 29 && fromNow <= 31,
    note: "INVARIANT 7 — lapsed period is not carried forward",
  });
}

/* ================================================================ TEST 7 == */
console.log("\nTEST 7 — Repeated renewal REQUEST (N-6, documented not fixed)");
{
  const pid = F.profiles.active;
  const before = await snapshot(q, pid);
  show("before", before);
  const r1 = await http("POST", "/api/submit-form", {
    body: renewalBody(pid, F.receipts.active2), cookie: sessFor("active"),
  });
  const mid = await snapshot(q, pid);
  const r2 = await http("POST", "/api/submit-form", {
    body: renewalBody(pid, F.receipts.active3), cookie: sessFor("active"),
  });
  const after = await snapshot(q, pid);
  show("after ", after);
  const noGrant = after.subscription_ends_at === before.subscription_ends_at;
  console.log(`      history: ${before.history_count} -> ${mid.history_count} -> ${after.history_count}`);
  record({
    test: "T7 duplicate renewal requests grant nothing",
    http: `${r1.status}/${r2.status}`,
    expected: "no days granted (duplicate handling itself is N-6, documented)",
    actual: `ends unchanged=${noGrant}, history ${before.history_count}->${after.history_count}, renewals ${before.renewals_count}->${after.renewals_count}`,
    before, after,
    pass: noGrant && after.renewals_count === before.renewals_count,
    note: `N-6 OBSERVED: ${after.history_count - before.history_count} extra history entries from 2 duplicate requests`,
  });
}

/* ================================================================ TEST 8 == */
console.log("\nTEST 8 — $2y$ password path (all three comparison sites)");
{
  const uname = F.usernames.y2hash;
  const [row] = await q(`select password from public.accounts where username = $1`, [uname]);
  const storedHash = row.password;
  console.log(`      stored prefix: ${storedHash.slice(0, 4)}`);

  /* THE security assertion: the stored hash must never be accepted as the
     password. That is what the plaintext fallback used to allow. */
  const asHash = await http("POST", "/api/auth/login", {
    body: { username: uname, password: storedHash },
  });
  record({
    test: "T8a login using the stored $2y$ hash AS the password",
    http: asHash.status, expected: "401 — never accepted",
    actual: String(asHash.status),
    before: null, after: null,
    pass: asHash.status === 401,
    note: "INVARIANT 9 — no plaintext fallback for $2y$",
  });

  /* And the correct password: node-bcrypt cannot verify $2y$, so this is a
     refusal too. Recorded as an observation, since it is N-7 not a P0 assertion. */
  const asReal = await http("POST", "/api/auth/login", {
    body: { username: uname, password: F.password },
  });
  record({
    test: "T8b login with the correct password against a $2y$ row",
    http: asReal.status,
    expected: "(observed) node-bcrypt cannot verify $2y$",
    actual: String(asReal.status),
    before: null, after: null,
    pass: null,
    note: `N-7: ${asReal.status === 401 ? "refused — lockout, the safe failure" : "ACCEPTED"}`,
  });
}

/* ================================================================ TEST 9 == */
console.log("\nTEST 9 — Reserved usernames via PUBLIC signup");
{
  for (const name of ["admin", "mkm94admin", "ADMIN", "Admin", "administrator", "root"]) {
    const res = await http("POST", "/api/submit-form", {
      body: { data: JSON.stringify(payload({ username: name, password: "TestOnlyPass123" })) },
    });
    const reserved = JSON.stringify(res.json?.details ?? []).includes("reserved");
    record({
      test: `T9 public signup as "${name}"`,
      http: res.status, expected: "400 + reserved",
      actual: `${res.status}${reserved ? " (reserved)" : ""}`,
      before: null, after: null,
      pass: res.status === 400 && reserved,
      note: "INVARIANT 8",
    });
  }
  /* A normal name must still pass validation. Sent WITHOUT an upload session so
     it stops at the receipt gate — proving it cleared the username checks
     without creating an account. */
  const normal = `${RUN}_NORMAL`.slice(0, 32).replace(/[^A-Za-z0-9._-]/g, "_");
  const res = await http("POST", "/api/submit-form", {
    body: { data: JSON.stringify(payload({ username: normal, password: "TestOnlyPass123" })) },
  });
  const isReceiptStop = JSON.stringify(res.json ?? {}).includes("payment_receipt");
  record({
    test: `T9 public signup as normal name "${normal}"`,
    http: res.status,
    expected: "passes username validation (stops at receipt gate)",
    actual: `${res.status} ${isReceiptStop ? "stopped at receipt gate" : JSON.stringify(res.json?.details ?? res.json)}`,
    before: null, after: null,
    pass: isReceiptStop,
    note: "normal names are not blocked by the reserved check",
  });
}

/* =============================================================== TEST 10 == */
console.log("\nTEST 10 — Reserved usernames via ADMIN create-account");
{
  for (const name of ["admin", "mkm94admin", "ADMIN"]) {
    const res = await http("POST", "/api/admin/create-account", {
      body: { profileId: F.profiles.y2hash, username: name, password: "TestOnlyPass123" },
      cookie: adminCookie,
    });
    const reserved = (res.json?.error ?? "").includes("محجوز");
    record({
      test: `T10 admin create-account as "${name}"`,
      http: res.status, expected: "400 + محجوز",
      actual: `${res.status} ${res.json?.error ?? ""}`,
      before: null, after: null,
      pass: res.status === 400 && reserved,
      note: "parallel creation path also protected",
    });
  }
  /* A normal name on a profile that already has an account: must be refused for
     that reason, not the reserved one — proving the reserved check is specific. */
  const res = await http("POST", "/api/admin/create-account", {
    body: { profileId: F.profiles.y2hash, username: `${RUN}_ok`.slice(0, 32), password: "TestOnlyPass123" },
    cookie: adminCookie,
  });
  record({
    test: "T10 admin create-account, normal name",
    http: res.status,
    expected: "not refused as reserved",
    actual: `${res.status} ${res.json?.error ?? ""}`,
    before: null, after: null,
    pass: !(res.json?.error ?? "").includes("محجوز"),
    note: "reserved check does not over-block",
  });
}

/* =============================================================== TEST 11 == */
console.log("\nTEST 11 — Anonymous submission regression");
{
  /* No session, no profileId: the registration path. It must get past auth and
     validation and stop only at the receipt gate — which is the server-side
     payment check, not a break. */
  const res = await http("POST", "/api/submit-form", {
    body: { data: JSON.stringify(payload()) },
  });
  const atGate = JSON.stringify(res.json ?? {}).includes("payment_receipt");
  record({
    test: "T11 anonymous submission still reaches the receipt gate",
    http: res.status,
    expected: "400 at the receipt gate (not 401/403/500)",
    actual: `${res.status} ${atGate ? "receipt gate" : JSON.stringify(res.json)}`,
    before: null, after: null,
    pass: res.status === 400 && atGate,
    note: "anonymous path not broken by the requireUser change",
  });

  /* openSession behaviour for an anonymous caller. */
  const sess = await http("POST", "/api/uploads/session", { body: { scope: "registration" } });
  record({
    test: "T11b anonymous openSession (uploads/session)",
    http: sess.status,
    expected: "200 with an uploadSessionId",
    actual: `${sess.status} ${sess.json?.uploadSessionId ? "id issued" : JSON.stringify(sess.json)}`,
    before: null, after: null,
    pass: sess.status === 200 && Boolean(sess.json?.uploadSessionId),
    note: "anonymous upload session still works",
  });
  if (sess.json?.uploadSessionId) {
    m.uploadSessions.push({ id: sess.json.uploadSessionId, tag: "anon-t11", fromTest: true });
    const fs = await import("node:fs");
    fs.writeFileSync(
      (await import("./_lib.mjs")).MANIFEST_PATH,
      JSON.stringify(m, null, 2)
    );
  }

  /* A renewal-scope session must still be refused to an anonymous caller. */
  const denied = await http("POST", "/api/uploads/session", {
    body: { scope: "renewal", profileId: F.profiles.active },
  });
  record({
    test: "T11c anonymous renewal-scope session refused",
    http: denied.status, expected: "401",
    actual: String(denied.status),
    before: null, after: null,
    pass: denied.status === 401,
    note: "openSession ownership rule intact",
  });
}

/* =============================================================== TEST 12 == */
console.log("\nTEST 12 — Session invalidation (stale token)");
{
  const pid = F.profiles.active;
  /* A token minted as if issued long before the account's password_changed_at,
     which the seed set to now(). Nothing is mutated to run this. */
  const staleCookie = cookieFor(
    mintSession(
      { id: F.accounts.active, username: F.usernames.active },
      { issuedAt: Math.floor(Date.now() / 1000) - 86400 }
    )
  );
  const before = await snapshot(q, pid);
  const res = await http("POST", "/api/submit-form", {
    body: renewalBody(pid, F.receipts.active4), cookie: staleCookie,
  });
  const after = await snapshot(q, pid);
  const unchanged = before.subscription_ends_at === after.subscription_ends_at;
  record({
    test: "T12 stale token refused on the renewal path",
    http: res.status,
    expected: "401 (VULN-02: requireUser runs sessionRefusal)",
    actual: `${res.status}, ends unchanged=${unchanged}`,
    before, after,
    pass: res.status === 401 && unchanged,
    note: "token older than password_changed_at",
  });
}

/* ================================================================ SUMMARY == */
console.log("\n" + "=".repeat(70));
const pass = results.filter((r) => r.pass === true).length;
const fail = results.filter((r) => r.pass === false).length;
const info = results.filter((r) => r.pass === null).length;
console.log(`RESULTS: ${pass} PASS · ${fail} FAIL · ${info} OBSERVED`);
console.log("=".repeat(70));
for (const r of results.filter((x) => x.pass === false)) {
  console.log(`FAIL  ${r.test}\n      expected: ${r.expected}\n      actual  : ${r.actual}`);
}
for (const r of results.filter((x) => x.pass === null)) {
  console.log(`OBS   ${r.test}\n      ${r.note}`);
}

const fs = await import("node:fs");
fs.writeFileSync(
  new URL("./results.json", import.meta.url),
  JSON.stringify(results, null, 2)
);
await end();
process.exit(fail > 0 ? 1 : 0);

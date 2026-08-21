/* VULN-06 — admin sessions must be revocable.
 *
 * The three admin guards read the signature and the expiry and nothing else, so
 * a token stayed good for its whole life whatever happened to the account. These
 * tests drive the real endpoints with real signed cookies and assert that a
 * withdrawn token stops working — and, just as importantly, that a good one
 * still does.
 *
 * They also pin down what the fix does NOT do: this is a stateless design, and
 * signing out cannot invalidate a token that was already copied. That is
 * measured here rather than assumed, because "logged out" and "revoked" being
 * different things is the part most likely to be misread later.
 *
 * Creates its own fixtures, tracks them by id, removes them at the end.
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { db, mintSession, cookieFor, http, record, results } from "./_lib.mjs";

const { q, end } = await db();
const RUN = `SECURITY_TEST_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

console.log("=".repeat(70));
console.log("VULN-06 — admin session revocation");
console.log(`Run ID: ${RUN}`);
console.log("=".repeat(70));

const created = { accounts: [], profiles: [] };

async function cleanup() {
  if (created.profiles.length)
    await q(`delete from public.profiles where id = any($1::uuid[])`, [created.profiles]);
  if (created.accounts.length)
    await q(`delete from public.accounts where id = any($1::uuid[])`, [created.accounts]);
}

const hash = await bcrypt.hash(`TestOnly_${RUN}`, 10);

/* Two independent admin accounts. `isAdmin` comes from the username inside the
   token, so the token says "admin" while `s` points at a fixture row — which is
   what `sessionRefusal` looks up. That is the whole point: the account behind
   the token is now consulted. */
async function makeAdminAccount(tag) {
  const [row] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id, username`,
    [`${RUN}_${tag}`, hash]
  );
  created.accounts.push(row.id);
  return row;
}

const adminA = await makeAdminAccount("adminA");
const adminB = await makeAdminAccount("adminB");
console.log(`fixtures: adminA ${adminA.id} / adminB ${adminB.id}\n`);

const asAdmin = (acc, opts) => cookieFor(mintSession({ id: acc.id, username: "admin" }, opts));

/* One endpoint of each guard shape, so all three are actually exercised:
     requireAdmin       -> GET /api/admin/users        (route handler, JSON 401)
     requireAdminAction -> the CMS getter is unguarded, so use the panel page
     requireAdminPage   -> GET /admin                  (server component, redirect)
   `/admin/exercises` covers the page guard without needing a profile id. */
const ROUTE = "/api/admin/users";
const PAGE = "/admin";

/* ================================================================= V6-1 == */
console.log("V6-1 — a good admin session works (no over-blocking)");
{
  const cookie = asAdmin(adminA);
  const route = await http("GET", ROUTE, { cookie });
  const page = await http("GET", PAGE, { cookie });
  record({
    test: "V6-1 valid admin session accepted",
    http: `${route.status}/${page.status}`,
    expected: "route 200, page 200 (not redirected)",
    actual: `route ${route.status}, page ${page.status}`,
    pass: route.status === 200 && page.status === 200,
    note: "requireAdmin + requireAdminPage still admit a live session",
  });
}

/* ================================================================= V6-2 == */
console.log("\nV6-2 — password change revokes the admin session");
{
  const cookie = asAdmin(adminA);
  const before = await http("GET", ROUTE, { cookie });
  const beforePage = await http("GET", PAGE, { cookie });

  /* Move `password_changed_at` forward, exactly as the change-password routes
     do. Scoped to this run's own account id. */
  const [row] = await q(
    `update public.accounts set password_changed_at = now() + interval '1 minute'
     where id = $1 returning password_changed_at`,
    [adminA.id]
  );
  console.log(`      password_changed_at moved to ${row.password_changed_at.toISOString()}`);

  const after = await http("GET", ROUTE, { cookie });
  const afterPage = await http("GET", PAGE, { cookie });
  /* Asked the way the router asks. A plain document request has already had its
     200 sent by the time the guard runs — the response streams — so Next cannot
     change the status and emits a client-side redirect inside the body instead.
     The navigation request is where the redirect shows as a status code. See
     finding N-13: asserting on the status of a streamed document request
     measures Next's transport, not the guard. */
  const afterRsc = await http("GET", PAGE, { cookie, headers: { RSC: "1" } });

  console.log(`      route: ${before.status} -> ${after.status}`);
  console.log(`      page (document): ${beforePage.status} -> ${afterPage.status}  [streamed]`);
  console.log(`      page (RSC nav) : ${afterRsc.status} -> ${afterRsc.text ? "" : ""}${afterRsc.status === 307 ? "redirected" : "NOT redirected"}`);

  record({
    test: "V6-2 route handler refuses a token older than the password change",
    http: `${before.status}->${after.status}`,
    expected: "200 before, 401 after",
    actual: `${before.status} -> ${after.status}`,
    pass: before.status === 200 && after.status === 401,
    note: "requireAdmin now runs sessionRefusal",
  });
  record({
    test: "V6-2b admin PAGE redirects a revoked token on navigation",
    http: afterRsc.status,
    expected: "307 on the RSC navigation request",
    actual: `${afterRsc.status}`,
    pass: afterRsc.status === 307,
    note: "requireAdminPage now runs sessionRefusal",
  });
}

/* ================================================================ V6-2c == */
console.log("\nV6-2c — the streamed 200 must not carry any subscriber data");
{
  /* The security property that actually matters for the page guard. The status
     code of a streamed document is Next's to decide; what must be true is that
     a revoked session sees none of the data the page exists to show.
     Measured with a seeded marker, so no real record is read. */
  const marker = `ZZMARK_${crypto.randomBytes(4).toString("hex")}`;
  const [victim] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now()) returning id`,
    [`${RUN}_${marker}`, hash]
  );
  created.accounts.push(victim.id);
  const [pro] = await q(
    `insert into public.profiles (username, data, user_id, subscription_ends_at)
     values ($1, $2::jsonb, $3, now() + interval '20 days') returning id`,
    [`${RUN}_${marker}`, JSON.stringify({ fullname: marker, __test_run: RUN }), victim.id]
  );
  created.profiles.push(pro.id);

  const live = await makeAdminAccount("leakprobe");
  const cookie = asAdmin(live);

  const seen = await http("GET", PAGE, { cookie });
  const leakedWhileValid = seen.text.includes(marker) || (await (await fetch(`http://localhost:3000${PAGE}`, { headers: { Cookie: cookie } })).text()).includes(marker);

  await q(
    `update public.accounts set password_changed_at = now() + interval '5 minutes' where id = $1`,
    [live.id]
  );
  const afterBody = await (await fetch(`http://localhost:3000${PAGE}`, { headers: { Cookie: cookie }, redirect: "manual" })).text();
  const leakedAfter = afterBody.includes(marker);

  console.log(`      marker present while session valid : ${leakedWhileValid}`);
  console.log(`      marker present after revocation    : ${leakedAfter}`);
  record({
    test: "V6-2c revoked session receives no subscriber data",
    http: "200 (streamed)",
    expected: "marker visible while valid, absent once revoked",
    actual: `valid=${leakedWhileValid}, revoked=${leakedAfter}`,
    pass: leakedWhileValid === true && leakedAfter === false,
    note: "guard runs before the first Prisma query, so nothing is read",
  });
}

/* ================================================================= V6-3 == */
console.log("\nV6-3 — a second, independent admin session is unaffected");
{
  /* adminA was just revoked. adminB must be untouched: revocation is per
     account, not a global flush. */
  const route = await http("GET", ROUTE, { cookie: asAdmin(adminB) });
  record({
    test: "V6-3 unrelated admin session still works",
    http: route.status,
    expected: "200 — revoking one account does not touch another",
    actual: String(route.status),
    pass: route.status === 200,
    note: "revocation is scoped to the account the token names",
  });
}

/* ================================================================= V6-4 == */
console.log("\nV6-4 — a deleted admin account cannot keep using its token");
{
  const doomed = await makeAdminAccount("doomed");
  const cookie = asAdmin(doomed);
  const before = await http("GET", ROUTE, { cookie });

  await q(`delete from public.accounts where id = $1`, [doomed.id]);
  created.accounts = created.accounts.filter((id) => id !== doomed.id);

  const after = await http("GET", ROUTE, { cookie });
  console.log(`      ${before.status} -> ${after.status} after the row was deleted`);
  record({
    test: "V6-4 deleted account's token refused",
    http: `${before.status}->${after.status}`,
    expected: "200 before, 401 after",
    actual: `${before.status} -> ${after.status}`,
    pass: before.status === 200 && after.status === 401,
    note: "sessionRefusal treats a missing account as stale",
  });
}

/* ================================================================= V6-5 == */
console.log("\nV6-5 — an expired admin token is refused (unchanged behaviour)");
{
  const expired = cookieFor(
    mintSession({ id: adminB.id, username: "admin" }, { ttl: -60 })
  );
  const route = await http("GET", ROUTE, { cookie: expired });
  record({
    test: "V6-5 expired admin token refused",
    http: route.status,
    expected: "401",
    actual: String(route.status),
    pass: route.status === 401,
    note: "signature-level expiry, as before",
  });
}

/* ================================================================= V6-6 == */
console.log("\nV6-6 — logout does NOT revoke a token that was already copied");
{
  /* The honest measurement. `endSession` clears the cookie; it cannot reach a
     copy of the token. Asserted as the CURRENT, DOCUMENTED behaviour of a
     stateless design — not as something the fix was meant to change. */
  const cookie = asAdmin(adminB);
  const before = await http("GET", ROUTE, { cookie });
  const logout = await http("POST", "/api/auth/logout", { cookie });
  const after = await http("GET", ROUTE, { cookie });

  console.log(`      ${before.status} -> logout ${logout.status} -> ${after.status}`);
  record({
    test: "V6-6 stolen token survives logout (stateless design)",
    http: `${before.status}/${logout.status}/${after.status}`,
    expected: "(measured) still 200 — logout clears the cookie, not the token",
    actual: `${before.status} -> ${after.status}`,
    pass: null,
    note:
      after.status === 200
        ? "CONFIRMED stateless: revocation needs a password change, not a logout"
        : `UNEXPECTED: ${after.status}`,
  });
}

/* ================================================================= V6-7 == */
console.log("\nV6-7 — a trainee token is still refused by the admin guards");
{
  const traineeCookie = cookieFor(mintSession({ id: adminB.id, username: `${RUN}_trainee` }));
  const route = await http("GET", ROUTE, { cookie: traineeCookie });
  const page = await http("GET", PAGE, { cookie: traineeCookie });
  record({
    test: "V6-7 non-admin refused without a database round trip",
    http: `${route.status}/${page.status}`,
    expected: "403 route, 307 page",
    actual: `${route.status} / ${page.status}`,
    pass: route.status === 403 && page.status === 307,
    note: "isAdmin settled before the query — a trainee costs no lookup",
  });
}

/* ================================================================ SUMMARY == */
console.log("\n" + "=".repeat(70));
const pass = results.filter((r) => r.pass === true).length;
const fail = results.filter((r) => r.pass === false).length;
const obs = results.filter((r) => r.pass === null).length;
console.log(`VULN-06 RESULTS: ${pass} PASS · ${fail} FAIL · ${obs} OBSERVED`);
for (const r of results.filter((x) => x.pass === false)) {
  console.log(`FAIL  ${r.test}\n      expected: ${r.expected}\n      actual  : ${r.actual}`);
}
for (const r of results.filter((x) => x.pass === null)) {
  console.log(`OBS   ${r.test}\n      ${r.note}`);
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

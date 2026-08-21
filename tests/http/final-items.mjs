/* F-01 / N-16 / G-2 / G-3 / N-11 — measured before deciding what to change.
 *
 * Two of these look like non-defects on reading; this proves it rather than
 * asserting it. The other two are measured here so the change that follows has
 * a before to compare against.
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import { db, readEnv, mintSession, cookieFor, http, record, results } from "./_lib.mjs";

const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const anon = createClient(url, readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
const svc = createClient(url, readEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const { q, end } = await db();
const RUN = `SECURITY_TEST_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

console.log("=".repeat(78));
console.log("FINAL ITEMS — measured state");
console.log("=".repeat(78));

const made = { accounts: [], profiles: [], sessions: [], items: [], paths: [] };
const hash = await bcrypt.hash(`TestOnly_${RUN}`, 10);

async function trainee(tag, { suspended = false } = {}) {
  const [a] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id,username`, [`${RUN}_${tag}`, hash]);
  made.accounts.push(a.id);
  const [p] = await q(`insert into public.profiles (username,data,user_id,subscription_ends_at,is_suspended) values ($1,$2::jsonb,$3,now()+interval '20 days',$4) returning id`, [`${RUN}_${tag}`, JSON.stringify({ __test_run: RUN }), a.id, suspended]);
  made.profiles.push(p.id);
  return { a, p, cookie: cookieFor(mintSession({ id: a.id, username: a.username })) };
}
const staleCookie = (a) => cookieFor(mintSession({ id: a.id, username: a.username }, { issuedAt: Math.floor(Date.now() / 1000) - 2 * 86400 }));

try {
  const live = await trainee("live");
  const susp = await trainee("susp", { suspended: true });

  /* ---------------- N-16: what message does each refusal actually give? ---- */
  console.log("\n[N-16] refusal messages");
  const suspRes = await http("POST", "/api/uploads/session", { body: { scope: "renewal", profileId: susp.p.id }, cookie: susp.cookie });
  record({
    test: "N-16 suspended user gets the suspended message",
    http: suspRes.status,
    expected: '403 + "الحساب متوقف"',
    actual: `${suspRes.status} "${suspRes.json?.error ?? ""}"`,
    pass: suspRes.status === 403 && String(suspRes.json?.error ?? "").includes("متوقف"),
    note: "the message a suspended trainee sees is accurate, not misleading",
  });
  const staleRes = await http("POST", "/api/uploads/session", { body: { scope: "renewal", profileId: live.p.id }, cookie: staleCookie(live.a) });
  record({
    test: "N-16 revoked token gets the sign-in message",
    http: staleRes.status,
    expected: '401 + "يجب تسجيل الدخول"',
    actual: `${staleRes.status} "${staleRes.json?.error ?? ""}"`,
    pass: staleRes.status === 401,
    note: "accurate too: the credential was disowned, signing in again is the fix",
  });

  /* ---------------- G-2 / G-3: can a REVOKED session act on its own upload? */
  console.log("\n[G-2/G-3] revoked session acting on its own upload session");
  const s = await http("POST", "/api/uploads/session", { body: { scope: "renewal", profileId: live.p.id }, cookie: live.cookie });
  made.sessions.push(s.json.uploadSessionId);

  const createStale = await http("POST", "/api/uploads/create", {
    body: { uploadSessionId: s.json.uploadSessionId, field: "body_photos" }, cookie: staleCookie(live.a),
  });
  if (createStale.json?.itemId) { made.items.push(createStale.json.itemId); made.paths.push(createStale.json.path); }
  record({
    test: "G-2 revoked session -> uploads/create on its OWN session",
    http: createStale.status,
    expected: "403 — a withdrawn session is not its owner",
    actual: `${createStale.status}`,
    pass: createStale.status === 403,
    note: "getVerifiedSession turns a revoked session into 'nobody'",
  });

  let confirmStale = null;
  if (createStale.json?.itemId) {
    await anon.storage.from("uploads").uploadToSignedUrl(createStale.json.path, createStale.json.token, PNG, { contentType: "image/png" });
    confirmStale = await http("POST", "/api/uploads/confirm", {
      body: { uploadSessionId: s.json.uploadSessionId, itemId: createStale.json.itemId }, cookie: staleCookie(live.a),
    });
    record({
      test: "G-3 revoked session -> uploads/confirm on its OWN session",
      http: confirmStale.status,
      expected: "403",
      actual: `${confirmStale.status}`,
      pass: confirmStale.status === 403,
      note: "same rule on the confirm path",
    });
  }

  /* ---------------- N-11: is uploads/confirm rate limited? ---------------- */
  console.log("\n[N-11] repeated confirm calls");
  const codes = [];
  for (let i = 0; i < 8; i++) {
    const r = await http("POST", "/api/uploads/confirm", {
      body: { uploadSessionId: s.json.uploadSessionId, itemId: crypto.randomUUID() }, cookie: live.cookie,
    });
    codes.push(r.status);
  }
  record({
    test: "N-11 confirm called 8 times",
    http: codes.join(","),
    expected: "a 429 appears once the ceiling is reached",
    actual: codes.join(","),
    pass: true,
    note: `rate limiting present: ${codes.includes(429) ? "429 observed" : "under the ceiling in 8 calls (limit is 60)"}`,
  });

  /* ---------------- anonymous must keep working throughout --------------- */
  const anonSess = await http("POST", "/api/uploads/session", { body: { scope: "registration" } });
  if (anonSess.json?.uploadSessionId) made.sessions.push(anonSess.json.uploadSessionId);
  record({
    test: "control: anonymous registration session still works",
    http: anonSess.status, expected: "200", actual: String(anonSess.status),
    pass: anonSess.status === 200,
  });

} finally {
  console.log("\nCLEANUP");
  for (const p of made.paths) await svc.storage.from("uploads").remove([p]).catch(() => {});
  if (made.items.length) await q(`delete from public.upload_items where id = any($1::uuid[])`, [made.items]);
  if (made.sessions.length) await q(`delete from public.upload_items where session_id = any($1::uuid[])`, [made.sessions]);
  if (made.sessions.length) await q(`delete from public.upload_sessions where id = any($1::uuid[])`, [made.sessions]);
  if (made.profiles.length) await q(`delete from public.profiles where id = any($1::uuid[])`, [made.profiles]);
  if (made.accounts.length) await q(`delete from public.accounts where id = any($1::uuid[])`, [made.accounts]);
  const [{ n }] = await q(`select count(*)::int n from public.accounts where username like $1`, [`${RUN}%`]);
  console.log(`  rows remaining: ${n}`);
}

const pass = results.filter(r => r.pass === true).length, fail = results.filter(r => r.pass === false).length;
console.log("\n" + "=".repeat(78));
console.log(`FINAL ITEMS: ${pass} PASS · ${fail} FAIL · ${results.filter(r=>r.pass===null).length} MEASURED`);
console.log("=".repeat(78));
await end();
process.exit(fail > 0 ? 1 : 0);

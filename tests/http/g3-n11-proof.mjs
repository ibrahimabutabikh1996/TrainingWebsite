/* Direct proof for G-3 and N-11, which the combined run could not reach:
 *   G-3  the create call is now refused first, so confirm has to be exercised
 *        against an item obtained legitimately.
 *   N-11 eight calls sit under a ceiling of sixty; the limiter is only proven
 *        by crossing it.
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
console.log("G-3 / N-11 — direct proof");
console.log("=".repeat(78));

const made = { accounts: [], profiles: [], sessions: [], items: [], paths: [] };
const hash = await bcrypt.hash(`TestOnly_${RUN}`, 10);
const stale = (a) => cookieFor(mintSession({ id: a.id, username: a.username }, { issuedAt: Math.floor(Date.now() / 1000) - 2 * 86400 }));

try {
  const [a] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id,username`, [`${RUN}_u`, hash]);
  made.accounts.push(a.id);
  const [p] = await q(`insert into public.profiles (username,data,user_id,subscription_ends_at,is_suspended) values ($1,$2::jsonb,$3,now()+interval '20 days',false) returning id`, [`${RUN}_u`, JSON.stringify({ __test_run: RUN }), a.id]);
  made.profiles.push(p.id);
  const live = cookieFor(mintSession({ id: a.id, username: a.username }));

  /* A legitimately created + uploaded item, so confirm has something real. */
  const s = await http("POST", "/api/uploads/session", { body: { scope: "renewal", profileId: p.id }, cookie: live });
  made.sessions.push(s.json.uploadSessionId);
  const c = await http("POST", "/api/uploads/create", { body: { uploadSessionId: s.json.uploadSessionId, field: "body_photos" }, cookie: live });
  made.items.push(c.json.itemId); made.paths.push(c.json.path);
  await anon.storage.from("uploads").uploadToSignedUrl(c.json.path, c.json.token, PNG, { contentType: "image/png" });

  /* ---- G-3: confirm that same item with a REVOKED cookie ---- */
  const withStale = await http("POST", "/api/uploads/confirm", {
    body: { uploadSessionId: s.json.uploadSessionId, itemId: c.json.itemId }, cookie: stale(a),
  });
  record({
    test: "G-3 revoked session -> confirm a real, own item",
    http: withStale.status,
    expected: "403 — the session no longer proves ownership",
    actual: `${withStale.status} ${withStale.json?.error ?? ""}`,
    pass: withStale.status === 403,
  });

  /* ---- and the live owner still succeeds on the same item ---- */
  const withLive = await http("POST", "/api/uploads/confirm", {
    body: { uploadSessionId: s.json.uploadSessionId, itemId: c.json.itemId }, cookie: live,
  });
  record({
    test: "G-3 control: live owner confirms the same item",
    http: withLive.status,
    expected: "200 png — the fix does not over-block",
    actual: `${withLive.status} ${withLive.json?.type ?? withLive.json?.error ?? ""}`,
    pass: withLive.status === 200 && withLive.json?.type === "png",
  });

  /* ---- N-11: cross the ceiling on one session ---- */
  console.log("\n[N-11] crossing the confirm ceiling (limit 60 per session)");
  const codes = [];
  for (let i = 0; i < 66; i++) {
    const r = await http("POST", "/api/uploads/confirm", {
      body: { uploadSessionId: s.json.uploadSessionId, itemId: crypto.randomUUID() },
      cookie: live,
      ip: `192.0.2.${(i % 200) + 1}`, // rotate the address so the SESSION key is what bites
    });
    codes.push(r.status);
    if (r.status === 429) break;
  }
  const firstThrottled = codes.indexOf(429);
  console.log(`  calls made: ${codes.length}, first 429 at call #${firstThrottled + 1}`);
  record({
    test: "N-11 confirm is rate limited per session",
    http: firstThrottled >= 0 ? 429 : codes[codes.length - 1],
    expected: "a 429 once the per-session ceiling is crossed, despite rotating addresses",
    actual: firstThrottled >= 0 ? `429 at call #${firstThrottled + 1}` : `no 429 in ${codes.length} calls`,
    pass: firstThrottled >= 0,
    note: "the address rotated every call, so the session key is what stopped it",
  });

} finally {
  console.log("\nCLEANUP");
  for (const pth of made.paths) await svc.storage.from("uploads").remove([pth]).catch(() => {});
  if (made.sessions.length) await q(`delete from public.upload_items where session_id = any($1::uuid[])`, [made.sessions]);
  if (made.sessions.length) await q(`delete from public.upload_sessions where id = any($1::uuid[])`, [made.sessions]);
  if (made.profiles.length) await q(`delete from public.profiles where id = any($1::uuid[])`, [made.profiles]);
  if (made.accounts.length) await q(`delete from public.accounts where id = any($1::uuid[])`, [made.accounts]);
  const keys = ["upload-confirm:session:" + made.sessions[0]];
  for (let i = 1; i <= 200; i++) keys.push(`upload-confirm:192.0.2.${i}`);
  await q(`delete from public.login_attempts where key = any($1::text[])`, [keys]);
  const [{ n }] = await q(`select count(*)::int n from public.accounts where username like $1`, [`${RUN}%`]);
  console.log(`  rows remaining: ${n}`);
}

const pass = results.filter(r => r.pass === true).length, fail = results.filter(r => r.pass === false).length;
console.log("\n" + "=".repeat(78));
console.log(`G-3 / N-11: ${pass} PASS · ${fail} FAIL`);
for (const r of results.filter(r => r.pass === false)) console.log(`  FAIL ${r.test}: expected ${r.expected}, got ${r.actual}`);
console.log("=".repeat(78));
await end();
process.exit(fail > 0 ? 1 : 0);

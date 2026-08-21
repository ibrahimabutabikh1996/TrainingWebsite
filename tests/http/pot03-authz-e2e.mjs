/* POT-03 — end-to-end authorization against the now-private bucket.
 *
 * The reader returning 307 is not proof on its own: the signed URL it points at
 * must actually deliver the bytes out of a bucket that is no longer public.
 * This follows the redirect and reads the object, as a browser would.
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
console.log("POT-03 — authorization end to end against the PRIVATE bucket");
console.log("=".repeat(78));

const made = { accounts: [], profiles: [], sessions: [], items: [], path: null };
const hash = await bcrypt.hash(`TestOnly_${RUN}`, 10);

async function trainee(tag) {
  const [a] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id,username`, [`${RUN}_${tag}`, hash]);
  made.accounts.push(a.id);
  const [p] = await q(`insert into public.profiles (username,data,user_id,subscription_ends_at,is_suspended) values ($1,$2::jsonb,$3,now()+interval '20 days',false) returning id`, [`${RUN}_${tag}`, JSON.stringify({ __test_run: RUN }), a.id]);
  made.profiles.push(p.id);
  return { a, p, cookie: cookieFor(mintSession({ id: a.id, username: a.username })) };
}

try {
  const owner = await trainee("owner");
  const stranger = await trainee("stranger");
  const adminCookie = cookieFor(mintSession({ id: stranger.a.id, username: "admin" }));

  /* Full real upload owned by `owner`, attached to the profile. */
  const s = await http("POST", "/api/uploads/session", { body: { scope: "renewal", profileId: owner.p.id }, cookie: owner.cookie });
  made.sessions.push(s.json.uploadSessionId);
  const c = await http("POST", "/api/uploads/create", { body: { uploadSessionId: s.json.uploadSessionId, field: "body_photos" }, cookie: owner.cookie });
  made.items.push(c.json.itemId);
  made.path = c.json.path;

  const up = await anon.storage.from("uploads").uploadToSignedUrl(made.path, c.json.token, PNG, { contentType: "image/png" });
  record({ test: "signed upload into the PRIVATE bucket", http: up.error ? "err" : "ok", expected: "succeeds", actual: up.error ? up.error.message.slice(0, 60) : "uploaded", pass: !up.error });

  const cf = await http("POST", "/api/uploads/confirm", { body: { uploadSessionId: s.json.uploadSessionId, itemId: c.json.itemId }, cookie: owner.cookie });
  record({ test: "confirm reads it back out of the private bucket", http: cf.status, expected: "200 png", actual: `${cf.status} ${cf.json?.type ?? cf.json?.error ?? ""}`, pass: cf.status === 200 && cf.json?.type === "png" });

  await q(`update public.upload_items set status='attached', attached_at=now() where id=$1`, [c.json.itemId]);
  await q(`update public.upload_sessions set status='consumed', profile_id=$2 where id=$1`, [s.json.uploadSessionId, owner.p.id]);
  await q(`update public.profiles set data = jsonb_set(data,'{body_photos}',$2::jsonb) where id=$1`, [owner.p.id, JSON.stringify([made.path])]);

  const enc = encodeURIComponent(made.path);

  /* OWNER — follow the redirect and actually read the bytes. */
  const oRes = await http("GET", `/api/attachments?path=${enc}`, { cookie: owner.cookie });
  let ownerBytes = null;
  if (oRes.status === 307) {
    const loc = await fetch(`http://localhost:3000/api/attachments?path=${enc}`, { headers: { Cookie: owner.cookie }, redirect: "manual" });
    const signed = loc.headers.get("location");
    const f = await fetch(signed);
    ownerBytes = { status: f.status, type: f.headers.get("content-type"), len: (await f.arrayBuffer()).byteLength };
  }
  record({
    test: "OWNER reads the file end to end (307 -> signed -> bytes)",
    http: oRes.status,
    expected: "307 then 200 with image bytes from a private bucket",
    actual: `${oRes.status} -> ${ownerBytes ? `${ownerBytes.status} ${ownerBytes.type} ${ownerBytes.len}B` : "no redirect"}`,
    pass: oRes.status === 307 && ownerBytes?.status === 200 && ownerBytes.len === PNG.length,
  });

  /* STRANGER + ANON */
  const st = await http("GET", `/api/attachments?path=${enc}`, { cookie: stranger.cookie });
  record({ test: "STRANGER refused", http: st.status, expected: "403", actual: String(st.status), pass: st.status === 403 });
  const an = await http("GET", `/api/attachments?path=${enc}`);
  record({ test: "ANONYMOUS refused", http: an.status, expected: "401", actual: String(an.status), pass: an.status === 401 });

  /* ADMIN — the panel must still be able to open a trainee's file. */
  const ad = await http("GET", `/api/attachments?path=${enc}`, { cookie: adminCookie });
  record({ test: "ADMIN allowed (panel reads trainee files)", http: ad.status, expected: "307", actual: String(ad.status), pass: ad.status === 307 });

  /* ANON direct at the object, now that the bucket is private. */
  const direct = await fetch(`${url}/storage/v1/object/public/uploads/${made.path}`);
  record({ test: "ANON direct public URL to a trainee file", http: direct.status, expected: "not 200", actual: `HTTP ${direct.status}`, pass: direct.status !== 200 });

  const list = await anon.storage.from("uploads").list("usersData");
  const listed = !list.error && (list.data?.length ?? 0) > 0;
  record({ test: "ANON LIST the private bucket", http: list.error ? "err" : "ok", expected: "denied/empty", actual: list.error ? `denied` : `${list.data.length} entries`, pass: !listed });

} finally {
  console.log("\nCLEANUP");
  if (made.path) await svc.storage.from("uploads").remove([made.path]).catch(() => {});
  if (made.items.length) await q(`delete from public.upload_items where id = any($1::uuid[])`, [made.items]);
  if (made.sessions.length) await q(`delete from public.upload_sessions where id = any($1::uuid[])`, [made.sessions]);
  if (made.profiles.length) await q(`delete from public.profiles where id = any($1::uuid[])`, [made.profiles]);
  if (made.accounts.length) await q(`delete from public.accounts where id = any($1::uuid[])`, [made.accounts]);
  const [{ n }] = await q(`select count(*)::int n from public.accounts where username like $1`, [`${RUN}%`]);
  console.log(`  rows remaining: ${n}`);
}

const pass = results.filter(r => r.pass === true).length, fail = results.filter(r => r.pass === false).length;
console.log("\n" + "=".repeat(78));
console.log(`AUTHZ E2E: ${pass} PASS · ${fail} FAIL`);
for (const r of results.filter(r => r.pass === false)) console.log(`  FAIL ${r.test}: expected ${r.expected}, got ${r.actual}`);
console.log("=".repeat(78));
await end();
process.exit(fail > 0 ? 1 : 0);

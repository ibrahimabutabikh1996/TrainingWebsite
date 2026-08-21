/* De-risks the recommended fix: does /api/attachments (the authorizing reader
 * that already exists) actually serve a private path to its owner and refuse a
 * stranger? If it works, the fix is "make the bucket private + point render
 * sites at attachmentSrc", not "build a new reader".
 *
 * Real upload flow so the path is genuinely attached to a profile. Tracked and
 * cleaned by id.
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
console.log("Attachments-reader de-risk — /api/attachments as owner vs stranger");
console.log("=".repeat(78));

const created = { accounts: [], profiles: [], sessions: [], items: [], path: null };
const hash = await bcrypt.hash(`TestOnly_${RUN}`, 10);

async function trainee(tag) {
  const [a] = await q(`insert into public.accounts (username,password,password_changed_at) values ($1,$2,now()-interval '1 hour') returning id,username`, [`${RUN}_${tag}`, hash]);
  created.accounts.push(a.id);
  const [p] = await q(`insert into public.profiles (username,data,user_id,subscription_ends_at,is_suspended) values ($1,$2::jsonb,$3,now()+interval '20 days',false) returning id`, [`${RUN}_${tag}`, JSON.stringify({ __test_run: RUN }), a.id]);
  created.profiles.push(p.id);
  return { a, p, cookie: cookieFor(mintSession({ id: a.id, username: a.username })) };
}

try {
  const owner = await trainee("owner");
  const stranger = await trainee("stranger");

  /* Real renewal upload owned by `owner`, then attach it to the profile so the
     reader's "profile references this path" check has something to find. */
  const s = await http("POST", "/api/uploads/session", { body: { scope: "renewal", profileId: owner.p.id }, cookie: owner.cookie });
  created.sessions.push(s.json.uploadSessionId);
  const c = await http("POST", "/api/uploads/create", { body: { uploadSessionId: s.json.uploadSessionId, field: "body_photos" }, cookie: owner.cookie });
  created.items.push(c.json.itemId);
  created.path = c.json.path;
  await anon.storage.from("uploads").uploadToSignedUrl(c.json.path, c.json.token, PNG, { contentType: "image/png" });
  await http("POST", "/api/uploads/confirm", { body: { uploadSessionId: s.json.uploadSessionId, itemId: c.json.itemId }, cookie: owner.cookie });
  /* Mark attached + reference it from the profile, as a real submission would. */
  await q(`update public.upload_items set status='attached', attached_at=now() where id=$1`, [c.json.itemId]);
  await q(`update public.upload_sessions set status='consumed', profile_id=$2 where id=$1`, [s.json.uploadSessionId, owner.p.id]);
  await q(`update public.profiles set data = jsonb_set(data,'{body_photos}', $2::jsonb) where id=$1`, [owner.p.id, JSON.stringify([created.path])]);

  const enc = encodeURIComponent(created.path);

  /* owner -> should get a 307 redirect to a signed URL */
  const asOwner = await http("GET", `/api/attachments?path=${enc}`, { cookie: owner.cookie });
  record({
    test: "reader: owner gets a signed redirect",
    http: asOwner.status,
    expected: "307 (redirect to signed URL)",
    actual: `${asOwner.status}`,
    pass: asOwner.status === 307,
    note: "the fix target works: authorized owner is served",
  });

  /* stranger -> 403 */
  const asStranger = await http("GET", `/api/attachments?path=${enc}`, { cookie: stranger.cookie });
  record({
    test: "reader: stranger refused",
    http: asStranger.status,
    expected: "403",
    actual: `${asStranger.status}`,
    pass: asStranger.status === 403,
    note: "ownership enforced by the reader",
  });

  /* anonymous -> 401 */
  const asAnon = await http("GET", `/api/attachments?path=${enc}`);
  record({
    test: "reader: anonymous refused",
    http: asAnon.status,
    expected: "401",
    actual: `${asAnon.status}`,
    pass: asAnon.status === 401,
    note: "no session -> no access",
  });

  /* public images prefix -> served without a session (needed for CMS) */
  const asPublic = await http("GET", `/api/attachments?path=${encodeURIComponent("images/nonexistent_" + RUN)}`);
  record({
    test: "reader: images/ prefix path is handled without auth",
    http: asPublic.status,
    expected: "307 or 404 (not 401) — public prefix needs no session",
    actual: `${asPublic.status}`,
    pass: asPublic.status !== 401,
    note: "confirms CMS images could be served through the reader too if wanted",
  });

} finally {
  console.log("\nCLEANUP");
  if (created.path) await svc.storage.from("uploads").remove([created.path]).catch(() => {});
  if (created.items.length) await q(`delete from public.upload_items where id = any($1::uuid[])`, [created.items]);
  if (created.sessions.length) await q(`delete from public.upload_sessions where id = any($1::uuid[])`, [created.sessions]);
  if (created.profiles.length) await q(`delete from public.profiles where id = any($1::uuid[])`, [created.profiles]);
  if (created.accounts.length) await q(`delete from public.accounts where id = any($1::uuid[])`, [created.accounts]);
  const [{ n }] = await q(`select count(*)::int n from public.accounts where username like $1`, [`${RUN}%`]);
  console.log(`  rows remaining: ${n}`);
}

console.log("\n" + "=".repeat(78));
const pass = results.filter(r => r.pass === true).length, fail = results.filter(r => r.pass === false).length;
console.log(`READER: ${pass} PASS · ${fail} FAIL`);
console.log("=".repeat(78));
await end();
process.exit(fail > 0 ? 1 : 0);

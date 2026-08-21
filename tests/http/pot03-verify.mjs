/* POT-03 verification — anon reachability and the full upload flow.
 *
 * Runs identically before and after each phase, so the same script is the
 * evidence for both. Phase-aware: the storage-read expectations differ once the
 * bucket goes private, which it reads from the bucket itself rather than being
 * told.
 *
 * Creates only its own fixtures and removes them.
 */
import { createClient } from "@supabase/supabase-js";
import { db, readEnv, http } from "./_lib.mjs";

const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const anon = createClient(url, readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
const svc = createClient(url, readEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const { q, end } = await db();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const [bucket] = await q(`select public from storage.buckets where name='uploads'`);
const BUCKET_PUBLIC = bucket.public;

console.log("=".repeat(78));
console.log(`POT-03 VERIFY   (bucket public = ${BUCKET_PUBLIC})`);
console.log("=".repeat(78));

const rows = [];
const check = (name, expected, actual, ok) => {
  rows.push({ name, expected, actual, ok });
  console.log(`  [${ok === true ? "PASS" : ok === false ? "FAIL" : "INFO"}] ${name}`);
  console.log(`         expected: ${expected}`);
  console.log(`         actual  : ${actual}`);
};

/* ------------------------------------------------ anon table reachability -- */
console.log("\n[A] ANON — PostgREST table reads (must all be denied)");
for (const t of ["upload_items", "upload_sessions", "login_attempts", "nutrition_sources"]) {
  const { count, error } = await anon.from(t).select("*", { count: "exact", head: true });
  const denied = Boolean(error) || (count ?? 0) === 0;
  check(
    `anon SELECT ${t}`,
    "denied (error or 0 rows)",
    error ? `DENIED (${error.code ?? error.message.slice(0, 40)})` : `returned ${count} rows`,
    denied
  );
}

/* ------------------------------------------- upload flow with real bytes -- */
console.log("\n[B] UPLOAD FLOW — session -> create -> real signed upload -> confirm");
const made = { sessionId: null, itemId: null, path: null };
{
  const s = await http("POST", "/api/uploads/session", { body: { scope: "registration" } });
  made.sessionId = s.json?.uploadSessionId;
  check("open session", "200 + id", `${s.status} ${made.sessionId ? "id" : "none"}`, s.status === 200 && !!made.sessionId);

  const c = await http("POST", "/api/uploads/create", { body: { uploadSessionId: made.sessionId, field: "payment_receipt" } });
  made.itemId = c.json?.itemId;
  made.path = c.json?.path;
  check("create slot", "200 + path + token", `${c.status} ${c.json?.token ? "token" : "no token"}`, c.status === 200 && !!c.json?.token);

  /* THE question for phase 1: does a signed upload still work with the public
     INSERT policy removed? */
  const up = await anon.storage.from("uploads").uploadToSignedUrl(made.path, c.json.token, PNG, { contentType: "image/png" });
  check(
    "SIGNED UPLOAD (public INSERT policy removed)",
    "succeeds — the token authorises it, not the policy",
    up.error ? `FAILED: ${up.error.message.slice(0, 70)}` : "uploaded",
    !up.error
  );

  const cf = await http("POST", "/api/uploads/confirm", { body: { uploadSessionId: made.sessionId, itemId: made.itemId } });
  check("confirm (server downloads + verifies)", "200 type=png", `${cf.status} ${cf.json?.type ?? cf.json?.error ?? ""}`, cf.status === 200 && cf.json?.type === "png");
}

/* -------------------------------------------------- anon storage abilities -- */
console.log("\n[C] ANON — storage operations on that object");
{
  const publicUrl = `${url}/storage/v1/object/public/uploads/${made.path}`;
  const read = await fetch(publicUrl);
  check(
    "anon READ via public URL",
    BUCKET_PUBLIC ? "(phase 1) still 200 — public SELECT not yet removed" : "(phase 2) NOT 200 — bucket is private",
    `HTTP ${read.status}`,
    BUCKET_PUBLIC ? null : read.status !== 200
  );

  const list = await anon.storage.from("uploads").list(made.path.split("/").slice(0, 2).join("/"));
  const listed = !list.error && (list.data?.length ?? 0) > 0;
  check(
    "anon LIST",
    BUCKET_PUBLIC ? "(phase 1) may still list" : "(phase 2) denied/empty",
    list.error ? `denied (${list.error.message.slice(0, 40)})` : `${list.data.length} entries`,
    BUCKET_PUBLIC ? null : !listed
  );

  const upd = await anon.storage.from("uploads").update(made.path, PNG, { contentType: "image/png" });
  check("anon UPDATE (overwrite)", "denied", upd.error ? `denied (${upd.error.message.slice(0, 50)})` : "OVERWROTE", Boolean(upd.error));

  const del = await anon.storage.from("uploads").remove([made.path]);
  const deleted = !del.error && (del.data?.length ?? 0) > 0;
  check("anon DELETE", "denied", deleted ? "DELETED THE FILE" : `denied (${del.error?.message.slice(0, 50) ?? "no-op"})`, !deleted);
}

/* ----------------------------------------------------------------- cleanup -- */
console.log("\nCLEANUP");
if (made.path) await svc.storage.from("uploads").remove([made.path]).catch(() => {});
if (made.itemId) await q(`delete from public.upload_items where id=$1`, [made.itemId]);
if (made.sessionId) await q(`delete from public.upload_sessions where id=$1`, [made.sessionId]);
const [{ n }] = await q(`select count(*)::int n from public.upload_sessions where id=$1`, [made.sessionId]);
console.log(`  leftover rows: ${n}`);

const pass = rows.filter(r => r.ok === true).length;
const fail = rows.filter(r => r.ok === false).length;
const info = rows.filter(r => r.ok === null).length;
console.log("\n" + "=".repeat(78));
console.log(`RESULT: ${pass} PASS · ${fail} FAIL · ${info} INFO`);
console.log("=".repeat(78));
await end();
process.exit(fail > 0 ? 1 : 0);

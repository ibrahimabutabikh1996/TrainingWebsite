/* Item 3 — the real upload flow, with real bytes against real Supabase Storage.
 *
 * Not seeded rows this time: this drives /api/uploads/session -> create ->
 * (real signed upload of real bytes) -> confirm, and reads the row Supabase
 * actually stored. It then uses that same object to demonstrate — on a file
 * THIS TEST created and will delete — what the public bucket policy allows an
 * anonymous caller to do.
 *
 * Everything created is tracked and removed at the end.
 */
import { createClient } from "@supabase/supabase-js";
import { db, readEnv, http, record, results } from "./_lib.mjs";

const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const { q, end } = await db();

/* A valid 1x1 PNG — real magic bytes and a real IHDR, so confirmItem's
   structure check has something to parse. */
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

console.log("=".repeat(78));
console.log("ITEM 3 — real bytes through uploads/create + confirm (live Supabase)");
console.log("=".repeat(78));

const created = { sessionId: null, itemId: null, path: null };

try {
  /* 1 — open an anonymous registration session */
  const s = await http("POST", "/api/uploads/session", { body: { scope: "registration" } });
  created.sessionId = s.json?.uploadSessionId;
  record({
    test: "3.1 open registration session",
    http: s.status, expected: "200 + id",
    actual: `${s.status} ${created.sessionId ? "id" : "no-id"}`,
    pass: s.status === 200 && Boolean(created.sessionId),
  });

  /* 2 — request a slot: server names the path and hands back a signed token */
  const c = await http("POST", "/api/uploads/create", {
    body: { uploadSessionId: created.sessionId, field: "payment_receipt" },
  });
  created.itemId = c.json?.itemId;
  created.path = c.json?.path;
  record({
    test: "3.2 create slot -> path + token",
    http: c.status, expected: "200 + path + token",
    actual: `${c.status} path=${created.path ? "yes" : "no"} token=${c.json?.token ? "yes" : "no"}`,
    pass: c.status === 200 && Boolean(c.json?.path) && Boolean(c.json?.token),
    note: `path shape: ${created.path?.replace(/[0-9a-f-]{36}/, "<UUID>")}`,
  });

  /* 3 — actually upload the bytes to the signed URL (this is the real network
     write to Supabase Storage that the seeded tests skipped) */
  const up = await anon.storage.from("uploads").uploadToSignedUrl(created.path, c.json.token, PNG_1x1, {
    contentType: "image/png",
  });
  record({
    test: "3.3 real bytes uploaded via signed URL",
    http: up.error ? "err" : "ok",
    expected: "no error",
    actual: up.error ? up.error.message.slice(0, 60) : "uploaded",
    pass: !up.error,
  });

  /* 4 — confirm: server downloads the object, checks magic bytes + structure */
  const cf = await http("POST", "/api/uploads/confirm", {
    body: { uploadSessionId: created.sessionId, itemId: created.itemId },
  });
  record({
    test: "3.4 confirm verifies the real object",
    http: cf.status,
    expected: "200, type detected from the bytes",
    actual: `${cf.status} ${cf.json?.type ?? cf.json?.error ?? ""}`,
    pass: cf.status === 200 && cf.json?.type === "png",
    note: "server read the object back and validated it, not the client's claim",
  });

  /* 5 — the row Supabase actually stored */
  const [row] = await q(
    `select status, detected_type, mime, size_bytes from public.upload_items where id = $1`,
    [created.itemId]
  );
  record({
    test: "3.5 db reflects a confirmed image",
    http: "-",
    expected: "status=confirmed, detected_type=png",
    actual: `status=${row?.status}, type=${row?.detected_type}, mime=${row?.mime}, bytes=${row?.size_bytes}`,
    pass: row?.status === "confirmed" && row?.detected_type === "png",
  });

  /* 6 — demonstrate the public-bucket exposure on THIS test object only */
  console.log("\n  --- storage exposure, exercised on this test's own object ---");
  const publicUrl = `${url}/storage/v1/object/public/uploads/${created.path}`;
  const read = await fetch(publicUrl);
  record({
    test: "3.6 anon READ of the object (no key at all)",
    http: read.status,
    expected: "(measuring) 200 means public read",
    actual: `HTTP ${read.status}`,
    pass: null,
    note: read.status === 200 ? "public bucket serves the file to anyone with the URL" : "not served",
  });

  const listing = await anon.storage.from("uploads").list(created.path.split("/").slice(0, 2).join("/"));
  record({
    test: "3.7 anon LIST enumerates the folder (defeats path-guessing)",
    http: listing.error ? "err" : "ok",
    expected: "(measuring) a listing means paths need not be guessed",
    actual: listing.error ? listing.error.message.slice(0, 50) : `${listing.data.length} entries listed`,
    pass: null,
    note: listing.error ? "listing denied" : "anon can enumerate object names",
  });

  const del = await anon.storage.from("uploads").remove([created.path]);
  const deleted = !del.error && del.data && del.data.length > 0;
  record({
    test: "3.8 anon DELETE of the object",
    http: del.error ? "err" : "ok",
    expected: "(measuring) success means anyone can delete trainee files",
    actual: del.error ? del.error.message.slice(0, 50) : (deleted ? "DELETED" : "no-op"),
    pass: null,
    note: deleted ? "public DELETE policy — anon removed the file" : "delete refused",
  });
  if (deleted) created.path = null; // already gone

} finally {
  console.log("\nCLEANUP");
  /* Remove any object still present, then the rows, by id. */
  if (created.path) {
    const svc = createClient(url, readEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    await svc.storage.from("uploads").remove([created.path]).catch(() => {});
  }
  if (created.itemId) await q(`delete from public.upload_items where id = $1`, [created.itemId]);
  if (created.sessionId) await q(`delete from public.upload_sessions where id = $1`, [created.sessionId]);
  const [{ n }] = await q(
    `select count(*)::int n from public.upload_sessions where id = $1`,
    [created.sessionId]
  );
  console.log(`  session row remaining: ${n}`);
}

console.log("\n" + "=".repeat(78));
const pass = results.filter((r) => r.pass === true).length;
const fail = results.filter((r) => r.pass === false).length;
const meas = results.filter((r) => r.pass === null).length;
console.log(`ITEM 3: ${pass} PASS · ${fail} FAIL · ${meas} MEASURED`);
console.log("=".repeat(78));
await end();
process.exit(fail > 0 ? 1 : 0);

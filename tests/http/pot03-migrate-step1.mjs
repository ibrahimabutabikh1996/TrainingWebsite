/* POT-03 phase 2, step 1 — create `public-media` and COPY the CMS objects into
 * it. Nothing is deleted and nothing is switched over here.
 *
 * Why only the CMS half moves
 * ---------------------------
 * The goal is one private bucket for trainee files and one public bucket for
 * CMS media. `uploads` already holds the trainee files and is the bucket the
 * whole upload pipeline is wired to — the client's `bucket` field, the signed
 * upload token, `upload_items.storage_path`, and the paths stored in
 * `profiles.data`. Moving those 12 objects would mean rewriting all of that.
 * Moving the 16 CMS objects out instead reaches the same end state — trainee
 * files alone in a bucket that will be made private — while leaving the upload
 * pipeline and every stored trainee path untouched.
 *
 * Copy, verify, and only then (in a later step) delete the originals.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { db, readEnv } from "./_lib.mjs";

const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const svc = createClient(url, readEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const { q, end } = await db();

const SRC = "uploads";
const DEST = "public-media";
const manifest = JSON.parse(fs.readFileSync(new URL("./pot03-migration-manifest.json", import.meta.url), "utf8"));

console.log("=".repeat(78));
console.log(`STEP 1 — create '${DEST}' and copy ${manifest.public.length} CMS objects (no deletes)`);
console.log("=".repeat(78));

/* --- create the bucket, public --- */
const { data: existing } = await svc.storage.getBucket(DEST);
if (existing) {
  console.log(`\nbucket '${DEST}' already exists (public=${existing.public})`);
} else {
  const { error } = await svc.storage.createBucket(DEST, { public: true });
  if (error) { console.error("createBucket failed:", error.message); await end(); process.exit(1); }
  console.log(`\ncreated bucket '${DEST}' (public=true)`);
}

/* --- copy each object --- */
console.log(`\ncopying:`);
const copied = [];
const failed = [];
for (const o of manifest.public) {
  /* Cross-bucket copy; fall back to download+upload if the server rejects it. */
  let ok = false, how = "copy";
  const { error: cErr } = await svc.storage.from(SRC).copy(o.name, o.name, { destinationBucket: DEST });
  if (!cErr) ok = true;
  else {
    how = "download+upload";
    const { data: blob, error: dErr } = await svc.storage.from(SRC).download(o.name);
    if (!dErr && blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      const { error: uErr } = await svc.storage.from(DEST).upload(o.name, buf, {
        contentType: o.mime || blob.type || "application/octet-stream",
        upsert: true,
        cacheControl: "31536000",
      });
      ok = !uErr;
      if (uErr) failed.push({ name: o.name, reason: uErr.message });
    } else {
      failed.push({ name: o.name, reason: dErr?.message ?? "download failed" });
    }
  }
  if (ok) copied.push(o.name);
  console.log(`  ${ok ? "OK " : "ERR"} ${how.padEnd(16)} ${o.name.slice(0, 52)}`);
}

/* --- verify: count + size + content-type in the destination --- */
console.log(`\nVERIFY destination contents`);
const destRows = await q(
  `select name, metadata->>'mimetype' as mime, (metadata->>'size')::bigint as size
   from storage.objects where bucket_id=$1 order by name`, [DEST]
);
console.log(`  objects in ${DEST}: ${destRows.length} (expected ${manifest.public.length})`);

let mismatches = 0;
const srcByName = new Map(manifest.public.map((o) => [o.name, o]));
for (const d of destRows) {
  const s = srcByName.get(d.name);
  if (!s) { console.log(`  ?? extra object: ${d.name}`); mismatches++; continue; }
  const sizeOk = String(s.size) === String(d.size);
  const mimeOk = (s.mime ?? "") === (d.mime ?? "");
  if (!sizeOk || !mimeOk) {
    mismatches++;
    console.log(`  !! ${d.name}\n       size ${s.size} -> ${d.size}${sizeOk ? "" : "  MISMATCH"}\n       mime ${s.mime} -> ${d.mime}${mimeOk ? "" : "  MISMATCH"}`);
  }
}
console.log(`  size/content-type mismatches: ${mismatches}`);

/* --- verify each copy is actually fetchable at its new public URL --- */
console.log(`\nVERIFY new public URLs answer 200`);
let fetchFail = 0;
for (const name of copied.slice(0, 20)) {
  const u = `${url}/storage/v1/object/public/${DEST}/${name.split("/").map(encodeURIComponent).join("/")}`;
  const r = await fetch(u);
  if (r.status !== 200) { fetchFail++; console.log(`  ${r.status} ${name}`); }
}
console.log(`  non-200 responses: ${fetchFail} of ${copied.length}`);

manifest.step1 = { dest: DEST, copied, failed, destCount: destRows.length, mismatches, fetchFail, at: new Date().toISOString() };
fs.writeFileSync(new URL("./pot03-migration-manifest.json", import.meta.url), JSON.stringify(manifest, null, 2));

console.log("\n" + "=".repeat(78));
const clean = failed.length === 0 && mismatches === 0 && fetchFail === 0 && destRows.length === manifest.public.length;
console.log(clean ? "STEP 1 OK — copies verified. Originals untouched." : "STEP 1 PROBLEM — do not proceed.");
console.log("=".repeat(78));
await end();
process.exit(clean ? 0 : 1);

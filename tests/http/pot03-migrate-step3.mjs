/* POT-03 phase 2, step 3 — remove the CMS originals from `uploads`.
 *
 * Runs last, and only against names recorded in the manifest as copied AND
 * re-verified here: each one must exist in `public-media` at the same size
 * before its original is touched. Nothing outside that list is considered, so a
 * trainee file cannot be caught by this even in principle.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { db, readEnv } from "./_lib.mjs";

const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const svc = createClient(url, readEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const { q, end } = await db();
const mf = new URL("./pot03-migration-manifest.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(mf, "utf8"));

const SRC = "uploads";
const DEST = "public-media";

console.log("=".repeat(78));
console.log("STEP 3 — delete CMS originals from 'uploads' (manifest names only)");
console.log("=".repeat(78));

const candidates = manifest.step1?.copied ?? [];
console.log(`\nmanifest lists ${candidates.length} copied objects`);

/* Re-verify every candidate before deleting anything. */
const safe = [];
const unsafe = [];
for (const name of candidates) {
  if (!name.startsWith("images/")) { unsafe.push({ name, why: "not an images/ path" }); continue; }
  const [src] = await q(`select (metadata->>'size')::bigint s from storage.objects where bucket_id=$1 and name=$2`, [SRC, name]);
  const [dst] = await q(`select (metadata->>'size')::bigint s from storage.objects where bucket_id=$1 and name=$2`, [DEST, name]);
  if (!dst) { unsafe.push({ name, why: "missing in public-media" }); continue; }
  if (src && String(src.s) !== String(dst.s)) { unsafe.push({ name, why: `size ${src.s} vs ${dst.s}` }); continue; }
  safe.push(name);
}
console.log(`  re-verified safe to delete : ${safe.length}`);
console.log(`  refused                    : ${unsafe.length}`);
for (const u of unsafe) console.log(`     !! ${u.name} — ${u.why}`);

if (unsafe.length > 0) {
  console.error("\nSTOP: not every original has a verified copy. Nothing deleted.");
  await end();
  process.exit(1);
}

/* Confirm no DB row still points at an old address for these objects. */
const [ss] = await q(`select content_ar::text t from public.site_settings where id='landing_content'`);
const stillReferenced = safe.filter((n) => ss.t.includes(`/public/uploads/${n}`));
console.log(`\n  originals still referenced by site_settings: ${stillReferenced.length}`);
for (const n of stillReferenced) console.log(`     !! ${n}`);
if (stillReferenced.length > 0) {
  console.error("STOP: a live reference still points at an original. Nothing deleted.");
  await end();
  process.exit(1);
}

/* Delete. */
const { data, error } = await svc.storage.from(SRC).remove(safe);
if (error) {
  console.error("delete failed:", error.message);
  await end();
  process.exit(1);
}
console.log(`\ndeleted ${data?.length ?? 0} originals from '${SRC}'`);

/* Final shape of both buckets. */
const shape = await q(`
  select bucket_id, split_part(name,'/',1) prefix, count(*)::int n
  from storage.objects where bucket_id in ($1,$2)
  group by 1,2 order by 1,2`, [SRC, DEST]);
console.log(`\nFINAL BUCKET CONTENTS`);
for (const r of shape) console.log(`  ${r.bucket_id.padEnd(14)} ${String(r.prefix).padEnd(14)} ${r.n}`);

const leftoverImages = shape.find((r) => r.bucket_id === SRC && r.prefix === "images");
manifest.step3 = { deleted: safe, at: new Date().toISOString(), leftoverImagesInUploads: leftoverImages?.n ?? 0 };
fs.writeFileSync(mf, JSON.stringify(manifest, null, 2));

console.log("\n" + "=".repeat(78));
console.log(!leftoverImages
  ? "STEP 3 OK — 'uploads' now holds trainee files only."
  : `NOTE: ${leftoverImages.n} images/ entr(y/ies) remain in uploads (placeholder).`);
console.log("=".repeat(78));
await end();

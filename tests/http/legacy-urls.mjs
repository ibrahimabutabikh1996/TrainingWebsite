/* Item 7 — what is actually stored in profiles.data for uploaded files, and how
 * the render path would break if the bucket went private.
 *
 * Read-only, structure only: prints URL SHAPE with identifiers masked, never a
 * real address or any personal value.
 */
import { db } from "./_lib.mjs";
const { q, end } = await db();

const mask = (s) =>
  String(s)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<UUID>")
    .replace(/_[a-z0-9]{6,}(\.\w+)?$/i, "_<RAND>$1")
    .replace(/[a-z0-9]{20,}/gi, "<HASH>");

const FIELDS = ["payment_receipt", "analysis_file", "supplements_photo", "diet_history_file", "home_equipment_photo", "body_photos"];

console.log("=".repeat(78));
console.log("Item 7 — stored file references in profiles.data (shape only)");
console.log("=".repeat(78));

/* Pull every profile's data blob; classify each stored file reference. */
const rows = await q(`select id, data from public.profiles`);
let publicUrl = 0, bucketPath = 0, other = 0, total = 0;
const shapes = new Set();

for (const r of rows) {
  const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data || {};
  const buckets = [data, ...(Array.isArray(data.history) ? data.history.map((h) => h.data || {}) : [])];
  for (const b of buckets) {
    for (const f of FIELDS) {
      const v = b?.[f];
      const arr = Array.isArray(v) ? v : v ? [v] : [];
      for (const item of arr) {
        if (typeof item !== "string" || !item) continue;
        total++;
        let kind;
        if (item.includes("/storage/v1/object/public/")) { publicUrl++; kind = "PUBLIC_URL"; }
        else if (/^https?:\/\//i.test(item)) { other++; kind = "OTHER_URL"; }
        else if (item.startsWith("usersData/") || item.startsWith("images/")) { bucketPath++; kind = "BUCKET_PATH"; }
        else { other++; kind = "OTHER"; }
        shapes.add(`${kind}: ${mask(item).slice(0, 80)}`);
      }
    }
  }
}

console.log(`\ntotal file references found: ${total}`);
console.log(`  PUBLIC_URL  (…/object/public/…): ${publicUrl}  <- these need the bucket public to render`);
console.log(`  BUCKET_PATH (usersData/… )     : ${bucketPath}  <- these need /api/attachments or a signed URL`);
console.log(`  OTHER                          : ${other}`);
console.log(`\ndistinct shapes:`);
for (const s of [...shapes].sort()) console.log(`  ${s}`);

/* site_settings — CMS public images */
console.log("\n--- site_settings (CMS imagery) ---");
const [ss] = await q(`select content_ar from public.site_settings where id = 'landing_content'`);
const c = typeof ss?.content_ar === "string" ? JSON.parse(ss.content_ar) : ss?.content_ar || {};
let cmsPublic = 0, cmsPath = 0;
for (const [k, v] of Object.entries(c)) {
  if (typeof v === "string" && (v.includes("/storage/") || v.startsWith("images/"))) {
    if (v.includes("/object/public/")) cmsPublic++;
    else cmsPath++;
    console.log(`  ${k}: ${v.includes("/object/public/") ? "PUBLIC_URL" : "PATH"}  ${mask(v).slice(0, 70)}`);
  }
}
console.log(`  CMS public URLs: ${cmsPublic}, CMS paths: ${cmsPath}`);

/* courses.cover_image — referenced by deleteImageServer */
console.log("\n--- courses.cover_image ---");
const cov = await q(`select count(*)::int n, count(*) filter (where cover_image like '%/object/public/%')::int pub from public.courses where cover_image is not null`);
console.log(`  courses with cover_image: ${cov[0].n}, public-URL shaped: ${cov[0].pub}`);

console.log("\n" + "=".repeat(78));
await end();

/* POT-03 phase 2 — full inventory BEFORE moving anything.
 *
 * Produces the old-path -> new-bucket mapping that the migration will run
 * against, and refuses to guess: anything whose destination is not decidable
 * from its prefix is listed as UNCLASSIFIED and stops the migration.
 *
 * Read-only. Writes pot03-migration-manifest.json.
 */
import fs from "node:fs";
import { db } from "./_lib.mjs";

const { q, end } = await db();

console.log("=".repeat(78));
console.log("POT-03 PHASE 2 — MIGRATION INVENTORY (nothing is moved by this script)");
console.log("=".repeat(78));

/* ---------------------------------------------------- 1. objects by prefix -- */
console.log("\n[1] OBJECTS IN bucket 'uploads', BY TOP-LEVEL PREFIX");
const byPrefix = await q(`
  select split_part(name,'/',1) as prefix, count(*)::int n,
         count(*) filter (where name like '%.emptyFolderPlaceholder')::int placeholders
  from storage.objects where bucket_id='uploads'
  group by 1 order by 1`);
for (const p of byPrefix) console.log(`  ${String(p.prefix).padEnd(16)} ${String(p.n).padStart(4)} objects (${p.placeholders} placeholder)`);

const all = await q(`select name, metadata->>'mimetype' as mime, (metadata->>'size')::bigint as size from storage.objects where bucket_id='uploads' order by name`);
console.log(`  TOTAL: ${all.length}`);

/* --------------------------------------------------------- 2. classify -- */
const PRIVATE_PREFIX = "usersData/";
const PUBLIC_PREFIX = "images/";
const manifest = { takenAt: new Date().toISOString(), private: [], public: [], unclassified: [] };

for (const o of all) {
  if (o.name.endsWith(".emptyFolderPlaceholder")) continue; // folder markers, not content
  if (o.name.startsWith(PRIVATE_PREFIX)) manifest.private.push(o);
  else if (o.name.startsWith(PUBLIC_PREFIX)) manifest.public.push(o);
  else manifest.unclassified.push(o);
}
console.log(`\n[2] CLASSIFICATION`);
console.log(`  -> trainee-uploads (private): ${manifest.private.length}`);
console.log(`  -> public-media    (public) : ${manifest.public.length}`);
console.log(`  -> UNCLASSIFIED             : ${manifest.unclassified.length}`);
for (const u of manifest.unclassified) console.log(`       !! ${u.name}`);

/* ------------------------------------------- 3. DB references to images/ -- */
console.log("\n[3] DB REFERENCES TO PUBLIC MEDIA (site_settings)");
const [ss] = await q(`select content_ar from public.site_settings where id='landing_content'`);
const content = typeof ss?.content_ar === "string" ? JSON.parse(ss.content_ar) : ss?.content_ar || {};
const MARKER = "/storage/v1/object/public/uploads/";
manifest.dbRefs = { siteSettingsKeys: [], testimonials: [] };

for (const [k, v] of Object.entries(content)) {
  if (typeof v === "string" && v.includes(MARKER)) {
    manifest.dbRefs.siteSettingsKeys.push({ key: k, url: v, path: decodeURIComponent(v.split(MARKER)[1]) });
    console.log(`  ${k.padEnd(18)} -> ${decodeURIComponent(v.split(MARKER)[1]).slice(0, 55)}`);
  }
}
/* testimonials is a list of records carrying media_url */
const tst = Array.isArray(content.testimonials) ? content.testimonials : [];
tst.forEach((t, i) => {
  if (typeof t?.media_url === "string" && t.media_url.includes(MARKER)) {
    manifest.dbRefs.testimonials.push({ index: i, url: t.media_url, path: decodeURIComponent(t.media_url.split(MARKER)[1]), type: t.type });
    console.log(`  testimonials[${i}] (${t.type}) -> ${decodeURIComponent(t.media_url.split(MARKER)[1]).slice(0, 50)}`);
  }
});
console.log(`  site_settings keys: ${manifest.dbRefs.siteSettingsKeys.length}, testimonials: ${manifest.dbRefs.testimonials.length}`);

/* any OTHER column holding a public uploads URL */
console.log("\n[3b] OTHER TABLES HOLDING AN uploads PUBLIC URL");
const others = await q(`
  select 'courses.cover_image' as loc, count(*)::int n from public.courses where cover_image like '%${MARKER}%'
  union all select 'nutrition_sources.image_url', count(*)::int from public.nutrition_sources where image_url like '%${MARKER}%'
  union all select 'exercises.video_url', count(*)::int from public.exercises where video_url like '%${MARKER}%'
  union all select 'profiles.data (public url)', count(*)::int from public.profiles where data::text like '%${MARKER}%'`);
for (const o of others) console.log(`  ${o.loc.padEnd(30)} ${o.n}`);

/* --------------------------------------- 4. trainee (usersData) references -- */
console.log("\n[4] TRAINEE FILE REFERENCES (paths in profiles.data + upload_items)");
const [ui] = await q(`select count(*)::int n from public.upload_items where storage_path like 'usersData/%'`);
console.log(`  upload_items rows with a usersData path: ${ui.n}`);
const profs = await q(`select id, data from public.profiles`);
let pathRefs = 0;
const FIELDS = ["payment_receipt", "analysis_file", "supplements_photo", "diet_history_file", "home_equipment_photo", "body_photos"];
for (const p of profs) {
  const d = typeof p.data === "string" ? JSON.parse(p.data) : p.data || {};
  const blobs = [d, ...(Array.isArray(d.history) ? d.history.map((h) => h.data || {}) : [])];
  for (const b of blobs) for (const f of FIELDS) {
    const v = b?.[f]; const arr = Array.isArray(v) ? v : v ? [v] : [];
    for (const it of arr) if (typeof it === "string" && it.startsWith("usersData/")) pathRefs++;
  }
}
console.log(`  profiles.data references to usersData paths: ${pathRefs}`);
console.log(`  -> these are PATHS, resolved at read time; moving buckets does NOT`);
console.log(`     require rewriting them IF the reader is pointed at the new bucket.`);

/* ------------------------------------------------------------ 5. summary -- */
manifest.counts = {
  totalObjects: all.length,
  privateToMove: manifest.private.length,
  publicToMove: manifest.public.length,
  unclassified: manifest.unclassified.length,
  siteSettingsRefs: manifest.dbRefs.siteSettingsKeys.length,
  testimonialRefs: manifest.dbRefs.testimonials.length,
  uploadItemsRows: ui.n,
  profileDataPathRefs: pathRefs,
};

fs.writeFileSync(new URL("./pot03-migration-manifest.json", import.meta.url), JSON.stringify(manifest, null, 2));
console.log("\n[5] MANIFEST written to tests/http/pot03-migration-manifest.json");
console.log("\n" + "=".repeat(78));
if (manifest.unclassified.length > 0) {
  console.log("STOP: unclassified objects present — destination cannot be decided. Do not migrate.");
  process.exitCode = 1;
} else {
  console.log("Every object is classifiable by prefix. Mapping is complete.");
}
console.log("=".repeat(78));
await end();

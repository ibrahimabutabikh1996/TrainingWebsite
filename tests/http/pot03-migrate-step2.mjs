/* POT-03 phase 2, step 2 — repoint the stored CMS addresses at `public-media`.
 *
 * Only the bucket segment of each address changes; the path inside it is the
 * same object that step 1 copied and verified. Every new address is fetched
 * before the row is written, so a rewrite can only land on something that
 * actually serves.
 *
 * The old value of every key is kept in the manifest for rollback.
 */
import fs from "node:fs";
import { db } from "./_lib.mjs";

const { q, end } = await db();
const mf = new URL("./pot03-migration-manifest.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(mf, "utf8"));

const OLD = "/storage/v1/object/public/uploads/";
const NEW = "/storage/v1/object/public/public-media/";

console.log("=".repeat(78));
console.log("STEP 2 — repoint site_settings CMS addresses at public-media");
console.log("=".repeat(78));

const [row] = await q(`select content_ar from public.site_settings where id='landing_content'`);
const content = typeof row.content_ar === "string" ? JSON.parse(row.content_ar) : row.content_ar;
manifest.step2 = { before: {}, after: {}, verified: [], failed: [] };

/* --- verify every replacement address serves BEFORE writing anything ---
 *
 * A replacement that does not serve has two very different causes, and only one
 * of them is this migration's fault:
 *
 *   the OLD address still serves  -> the copy did not land. Abort.
 *   the OLD address is dead too   -> the object was already missing before any
 *                                    of this began. Leave the row alone and
 *                                    report it; rewriting a dead reference to
 *                                    point somewhere equally dead changes
 *                                    nothing and touches data for no reason.
 */
manifest.step2.preexistingBroken = [];

async function classify(label, from) {
  const to = from.replace(OLD, NEW);
  const rNew = await fetch(to);
  if (rNew.status === 200) {
    console.log(`  OK   ${label.padEnd(20)} ${rNew.status}`);
    return { ok: true, to };
  }
  const rOld = await fetch(from);
  if (rOld.status === 200) {
    console.log(`  ERR  ${label.padEnd(20)} new=${rNew.status} old=${rOld.status}  <- COPY FAILED`);
    manifest.step2.failed.push({ label, newStatus: rNew.status, oldStatus: rOld.status });
    return { ok: false, abort: true };
  }
  console.log(`  SKIP ${label.padEnd(20)} new=${rNew.status} old=${rOld.status}  <- already broken before migration`);
  manifest.step2.preexistingBroken.push({ label, url: from, newStatus: rNew.status, oldStatus: rOld.status });
  return { ok: false, abort: false };
}

console.log("\nverifying each new address serves before writing anything:");
const rewrites = [];
for (const [k, v] of Object.entries(content)) {
  if (typeof v === "string" && v.includes(OLD)) {
    const res = await classify(k, v);
    if (res.ok) rewrites.push({ kind: "key", key: k, from: v, to: res.to });
  }
}
const tst = Array.isArray(content.testimonials) ? content.testimonials : [];
for (let i = 0; i < tst.length; i++) {
  const v = tst[i]?.media_url;
  if (typeof v === "string" && v.includes(OLD)) {
    const res = await classify(`testimonials[${i}]`, v);
    if (res.ok) rewrites.push({ kind: "testimonial", index: i, from: v, to: res.to });
  }
}

if (manifest.step2.failed.length > 0) {
  console.error("\nSTOP: at least one replacement address does not serve. Nothing written.");
  fs.writeFileSync(mf, JSON.stringify(manifest, null, 2));
  await end();
  process.exit(1);
}

/* --- apply --- */
const next = JSON.parse(JSON.stringify(content));
for (const rw of rewrites) {
  if (rw.kind === "key") {
    manifest.step2.before[rw.key] = rw.from;
    manifest.step2.after[rw.key] = rw.to;
    next[rw.key] = rw.to;
  } else {
    manifest.step2.before[`testimonials[${rw.index}].media_url`] = rw.from;
    manifest.step2.after[`testimonials[${rw.index}].media_url`] = rw.to;
    next.testimonials[rw.index].media_url = rw.to;
  }
}

await q(`update public.site_settings set content_ar = $1::jsonb where id='landing_content'`, [JSON.stringify(next)]);
console.log(`\nwrote ${rewrites.length} rewritten addresses to site_settings`);

/* --- confirm nothing still points at the old bucket --- */
const [after] = await q(`select content_ar::text as t from public.site_settings where id='landing_content'`);
const leftoverOld = (after.t.match(new RegExp(OLD.replace(/\//g, "\\/"), "g")) || []).length;
const nowNew = (after.t.match(new RegExp(NEW.replace(/\//g, "\\/"), "g")) || []).length;
console.log(`  addresses still on the old bucket : ${leftoverOld}`);
console.log(`  addresses on public-media         : ${nowNew}`);

manifest.step2.verified = rewrites.map((r) => r.key ?? `testimonials[${r.index}]`);
manifest.step2.leftoverOld = leftoverOld;
fs.writeFileSync(mf, JSON.stringify(manifest, null, 2));

/* The only addresses allowed to remain on the old bucket are the ones this run
   deliberately skipped: references whose object was already gone before any of
   this started, and which are equally dead either way. */
const skipped = manifest.step2.preexistingBroken.length;
console.log(`  (of those, ${skipped} were already dead before this migration)`);

console.log("\n" + "=".repeat(78));
const ok = leftoverOld === skipped;
console.log(
  ok
    ? `STEP 2 OK — every LIVE CMS address points at public-media; ${skipped} pre-existing dead reference(s) left untouched.`
    : "STEP 2 INCOMPLETE."
);
console.log("=".repeat(78));
await end();
process.exit(ok ? 0 : 1);

/* PHASE 7 — cleanup.
 *
 * Deletes by id, from the manifest, and from nothing else. There is no DELETE in
 * this file without an id list that this run recorded when it created the row.
 * A failure is reported and stops the run rather than being widened into a
 * broader statement — the database holds rows this run did not create, and none
 * of them are ours to remove.
 */
import { db, loadManifest, saveManifest } from "./_lib.mjs";

const { q, end } = await db();
const m = loadManifest();
const RUN = m.runId;

console.log("=".repeat(70));
console.log("PHASE 7 — CLEANUP");
console.log(`Run ID: ${RUN}`);
console.log("=".repeat(70));

const created = {
  accounts: m.accounts.length,
  profiles: m.profiles.length,
  upload_sessions: m.uploadSessions.length,
  upload_items: m.uploadItems.length,
};
console.log("\nCREATED BY THIS RUN:");
for (const [k, v] of Object.entries(created)) console.log(`  ${k.padEnd(16)} ${v}`);

const itemIds = m.uploadItems.map((r) => r.id);
const sessionIds = m.uploadSessions.map((r) => r.id);
const profileIds = m.profiles.map((r) => r.id);
const accountIds = m.accounts.map((r) => r.id);

const deleted = {};
const failures = [];

/* Child-first, so no foreign key blocks a parent. upload_items -> sessions,
   then profiles (which cascade their own children), then accounts. */
async function del(label, sql, ids) {
  if (ids.length === 0) {
    deleted[label] = 0;
    return;
  }
  try {
    const rows = await q(sql, [ids]);
    deleted[label] = rows.length;
    console.log(`  deleted ${label.padEnd(16)} ${rows.length} / ${ids.length}`);
  } catch (e) {
    failures.push({ label, ids, reason: e.message });
    console.error(`  FAILED  ${label}: ${e.message}`);
  }
}

console.log("\nDELETING (by id, child-first):");
await del("upload_items", `delete from public.upload_items where id = any($1::uuid[]) returning id`, itemIds);
await del("upload_sessions", `delete from public.upload_sessions where id = any($1::uuid[]) returning id`, sessionIds);
await del("profiles", `delete from public.profiles where id = any($1::uuid[]) returning id`, profileIds);
await del("accounts", `delete from public.accounts where id = any($1::uuid[]) returning id`, accountIds);

/* Rate-limit counters this run's synthetic addresses created. Scoped to the
   exact keys the harness used — the table also holds counters that are not
   ours. */
const testKeys = [];
for (let i = 1; i <= 250; i++) testKeys.push(`submit-form:203.0.113.${i}`, `upload-session:203.0.113.${i}`, `upload-slot:203.0.113.${i}`, `ip:203.0.113.${i}`);
await del("login_attempts", `delete from public.login_attempts where key = any($1::text[]) returning key`, testKeys);

if (failures.length > 0) {
  console.error("\nCLEANUP INCOMPLETE — not widening the delete. Offending rows:");
  for (const f of failures) console.error(`  ${f.label}: ${f.reason}\n    ids: ${f.ids.join(", ")}`);
  await end();
  process.exit(1);
}

console.log("\nVERIFYING NOTHING REMAINS FOR THIS RUN:");
const remaining = await q(
  `select 'accounts' as t, count(*)::int as n from public.accounts where id = any($1::uuid[]) or username like $5
   union all select 'profiles', count(*)::int from public.profiles where id = any($2::uuid[]) or username like $5
   union all select 'upload_sessions', count(*)::int from public.upload_sessions where id = any($3::uuid[])
   union all select 'upload_items', count(*)::int from public.upload_items where id = any($4::uuid[])`,
  [accountIds, profileIds, sessionIds, itemIds, `${RUN}%`]
);
let leftover = 0;
for (const r of remaining) {
  console.log(`  ${r.t.padEnd(16)} ${r.n}`);
  leftover += r.n;
}

console.log("\nSURVEY — any row anywhere still carrying a SECURITY_TEST_ marker:");
const survey = await q(`
  select 'accounts' as t, count(*)::int as n from public.accounts where username like 'SECURITY\\_TEST\\_%'
  union all select 'profiles', count(*)::int from public.profiles where username like 'SECURITY\\_TEST\\_%'
  union all select 'profiles(blob)', count(*)::int from public.profiles where data::text like '%SECURITY_TEST_%'`);
for (const r of survey) console.log(`  ${r.t.padEnd(16)} ${r.n}`);
const surveyTotal = survey.reduce((s, r) => s + r.n, 0);

console.log("\nPRE-EXISTING DATA (must match the gate's numbers — untouched):");
const counts = await q(`
  select 'accounts' as t, count(*)::int as n from public.accounts
  union all select 'profiles', count(*)::int from public.profiles
  union all select 'upload_sessions', count(*)::int from public.upload_sessions
  union all select 'upload_items', count(*)::int from public.upload_items
  order by t`);
for (const r of counts) console.log(`  ${r.t.padEnd(16)} ${String(r.n).padStart(5)}`);

console.log("\nSUMMARY");
console.log("  Created:", JSON.stringify(created));
console.log("  Deleted:", JSON.stringify(deleted));
console.log(`  Remaining for this Run ID: ${leftover}`);
console.log(`  Any SECURITY_TEST_ marker left anywhere: ${surveyTotal}`);

m.cleanedAt = new Date().toISOString();
m.deleted = deleted;
saveManifest(m);

await end();
process.exit(leftover === 0 && surveyTotal === 0 ? 0 : 1);

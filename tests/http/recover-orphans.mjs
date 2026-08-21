/* Recovers rows created by a seed run that aborted before it wrote the manifest.
 *
 * The seed saved the manifest only at the end, so a mid-run abort left rows in
 * the database that nothing was tracking — the exact condition the manifest
 * exists to prevent. This finds them by the run's own username prefix, which is
 * unique to this run, and writes them into the manifest so cleanup can remove
 * them by id like everything else.
 */
import { db, loadManifest, saveManifest } from "./_lib.mjs";

const { q, end } = await db();
const m = loadManifest();
const RUN = m.runId;

console.log(`Recovering untracked rows for run ${RUN}`);

const known = new Set(m.accounts.map((a) => a.id));
const accounts = await q(
  `select id, username from public.accounts where username like $1 order by username`,
  [`${RUN}%`]
);
for (const a of accounts) {
  if (!known.has(a.id)) {
    m.accounts.push({ id: a.id, username: a.username, tag: a.username.replace(`${RUN}_`, ""), recovered: true });
    console.log(`  + account ${a.id} ${a.username}`);
  }
}

const knownP = new Set(m.profiles.map((p) => p.id));
const profiles = await q(
  `select id, username, user_id from public.profiles where username like $1 order by username`,
  [`${RUN}%`]
);
for (const p of profiles) {
  if (!knownP.has(p.id)) {
    m.profiles.push({ id: p.id, tag: p.username.replace(`${RUN}_`, ""), accountId: p.user_id, recovered: true });
    console.log(`  + profile ${p.id} ${p.username}`);
  }
}

/* Upload sessions hang off the accounts above; find them by that link rather
   than by a name they do not carry. */
const accIds = m.accounts.map((a) => a.id);
if (accIds.length > 0) {
  const knownS = new Set(m.uploadSessions.map((s) => s.id));
  const sessions = await q(
    `select id from public.upload_sessions where account_id = any($1::uuid[])`,
    [accIds]
  );
  for (const s of sessions) {
    if (!knownS.has(s.id)) {
      m.uploadSessions.push({ id: s.id, tag: "recovered", recovered: true });
      console.log(`  + upload_session ${s.id}`);
    }
  }
  const sesIds = m.uploadSessions.map((s) => s.id);
  if (sesIds.length > 0) {
    const knownI = new Set(m.uploadItems.map((i) => i.id));
    const items = await q(
      `select id, session_id from public.upload_items where session_id = any($1::uuid[])`,
      [sesIds]
    );
    for (const i of items) {
      if (!knownI.has(i.id)) {
        m.uploadItems.push({ id: i.id, sessionId: i.session_id, tag: "recovered", recovered: true });
        console.log(`  + upload_item ${i.id}`);
      }
    }
  }
}

saveManifest(m);
console.log(`\nManifest now tracks: ${m.accounts.length} accounts, ${m.profiles.length} profiles, ${m.uploadSessions.length} sessions, ${m.uploadItems.length} items`);
await end();

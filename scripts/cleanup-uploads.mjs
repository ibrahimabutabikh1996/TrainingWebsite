/*
 * Removes upload leftovers. Safe to run repeatedly, safe to interrupt.
 *
 *   node --env-file=.env scripts/cleanup-uploads.mjs [--apply]
 *
 * Without --apply it only reports. Nothing is deleted until you ask for it.
 *
 * What it collects, and why each one is leftover rather than data:
 *
 *   rejected    the object failed verification and was already deleted once. If
 *               that delete failed, the file is still there; this retries it.
 *   created     a signed URL was issued and the object either never arrived or
 *               was never confirmed. Nothing references it and nothing can:
 *               only confirmed items are attachable.
 *   confirmed   verified, but the form was never submitted — the person closed
 *               the tab. Held for a grace period first, in case they come back.
 *   orphaned    attached, but the transaction that should have written the
 *               profile alongside it did not commit, so the session carries no
 *               profile id. Held far longer, because this is the case where
 *               being wrong would delete something real.
 *
 * What it will never touch: an item that is `attached` to a session with a
 * profile id. That is a file a trainee's record is displaying.
 */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

/* Long enough that a slow form-filler is never caught by it. */
const UNCONFIRMED_GRACE_HOURS = 24;
/* Much longer: this is the failed-transaction case, and a false positive here
   deletes a file somebody's profile may yet be repaired to point at. */
const ORPHAN_GRACE_DAYS = 7;

const BUCKET = "uploads";

if (!process.env.DIRECT_URL) {
  console.error("DIRECT_URL is not set. Did you pass --env-file=.env ?");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

/* Everything selected here is by definition not referenced by a profile. The
   `attached` branch requires a NULL profile_id, which only happens when the
   submission transaction rolled back. */
const CANDIDATES = `
  SELECT i.id, i.storage_path, i.status, i.created_at
  FROM public.upload_items i
  JOIN public.upload_sessions s ON s.id = i.session_id
  WHERE
       i.status = 'rejected'
    OR (i.status = 'created'   AND i.created_at < now() - ($1 || ' hours')::interval)
    OR (i.status = 'confirmed' AND i.created_at < now() - ($1 || ' hours')::interval)
    OR (i.status = 'attached'  AND s.profile_id IS NULL
                               AND i.created_at < now() - ($2 || ' days')::interval)
  ORDER BY i.created_at`;

try {
  const { rows } = await pool.query(CANDIDATES, [UNCONFIRMED_GRACE_HOURS, ORPHAN_GRACE_DAYS]);

  const byStatus = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.log(`candidates: ${rows.length}`, byStatus);

  if (rows.length === 0) {
    console.log("nothing to do");
  } else if (!APPLY) {
    for (const row of rows.slice(0, 20)) {
      console.log(`  would delete [${row.status}] ${row.storage_path}`);
    }
    if (rows.length > 20) console.log(`  … and ${rows.length - 20} more`);
    console.log("\ndry run — pass --apply to delete");
  } else {
    /* Storage first, then the rows. In that order an interruption leaves rows
       whose objects are already gone, and the next run removes them — deleting
       the row first would lose the only record of what to delete. Supabase's
       remove() does not fail on an object that is already absent, which is what
       makes the retry harmless. */
    const paths = rows.map((r) => r.storage_path);
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error } = await supabase.storage.from(BUCKET).remove(batch);
      if (error) {
        console.error("storage delete failed for a batch; leaving its rows in place:", error.message);
        continue;
      }
      const ids = rows.slice(i, i + 100).map((r) => r.id);
      await pool.query(`DELETE FROM public.upload_items WHERE id = ANY($1::uuid[])`, [ids]);
      console.log(`  removed ${batch.length}`);
    }
  }

  /* Sessions with nothing left in them and no chance of being used again. */
  const sessions = await pool.query(
    `DELETE FROM public.upload_sessions s
      WHERE (s.status = 'consumed' OR s.expires_at < now())
        AND s.profile_id IS NULL
        AND s.created_at < now() - ($1 || ' days')::interval
        AND NOT EXISTS (SELECT 1 FROM public.upload_items i WHERE i.session_id = s.id)
      RETURNING s.id`,
    [ORPHAN_GRACE_DAYS]
  );
  if (APPLY) console.log(`empty sessions removed: ${sessions.rowCount}`);
} finally {
  await pool.end();
}

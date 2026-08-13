/*
 * Rewrites stored public URLs to bucket-relative storage paths.
 *
 *   node --env-file=.env scripts/normalize-attachment-urls.mjs [--apply]
 *
 * Reports by default; changes nothing until --apply.
 *
 * Why: a private file referenced by a public URL stops resolving the moment the
 * bucket stops being public, and every one of those strings would have to be
 * rewritten under time pressure. A path says only where the object is; who may
 * see it is decided when it is asked for, by /api/attachments. Doing this first
 * makes the privacy change a bucket setting rather than a data migration.
 *
 * It converts nothing it cannot prove. Each candidate has to be an https URL on
 * this project's own storage host, carrying the public marker for the `uploads`
 * bucket, and to leave behind a path that survives validation — no traversal, no
 * encoded separators, and inside `usersData/` or `images/`. Anything else is
 * reported and left exactly as it is.
 *
 * No file is read, moved or deleted. Only the reference changes, and the mapping
 * back is deterministic:  <project>/storage/v1/object/public/uploads/<path>
 */

import pg from "pg";

const APPLY = process.argv.includes("--apply");
const BUCKET = "uploads";
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
const PRIVATE_PREFIX = "usersData/";
const PUBLIC_PREFIX = "images/";

/* The fields that hold attachments, current month and archived months alike. */
const FIELDS = [
  "analysis_file",
  "supplements_photo",
  "home_equipment_photo",
  "diet_history_file",
  "body_photos",
];

if (!process.env.DIRECT_URL || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("DIRECT_URL and NEXT_PUBLIC_SUPABASE_URL are required. Pass --env-file=.env");
  process.exit(1);
}

const expectedHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;

/** Mirrors isStoragePath in src/lib/attachments.ts. Keep the two in step. */
function isStoragePath(value) {
  if (typeof value !== "string" || !value || value.length > 512) return false;
  if (value.startsWith("/") || value.startsWith("\\")) return false;
  if (value.includes("..") || value.includes("\\") || value.includes("//")) return false;
  if (value.includes("%")) return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return false;
  }
  return value.startsWith(PRIVATE_PREFIX) || value.startsWith(PUBLIC_PREFIX);
}

function toStoragePath(value) {
  if (typeof value !== "string" || !value.includes(MARKER)) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  /* Bucket confusion: a URL on someone else's project, or another bucket, is not
     ours to rewrite. */
  if (url.hostname !== expectedHost) return null;

  const at = url.pathname.indexOf(MARKER);
  if (at === -1) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(url.pathname.slice(at + MARKER.length));
  } catch {
    return null;
  }
  return isStoragePath(decoded) ? decoded : null;
}

const stats = { converted: 0, alreadyPaths: 0, skipped: 0, profiles: 0 };
const skipped = [];

/** Walks one month's answers, returning a copy with the fields rewritten. */
function normalizeMonth(month) {
  if (!month || typeof month !== "object" || Array.isArray(month)) return month;
  const out = { ...month };

  for (const field of FIELDS) {
    const value = out[field];
    const rewriteOne = (entry) => {
      if (typeof entry !== "string") return entry;
      if (isStoragePath(entry)) { stats.alreadyPaths++; return entry; }
      const path = toStoragePath(entry);
      if (path) { stats.converted++; return path; }
      stats.skipped++;
      skipped.push(entry.slice(0, 120));
      return entry;
    };

    if (typeof value === "string") out[field] = rewriteOne(value);
    else if (Array.isArray(value)) out[field] = value.map(rewriteOne);
  }
  return out;
}

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

try {
  const { rows } = await pool.query("SELECT id, data FROM public.profiles ORDER BY created_at");

  for (const row of rows) {
    const blob = typeof row.data === "string" ? JSON.parse(row.data) : row.data ?? {};
    const before = JSON.stringify(blob);

    const next = normalizeMonth(blob);
    if (Array.isArray(next.history)) {
      next.history = next.history.map((entry) =>
        entry && typeof entry === "object" && entry.data && typeof entry.data === "object"
          ? { ...entry, data: normalizeMonth(entry.data) }
          : entry
      );
    }

    if (JSON.stringify(next) === before) continue;
    stats.profiles++;

    if (APPLY) {
      await pool.query("UPDATE public.profiles SET data = $2 WHERE id = $1", [row.id, next]);
    }
  }

  console.log(APPLY ? "APPLIED" : "DRY RUN", stats);
  if (skipped.length) {
    console.log("\nleft untouched (not a recognised address for this bucket):");
    for (const s of [...new Set(skipped)].slice(0, 10)) console.log("  ", s);
  }
  if (!APPLY && stats.profiles > 0) console.log("\npass --apply to write");
} finally {
  await pool.end();
}

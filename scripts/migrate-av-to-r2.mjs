/*
 * Copies the content manager's existing video and audio from Supabase to R2,
 * and points the landing content at the copies.
 *
 *   node --env-file=.env scripts/migrate-av-to-r2.mjs [--apply]
 *
 * Reports by default; changes nothing until --apply.
 *
 * Why: new testimonial clips are stored in R2 (see src/lib/r2.ts), which does
 * not charge for egress. The ones uploaded before that still sit in the public
 * Supabase bucket, and every play of them still counts against its quota.
 *
 * What it does, per file in `public-media/images/` whose stored type is video/*
 * or audio/*:
 *   1. downloads it from Supabase — this one read is the last egress it costs;
 *   2. uploads it to R2 as `media/<same file name>`, with the same type;
 *   3. reads the R2 copy's size back and stops if it differs.
 * Then every string in `site_settings.content_ar` equal to one of the old
 * addresses — current or pre-split `uploads` shape — is replaced by the new one.
 *
 * Nothing is deleted from Supabase. The old addresses keep working, so a page
 * still holding one in a cache plays exactly as before. The script ends by
 * listing the Supabase paths that are now safe to remove; removing them is a
 * separate decision.
 */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const APPLY = process.argv.includes("--apply");
const SUPABASE_BUCKET = "public-media";
const R2_PREFIX = "media/";
/* The shape `r2KeyOf` in src/lib/r2.ts accepts. A name outside it would upload
   fine and then be impossible to delete from the media library. */
const SAFE_NAME = /^[A-Za-z0-9_-]+\.[a-z0-9]+$/;

const REQUIRED = [
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
];
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}. Pass --env-file=.env`);
  process.exit(1);
}
if (!/^[0-9a-f]{32}$/.test(process.env.R2_ACCOUNT_ID)) {
  console.error("R2_ACCOUNT_ID must be the 32-character account id, not a URL.");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL.replace(/\/+$/, "");
const R2_BUCKET_URL = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}`;

const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const r2 = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const db = new pg.Client({ connectionString: process.env.DIRECT_URL });
await db.connect();

try {
  const { rows: objects } = await db.query(
    `select name, metadata->>'mimetype' as mime, (metadata->>'size')::bigint as size
       from storage.objects
      where bucket_id = $1
        and name like 'images/%'
        and (metadata->>'mimetype' like 'video/%' or metadata->>'mimetype' like 'audio/%')
      order by name`,
    [SUPABASE_BUCKET]
  );

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${objects.length} video/audio file(s) in ${SUPABASE_BUCKET}/images/\n`);

  /* old address -> new address */
  const moved = new Map();

  for (const object of objects) {
    const fileName = object.name.slice("images/".length);
    if (!SAFE_NAME.test(fileName)) {
      console.log(`  SKIP  ${object.name}  (name outside the shape the library can delete)`);
      continue;
    }

    const key = `${R2_PREFIX}${fileName}`;
    const newUrl = `${R2_PUBLIC_URL}/${key}`;
    const oldUrls = [
      `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${object.name}`,
      `${SUPABASE_URL}/storage/v1/object/public/uploads/${object.name}`,
    ];

    console.log(`  ${object.name}  (${object.mime}, ${Math.round(Number(object.size) / 1024)} KB)  ->  ${key}`);
    if (!APPLY) {
      for (const oldUrl of oldUrls) moved.set(oldUrl, newUrl);
      continue;
    }

    const { data: blob, error } = await supabase.storage.from(SUPABASE_BUCKET).download(object.name);
    if (error || !blob) throw new Error(`Download failed for ${object.name}: ${error?.message}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const put = await r2.fetch(`${R2_BUCKET_URL}/${key}`, {
      method: "PUT",
      body: bytes,
      headers: { "Content-Type": object.mime, "Cache-Control": "public, max-age=31536000, immutable" },
    });
    if (!put.ok) throw new Error(`R2 upload failed for ${key}: ${put.status} ${await put.text()}`);

    const head = await r2.fetch(`${R2_BUCKET_URL}/${key}`, { method: "HEAD" });
    const stored = Number(head.headers.get("content-length"));
    if (!head.ok || stored !== bytes.length) {
      throw new Error(`R2 copy of ${key} reads back ${stored} bytes, expected ${bytes.length}`);
    }

    for (const oldUrl of oldUrls) moved.set(oldUrl, newUrl);
  }

  /* Exact string matches only, anywhere in the document. */
  const { rows: settings } = await db.query(
    `select content_ar from public.site_settings where id = 'landing_content'`
  );
  const content = settings[0]?.content_ar ?? {};
  let replaced = 0;
  const rewrite = (value) => {
    if (typeof value === "string" && moved.has(value)) {
      replaced++;
      return moved.get(value);
    }
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
    }
    return value;
  };
  const updated = rewrite(content);

  console.log(`\n${replaced} reference(s) in site_settings.content_ar ${APPLY ? "rewritten" : "would be rewritten"}.`);

  if (APPLY && replaced > 0) {
    await db.query(
      `update public.site_settings set content_ar = $1, updated_at = now() where id = 'landing_content'`,
      [JSON.stringify(updated)]
    );
  }

  if (APPLY && objects.length) {
    console.log("\nCopied, and still in Supabase (safe to delete once the site is checked):");
    for (const object of objects) {
      if (SAFE_NAME.test(object.name.slice("images/".length))) console.log(`  ${SUPABASE_BUCKET}/${object.name}`);
    }
  }

  if (!APPLY) console.log("\nNothing changed. Run again with --apply.");
} finally {
  await db.end();
}

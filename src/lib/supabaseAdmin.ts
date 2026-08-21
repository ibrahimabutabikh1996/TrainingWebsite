import "server-only";
import { createClient } from "@supabase/supabase-js";

/* The storage client that holds the service key.
 *
 * Server only, and the `server-only` import above is what enforces it: pulling
 * this into anything that reaches the browser fails the build rather than
 * shipping the key to visitors.
 *
 * It was being constructed separately in the registration handler and in the
 * content manager, with a third copy about to appear for attachment deletion —
 * three places to keep in step over one credential. One client now, imported.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/* Two buckets, because the files fall into two kinds with opposite rules.
 *
 * They used to share one. `uploads` was public, which is what page imagery
 * needs — the landing page has to render for a visitor who has no session —
 * and it is exactly what a trainee's payment receipt, body photographs and
 * medical analyses must not be. Supabase's `public` flag is a property of the
 * bucket, not of a prefix inside it, so one bucket could not be both: an
 * anonymous caller could read, list and delete a real trainee's file, which a
 * test demonstrated on a real object.
 *
 * So the page imagery moved out and the trainee files stayed. That direction
 * was deliberate — the upload pipeline is wired to `uploads` in the client's
 * request, in the signed token, in `upload_items.storage_path` and in the paths
 * stored in `profiles.data`, and moving those would have meant rewriting every
 * one of them.
 */

/** Trainee uploads. Private: reached only through a signed URL the server issues. */
export const UPLOADS_BUCKET = "uploads";

/** Page imagery the content manager writes. Public by design — visitors have no session. */
export const PUBLIC_MEDIA_BUCKET = "public-media";

/** The marker that separates a public address from the path inside the bucket. */
export const STORAGE_PUBLIC_MARKER = `/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/`;

/* The address shape the CMS wrote before the split. Still recognised so that a
   value stored then can be resolved now — see `storagePathOf`. */
const LEGACY_PUBLIC_MARKER = "/storage/v1/object/public/uploads/";

/**
 * The path inside the bucket for a public address, or null when the address does
 * not belong to this project's storage — someone else's file is not ours to touch.
 *
 * Accepts the pre-split address as well: a row written before the CMS media
 * moved still carries `/object/public/uploads/…`, and the path inside it is the
 * same one, so it resolves without a rewrite.
 */
export function storagePathOf(publicUrl: string): string | null {
  for (const marker of [STORAGE_PUBLIC_MARKER, LEGACY_PUBLIC_MARKER]) {
    if (publicUrl.includes(marker)) {
      const path = publicUrl.split(marker)[1];
      return path ? decodeURIComponent(path) : null;
    }
  }
  return null;
}

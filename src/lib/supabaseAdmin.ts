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

/** Everything the trainees and the coach upload lives in this one bucket. */
export const UPLOADS_BUCKET = "uploads";

/** The marker that separates a public address from the path inside the bucket. */
export const STORAGE_PUBLIC_MARKER = "/storage/v1/object/public/uploads/";

/**
 * The path inside the bucket for a public address, or null when the address does
 * not belong to this project's bucket — someone else's file is not ours to touch.
 */
export function storagePathOf(publicUrl: string): string | null {
  if (!publicUrl.includes(STORAGE_PUBLIC_MARKER)) return null;
  const path = publicUrl.split(STORAGE_PUBLIC_MARKER)[1];
  return path ? decodeURIComponent(path) : null;
}

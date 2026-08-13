/* How a stored file is referred to, and how it gets on screen.
 *
 * Two shapes exist in `profiles.data` and both have to keep working:
 *
 *   legacy   a full public URL, written before uploads were normalised
 *   current  a bucket-relative storage path, e.g. usersData/<session>/body_photos_x
 *
 * A public URL is a poor thing to store for a private file. It hard-codes the
 * project's hostname and the word "public" into the trainee's record, so the day
 * the bucket stops being public every one of those strings is a dead link. A path
 * says only where the object is; who may see it, and for how long, is decided
 * when it is asked for.
 *
 * `attachmentSrc` is what every render site should use. It passes a legacy URL
 * through unchanged — those still resolve while the bucket is public — and turns
 * a path into a request to `/api/attachments`, which authorises and redirects to
 * a short-lived signed URL. Nothing has to change again when the bucket flips.
 *
 * Shared by client and server, so nothing server-only may be imported here.
 */

/** The one bucket this project writes to. */
export const UPLOADS_BUCKET_NAME = "uploads";

/** Marks a public address for that bucket. */
export const STORAGE_PUBLIC_MARKER = `/storage/v1/object/public/${UPLOADS_BUCKET_NAME}/`;

/** Where private, trainee-owned files live. */
export const PRIVATE_PREFIX = "usersData/";

/** Where public, coach-managed page imagery lives. */
export const PUBLIC_PREFIX = "images/";

/**
 * Whether `value` is a storage path this project would have written.
 *
 * Rejects anything that could climb out of its prefix or address a different
 * bucket: a leading slash, `..` in any position, backslashes, percent-escapes
 * that could decode into either, and control characters. A path that does not
 * begin with one of the two known prefixes is not ours.
 */
/* Not a `value is string` predicate on purpose: callers pass an already-narrowed
   string, and a type guard there would narrow the *false* branch to `never`. */
export function isStoragePath(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return false;
  if (value.startsWith("/") || value.startsWith("\\")) return false;
  if (value.includes("..") || value.includes("\\")) return false;
  if (value.includes("//")) return false;
  /* No percent-escapes: a path is stored decoded, so an escape here can only be
     an attempt to smuggle one of the characters rejected above. */
  if (value.includes("%")) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return value.startsWith(PRIVATE_PREFIX) || value.startsWith(PUBLIC_PREFIX);
}

/** Whether the path is a trainee-owned file, as opposed to public page imagery. */
export function isPrivatePath(value: string): boolean {
  return value.startsWith(PRIVATE_PREFIX);
}

/**
 * The address to put in `src` / `href` for a stored reference.
 *
 * Legacy full URLs are returned unchanged. Paths become a request to the
 * authorising reader. Anything unrecognised returns null, and the caller renders
 * nothing rather than an attacker-chosen address.
 */
export function attachmentSrc(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();

  if (isStoragePath(trimmed)) {
    return `/api/attachments?path=${encodeURIComponent(trimmed)}`;
  }

  /* Legacy: a public address for this project's own bucket, and nothing else —
     a stored string pointing somewhere unexpected is not something to render. */
  if (trimmed.includes(STORAGE_PUBLIC_MARKER) && /^https:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * The storage path behind a legacy public URL, or null if the URL is not one of
 * this project's.
 *
 * Used by the normalisation pass. Validates the whole shape rather than slicing
 * on the marker and hoping: the host has to be the project's storage host, the
 * marker has to be present, and what follows has to survive `isStoragePath`
 * after decoding — which is where a `..` or an encoded slash is caught.
 */
export function storagePathFromPublicUrl(
  value: unknown,
  expectedHost?: string
): string | null {
  if (typeof value !== "string" || !value.includes(STORAGE_PUBLIC_MARKER)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (expectedHost && parsed.hostname !== expectedHost) return null;

  const index = parsed.pathname.indexOf(STORAGE_PUBLIC_MARKER);
  if (index === -1) return null;

  const raw = parsed.pathname.slice(index + STORAGE_PUBLIC_MARKER.length);
  if (!raw) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  return isStoragePath(decoded) ? decoded : null;
}

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

/** Trainee uploads. Private — reached only through `/api/attachments`. */
export const UPLOADS_BUCKET_NAME = "uploads";

/** Page imagery the content manager writes. Public, and read at its own address. */
export const PUBLIC_MEDIA_BUCKET_NAME = "public-media";

/** Marks a public address for the media bucket. */
export const STORAGE_PUBLIC_MARKER = `/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET_NAME}/`;

/* The shape written before the two buckets were split. Recognised so a value
   stored then still resolves — `attachmentSrc` and `storagePathFromPublicUrl`
   both accept it. */
export const LEGACY_PUBLIC_MARKER = `/storage/v1/object/public/${UPLOADS_BUCKET_NAME}/`;

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

  /* A public address for the media bucket — page imagery the content manager
     wrote — is returned as it stands, because that bucket really is public. */
  if (trimmed.includes(STORAGE_PUBLIC_MARKER) && /^https:\/\//i.test(trimmed)) {
    return trimmed;
  }

  /* A public address for the *uploads* bucket is a different case, and this
     used to be returned unchanged alongside the one above, on a comment that
     said such values "still resolve while the bucket is public". The bucket is
     not public any more, so the address is dead while the path inside it is
     still perfectly good. Read the path out and ask the reader for it, exactly
     as a stored path would.

     No row holds one of these today — the normalisation pass rewrote them all,
     and the database was checked. This is here so that a value restored from an
     older backup renders instead of breaking. */
  if (trimmed.includes(LEGACY_PUBLIC_MARKER) && /^https:\/\//i.test(trimmed)) {
    const path = pathAfterMarker(trimmed, LEGACY_PUBLIC_MARKER);
    return path ? `/api/attachments?path=${encodeURIComponent(path)}` : null;
  }

  return null;
}

/**
 * The storage path following `marker` in a URL, or null.
 *
 * Validated rather than sliced: the address has to parse, and what follows the
 * marker has to survive `isStoragePath` once decoded — which is where a `..` or
 * an encoded slash is caught, before the value is handed to anything.
 */
function pathAfterMarker(value: string, marker: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  const index = parsed.pathname.indexOf(marker);
  if (index === -1) return null;

  const raw = parsed.pathname.slice(index + marker.length);
  if (!raw) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  return isStoragePath(decoded) ? decoded : null;
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

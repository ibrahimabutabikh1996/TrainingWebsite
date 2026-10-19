import "server-only";
import { AwsClient } from "aws4fetch";

/* Cloudflare R2, for the testimonial video and audio the content manager stores.
 *
 * They used to sit in the public Supabase bucket beside the page imagery, and
 * every play on the home page counted against Supabase's egress quota — the
 * free plan's ceiling was passed by visitors watching testimonials. R2 does not
 * charge for egress at all, so the files that are large and played whole live
 * here and the pictures stay where they were.
 *
 * R2 speaks the S3 API, and `aws4fetch` is the smallest thing that signs a
 * request for it: one dependency over `fetch`, no SDK.
 *
 * Server only, for the same reason as `@/lib/supabaseAdmin`: the secret key is
 * here, and the `server-only` import fails the build rather than ship it.
 */

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
const BUCKET = process.env.R2_BUCKET ?? "";
/** Where visitors read the objects from — the bucket's custom domain. */
const PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");

const client = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  service: "s3",
  region: "auto",
});

const BUCKET_URL = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}`;

/** The only prefix a public address may resolve into — see `r2KeyOf`. */
export const R2_MEDIA_PREFIX = "media/";

/** `/` separates segments and must survive; everything else is escaped. */
const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

const objectUrl = (key: string) => `${BUCKET_URL}/${encodeKey(key)}`;

/**
 * A URL the browser may PUT one object to, for the next `expiresSeconds`.
 *
 * The content type is deliberately not part of the signature: what the object
 * really is gets decided from its bytes when it is confirmed, not from what the
 * browser said while sending it.
 */
export async function r2PresignedPut(key: string, expiresSeconds = 600): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await client.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
  return signed.url;
}

export function r2Get(key: string): Promise<Response> {
  return client.fetch(objectUrl(key));
}

export async function r2Put(
  key: string,
  body: Uint8Array,
  contentType: string,
  cacheControl: string
): Promise<{ error: string | null }> {
  const response = await client.fetch(objectUrl(key), {
    method: "PUT",
    /* A Node Buffer is typed over `ArrayBufferLike`, which `fetch`'s types
       refuse; at runtime it is an ordinary ArrayBuffer view. Copying a 50 MB
       clip just to satisfy the type is not worth it. */
    body: body as Uint8Array<ArrayBuffer>,
    headers: { "Content-Type": contentType, "Cache-Control": cacheControl },
  });
  return { error: response.ok ? null : `R2 PUT ${key} answered ${response.status}` };
}

export async function r2Delete(key: string): Promise<{ error: string | null }> {
  const response = await client.fetch(objectUrl(key), { method: "DELETE" });
  /* 204 is the normal answer, and also the answer for a key that was never there. */
  return { error: response.ok ? null : `R2 DELETE ${key} answered ${response.status}` };
}

export interface R2Object {
  key: string;
  lastModified: string;
}

/**
 * Up to 1000 objects under `prefix`, in key order, and whether there are more.
 *
 * One page is enough for a library of testimonial clips; the caller reports
 * `truncated` rather than pretending the list ended.
 */
export async function r2List(prefix: string): Promise<{ objects: R2Object[]; truncated: boolean }> {
  const url = new URL(BUCKET_URL);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", prefix);
  url.searchParams.set("max-keys", "1000");

  const response = await client.fetch(url);
  if (!response.ok) throw new Error(`R2 list ${prefix} answered ${response.status}`);

  /* The ListObjectsV2 answer is a flat XML document. Keys written by this app
     are `media/cms_<time>_<hex>.<ext>`, so nothing in them needs unescaping. */
  const xml = await response.text();
  const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, entry]) => ({
    key: entry.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? "",
    lastModified: entry.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] ?? "",
  }));

  return {
    objects: objects.filter((object) => object.key),
    truncated: /<IsTruncated>true<\/IsTruncated>/.test(xml),
  };
}

export function r2PublicUrl(key: string): string {
  return `${PUBLIC_URL}/${encodeKey(key)}`;
}

/**
 * The key for a public R2 address, or null when it is not one of ours.
 *
 * Only keys under `media/` with the characters `storageFilename` produces: an
 * address that resolves anywhere else in the bucket is not something the
 * content manager wrote, and is not its to delete.
 */
export function r2KeyOf(publicUrl: string): string | null {
  if (!PUBLIC_URL || !publicUrl.startsWith(`${PUBLIC_URL}/`)) return null;
  const key = publicUrl.slice(PUBLIC_URL.length + 1);
  return /^media\/[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(key) ? key : null;
}

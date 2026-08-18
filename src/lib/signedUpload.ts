"use client";

import { UploadTransportError, xhrUpload } from "@/lib/xhrUpload";

/* Sending a file to the address the server signed for it, and being able to say
 * how far it has got.
 *
 * `supabase.storage.uploadToSignedUrl(...)` did this before and still does it
 * here as the fallback. What it cannot do is report progress: it is built on
 * `fetch`, and a fetch request body has no progress event. So the same request
 * is issued directly instead — same method, same URL, same body shape, same
 * headers — through `XMLHttpRequest`, which does report.
 *
 * The request below mirrors `StorageFileApi.uploadToSignedUrl` in
 * @supabase/storage-js as installed: PUT to /object/upload/sign/<bucket>/<path>
 * with the token in the query, a multipart body carrying `cacheControl` and the
 * file under the empty name, and `x-upsert`. If that package is ever upgraded
 * and the shape moves, this stops working and the fallback below is what keeps
 * the form usable — which is the reason the fallback exists.
 *
 * The fallback is entered on a transport failure only, never on a refusal. A
 * server that answered "no" has already made its decision, and a token bound to
 * one object with `upsert: false` will not accept a second attempt anyway; the
 * only safely repeatable case is the one where nothing arrived at all.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Matches the storage client's own default; the objects here are addressed by a unique name. */
const CACHE_CONTROL = "3600";

/** `/` separates segments and must survive; everything else is escaped. */
const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export interface SignedUploadOptions {
  bucket: string;
  /** Named by the server. The token is bound to this exact object. */
  path: string;
  token: string;
  file: File;
  onProgress: (percent: number) => void;
}

export async function uploadToSignedUrlWithProgress({
  bucket,
  path,
  token,
  file,
  onProgress,
}: SignedUploadOptions): Promise<void> {
  const url =
    `${SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${encodePath(path)}` +
    `?token=${encodeURIComponent(token)}`;

  const body = new FormData();
  body.append("cacheControl", CACHE_CONTROL);
  /* The empty field name is what the storage client sends and what the endpoint
     reads the object from. It is not a mistake. */
  body.append("", file);

  try {
    const response = await xhrUpload({
      url,
      method: "PUT",
      body,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "x-upsert": "false",
      },
      onProgress,
    });

    if (response.status >= 200 && response.status < 300) return;
    throw new Error(`Signed upload refused with status ${response.status}`);
  } catch (error) {
    if (!(error instanceof UploadTransportError)) throw error;

    /* Nothing reached storage, so this is a first attempt rather than a second. */
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(path, token, file, {
        /* Declared honestly from the browser's own reading of the file. The
           server compares it with the bytes and refuses a disagreement. */
        contentType: file.type || "application/octet-stream",
      });
    if (uploadError) throw new Error("تعذّر رفع الملف");
  }
}

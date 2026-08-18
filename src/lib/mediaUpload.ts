"use client";

import { DEFAULT_MAX_EDGE } from "@/lib/cropUtils";
import { compressForUpload } from "@/lib/imageUpload";
import { beginUpload } from "@/lib/uploadProgress";
import { parseJsonBody, xhrUpload } from "@/lib/xhrUpload";

/* The coach's side of an upload: prepare the picture, send it, report the whole
 * journey to the window.
 *
 * Two screens do this — the content manager, including its media library and
 * testimonials editor, and the nutrition library — and they used to do it
 * differently. The content manager compressed with a progress callback and then
 * counted to ninety on a `setInterval` while the request was in flight; the
 * nutrition form did neither and showed a disabled button. Both now go through
 * here, so the number on screen is the same number in both places and it is a
 * measurement rather than an estimate.
 *
 * Compression is the first fifteen percent of the bar and the transfer is the
 * rest — see `@/lib/uploadProgress` for why the transfer stops just short of a
 * hundred until the server has answered.
 */

interface MediaUploadOptions {
  /** Longest edge to keep, in pixels. Sized by the surface the image lands on. */
  maxEdge?: number;
  /** Shown in the window instead of the file's own name — a cropped file has none worth reading. */
  displayName?: string;
}

/**
 * Compresses `file` if it is an image, stores it, and returns its public
 * address — or null if anything refused it, having already said so in the
 * window.
 */
export async function uploadMediaWithProgress(
  file: File,
  { maxEdge = DEFAULT_MAX_EDGE, displayName }: MediaUploadOptions = {}
): Promise<string | null> {
  const task = beginUpload(displayName || file.name, file.size);

  try {
    /* Non-images come back untouched — `CMS_MEDIA_RULE` also allows video and
       audio for testimonials, and compressing those would mangle them. */
    const prepared = await compressForUpload(file, maxEdge, (percent: number) =>
      task.preparing(percent)
    );
    task.preparing(100);

    const body = new FormData();
    body.append("file", prepared);

    const response = await xhrUpload({
      url: "/api/admin/media",
      method: "POST",
      body,
      onProgress: (percent) => task.uploading(percent),
    });

    const parsed = parseJsonBody<{ url?: string; error?: string }>(response.body);

    if (response.status >= 200 && response.status < 300 && parsed?.url) {
      task.done();
      return parsed.url;
    }

    task.fail(parsed?.error ?? "تعذّر رفع الملف");
    return null;
  } catch (error) {
    console.error("Media upload failed:", error);
    task.fail(error instanceof Error ? error.message : "تعذّر رفع الملف");
    return null;
  }
}

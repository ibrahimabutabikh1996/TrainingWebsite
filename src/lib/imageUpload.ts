"use client";

/* Getting a picture ready to be stored.
 *
 * Two screens send images to the bucket — the content manager and the nutrition
 * library — and until now only one of them prepared the file first. The content
 * manager compressed; the nutrition form took `e.target.files[0]` and posted it
 * exactly as the camera wrote it. A modern phone photo is 4–8 MB and several
 * thousand pixels on the long edge, and the largest box any of these images is
 * ever drawn in is 56 pixels.
 *
 * The rule the two screens now share: resize first, then trim quality only as
 * far as the size budget demands. That order is what keeps a picture looking
 * like itself — dropping quality on an oversized image spends bytes on detail
 * the screen will throw away, and still looks worse.
 */

import imageCompression from "browser-image-compression";
import { DEFAULT_MAX_EDGE } from "@/lib/cropUtils";

/**
 * A size ceiling rather than a target. A JPEG at `maxEdge` and this quality
 * lands well under it; the number exists so a pathological source (a huge flat
 * PNG, a scan) cannot sail past.
 */
const MAX_UPLOAD_MB = 0.6;

/** Above this the file grows quickly and stops looking different. */
const QUALITY = 0.85;

/**
 * Resizes and compresses `file` for storage.
 *
 * Non-images are returned untouched: `CMS_MEDIA_RULE` also allows video and
 * audio for testimonials, and this must not mangle them. The server checks what
 * the bytes really are either way — see `checkUpload` in `@/lib/uploads`.
 *
 * A compression failure returns the original rather than throwing. The upload
 * is still bounded on the server, so the worst case is one large object stored,
 * not a coach who cannot add a picture.
 */
export async function compressForUpload(
  file: File,
  maxEdge: number = DEFAULT_MAX_EDGE,
  onProgress?: (percent: number) => void
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    return (await imageCompression(file, {
      maxSizeMB: MAX_UPLOAD_MB,
      maxWidthOrHeight: maxEdge,
      useWebWorker: true,
      initialQuality: QUALITY,
      ...(onProgress ? { onProgress } : {}),
    })) as File;
  } catch (error) {
    console.warn("Could not compress the image; uploading it as it is.", error);
    return file;
  }
}

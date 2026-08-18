import "server-only";
import { supabaseAdmin, UPLOADS_BUCKET } from "@/lib/supabaseAdmin";
import { checkUpload, CMS_MEDIA_RULE, storageFilename } from "@/lib/uploads";

/**
 * Stores one file for the coach and hands back its public address.
 *
 * This is the body of what `uploadImageServer` in `@/app/admin/cms/actions.ts`
 * has always done. It moved here so that the server action and the upload
 * endpoint the browser can report progress against — `POST /api/admin/media` —
 * are the same code rather than two copies drifting apart. Neither of them
 * decides anything about who may call: both check for the coach first, and this
 * function is reached only after that.
 *
 * Everything about the stored object is decided from the bytes rather than from
 * the request, and each half of that used to be a separate way in:
 *
 *   the extension came from `file.name.split('.').pop()`, so a file named
 *   `logo.png.html` was written as `.html` — into a bucket served publicly, on
 *   the project's own Supabase domain;
 *
 *   `contentType` came from `file.type`, which the browser is told by the
 *   client, so the same object could be served back as `text/html` and run as a
 *   page in the visitor's session;
 *
 *   and nothing checked the size or the format at all, so the only ceiling was
 *   the server-action body limit.
 *
 * `checkUpload` and `storageFilename` in `@/lib/uploads` answer all of it —
 * including `CMS_MEDIA_RULE`, written for this screen.
 */

export type StoredMedia = { ok: true; url: string } | { ok: false; error: string };

export async function storeCmsMedia(file: File): Promise<StoredMedia> {
  try {
    const checked = await checkUpload(file, CMS_MEDIA_RULE);
    if (!checked.ok) {
      console.warn(`CMS upload refused: ${checked.error}`);
      /* The caller's own words go back to the browser: they name the real
         reason — a type that is not allowed, a file over the ceiling — and the
         person choosing the file is the one who can act on it. */
      return { ok: false, error: checked.error };
    }

    /* Name and extension built here, from what the bytes turned out to be.
       Nothing of the submitted filename survives. */
    const filePath = `images/${storageFilename("cms", checked.file)}`;

    const { error } = await supabaseAdmin.storage
      .from(UPLOADS_BUCKET)
      .upload(filePath, checked.bytes, {
        /* An hour was the old value and it is short for content addressed by a
           unique name: the name changes when the file does, so the object at
           this address never will. A year lets the browser and any CDN in front
           of it stop asking. */
        cacheControl: "31536000",
        upsert: false,
        contentType: checked.file.mime,
      });

    if (error) {
      console.error("Error uploading image securely:", error);
      return { ok: false, error: "تعذّر حفظ الملف في المخزن" };
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(UPLOADS_BUCKET)
      .getPublicUrl(filePath);

    return { ok: true, url: publicUrlData.publicUrl };
  } catch (error) {
    console.error("Exception during secure image upload:", error);
    return { ok: false, error: "حدث خطأ أثناء رفع الملف" };
  }
}

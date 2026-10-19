import "server-only";
import { supabaseAdmin, PUBLIC_MEDIA_BUCKET } from "@/lib/supabaseAdmin";
import { checkUpload, CMS_MEDIA_RULE, storageFilename } from "@/lib/uploads";
import { r2Delete, r2Get, r2PresignedPut, r2PublicUrl, r2Put, R2_MEDIA_PREFIX } from "@/lib/r2";

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

    /* Video and audio go to R2, decided here from the bytes rather than from
       which route the file came by — see `@/lib/r2` for why. */
    if (/^(video|audio)\//.test(checked.file.mime)) {
      const key = `${R2_MEDIA_PREFIX}${storageFilename("cms", checked.file)}`;
      const { error } = await r2Put(key, checked.bytes, checked.file.mime, "public, max-age=31536000, immutable");
      if (error) {
        console.error("Error uploading media to R2:", error);
        return { ok: false, error: "تعذّر حفظ الملف في المخزن" };
      }
      return { ok: true, url: r2PublicUrl(key) };
    }

    /* Name and extension built here, from what the bytes turned out to be.
       Nothing of the submitted filename survives. */
    const filePath = `images/${storageFilename("cms", checked.file)}`;

    const { error } = await supabaseAdmin.storage
      .from(PUBLIC_MEDIA_BUCKET)
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
      .from(PUBLIC_MEDIA_BUCKET)
      .getPublicUrl(filePath);

    return { ok: true, url: publicUrlData.publicUrl };
  } catch (error) {
    console.error("Exception during secure image upload:", error);
    return { ok: false, error: "حدث خطأ أثناء رفع الملف" };
  }
}

/* A file too large for one request — a testimonial video above Vercel's ~4.5 MB
 * body limit — goes from the browser straight to storage instead, in two steps
 * around that transfer: `issueCmsMediaSlot` names where it may land, and
 * `confirmCmsMedia` reads it back and stores it through `storeCmsMedia`, so it
 * passes the same checks and gets the same name and type as any other upload.
 *
 * The waiting copy sits under `pending/`, outside `images/`, so the media
 * library — which lists `images` — never shows a file nobody has checked yet. */
const PENDING_PREFIX = "pending/";
const PENDING_PATH = /^pending\/cms_\d+_[0-9a-f]{8}$/;

/* A pending copy is confirmed seconds after its upload completes. One older
   than this is one whose confirm never came — a tab closed in between. */
const PENDING_GRACE_MS = 60 * 60 * 1000;

/* Which store the waiting copy goes to: Supabase for a picture, R2 for video
   and audio, so a testimonial clip never passes through Supabase at all — not
   even for the read-back below. The browser says which from the file's type;
   `storeCmsMedia` still decides where the kept copy lives from its bytes. R2's
   `pending/` is emptied by a lifecycle rule on the bucket, not by
   `removeStalePending`. */
export type CmsMediaTarget = "image" | "av";

export type CmsMediaSlot =
  | { ok: true; bucket: string; path: string; token: string }
  | { ok: true; path: string; uploadUrl: string }
  | { ok: false; error: string };

/* Nothing else visits `pending/`, so each new upload clears what earlier ones
   left behind. A failure here is logged and the upload goes on regardless. */
async function removeStalePending(): Promise<void> {
  const { data, error } = await supabaseAdmin.storage
    .from(PUBLIC_MEDIA_BUCKET)
    .list("pending", { limit: 100, sortBy: { column: "created_at", order: "asc" } });

  if (error || !data) {
    console.error("Failed to list pending CMS uploads:", error);
    return;
  }

  const cutoff = Date.now() - PENDING_GRACE_MS;
  const stale = data
    .filter((object) => object.created_at && Date.parse(object.created_at) < cutoff)
    .map((object) => `${PENDING_PREFIX}${object.name}`)
    .filter((path) => PENDING_PATH.test(path));

  if (stale.length === 0) return;

  const { error: removeError } = await supabaseAdmin.storage.from(PUBLIC_MEDIA_BUCKET).remove(stale);
  if (removeError) {
    console.error("Failed to delete stale pending CMS uploads:", removeError);
  }
}

export async function issueCmsMediaSlot(target: CmsMediaTarget = "image"): Promise<CmsMediaSlot> {
  const path = `${PENDING_PREFIX}cms_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  if (target === "av") {
    try {
      return { ok: true, path, uploadUrl: await r2PresignedPut(path) };
    } catch (error) {
      console.error("Failed to sign an R2 CMS upload URL:", error);
      return { ok: false, error: "تعذّر تجهيز الرفع" };
    }
  }

  await removeStalePending().catch((error) =>
    console.error("Exception while clearing pending CMS uploads:", error)
  );

  const { data, error } = await supabaseAdmin.storage
    .from(PUBLIC_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("Failed to create a signed CMS upload URL:", error);
    return { ok: false, error: "تعذّر تجهيز الرفع" };
  }

  return { ok: true, bucket: PUBLIC_MEDIA_BUCKET, path, token: data.token };
}

export async function confirmCmsMedia(path: string, target: CmsMediaTarget = "image"): Promise<StoredMedia> {
  /* Only a path `issueCmsMediaSlot` could have named. */
  if (!PENDING_PATH.test(path)) {
    return { ok: false, error: "الملف غير موجود" };
  }

  if (target === "av") {
    try {
      const response = await r2Get(path);
      if (!response.ok) {
        return { ok: false, error: "لم يُعثر على الملف المرفوع" };
      }

      /* The signed URL bounds nothing about size, so it is checked here before
         the body is read into memory, not after. */
      if (Number(response.headers.get("content-length") ?? 0) > CMS_MEDIA_RULE.maxBytes) {
        await response.body?.cancel();
        return {
          ok: false,
          error: `حجم الملف يتجاوز الحد المسموح (${Math.round(CMS_MEDIA_RULE.maxBytes / (1024 * 1024))} ميغابايت)`,
        };
      }

      return await storeCmsMedia(new File([await response.arrayBuffer()], "upload"));
    } finally {
      const { error } = await r2Delete(path);
      if (error) {
        console.error(`Failed to delete a pending R2 upload (${path}):`, error);
      }
    }
  }

  try {
    const { data: blob, error } = await supabaseAdmin.storage
      .from(PUBLIC_MEDIA_BUCKET)
      .download(path);

    if (error || !blob) {
      return { ok: false, error: "لم يُعثر على الملف المرفوع" };
    }

    return await storeCmsMedia(new File([blob], "upload"));
  } finally {
    /* Kept or refused, the waiting copy goes: what is kept now lives under `images/`. */
    const { error } = await supabaseAdmin.storage.from(PUBLIC_MEDIA_BUCKET).remove([path]);
    if (error) {
      console.error(`Failed to delete a pending CMS upload (${path}):`, error);
    }
  }
}

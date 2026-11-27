"use server";

import { PLACEHOLDER_IMAGE } from "@/lib/placeholderImage";
import type { JsonRecord } from "@/types";
import { prisma } from "@/lib/db";
import { requireAdminAction } from "@/lib/authGuard";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, PUBLIC_MEDIA_BUCKET, storagePathOf } from "@/lib/supabaseAdmin";
import { storeCmsMedia } from "@/lib/cmsMedia";
import { r2Delete, r2KeyOf, r2List, r2PublicUrl, R2_MEDIA_PREFIX } from "@/lib/r2";

/* These run against the service-role Supabase client, which is above every
   storage policy — so the only thing standing between a caller and the bucket
   is the check at the top of each action. Unguarded, `uploadImageServer` was an
   open write to the project's storage and `saveLandingContent` was an open edit
   to the public home page.
 *
 * `getLandingContent` is deliberately left open: it returns the text and images
 * the landing page shows every visitor anyway. */

/**
 * How much the landing content may weigh, serialised.
 *
 * Every field on this screen is a sentence, a URL or a short list, and the whole
 * document as it stands is a few kilobytes. There was no ceiling at all: a
 * server action is a public endpoint whatever the form around it looks like, so
 * whatever arrived went into a jsonb column, and that column is read and parsed
 * on every render of the home page. Half a megabyte is far above any real
 * document and far below anything that would hurt.
 */
const MAX_CONTENT_BYTES = 512 * 1024;

/**
 * The row the content manager keeps its unpublished draft in.
 *
 * Same table, its own id, so it needs no migration and is never read by the
 * home page — `/` asks for `landing_content` by id and nothing else. Publishing
 * removes it: once the draft is what visitors see, there is no draft left.
 */
const DRAFT_ID = "landing_draft";

/** The shape and size checks both writes share. Null when the content is usable. */
function contentProblem(contentAr: JsonRecord): string | null {
  /* A plain object, and only a plain object. An array or a primitive would be
     stored happily by jsonb and then read back by the landing page as content
     it cannot walk. */
  if (typeof contentAr !== "object" || contentAr === null || Array.isArray(contentAr)) {
    return "صيغة المحتوى غير صحيحة";
  }
  if (JSON.stringify(contentAr).length > MAX_CONTENT_BYTES) {
    return "حجم المحتوى يتجاوز الحد المسموح";
  }
  return null;
}

export async function saveLandingContent(contentAr: JsonRecord) {
  if (!(await requireAdminAction("cms.edit"))) {
    return { success: false, error: "غير مصرح لك بهذا الإجراء" };
  }

  const problem = contentProblem(contentAr);
  if (problem) return { success: false, error: problem };

  try {
    /* Published and the draft cleared in one step, so a failure leaves both
       rows as they were rather than a published page with a stale draft. */
    await prisma.$transaction([
      prisma.site_settings.upsert({
        where: { id: "landing_content" },
        update: {
          content_ar: contentAr,
        },
        create: {
          id: "landing_content",
          content_ar: contentAr,
        },
      }),
      prisma.site_settings.deleteMany({ where: { id: DRAFT_ID } }),
    ]);

    // Revalidate the home page so the changes reflect immediately
    revalidatePath("/");
    
    return { success: true };
  } catch (error) {
    console.error("Failed to save landing content:", error);
    return { success: false, error: "تعذّر حفظ المحتوى" };
  }
}

export async function getLandingContent() {
  try {
    const settings = await prisma.site_settings.findUnique({
      where: { id: "landing_content" },
    });
    return settings;
  } catch (error) {
    console.error("Failed to fetch landing content:", error);
    return null;
  }
}

/**
 * Keeps the coach's edits without showing them to anyone.
 *
 * Written to its own row, so the home page — which reads `landing_content`
 * alone — is untouched, and the draft survives a closed tab or a second device.
 */
export async function saveLandingDraft(contentAr: JsonRecord) {
  if (!(await requireAdminAction("cms.edit"))) {
    return { success: false, error: "غير مصرح لك بهذا الإجراء" };
  }

  const problem = contentProblem(contentAr);
  if (problem) return { success: false, error: problem };

  try {
    await prisma.site_settings.upsert({
      where: { id: DRAFT_ID },
      update: { content_ar: contentAr },
      create: { id: DRAFT_ID, content_ar: contentAr },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to save landing draft:", error);
    return { success: false, error: "تعذّر حفظ المسودة" };
  }
}

/** The saved draft, or null when there is none. Never sent to a visitor. */
export async function getLandingDraft(): Promise<JsonRecord | null> {
  if (!(await requireAdminAction("cms.view"))) return null;

  try {
    const row = await prisma.site_settings.findUnique({ where: { id: DRAFT_ID } });
    const value = row?.content_ar;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
  } catch (error) {
    console.error("Failed to fetch landing draft:", error);
    return null;
  }
}

/** Throws the draft away; the published page is left exactly as it is. */
export async function discardLandingDraft() {
  if (!(await requireAdminAction("cms.edit"))) {
    return { success: false, error: "غير مصرح لك بهذا الإجراء" };
  }

  try {
    await prisma.site_settings.deleteMany({ where: { id: DRAFT_ID } });
    return { success: true };
  } catch (error) {
    console.error("Failed to discard landing draft:", error);
    return { success: false, error: "تعذّر حذف المسودة" };
  }
}

/**
 * Stores one file for the content manager and hands back its public address.
 *
 * The work itself is `storeCmsMedia` in `@/lib/cmsMedia`, which the panel's
 * upload endpoint calls too — `POST /api/admin/media`. It moved there when that
 * endpoint was added, so that the two ways a file can arrive stay one
 * implementation; the comment on it describes what the checks are for.
 *
 * This action is the path with no progress reporting: a server action is sent
 * with `fetch`, and a fetch request body cannot be measured as it goes. The
 * screens that show the upload window use the endpoint instead.
 */
export async function uploadImageServer(formData: FormData): Promise<string | null> {
  if (!(await requireAdminAction("cms.edit"))) return null;

  const file = formData.get('file');
  if (!(file instanceof File)) return null;

  const stored = await storeCmsMedia(file);
  return stored.ok ? stored.url : null;
}

/** How many library images one call returns. */
const MEDIA_PAGE_SIZE = 100;

export interface MediaListing {
  images: Array<{ name: string; url: string }>;
  /** True when the bucket holds more than this call returned. */
  hasMore: boolean;
}

export async function listImagesServer(): Promise<MediaListing> {
  if (!(await requireAdminAction("cms.view"))) return { images: [], hasMore: false };

  try {
    /* Supabase's `list` caps at whatever is asked for and says nothing about
       what it left behind, so a library past the limit simply appeared to end —
       older images were still in the bucket, still referenced by the page, and
       invisible on this screen. Asked for one more than the limit so the caller
       can tell the difference between "that is all of them" and "there are
       more", and report it rather than quietly truncating. */
    const { data, error } = await supabaseAdmin.storage.from(PUBLIC_MEDIA_BUCKET).list('images', {
      limit: MEDIA_PAGE_SIZE + 1,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) {
      console.error('Error fetching images securely:', error);
      return { images: [], hasMore: false };
    }

    if (!data) return { images: [], hasMore: false };

    /* The testimonial video and audio live in R2 — see `@/lib/r2` — and are
       listed beside the pictures, newest first across both, so a clip can be
       found and deleted here like any other file. R2 failing to answer leaves
       the pictures listed rather than the whole library empty. */
    let clips: Array<{ name: string; url: string; time: string }> = [];
    let clipsTruncated = false;
    try {
      const listed = await r2List(R2_MEDIA_PREFIX);
      clips = listed.objects.map(object => ({
        name: object.key.slice(R2_MEDIA_PREFIX.length),
        url: r2PublicUrl(object.key),
        time: object.lastModified,
      }));
      clipsTruncated = listed.truncated;
    } catch (error) {
      console.error('Error listing R2 media:', error);
    }

    /* Ask the client for the address rather than assembling it from the project
       URL by hand — the same call the upload path already uses. */
    const publicUrlBase = supabaseAdmin.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl("images/").data.publicUrl;

    const files = data
      .slice(0, MEDIA_PAGE_SIZE)
      .filter(file => file.name !== '.emptyFolderPlaceholder')
      .map(file => ({
        name: file.name,
        url: `${publicUrlBase}${file.name}`,
        time: file.created_at ?? "",
      }));

    const all = [...files, ...clips].sort(
      (a, b) => (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0)
    );

    const hasMore = data.length > MEDIA_PAGE_SIZE || clipsTruncated || all.length > MEDIA_PAGE_SIZE;
    const images = all.slice(0, MEDIA_PAGE_SIZE).map(({ name, url }) => ({ name, url }));

    return { images, hasMore };
  } catch (error) {
    console.error('Exception during secure image listing:', error);
    return { images: [], hasMore: false };
  }
}

export async function deleteImageServer(publicUrl: string): Promise<boolean> {
  if (!(await requireAdminAction("cms.edit"))) return false;

  try {
    /* Resolved through `storagePathOf`, which understands both the current
       public-media address and the one the CMS wrote before the buckets were
       split — so a row stored under the old shape still deletes. */
    const r2Key = r2KeyOf(publicUrl);
    const filePath = r2Key ? null : storagePathOf(publicUrl);
    if (!r2Key && !filePath) return false;

    /* A testimonial clip lives in R2, everything else in the Supabase bucket. */
    const { error } = r2Key
      ? await r2Delete(r2Key)
      : await supabaseAdmin.storage
          .from(PUBLIC_MEDIA_BUCKET)
          .remove([filePath!]);

    if (error) {
      console.error('Error securely deleting image:', error);
      return false;
    }

    // 1. Clean up from database site_settings — the published page and the
    //    unpublished draft alike, or publishing the draft would bring the
    //    deleted file's address back onto the page.
    for (const rowId of ["landing_content", DRAFT_ID]) {
    try {
      const settings = await prisma.site_settings.findUnique({
        where: { id: rowId },
      });

      if (settings) {
        const contentAr = settings.content_ar as JsonRecord || {};

        // Recursive helper to clean up matching image URL from JSON content
        const removeUrl = (obj: JsonRecord): boolean => {
          if (typeof obj !== 'object' || obj === null) return false;
          let localChanged = false;
          for (const key in obj) {
            if (obj[key] === publicUrl) {
              obj[key] = PLACEHOLDER_IMAGE;
              localChanged = true;
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              if (removeUrl(obj[key])) {
                localChanged = true;
              }
            }
          }
          return localChanged;
        };

        if (removeUrl(contentAr)) {
          await prisma.site_settings.update({
            where: { id: rowId },
            data: {
              content_ar: contentAr,
            },
          });
          if (rowId === "landing_content") revalidatePath("/");
          console.log(`Cleaned up deleted image URL from site_settings (replaced with placeholder): ${publicUrl}`);
        }
      }
    } catch (dbError) {
      console.error('Error cleaning up image from site_settings:', dbError);
    }
    }

    // 2. Clean up from courses cover_image if any course uses it
    try {
      await prisma.courses.updateMany({
        where: { cover_image: publicUrl },
        data: { cover_image: PLACEHOLDER_IMAGE },
      });
    } catch (dbError) {
      console.error('Error cleaning up image from courses:', dbError);
    }

    return true;
  } catch (error) {
    console.error('Exception during secure image deletion:', error);
    return false;
  }
}


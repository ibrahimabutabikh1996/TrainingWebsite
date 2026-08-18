"use server";

import { PLACEHOLDER_IMAGE } from "@/lib/placeholderImage";
import type { JsonRecord } from "@/types";
import { prisma } from "@/lib/db";
import { requireAdminAction } from "@/lib/authGuard";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, UPLOADS_BUCKET } from "@/lib/supabaseAdmin";
import { storeCmsMedia } from "@/lib/cmsMedia";

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

export async function saveLandingContent(contentAr: JsonRecord) {
  if (!(await requireAdminAction())) {
    return { success: false, error: "غير مصرح لك بهذا الإجراء" };
  }

  /* A plain object, and only a plain object. An array or a primitive would be
     stored happily by jsonb and then read back by the landing page as content
     it cannot walk. */
  if (typeof contentAr !== "object" || contentAr === null || Array.isArray(contentAr)) {
    return { success: false, error: "صيغة المحتوى غير صحيحة" };
  }

  const serialised = JSON.stringify(contentAr);
  if (serialised.length > MAX_CONTENT_BYTES) {
    return { success: false, error: "حجم المحتوى يتجاوز الحد المسموح" };
  }

  try {
    await prisma.site_settings.upsert({
      where: { id: "landing_content" },
      update: {
        content_ar: contentAr,
      },
      create: {
        id: "landing_content",
        content_ar: contentAr,
      },
    });

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
  if (!(await requireAdminAction())) return null;

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
  if (!(await requireAdminAction())) return { images: [], hasMore: false };

  try {
    /* Supabase's `list` caps at whatever is asked for and says nothing about
       what it left behind, so a library past the limit simply appeared to end —
       older images were still in the bucket, still referenced by the page, and
       invisible on this screen. Asked for one more than the limit so the caller
       can tell the difference between "that is all of them" and "there are
       more", and report it rather than quietly truncating. */
    const { data, error } = await supabaseAdmin.storage.from(UPLOADS_BUCKET).list('images', {
      limit: MEDIA_PAGE_SIZE + 1,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) {
      console.error('Error fetching images securely:', error);
      return { images: [], hasMore: false };
    }

    if (!data) return { images: [], hasMore: false };

    const hasMore = data.length > MEDIA_PAGE_SIZE;

    /* Ask the client for the address rather than assembling it from the project
       URL by hand — the same call the upload path already uses. */
    const publicUrlBase = supabaseAdmin.storage.from(UPLOADS_BUCKET).getPublicUrl("images/").data.publicUrl;

    const images = data
      .slice(0, MEDIA_PAGE_SIZE)
      .filter(file => file.name !== '.emptyFolderPlaceholder')
      .map(file => ({
        name: file.name,
        url: `${publicUrlBase}${file.name}`
      }));

    return { images, hasMore };
  } catch (error) {
    console.error('Exception during secure image listing:', error);
    return { images: [], hasMore: false };
  }
}

export async function deleteImageServer(publicUrl: string): Promise<boolean> {
  if (!(await requireAdminAction())) return false;

  try {
    if (!publicUrl.includes('/storage/v1/object/public/uploads/')) {
      return false;
    }
    
    const pathParts = publicUrl.split('/storage/v1/object/public/uploads/');
    const filePath = pathParts[1];
    
    if (!filePath) return false;

    const { error } = await supabaseAdmin.storage
      .from('uploads')
      .remove([filePath]);

    if (error) {
      console.error('Error securely deleting image:', error);
      return false;
    }

    // 1. Clean up from database site_settings
    try {
      const settings = await prisma.site_settings.findUnique({
        where: { id: "landing_content" },
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
            where: { id: "landing_content" },
            data: {
              content_ar: contentAr,
            },
          });
          revalidatePath("/");
          console.log(`Cleaned up deleted image URL from site_settings (replaced with placeholder): ${publicUrl}`);
        }
      }
    } catch (dbError) {
      console.error('Error cleaning up image from site_settings:', dbError);
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


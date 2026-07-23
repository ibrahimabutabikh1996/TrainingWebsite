"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function saveLandingContent(contentEn: any, contentAr: any) {
  try {
    await prisma.site_settings.upsert({
      where: { id: "landing_content" },
      update: {
        content_en: contentEn,
        content_ar: contentAr,
      },
      create: {
        id: "landing_content",
        content_en: contentEn,
        content_ar: contentAr,
      },
    });

    // Revalidate the home page so the changes reflect immediately
    revalidatePath("/");
    
    return { success: true };
  } catch (error) {
    console.error("Failed to save landing content:", error);
    return { success: false, error: "Failed to save" };
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

export async function listImagesServer() {
  try {
    const { data, error } = await supabaseAdmin.storage.from('uploads').list('images', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) {
      console.error('Error fetching images securely:', error);
      return [];
    }

    if (!data) return [];

    const publicUrlBase = `${supabaseUrl}/storage/v1/object/public/uploads/images/`;
    
    return data
      .filter(file => file.name !== '.emptyFolderPlaceholder')
      .map(file => ({
        name: file.name,
        url: `${publicUrlBase}${file.name}`
      }));
  } catch (error) {
    console.error('Exception during secure image listing:', error);
    return [];
  }
}

export async function deleteImageServer(publicUrl: string): Promise<boolean> {
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
        const contentEn = settings.content_en as any || {};
        const contentAr = settings.content_ar as any || {};
        let changed = false;

        // Recursive helper to clean up matching image URL from JSON content
        const removeUrl = (obj: any): boolean => {
          if (typeof obj !== 'object' || obj === null) return false;
          let localChanged = false;
          for (const key in obj) {
            if (obj[key] === publicUrl) {
              obj[key] = "/photos/loading.jpg";
              localChanged = true;
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              if (removeUrl(obj[key])) {
                localChanged = true;
              }
            }
          }
          return localChanged;
        };

        if (removeUrl(contentEn)) changed = true;
        if (removeUrl(contentAr)) changed = true;

        if (changed) {
          await prisma.site_settings.update({
            where: { id: "landing_content" },
            data: {
              content_en: contentEn,
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
        data: { cover_image: "/photos/loading.jpg" },
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


import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Uploads an image to the 'uploads' bucket and returns its public URL
 */
export async function uploadImage(file: File): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `images/${fileName}`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Exception during image upload:', error);
    return null;
  }
}

/**
 * Deletes an image from the 'uploads' bucket using its public URL
 */
export async function deleteImage(publicUrl: string): Promise<boolean> {
  try {
    if (!publicUrl.includes('/storage/v1/object/public/uploads/')) {
      return false;
    }
    
    // Extract the exact path after the bucket name
    const pathParts = publicUrl.split('/storage/v1/object/public/uploads/');
    const filePath = pathParts[1];
    
    if (!filePath) return false;

    const { error } = await supabase.storage
      .from('uploads')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception during image deletion:', error);
    return false;
  }
}

/**
 * Lists all images in the 'images' folder of the 'uploads' bucket
 */
export async function listImages(): Promise<{ name: string, url: string }[]> {
  try {
    const { data, error } = await supabase.storage
      .from('uploads')
      .list('images', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('Error listing images:', error);
      return [];
    }

    if (!data) return [];

    return data
      .filter(file => file.name !== '.emptyFolderPlaceholder')
      .map(file => {
        const { data: publicUrlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(`images/${file.name}`);
        
        return {
          name: file.name,
          url: publicUrlData.publicUrl
        };
      });
  } catch (error) {
    console.error('Exception during listing images:', error);
    return [];
  }
}

import { put, del } from '@vercel/blob';

export interface UploadResult {
  url: string;
  publicId?: string;
}

/**
 * Uploads a profile photo to cloud storage (Vercel Blob).
 * @param buffer - File content as Buffer
 * @param filename - Original or derived filename
 * @param mimeType - Image MIME type (e.g. 'image/jpeg', 'image/png', 'image/webp')
 */
export async function uploadProfilePhoto(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const uniqueKey = `profile-photos/${Date.now()}_${sanitizedFilename}`;

  // Use Vercel Blob put
  const blob = await put(uniqueKey, buffer, {
    access: 'public',
    contentType: mimeType,
  });

  return {
    url: blob.url,
    publicId: blob.pathname,
  };
}

/**
 * Deletes a profile photo from cloud storage.
 * @param url - The full URL of the photo to delete
 */
export async function deleteProfilePhoto(url: string | null | undefined): Promise<void> {
  if (!url) return;

  try {
    // Only attempt deletion if it's a Vercel Blob URL or valid cloud URL
    if (url.includes('blob.vercel-storage.com') || url.includes('public.blob')) {
      await del(url);
    }
  } catch (error) {
    console.error('Failed to delete previous cloud image:', error);
    // Non-blocking error so profile update can still proceed
  }
}

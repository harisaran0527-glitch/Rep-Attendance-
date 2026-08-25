/**
 * Server-side only: Vercel Blob storage utilities for profile photo management.
 *
 * Uses secure server-side process.env.BLOB_READ_WRITE_TOKEN for authentication.
 */

if (typeof window !== 'undefined') {
  throw new Error('Blob storage operations can only be executed on the server side.');
}

import { put, del, PutCommandOptions } from '@vercel/blob';

export interface UploadResult {
  url: string;
  publicId?: string;
}

/**
 * Gets the secure server-side BLOB_READ_WRITE_TOKEN from environment variables if available.
 */
function getBlobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env['BLOB_READ_WRITE_TOKEN'];

  if (token && typeof token === 'string' && token.trim().length > 0) {
    return token.trim();
  }
  return undefined;
}

/**
 * Uploads a profile photo to cloud storage (Vercel Blob).
 *
 * @param buffer - File content as Buffer
 * @param filename - Original or derived filename
 * @param mimeType - Image MIME type (e.g. 'image/jpeg', 'image/png', 'image/webp')
 */
export async function uploadProfilePhoto(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const token = getBlobToken();

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const uniqueKey = `profile-photos/${Date.now()}_${sanitizedFilename}`;

  console.log('[storage] Uploading profile photo:', uniqueKey, token ? '(has explicit token)' : '(no explicit token)');

  const options: PutCommandOptions = {
    access: 'public',
    contentType: mimeType,
  };

  if (token) {
    options.token = token;
  }

  try {
    const blob = await put(uniqueKey, buffer, options);
    console.log('[storage] Upload successful. URL:', blob.url);

    return {
      url: blob.url,
      publicId: blob.pathname,
    };
  } catch (error: any) {
    console.error('[storage] Upload failed - Error Name:', error?.name, 'Error Message:', error?.message);
    // Preserve the original error message directly so real SDK issues are visible
    throw new Error(`Vercel Blob Upload Failed [${error?.name || 'BlobError'}]: ${error?.message || 'Unknown Blob API error'}`);
  }
}

/**
 * Deletes a profile photo from cloud storage.
 * @param url - The full URL of the photo to delete
 */
export async function deleteProfilePhoto(url: string | null | undefined): Promise<void> {
  if (!url) return;

  try {
    // Only attempt deletion if it's a recognised Vercel Blob URL
    if (url.includes('blob.vercel-storage.com') || url.includes('public.blob')) {
      const token = getBlobToken();
      console.log('[storage] Deleting previous profile photo:', url);

      if (token) {
        await del(url, { token });
      } else {
        await del(url);
      }
      console.log('[storage] Previous photo deleted successfully.');
    }
  } catch (error: any) {
    // Non-blocking: log but do not fail the profile update
    console.error('[storage] Failed to delete previous cloud image:', error?.name, error?.message);
  }
}

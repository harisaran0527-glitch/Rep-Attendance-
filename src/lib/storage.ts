/**
 * Server-side only: Vercel Blob storage utilities for profile photo management.
 *
 * Uses secure server-side process.env.BLOB_READ_WRITE_TOKEN for authentication.
 */

if (typeof window !== 'undefined') {
  throw new Error('Blob storage operations can only be executed on the server side.');
}

import { put, del } from '@vercel/blob';

export interface UploadResult {
  url: string;
  publicId?: string;
}

/**
 * Gets the secure server-side BLOB_READ_WRITE_TOKEN from environment variables.
 * Throws BLOB_STORAGE_NOT_CONFIGURED if token is missing or empty.
 */
function getBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env['BLOB_READ_WRITE_TOKEN']?.trim();

  if (!token || token.length === 0) {
    throw new Error('BLOB_STORAGE_NOT_CONFIGURED: BLOB_READ_WRITE_TOKEN is missing or empty in environment.');
  }

  return token;
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

  // Safe diagnostics (never logging token value)
  console.log('[storage] Uploading profile photo with explicit token:', {
    hasToken: Boolean(token),
    tokenLength: token.length,
    pathname: uniqueKey,
  });

  const blob = await put(uniqueKey, buffer, {
    access: 'public',
    contentType: mimeType,
    token,
  });

  console.log('[storage] Upload successful. URL:', blob.url);

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
    // Only attempt deletion if it's a recognised Vercel Blob URL
    if (url.includes('blob.vercel-storage.com') || url.includes('public.blob')) {
      const token = getBlobToken();
      console.log('[storage] Deleting previous profile photo:', url);
      await del(url, { token });
      console.log('[storage] Previous photo deleted successfully.');
    }
  } catch (error: any) {
    // Non-blocking: log but do not fail the profile update
    console.error('[storage] Failed to delete previous cloud image:', error?.name, error?.message);
  }
}

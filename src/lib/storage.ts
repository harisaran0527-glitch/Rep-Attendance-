/**
 * Server-side only: Vercel Blob storage utilities for profile photo management.
 * Uses @vercel/blob v2.x which automatically reads BLOB_READ_WRITE_TOKEN from env.
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
 * Uploads a profile photo to cloud storage (Vercel Blob).
 * @vercel/blob v2 automatically uses process.env.BLOB_READ_WRITE_TOKEN.
 * No need to pass token manually — it is resolved from the environment.
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
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const uniqueKey = `profile-photos/${Date.now()}_${sanitizedFilename}`;

  console.log('[storage] Uploading profile photo:', uniqueKey);

  const blob = await put(uniqueKey, buffer, {
    access: 'public',
    contentType: mimeType,
    // token is resolved automatically from process.env.BLOB_READ_WRITE_TOKEN
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
      console.log('[storage] Deleting previous profile photo:', url);
      // token is resolved automatically from process.env.BLOB_READ_WRITE_TOKEN
      await del(url);
      console.log('[storage] Previous photo deleted successfully.');
    }
  } catch (error) {
    // Non-blocking: log but do not fail the profile update
    console.error('[storage] Failed to delete previous cloud image:', error);
  }
}

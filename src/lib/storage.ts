/**
 * Server-side only: Vercel Blob storage utilities for profile photo management.
 *
 * Explicitly passes `token` to every @vercel/blob call because the v2 SDK's
 * automatic credential resolution can fail in certain Vercel runtime
 * configurations (OIDC present without BLOB_STORE_ID, env var not resolved).
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
 * Reads BLOB_READ_WRITE_TOKEN from the environment at call time.
 * Returns the token string or throws a clear server error.
 */
function requireBlobToken(): string {
  const token = process.env['BLOB_READ_WRITE_TOKEN'];

  if (!token || token.trim() === '') {
    console.error(
      '[storage] BLOB_READ_WRITE_TOKEN is missing or empty.',
      'BLOB_STORE_ID present:', !!process.env['BLOB_STORE_ID'],
      'VERCEL_OIDC_TOKEN present:', !!process.env['VERCEL_OIDC_TOKEN'],
      'VERCEL_ENV:', process.env['VERCEL_ENV'] ?? 'unset',
      'NODE_ENV:', process.env['NODE_ENV'] ?? 'unset',
    );
    throw new Error(
      'Profile photo upload is temporarily unavailable. Storage credentials are not configured.'
    );
  }

  return token.trim();
}

/**
 * Uploads a profile photo to Vercel Blob storage.
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
  const token = requireBlobToken();

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const uniqueKey = `profile-photos/${Date.now()}_${sanitizedFilename}`;

  console.log('[storage] Uploading profile photo:', uniqueKey);

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
      const token = requireBlobToken();
      console.log('[storage] Deleting previous profile photo:', url);
      await del(url, { token });
      console.log('[storage] Previous photo deleted successfully.');
    }
  } catch (error) {
    // Non-blocking: log but do not fail the profile update
    console.error('[storage] Failed to delete previous cloud image:', error);
  }
}

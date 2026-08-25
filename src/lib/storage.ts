/**
 * Server-side only: Cloudinary storage utilities for student profile photo management.
 *
 * Uses secure server-side environment variables:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */

if (typeof window !== 'undefined') {
  throw new Error('Cloudinary storage operations can only be executed on the server side.');
}

import { v2 as cloudinary } from 'cloudinary';

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Validates and configures Cloudinary server-side SDK.
 */
function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'CLOUDINARY_NOT_CONFIGURED: Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET in environment variables.'
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

/**
 * Uploads a profile photo buffer to Cloudinary permanently under folder 'cr-attendance/profile-photos'.
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
  const client = getCloudinaryConfig();

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const fileBasename = sanitizedFilename.substring(0, sanitizedFilename.lastIndexOf('.')) || sanitizedFilename;
  const customPublicId = `${Date.now()}_${fileBasename}`;

  console.log('[storage] Uploading profile photo to Cloudinary:', customPublicId);

  return new Promise((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        folder: 'cr-attendance/profile-photos',
        public_id: customPublicId,
        resource_type: 'image',
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) {
          console.error('[storage] Cloudinary upload failed:', error?.message || error);
          return reject(
            new Error(`Cloudinary Upload Failed: ${error?.message || 'Unknown Cloudinary error'}`)
          );
        }

        console.log('[storage] Cloudinary upload successful. Secure URL:', result.secure_url);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Deletes a profile photo from Cloudinary given its public_id or full Cloudinary secure_url.
 * @param publicIdOrUrl - Cloudinary public_id or full URL to delete
 */
export async function deleteProfilePhoto(publicIdOrUrl: string | null | undefined): Promise<void> {
  if (!publicIdOrUrl) return;

  try {
    const client = getCloudinaryConfig();

    let publicId = publicIdOrUrl;
    if (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://')) {
      const uploadIdx = publicIdOrUrl.indexOf('/upload/');
      if (uploadIdx !== -1) {
        let path = publicIdOrUrl.substring(uploadIdx + 8);
        if (path.match(/^v\d+\//)) {
          path = path.replace(/^v\d+\//, '');
        }
        publicId = path.substring(0, path.lastIndexOf('.')) || path;
      }
    }

    console.log('[storage] Deleting previous profile photo from Cloudinary:', publicId);
    await client.uploader.destroy(publicId, { resource_type: 'image' });
    console.log('[storage] Previous photo deleted from Cloudinary successfully.');
  } catch (error: any) {
    // Non-blocking deletion
    console.error('[storage] Failed to delete previous Cloudinary image:', error?.message);
  }
}

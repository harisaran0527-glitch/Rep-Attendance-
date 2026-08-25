/**
 * Server-side only: Cloudinary storage utilities for student profile photo management.
 *
 * Supports configuration via full CLOUDINARY_URL (cloudinary://API_KEY:API_SECRET@CLOUD_NAME)
 * OR via individual environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).
 */

import 'server-only';
import { v2 as cloudinary } from 'cloudinary';

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Strips wrapping quotes, newlines, carriage returns, tabs, and outer whitespace.
 */
function cleanValue(val?: string): string {
  if (!val) return '';
  let cleaned = val.trim();
  cleaned = cleaned.replace(/^['"]+|['"]+$/g, '').trim();
  cleaned = cleaned.replace(/[\r\n\t]/g, '').trim();
  return cleaned;
}

/**
 * Safely parses CLOUDINARY_URL, supporting both formats:
 * - cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 * - CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 */
function parseCloudinaryUrl(rawUrl?: string): { url: string; apiKey?: string; apiSecret?: string; cloudName?: string; isValid: boolean } | null {
  if (!rawUrl) return null;
  let cleaned = cleanValue(rawUrl);

  if (cleaned.startsWith('CLOUDINARY_URL=')) {
    cleaned = cleaned.substring('CLOUDINARY_URL='.length).trim();
    cleaned = cleaned.replace(/^['"]+|['"]+$/g, '').trim();
  }

  const isValid = cleaned.startsWith('cloudinary://');
  if (!isValid) {
    return { url: cleaned, isValid: false };
  }

  try {
    const afterScheme = cleaned.substring('cloudinary://'.length);
    const atIdx = afterScheme.lastIndexOf('@');
    if (atIdx === -1) return { url: cleaned, isValid: true };

    const userInfo = afterScheme.substring(0, atIdx);
    const cloudName = afterScheme.substring(atIdx + 1).trim();
    const colonIdx = userInfo.indexOf(':');

    if (colonIdx === -1) return { url: cleaned, cloudName, isValid: true };

    const apiKey = userInfo.substring(0, colonIdx).trim();
    const apiSecret = userInfo.substring(colonIdx + 1).trim();

    return {
      url: cleaned,
      apiKey,
      apiSecret,
      cloudName,
      isValid: true,
    };
  } catch {
    return { url: cleaned, isValid: true };
  }
}

export interface CloudinaryDiagInfo {
  vercelEnv: string;
  hasCloudinaryUrl: boolean;
  cloudinaryUrlLength: number;
  startsWithCloudinaryProtocol: boolean;
  hasCloudName: boolean;
  cloudNameLength: number;
  hasApiKey: boolean;
  apiKeyLength: number;
  apiKeyHasWhitespace: boolean;
  apiKeyHasQuotes: boolean;
  apiKeyIsDigitsOnly: boolean;
  hasApiSecret: boolean;
  apiSecretLength: number;
  configMethod: 'CLOUDINARY_URL' | 'ENV_VARIABLES' | 'CLOUDINARY_URL_INVALID' | 'UNCONFIGURED';
}

/**
 * Inspects Cloudinary environment configuration safely at request time without exposing any secrets.
 * Guaranteed never to throw during module import or build evaluation.
 */
export function getCloudinaryDiagnostics(): CloudinaryDiagInfo {
  const rawCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const rawApiKey = process.env.CLOUDINARY_API_KEY;
  const rawApiSecret = process.env.CLOUDINARY_API_SECRET;
  const rawCloudinaryUrl = process.env.CLOUDINARY_URL;

  const parsedUrl = parseCloudinaryUrl(rawCloudinaryUrl);

  let cloudName = cleanValue(rawCloudName);
  let apiKey = cleanValue(rawApiKey);
  let apiSecret = cleanValue(rawApiSecret);

  let configMethod: CloudinaryDiagInfo['configMethod'] = 'UNCONFIGURED';

  const hasUrl = Boolean(rawCloudinaryUrl && cleanValue(rawCloudinaryUrl).length > 0);
  const startsWithCloudinaryProtocol = Boolean(parsedUrl?.isValid);

  if (hasUrl) {
    if (startsWithCloudinaryProtocol && parsedUrl?.url) {
      configMethod = 'CLOUDINARY_URL';
      if (parsedUrl.apiKey) apiKey = parsedUrl.apiKey;
      if (parsedUrl.apiSecret) apiSecret = parsedUrl.apiSecret;
      if (parsedUrl.cloudName) cloudName = parsedUrl.cloudName;
    } else {
      configMethod = 'CLOUDINARY_URL_INVALID';
    }
  } else if (cloudName && apiKey && apiSecret) {
    configMethod = 'ENV_VARIABLES';
  }

  return {
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    hasCloudinaryUrl: hasUrl,
    cloudinaryUrlLength: rawCloudinaryUrl ? cleanValue(rawCloudinaryUrl).length : 0,
    startsWithCloudinaryProtocol,
    hasCloudName: Boolean(cloudName),
    cloudNameLength: cloudName.length,
    hasApiKey: Boolean(apiKey),
    apiKeyLength: apiKey.length,
    apiKeyHasWhitespace: rawApiKey ? /\s/.test(rawApiKey) : false,
    apiKeyHasQuotes: rawApiKey ? /['"]/.test(rawApiKey) : false,
    apiKeyIsDigitsOnly: Boolean(apiKey) && /^\d+$/.test(apiKey),
    hasApiSecret: Boolean(apiSecret),
    apiSecretLength: apiSecret.length,
    configMethod,
  };
}

/**
 * Validates and configures Cloudinary server-side SDK dynamically at runtime immediately before request execution.
 * Guaranteed never to run or throw during module import or static build phase.
 */
function getCloudinaryConfig() {
  const diag = getCloudinaryDiagnostics();

  if (diag.hasCloudinaryUrl) {
    if (diag.configMethod === 'CLOUDINARY_URL_INVALID' || !diag.startsWithCloudinaryProtocol) {
      throw new Error(
        'CLOUDINARY_URL_INVALID: CLOUDINARY_URL environment variable exists but does not begin with valid "cloudinary://" scheme.'
      );
    }

    const parsedUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
    if (!parsedUrl?.url) {
      throw new Error('CLOUDINARY_URL_INVALID: Unable to parse CLOUDINARY_URL environment variable.');
    }

    console.log('[storage] Configured Cloudinary SDK using CLOUDINARY_URL (preferred priority source)');
    cloudinary.config({
      cloudinary_url: parsedUrl.url,
      secure: true,
    });
    return cloudinary;
  }

  const cloudName = cleanValue(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = cleanValue(process.env.CLOUDINARY_API_KEY);
  const apiSecret = cleanValue(process.env.CLOUDINARY_API_SECRET);

  if (!cloudName || !apiKey || !apiSecret) {
    const missing: string[] = [];
    if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!apiKey) missing.push('CLOUDINARY_API_KEY');
    if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');
    throw new Error(
      `CLOUDINARY_NOT_CONFIGURED: Missing ${missing.join(', ')} in runtime environment variables.`
    );
  }

  console.log('[storage] Configured Cloudinary SDK using explicit environment variables:', {
    cloudNameLength: cloudName.length,
    apiKeyLength: apiKey.length,
    apiKeyIsDigitsOnly: diag.apiKeyIsDigitsOnly,
    apiSecretLength: apiSecret.length,
  });

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
  const diag = getCloudinaryDiagnostics();

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
          const rawMsg = error?.message || 'Unknown Cloudinary error';
          console.error('[storage] Cloudinary upload failed:', rawMsg, diag);
          return reject(
            new Error(
              `Cloudinary Upload Failed: ${rawMsg} [ApiKeyLen: ${diag.apiKeyLength}, ApiKeyDigits: ${diag.apiKeyIsDigitsOnly}, CloudLen: ${diag.cloudNameLength}, Method: ${diag.configMethod}]`
            )
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
 * Non-blocking: will never throw an unhandled exception or break the profile update flow.
 * @param publicIdOrUrl - Cloudinary public_id or full URL to delete
 */
export async function deleteProfilePhoto(publicIdOrUrl: string | null | undefined): Promise<void> {
  if (!publicIdOrUrl) return;

  try {
    const client = getCloudinaryConfig();

    let publicId = publicIdOrUrl;

    // Handle full URLs safely
    if (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://')) {
      if (!publicIdOrUrl.includes('cloudinary.com')) {
        console.log('[storage] Skipping deletion of non-Cloudinary URL:', publicIdOrUrl);
        return;
      }

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
    const destroyRes = await client.uploader.destroy(publicId, { resource_type: 'image' });
    console.log('[storage] Cloudinary destroy result:', destroyRes);
  } catch (error: any) {
    // Non-blocking deletion safeguard
    console.error('[storage] Failed to delete previous Cloudinary image (safely swallowed):', error?.message);
  }
}

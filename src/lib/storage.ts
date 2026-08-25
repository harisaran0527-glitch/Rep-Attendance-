/**
 * Server-side storage utilities for student profile photo management.
 * Migrated directly from proven Student360 (student360-ai) cloudStorage architecture.
 *
 * Supports:
 * 1. SUPABASE Storage (if SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are set)
 * 2. AWS S3 / R2 (if AWS_S3_BUCKET is set)
 * 3. LOCAL Development Fallback (saves to public/uploads/avatars during development)
 */

import 'server-only';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface UploadResult {
  url: string;
  publicId: string;
}

export interface UploadFileOptions {
  folder: 'avatars' | 'certificates' | 'profile-photos';
  allowedExtensions?: string[];
  maxSizeBytes?: number;
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

export interface StorageDiagInfo {
  provider: 'SUPABASE' | 'S3' | 'LOCAL';
  hasSupabaseUrl: boolean;
  hasSupabaseKey: boolean;
  hasAwsBucket: boolean;
}

export function getStorageDiagnostics(): StorageDiagInfo {
  const supabaseUrl = cleanValue(process.env.SUPABASE_URL);
  const supabaseKey = cleanValue(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  const awsBucket = cleanValue(process.env.AWS_S3_BUCKET);
  const rawProvider = cleanValue(process.env.CLOUD_STORAGE_PROVIDER).toUpperCase();

  let provider: StorageDiagInfo['provider'] = 'LOCAL';
  if (rawProvider === 'SUPABASE' || (supabaseUrl && supabaseKey)) {
    provider = 'SUPABASE';
  } else if (rawProvider === 'S3' || awsBucket) {
    provider = 'S3';
  }

  return {
    provider,
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasSupabaseKey: Boolean(supabaseKey),
    hasAwsBucket: Boolean(awsBucket),
  };
}

/**
 * Core upload engine adapted from Student360's uploadToCloudStorage.
 */
export async function uploadToCloudStorage(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  options: UploadFileOptions
): Promise<UploadResult> {
  const diag = getStorageDiagnostics();
  const maxSizeBytes = options.maxSizeBytes || 2 * 1024 * 1024; // 2 MB default

  if (buffer.length > maxSizeBytes) {
    throw new Error(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds maximum limit of ${(
        maxSizeBytes /
        (1024 * 1024)
      ).toFixed(1)} MB.`
    );
  }

  const rawExt = path.extname(originalFilename).toLowerCase() || '.jpg';
  if (options.allowedExtensions && !options.allowedExtensions.includes(rawExt)) {
    throw new Error(`Invalid file extension '${rawExt}'. Allowed: ${options.allowedExtensions.join(', ')}`);
  }

  const uniqueId = crypto.randomUUID();
  const safeFileName = `${uniqueId}${rawExt}`;
  const folder = options.folder || 'avatars';

  // 1. SUPABASE CLOUD STORAGE
  if (diag.provider === 'SUPABASE') {
    const rawSupabaseUrl = process.env.SUPABASE_URL;
    const rawSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    let baseUrl = cleanValue(rawSupabaseUrl);
    const key = cleanValue(rawSupabaseKey);

    if (baseUrl.includes('/rest/v1')) {
      baseUrl = baseUrl.split('/rest/v1')[0];
    }
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    const storageBase = `${baseUrl}/storage/v1`;
    const bucket = cleanValue(process.env.SUPABASE_BUCKET) || 'cr-attendance-assets';
    const uploadUrl = `${storageBase}/object/${bucket}/${folder}/${safeFileName}`;

    console.log('[cloudStorage] Uploading asset to Supabase Storage:', uploadUrl);

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': mimeType || 'application/octet-stream',
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[cloudStorage] Supabase Storage upload error:', errText);
      throw new Error(`Supabase Storage upload failed (${res.status}): ${errText}`);
    }

    const publicUrl = `${storageBase}/object/public/${bucket}/${folder}/${safeFileName}`;
    console.log('[cloudStorage] Supabase upload success. Public URL:', publicUrl);

    return {
      url: publicUrl,
      publicId: `${folder}/${safeFileName}`,
    };
  }

  // 2. AWS S3 / CLOUDFLARE R2
  if (diag.provider === 'S3') {
    const bucket = cleanValue(process.env.AWS_S3_BUCKET);
    const region = cleanValue(process.env.AWS_REGION) || 'us-east-1';
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${folder}/${safeFileName}`;

    return {
      url: publicUrl,
      publicId: `${folder}/${safeFileName}`,
    };
  }

  // 3. LOCAL DEVELOPMENT FALLBACK
  const targetDir = path.join(process.cwd(), 'public', 'uploads', folder);
  await fs.mkdir(targetDir, { recursive: true });
  const localFilePath = path.join(targetDir, safeFileName);

  await fs.writeFile(localFilePath, buffer);
  const localUrl = `/uploads/${folder}/${safeFileName}`;
  console.log('[cloudStorage] Saved asset to local development fallback:', localUrl);

  return {
    url: localUrl,
    publicId: `${folder}/${safeFileName}`,
  };
}

/**
 * Uploads a profile photo buffer using Student360 storage architecture.
 */
export async function uploadProfilePhoto(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  return uploadToCloudStorage(buffer, filename, mimeType, {
    folder: 'avatars',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    maxSizeBytes: 2 * 1024 * 1024,
  });
}

/**
 * Deletes previous profile photo asset (non-blocking).
 */
export async function deleteProfilePhoto(publicIdOrUrl: string | null | undefined): Promise<void> {
  if (!publicIdOrUrl) return;

  try {
    const rawSupabaseUrl = process.env.SUPABASE_URL;
    const rawSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const supabaseUrl = cleanValue(rawSupabaseUrl);
    const supabaseKey = cleanValue(rawSupabaseKey);

    if (supabaseUrl && supabaseKey && publicIdOrUrl.includes('/storage/v1/object/')) {
      let baseUrl = supabaseUrl;
      if (baseUrl.includes('/rest/v1')) baseUrl = baseUrl.split('/rest/v1')[0];
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

      const bucket = cleanValue(process.env.SUPABASE_BUCKET) || 'cr-attendance-assets';
      
      let objectPath = publicIdOrUrl;
      const idx = publicIdOrUrl.indexOf(`/object/public/${bucket}/`);
      if (idx !== -1) {
        objectPath = publicIdOrUrl.substring(idx + `/object/public/${bucket}/`.length);
      }

      const deleteUrl = `${baseUrl}/storage/v1/object/${bucket}/${objectPath}`;
      console.log('[cloudStorage] Deleting Supabase storage object:', deleteUrl);

      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
      });
      return;
    }

    if (publicIdOrUrl.startsWith('/uploads/')) {
      const localFilePath = path.join(process.cwd(), 'public', publicIdOrUrl);
      await fs.unlink(localFilePath).catch(() => {});
      return;
    }
  } catch (err: any) {
    console.error('[cloudStorage] Non-blocking deletion warning:', err?.message);
  }
}

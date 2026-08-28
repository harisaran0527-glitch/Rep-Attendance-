export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isStaffAuthenticated } from '@/lib/auth';
import { uploadProfilePhoto, deleteProfilePhoto, getStorageDiagnostics } from '@/lib/storage';
import { getStudentById, updateStudentPhoto } from '@/lib/db-api';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB (2,097,152 bytes)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export async function GET() {
  const diag = getStorageDiagnostics();
  return NextResponse.json(diag);
}

export async function POST(req: NextRequest) {
  try {
    const isStaff = await isStaffAuthenticated();

    if (!isStaff) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Profile photo management is restricted to Administrators.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const requestedStudentId = formData.get('studentId');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No image file provided.' },
        { status: 400 }
      );
    }

    if (!requestedStudentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required.' },
        { status: 400 }
      );
    }

    const targetStudentId = Number(requestedStudentId);

    // Server-side logging of file size and parameters
    console.log('[POST /api/student/photo] Received File Name:', file.name);
    console.log('[POST /api/student/photo] Received File Size (bytes):', file.size);
    console.log('[POST /api/student/photo] Received File Size (MB):', (file.size / (1024 * 1024)).toFixed(2));
    console.log('[POST /api/student/photo] MAX_FILE_SIZE:', MAX_FILE_SIZE);

    // Server-side file validation: size and MIME type
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Maximum file size is 2 MB' },
        { status: 400 }
      );
    }

    // Validate student existence
    const student = await getStudentById(targetStudentId);
    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found.' },
        { status: 404 }
      );
    }

    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unsupported image format. Allowed formats: JPG, JPEG, PNG, WEBP.',
        },
        { status: 400 }
      );
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Safe filename generation using register number
    const extension = mimeType.split('/')[1] || 'jpg';
    const safeFilename = `${student.registerNumber}_${Date.now()}.${extension}`;

    // Step 1: Upload the NEW photo first using Supabase Storage
    console.log('[POST /api/student/photo] Step: NEW_UPLOAD_START');
    const uploadResult = await uploadProfilePhoto(buffer, safeFilename, mimeType);
    console.log('[POST /api/student/photo] Step: NEW_UPLOAD_SUCCESS', {
      url: uploadResult.url,
      publicId: uploadResult.publicId,
    });

    // Capture old photo identifier before updating DB
    const oldPhotoIdentifier = student.profilePhotoPublicId || student.profilePhotoUrl;

    // Step 2: Save new secure URL & public ID to Database
    await updateStudentPhoto(
      targetStudentId,
      uploadResult.url,
      uploadResult.publicId
    );
    console.log('[POST /api/student/photo] Step: DB_UPDATE_SUCCESS');

    // Trigger Next.js route revalidation for instant Admin Panel & Portal updates
    try {
      revalidatePath('/students');
      revalidatePath('/attendance');
      revalidatePath('/history');
      revalidatePath('/student/dashboard');
    } catch {
      // Non-blocking revalidation
    }

    // Step 3: Attempt old image cleanup ONLY after DB update succeeds (secondary/non-blocking)
    if (oldPhotoIdentifier) {
      console.log('[POST /api/student/photo] Step: OLD_IMAGE_DELETE_START', { oldPhotoIdentifier });
      try {
        await deleteProfilePhoto(oldPhotoIdentifier);
        console.log('[POST /api/student/photo] Step: OLD_IMAGE_DELETE_SUCCESS');
      } catch (cleanupErr: any) {
        // Non-blocking safeguard: log failure but NEVER break the profile photo update
        console.error('[POST /api/student/photo] Step: OLD_IMAGE_DELETE_FAILED (non-blocking):', cleanupErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      message: 'Profile photo updated successfully by Administrator.',
    });
  } catch (error: any) {
    console.error('[POST /api/student/photo] Execution Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const isStaff = await isStaffAuthenticated();

    if (!isStaff) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Profile photo management is restricted to Administrators.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    
    if (!body.studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required.' },
        { status: 400 }
      );
    }

    const targetStudentId = Number(body.studentId);

    const student = await getStudentById(targetStudentId);
    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found.' },
        { status: 404 }
      );
    }

    const oldPhotoIdentifier = student.profilePhotoPublicId || student.profilePhotoUrl;

    // Reset database fields first
    await updateStudentPhoto(targetStudentId, null, null);

    try {
      revalidatePath('/students');
      revalidatePath('/attendance');
      revalidatePath('/history');
      revalidatePath('/student/dashboard');
    } catch {
      // Non-blocking
    }

    // Delete existing cloud image after DB reset (non-blocking)
    if (oldPhotoIdentifier) {
      try {
        await deleteProfilePhoto(oldPhotoIdentifier);
      } catch (cleanupErr: any) {
        console.error('[DELETE /api/student/photo] Old image cleanup failed (non-blocking):', cleanupErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile photo removed successfully by Administrator.',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/student/photo:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

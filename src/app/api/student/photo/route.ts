export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession, isStaffAuthenticated } from '@/lib/auth';
import { uploadProfilePhoto, deleteProfilePhoto } from '@/lib/storage';
import { getStudentById, updateStudentPhoto } from '@/lib/db-api';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB (2,097,152 bytes)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export async function POST(req: NextRequest) {
  try {
    const studentSession = await getStudentSession();
    const isStaff = await isStaffAuthenticated();

    if (!studentSession && !isStaff) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in.' },
        { status: 401 }
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

    // Server-side logging of file size and parameters
    console.log('Server Received File Name:', file.name);
    console.log('Server Received File Size (bytes):', file.size);
    console.log('Server Received File Size (MB):', (file.size / (1024 * 1024)).toFixed(2));
    console.log('Server MAX_FILE_SIZE:', MAX_FILE_SIZE);

    // Server-side file validation: size and MIME type
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Maximum file size is 2 MB' },
        { status: 400 }
      );
    }

    // Determine target student ID securely
    let targetStudentId: number;
    if (studentSession && !isStaff) {
      // Students can ONLY update their own photo (derived from authenticated session)
      targetStudentId = studentSession.studentId;
    } else if (isStaff && requestedStudentId) {
      targetStudentId = Number(requestedStudentId);
    } else if (studentSession) {
      targetStudentId = studentSession.studentId;
    } else {
      return NextResponse.json(
        { success: false, error: 'Student ID is required.' },
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

    // Delete existing cloud image if present
    if (student.profilePhotoUrl) {
      await deleteProfilePhoto(student.profilePhotoUrl);
    }

    // Safe filename generation using register number
    const extension = mimeType.split('/')[1] || 'jpg';
    const safeFilename = `${student.registerNumber}_${Date.now()}.${extension}`;

    // Upload to cloud storage
    const uploadResult = await uploadProfilePhoto(buffer, safeFilename, mimeType);

    // Save to Database
    await updateStudentPhoto(
      targetStudentId,
      uploadResult.url,
      uploadResult.publicId
    );

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      message: 'Profile photo updated successfully.',
    });
  } catch (error: any) {
    console.error('Error in POST /api/student/photo:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const studentSession = await getStudentSession();
    const isStaff = await isStaffAuthenticated();

    if (!studentSession && !isStaff) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    
    // Determine target student ID securely
    let targetStudentId: number;
    if (studentSession && !isStaff) {
      targetStudentId = studentSession.studentId;
    } else if (isStaff && body.studentId) {
      targetStudentId = Number(body.studentId);
    } else if (studentSession) {
      targetStudentId = studentSession.studentId;
    } else {
      return NextResponse.json(
        { success: false, error: 'Student ID is required.' },
        { status: 400 }
      );
    }

    const student = await getStudentById(targetStudentId);
    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found.' },
        { status: 404 }
      );
    }

    // Delete existing cloud image if present
    if (student.profilePhotoUrl) {
      await deleteProfilePhoto(student.profilePhotoUrl);
    }

    // Reset database fields
    await updateStudentPhoto(targetStudentId, null, null);

    return NextResponse.json({
      success: true,
      message: 'Profile photo removed successfully.',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/student/photo:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

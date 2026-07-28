import { cookies } from 'next/headers';
import { cache } from 'react';

export async function setAdminSession(email: string) {
  const cookieStore = await cookies();
  cookieStore.set('admin_session', email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
}

export const getAdminSession = cache(async () => {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value || null;
});

export const isAdminAuthenticated = cache(async () => {
  const session = await getAdminSession();
  return session === 'classrep@gmail.com';
});

export async function setStudentSession(email: string, studentId: number) {
  const cookieStore = await cookies();
  cookieStore.set('student_session', JSON.stringify({ email, studentId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  });
}

export async function clearStudentSession() {
  const cookieStore = await cookies();
  cookieStore.delete('student_session');
}

export const getStudentSession = cache(async () => {
  const cookieStore = await cookies();
  const val = cookieStore.get('student_session')?.value;
  if (!val) return null;
  try {
    return JSON.parse(val) as { email: string; studentId: number };
  } catch {
    return null;
  }
});

export const isStudentAuthenticated = cache(async () => {
  const session = await getStudentSession();
  return session !== null;
});

export async function setTeacherSession(email: string, teacherId: number) {
  const cookieStore = await cookies();
  cookieStore.set('teacher_session', JSON.stringify({ email, teacherId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  });
}

export async function clearTeacherSession() {
  const cookieStore = await cookies();
  cookieStore.delete('teacher_session');
}

export const getTeacherSession = cache(async () => {
  const cookieStore = await cookies();
  const val = cookieStore.get('teacher_session')?.value;
  if (!val) return null;
  try {
    return JSON.parse(val) as { email: string; teacherId: number };
  } catch {
    return null;
  }
});

export const isTeacherAuthenticated = cache(async () => {
  const session = await getTeacherSession();
  return session !== null;
});

export const isStaffAuthenticated = cache(async () => {
  const isAdmin = await isAdminAuthenticated();
  if (isAdmin) return true;
  const isTeacher = await isTeacherAuthenticated();
  return isTeacher;
});

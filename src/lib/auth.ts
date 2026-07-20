import { cookies } from 'next/headers';

export async function setAdminSession(email: string) {
  const cookieStore = await cookies();
  cookieStore.set('admin_session', email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value || null;
}

export async function isAdminAuthenticated() {
  const session = await getAdminSession();
  return session === 'admin@gmail.com';
}

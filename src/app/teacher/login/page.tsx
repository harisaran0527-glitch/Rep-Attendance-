import { redirect } from 'next/navigation';
import { isTeacherAuthenticated } from '@/lib/auth';
import TeacherLoginPageClient from './TeacherLoginPageClient';

export const metadata = {
  title: 'Teacher Login - CR Attendance Manager',
  description: 'Login page for class teachers and instructors.',
};

export default async function TeacherLoginPage() {
  const isAuth = await isTeacherAuthenticated();
  if (isAuth) {
    redirect('/');
  }

  return <TeacherLoginPageClient />;
}

import type { Metadata } from 'next';
import LoginPageClient from './LoginPageClient';

export const metadata: Metadata = {
  title: 'Admin Login - CR Attendance Manager',
  description: 'Secure admin login for CR Attendance Manager.',
};

export default async function LoginPage() {
  return <LoginPageClient />;
}

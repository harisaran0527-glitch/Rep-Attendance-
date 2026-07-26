import crypto from 'crypto';

export function hashPassword(password: string): string {
  const salt = 'cr_attendance_secret_salt_2026';
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash;
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

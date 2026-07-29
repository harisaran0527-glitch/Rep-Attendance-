'use client';

import { useState } from 'react';
import Image from 'next/image';

interface StudentAvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
}

export default function StudentAvatar({
  src,
  name,
  size = 'md',
  className = '',
}: StudentAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Compute initials (e.g., "John Doe" -> "JD", "Alex" -> "A")
  const getInitials = (fullName: string) => {
    if (!fullName) return 'S';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const sizeClasses: Record<NonNullable<StudentAvatarProps['size']>, { container: string; text: string; px: number }> = {
    xs: { container: 'w-6 h-6', text: 'text-[10px]', px: 24 },
    sm: { container: 'w-8 h-8', text: 'text-xs', px: 32 },
    md: { container: 'w-10 h-10', text: 'text-sm', px: 40 },
    lg: { container: 'w-12 h-12', text: 'text-base', px: 48 },
    xl: { container: 'w-16 h-16', text: 'text-xl', px: 64 },
    '2xl': { container: 'w-24 h-24', text: 'text-2xl', px: 96 },
    '3xl': { container: 'w-32 h-32', text: 'text-3xl', px: 128 },
  };

  const { container, text, px } = sizeClasses[size] || sizeClasses.md;

  const initials = getInitials(name);

  // Generate deterministic gradient based on name
  const getGradient = (str: string) => {
    const gradients = [
      'from-blue-600 to-indigo-600',
      'from-emerald-600 to-teal-600',
      'from-violet-600 to-purple-600',
      'from-amber-600 to-orange-600',
      'from-rose-600 to-pink-600',
      'from-cyan-600 to-blue-600',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  const gradientClass = getGradient(name);

  if (src && !imageError) {
    return (
      <div
        className={`relative inline-block rounded-full overflow-hidden shrink-0 border border-slate-700/50 shadow-sm ${container} ${className}`}
      >
        <Image
          src={src}
          alt={`${name}'s profile photo`}
          width={px}
          height={px}
          className="object-cover w-full h-full rounded-full"
          onError={() => setImageError(true)}
          unoptimized={src.startsWith('data:') || src.startsWith('blob:')}
        />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br ${gradientClass} text-white font-bold tracking-wider shrink-0 border border-white/10 shadow-sm ${container} ${text} ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}

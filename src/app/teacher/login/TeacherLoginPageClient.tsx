'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Eye, EyeOff, Loader2, BookOpen } from 'lucide-react';
import { teacherLoginAction } from '../../actions';
import ThemeToggle from '@/components/ThemeToggle';

export default function TeacherLoginPageClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = await teacherLoginAction(formData);
        if (result.success) {
          window.location.href = '/';
        } else {
          setError(result.error || 'Invalid teacher credentials.');
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again.');
      }
    });
  };

  return (
    <main className="min-h-screen bg-[#0b0f19] light:bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[140px] pointer-events-none" />

      {/* Theme Toggle Button */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-4 shadow-xl">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 light:from-blue-700 light:to-purple-700 bg-clip-text text-transparent">
            Faculty Teacher Portal
          </h1>
          <p className="text-xs text-slate-400 light:text-slate-600 mt-2 font-semibold">
            Sign in to mark and manage student attendance sessions
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card border border-slate-800 light:border-slate-200 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {error && (
            <div className="mb-6 p-4 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-xs font-semibold text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-300 light:text-slate-700 mb-2">
                Teacher Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="e.g. teacher@college.edu"
                  className="block w-full pl-10 pr-4 py-3 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-300 light:text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-12 py-3 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-gradient w-full py-3.5 px-4 font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In as Teacher</span>
              )}
            </button>
          </form>

          {/* Return link */}
          <div className="mt-8 pt-6 border-t border-slate-800 light:border-slate-200 text-center">
            <a
              href="/login"
              className="text-xs text-slate-400 light:text-slate-600 hover:text-indigo-400 font-bold tracking-wider uppercase transition-colors"
            >
              Switch to Class Rep Admin Portal
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

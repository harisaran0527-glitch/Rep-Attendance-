'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Eye, EyeOff, Loader2, BookOpen } from 'lucide-react';
import { teacherLoginAction } from '../../actions';

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
    <main className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-[128px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 mb-4 shadow-lg shadow-indigo-500/5">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Teacher Portal</h1>
          <p className="text-sm text-slate-400 mt-1.5">Sign in to mark and manage student attendance</p>
        </div>

        {/* Login Card */}
        <div className="glass-card border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden bg-slate-900/60 backdrop-blur-md">
          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-red-500/25 rounded-2xl text-xs font-semibold text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Teacher Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="e.g. teacher@college.edu"
                  className="block w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-12 py-3 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/60 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/10 transition-colors cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Return link */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
            <a
              href="/login"
              className="text-xs text-slate-500 hover:text-indigo-400 font-semibold tracking-wide uppercase transition-colors"
            >
              Admin Portal
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

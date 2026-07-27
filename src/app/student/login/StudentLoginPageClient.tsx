'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Eye, EyeOff, Loader2, GraduationCap, AlertCircle, X } from 'lucide-react';
import { studentLoginAction, studentGoogleLoginAction } from '../../actions';
import ThemeToggle from '@/components/ThemeToggle';

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export default function StudentLoginPageClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  // Google Login Modal state
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = await studentLoginAction(formData);
        if (result.success) {
          window.location.href = '/student/dashboard';
        } else {
          setError(result.error || 'Invalid credentials.');
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again.');
      }
    });
  };

  const handleGoogleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!googleEmailInput || !googleEmailInput.trim()) {
      setError('Please enter your Google account email address.');
      return;
    }

    setIsGoogleModalOpen(false);

    startTransition(async () => {
      try {
        const result = await studentGoogleLoginAction(googleEmailInput);
        if (result.success) {
          window.location.href = '/student/dashboard';
        } else {
          setError(result.error || 'Google login failed.');
        }
      } catch (err) {
        setError('An error occurred during Google sign-in. Please try again.');
      }
    });
  };

  return (
    <main className="min-h-screen bg-[#0b0f19] light:bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
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
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 light:from-blue-700 light:to-purple-700 bg-clip-text text-transparent">
            Student Portal Login
          </h1>
          <p className="text-xs text-slate-400 light:text-slate-600 mt-2 font-semibold">
            Sign in to check your personal attendance records and statistics
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card border border-slate-800 light:border-slate-200 rounded-3xl p-8 shadow-2xl relative overflow-hidden space-y-6">
          {error && (
            <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-xs font-semibold text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {showForgotNotice && (
            <div className="p-4 bg-indigo-950/40 light:bg-indigo-100 border border-indigo-500/30 rounded-2xl text-xs text-indigo-300 light:text-indigo-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-1">Forgot Password?</span>
                Student accounts are managed by the college administration. Contact the Class Representative to reset your password.
              </div>
            </div>
          )}

          {/* Google Sign-in Option */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setGoogleEmailInput('');
              setIsGoogleModalOpen(true);
            }}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-900/80 light:bg-white border border-slate-700/60 light:border-slate-300 hover:bg-slate-800 text-slate-100 light:text-slate-900 font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
          >
            <GoogleIcon />
            <span>Sign in with Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 light:border-slate-300 w-full" />
            <span className="bg-[#0b0f19] light:bg-slate-50 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest absolute">
              or email login
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-300 light:text-slate-700 mb-2">
                Registered Email
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
                  placeholder="e.g. student@college.edu"
                  className="block w-full pl-10 pr-4 py-3 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-300 light:text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotNotice(!showForgotNotice)}
                  className="text-[11px] font-bold text-indigo-400 light:text-indigo-600 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
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

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded border-slate-700 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-slate-400 light:text-slate-600 font-semibold cursor-pointer select-none">
                Remember Me
              </label>
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
                <span>Sign In to Student Portal</span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Google Sign-in Account Selector Modal */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-slate-900 light:bg-white border border-slate-800 light:border-slate-300 rounded-3xl p-6 shadow-2xl space-y-5">
            <button
              onClick={() => setIsGoogleModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-slate-800 light:bg-slate-100 border border-slate-700 light:border-slate-300 flex items-center justify-center">
                <GoogleIcon />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 light:text-slate-900">Google Account Sign-In</h3>
                <p className="text-xs text-slate-400 light:text-slate-500">Authenticating with Google</p>
              </div>
            </div>

            <form onSubmit={handleGoogleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                  Your Google Email Address
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  placeholder="student@college.edu"
                  className="block w-full px-4 py-2.5 bg-slate-950/60 light:bg-slate-100 border border-slate-700/60 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGoogleModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-700 light:border-slate-300 text-slate-300 light:text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-gradient flex-1 py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Continue</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

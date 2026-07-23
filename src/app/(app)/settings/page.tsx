'use client';

import { useState, useEffect } from 'react';
import {
  getSmtpSettingsAction,
  updateSmtpSettingsAction,
  sendTestEmailAction,
} from '@/app/actions';
import {
  Settings,
  Mail,
  Shield,
  Key,
  User,
  Sliders,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Save,
} from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // SMTP States
  const [host, setHost] = useState('smtp.gmail.com');
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [senderName, setSenderName] = useState('College Attendance Portal');
  const [senderEmail, setSenderEmail] = useState('');
  const [lowThreshold, setLowThreshold] = useState(75.0);

  // Messaging states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await getSmtpSettingsAction();
        if (settings) {
          setHost(settings.host);
          setPort(settings.port);
          setSecure(settings.secure);
          setUser(settings.user);
          setPassword(settings.password);
          setSenderName(settings.senderName);
          setSenderEmail(settings.senderEmail);
          setLowThreshold(settings.lowThreshold);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        setErrorMsg('Failed to load settings from server.');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload: any = {
      host,
      port,
      secure,
      user,
      senderName,
      senderEmail,
      lowThreshold,
    };

    // Only send password if it has been updated/entered
    if (password) {
      payload.password = password;
    }

    try {
      const res = await updateSmtpSettingsAction(payload);
      if (res.success) {
        setSuccessMsg('Settings updated successfully!');
        // Clear password input to show it was saved
        setPassword('');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || 'Failed to update settings.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;
    setTesting(true);
    setTestSuccess(null);
    setTestError(null);

    try {
      const res = await sendTestEmailAction(testEmail);
      if (res.success) {
        if (res.status === 'Sent') {
          setTestSuccess('Test email sent successfully via SMTP!');
        } else {
          setTestSuccess('Test email simulated successfully! (SMTP details were incomplete)');
        }
      } else {
        setTestError(res.error || 'SMTP Connection failed. Verify credentials.');
      }
    } catch (err: any) {
      setTestError(err.message || 'Failed to trigger test email.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-6">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <span>General Settings</span>
            </h3>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Threshold Percentage */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Low Attendance Threshold (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={lowThreshold}
                    onChange={(e) => setLowThreshold(parseFloat(e.target.value))}
                    placeholder="e.g. 75"
                    className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-semibold"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    %
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Students falling below this percentage will be automatically emailed warnings.
                </p>
              </div>

              <div className="border-t border-slate-800 pt-6">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  <span>SMTP Provider Credentials</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      SMTP Server Host
                    </label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="block w-full px-3.5 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(parseInt(e.target.value))}
                      placeholder="587"
                      className="block w-full px-3.5 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="secure"
                    checked={secure}
                    onChange={(e) => setSecure(e.target.checked)}
                    className="w-4 h-4 accent-indigo-650 cursor-pointer"
                  />
                  <label htmlFor="secure" className="text-xs text-slate-300 font-semibold cursor-pointer">
                    Use SSL/TLS Secure Connection (Port 465)
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      Username / Email Address
                    </label>
                    <input
                      type="text"
                      value={user}
                      onChange={(e) => setUser(e.target.value)}
                      placeholder="e.g. portal@gmail.com"
                      className="block w-full px-3.5 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      SMTP Password (or App Password)
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="block w-full px-3.5 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-6">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-4">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span>Sender Details</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      Sender Name
                    </label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Department Head / College Admin"
                      className="block w-full px-3.5 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      Sender Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="e.g. portal@gmail.com"
                      className="block w-full px-3.5 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/10 transition-colors text-sm cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      <span>Saving Settings...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4.5 h-4.5" />
                      <span>Save Config</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar Diagnostics Column */}
        <div className="space-y-6">
          <div className="glass p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-indigo-400" />
              <span>Email Diagnostics</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Verify your SMTP configurations by triggering a test warning email to any email address.
            </p>

            {testSuccess && (
              <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs">
                <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{testSuccess}</span>
              </div>
            )}

            {testError && (
              <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="break-all">{testError}</span>
              </div>
            )}

            <form onSubmit={handleTestEmail} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                  Test Destination Email
                </label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="e.g. name@domain.com"
                  className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={testing || !testEmail}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Test...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Diagnostics Email</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import {
  getSmtpSettingsAction,
  updateSmtpSettingsAction,
  sendTestEmailAction,
  getTeachersAction,
  addTeacherAction,
  deleteTeacherAction,
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
  Users,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';

interface Teacher {
  id: number;
  name: string;
  email: string;
  department: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'teachers'>('general');
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
  const [collegeOpeningDate, setCollegeOpeningDate] = useState('2026-07-13');

  // Teachers State
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherDept, setTeacherDept] = useState('CSE');
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  // Messaging states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const loadSettingsAndTeachers = async () => {
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
        setCollegeOpeningDate(settings.collegeOpeningDate || '2026-07-13');
      }
      const tList = await getTeachersAction();
      setTeachers(tList);
    } catch (err) {
      console.error('Failed to load settings or teachers:', err);
      setErrorMsg('Failed to load settings or teachers from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsAndTeachers();
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
      collegeOpeningDate,
    };

    if (password) {
      payload.password = password;
    }

    try {
      const res = await updateSmtpSettingsAction(payload);
      if (res.success) {
        setSuccessMsg('Settings updated successfully!');
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
          setTestSuccess('Test email simulated successfully!');
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

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherSaving(true);
    setTeacherError(null);

    try {
      const res = await addTeacherAction({
        name: teacherName,
        email: teacherEmail,
        password: teacherPassword,
        department: teacherDept,
      });

      if (res.success) {
        setTeacherName('');
        setTeacherEmail('');
        setTeacherPassword('');
        setTeacherDept('CSE');
        setSuccessMsg('Teacher added successfully!');
        setTimeout(() => setSuccessMsg(null), 3000);
        const tList = await getTeachersAction();
        setTeachers(tList);
      } else {
        setTeacherError(res.error || 'Failed to add teacher.');
      }
    } catch (err) {
      setTeacherError('An error occurred while creating teacher.');
    } finally {
      setTeacherSaving(false);
    }
  };

  const handleDeleteTeacher = async (id: number) => {
    if (!confirm('Are you sure you want to delete this teacher account?')) return;
    try {
      const res = await deleteTeacherAction(id);
      if (res.success) {
        setSuccessMsg('Teacher deleted successfully!');
        setTimeout(() => setSuccessMsg(null), 3000);
        const tList = await getTeachersAction();
        setTeachers(tList);
      } else {
        setErrorMsg(res.error || 'Failed to delete teacher.');
      }
    } catch (err) {
      setErrorMsg('An error occurred while deleting teacher.');
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
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Page Header Tabs */}
      <div className="flex bg-slate-900/60 light:bg-slate-200/80 p-1.5 rounded-2xl border border-slate-800 light:border-slate-300 w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'btn-gradient shadow-md'
              : 'text-slate-400 light:text-slate-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>General Settings</span>
        </button>
        <button
          onClick={() => setActiveTab('teachers')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'teachers'
              ? 'btn-gradient shadow-md'
              : 'text-slate-400 light:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Teacher Accounts ({teachers.length})</span>
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Settings Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6 rounded-3xl">
              <h3 className="text-base font-bold text-slate-100 light:text-slate-900 flex items-center gap-2 mb-6">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <span>General Configurations</span>
              </h3>

              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
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
                      className="block w-full px-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                    College Opening Date (First Day of Term) *
                  </label>
                  <input
                    type="date"
                    required
                    value={collegeOpeningDate}
                    onChange={(e) => setCollegeOpeningDate(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="border-t border-slate-800 light:border-slate-200 pt-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 light:text-slate-700 flex items-center gap-2 mb-4">
                    <Mail className="w-4 h-4 text-indigo-400" />
                    <span>SMTP Provider Credentials</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="block w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(parseInt(e.target.value))}
                        placeholder="587"
                        className="block w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="secure"
                      checked={secure}
                      onChange={(e) => setSecure(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="secure" className="text-xs text-slate-300 light:text-slate-700 font-semibold cursor-pointer">
                      Use SSL/TLS Secure Connection (Port 465)
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                        Username / Email
                      </label>
                      <input
                        type="text"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        placeholder="portal@gmail.com"
                        className="block w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                        SMTP App Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="block w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 light:border-slate-200 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-gradient flex items-center gap-2 px-6 py-2.5 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 text-xs cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Settings</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Sidebar Diagnostics Column */}
          <div className="space-y-6">
            <div className="glass-card p-6 rounded-3xl">
              <h3 className="text-base font-bold text-slate-100 light:text-slate-900 flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-indigo-400" />
                <span>Email Diagnostics</span>
              </h3>

              {testSuccess && (
                <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{testSuccess}</span>
                </div>
              )}

              {testError && (
                <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="break-all">{testError}</span>
                </div>
              )}

              <form onSubmit={handleTestEmail} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                    Destination Email
                  </label>
                  <input
                    type="email"
                    required
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="block w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={testing || !testEmail}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 light:bg-slate-200 hover:bg-slate-700 text-slate-200 light:text-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Diagnostics</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teachers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Teacher Form */}
          <div className="glass-card p-6 rounded-3xl h-fit">
            <h3 className="text-base font-bold text-slate-100 light:text-slate-900 flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              <span>Create Teacher</span>
            </h3>

            {teacherError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
                {teacherError}
              </div>
            )}

            <form onSubmit={handleAddTeacher} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                  Instructor Name *
                </label>
                <input
                  type="text"
                  required
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Prof. Sarah Connor"
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder="sarah@college.edu"
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={teacherDept}
                  onChange={(e) => setTeacherDept(e.target.value)}
                  placeholder="CSE"
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={teacherSaving}
                className="btn-gradient w-full py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {teacherSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create Instructor</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Teacher Accounts List */}
          <div className="lg:col-span-2">
            <div className="glass-card rounded-3xl overflow-hidden shadow-xl border border-slate-800 light:border-slate-200">
              <div className="p-5 border-b border-slate-800 light:border-slate-200">
                <h4 className="text-sm font-bold text-slate-100 light:text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Existing Teacher Accounts</span>
                </h4>
              </div>

              {teachers.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No teacher accounts created yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950/60 light:bg-slate-100 text-slate-400 light:text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-800 light:border-slate-200">
                      <tr>
                        <th className="px-6 py-3.5">Name</th>
                        <th className="px-6 py-3.5">Email</th>
                        <th className="px-6 py-3.5">Dept</th>
                        <th className="px-6 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 light:divide-slate-200">
                      {teachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-slate-800/10 light:hover:bg-slate-50">
                          <td className="px-6 py-4 font-bold text-slate-100 light:text-slate-900">{teacher.name}</td>
                          <td className="px-6 py-4 text-slate-400 light:text-slate-600">{teacher.email}</td>
                          <td className="px-6 py-4 font-mono font-bold text-indigo-400 light:text-indigo-600">{teacher.department}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteTeacher(teacher.id)}
                              className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              title="Delete Teacher Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
        // Refresh teacher list
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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page Header Tabs */}
      <div className="flex border-b border-slate-800 space-x-6 text-sm font-semibold mb-6">
        <button
          onClick={() => setActiveTab('general')}
          className={`pb-3 transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'general'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          General Settings
        </button>
        <button
          onClick={() => setActiveTab('teachers')}
          className={`pb-3 transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'teachers'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Teacher Accounts ({teachers.length})
        </button>
      </div>

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

      {activeTab === 'general' && (
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

                {/* College Opening Date */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    College Opening Date (First Day of Term) *
                  </label>
                  <input
                    type="date"
                    required
                    value={collegeOpeningDate}
                    onChange={(e) => setCollegeOpeningDate(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-semibold cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Baseline start date used for calculating cumulative working days and overall attendance percentages.
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
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      <span>Sending Test...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4.5 h-4.5" />
                      <span>Send Diagnostics Email</span>
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
          <div className="glass p-6 rounded-2xl border border-slate-800 h-fit">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              <span>Create Teacher</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Create an instructor account. Teachers can log in, view students, and record attendance.
            </p>

            {teacherError && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 text-rose-450 shrink-0" />
                <span>{teacherError}</span>
              </div>
            )}

            <form onSubmit={handleAddTeacher} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                  Instructor Name *
                </label>
                <input
                  type="text"
                  required
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="e.g. Prof. Sarah Connor"
                  className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                  Registered Email *
                </label>
                <input
                  type="email"
                  required
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder="e.g. sarah@college.edu"
                  className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                  Secure Password *
                </label>
                <input
                  type="password"
                  required
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                  Department
                </label>
                <input
                  type="text"
                  value={teacherDept}
                  onChange={(e) => setTeacherDept(e.target.value)}
                  placeholder="e.g. CSE"
                  className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={teacherSaving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {teacherSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
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
          <div className="lg:col-span-2 space-y-4">
            <div className="glass rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-900/40 backdrop-blur-md">
              <div className="p-5 border-b border-slate-800">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Existing Teacher Accounts</span>
                </h4>
              </div>

              {teachers.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No teacher accounts created yet. Add one on the left.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3.5">Name</th>
                        <th className="px-5 py-3.5">Email</th>
                        <th className="px-5 py-3.5">Dept</th>
                        <th className="px-5 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {teachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-5 py-4 font-bold text-white">{teacher.name}</td>
                          <td className="px-5 py-4 text-slate-400">{teacher.email}</td>
                          <td className="px-5 py-4 font-semibold text-indigo-400">{teacher.department}</td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => handleDeleteTeacher(teacher.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-450 hover:bg-rose-500/20 transition-all border border-rose-500/20 cursor-pointer"
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

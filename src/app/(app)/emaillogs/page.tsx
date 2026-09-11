'use client';

import { useState, useEffect } from 'react';
import {
  getEmailLogsAction,
  deleteEmailLogAction,
  deleteAllEmailLogsAction,
  runMonthlyWarningJobAction,
  sendTestEmailAction,
} from '@/app/actions';
import {
  Mail,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  Send,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface Student {
  registerNumber: string;
  studentName: string;
  department: string;
  email?: string;
}

interface EmailLog {
  id: number;
  studentId: number;
  studentNameSnapshot?: string | null;
  registerNumberSnapshot?: string | null;
  email: string;
  recipientEmail?: string | null;
  percentage: number;
  attendancePercentage?: number | null;
  subject: string;
  body: string;
  sentAt: string | Date;
  status: string;
  deliveryStatus?: string | null;
  providerMessageId?: string | null;
  trackingToken?: string | null;
  opened?: boolean | null;
  openedAt?: string | Date | null;
  student?: Student | null;
}

function formatDate(dateInput?: string | Date | null) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateInput?: string | Date | null) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTime(dateInput?: string | Date | null) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return `${formatDate(d)} ${formatTime(d)}`;
}

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Delete Modal States
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const fetchLogs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getEmailLogsAction();
      setLogs(data as unknown as EmailLog[]);
    } catch (error) {
      console.error('Failed to load email logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleTriggerAlerts = async () => {
    setTriggering(true);
    setActionNotice(null);
    try {
      const res = await runMonthlyWarningJobAction({ forceRun: true });
      if (res.success) {
        setActionNotice(res.message);
        await fetchLogs(true);
      } else {
        alert(res.message || 'Failed to trigger warning alerts.');
      }
    } catch (err: any) {
      alert(err.message || 'Error triggering warning job.');
    } finally {
      setTriggering(false);
    }
  };

  const handleDeleteSingle = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await deleteEmailLogAction(id);
      if (res.success) {
        setLogs((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert(res.error || 'Failed to delete log.');
      }
    } catch (err) {
      alert('An error occurred while deleting email log.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const res = await deleteAllEmailLogsAction();
      if (res.success) {
        setLogs([]);
      } else {
        alert(res.error || 'Failed to delete all email logs.');
      }
    } catch (err) {
      alert('An error occurred while deleting all email logs.');
    } finally {
      setDeletingAll(false);
      setShowDeleteAllModal(false);
    }
  };

  const [showTestModal, setShowTestModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: string;
    providerName?: string;
    messageId?: string;
    error?: string;
  } | null>(null);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient) return;
    setTestSending(true);
    setTestResult(null);

    try {
      const res = await sendTestEmailAction(testRecipient);
      setTestResult(res);
      await fetchLogs(true);
    } catch (err: any) {
      setTestResult({
        success: false,
        status: 'Failed',
        error: err.message || 'Test send failed.',
      });
    } finally {
      setTestSending(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const studentName = log.student?.studentName || log.studentNameSnapshot || '';
    const registerNumber = log.student?.registerNumber || log.registerNumberSnapshot || '';
    const email = log.recipientEmail || log.email || '';
    const status = log.deliveryStatus || log.status || '';

    return (
      studentName.toLowerCase().includes(q) ||
      registerNumber.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q) ||
      status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and Action Panel */}
      <div className="glass p-6 rounded-3xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-xl">
        <div className="space-y-1">
          <h3 className="text-2xl font-extrabold text-slate-100 light:text-slate-900 flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Mail className="w-6 h-6" />
            </div>
            <span>Email Alert Logs</span>
          </h3>
          <p className="text-xs text-slate-400 light:text-slate-600">
            Tracks individual low-attendance email alerts sent to students and monitors real-time email open status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setTestResult(null);
              setShowTestModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>Send Test Email</span>
          </button>

          <button
            onClick={handleTriggerAlerts}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className={`w-4 h-4 ${triggering ? 'animate-bounce' : ''}`} />
            <span>{triggering ? 'Sending Alerts...' : 'Send Low Attendance Alerts'}</span>
          </button>

          {logs.length > 0 && (
            <button
              onClick={() => setShowDeleteAllModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-xl text-xs border border-rose-500/20 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Delete All Logs</span>
            </button>
          )}

          <button
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 light:bg-slate-200 hover:bg-slate-700 text-slate-200 light:text-slate-800 font-bold rounded-xl text-xs border border-slate-700 light:border-slate-300 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      {/* Search Filter Bar */}
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Filter by student name, register no, email or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full max-w-md px-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
        />
        <span className="text-xs text-slate-400 light:text-slate-600 font-semibold">
          Found {filteredLogs.length} alert log(s)
        </span>
      </div>

      {/* Main Logs Table */}
      <div className="glass-card rounded-3xl overflow-hidden shadow-xl border border-slate-800 light:border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs">
            No warning email logs found. Click &quot;Send Low Attendance Alerts&quot; to evaluate and send alerts to students below threshold.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 light:bg-slate-100 border-b border-slate-800 light:border-slate-200 font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600">
                  <th className="px-5 py-4">Student Name</th>
                  <th className="px-5 py-4">Register No</th>
                  <th className="px-5 py-4">Recipient Email</th>
                  <th className="px-5 py-4 text-center">Attendance %</th>
                  <th className="px-5 py-4">Sent Date</th>
                  <th className="px-5 py-4">Sent Time</th>
                  <th className="px-5 py-4 text-center">Delivery Status</th>
                  <th className="px-5 py-4 text-center">Open Status</th>
                  <th className="px-5 py-4">Opened At</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 light:divide-slate-200">
                {filteredLogs.map((log) => {
                  const studentName = log.student?.studentName || log.studentNameSnapshot || 'Student';
                  const regNo = log.student?.registerNumber || log.registerNumberSnapshot || '—';
                  const email = (log.recipientEmail || log.email || log.student?.email || '').trim();
                  const isNoEmail = !email || email === 'No Email' || log.deliveryStatus === 'Not Sent — No Email';
                  const displayEmail = isNoEmail ? 'Not Available' : email;
                  const attPercentage = log.attendancePercentage ?? log.percentage;
                  const dStatus = log.deliveryStatus || log.status || 'Sent';
                  const isOpened = Boolean(log.opened);

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/10 light:hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-100 light:text-slate-900 whitespace-nowrap">
                        {studentName}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300 light:text-slate-700 font-mono font-bold whitespace-nowrap">
                        {regNo}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px]">
                        {isNoEmail ? (
                          <span className="text-amber-400/80 italic">Not Available</span>
                        ) : (
                          <span className="text-indigo-300 light:text-indigo-700 font-medium">{displayEmail}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          {attPercentage}%
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300 light:text-slate-700 whitespace-nowrap">
                        {formatDate(log.sentAt)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 light:text-slate-600 whitespace-nowrap">
                        {formatTime(log.sentAt)}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {dStatus === 'Sent' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Sent</span>
                          </span>
                        ) : dStatus === 'Simulated' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Simulated</span>
                          </span>
                        ) : dStatus === 'Not Sent — No Email' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Not Sent — No Email</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{dStatus}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {isOpened ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm">
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Opened</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800/60 light:bg-slate-200 text-slate-400 light:text-slate-600 border border-slate-700 light:border-slate-300">
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            <span>Not Opened / Not Detected</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300 light:text-slate-700 font-mono text-[11px] whitespace-nowrap">
                        {isOpened ? formatDateTime(log.openedAt) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {confirmDeleteId === log.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDeleteSingle(log.id)}
                              disabled={deletingId === log.id}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-[10px] cursor-pointer"
                            >
                              {deletingId === log.id ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 font-bold rounded-xl text-[10px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(log.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-xl cursor-pointer"
                            title="Delete Log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Delete All Logs */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-300 p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100 light:text-slate-900">Delete All Email Logs?</h3>
            </div>
            <p className="text-xs text-slate-300 light:text-slate-600 leading-relaxed">
              Are you sure you want to delete all <strong className="text-slate-100 light:text-slate-900">{logs.length} email alert log records</strong>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                disabled={deletingAll}
                className="px-4 py-2 bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                {deletingAll && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletingAll ? 'Deleting All...' : 'Confirm Delete All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Send Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-300 p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <Mail className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100 light:text-slate-900">Send Production Test Email</h3>
            </div>
            <p className="text-xs text-slate-300 light:text-slate-600 leading-relaxed">
              Enter a safe email address to test real email delivery path without modifying any student attendance records.
            </p>

            <form onSubmit={handleSendTestEmail} className="space-y-4 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Recipient Test Email Address:
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@example.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/60 light:bg-slate-100 border border-slate-700/60 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {testResult.success ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                    <span>Status: {testResult.status}</span>
                  </div>
                  {testResult.providerName && <div>Provider: <strong className="font-mono">{testResult.providerName}</strong></div>}
                  {testResult.messageId && <div>Message ID: <strong className="font-mono">{testResult.messageId}</strong></div>}
                  {testResult.error && <div className="text-rose-300 mt-1 font-semibold">{testResult.error}</div>}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  disabled={testSending}
                  className="px-4 py-2 bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testSending || !testRecipient}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {testSending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{testSending ? 'Sending Test...' : 'Send Test Email'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


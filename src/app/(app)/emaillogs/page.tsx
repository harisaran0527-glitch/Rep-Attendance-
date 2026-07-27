'use client';

import { useState, useEffect } from 'react';
import { getEmailLogsAction, deleteEmailLogAction, deleteAllEmailLogsAction } from '@/app/actions';
import { Mail, RefreshCw, AlertTriangle, ShieldCheck, Trash2, AlertCircle } from 'lucide-react';

interface Student {
  registerNumber: string;
  studentName: string;
  department: string;
}

interface EmailLog {
  id: number;
  studentId: number;
  email: string;
  percentage: number;
  subject: string;
  body: string;
  sentAt: string;
  status: string;
  student: Student;
}

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      const formattedLogs: EmailLog[] = data.map((log: any) => ({
        ...log,
        sentAt: new Date(log.sentAt).toLocaleString(),
      }));
      setLogs(formattedLogs);
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

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const studentName = log.student?.studentName || '';
    const registerNumber = log.student?.registerNumber || '';
    const email = log.email || '';
    const status = log.status || '';

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
            Tracks automated warning notifications sent to students whose attendance fell below 75%.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Search Filter Bar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter by name, roll number, email or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full max-w-md px-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
        />
        <span className="text-xs text-slate-400 light:text-slate-600 font-semibold ml-auto">
          Found {filteredLogs.length} logs
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
            No warning email logs found. Logs are generated when attendance falls below threshold.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 light:bg-slate-100 border-b border-slate-800 light:border-slate-200 font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600">
                  <th className="px-6 py-4">Student Details</th>
                  <th className="px-6 py-4">College Email ID</th>
                  <th className="px-6 py-4 text-center">Warning %</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Sent Time</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 light:divide-slate-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/10 light:hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-slate-100 light:text-slate-900">{log.student?.studentName || 'Student'}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {log.student?.registerNumber} &bull; {log.student?.department}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-300 light:text-slate-700 font-mono font-semibold">{log.email}</td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        {log.percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 light:text-slate-600 max-w-xs truncate" title={log.subject}>
                      {log.subject}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 light:text-slate-600">{log.sentAt}</td>
                    <td className="px-6 py-3.5 text-center">
                      {log.status === 'Sent' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Delivered</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{log.status}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
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
                ))}
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
    </div>
  );
}

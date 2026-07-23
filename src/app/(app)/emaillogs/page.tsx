'use client';

import { useState, useEffect } from 'react';
import { getEmailLogsAction } from '@/app/actions';
import { Mail, Calendar, Loader2, RefreshCw, Send, AlertTriangle, ShieldCheck } from 'lucide-react';

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

  const fetchLogs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getEmailLogsAction();
      // Map server ISO strings or Date to serializable strings
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

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      log.student.studentName.toLowerCase().includes(q) ||
      log.student.registerNumber.toLowerCase().includes(q) ||
      log.email.toLowerCase().includes(q) ||
      log.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Refresh Panel */}
      <div className="glass p-6 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" />
            <span>Email Alert Logs</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Tracks all automated warning notifications sent to students whose attendance fell below the threshold.
          </p>
        </div>

        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Search Filter Bar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter by name, registration number, email or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full max-w-md px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
        />
        <span className="text-xs text-slate-500 font-medium ml-auto">
          Found {filteredLogs.length} logs
        </span>
      </div>

      {/* Main Logs Table */}
      <div className="glass rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            No warning email logs found. Logs are generated when marked attendance falls below threshold.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4">Student Details</th>
                  <th className="px-6 py-4">College Email ID</th>
                  <th className="px-6 py-4 text-center">Warning Attendance</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Sent Time</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-slate-100">{log.student.studentName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        {log.student.registerNumber} &bull; {log.student.department}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-300 font-mono">{log.email}</td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {log.percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 max-w-xs truncate" title={log.subject}>
                      {log.subject}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">{log.sentAt}</td>
                    <td className="px-6 py-3.5 text-center">
                      {log.status === 'Sent' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Delivered</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Email content logged to console because SMTP credentials are empty">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Simulated</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

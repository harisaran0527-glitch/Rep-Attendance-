'use client';

import { useState, useEffect } from 'react';
import {
  getAllAttendanceSessionsAction,
  getSessionStudentDetailsAction,
} from '@/app/actions';
import {
  Calendar,
  Clock,
  BookOpen,
  Loader2,
  CheckCircle2,
  Search,
  History,
  Eye,
  Filter,
  ShieldCheck,
  Info,
  X,
  UserCheck,
  Share2,
} from 'lucide-react';
import { triggerSessionDateShare } from '@/lib/nativeShare';

interface AttendanceSession {
  id: string;
  date: string;
  subject: string;
  period: number;
  totalStudents: number;
  present: number;
  absent: number;
  od: number;
  ml: number;
  la: number;
  savedAt: string;
  savedBy: string;
}

interface StudentDetailRecord {
  id: number;
  studentName: string;
  registerNumber: string;
  status: string;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modal State for "View Students"
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [studentDetails, setStudentDetails] = useState<StudentDetailRecord[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalStatusFilter, setModalStatusFilter] = useState<string>('ALL');
  const [isSharing, setIsSharing] = useState(false);

  const handleShareSelectedSession = async () => {
    if (!selectedSession) return;
    setIsSharing(true);
    try {
      await triggerSessionDateShare({
        session: selectedSession,
        studentDetails,
      });
    } finally {
      setIsSharing(false);
    }
  };

  // Load all sessions directly from Neon PostgreSQL
  const loadSessionsData = async () => {
    setLoading(true);
    try {
      const res = await getAllAttendanceSessionsAction();
      if (res.success && res.data) {
        setSessions(res.data);
      }
    } catch (error) {
      console.error('Failed to load attendance sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionsData();
  }, []);

  // Open "View Students" Modal
  const handleOpenStudents = async (sessionItem: AttendanceSession) => {
    setSelectedSession(sessionItem);
    setLoadingDetails(true);
    setModalSearchQuery('');
    setModalStatusFilter('ALL');
    try {
      const res = await getSessionStudentDetailsAction(sessionItem.date);
      if (res.success && res.data) {
        setStudentDetails(res.data);
      }
    } catch (err) {
      console.error('Failed to load session student details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesDate = !dateFilter || s.date === dateFilter;
    const matchesSearch =
      !searchQuery ||
      s.date.includes(searchQuery) ||
      s.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDate && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Present':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Present
          </span>
        );
      case 'Absent':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Absent
          </span>
        );
      case 'On Duty (OD)':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            On Duty (OD)
          </span>
        );
      case 'Medical Leave (ML)':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Medical Leave
          </span>
        );
      case 'Long Absent':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            Long Absent
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  // Filter student detail modal list
  const filteredStudentDetails = studentDetails.filter((student) => {
    const q = modalSearchQuery.toLowerCase();
    const matchesQuery =
      student.studentName.toLowerCase().includes(q) ||
      student.registerNumber.toLowerCase().includes(q);
    const matchesStatus = modalStatusFilter === 'ALL' || student.status === modalStatusFilter;

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and Read-Only Directive Banner */}
      <div className="glass p-6 rounded-2xl flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-400" />
            <span>Attendance History — View Only</span>
          </h3>
          <p className="text-xs text-slate-400">
            Saved attendance sessions stored directly in Neon PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-xl text-xs text-indigo-300 font-semibold shadow-inner">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>To make corrections, use the Take Attendance page.</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search history by date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-4 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
            />
          </div>

          {/* Date Picker Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Clear Date Filter
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Total Sessions Saved: {filteredSessions.length}
        </span>
      </div>

      {/* Main Sessions Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="glass p-12 rounded-2xl text-center text-slate-500 text-sm">
          No saved attendance sessions found matching filter. Use Take Attendance page to save attendance for a date.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className="glass p-6 rounded-2xl border border-slate-800 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between shadow-xl"
            >
              <div className="space-y-3">
                {/* Session Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <span>{session.date}</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">
                      {session.subject} &bull; Period {session.period}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    Saved Session
                  </span>
                </div>

                {/* Audit Info */}
                <div className="text-[11px] text-slate-500 space-y-1 font-mono">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Saved Time: {session.savedAt}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Saved By: {session.savedBy}</span>
                  </div>
                </div>

                {/* Status Count Badges */}
                <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="block text-[10px] text-emerald-400 font-bold uppercase">Present</span>
                    <span className="text-base font-extrabold text-emerald-300">{session.present}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span className="block text-[10px] text-rose-400 font-bold uppercase">Absent</span>
                    <span className="text-base font-extrabold text-rose-300">{session.absent}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <span className="block text-[10px] text-blue-400 font-bold uppercase">OD</span>
                    <span className="text-base font-extrabold text-blue-300">{session.od}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <span className="block text-[10px] text-purple-400 font-bold uppercase">ML</span>
                    <span className="text-base font-extrabold text-purple-300">{session.ml}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-500/10 border border-zinc-500/20">
                    <span className="block text-[10px] text-zinc-400 font-bold uppercase">LA</span>
                    <span className="text-base font-extrabold text-zinc-300">{session.la}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="block text-[10px] text-slate-400 font-bold uppercase">Total</span>
                    <span className="text-base font-extrabold text-slate-200">{session.totalStudents}</span>
                  </div>
                </div>
              </div>

              {/* View Students Action Button */}
              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={() => handleOpenStudents(session)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <Eye className="w-4 h-4 text-white" />
                  <span>View Students</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW STUDENTS MODAL (STRICT READ-ONLY) */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-3xl w-full shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                  <span>Student Attendance List — {selectedSession.date}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedSession.subject} &bull; Period {selectedSession.period} &bull; Saved at {selectedSession.savedAt}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShareSelectedSession}
                  disabled={isSharing || loadingDetails}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                  title="Share Attendance Report for this date"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{isSharing ? 'Preparing...' : 'Share Date Report'}</span>
                </button>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Read-Only Guidance Note in Modal */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Strictly Read-Only View. Saved by {selectedSession.savedBy}.</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono font-bold">
                Total Students: {selectedSession.totalStudents}
              </span>
            </div>

            {/* Modal Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search student name or register no..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 mr-1" />
                {['ALL', 'Present', 'Absent', 'On Duty (OD)', 'Medical Leave (ML)', 'Long Absent'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setModalStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                      modalStatusFilter === st
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st === 'Medical Leave (ML)' ? 'ML' : st === 'On Duty (OD)' ? 'OD' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Read-Only Student Status Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-800 rounded-xl">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : filteredStudentDetails.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  No student records match selected filter.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 sticky top-0 backdrop-blur-md">
                      <th className="px-6 py-3">Student Name</th>
                      <th className="px-6 py-3">Register No</th>
                      <th className="px-6 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredStudentDetails.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-800/10">
                        <td className="px-6 py-3 font-bold text-slate-100">
                          {student.studentName}
                        </td>
                        <td className="px-6 py-3 font-mono text-slate-400 font-semibold">
                          {student.registerNumber}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {getStatusBadge(student.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
              <span className="text-slate-400 font-medium">
                Displaying {filteredStudentDetails.length} of {studentDetails.length} students
              </span>
              <button
                onClick={() => setSelectedSession(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

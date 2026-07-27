'use client';

import { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  Filter,
  ShieldCheck,
  Info,
  UserCheck,
  Share2,
} from 'lucide-react';
import { shareDetailsElement } from '@/lib/nativeShare';

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

  // Active Expanded Session State for "Show Details"
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionStudentMap, setSessionStudentMap] = useState<Record<string, StudentDetailRecord[]>>({});
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);
  const [sharingSessionId, setSharingSessionId] = useState<string | null>(null);

  // Search & Filter inside expanded Show Details section
  const [detailsSearchQuery, setDetailsSearchQuery] = useState('');
  const [detailsStatusFilter, setDetailsStatusFilter] = useState<string>('ALL');

  // React Refs for expanded details section elements
  const detailsRefMap = useRef<Record<string, HTMLDivElement | null>>({});

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

  // Toggle "Show Details" for a specific date session
  const handleToggleDetails = async (sessionItem: AttendanceSession) => {
    if (expandedSessionId === sessionItem.id) {
      setExpandedSessionId(null);
      return;
    }

    setExpandedSessionId(sessionItem.id);
    setDetailsSearchQuery('');
    setDetailsStatusFilter('ALL');

    // Fetch student details if not already loaded for this session
    if (!sessionStudentMap[sessionItem.id]) {
      setLoadingDetailsId(sessionItem.id);
      try {
        const res = await getSessionStudentDetailsAction(sessionItem.date);
        if (res.success && res.data) {
          setSessionStudentMap((prev) => ({
            ...prev,
            [sessionItem.id]: res.data,
          }));
        }
      } catch (err) {
        console.error('Failed to load session student details:', err);
      } finally {
        setLoadingDetailsId(null);
      }
    }
  };

  // Share handler for currently opened Show Details section
  const handleShareSection = async (sessionItem: AttendanceSession) => {
    const sectionElement = detailsRefMap.current[sessionItem.id];
    const studentList = sessionStudentMap[sessionItem.id] || [];

    if (!sectionElement) return;

    setSharingSessionId(sessionItem.id);
    try {
      await shareDetailsElement({
        element: sectionElement,
        date: sessionItem.date,
        subject: sessionItem.subject,
        period: sessionItem.period,
        present: sessionItem.present,
        absent: sessionItem.absent,
        od: sessionItem.od,
        ml: sessionItem.ml,
        la: sessionItem.la,
        totalStudents: sessionItem.totalStudents,
        studentDetails: studentList,
      });
    } catch (err) {
      console.error('Error sharing attendance details:', err);
    } finally {
      setSharingSessionId(null);
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
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Present
          </span>
        );
      case 'Absent':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            Absent
          </span>
        );
      case 'On Duty (OD)':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            On Duty (OD)
          </span>
        );
      case 'Medical Leave (ML)':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            Medical Leave
          </span>
        );
      case 'Long Absent':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and Read-Only Banner */}
      <div className="glass p-6 rounded-3xl flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center shadow-xl">
        <div className="space-y-1">
          <h3 className="text-2xl font-extrabold text-slate-100 light:text-slate-900 flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <History className="w-6 h-6" />
            </div>
            <span>Attendance History (Date-Wise)</span>
          </h3>
          <p className="text-xs text-slate-400 light:text-slate-600">
            Strictly read-only session records stored directly in Neon PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-2xl text-xs text-indigo-300 light:text-indigo-700 font-semibold shadow-inner">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>To modify attendance, please use the Take Attendance page.</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search by date or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs transition-all"
            />
          </div>

          {/* Date Picker Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />

          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
            >
              Clear Date
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400 light:text-slate-600 font-semibold">
          Total Date Sessions: {filteredSessions.length}
        </span>
      </div>

      {/* Main Sessions List (Date-Wise Display) */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="glass p-12 rounded-3xl text-center text-slate-400 light:text-slate-600 text-sm shadow-xl">
          No saved attendance sessions found matching filter. Use Take Attendance page to submit session attendance.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const studentDetails = sessionStudentMap[session.id] || [];
            const isLoadingDetails = loadingDetailsId === session.id;
            const isSharing = sharingSessionId === session.id;

            // Filter student details inside this expanded date section
            const filteredStudentDetails = studentDetails.filter((st) => {
              const q = detailsSearchQuery.toLowerCase();
              const matchesQuery =
                st.studentName.toLowerCase().includes(q) ||
                st.registerNumber.toLowerCase().includes(q);
              const matchesStatus =
                detailsStatusFilter === 'ALL' || st.status === detailsStatusFilter;
              return matchesQuery && matchesStatus;
            });

            return (
              <div
                key={session.id}
                className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 overflow-hidden shadow-xl transition-all"
              >
                {/* Session Card Header Bar */}
                <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/40 light:bg-slate-100/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-100 light:text-slate-900">
                          {session.date}
                        </h4>
                        <p className="text-xs text-indigo-400 light:text-indigo-600 font-semibold">
                          {session.subject} &bull; Period {session.period}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary Badges Preview */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      P: {session.present}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                      A: {session.absent}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                      OD: {session.od}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                      ML: {session.ml}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 font-bold">
                      LA: {session.la}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 font-bold">
                      Total: {session.totalStudents}
                    </span>

                    {/* SHOW DETAILS BUTTON FOR THIS SPECIFIC DATE */}
                    <button
                      onClick={() => handleToggleDetails(session)}
                      className={`ml-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
                        isExpanded
                          ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          : 'btn-gradient'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* EXPANDED "SHOW DETAILS" SECTION FOR THIS DATE */}
                {isExpanded && (
                  <div
                    ref={(el) => {
                      detailsRefMap.current[session.id] = el;
                    }}
                    className="p-6 border-t border-slate-800 light:border-slate-200 bg-slate-950/60 light:bg-white space-y-6"
                  >
                    {/* Section Header with Date & SHARE BUTTON */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 light:border-slate-200">
                      <div>
                        <div className="flex items-center gap-2 text-base font-extrabold text-slate-100 light:text-slate-900">
                          <UserCheck className="w-5 h-5 text-indigo-400" />
                          <span>Attendance Report for {session.date}</span>
                        </div>
                        <p className="text-xs text-slate-400 light:text-slate-500 mt-1">
                          {session.subject} &bull; Period {session.period} &bull; Saved at {session.savedAt} by {session.savedBy}
                        </p>
                      </div>

                      {/* SHARE BUTTON ONLY INSIDE EXPANDED SHOW DETAILS SECTION */}
                      <button
                        onClick={() => handleShareSection(session)}
                        disabled={isSharing || isLoadingDetails}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                        title={`Share report for ${session.date}`}
                      >
                        {isSharing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                        <span>{isSharing ? 'Capturing Image...' : 'Share Date Report'}</span>
                      </button>
                    </div>

                    {/* Attendance Summary Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center text-xs">
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="block text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Present</span>
                        <span className="text-xl font-black text-emerald-400">{session.present}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                        <span className="block text-[10px] text-rose-400 font-bold uppercase tracking-wider">Absent</span>
                        <span className="text-xl font-black text-rose-400">{session.absent}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                        <span className="block text-[10px] text-blue-400 font-bold uppercase tracking-wider">OD</span>
                        <span className="text-xl font-black text-blue-400">{session.od}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                        <span className="block text-[10px] text-purple-400 font-bold uppercase tracking-wider">ML</span>
                        <span className="text-xl font-black text-purple-400">{session.ml}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-zinc-500/10 border border-zinc-500/20">
                        <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Long Absent</span>
                        <span className="text-xl font-black text-zinc-400">{session.la}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-800/80 light:bg-slate-100 border border-slate-700/50 light:border-slate-300">
                        <span className="block text-[10px] text-slate-400 light:text-slate-600 font-bold uppercase tracking-wider">Total</span>
                        <span className="text-xl font-black text-slate-200 light:text-slate-900">{session.totalStudents}</span>
                      </div>
                    </div>

                    {/* Student List Filters Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search student name or register no..."
                          value={detailsSearchQuery}
                          onChange={(e) => setDetailsSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-slate-900/80 light:bg-slate-50 border border-slate-800 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 mr-1" />
                        {['ALL', 'Present', 'Absent', 'On Duty (OD)', 'Medical Leave (ML)', 'Long Absent'].map((st) => (
                          <button
                            key={st}
                            onClick={() => setDetailsStatusFilter(st)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                              detailsStatusFilter === st
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-slate-800/60 light:bg-slate-200 text-slate-400 light:text-slate-700 hover:bg-slate-800'
                            }`}
                          >
                            {st === 'Medical Leave (ML)' ? 'ML' : st === 'On Duty (OD)' ? 'OD' : st}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Student List Table */}
                    <div className="border border-slate-800 light:border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto custom-scrollbar">
                      {isLoadingDetails ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                      ) : filteredStudentDetails.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 text-xs">
                          No student records match selected filter.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900/90 light:bg-slate-100 border-b border-slate-800 light:border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 sticky top-0 backdrop-blur-md">
                              <th className="px-6 py-3">#</th>
                              <th className="px-6 py-3">Student Name</th>
                              <th className="px-6 py-3">Register No</th>
                              <th className="px-6 py-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 light:divide-slate-200">
                            {filteredStudentDetails.map((student, idx) => (
                              <tr key={student.id || idx} className="hover:bg-slate-800/20 light:hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 text-slate-500 font-mono">{idx + 1}</td>
                                <td className="px-6 py-3 font-bold text-slate-100 light:text-slate-900">
                                  {student.studentName}
                                </td>
                                <td className="px-6 py-3 font-mono text-slate-400 light:text-slate-600 font-semibold">
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

                    <div className="flex items-center justify-between text-xs text-slate-400 light:text-slate-500 pt-2 font-medium">
                      <span>Showing {filteredStudentDetails.length} of {studentDetails.length} students</span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                        <ShieldCheck className="w-4 h-4 shrink-0" /> Strictly Read-Only
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

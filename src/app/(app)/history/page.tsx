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
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { shareStatusCardAsImage } from '@/lib/nativeShare';
import { normalizeStatus } from '@/lib/db-api';

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

  // Search & Global Date Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Active Expanded Session State for "Show Details"
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionStudentMap, setSessionStudentMap] = useState<Record<string, StudentDetailRecord[]>>({});
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);
  const [sharingCardKey, setSharingCardKey] = useState<string | null>(null);

  // Map of selected status tab for each session (e.g. 'Present', 'Absent', 'OD', 'ML', 'LA', 'ALL')
  const [sessionStatusTabMap, setSessionStatusTabMap] = useState<Record<string, string>>({});

  // Search filter inside expanded status detail card
  const [detailsSearchQuery, setDetailsSearchQuery] = useState('');

  // React Refs for specific status detail card DOM elements
  const statusCardRefMap = useRef<Record<string, HTMLDivElement | null>>({});

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

  // Fetch student details if not already cached
  const ensureStudentDetailsLoaded = async (sessionId: string, sessionDate: string) => {
    if (!sessionStudentMap[sessionId]) {
      setLoadingDetailsId(sessionId);
      try {
        const res = await getSessionStudentDetailsAction(sessionDate);
        if (res.success && res.data) {
          setSessionStudentMap((prev) => ({
            ...prev,
            [sessionId]: res.data,
          }));
        }
      } catch (err) {
        console.error('Failed to load session student details:', err);
      } finally {
        setLoadingDetailsId(null);
      }
    }
  };

  // Toggle "Show Details" for a specific date session
  const handleToggleDetails = async (sessionItem: AttendanceSession, defaultStatus = 'Present') => {
    if (expandedSessionId === sessionItem.id && sessionStatusTabMap[sessionItem.id] === defaultStatus) {
      setExpandedSessionId(null);
      return;
    }

    setExpandedSessionId(sessionItem.id);
    setSessionStatusTabMap((prev) => ({
      ...prev,
      [sessionItem.id]: defaultStatus,
    }));
    setDetailsSearchQuery('');

    await ensureStudentDetailsLoaded(sessionItem.id, sessionItem.date);
  };

  // Click handler directly on status pills (Present, Absent, OD, ML, LA)
  const handleStatusBadgeClick = async (sessionItem: AttendanceSession, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSessionId(sessionItem.id);
    setSessionStatusTabMap((prev) => ({
      ...prev,
      [sessionItem.id]: status,
    }));
    setDetailsSearchQuery('');

    await ensureStudentDetailsLoaded(sessionItem.id, sessionItem.date);
  };

  // Share handler for ONLY the specific status detail card image
  const handleShareStatusCard = async (sessionItem: AttendanceSession, status: string) => {
    const cardKey = `${sessionItem.id}_${status}`;
    setSharingCardKey(cardKey);

    try {
      console.log(`[Share] Generating Canvas PNG report image for status: "${status}" on date: "${sessionItem.date}"`);

      const studentDetails = sessionStudentMap[sessionItem.id] || [];
      const statusFilteredStudents = studentDetails.filter((st) =>
        matchesTargetStatus(st.status, status)
      );

      const cleanDate = sessionItem.date.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanStatus = status.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Attendance_${cleanDate}_P${sessionItem.period}_${cleanStatus}.png`;

      await shareStatusCardAsImage({
        date: sessionItem.date,
        subject: sessionItem.subject,
        period: sessionItem.period,
        status,
        totalStudentsCount: sessionItem.totalStudents,
        studentList: statusFilteredStudents,
        fileName,
      });
    } catch (err: any) {
      console.error('[Share] Error sharing status card image:', err);
      if (err?.name !== 'AbortError') {
        alert('Sharing is not supported on this browser. The attendance report image has been downloaded instead.');
      }
    } finally {
      // ALWAYS clear loading state so UI never gets stuck
      setSharingCardKey(null);
    }
  };

  // Helper function to check if student record matches target status
  const matchesTargetStatus = (studentStatus: string, targetStatus: string) => {
    if (targetStatus === 'ALL') return true;
    const normStudent = normalizeStatus(studentStatus);
    const normTarget = normalizeStatus(targetStatus);
    return normStudent === normTarget;
  };

  // Filter session list by query/date
  const filteredSessions = sessions.filter((s) => {
    const matchesDate = !dateFilter || s.date === dateFilter;
    const matchesSearch =
      !searchQuery ||
      s.date.includes(searchQuery) ||
      s.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDate && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const norm = normalizeStatus(status);
    switch (norm) {
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
      case 'OD':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            On Duty (OD)
          </span>
        );
      case 'Medical Leave':
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
            {status || 'Unmarked'}
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
            <span>Attendance History (Date & Status Wise)</span>
          </h3>
          <p className="text-xs text-slate-400 light:text-slate-600">
            Click any status (Present, Absent, OD, ML, LA) to open and share its status detail card as an image.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-2xl text-xs text-indigo-300 light:text-indigo-700 font-semibold shadow-inner">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Strictly Read-Only Records</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by date or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs transition-all"
            />
          </div>

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
          Total Sessions: {filteredSessions.length}
        </span>
      </div>

      {/* Main Sessions List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="glass p-12 rounded-3xl text-center text-slate-400 light:text-slate-600 text-sm shadow-xl">
          No attendance sessions found matching filter.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const activeStatus = sessionStatusTabMap[session.id] || 'Present';
            const studentDetails = sessionStudentMap[session.id] || [];
            const isLoadingDetails = loadingDetailsId === session.id;
            const currentCardKey = `${session.id}_${activeStatus}`;
            const isSharing = sharingCardKey === currentCardKey;

            // Filter student details for ONLY the active selected status
            const statusFilteredStudents = studentDetails.filter((st) => {
              const matchesStatus = matchesTargetStatus(st.status, activeStatus);
              const q = detailsSearchQuery.toLowerCase();
              const matchesQuery =
                !q ||
                st.studentName.toLowerCase().includes(q) ||
                st.registerNumber.toLowerCase().includes(q);
              return matchesStatus && matchesQuery;
            });

            // Get total count for active status
            const getStatusCount = (status: string) => {
              const norm = normalizeStatus(status);
              switch (norm) {
                case 'Present': return session.present;
                case 'Absent': return session.absent;
                case 'OD': return session.od;
                case 'Medical Leave': return session.ml;
                case 'Long Absent': return session.la;
                default:
                  if (status === 'ALL') return session.totalStudents;
                  return 0;
              }
            };

            const activeStatusCount = getStatusCount(activeStatus);

            if (isExpanded && studentDetails.length > 0) {
              const rawCounts = studentDetails.reduce((acc: Record<string, number>, s) => {
                const norm = normalizeStatus(s.status);
                acc[norm] = (acc[norm] || 0) + 1;
                return acc;
              }, {});

              console.log(`[History Debug] Selected Session Object:`, {
                id: session.id,
                date: session.date,
                present: session.present,
                absent: session.absent,
                totalStudents: session.totalStudents,
              });
              console.log(`[History Debug] Session "${session.date}" Raw DB Statuses:`, rawCounts);
              console.log(`[History Debug] Session "${session.date}" Active Tab: "${activeStatus}" -> Filtered Student Count: ${statusFilteredStudents.length}`);
            }

            return (
              <div
                key={session.id}
                className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 overflow-hidden shadow-xl transition-all"
              >
                {/* Session Date Card Header */}
                <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/40 light:bg-slate-100/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-100 light:text-slate-900">
                          {session.date}
                        </h4>
                        <p className="text-xs text-indigo-400 light:text-indigo-600 font-bold">
                          {session.subject} &bull; Period {session.period}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CLICKABLE STATUS BADGES IN HEADER */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      onClick={(e) => handleStatusBadgeClick(session, 'Present', e)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                        isExpanded && activeStatus === 'Present'
                          ? 'bg-emerald-500 text-white shadow-lg scale-105'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                      }`}
                      title="Click to view Present students report"
                    >
                      Present: {session.present}
                    </button>

                    <button
                      onClick={(e) => handleStatusBadgeClick(session, 'Absent', e)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                        isExpanded && activeStatus === 'Absent'
                          ? 'bg-rose-500 text-white shadow-lg scale-105'
                          : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                      }`}
                      title="Click to view Absent students report"
                    >
                      Absent: {session.absent}
                    </button>

                    <button
                      onClick={(e) => handleStatusBadgeClick(session, 'OD', e)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                        isExpanded && activeStatus === 'OD'
                          ? 'bg-blue-500 text-white shadow-lg scale-105'
                          : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20'
                      }`}
                      title="Click to view OD students report"
                    >
                      OD: {session.od}
                    </button>

                    <button
                      onClick={(e) => handleStatusBadgeClick(session, 'ML', e)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                        isExpanded && activeStatus === 'ML'
                          ? 'bg-purple-500 text-white shadow-lg scale-105'
                          : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20'
                      }`}
                      title="Click to view ML students report"
                    >
                      ML: {session.ml}
                    </button>

                    <button
                      onClick={(e) => handleStatusBadgeClick(session, 'LA', e)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                        isExpanded && activeStatus === 'LA'
                          ? 'bg-zinc-500 text-white shadow-lg scale-105'
                          : 'bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-400 border border-zinc-500/20'
                      }`}
                      title="Click to view Long Absent students report"
                    >
                      LA: {session.la}
                    </button>

                    {/* Show Details Button */}
                    <button
                      onClick={() => handleToggleDetails(session, 'Present')}
                      className={`ml-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
                        isExpanded
                          ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          : 'btn-gradient'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* EXPANDED STATUS DETAIL SECTION */}
                {isExpanded && (
                  <div className="p-6 border-t border-slate-800 light:border-slate-200 bg-slate-950/70 light:bg-slate-50 space-y-6">
                    {/* Status Tabs Bar */}
                    <div className="flex items-center justify-between gap-4 border-b border-slate-800 light:border-slate-200 pb-4 overflow-x-auto">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 light:text-slate-600 mr-2">
                          Select Status:
                        </span>

                        {[
                          { id: 'Present', label: `Present (${session.present})`, color: 'emerald' },
                          { id: 'Absent', label: `Absent (${session.absent})`, color: 'rose' },
                          { id: 'OD', label: `OD (${session.od})`, color: 'blue' },
                          { id: 'ML', label: `ML (${session.ml})`, color: 'purple' },
                          { id: 'LA', label: `Long Absent (${session.la})`, color: 'zinc' },
                          { id: 'ALL', label: `All Students (${session.totalStudents})`, color: 'indigo' },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setSessionStatusTabMap((prev) => ({
                                ...prev,
                                [session.id]: tab.id,
                              }));
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                              activeStatus === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg scale-105'
                                : 'bg-slate-900 light:bg-white text-slate-400 light:text-slate-700 hover:bg-slate-800 border border-slate-800 light:border-slate-300'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Filter Search Input */}
                      <div className="relative w-48 shrink-0">
                        <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search in status..."
                          value={detailsSearchQuery}
                          onChange={(e) => setDetailsSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-900/90 light:bg-white border border-slate-800 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* SEPARATE STATUS DETAIL CARD FOR THE SELECTED STATUS */}
                    <div
                      ref={(el) => {
                        statusCardRefMap.current[currentCardKey] = el;
                      }}
                      className="glass-card p-6 rounded-3xl border border-slate-800 light:border-slate-300 bg-slate-900 light:bg-white shadow-2xl space-y-6"
                    >
                      {/* CARD HEADER WITH TOP-RIGHT SHARE BUTTON */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 light:border-slate-200">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-slate-100 light:text-slate-900">
                              {session.date}
                            </span>
                            {getStatusBadge(activeStatus === 'ALL' ? 'Total' : activeStatus)}
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                              Count: {activeStatusCount}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 light:text-slate-600 font-medium">
                            {session.subject} &bull; Period {session.period} &bull; Saved by {session.savedBy}
                          </p>
                        </div>

                        {/* SHARE BUTTON AT TOP-RIGHT OF THIS SPECIFIC STATUS DETAIL CARD */}
                        <button
                          onClick={() => handleShareStatusCard(session, activeStatus)}
                          disabled={isSharing || isLoadingDetails || statusFilteredStudents.length === 0}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                          title={
                            statusFilteredStudents.length === 0
                              ? 'No students to share for this status'
                              : `Share ${activeStatus} status card image`
                          }
                        >
                          {isSharing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Share2 className="w-4 h-4" />
                          )}
                          <span>{isSharing ? 'Capturing Image...' : `Share ${activeStatus === 'ALL' ? 'Session' : activeStatus} Image`}</span>
                        </button>
                      </div>

                      {/* CARD BODY: STUDENTS TABLE SHOWING ONLY SELECTED STATUS */}
                      <div className="border border-slate-800 light:border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto custom-scrollbar">
                        {isLoadingDetails ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                          </div>
                        ) : statusFilteredStudents.length === 0 ? (
                          <div className="py-12 text-center text-slate-400 light:text-slate-500 text-xs font-semibold">
                            No students found for this status.
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-950/80 light:bg-slate-100 border-b border-slate-800 light:border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 sticky top-0 backdrop-blur-md">
                                <th className="px-6 py-3.5">#</th>
                                <th className="px-6 py-3.5">Student Name</th>
                                <th className="px-6 py-3.5">Register No</th>
                                <th className="px-6 py-3.5 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850 light:divide-slate-200">
                              {statusFilteredStudents.map((student, idx) => (
                                <tr
                                  key={student.id || idx}
                                  className="hover:bg-slate-800/20 light:hover:bg-slate-50 transition-colors"
                                >
                                  <td className="px-6 py-3.5 text-slate-500 font-mono font-bold">{idx + 1}</td>
                                  <td className="px-6 py-3.5 font-bold text-slate-100 light:text-slate-900">
                                    {student.studentName}
                                  </td>
                                  <td className="px-6 py-3.5 font-mono text-indigo-400 light:text-indigo-600 font-bold">
                                    {student.registerNumber}
                                  </td>
                                  <td className="px-6 py-3.5 text-right">
                                    {getStatusBadge(student.status)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* CARD FOOTER */}
                      <div className="flex items-center justify-between text-xs text-slate-400 light:text-slate-500 pt-2 font-semibold">
                        <span>
                          Displaying <strong className="text-slate-200 light:text-slate-900">{statusFilteredStudents.length}</strong> {activeStatus} student(s)
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                          <ShieldCheck className="w-4 h-4 shrink-0" /> Strictly Read-Only Report
                        </span>
                      </div>
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

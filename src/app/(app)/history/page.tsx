'use client';

import { useState, useEffect } from 'react';
import {
  getAllStudents,
  getAttendanceForDateAndPeriodAction,
  saveBulkAttendanceAction,
} from '@/app/actions';
import { SUBJECTS, PeriodNumber, ATTENDANCE_STATUSES, AttendanceStatus } from '@/lib/db-api';
import {
  Calendar,
  Clock,
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  History,
  Check,
} from 'lucide-react';

interface Student {
  id: number;
  registerNumber: string;
  studentName: string;
  department: string;
  year: string;
  section: string;
}

interface AttendanceMap {
  [studentId: number]: AttendanceStatus | 'Unmarked';
}

export default function HistoryPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState<number>(1);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load students and active attendance for selected date/period
  const loadData = async () => {
    setLoading(true);
    setSavingState('idle');
    try {
      const studentsData = await getAllStudents();
      setStudents(studentsData);

      const attResult = await getAttendanceForDateAndPeriodAction(date, period);
      if (attResult.success && attResult.data) {
        const newMap: AttendanceMap = {};
        studentsData.forEach((student: Student) => {
          newMap[student.id] = attResult.data![student.id] || 'Unmarked';
        });
        setAttendance(newMap);
      } else {
        const newMap: AttendanceMap = {};
        studentsData.forEach((student: Student) => {
          newMap[student.id] = 'Unmarked';
        });
        setAttendance(newMap);
      }
    } catch (error) {
      console.error('Failed to load history data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [date, period]);

  // Handle live edit and save
  const handleStatusChange = async (studentId: number, status: AttendanceStatus) => {
    const prevStatus = attendance[studentId];
    const newAttendance = { ...attendance, [studentId]: status };
    setAttendance(newAttendance);
    setSavingState('saving');

    try {
      const result = await saveBulkAttendanceAction(date, period, [
        { studentId, status },
      ]);
      if (result.success) {
        setSavingState('saved');
        setTimeout(() => setSavingState((s) => (s === 'saved' ? 'idle' : s)), 2000);
      } else {
        setSavingState('error');
        setAttendance({ ...attendance, [studentId]: prevStatus });
      }
    } catch (err) {
      setSavingState('error');
      setAttendance({ ...attendance, [studentId]: prevStatus });
    }
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.registerNumber.toLowerCase().includes(q) ||
      s.studentName.toLowerCase().includes(q)
    );
  });

  const getStatusStyle = (status: AttendanceStatus, currentStatus: string, activeClass: string) => {
    const isActive = currentStatus === status;
    return isActive
      ? `${activeClass} scale-105 border-transparent text-white font-bold ring-2 ring-offset-2 ring-offset-slate-900 ring-indigo-500/50`
      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200';
  };

  // Stat summary for this period
  const totalMarked = Object.values(attendance).filter((s) => s !== 'Unmarked').length;
  const countStats = {
    Present: Object.values(attendance).filter((s) => s === 'Present').length,
    Absent: Object.values(attendance).filter((s) => s === 'Absent').length,
    ELITE: Object.values(attendance).filter((s) => s === 'ELITE').length,
    'On Duty': Object.values(attendance).filter((s) => s === 'On Duty').length,
    'Medical Leave': Object.values(attendance).filter((s) => s === 'Medical Leave').length,
    'Long Leave': Object.values(attendance).filter((s) => s === 'Long Leave').length,
    Unmarked: Object.values(attendance).filter((s) => s === 'Unmarked').length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Date & Period filter card */}
      <div className="glass p-6 rounded-2xl flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <span>Attendance History Logs</span>
          </h3>
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            View & Edit records for: <strong className="text-indigo-400">{SUBJECTS[period as PeriodNumber]}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
          {/* Date Picker */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
              Select Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Period Selector */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
              Select Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  Period {p} ({SUBJECTS[p as PeriodNumber]})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary strip & Auto saving indicator */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        {/* Autosave message */}
        <div className="flex items-center gap-2 text-sm">
          {savingState === 'saving' && (
            <span className="flex items-center gap-1.5 text-indigo-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Autosaving database change...</span>
            </span>
          )}
          {savingState === 'saved' && (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Record updated automatically!</span>
            </span>
          )}
          {savingState === 'error' && (
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>Update failed. Verify connection.</span>
            </span>
          )}
          {savingState === 'idle' && (
            <span className="text-slate-400 text-xs">
              Click any status button to edit. Changes are written to the database automatically.
            </span>
          )}
        </div>

        {/* Attendance stats summary */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-2 text-xs">
          <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
            Log Summary:
          </span>
          <span className="text-emerald-400">P: {countStats.Present}</span>
          <span className="text-rose-400">A: {countStats.Absent}</span>
          <span className="text-amber-400">E: {countStats.ELITE}</span>
          <span className="text-blue-400">OD: {countStats.Present + countStats['On Duty']}</span>
          <span className="text-purple-400">ML: {countStats.Present + countStats['Medical Leave']}</span>
          <span className="text-slate-400">LL: {countStats.Present + countStats['Long Leave']}</span>
          <span className="text-slate-500">Unmarked: {countStats.Unmarked}</span>
        </div>
      </div>

      {/* Main Student Attendance Grid Workspace */}
      <div className="glass rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {/* Search */}
        <div className="p-4 bg-slate-950/20 border-b border-slate-850 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search history by student name or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
            />
          </div>
          <span className="text-xs text-slate-500 ml-auto font-medium">
            Showing {filteredStudents.length} records
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-20 px-4 text-slate-500">
            No history logs match search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4 w-1/4">Student Info</th>
                  <th className="px-6 py-4 text-center">Marked Status & Edit Buttons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredStudents.map((student) => {
                  const currentStatus = attendance[student.id] || 'Unmarked';
                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-800/10 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-100">
                          {student.studentName}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          {student.registerNumber} &bull; {student.department} {student.year} Sec {student.section}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                          {/* Present */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'Present')}
                            className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'Present',
                              currentStatus,
                              'bg-emerald-600 hover:bg-emerald-500'
                            )}`}
                          >
                            P
                          </button>

                          {/* Absent */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'Absent')}
                            className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'Absent',
                              currentStatus,
                              'bg-rose-600 hover:bg-rose-500'
                            )}`}
                          >
                            A
                          </button>

                          {/* ELITE */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'ELITE')}
                            className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'ELITE',
                              currentStatus,
                              'bg-amber-600 hover:bg-amber-500'
                            )}`}
                          >
                            ELITE
                          </button>

                          {/* On Duty */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'On Duty')}
                            className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'On Duty',
                              currentStatus,
                              'bg-blue-600 hover:bg-blue-500'
                            )}`}
                          >
                            OD
                          </button>

                          {/* Medical Leave */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'Medical Leave')}
                            className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'Medical Leave',
                              currentStatus,
                              'bg-purple-600 hover:bg-purple-500'
                            )}`}
                          >
                            ML
                          </button>

                          {/* Long Leave */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'Long Leave')}
                            className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'Long Leave',
                              currentStatus,
                              'bg-zinc-600 hover:bg-zinc-500'
                            )}`}
                          >
                            LL
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

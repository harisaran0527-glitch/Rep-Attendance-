'use client';

import { useState, useEffect } from 'react';
import {
  getAllStudentsWithStats,
  getAttendanceForDateAction,
  saveBulkAttendanceAction,
} from '@/app/actions';
import { ATTENDANCE_STATUSES, AttendanceStatus } from '@/lib/db-api';
import {
  Calendar,
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  UserX,
} from 'lucide-react';

interface Student {
  id: number;
  registerNumber: string;
  studentName: string;
  department: string;
  year: string;
  section: string;
  percentage?: number;
}

interface AttendanceMap {
  [studentId: number]: AttendanceStatus | 'Unmarked';
}

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load students & existing attendance
  const loadData = async () => {
    setLoading(true);
    setSavingState('idle');
    try {
      const studentsData = await getAllStudentsWithStats();
      setStudents(studentsData);

      const attResult = await getAttendanceForDateAction(date);
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
      console.error('Failed to load attendance page data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [date]);

  // Handle single student attendance save immediately
  const handleStatusChange = async (studentId: number, status: AttendanceStatus) => {
    // 1. Instantly update UI state (optimistic)
    const prevStatus = attendance[studentId];
    const newAttendance = { ...attendance, [studentId]: status };
    setAttendance(newAttendance);
    setSavingState('saving');

    // 2. Perform database write in background
    try {
      const result = await saveBulkAttendanceAction(date, [
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

  // Calculate live list of absent students for current date
  const absentStudents = students.filter(
    (s) => attendance[s.id] === 'Absent' || attendance[s.id] === 'Long Absent'
  );

  const getStatusStyle = (status: AttendanceStatus, currentStatus: string, activeClass: string) => {
    const isActive = currentStatus === status;
    return isActive
      ? `${activeClass} scale-105 border-transparent text-white font-bold ring-2 ring-offset-2 ring-offset-slate-900 ring-indigo-500/50`
      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Configuration Header Card */}
      <div className="glass p-6 rounded-2xl flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Mark Daily Attendance</span>
          </h3>
          <p className="text-xs text-slate-400">
            Select a date to mark general daily attendance (Present / Absent) for each student.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto">
          {/* Date Picker */}
          <div className="w-full sm:w-64">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
              Attendance Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Auto Saving status panel */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {savingState === 'saving' && (
            <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving database updates...</span>
            </span>
          )}
          {savingState === 'saved' && (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Database updated successfully!</span>
            </span>
          )}
          {savingState === 'error' && (
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>Failed to save. Try again.</span>
            </span>
          )}
          {savingState === 'idle' && (
            <span className="text-slate-400 text-xs">
              General daily attendance is saved to database in real-time.
            </span>
          )}
        </div>
      </div>

      {/* IMMEDIATE ABSENT STUDENTS SUMMARY PANEL */}
      <div className="glass p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <UserX className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Absent Students Summary</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {date}
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Displays all students marked absent for {date} immediately upon updating status.
              </p>
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            absentStudents.length > 0
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {absentStudents.length} Absent Today
          </span>
        </div>

        {absentStudents.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>All students are currently marked Present for {date}.</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5 pt-1">
            {absentStudents.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-xs shadow-sm"
              >
                <span className="font-mono font-bold text-rose-400">{s.registerNumber}</span>
                <span className="font-semibold text-white">{s.studentName}</span>
                <span className="text-[10px] text-rose-300/70 font-mono">({s.department} {s.year}-{s.section})</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 ml-1">
                  {attendance[s.id]}
                </span>
              </div>
            ))}
          </div>
        )}
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
              placeholder="Filter list by name or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
            />
          </div>
          <span className="text-xs text-slate-500 ml-auto font-medium">
            Showing {filteredStudents.length} of {students.length} students
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-20 px-4 text-slate-500">
            No students found matching filters.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4 w-1/3">Student Details</th>
                  <th className="px-6 py-4 text-center">Mark Daily Attendance</th>
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
                        <div className="font-semibold text-slate-100 flex items-center gap-2">
                          {student.studentName}
                          {student.percentage !== undefined && (
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                              student.percentage >= 75 ? 'bg-emerald-500/10 text-emerald-400' :
                              student.percentage >= 65 ? 'bg-yellow-500/10 text-yellow-400' :
                              'bg-red-500/10 text-red-400'
                            }`}>
                              {student.percentage}%
                            </span>
                          )}
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
                            className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'Present',
                              currentStatus,
                              'bg-emerald-600 hover:bg-emerald-500'
                            )}`}
                          >
                            Present
                          </button>

                          {/* Absent */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'Absent')}
                            className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'Absent',
                              currentStatus,
                              'bg-rose-600 hover:bg-rose-500'
                            )}`}
                          >
                            Absent
                          </button>

                          {/* Late */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'Late')}
                            className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'Late',
                              currentStatus,
                              'bg-amber-600 hover:bg-amber-500'
                            )}`}
                          >
                            Late
                          </button>

                          {/* On Duty */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'On Duty (OD)')}
                            className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'On Duty (OD)',
                              currentStatus,
                              'bg-blue-600 hover:bg-blue-500'
                            )}`}
                          >
                            OD
                          </button>

                          {/* Medical Leave */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'Medical Leave (ML)')}
                            className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'Medical Leave (ML)',
                              currentStatus,
                              'bg-purple-600 hover:bg-purple-500'
                            )}`}
                          >
                            ML
                          </button>

                          {/* Long Absent */}
                          <button
                            onClick={() => handleStatusChange(student.id, 'Long Absent')}
                            className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${getStatusStyle(
                              'Long Absent',
                              currentStatus,
                              'bg-zinc-600 hover:bg-zinc-500'
                            )}`}
                          >
                            LA
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

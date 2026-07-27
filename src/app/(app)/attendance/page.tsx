'use client';

import { useState, useEffect } from 'react';
import {
  getAllStudentsWithStats,
  getAttendanceForDateAction,
  saveBulkAttendanceAction,
  clearSavedAttendanceAction,
} from '@/app/actions';
import { AttendanceStatus } from '@/lib/db-api';
import {
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  UserX,
  Save,
  CheckCheck,
  HelpCircle,
  RotateCcw,
  X,
  Trash2,
  ShieldAlert,
  XCircle,
  CalendarX,
  Info,
} from 'lucide-react';
import { isSundayDate, isSaturdayDate, isHoliday } from '@/lib/holidays';

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

const NON_PRESENT_STATUSES: AttendanceStatus[] = [
  'Absent',
  'Medical Leave (ML)',
  'Long Absent',
];

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExisting, setIsExisting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [showClearSavedModal, setShowClearSavedModal] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [savedRecordCount, setSavedRecordCount] = useState(0);

  const isSelectedSunday = isSundayDate(date);
  const isSelectedHoliday = isHoliday(date);
  const isBlockedDate = isSelectedSunday || isSelectedHoliday;
  const blockedReason = isSelectedSunday ? 'Sunday' : 'Holiday';

  const loadData = async () => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const studentsData = await getAllStudentsWithStats();
      setStudents(studentsData);

      const attResult = await getAttendanceForDateAction(date);
      if (attResult.success && attResult.data && Object.keys(attResult.data).length > 0) {
        setIsExisting(true);
        const newMap: AttendanceMap = {};
        let count = 0;
        studentsData.forEach((student: Student) => {
          newMap[student.id] = attResult.data![student.id] || 'Unmarked';
          if (attResult.data![student.id]) count++;
        });
        setAttendance(newMap);
        setSavedRecordCount(count);
      } else {
        setIsExisting(false);
        const newMap: AttendanceMap = {};
        studentsData.forEach((student: Student) => {
          newMap[student.id] = 'Unmarked';
        });
        setAttendance(newMap);
        setSavedRecordCount(0);
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

  const handleStatusChange = (studentId: number, status: AttendanceStatus) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
    setSuccessMsg(null);
  };

  const handleClearStudent = (studentId: number) => {
    setAttendance((prev) => ({ ...prev, [studentId]: 'Unmarked' }));
    setSuccessMsg(null);
  };

  const handleMarkAllPresent = () => {
    const updated: AttendanceMap = {};
    students.forEach((s) => {
      updated[s.id] = 'Present';
    });
    setAttendance(updated);
    setSuccessMsg(null);
  };

  const handleResetAllUnsaved = async () => {
    await loadData();
    setShowResetModal(false);
    setSuccessMsg('All attendance selections have been reset to the saved state.');
  };

  const handleClearSavedAttendance = async () => {
    if (clearConfirmText !== 'CLEAR') return;
    setIsClearing(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const result = await clearSavedAttendanceAction(date);
      if (result.success) {
        setIsExisting(false);
        setSavedRecordCount(0);
        const newMap: AttendanceMap = {};
        students.forEach((s) => {
          newMap[s.id] = 'Unmarked';
        });
        setAttendance(newMap);
        const updatedStudents = await getAllStudentsWithStats();
        setStudents(updatedStudents);
        setSuccessMsg(`Successfully cleared ${result.deletedCount} saved attendance records for ${date}.`);
      } else {
        setErrorMsg(result.error || 'Failed to clear saved attendance.');
      }
    } catch (err) {
      setErrorMsg('An error occurred while clearing saved attendance.');
    } finally {
      setIsClearing(false);
      setShowClearSavedModal(false);
      setClearConfirmText('');
    }
  };

  const isAllMarked =
    students.length > 0 &&
    students.every((s) => attendance[s.id] && attendance[s.id] !== 'Unmarked');

  const markedCount = students.filter(
    (s) => attendance[s.id] && attendance[s.id] !== 'Unmarked'
  ).length;

  const unmarkedCount = students.length - markedCount;

  const absentStudents = students.filter((s) => {
    const st = attendance[s.id];
    return st && NON_PRESENT_STATUSES.includes(st as AttendanceStatus);
  });

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);

    if (isBlockedDate) {
      setErrorMsg(`Cannot save attendance for ${blockedReason} ${date}.`);
      return;
    }

    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const VALID_STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'On Duty (OD)', 'Medical Leave (ML)', 'Long Absent'];
    const records = students
      .filter((s) => {
        const st = attendance[s.id];
        return st && VALID_STATUSES.includes(st as AttendanceStatus);
      })
      .map((s) => ({
        studentId: s.id,
        status: attendance[s.id] as AttendanceStatus,
      }));

    if (records.length !== students.length) {
      setErrorMsg(`Save aborted: ${students.length - records.length} student(s) have an invalid status.`);
      setIsSaving(false);
      return;
    }

    try {
      const result = await saveBulkAttendanceAction(date, records);
      if (result.success) {
        const msg = isExisting
          ? 'Attendance updated successfully.'
          : 'Attendance saved successfully.';
        setSuccessMsg(msg);
        setIsExisting(true);
        setSavedRecordCount(students.length);
        const updatedStudents = await getAllStudentsWithStats();
        setStudents(updatedStudents);
      } else {
        setErrorMsg('Failed to save attendance. Please try again.');
      }
    } catch (err) {
      setErrorMsg('An error occurred while saving attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusStyle = (status: AttendanceStatus, currentStatus: string, activeClass: string) => {
    const isActive = currentStatus === status;
    return isActive
      ? `${activeClass} scale-105 text-white font-bold ring-2 ring-indigo-500/50 shadow-md`
      : 'bg-slate-900/60 light:bg-slate-100 border-slate-700/60 light:border-slate-300 text-slate-400 light:text-slate-600 hover:bg-slate-800 light:hover:bg-slate-200';
  };

  const formatStatusLabel = (status: string) => {
    if (status === 'Medical Leave (ML)') return 'Medical Leave';
    if (status === 'On Duty (OD)') return 'On Duty';
    return status;
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.registerNumber.toLowerCase().includes(q) ||
      s.studentName.toLowerCase().includes(q)
    );
  });

  const hasAnyMarked = markedCount > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-28">
      {/* Header Card */}
      <div className="glass p-6 rounded-3xl flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center shadow-xl">
        <div className="space-y-1">
          <h3 className="text-2xl font-extrabold text-slate-100 light:text-slate-900 flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <BookOpen className="w-6 h-6" />
            </div>
            <span>Take Daily Attendance</span>
          </h3>
          <p className="text-xs text-slate-400 light:text-slate-600">
            Select attendance status for all {students.length} students, then click Save Attendance.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
          {/* Date Picker */}
          <div className="w-full sm:w-64">
            <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
              Attendance Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold"
            />
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 sm:self-end">
            <button
              onClick={handleMarkAllPresent}
              disabled={loading || students.length === 0 || isBlockedDate}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-xl text-xs border border-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>Mark All Present</span>
            </button>

            <button
              onClick={() => setShowResetModal(true)}
              disabled={loading || !hasAnyMarked}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold rounded-xl text-xs border border-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Reset</span>
            </button>

            {isExisting && (
              <button
                onClick={() => {
                  setClearConfirmText('');
                  setShowClearSavedModal(true);
                }}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-xl text-xs border border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Clear Saved</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SUNDAY / HOLIDAY WARNING BANNER */}
      {isBlockedDate && (
        <div className="p-5 rounded-3xl bg-amber-950/40 light:bg-amber-100 border border-amber-500/30 flex items-start gap-4 shadow-xl">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
            <CalendarX className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-300 light:text-amber-900">
              {blockedReason === 'Sunday' ? 'Sunday – Attendance Blocked' : 'Holiday – Attendance Blocked'}
            </h4>
            <p className="text-xs text-amber-300/80 light:text-amber-800 mt-1 leading-relaxed">
              <strong>{date}</strong> is a <strong>{blockedReason}</strong>. Attendance is permitted only on active working days.
            </p>
          </div>
        </div>
      )}

      {/* ABSENTEES STUDENT SUMMARY CARD */}
      <div className="glass-card p-6 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 light:border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-100 light:text-slate-900">
                Absentees Student Summary
              </h4>
              <p className="text-xs text-slate-400 light:text-slate-600 mt-0.5">
                Live summary of all non-present students for {date}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/80 light:bg-slate-100 px-4 py-2 rounded-2xl border border-slate-800 light:border-slate-300">
              <span className="text-xs text-slate-400 light:text-slate-600 font-medium">Marked:</span>
              <span className={`text-xl font-black ${markedCount === students.length && students.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {markedCount}/{students.length}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/80 light:bg-slate-100 px-4 py-2 rounded-2xl border border-slate-800 light:border-slate-300">
              <span className="text-xs text-slate-400 light:text-slate-600 font-medium">Total Absent:</span>
              <span className={`text-xl font-black ${absentStudents.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {absentStudents.length}
              </span>
            </div>
          </div>
        </div>

        {absentStudents.length === 0 ? (
          <div className="py-3 text-xs text-emerald-400 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>No absent students for this date.</span>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-400">
              Absent Students:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
              {absentStudents.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-rose-950/30 light:bg-rose-50 border border-rose-500/30 text-rose-300 light:text-rose-800 text-xs font-bold"
                >
                  <span>{s.studentName}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    {formatStatusLabel(attendance[s.id])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Student Attendance Table Workspace */}
      <div className="glass-card rounded-3xl overflow-hidden shadow-xl border border-slate-800 light:border-slate-200">
        <div className="p-4 bg-slate-950/40 light:bg-slate-100/50 border-b border-slate-800 light:border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by name or roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-4 py-2 bg-slate-900/60 light:bg-white border border-slate-700/60 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
            {unmarkedCount > 0 ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{unmarkedCount} students remaining to mark</span>
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>All {students.length} students marked</span>
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-20 px-4 text-slate-500 text-xs">
            No students found.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 light:bg-slate-100 border-b border-slate-800 light:border-slate-200 font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600">
                  <th className="px-6 py-4 w-1/3">Student Details</th>
                  <th className="px-6 py-4 text-center">Select Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 light:divide-slate-200">
                {filteredStudents.map((student) => {
                  const currentStatus = attendance[student.id] || 'Unmarked';
                  const isMarked = currentStatus !== 'Unmarked';
                  return (
                    <tr key={student.id} className="hover:bg-slate-800/10 light:hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-100 light:text-slate-900 flex items-center gap-2">
                          {student.studentName}
                          {student.percentage !== undefined && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              student.percentage >= 75 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                            }`}>
                              {student.percentage}%
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 light:text-slate-600 font-mono mt-0.5">
                          {student.registerNumber} &bull; {student.department} {student.year} Sec {student.section}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
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

                          {isMarked && (
                            <button
                              onClick={() => handleClearStudent(student.id)}
                              className="flex items-center gap-1 px-2.5 py-2 border border-slate-700 light:border-slate-300 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                              title="Clear selection"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Clear</span>
                            </button>
                          )}
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

      {/* STICKY BOTTOM SAVE ACTION BAR */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 p-4 backdrop-blur-md border-t ${isBlockedDate ? 'bg-amber-950/90 border-amber-800' : 'bg-slate-950/90 light:bg-white/90 border-slate-800 light:border-slate-200'}`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 font-semibold flex items-center gap-2">
            {isBlockedDate ? (
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <CalendarX className="w-4 h-4" />
                <span>{blockedReason} selected — saving attendance is blocked.</span>
              </span>
            ) : isAllMarked ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>All {students.length} students marked. Ready to save!</span>
              </span>
            ) : (
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>{unmarkedCount} students remaining to mark.</span>
              </span>
            )}
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={!isAllMarked || isSaving || loading || isBlockedDate}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl font-black text-xs transition-all shadow-xl cursor-pointer ${
              isAllMarked && !isSaving && !isBlockedDate
                ? 'btn-gradient shadow-indigo-600/30 hover:scale-105'
                : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {isSaving
                ? 'Saving...'
                : isBlockedDate
                ? `${blockedReason} — Saving Blocked`
                : isExisting
                ? 'Update Attendance'
                : 'Save Attendance'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

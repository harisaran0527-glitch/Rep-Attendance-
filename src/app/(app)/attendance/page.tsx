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

  // PART 2: Reset All Unsaved modal state
  const [showResetModal, setShowResetModal] = useState(false);

  // PART 3: Clear Saved Attendance modal state
  const [showClearSavedModal, setShowClearSavedModal] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [savedRecordCount, setSavedRecordCount] = useState(0);

  // Day validation — block saving on Sundays or configured holidays
  const isSelectedSunday = isSundayDate(date);
  const isSelectedHoliday = isHoliday(date);
  const isBlockedDate = isSelectedSunday || isSelectedHoliday;
  const blockedReason = isSelectedSunday ? 'Sunday' : 'Holiday';

  // Load students & existing attendance for selected date
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

  // Handle local status change (does NOT auto-save)
  const handleStatusChange = (studentId: number, status: AttendanceStatus) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
    setSuccessMsg(null);
  };

  // PART 1: Clear one student's status back to Unmarked
  const handleClearStudent = (studentId: number) => {
    setAttendance((prev) => ({ ...prev, [studentId]: 'Unmarked' }));
    setSuccessMsg(null);
  };

  // Shortcut: Mark all students Present
  const handleMarkAllPresent = () => {
    const updated: AttendanceMap = {};
    students.forEach((s) => {
      updated[s.id] = 'Present';
    });
    setAttendance(updated);
    setSuccessMsg(null);
  };

  // PART 2: Reset all unsaved selections (reverts to database state)
  const handleResetAllUnsaved = async () => {
    await loadData();
    setShowResetModal(false);
    setSuccessMsg('All attendance selections have been reset to the saved state.');
  };

  // PART 3: Clear saved attendance from database
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
        // Reset all students to Unmarked
        const newMap: AttendanceMap = {};
        students.forEach((s) => {
          newMap[s.id] = 'Unmarked';
        });
        setAttendance(newMap);
        // Refresh student percentages
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

  // Validation: Check if all students have been assigned a status
  const isAllMarked =
    students.length > 0 &&
    students.every((s) => attendance[s.id] && attendance[s.id] !== 'Unmarked');

  const markedCount = students.filter(
    (s) => attendance[s.id] && attendance[s.id] !== 'Unmarked'
  ).length;

  const unmarkedCount = students.length - markedCount;

  // Filter absent / non-present students
  const absentStudents = students.filter((s) => {
    const st = attendance[s.id];
    return st && NON_PRESENT_STATUSES.includes(st as AttendanceStatus);
  });

  // Handle Final Save / Update
  const handleConfirmSave = async () => {
    setShowConfirmModal(false);

    // Hard block: never allow saving attendance on Sundays or holidays
    if (isBlockedDate) {
      setErrorMsg(`Cannot save attendance for ${blockedReason} ${date}.`);
      return;
    }

    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    // Build records — only include students with a valid AttendanceStatus (not 'Unmarked')
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

    // Safety guard: if records count doesn't match students count, something is wrong
    if (records.length !== students.length) {
      setErrorMsg(`Save aborted: ${students.length - records.length} student(s) have an invalid status. Please ensure all students are marked before saving.`);
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
        // Refresh student percentages & stats
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
      ? `${activeClass} scale-105 border-transparent text-white font-bold ring-2 ring-offset-2 ring-offset-slate-900 ring-indigo-500/50`
      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200';
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

  // Check if any student has been marked (for enabling Reset Attendance button)
  const hasAnyMarked = markedCount > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header Card */}
      <div className="glass p-6 rounded-2xl flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Take Daily Attendance</span>
          </h3>
          <p className="text-xs text-slate-400">
            Select attendance status for all {students.length} students, then click Save Attendance below.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
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

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 sm:self-end">
            {/* Shortcut: Mark All Present */}
            <button
              onClick={handleMarkAllPresent}
              disabled={loading || students.length === 0 || isBlockedDate}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-semibold rounded-xl text-xs border border-emerald-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={isBlockedDate ? `Cannot mark attendance on a ${blockedReason}` : 'Mark all students as Present'}
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>Mark All Present</span>
            </button>

            {/* PART 2: Reset Attendance Button */}
            <button
              onClick={() => setShowResetModal(true)}
              disabled={loading || !hasAnyMarked}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold rounded-xl text-xs border border-amber-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset all unsaved attendance selections"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Reset Attendance</span>
            </button>

            {/* PART 3: Clear Saved Attendance Button (only when saved data exists) */}
            {isExisting && (
              <button
                onClick={() => {
                  setClearConfirmText('');
                  setShowClearSavedModal(true);
                }}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold rounded-xl text-xs border border-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
                title="Delete saved attendance for this session from database"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Clear Saved Attendance</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SUNDAY / HOLIDAY WARNING BANNER */}
      {isBlockedDate && (
        <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/30 backdrop-blur-md flex items-start gap-4 shadow-lg">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
            <CalendarX className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-200">
              {blockedReason === 'Sunday' ? 'Sunday – Attendance Blocked' : 'Holiday – Attendance Blocked'}
            </h4>
            <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
              <strong>{date}</strong> is a <strong>{blockedReason}</strong>. College is closed / holiday declared.
              Attendance is only permitted on active working days.
              All students show as <span className="font-bold text-amber-100">Not Marked</span> for this date.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-200/90 font-medium bg-amber-500/10 border border-amber-500/20 w-fit px-3 py-1.5 rounded-xl">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Save and Mark All Present buttons are disabled to prevent accidental database inputs.</span>
            </div>
          </div>
        </div>
      )}

      {/* ABSENTEES STUDENT SUMMARY CARD */}
      <div className="glass p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Absentees Student Summary</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Live summary of all non-present students for {date}.
              </p>
            </div>
          </div>

          {/* Marked count & Total Absent Count Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Marked:</span>
              <span className={`text-xl font-extrabold ${markedCount === students.length && students.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {markedCount}/{students.length}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Total Absent:</span>
              <span className={`text-xl font-extrabold ${absentStudents.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {absentStudents.length}
              </span>
            </div>
          </div>
        </div>

        {absentStudents.length === 0 ? (
          <div className="py-3 text-xs text-emerald-400 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>No absent students.</span>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
              Absent Students:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
              {absentStudents.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-xs"
                >
                  <span className="font-semibold text-white">{s.studentName}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {formatStatusLabel(attendance[s.id])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Student Attendance Table Workspace */}
      <div className="glass rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {/* Search Bar */}
        <div className="p-4 bg-slate-950/20 border-b border-slate-850 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div className="relative w-full sm:w-72">
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

          <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
            {unmarkedCount > 0 ? (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{unmarkedCount} students unmarked</span>
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
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
            No students found matching search.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4 w-1/3">Student Details</th>
                  <th className="px-6 py-4 text-center">Select Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredStudents.map((student) => {
                  const currentStatus = attendance[student.id] || 'Unmarked';
                  const isMarked = currentStatus !== 'Unmarked';
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

                          {/* PART 1: Per-student Clear button */}
                          {isMarked && (
                            <button
                              onClick={() => handleClearStudent(student.id)}
                              className="flex items-center gap-1 px-2.5 py-2 border border-slate-600 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-500 transition-all cursor-pointer"
                              title="Clear this student's attendance selection"
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

      {/* STICKY BOTTOM SAVE ATTENDANCE ACTION BAR */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 p-4 backdrop-blur-lg border-t ${isBlockedDate ? 'bg-amber-950/80 border-amber-800/50' : 'bg-slate-950/90 border-slate-800'}`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            {isBlockedDate ? (
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <CalendarX className="w-4 h-4" />
                <span>{blockedReason} selected — saving attendance is blocked.</span>
              </span>
            ) : isAllMarked ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>All {students.length} students marked. Ready to save!</span>
              </span>
            ) : (
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>{unmarkedCount} students remaining to mark before saving.</span>
              </span>
            )}
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={!isAllMarked || isSaving || loading || isBlockedDate}
            title={isBlockedDate ? `Saving attendance on a ${blockedReason} is not allowed` : undefined}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-xl cursor-pointer ${
              isAllMarked && !isSaving && !isBlockedDate
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isBlockedDate ? (
              <CalendarX className="w-5 h-5" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span>
              {isSaving
                ? 'Saving...'
                : isBlockedDate
                ? `${blockedReason} — Saving Blocked`
                : !isAllMarked
                ? `Mark All Students to ${isExisting ? 'Update' : 'Save'}`
                : isExisting
                ? 'Update Attendance'
                : 'Save Attendance'}
            </span>
          </button>
        </div>
      </div>

      {/* SAVE / UPDATE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-indigo-400">
              <HelpCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100">
                {isExisting ? 'Update Attendance?' : 'Save Attendance?'}
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isExisting
                ? `Are you sure you want to update attendance for ${date}?`
                : `Are you sure you want to save attendance for ${date}?`}
            </p>
            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-mono text-slate-200">{date}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Students Marked:</span>
                <span className="font-semibold text-emerald-400">{students.length} / {students.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Absentees:</span>
                <span className="font-semibold text-rose-400">{absentStudents.length}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm {isExisting ? 'Update' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PART 2: RESET ALL UNSAVED CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100">
                Reset Attendance?
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Clear all currently marked attendance selections?
            </p>
            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-mono text-slate-200">{date}</span>
              </div>
              <div className="flex justify-between">
                <span>Currently Marked:</span>
                <span className="font-semibold text-amber-400">{markedCount} / {students.length}</span>
              </div>
              <div className="flex justify-between">
                <span>After Reset:</span>
                <span className="font-semibold text-slate-300">0 / {students.length} (Not Marked)</span>
              </div>
            </div>
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>This will only clear your current selections. No saved database records will be affected.</span>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAllUnsaved}
                className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All to Not Marked</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PART 3: CLEAR SAVED ATTENDANCE DOUBLE-CONFIRMATION MODAL */}
      {showClearSavedModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/30 p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-rose-400">
                <ShieldAlert className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-slate-100">
                  Clear Saved Attendance
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowClearSavedModal(false);
                  setClearConfirmText('');
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to clear the saved attendance for this selected session? This action will remove only this date, subject, and period attendance.
            </p>

            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-mono text-slate-200">{date}</span>
              </div>
              <div className="flex justify-between">
                <span>Subject:</span>
                <span className="font-semibold text-slate-200">General Daily Attendance</span>
              </div>
              <div className="flex justify-between">
                <span>Period:</span>
                <span className="font-semibold text-slate-200">Period 1</span>
              </div>
              <div className="flex justify-between">
                <span>Records to be removed:</span>
                <span className="font-semibold text-rose-400">{savedRecordCount}</span>
              </div>
            </div>

            <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> This will permanently delete {savedRecordCount} attendance records from the database for this session.
                Attendance from other dates will not be affected. Student data, emails, and admin data will remain safe.
              </span>
            </div>

            {/* Second confirmation: type CLEAR */}
            <div className="space-y-2">
              <label className="block text-xs text-slate-300 font-semibold">
                To confirm, type <span className="font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">CLEAR</span> below:
              </label>
              <input
                type="text"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="Type CLEAR to confirm"
                className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder-slate-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowClearSavedModal(false);
                  setClearConfirmText('');
                }}
                disabled={isClearing}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearSavedAttendance}
                disabled={clearConfirmText !== 'CLEAR' || isClearing}
                className={`flex items-center gap-2 px-5 py-2 font-semibold rounded-xl text-xs transition-colors cursor-pointer ${
                  clearConfirmText === 'CLEAR' && !isClearing
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isClearing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isClearing ? 'Clearing...' : 'Clear Saved Attendance'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  getStudentAcademicRecordsAction,
  saveStudentAcademicRecordAction,
} from '@/app/actions';
import {
  ArrowLeft,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  BookOpen,
} from 'lucide-react';
import StudentAvatar from '@/components/StudentAvatar';

interface StudentInfo {
  id: number;
  studentName: string;
  registerNumber: string;
  department: string;
  year: string;
  section: string;
  profilePhotoUrl?: string | null;
}

interface SemesterRecordState {
  sgpa: number | string;
  totalCredits: number | string;
  creditsEarned: number | string;
  arrearsCount: number | string;
  arrearsCleared: number | string;
}

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function StudentCGPAPage({ params }: { params: Promise<{ studentId: string }> }) {
  const resolvedParams = use(params);
  const studentId = parseInt(resolvedParams.studentId, 10);

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [activeSem, setActiveSem] = useState<number>(1);
  const [recordsMap, setRecordsMap] = useState<Record<number, SemesterRecordState>>({});
  const [currentCGPA, setCurrentCGPA] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (isNaN(studentId)) {
        setError('Invalid student ID.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await getStudentAcademicRecordsAction(studentId);
        if (res.success && res.student) {
          setStudent(res.student);
          setCurrentCGPA(res.cgpa || 0);

          const initialMap: Record<number, SemesterRecordState> = {};
          SEMESTERS.forEach((sem) => {
            initialMap[sem] = {
              sgpa: 0,
              totalCredits: 0,
              creditsEarned: 0,
              arrearsCount: 0,
              arrearsCleared: 0,
            };
          });

          (res.records || []).forEach((r: any) => {
            initialMap[r.semester] = {
              sgpa: r.sgpa,
              totalCredits: r.totalCredits,
              creditsEarned: r.creditsEarned,
              arrearsCount: r.arrearsCount,
              arrearsCleared: r.arrearsCleared,
            };
          });

          setRecordsMap(initialMap);
        } else {
          setError(res.error || 'Student not found.');
        }
      } catch (err) {
        console.error('Error loading academic records:', err);
        setError('Failed to load academic records.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [studentId]);

  const currentSemRecord = recordsMap[activeSem] || {
    sgpa: 0,
    totalCredits: 0,
    creditsEarned: 0,
    arrearsCount: 0,
    arrearsCleared: 0,
  };

  const handleFieldChange = (field: keyof SemesterRecordState, val: string) => {
    setError(null);
    setSuccessMsg(null);
    setRecordsMap((prev) => ({
      ...prev,
      [activeSem]: {
        ...prev[activeSem],
        [field]: val,
      },
    }));
  };

  // Real-time calculation of credit-weighted CGPA across all non-zero credit semesters
  const calculateLiveCGPA = () => {
    let totalWeightedSGPA = 0;
    let totalCreditsSum = 0;
    let validSemestersCount = 0;
    let sumSgpa = 0;

    SEMESTERS.forEach((sem) => {
      const rec = recordsMap[sem];
      if (rec) {
        const sgpa = parseFloat(String(rec.sgpa)) || 0;
        const credits = parseFloat(String(rec.totalCredits)) || 0;

        if (sgpa > 0 || credits > 0) {
          validSemestersCount++;
          sumSgpa += sgpa;

          if (credits > 0) {
            totalWeightedSGPA += sgpa * credits;
            totalCreditsSum += credits;
          }
        }
      }
    });

    if (totalCreditsSum > 0) {
      return Math.round((totalWeightedSGPA / totalCreditsSum) * 100) / 100;
    }
    if (validSemestersCount > 0) {
      return Math.round((sumSgpa / validSemestersCount) * 100) / 100;
    }
    return currentCGPA;
  };

  const handleSaveSemester = async () => {
    if (!student) return;
    setError(null);
    setSuccessMsg(null);

    const sgpa = parseFloat(String(currentSemRecord.sgpa));
    const totalCredits = parseFloat(String(currentSemRecord.totalCredits));
    const creditsEarned = parseFloat(String(currentSemRecord.creditsEarned));
    const arrearsCount = parseInt(String(currentSemRecord.arrearsCount), 10);
    const arrearsCleared = parseInt(String(currentSemRecord.arrearsCleared), 10);

    if (isNaN(sgpa) || sgpa < 0 || sgpa > 10) {
      setError('SGPA must be between 0.00 and 10.00.');
      return;
    }
    if (isNaN(totalCredits) || totalCredits < 0) {
      setError('Total Credits must be >= 0.');
      return;
    }
    if (isNaN(creditsEarned) || creditsEarned < 0 || creditsEarned > totalCredits) {
      setError('Credits Earned must be between 0 and Total Credits.');
      return;
    }
    if (isNaN(arrearsCount) || arrearsCount < 0) {
      setError('Arrears Count must be >= 0.');
      return;
    }
    if (isNaN(arrearsCleared) || arrearsCleared < 0) {
      setError('Arrears Cleared must be >= 0.');
      return;
    }

    setSaving(true);

    try {
      const res = await saveStudentAcademicRecordAction(student.id, activeSem, {
        sgpa,
        totalCredits,
        creditsEarned,
        arrearsCount,
        arrearsCleared,
      });

      if (res.success) {
        if (res.cgpa !== undefined) {
          setCurrentCGPA(res.cgpa);
        }
        setSuccessMsg(`Successfully saved Semester ${activeSem} academic record for ${student.studentName}!`);
      } else {
        setError(res.error || 'Failed to save record.');
      }
    } catch (err) {
      setError('An unexpected error occurred while saving academic record.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-300 light:text-slate-700">Loading student academic record...</p>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 glass-card rounded-3xl border border-rose-500/30 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-200">{error}</h3>
        <Link
          href="/cgpa"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to CGPA List</span>
        </Link>
      </div>
    );
  }

  const liveCGPA = calculateLiveCGPA();

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/cgpa"
            className="p-2.5 bg-slate-900 light:bg-slate-200 hover:bg-slate-800 text-slate-300 light:text-slate-700 rounded-2xl border border-slate-800 light:border-slate-300 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-xl font-extrabold text-slate-100 light:text-slate-900 tracking-tight">Student CGPA & Semester Record</h2>
            <p className="text-xs text-slate-400 light:text-slate-600">Enter official semester SGPA, credits, and arrears info.</p>
          </div>
        </div>

        {/* Live CGPA Display Badge */}
        <div className="px-5 py-2.5 glass-card rounded-2xl border border-indigo-500/30 flex items-center gap-3">
          <div className="text-right">
            <span className="block text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Calculated CGPA</span>
            <span className="text-xl font-black text-indigo-400 light:text-indigo-600">{liveCGPA.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Student Banner */}
      {student && (
        <div className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 p-6 shadow-xl flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <StudentAvatar
              src={student.profilePhotoUrl}
              name={student.studentName}
              size="lg"
              className="border-2 border-indigo-500/40 shadow-md"
            />
            <div>
              <h3 className="text-lg font-extrabold text-slate-100 light:text-slate-900">{student.studentName}</h3>
              <p className="text-xs text-slate-400 light:text-slate-600">
                Roll No: <span className="font-mono font-bold text-indigo-400 light:text-indigo-600">{student.registerNumber}</span> | {student.department} ({student.year} - {student.section})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Semester Workspace */}
      <div className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 p-6 shadow-xl space-y-6">
        {/* Semester Selector Tabs */}
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <div className="flex bg-slate-950/60 light:bg-slate-100 p-1.5 rounded-2xl border border-slate-800 light:border-slate-200 min-w-[600px]">
            {SEMESTERS.map((sem) => (
              <button
                key={sem}
                onClick={() => {
                  setActiveSem(sem);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                  activeSem === sem
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 light:text-slate-600 hover:text-slate-200'
                }`}
              >
                Sem {sem}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Inputs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 light:border-slate-200">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200 light:text-slate-800">Semester {activeSem} Academic Details</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                Semester SGPA (0.00 - 10.00) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={currentSemRecord.sgpa}
                onChange={(e) => handleFieldChange('sgpa', e.target.value)}
                placeholder="e.g. 8.50"
                className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                Total Credits *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={currentSemRecord.totalCredits}
                onChange={(e) => handleFieldChange('totalCredits', e.target.value)}
                placeholder="e.g. 24"
                className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                Credits Earned *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={currentSemRecord.creditsEarned}
                onChange={(e) => handleFieldChange('creditsEarned', e.target.value)}
                placeholder="e.g. 24"
                className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                Arrears Count
              </label>
              <input
                type="number"
                min="0"
                value={currentSemRecord.arrearsCount}
                onChange={(e) => handleFieldChange('arrearsCount', e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                Arrears Cleared
              </label>
              <input
                type="number"
                min="0"
                value={currentSemRecord.creditsEarned}
                onChange={(e) => handleFieldChange('arrearsCleared', e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 light:border-slate-200 flex justify-end">
            <button
              onClick={handleSaveSemester}
              disabled={saving}
              className="btn-gradient flex items-center gap-2 px-6 py-3 text-white font-bold rounded-2xl text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer hover:scale-105 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Semester {activeSem}...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Semester {activeSem} Record</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  getStudentMarksAction,
  saveStudentMarksAction,
} from '@/app/actions';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Plus,
  Trash2,
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

interface MarkEntry {
  subject: string;
  obtainedMarks: number | string;
  totalMarks: number | string;
}

const DEFAULT_SUBJECTS = [
  'Java',
  'Data Structures',
  'EDA',
  'Operating Systems (OS)',
  'Discrete Mathematics',
];

const EXAM_CATEGORIES = ['CIA 1', 'CIA 2', 'Model Exam'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function StudentMarksPage({ params }: { params: Promise<{ studentId: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const studentId = parseInt(resolvedParams.studentId, 10);

  const initialSemParam = parseInt(searchParams.get('semester') || '1', 10);
  const [activeSemester, setActiveSemester] = useState<number>(
    initialSemParam >= 1 && initialSemParam <= 8 ? initialSemParam : 1
  );
  const [activeCategory, setActiveCategory] = useState<string>('CIA 1');

  const [student, setStudent] = useState<StudentInfo | null>(null);
  // Key format: `${semester}_${category}` -> MarkEntry[]
  const [allMarksMap, setAllMarksMap] = useState<Record<string, MarkEntry[]>>({});

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
        const res = await getStudentMarksAction(studentId);
        if (res.success && res.student) {
          setStudent(res.student);

          // Map structure: dbMap[semester][category][subject] = { obtained, total }
          const dbMap: Record<number, Record<string, Record<string, { obtained: number; total: number }>>> = {};
          (res.marks || []).forEach((m: any) => {
            const sem = m.semester || 1;
            if (!dbMap[sem]) dbMap[sem] = {};
            if (!dbMap[sem][m.examCategory]) dbMap[sem][m.examCategory] = {};
            dbMap[sem][m.examCategory][m.subject] = {
              obtained: m.obtainedMarks,
              total: m.totalMarks || 100,
            };
          });

          const newMarksMap: Record<string, MarkEntry[]> = {};

          SEMESTERS.forEach((sem) => {
            EXAM_CATEGORIES.forEach((cat) => {
              const key = `${sem}_${cat}`;
              const entries: MarkEntry[] = DEFAULT_SUBJECTS.map((sub) => {
                const existing = dbMap[sem]?.[cat]?.[sub];
                return {
                  subject: sub,
                  obtainedMarks: existing ? existing.obtained : 0,
                  totalMarks: 100, // Enforce 100 total marks
                };
              });

              // Add custom non-default subjects saved in DB for this semester & category
              if (dbMap[sem]?.[cat]) {
                Object.keys(dbMap[sem][cat]).forEach((sub) => {
                  if (!DEFAULT_SUBJECTS.includes(sub)) {
                    entries.push({
                      subject: sub,
                      obtainedMarks: dbMap[sem][cat][sub].obtained,
                      totalMarks: 100,
                    });
                  }
                });
              }

              newMarksMap[key] = entries;
            });
          });

          setAllMarksMap(newMarksMap);
        } else {
          setError(res.error || 'Student not found.');
        }
      } catch (err) {
        console.error('Error fetching marks:', err);
        setError('Failed to load student marks.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [studentId]);

  const activeKey = `${activeSemester}_${activeCategory}`;
  const currentEntries = allMarksMap[activeKey] || [];

  const handleMarkChange = (index: number, field: 'obtainedMarks' | 'totalMarks', val: string) => {
    setError(null);
    setSuccessMsg(null);

    setAllMarksMap((prev) => {
      const list = [...(prev[activeKey] || [])];
      list[index] = {
        ...list[index],
        [field]: val,
        totalMarks: 100, // Enforce read-only 100 total marks
      };
      return {
        ...prev,
        [activeKey]: list,
      };
    });
  };

  const handleAddCustomSubject = () => {
    const name = prompt(`Enter custom subject name for Semester ${activeSemester} (${activeCategory}):`);
    if (name && name.trim()) {
      const cleanName = name.trim();
      setAllMarksMap((prev) => {
        const list = [...(prev[activeKey] || [])];
        if (!list.some((item) => item.subject.toLowerCase() === cleanName.toLowerCase())) {
          list.push({
            subject: cleanName,
            obtainedMarks: 0,
            totalMarks: 100,
          });
        }
        return {
          ...prev,
          [activeKey]: list,
        };
      });
    }
  };

  const handleRemoveSubject = (index: number) => {
    setAllMarksMap((prev) => {
      const list = [...(prev[activeKey] || [])].filter((_, i) => i !== index);
      return {
        ...prev,
        [activeKey]: list,
      };
    });
  };

  const handleSaveMarks = async () => {
    if (!student) return;
    setError(null);
    setSuccessMsg(null);

    // Validate entries before saving
    for (const item of currentEntries) {
      const obtained = parseFloat(String(item.obtainedMarks));

      if (isNaN(obtained) || obtained < 0 || obtained > 100) {
        setError(`Obtained marks for "${item.subject}" must be a valid number between 0 and 100.`);
        return;
      }
    }

    setSaving(true);

    try {
      const payload = currentEntries.map((item) => ({
        subject: item.subject,
        obtainedMarks: parseFloat(String(item.obtainedMarks)),
        totalMarks: 100,
      }));

      const res = await saveStudentMarksAction(student.id, activeSemester, activeCategory, payload);
      if (res.success) {
        setSuccessMsg(`Successfully saved Semester ${activeSemester} ${activeCategory} marks for ${student.studentName}!`);
      } else {
        setError(res.error || 'Failed to save marks.');
      }
    } catch (err) {
      setError('An unexpected error occurred while saving marks.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-300 light:text-slate-700">Loading student exam marks...</p>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 glass-card rounded-3xl border border-rose-500/30 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-200">{error}</h3>
        <Link
          href="/marks"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marks List</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Back button and title */}
      <div className="flex items-center gap-4">
        <Link
          href="/marks"
          className="p-2.5 bg-slate-900 light:bg-slate-200 hover:bg-slate-800 text-slate-300 light:text-slate-700 rounded-2xl border border-slate-800 light:border-slate-300 transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 light:text-slate-900 tracking-tight">
            Student Exam Marks (Semester-Wise)
          </h2>
          <p className="text-xs text-slate-400 light:text-slate-600">
            Enter and update subject marks for Semesters 1 to 8 across CIA 1, CIA 2, and Model Exams.
          </p>
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

      {/* Semester Selector Bar */}
      <div className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 p-4 shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          <span className="text-xs font-extrabold text-slate-300 light:text-slate-700 mr-2 flex items-center gap-1.5 shrink-0">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            Select Semester:
          </span>
          {SEMESTERS.map((sem) => (
            <button
              key={sem}
              onClick={() => {
                setActiveSemester(sem);
                setError(null);
                setSuccessMsg(null);
              }}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer shrink-0 ${
                activeSemester === sem
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105'
                  : 'bg-slate-900 light:bg-slate-100 text-slate-400 light:text-slate-600 hover:text-slate-200'
              }`}
            >
              Semester {sem}
            </button>
          ))}
        </div>
      </div>

      {/* Main Exam Tabs & Form */}
      <div className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 p-6 shadow-xl space-y-6">
        {/* Category Tabs inside Selected Semester */}
        <div className="flex bg-slate-950/60 light:bg-slate-100 p-1.5 rounded-2xl border border-slate-800 light:border-slate-200 max-w-lg">
          {EXAM_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 light:text-slate-600 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
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

        {/* Marks Table / Form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 light:border-slate-200">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-200 light:text-slate-800">
                Semester {activeSemester} — {activeCategory} Subject Marks
              </h3>
            </div>
            <button
              type="button"
              onClick={handleAddCustomSubject}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 light:bg-slate-200 hover:bg-slate-700 light:hover:bg-slate-300 text-slate-200 light:text-slate-800 font-bold rounded-xl text-xs cursor-pointer border border-slate-700 light:border-slate-300"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subject</span>
            </button>
          </div>

          <div className="space-y-3">
            {currentEntries.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-200 rounded-2xl gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    {idx + 1}
                  </div>
                  <span className="text-xs font-bold text-slate-200 light:text-slate-800">{item.subject}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Obtained</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={item.obtainedMarks}
                        onChange={(e) => handleMarkChange(idx, 'obtainedMarks', e.target.value)}
                        className="w-24 px-3 py-1.5 bg-slate-900 light:bg-white border border-slate-700 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <span className="text-slate-500 font-bold mt-3">/</span>

                    <div className="flex flex-col">
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Total</label>
                      <input
                        type="number"
                        value={100}
                        readOnly
                        className="w-24 px-3 py-1.5 bg-slate-900 light:bg-white border border-slate-700 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 opacity-50 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {!DEFAULT_SUBJECTS.includes(item.subject) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(idx)}
                      className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition mt-3"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-slate-800 light:border-slate-200 flex justify-end">
            <button
              onClick={handleSaveMarks}
              disabled={saving}
              className="btn-gradient flex items-center gap-2 px-6 py-3 text-white font-bold rounded-2xl text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer hover:scale-105 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Marks...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Sem {activeSemester} ({activeCategory}) Marks</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

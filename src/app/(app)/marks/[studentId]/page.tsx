'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  getStudentMarksAction,
  saveStudentMarkSingleAction,
  getSemesterSubjectsAction,
} from '@/app/actions';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  BookOpen,
  Info,
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
  totalMarks: number;
}

interface SubjectRow {
  id: number;
  semester: number;
  subjectName: string;
}

const EXAM_CATEGORIES = ['CIA 1', 'CIA 2', 'Model Exam'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function StudentMarksPage({ params }: { params: Promise<{ studentId: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const studentId = parseInt(resolvedParams.studentId, 10);

  const initialSemParam = parseInt(searchParams.get('semester') || '3', 10);
  const [activeSemester, setActiveSemester] = useState<number>(
    initialSemParam >= 1 && initialSemParam <= 8 ? initialSemParam : 3
  );
  const [activeCategory, setActiveCategory] = useState<string>('CIA 1');

  const [student, setStudent] = useState<StudentInfo | null>(null);
  // Key: `${semester}_${category}` -> MarkEntry[]
  const [allMarksMap, setAllMarksMap] = useState<Record<string, MarkEntry[]>>({});
  // Key: semester -> SubjectRow[]
  const [subjectsMap, setSubjectsMap] = useState<Record<number, SubjectRow[]>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load subjects for a given semester (cached in subjectsMap)
  const ensureSubjectsLoaded = async (sem: number): Promise<SubjectRow[]> => {
    if (subjectsMap[sem]) return subjectsMap[sem];
    try {
      const res = await getSemesterSubjectsAction(sem);
      const rows: SubjectRow[] = res.success ? (res.subjects as SubjectRow[]) : [];
      setSubjectsMap((prev) => ({ ...prev, [sem]: rows }));
      return rows;
    } catch {
      return [];
    }
  };

  // Build the marks map key for a semester+category, ensuring subjects exist
  const buildMarksKey = (sem: number, cat: string) => `${sem}_${cat}`;

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
        // Load all marks for this student (all semesters)
        const marksResult = await getStudentMarksAction(studentId);
        if (!marksResult.success || !marksResult.student) {
          setError(marksResult.error || 'Student not found.');
          setLoading(false);
          return;
        }

        setStudent(marksResult.student as StudentInfo);

        // Group existing marks by semester+category
        const rawMarks: any[] = marksResult.marks || [];
        const tempMap: Record<string, Record<string, number>> = {};
        rawMarks.forEach((m: any) => {
          const key = buildMarksKey(m.semester || 1, m.examCategory);
          if (!tempMap[key]) tempMap[key] = {};
          tempMap[key][m.subject] = m.obtainedMarks;
        });

        // Load subjects for the initial semester
        const initialSubjects = await ensureSubjectsLoaded(activeSemester);

        // Build initial allMarksMap for the active semester
        const initialMarksMap: Record<string, MarkEntry[]> = {};
        for (const cat of EXAM_CATEGORIES) {
          const key = buildMarksKey(activeSemester, cat);
          const subjectNames = initialSubjects.map((s) => s.subjectName);
          initialMarksMap[key] = subjectNames.map((subj) => ({
            subject: subj,
            obtainedMarks: tempMap[key]?.[subj] ?? '',
            totalMarks: 100,
          }));
        }

        setAllMarksMap(initialMarksMap);

        // Store the raw marks for later semester switches
        // We store as a lightweight representation
        setAllMarksMap((prev) => ({ ...prev, _rawTempMap: tempMap as any }));
      } catch (err) {
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // When semester changes, load subjects and build marks map for new semester
  const handleSemesterChange = async (sem: number) => {
    setActiveSemester(sem);
    setActiveCategory('CIA 1');
    setError(null);
    setSuccessMsg(null);

    const subjects = await ensureSubjectsLoaded(sem);
    const rawTempMap: Record<string, Record<string, number>> = (allMarksMap as any)._rawTempMap || {};

    setAllMarksMap((prev) => {
      const updated = { ...prev };
      for (const cat of EXAM_CATEGORIES) {
        const key = buildMarksKey(sem, cat);
        if (!updated[key]) {
          updated[key] = subjects.map((subj) => ({
            subject: subj.subjectName,
            obtainedMarks: rawTempMap[key]?.[subj.subjectName] ?? '',
            totalMarks: 100,
          }));
        }
      }
      return updated;
    });
  };

  const currentKey = buildMarksKey(activeSemester, activeCategory);
  const currentEntries: MarkEntry[] = allMarksMap[currentKey] || [];
  const currentSubjects: SubjectRow[] = subjectsMap[activeSemester] || [];

  const handleMarkChange = (subjectName: string, value: string) => {
    setSuccessMsg(null);
    setAllMarksMap((prev) => {
      const entries = [...(prev[currentKey] || [])];
      const idx = entries.findIndex((e) => e.subject === subjectName);
      if (idx === -1) return prev;
      entries[idx] = { ...entries[idx], obtainedMarks: value };
      return { ...prev, [currentKey]: entries };
    });
  };

  const handleSave = async () => {
    setError(null);
    setSuccessMsg(null);

    if (currentEntries.length === 0) {
      setError(`No subjects configured for Semester ${activeSemester}. Please add subjects from the Marks page first.`);
      return;
    }

    setSaving(true);
    const results: Array<{ success: boolean; error?: string; subject?: string }> = [];

    for (const entry of currentEntries) {
      const rawVal = String(entry.obtainedMarks).trim();
      if (rawVal === '') continue;
      const obtained = parseFloat(rawVal);
      if (isNaN(obtained)) {
        results.push({ success: false, error: `"${entry.subject}": Invalid marks value.` });
        continue;
      }
      const res = await saveStudentMarkSingleAction(
        studentId,
        activeSemester,
        activeCategory,
        entry.subject,
        obtained,
        100
      );
      results.push({ ...res, subject: entry.subject });
    }

    setSaving(false);
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      setError(`Failed to save: ${failed.map((f) => `${f.subject} — ${f.error}`).join('; ')}`);
    } else if (results.length === 0) {
      setSuccessMsg('No marks entered — nothing to save.');
    } else {
      setSuccessMsg(`Saved ${results.length} mark(s) for Semester ${activeSemester} › ${activeCategory} ✓`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-200">Student Not Found</h2>
        <p className="text-xs text-slate-500">{error || 'No student data could be loaded.'}</p>
        <Link href="/marks" className="btn-gradient inline-flex items-center gap-2 px-4 py-2 text-white font-bold rounded-xl text-xs mt-2">
          <ArrowLeft className="w-4 h-4" /> Back to Marks
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/marks" className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 transition border border-slate-800">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 light:text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            {student.studentName}
          </h2>
          <p className="text-xs text-slate-500 font-mono">{student.registerNumber} · {student.department} · {student.year}/{student.section}</p>
        </div>
        <div className="ml-auto">
          <StudentAvatar src={student.profilePhotoUrl} name={student.studentName} size="lg" />
        </div>
      </div>

      {/* Semester Selector */}
      <div className="glass-card rounded-2xl border border-slate-800 light:border-slate-200 p-4 shadow-md">
        <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
          <BookOpen className="w-4 h-4 text-indigo-400" /> Select Semester
        </p>
        <div className="flex flex-wrap gap-2">
          {SEMESTERS.map((sem) => (
            <button key={sem} onClick={() => handleSemesterChange(sem)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${activeSemester === sem ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900 light:bg-slate-200 text-slate-400 light:text-slate-700 hover:text-indigo-300'}`}>
              Semester {sem}
            </button>
          ))}
        </div>
      </div>

      {/* No subjects warning */}
      {currentSubjects.length === 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs font-bold">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
          <span>
            No subjects configured for Semester {activeSemester}. 
            Go to <Link href="/marks" className="underline text-amber-200 hover:text-amber-100">Marks page</Link> → select Semester {activeSemester} → click "Add Subject" to configure subjects first.
          </span>
        </div>
      )}

      {/* Exam Category Tabs + Marks Table */}
      {currentSubjects.length > 0 && (
        <div className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 shadow-xl overflow-hidden">
          {/* Category Tabs */}
          <div className="flex border-b border-slate-800 light:border-slate-200">
            {EXAM_CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => { setActiveCategory(cat); setError(null); setSuccessMsg(null); }}
                className={`px-6 py-3.5 text-xs font-extrabold transition cursor-pointer border-b-2 flex-1 ${activeCategory === cat ? 'border-indigo-500 text-indigo-400 bg-indigo-950/30' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/30'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Marks Table */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-extrabold text-slate-200 light:text-slate-800">
                Semester {activeSemester} › {activeCategory}
              </h3>
              <span className="text-xs text-slate-500">Total Marks: 100</span>
            </div>

            {currentEntries.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4">Loading subjects...</p>
            ) : (
              <div className="space-y-3">
                {currentEntries.map((entry) => (
                  <div key={entry.subject} className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-950/40 light:bg-slate-50 rounded-2xl border border-slate-800 light:border-slate-200">
                    <span className="text-xs font-bold text-slate-200 light:text-slate-800 flex-1">{entry.subject}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] text-slate-500">Obtained</span>
                        <input type="number" min={0} max={100} step="0.5"
                          placeholder="—"
                          value={entry.obtainedMarks}
                          onChange={(e) => handleMarkChange(entry.subject, e.target.value)}
                          className="w-20 px-2 py-1 text-sm font-extrabold text-center bg-slate-900 light:bg-white border border-slate-700 light:border-slate-300 rounded-lg text-indigo-300 light:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
                      </div>
                      <div className="flex flex-col items-center gap-0.5 text-slate-600">
                        <span className="text-[10px]">Total</span>
                        <span className="text-sm font-extrabold text-slate-500">100</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button onClick={handleSave} disabled={saving || currentEntries.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 btn-gradient text-white font-extrabold rounded-2xl text-sm shadow-lg shadow-indigo-600/20 hover:scale-105 transition disabled:opacity-50 cursor-pointer">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : `Save Semester ${activeSemester} › ${activeCategory}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllStudentsWithStats } from '@/app/actions';
import { Search, Loader2, Award, ChevronRight, Users, BookOpen } from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateMarksWorkbook } from '@/lib/marksExport';
import StudentAvatar from '@/components/StudentAvatar';

interface Student {
  id: number;
  registerNumber: string;
  studentName: string;
  email: string;
  department: string;
  year: string;
  section: string;
  profilePhotoUrl?: string | null;
}

export default function MarksPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<number | 'ALL'>('ALL');
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Export to Excel
  const handleExport = async () => {
    try {
      setExporting(true);
      const { workbook, fileName } = await generateMarksWorkbook(searchQuery, selectedSemester);
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    try {
      setExporting(true);
      const { workbook, fileName } = await generateMarksWorkbook(searchQuery, selectedSemester);
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const file = new File([blob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'CR Attendance Marks Export',
          text: 'Exported marks file',
        });
      } else {
        // fallback to download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Share error:', err);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    async function fetchStudents() {
      setLoading(true);
      try {
        const data = await getAllStudentsWithStats();
        setStudents(data);
      } catch (err) {
        console.error('Error loading students for marks page:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, []);

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      s.registerNumber.toLowerCase().includes(q) ||
      s.studentName.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      s.year.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-slate-800 light:border-slate-200 shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 light:text-slate-900 tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-400" />
            <span>Semester-Wise Marks Management</span>
          </h2>
          <p className="text-xs text-slate-400 light:text-slate-600 mt-1">
            Manage subject marks for CIA 1, CIA 2, and Model Exams across Semesters 1 to 8.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-gradient flex items-center gap-1 px-4 py-2 text-xs text-white font-bold rounded-xl shadow-md hover:scale-105 transition disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Export to Excel'}
          </button>
          <button
            onClick={handleShare}
            disabled={exporting}
            className="btn-gradient flex items-center gap-1 px-4 py-2 text-xs text-white font-bold rounded-xl shadow-md hover:scale-105 transition disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share Excel'}
          </button>
        </div>
      </div>

      {/* Semester & Search Controls */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 light:border-slate-200 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Semester Selector Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
            <span className="text-xs font-bold text-slate-400 light:text-slate-600 mr-2 flex items-center gap-1 shrink-0">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Semester:
            </span>
            <button
              onClick={() => setSelectedSemester('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl shrink-0 transition ${
                selectedSemester === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-900 light:bg-slate-200 text-slate-400 light:text-slate-700 hover:text-white'
              }`}
            >
              All Semesters
            </button>

            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <button
                key={sem}
                onClick={() => setSelectedSemester(sem)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl shrink-0 transition ${
                  selectedSemester === sem
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-900 light:bg-slate-200 text-slate-400 light:text-slate-700 hover:text-white'
                }`}
              >
                Sem {sem}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search student by name or register number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-2 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-medium"
            />
          </div>
        </div>
      </div>

      {/* Student List Grid / Table */}
      <div className="glass-card rounded-3xl overflow-hidden shadow-xl border border-slate-800 light:border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <Users className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-lg font-bold text-slate-300 light:text-slate-700">No students found</h3>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery ? 'No match found for your search query.' : 'No students added yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 light:bg-slate-100 border-b border-slate-800 light:border-slate-200 font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600">
                  <th className="px-6 py-4">Register Number</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Year / Section</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 light:divide-slate-200">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-800/10 light:hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-indigo-400 light:text-indigo-600">
                      {student.registerNumber}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-100 light:text-slate-900">
                      <div className="flex items-center gap-3">
                        <StudentAvatar
                          src={student.profilePhotoUrl}
                          name={student.studentName}
                          size="sm"
                        />
                        <span>{student.studentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 light:text-slate-600 font-medium">
                      {student.department}
                    </td>
                    <td className="px-6 py-4 text-slate-400 light:text-slate-600 font-medium">
                      {student.year} - {student.section}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/marks/${student.id}${selectedSemester !== 'ALL' ? `?semester=${selectedSemester}` : ''}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 btn-gradient text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 hover:scale-105 transition cursor-pointer"
                      >
                        <span>View / Edit Marks</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

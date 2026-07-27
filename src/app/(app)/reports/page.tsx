'use client';

import { useState, useEffect } from 'react';
import {
  getAllStudents,
  getDailyReportAction,
  getStudentWiseReportAction,
} from '@/app/actions';
import {
  FileText,
  Calendar,
  User,
  Loader2,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Student {
  id: number;
  registerNumber: string;
  studentName: string;
  department: string;
  year: string;
  section: string;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'daily' | 'student'>('daily');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);

  // Daily Report State
  const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Student Report State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<Student | null>(null);
  const [studentStartDate, setStudentStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [studentEndDate, setStudentEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Load active student list on mount
  useEffect(() => {
    async function loadStudents() {
      try {
        const list = await getAllStudents();
        setStudents(list);
        if (list.length > 0) {
          setSelectedStudentId(String(list[0].id));
        }
      } catch (err) {
        console.error('Failed to load students for reports:', err);
      }
    }
    loadStudents();
  }, []);

  // Fetch report data on parameters change
  const fetchReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'daily') {
        const data = await getDailyReportAction(dailyDate);
        setReportData(data);
      } else if (activeTab === 'student') {
        if (!selectedStudentId) return;
        const res = await getStudentWiseReportAction(
          Number(selectedStudentId),
          studentStartDate,
          studentEndDate
        );
        setSelectedStudentDetails(res.student);
        setReportData(res.report);
      }
    } catch (err) {
      console.error('Failed to fetch report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, dailyDate, selectedStudentId, studentStartDate, studentEndDate]);

  // EXPORT EXCEL LOGIC
  const exportToExcel = () => {
    if (reportData.length === 0) return;

    let fileName = '';
    let sheetData: any[] = [];

    if (activeTab === 'daily') {
      fileName = `Daily_Attendance_Report_${dailyDate}.xlsx`;
      sheetData = reportData.map((row) => ({
        'Roll Number': row.registerNumber,
        'Student Name': row.studentName,
        'Department': row.department,
        'Year': row.year,
        'Section': row.section,
        'Daily Status': row[1] || 'Unmarked',
      }));
    } else if (activeTab === 'student') {
      const name = selectedStudentDetails?.studentName.replace(/\s+/g, '_') || 'Student';
      fileName = `${name}_Attendance_Report_${studentStartDate}_to_${studentEndDate}.xlsx`;
      sheetData = reportData.map((row) => ({
        'Date': row.date,
        'Status': row[1] || 'Unmarked',
      }));
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, fileName);
  };

  // EXPORT PDF LOGIC
  const exportToPDF = () => {
    const doc = new jsPDF('portrait');
    const primaryColor = [15, 23, 42];

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, doc.internal.pageSize.width, 24, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CR ATTENDANCE MANAGER - REPORTS', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    const todayStr = new Date().toLocaleDateString();
    doc.text(`Generated: ${todayStr}`, doc.internal.pageSize.width - 45, 15);

    let subtitle = '';
    let headers: string[][] = [];
    let rows: any[][] = [];

    if (activeTab === 'daily') {
      subtitle = `Daily Attendance Report - Date: ${dailyDate}`;
      headers = [['Roll Number', 'Student Name', 'Dept', 'Year', 'Sec', 'Status']];
      rows = reportData.map((row) => [
        row.registerNumber,
        row.studentName,
        row.department,
        row.year,
        row.section,
        row[1] || 'Unmarked',
      ]);
    } else if (activeTab === 'student') {
      const name = selectedStudentDetails?.studentName || '';
      const reg = selectedStudentDetails?.registerNumber || '';
      subtitle = `Student Attendance Log: ${name} (${reg}) | Range: ${studentStartDate} to ${studentEndDate}`;
      headers = [['Date', 'Status']];
      rows = reportData.map((row) => [row.date, row[1] || 'Unmarked']);
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(subtitle, 14, 34);

    autoTable(doc, {
      startY: 40,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const outputName = activeTab === 'daily'
      ? `Daily_Report_${dailyDate}.pdf`
      : `Student_Report_${selectedStudentDetails?.registerNumber || 'Log'}.pdf`;

    doc.save(outputName);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header section with Tabs */}
      <div className="glass p-6 rounded-3xl flex flex-col md:flex-row gap-6 justify-between items-start md:items-center shadow-xl">
        <div className="space-y-1">
          <h3 className="text-2xl font-extrabold text-slate-100 light:text-slate-900 flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <FileText className="w-6 h-6" />
            </div>
            <span>Attendance Reports & Exports</span>
          </h3>
          <p className="text-xs text-slate-400 light:text-slate-600">
            Generate daily and student date-range reports. Export directly to Excel or PDF.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-950/60 light:bg-slate-200/80 p-1.5 rounded-2xl border border-slate-800 light:border-slate-300">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'daily'
                ? 'btn-gradient shadow-md'
                : 'text-slate-400 light:text-slate-700 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Daily Report</span>
          </button>
          <button
            onClick={() => setActiveTab('student')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'student'
                ? 'btn-gradient shadow-md'
                : 'text-slate-400 light:text-slate-700 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Student Range Report</span>
          </button>
        </div>
      </div>

      {/* Configuration & Filter Controls */}
      <div className="glass-card p-6 rounded-3xl space-y-4">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span>Report Parameters</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* TAB 1: Daily Report Filters */}
          {activeTab === 'daily' && (
            <div className="md:col-span-1">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                Report Date
              </label>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          )}

          {/* TAB 2: Student Report Filters */}
          {activeTab === 'student' && (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                  Select Student
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
                >
                  <option value="" disabled>Choose a student...</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.registerNumber} - {student.studentName} ({student.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={studentStartDate}
                  onChange={(e) => setStudentStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={studentEndDate}
                  onChange={(e) => setStudentEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </>
          )}
        </div>

        {/* Action Export Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800 light:border-slate-200">
          <button
            onClick={exportToExcel}
            disabled={loading || reportData.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold disabled:opacity-50 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={exportToPDF}
            disabled={loading || reportData.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold disabled:opacity-50 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Export PDF (.pdf)</span>
          </button>
        </div>
      </div>

      {/* Main Report Data Table Preview */}
      <div className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-slate-950/40 light:bg-slate-100/50 border-b border-slate-800 light:border-slate-200 flex justify-between items-center">
          <h4 className="text-sm font-bold text-slate-100 light:text-slate-900 flex items-center gap-2">
            <span>Report Preview</span>
            <span className="text-xs font-normal text-slate-400 light:text-slate-500 font-mono">
              ({reportData.length} records found)
            </span>
          </h4>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : reportData.length === 0 ? (
          <div className="text-center py-20 px-4 text-slate-500 text-sm">
            No attendance records found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 light:bg-slate-100 border-b border-slate-800 light:border-slate-200 font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600">
                  {activeTab === 'daily' && (
                    <>
                      <th className="px-5 py-3.5">Roll Number</th>
                      <th className="px-5 py-3.5">Student Name</th>
                      <th className="px-5 py-3.5">Dept</th>
                      <th className="px-5 py-3.5">Yr / Sec</th>
                      <th className="px-5 py-3.5">Daily Status</th>
                    </>
                  )}
                  {activeTab === 'student' && (
                    <>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Attendance Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 light:divide-slate-200">
                {activeTab === 'daily' &&
                  reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/10 light:hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-indigo-400 light:text-indigo-600 font-bold">{row.registerNumber}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-100 light:text-slate-900">{row.studentName}</td>
                      <td className="px-5 py-3.5 text-slate-400 light:text-slate-600">{row.department}</td>
                      <td className="px-5 py-3.5 text-slate-400 light:text-slate-600">{row.year} - {row.section}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          row[1] === 'Present' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                          row[1] === 'Absent' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {row[1] || 'Unmarked'}
                        </span>
                      </td>
                    </tr>
                  ))}

                {activeTab === 'student' &&
                  reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/10 light:hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-indigo-400 light:text-indigo-600 font-bold">{row.date}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          row[1] === 'Present' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                          row[1] === 'Absent' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {row[1] || 'Unmarked'}
                        </span>
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

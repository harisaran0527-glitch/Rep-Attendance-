'use client';

import { useState, useEffect } from 'react';
import {
  getAllStudents,
  getDailyReportAction,
  getSubjectWiseReportAction,
  getStudentWiseReportAction,
} from '@/app/actions';
import { SUBJECTS, PeriodNumber } from '@/lib/db-api';
import {
  FileText,
  Calendar,
  BookOpen,
  User,
  Loader2,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Add typescript declaration for jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface Student {
  id: number;
  registerNumber: string;
  studentName: string;
  department: string;
  year: string;
  section: string;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'daily' | 'subject' | 'student'>('daily');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);

  // Filter States
  const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [subjectPeriod, setSubjectPeriod] = useState<number>(1);
  const [subjectStartDate, setSubjectStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days ago
  );
  const [subjectEndDate, setSubjectEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentStartDate, setStudentStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days ago
  );
  const [studentEndDate, setStudentEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<Student | null>(null);

  // Load students for dropdown
  useEffect(() => {
    const loadStudents = async () => {
      try {
        const data = await getAllStudents();
        setStudents(data);
        if (data.length > 0) {
          setSelectedStudentId(data[0].id.toString());
        }
      } catch (err) {
        console.error('Error loading students:', err);
      }
    };
    loadStudents();
  }, []);

  // Fetch Report Data
  const generateReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'daily') {
        const data = await getDailyReportAction(dailyDate);
        setReportData(data);
      } else if (activeTab === 'subject') {
        const data = await getSubjectWiseReportAction(
          subjectStartDate,
          subjectEndDate,
          subjectPeriod
        );
        setReportData(data);
      } else if (activeTab === 'student') {
        if (!selectedStudentId) return;
        const sId = Number(selectedStudentId);
        const student = students.find((s) => s.id === sId) || null;
        setSelectedStudentDetails(student);
        const result = await getStudentWiseReportAction(sId, studentStartDate, studentEndDate);
        setReportData(result.report);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
  }, [
    activeTab,
    dailyDate,
    subjectPeriod,
    subjectStartDate,
    subjectEndDate,
    selectedStudentId,
    studentStartDate,
    studentEndDate,
  ]);

  // ==========================================
  // EXPORT EXCEL LOGIC
  // ==========================================
  const exportToExcel = () => {
    let sheetData: any[] = [];
    let fileName = '';

    if (activeTab === 'daily') {
      fileName = `Daily_Attendance_${dailyDate}.xlsx`;
      sheetData = reportData.map((row) => ({
        'Register No': row.registerNumber,
        'Student Name': row.studentName,
        'Dept': row.department,
        'Year': row.year,
        'Sec': row.section,
        'Period 1 (Java)': row[1],
        'Period 2 (DS)': row[2],
        'Period 3 (EDA)': row[3],
        'Period 4 (OS)': row[4],
        'Period 5 (DM)': row[5],
      }));
    } else if (activeTab === 'subject') {
      const subjectName = SUBJECTS[subjectPeriod as PeriodNumber];
      fileName = `${subjectName.replace(/\s+/g, '_')}_Report_${subjectStartDate}_to_${subjectEndDate}.xlsx`;
      sheetData = reportData.map((row) => ({
        'Register No': row.registerNumber,
        'Student Name': row.studentName,
        'Dept': row.department,
        'Year': row.year,
        'Sec': row.section,
        'Total Classes': row.totalClasses,
        'Present': row.present,
        'Absent': row.absent,
        'Late': row.late,
        'On Duty (OD)': row.od,
        'Medical Leave (ML)': row.ml,
        'Long Absent': row.la,
        'Attendance %': `${row.percentage}%`,
      }));
    } else if (activeTab === 'student') {
      const name = selectedStudentDetails?.studentName.replace(/\s+/g, '_') || 'Student';
      fileName = `${name}_Report_${studentStartDate}_to_${studentEndDate}.xlsx`;
      sheetData = reportData.map((row) => ({
        'Date': row.date,
        'Period 1 (Java)': row[1],
        'Period 2 (DS)': row[2],
        'Period 3 (EDA)': row[3],
        'Period 4 (OS)': row[4],
        'Period 5 (DM)': row[5],
      }));
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, fileName);
  };

  // ==========================================
  // EXPORT PDF LOGIC
  // ==========================================
  const exportToPDF = () => {
    const doc = new jsPDF(activeTab === 'subject' ? 'landscape' : 'portrait');
    const primaryColor = [15, 23, 42]; // Slate 900

    // Add Header
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

    // Setup contents depending on tab
    let subtitle = '';
    let headers: string[][] = [];
    let rows: any[][] = [];

    if (activeTab === 'daily') {
      subtitle = `Daily Attendance Report - Date: ${dailyDate}`;
      headers = [[
        'Register No', 'Student Name', 'Dept', 'Year', 'Sec',
        'P1 (Java)', 'P2 (DS)', 'P3 (EDA)', 'P4 (OS)', 'P5 (DM)'
      ]];
      rows = reportData.map((row) => [
        row.registerNumber,
        row.studentName,
        row.department,
        row.year,
        row.section,
        row[1], row[2], row[3], row[4], row[5]
      ]);
    } else if (activeTab === 'subject') {
      const subjectName = SUBJECTS[subjectPeriod as PeriodNumber];
      subtitle = `Subject-wise Report: ${subjectName} (Period ${subjectPeriod}) | Range: ${subjectStartDate} to ${subjectEndDate}`;
      headers = [[
        'Register No', 'Student Name', 'Dept', 'Yr/Sec', 'Total',
        'Present', 'Absent', 'Late', 'OD', 'ML', 'LA', '%'
      ]];
      rows = reportData.map((row) => [
        row.registerNumber,
        row.studentName,
        row.department,
        `${row.year} ${row.section}`,
        row.totalClasses,
        row.present,
        row.absent,
        row.late,
        row.od,
        row.ml,
        row.la,
        `${row.percentage}%`
      ]);
    } else if (activeTab === 'student') {
      subtitle = `Student-wise Report: ${selectedStudentDetails?.studentName || 'Student'} (${selectedStudentDetails?.registerNumber || ''}) | Range: ${studentStartDate} to ${studentEndDate}`;
      headers = [[
        'Date', 'Period 1 (Java)', 'Period 2 (DS)', 'Period 3 (EDA)', 'Period 4 (OS)', 'Period 5 (DM)'
      ]];
      rows = reportData.map((row) => [
        row.date,
        row[1], row[2], row[3], row[4], row[5]
      ]);
    }

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(subtitle, 14, 34);

    doc.autoTable({
      startY: 40,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [50, 50, 50],
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'left' },
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
    });

    const nameForSave = activeTab === 'student'
      ? `${selectedStudentDetails?.studentName.replace(/\s+/g, '_') || 'Student'}_Report`
      : `${activeTab}_Report`;

    doc.save(`${nameForSave}.pdf`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Tab Navigation header */}
      <div className="flex gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-full sm:w-max">
        {[
          { id: 'daily', name: 'Daily Attendance' },
          { id: 'subject', name: 'Subject-wise' },
          { id: 'student', name: 'Student-wise' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Dynamic Filters Area Card */}
      <div className="glass p-6 rounded-2xl border border-slate-800 space-y-6">
        <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <FileText className="w-4.5 h-4.5 text-indigo-400" />
          <span>Report Configuration</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* TAB 1: Daily Report Filters */}
          {activeTab === 'daily' && (
            <div className="md:col-span-1">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                Report Date
              </label>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* TAB 2: Subject Report Filters */}
          {activeTab === 'subject' && (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                  Subject (Period)
                </label>
                <select
                  value={subjectPeriod}
                  onChange={(e) => setSubjectPeriod(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {[1, 2, 3, 4, 5].map((p) => (
                    <option key={p} value={p}>
                      Period {p} ({SUBJECTS[p as PeriodNumber]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={subjectStartDate}
                  onChange={(e) => setSubjectStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={subjectEndDate}
                  onChange={(e) => setSubjectEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {/* TAB 3: Student Report Filters */}
          {activeTab === 'student' && (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                  Select Student
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="" disabled>Choose a student...</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.registerNumber} - {student.studentName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={studentStartDate}
                  onChange={(e) => setStudentStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={studentEndDate}
                  onChange={(e) => setStudentEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Action Buttons to print / download */}
        {reportData.length > 0 && (
          <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-3">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-lg shadow-emerald-600/10 transition-colors text-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4.5 h-4.5" />
              <span>Export to Excel (.xlsx)</span>
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/10 transition-colors text-sm cursor-pointer"
            >
              <Printer className="w-4.5 h-4.5" />
              <span>Export Professional PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Report Data Preview Table */}
      <div className="glass rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/20 border-b border-slate-850">
          <h5 className="text-xs uppercase font-bold tracking-wider text-slate-400">
            Live Preview (Found {reportData.length} records)
          </h5>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : reportData.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            No records matched criteria. Refine filters to display details.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              {/* Daily Report Table Headers */}
              {activeTab === 'daily' && (
                <>
                  <thead>
                    <tr className="bg-slate-950/40 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-6 py-4">Register No</th>
                      <th className="px-6 py-4">Student Name</th>
                      <th className="px-6 py-4">Dept</th>
                      <th className="px-6 py-4">Yr/Sec</th>
                      <th className="px-6 py-4 text-center">P1 (Java)</th>
                      <th className="px-6 py-4 text-center">P2 (DS)</th>
                      <th className="px-6 py-4 text-center">P3 (EDA)</th>
                      <th className="px-6 py-4 text-center">P4 (OS)</th>
                      <th className="px-6 py-4 text-center">P5 (DM)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {reportData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-slate-200">{row.registerNumber}</td>
                        <td className="px-6 py-3.5 font-medium text-slate-100">{row.studentName}</td>
                        <td className="px-6 py-3.5 text-slate-400">{row.department}</td>
                        <td className="px-6 py-3.5 text-slate-400">{row.year} - {row.section}</td>
                        {[1, 2, 3, 4, 5].map((p) => {
                          const status = row[p];
                          let sColor = 'text-slate-500';
                          if (status === 'Present') sColor = 'text-emerald-400 font-bold';
                          if (status === 'Absent') sColor = 'text-rose-400 font-bold';
                          if (status === 'Late') sColor = 'text-amber-400 font-bold';
                          if (status === 'On Duty (OD)') sColor = 'text-blue-400 font-bold';
                          if (status === 'Medical Leave (ML)') sColor = 'text-purple-400 font-bold';
                          return (
                            <td key={p} className={`px-6 py-3.5 text-center ${sColor}`}>
                              {status === 'Unmarked' || status === '-' ? '-' : status}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {/* Subject-wise Report Table Headers */}
              {activeTab === 'subject' && (
                <>
                  <thead>
                    <tr className="bg-slate-950/40 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-6 py-4">Register No</th>
                      <th className="px-6 py-4">Student Name</th>
                      <th className="px-6 py-4 text-center">Classes</th>
                      <th className="px-6 py-4 text-center">Present</th>
                      <th className="px-6 py-4 text-center">Absent</th>
                      <th className="px-6 py-4 text-center">Late</th>
                      <th className="px-6 py-4 text-center">OD</th>
                      <th className="px-6 py-4 text-center">ML</th>
                      <th className="px-6 py-4 text-center">LA</th>
                      <th className="px-6 py-4 text-right">Attended %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {reportData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-slate-200">{row.registerNumber}</td>
                        <td className="px-6 py-3.5 font-medium text-slate-100">{row.studentName}</td>
                        <td className="px-6 py-3.5 text-center text-slate-300 font-semibold">{row.totalClasses}</td>
                        <td className="px-6 py-3.5 text-center text-emerald-400 font-semibold">{row.present}</td>
                        <td className="px-6 py-3.5 text-center text-rose-400 font-semibold">{row.absent}</td>
                        <td className="px-6 py-3.5 text-center text-amber-400">{row.late}</td>
                        <td className="px-6 py-3.5 text-center text-blue-400">{row.od}</td>
                        <td className="px-6 py-3.5 text-center text-purple-400">{row.ml}</td>
                        <td className="px-6 py-3.5 text-center text-zinc-400">{row.la}</td>
                        <td className="px-6 py-3.5 text-right font-bold text-slate-100">{row.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {/* Student-wise Report Table Headers */}
              {activeTab === 'student' && (
                <>
                  <thead>
                    <tr className="bg-slate-950/40 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-6 py-4">Session Date</th>
                      <th className="px-6 py-4 text-center">P1 (Java)</th>
                      <th className="px-6 py-4 text-center">P2 (DS)</th>
                      <th className="px-6 py-4 text-center">P3 (EDA)</th>
                      <th className="px-6 py-4 text-center">P4 (OS)</th>
                      <th className="px-6 py-4 text-center">P5 (DM)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {reportData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-3.5 font-medium text-slate-200">{row.date}</td>
                        {[1, 2, 3, 4, 5].map((p) => {
                          const status = row[p];
                          let sColor = 'text-slate-500';
                          if (status === 'Present') sColor = 'text-emerald-400 font-bold';
                          if (status === 'Absent') sColor = 'text-rose-400 font-bold';
                          if (status === 'Late') sColor = 'text-amber-400 font-bold';
                          if (status === 'On Duty (OD)') sColor = 'text-blue-400 font-bold';
                          if (status === 'Medical Leave (ML)') sColor = 'text-purple-400 font-bold';
                          return (
                            <td key={p} className={`px-6 py-3.5 text-center ${sColor}`}>
                              {status === 'Unmarked' || status === '-' ? '-' : status}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

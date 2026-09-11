// src/lib/marksExport.ts
import * as XLSX from 'xlsx';
import { getAllStudentsWithStats, getStudentMarksAction } from '@/app/actions';

export interface ExportStudent {
  id: number;
  registerNumber: string;
  studentName: string;
  year: string;
  section: string;
}

/**
 * Generates an XLSX workbook with marks for CIA 1, CIA 2, and Model Exam.
 * Each sheet contains columns: S.No, Register Number, Student Name, Year, Section,
 * Subject, Obtained Marks, Total Marks.
 *
 * @param filter Optional search filter string to limit students (same logic as marks page).
 */
export async function generateMarksWorkbook(filter: string = ''): Promise<{ workbook: XLSX.WorkBook; fileName: string }> {
  const allStudents: ExportStudent[] = await getAllStudentsWithStats();
  const filtered = allStudents.filter((s) => {
    const q = filter.toLowerCase().trim();
    return (
      s.registerNumber.toLowerCase().includes(q) ||
      s.studentName.toLowerCase().includes(q) ||
      s.year.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q)
    );
  });

  // Map: studentId -> examCategory -> subject -> obtained marks
  const studentMap: Record<number, Record<string, Record<string, number>>> = {};
  const subjectSet = new Set<string>();

  // Load marks for each student once
  for (const stu of filtered) {
    const res = await getStudentMarksAction(stu.id);
    const marks = res.success && res.marks ? res.marks : [];
    const examMap: Record<string, Record<string, number>> = {};
    for (const m of marks) {
      if (!examMap[m.examCategory]) examMap[m.examCategory] = {};
      examMap[m.examCategory][m.subject] = m.obtainedMarks;
      subjectSet.add(m.subject);
    }
    studentMap[stu.id] = examMap;
  }

  const subjects = Array.from(subjectSet).sort();
  const header = ['S.No', 'Register Number', 'Student Name', 'CIA 1 /100', 'CIA 2 /100', 'Model Exam /100'];

  const sheetData: any[][] = [];
  const rowsPerSubject = filtered.length + 4; // heading + header + data rows + two blanks

  subjects.forEach((subj) => {
    // Subject heading (merged later)
    sheetData.push([subj]);
    // Column headers
    sheetData.push(header);
    // Data rows per student
    filtered.forEach((stu, sIdx) => {
      const examMap = studentMap[stu.id] || {};
      const getVal = (exam: string) => {
        const val = examMap[exam]?.[subj];
        return val !== undefined && val !== null ? val : '';
      };
      sheetData.push([
        sIdx + 1,
        stu.registerNumber,
        stu.studentName,
        getVal('CIA 1'),
        getVal('CIA 2'),
        getVal('Model Exam'),
      ]);
    });
    // Two blank rows between subjects
    sheetData.push([]);
    sheetData.push([]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Merge subject headings across all columns (6 columns)
  const merges: XLSX.Range[] = [];
  subjects.forEach((_, i) => {
    const headingRow = i * rowsPerSubject;
    merges.push({ s: { r: headingRow, c: 0 }, e: { r: headingRow, c: header.length - 1 } });
  });
  ws['!merges'] = merges;

  // Column widths for readability
  ws['!cols'] = [
    { wch: 6 }, // S.No
    { wch: 18 }, // Register Number
    { wch: 25 }, // Student Name
    { wch: 12 }, // CIA 1
    { wch: 12 }, // CIA 2
    { wch: 14 }, // Model Exam
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Marks');

  const fileName = `CR-Attendance-Marks-${new Date().toLocaleDateString('en-GB').replace(/\\/g, '-')}.xlsx`;
  return { workbook: wb, fileName };
}

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

const DEFAULT_SUBJECTS = [
  'Java',
  'Data Structures',
  'EDA',
  'Operating Systems (OS)',
  'Discrete Mathematics',
];

/**
 * Generates an XLSX workbook with semester-wise marks for CIA 1, CIA 2, and Model Exam.
 * Recommended vertical layout:
 * SEMESTER 1
 * Subject Name
 * S.No | Register No | Student Name | CIA 1 /100 | CIA 2 /100 | Model Exam /100
 * ...
 *
 * @param filter Optional search filter string to limit students.
 * @param semesterFilter Optional semester number (1-8) or 'ALL' to export all semesters vertically.
 */
export async function generateMarksWorkbook(
  filter: string = '',
  semesterFilter: number | 'ALL' = 'ALL'
): Promise<{ workbook: XLSX.WorkBook; fileName: string }> {
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

  // Map: studentId -> semester -> examCategory -> subject -> obtained marks
  const studentMap: Record<number, Record<number, Record<string, Record<string, number>>>> = {};
  const activeSemestersSet = new Set<number>();

  // Load marks for each student
  for (const stu of filtered) {
    const res = await getStudentMarksAction(stu.id);
    const marks = res.success && res.marks ? res.marks : [];
    const semMap: Record<number, Record<string, Record<string, number>>> = {};

    for (const m of marks) {
      const sem = m.semester || 1;
      activeSemestersSet.add(sem);
      if (!semMap[sem]) semMap[sem] = {};
      if (!semMap[sem][m.examCategory]) semMap[sem][m.examCategory] = {};
      semMap[sem][m.examCategory][m.subject] = m.obtainedMarks;
    }
    studentMap[stu.id] = semMap;
  }

  let semestersToExport: number[] = [];
  if (typeof semesterFilter === 'number' && semesterFilter >= 1 && semesterFilter <= 8) {
    semestersToExport = [semesterFilter];
  } else {
    // If ALL, export active semesters in order (or 1..8 if active, default to at least [1])
    const activeArr = Array.from(activeSemestersSet).sort((a, b) => a - b);
    semestersToExport = activeArr.length > 0 ? activeArr : [1];
  }

  const header = ['S.No', 'Register Number', 'Student Name', 'CIA 1 /100', 'CIA 2 /100', 'Model Exam /100'];
  const sheetData: any[][] = [];
  const merges: XLSX.Range[] = [];
  let currentRowIndex = 0;

  for (const sem of semestersToExport) {
    // Semester Title Banner
    sheetData.push([`SEMESTER ${sem}`]);
    merges.push({ s: { r: currentRowIndex, c: 0 }, e: { r: currentRowIndex, c: header.length - 1 } });
    currentRowIndex++;

    // Collect subjects for this semester
    const semSubjectSet = new Set<string>(DEFAULT_SUBJECTS);
    filtered.forEach((stu) => {
      const semData = studentMap[stu.id]?.[sem] || {};
      Object.keys(semData).forEach((cat) => {
        Object.keys(semData[cat]).forEach((sub) => semSubjectSet.add(sub));
      });
    });

    const subjects = Array.from(semSubjectSet).sort();

    subjects.forEach((subj) => {
      // Subject heading
      sheetData.push([`Subject: ${subj}`]);
      merges.push({ s: { r: currentRowIndex, c: 0 }, e: { r: currentRowIndex, c: header.length - 1 } });
      currentRowIndex++;

      // Header row
      sheetData.push(header);
      currentRowIndex++;

      // Student rows
      filtered.forEach((stu, sIdx) => {
        const semData = studentMap[stu.id]?.[sem] || {};
        const getVal = (exam: string) => {
          const val = semData[exam]?.[subj];
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
        currentRowIndex++;
      });

      // Blank rows between subjects
      sheetData.push([]);
      sheetData.push([]);
      currentRowIndex += 2;
    });

    // Blank row between semesters
    sheetData.push([]);
    currentRowIndex++;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!merges'] = merges;

  // Column widths
  ws['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 18 }, // Register Number
    { wch: 25 }, // Student Name
    { wch: 12 }, // CIA 1
    { wch: 12 }, // CIA 2
    { wch: 14 }, // Model Exam
  ];

  const sheetName = typeof semesterFilter === 'number' ? `Sem ${semesterFilter} Marks` : 'Semester Marks';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const semSuffix = typeof semesterFilter === 'number' ? `-Sem${semesterFilter}` : '-AllSemesters';
  const fileName = `CR-Attendance-Marks${semSuffix}-${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`;
  return { workbook: wb, fileName };
}

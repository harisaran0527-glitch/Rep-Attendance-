import { prisma } from './db';

// Helper to normalize date to local midnight (00:00:00.000)
export function normalizeDate(dateInput: Date | string | number): Date {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Subject mappings (fixed 5 subjects corresponding to period 1-5)
export const SUBJECTS = {
  1: 'Java',
  2: 'Data Structures',
  3: 'EDA',
  4: 'Operating Systems (OS)',
  5: 'Discrete Mathematics',
} as const;

export type PeriodNumber = 1 | 2 | 3 | 4 | 5;

// Status list allowed in the application
export const ATTENDANCE_STATUSES = [
  'Present',
  'Absent',
  'ELITE',
  'On Duty',
  'Medical Leave',
  'Long Leave'
] as const;

export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];

// ==========================================
// STUDENTS API
// ==========================================

export async function addStudent(data: {
  registerNumber: string;
  studentName: string;
  department: string;
  year: string;
  section: string;
}) {
  return prisma.student.create({
    data: {
      registerNumber: data.registerNumber.trim(),
      studentName: data.studentName.trim(),
      department: data.department.trim(),
      year: data.year.trim(),
      section: data.section.trim(),
    },
  });
}

export async function editStudent(
  id: number,
  data: {
    registerNumber: string;
    studentName: string;
    department: string;
    year: string;
    section: string;
  }
) {
  return prisma.student.update({
    where: { id },
    data: {
      registerNumber: data.registerNumber.trim(),
      studentName: data.studentName.trim(),
      department: data.department.trim(),
      year: data.year.trim(),
      section: data.section.trim(),
    },
  });
}

export async function deleteStudent(id: number) {
  return prisma.student.delete({
    where: { id },
  });
}

export async function getAllStudents() {
  return prisma.student.findMany({
    orderBy: {
      registerNumber: 'asc',
    },
  });
}

export async function searchStudents(query: string) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return getAllStudents();

  return prisma.student.findMany({
    where: {
      OR: [
        { registerNumber: { contains: cleanQuery } },
        { studentName: { contains: cleanQuery } },
        { department: { contains: cleanQuery } },
        { year: { contains: cleanQuery } },
        { section: { contains: cleanQuery } },
      ],
    },
    orderBy: {
      registerNumber: 'asc',
    },
  });
}

// ==========================================
// ATTENDANCE API
// ==========================================

export async function saveAttendance(
  studentId: number,
  date: Date | string,
  period: number,
  status: AttendanceStatus
) {
  const normalizedDate = normalizeDate(date);

  // If attendance already exists for the same Student, Date, Period, Update the existing record.
  // Never create duplicate attendance. (Upsert using unique index)
  return prisma.attendance.upsert({
    where: {
      studentId_date_period: {
        studentId,
        date: normalizedDate,
        period,
      },
    },
    update: {
      status,
    },
    create: {
      studentId,
      date: normalizedDate,
      period,
      status,
    },
  });
}

export async function updateAttendance(id: number, status: AttendanceStatus) {
  return prisma.attendance.update({
    where: { id },
    data: { status },
  });
}

export async function getAttendanceByDate(date: Date | string) {
  const normalizedDate = normalizeDate(date);
  return prisma.attendance.findMany({
    where: {
      date: normalizedDate,
    },
    include: {
      student: true,
    },
  });
}

export async function getAttendanceByPeriod(date: Date | string, period: number) {
  const normalizedDate = normalizeDate(date);
  return prisma.attendance.findMany({
    where: {
      date: normalizedDate,
      period,
    },
    include: {
      student: true,
    },
  });
}

export async function getStudentAttendanceHistory(studentId: number) {
  return prisma.attendance.findMany({
    where: {
      studentId,
    },
    orderBy: {
      date: 'desc',
    },
  });
}

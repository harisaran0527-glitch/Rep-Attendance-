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
  'Late',
  'On Duty (OD)',
  'Medical Leave (ML)',
  'Long Absent'
] as const;

export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];

// ==========================================
// SMTP SETTINGS & EMAIL LOGS API
// ==========================================

export async function getSmtpSettings() {
  return prisma.smtpSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      password: '',
      senderName: 'College Attendance Portal',
      senderEmail: '',
      lowThreshold: 75.0,
    },
  });
}

export async function updateSmtpSettings(data: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  senderName: string;
  senderEmail: string;
  lowThreshold: number;
}) {
  const updateData: any = {
    host: data.host.trim(),
    port: Number(data.port),
    secure: Boolean(data.secure),
    user: data.user.trim(),
    senderName: data.senderName.trim(),
    senderEmail: data.senderEmail.trim(),
    lowThreshold: Number(data.lowThreshold),
  };

  if (data.password !== undefined) {
    updateData.password = data.password;
  }

  return prisma.smtpSettings.update({
    where: { id: 1 },
    data: updateData,
  });
}

export async function getEmailLogs() {
  return prisma.emailLog.findMany({
    include: {
      student: true,
    },
    orderBy: {
      sentAt: 'desc',
    },
  });
}

export async function logSentEmail(data: {
  studentId: number;
  email: string;
  percentage: number;
  subject: string;
  body: string;
  status: string;
}) {
  return prisma.emailLog.create({
    data,
  });
}

export async function calculateOverallAttendance(studentId: number) {
  const attendances = await prisma.attendance.findMany({
    where: { studentId },
  });

  if (attendances.length === 0) {
    return { percentage: 100.0, attended: 0, total: 0 };
  }

  const attendedStatuses = ['Present', 'Late', 'On Duty (OD)', 'Medical Leave (ML)'];
  const attended = attendances.filter((a) => attendedStatuses.includes(a.status)).length;
  const total = attendances.length;
  const percentage = Math.round((attended / total) * 1000) / 10; // 1 decimal place e.g. 74.5

  return { percentage, attended, total };
}

// ==========================================
// STUDENTS API
// ==========================================

export async function addStudent(data: {
  registerNumber: string;
  studentName: string;
  email: string;
  department: string;
  year: string;
  section: string;
}) {
  return prisma.student.create({
    data: {
      registerNumber: data.registerNumber.trim(),
      studentName: data.studentName.trim(),
      email: data.email.trim(),
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
    email: string;
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
      email: data.email.trim(),
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

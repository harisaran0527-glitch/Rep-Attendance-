import { prisma } from './db';

// Helper to normalize date to local midnight (00:00:00.000)
export function normalizeDate(dateInput: Date | string | number): Date {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Fixed baseline start date for attendance calculation (13/07/2026)
export const ATTENDANCE_START_DATE = normalizeDate('2026-07-13');

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
      collegeOpeningDate: '2026-07-13',
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
  collegeOpeningDate?: string;
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

  if (data.collegeOpeningDate !== undefined) {
    updateData.collegeOpeningDate = data.collegeOpeningDate.trim();
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

export async function deleteEmailLog(id: number) {
  return prisma.emailLog.delete({
    where: { id },
  });
}

export async function deleteAllEmailLogs() {
  return prisma.emailLog.deleteMany({});
}

export async function getWorkingDaysCount(startDateStr: string, endDateStr?: string) {
  const start = normalizeDate(startDateStr);
  const now = normalizeDate(new Date());
  const requestedEnd = endDateStr ? normalizeDate(endDateStr) : now;
  // Ensure future dates are never counted
  const end = requestedEnd.getTime() > now.getTime() ? now : requestedEnd;

  if (start.getTime() > end.getTime()) {
    return 0;
  }

  // Count ONLY distinct dates for which attendance has actually been marked in DB
  const distinctMarked = await prisma.attendance.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
    },
    select: {
      date: true,
    },
    distinct: ['date'],
  });

  return distinctMarked.length;
}

export async function calculateOverallAttendance(studentId: number, targetDateInput?: Date | string) {
  const settings = await getSmtpSettings();
  const openingDateStr = settings.collegeOpeningDate || '2026-07-13';
  const openingDate = normalizeDate(openingDateStr);

  const now = normalizeDate(new Date());
  const requestedTarget = targetDateInput ? normalizeDate(targetDateInput) : now;
  const targetDate = requestedTarget.getTime() > now.getTime() ? now : requestedTarget;

  // Total distinct marked attendance dates in system from opening date up to target date
  const totalWorkingDays = await getWorkingDaysCount(openingDateStr, targetDate.toISOString().split('T')[0]);

  // Query attendance ONLY for this specific student from openingDate up to targetDate
  const attendances = await prisma.attendance.findMany({
    where: { 
      studentId,
      date: {
        gte: openingDate,
        lte: targetDate,
      },
    },
  });

  const attendedStatuses = ['Present', 'Late', 'On Duty (OD)', 'Medical Leave (ML)'];
  
  // Total Days Present for THIS individual student
  const daysPresent = attendances.filter((a) => attendedStatuses.includes(a.status)).length;
  
  // Total Days Absent (working days minus present days)
  const daysAbsent = Math.max(0, totalWorkingDays - daysPresent);
  
  // Rule: Before attendance starts (0 marked dates), display 100%. Once attendance starts (1+ marked dates), calculate real percentage to 2 decimal places.
  const percentage = totalWorkingDays === 0 
    ? 100.0 
    : Math.round((daysPresent / totalWorkingDays) * 10000) / 100;

  return {
    percentage,
    attended: daysPresent,
    total: totalWorkingDays,
    absent: daysAbsent,
    daysPresent,
    daysAbsent,
    totalDays: totalWorkingDays,
    openingDate: openingDateStr,
  };
}

// ==========================================
// STUDENTS API
// ==========================================

export async function addStudent(data: {
  registerNumber: string;
  studentName: string;
  email: string;
  password?: string;
  department: string;
  year: string;
  section: string;
}) {
  return prisma.student.create({
    data: {
      registerNumber: data.registerNumber.trim(),
      studentName: data.studentName.trim(),
      email: data.email.trim(),
      password: data.password || "",
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
    password?: string;
    department: string;
    year: string;
    section: string;
  }
) {
  const updateData: any = {
    registerNumber: data.registerNumber.trim(),
    studentName: data.studentName.trim(),
    email: data.email.trim(),
    department: data.department.trim(),
    year: data.year.trim(),
    section: data.section.trim(),
  };

  if (data.password) {
    updateData.password = data.password;
  }

  return prisma.student.update({
    where: { id },
    data: updateData,
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
      studentId_date: {
        studentId,
        date: normalizedDate,
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

// ==========================================
// TEACHERS API
// ==========================================

export async function addTeacher(data: {
  name: string;
  email: string;
  password: string;
  department?: string;
}) {
  return prisma.teacher.create({
    data: {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      department: (data.department || 'CSE').trim(),
    },
  });
}

export async function getAllTeachers() {
  return prisma.teacher.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function deleteTeacher(id: number) {
  return prisma.teacher.delete({
    where: { id },
  });
}

export async function findTeacherByEmail(email: string) {
  return prisma.teacher.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

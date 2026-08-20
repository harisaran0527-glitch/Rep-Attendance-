import { prisma } from './db';

// Versioned in-memory TTL cache for working dates
let cacheVersion = Date.now();
let cachedWorkingDates: { version: number; key: string; data: Date[]; expiresAt: number } | null = null;

export function invalidateCache() {
  cacheVersion = Date.now();
  cachedWorkingDates = null;
}

// Helper to normalize date to UTC midnight (00:00:00.000Z) consistently across server & client
export function normalizeDate(dateInput: Date | string | number): Date {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
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
  'On Duty (OD)',
  'Medical Leave (ML)',
  'Long Absent'
] as const;

export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];

// Helper to normalize any stored or input status variant into a canonical AttendanceStatus string
export function normalizeStatus(rawStatus: string): 'Present' | 'Absent' | 'OD' | 'Medical Leave' | 'Long Absent' | 'Unmarked' {
  if (!rawStatus) return 'Unmarked';
  const s = rawStatus.trim().toLowerCase().replace(/_/g, ' ');

  if (s === 'present' || s === 'p') return 'Present';
  if (s === 'absent' || s === 'a') return 'Absent';
  if (s === 'od' || s === 'on duty' || s === 'on duty (od)' || s === 'onduty') return 'OD';
  if (s === 'ml' || s === 'medical leave' || s === 'medical leave (ml)' || s === 'medical_leave' || s === 'medicalleave') return 'Medical Leave';
  if (s === 'la' || s === 'long absent' || s === 'long_absent' || s === 'longabsent') return 'Long Absent';

  if (s.includes('present')) return 'Present';
  if (s.includes('absent') && !s.includes('long')) return 'Absent';
  if (s.includes('duty') || s.includes('od')) return 'OD';
  if (s.includes('medical') || s.includes('ml')) return 'Medical Leave';
  if (s.includes('long')) return 'Long Absent';

  return 'Unmarked';
}

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
  invalidateCache();
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
    select: {
      id: true,
      studentId: true,
      email: true,
      percentage: true,
      subject: true,
      body: true,
      warningMonth: true,
      sentAt: true,
      status: true,
      student: {
        select: {
          id: true,
          registerNumber: true,
          studentName: true,
          email: true,
          department: true,
          year: true,
          section: true,
          profilePhotoUrl: true,
        },
      },
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
  warningMonth?: string;
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

export async function getValidWorkingDates(
  startDateStr: string,
  endDateStr?: string,
  studentType?: string
): Promise<Date[]> {
  const start = normalizeDate(startDateStr);
  const now = normalizeDate(new Date());
  const requestedEnd = endDateStr ? normalizeDate(endDateStr) : now;
  const end = requestedEnd.getTime() > now.getTime() ? now : requestedEnd;

  if (start.getTime() > end.getTime()) {
    return [];
  }

  const cacheKey = `${start.toISOString()}_${end.toISOString()}_${studentType || 'ALL'}`;
  const nowMs = Date.now();

  if (
    cachedWorkingDates &&
    cachedWorkingDates.version === cacheVersion &&
    cachedWorkingDates.key === cacheKey &&
    nowMs < cachedWorkingDates.expiresAt
  ) {
    return cachedWorkingDates.data;
  }

  const whereClause: any = {
    date: {
      gte: start,
      lte: end,
    },
  };

  if (studentType) {
    whereClause.student = {
      studentType: studentType,
    };
  }

  const dateCounts = await prisma.attendance.groupBy({
    by: ['date'],
    where: whereClause,
    _count: {
      id: true,
    },
  });

  const validDates = dateCounts
    .filter((d) => d._count.id >= 1)
    .map((d) => d.date);

  cachedWorkingDates = {
    version: cacheVersion,
    key: cacheKey,
    data: validDates,
    expiresAt: nowMs + 60000, // 60 seconds TTL
  };

  return validDates;
}

export async function getWorkingDaysCount(startDateStr: string, endDateStr?: string, studentType?: string): Promise<number> {
  const dates = await getValidWorkingDates(startDateStr, endDateStr, studentType);
  return dates.length;
}

export async function calculateOverallAttendance(studentId: number, targetDateInput?: Date | string) {
  const settings = await getSmtpSettings();
  const openingDateStr = settings.collegeOpeningDate || '2026-07-13';
  const openingDate = normalizeDate(openingDateStr);

  const now = normalizeDate(new Date());
  const requestedTarget = targetDateInput ? normalizeDate(targetDateInput) : now;
  const targetDate = requestedTarget.getTime() > now.getTime() ? now : requestedTarget;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { studentType: true },
  });
  const studentType = student?.studentType || 'REGULAR';

  // Get valid working dates SPECIFIC to student's cohort
  const validDates = await getValidWorkingDates(openingDateStr, targetDate.toISOString().split('T')[0], studentType);
  const validDateTimes = new Set(validDates.map((d) => d.getTime()));

  // Query attendance ONLY for this specific student from openingDate up to targetDate
  const attendances = await prisma.attendance.findMany({
    where: { 
      studentId,
      date: {
        gte: openingDate,
        lte: targetDate,
      },
    },
    select: {
      status: true,
      date: true,
    },
  });

  // Only consider attendance records that fall on a valid working day for this cohort
  const validAttendances = attendances.filter((a) => validDateTimes.has(a.date.getTime()));

  const attendedStatuses = ['Present', 'On Duty (OD)', 'Medical Leave (ML)', 'Medical Leave'];
  const absentStatuses = ['Absent', 'Long Absent'];

  // Total Days Present for THIS individual student
  const daysPresent = validAttendances.filter((a) => attendedStatuses.includes(a.status)).length;
  
  // Total Days Absent
  const daysAbsent = validAttendances.filter((a) => absentStatuses.includes(a.status)).length;
  
  const savedRows = validAttendances.length;
  const missing = Math.max(0, validDates.length - savedRows);

  const percentage = validDates.length === 0 
    ? 100.0 
    : Math.round((daysPresent / validDates.length) * 10000) / 100;

  return {
    percentage,
    attended: daysPresent,
    total: validDates.length,
    absent: daysAbsent,
    daysPresent,
    daysAbsent,
    totalDays: validDates.length,
    openingDate: openingDateStr,
    savedRows,
    missing,
    studentType,
  };
}

export async function calculateAllStudentsAttendanceStats(targetDateInput?: Date | string, studentIds?: number[]) {
  const settings = await getSmtpSettings();
  const openingDateStr = settings.collegeOpeningDate || '2026-07-13';
  const openingDate = normalizeDate(openingDateStr);

  const now = normalizeDate(new Date());
  const requestedTarget = targetDateInput ? normalizeDate(targetDateInput) : now;
  const targetDate = requestedTarget.getTime() > now.getTime() ? now : requestedTarget;

  // Calculate valid working dates for BOTH cohorts independently
  const [regularValidDates, lateralValidDates] = await Promise.all([
    getValidWorkingDates(openingDateStr, targetDate.toISOString().split('T')[0], 'REGULAR'),
    getValidWorkingDates(openingDateStr, targetDate.toISOString().split('T')[0], 'LATERAL_ENTRY'),
  ]);

  const regularDateTimes = new Set(regularValidDates.map((d) => d.getTime()));
  const lateralDateTimes = new Set(lateralValidDates.map((d) => d.getTime()));

  const students = await prisma.student.findMany({
    select: { id: true, studentType: true },
    ...(studentIds && studentIds.length > 0 ? { where: { id: { in: studentIds } } } : {}),
  });

  const studentTypeMap = new Map<number, string>();
  students.forEach((s) => studentTypeMap.set(s.id, s.studentType || 'REGULAR'));

  const allAttendances = await prisma.attendance.findMany({
    where: {
      ...(studentIds && studentIds.length > 0 ? { studentId: { in: studentIds } } : {}),
    },
    select: {
      studentId: true,
      status: true,
      date: true,
    },
  });

  const attendedStatuses = ['Present', 'On Duty (OD)', 'Medical Leave (ML)', 'Medical Leave'];
  const absentStatuses = ['Absent', 'Long Absent'];

  const studentAttendedMap: Record<number, number> = {};
  const studentAbsentMap: Record<number, number> = {};
  const studentSavedCountMap: Record<number, number> = {};

  allAttendances.forEach((att) => {
    const sType = studentTypeMap.get(att.studentId) || 'REGULAR';
    const validDateSet = sType === 'LATERAL_ENTRY' ? lateralDateTimes : regularDateTimes;

    if (!validDateSet.has(att.date.getTime())) return;

    const s = att.status;
    const isAttended = attendedStatuses.includes(s);
    const isAbsent = absentStatuses.includes(s);

    if (isAttended || isAbsent) {
      studentSavedCountMap[att.studentId] = (studentSavedCountMap[att.studentId] || 0) + 1;
      if (isAttended) {
        studentAttendedMap[att.studentId] = (studentAttendedMap[att.studentId] || 0) + 1;
      } else {
        studentAbsentMap[att.studentId] = (studentAbsentMap[att.studentId] || 0) + 1;
      }
    }
  });

  return {
    settings,
    totalWorkingDays: regularValidDates.length,
    regularWorkingDays: regularValidDates.length,
    lateralWorkingDays: lateralValidDates.length,
    regularValidDates,
    lateralValidDates,
    getStudentStats: (studentId: number) => {
      const sType = studentTypeMap.get(studentId) || 'REGULAR';
      const totalWorkingDays = sType === 'LATERAL_ENTRY' ? lateralValidDates.length : regularValidDates.length;
      const attended = studentAttendedMap[studentId] || 0;
      const absent = studentAbsentMap[studentId] || 0;
      const savedRows = studentSavedCountMap[studentId] || 0;
      const percentage = totalWorkingDays > 0
        ? Math.round((attended / totalWorkingDays) * 10000) / 100
        : 100.0;

      return {
        percentage,
        attended,
        total: totalWorkingDays,
        absent,
        daysPresent: attended,
        daysAbsent: absent,
        totalDays: totalWorkingDays,
        savedRows,
        missing: Math.max(0, totalWorkingDays - savedRows),
        studentType: sType,
      };
    },
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
  studentType?: string;
}) {
  invalidateCache();
  return prisma.student.create({
    data: {
      registerNumber: data.registerNumber.trim(),
      studentName: data.studentName.trim(),
      email: data.email.trim(),
      password: data.password || "",
      department: data.department.trim(),
      year: data.year.trim(),
      section: data.section.trim(),
      studentType: data.studentType || 'REGULAR',
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
    studentType?: string;
  }
) {
  invalidateCache();
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
  if (data.studentType) {
    updateData.studentType = data.studentType;
  }

  return prisma.student.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteStudent(id: number) {
  invalidateCache();
  return prisma.student.delete({
    where: { id },
  });
}

export async function getStudentById(id: number) {
  return prisma.student.findUnique({
    where: { id },
    select: {
      id: true,
      registerNumber: true,
      studentName: true,
      email: true,
      department: true,
      year: true,
      section: true,
      studentType: true,
      profilePhotoUrl: true,
      profilePhotoPublicId: true,
      createdAt: true,
    },
  });
}

export async function updateStudentPhoto(
  id: number,
  profilePhotoUrl: string | null,
  profilePhotoPublicId?: string | null
) {
  invalidateCache();
  return prisma.student.update({
    where: { id },
    data: {
      profilePhotoUrl,
      profilePhotoPublicId: profilePhotoPublicId !== undefined ? profilePhotoPublicId : null,
    },
  });
}

export async function getAllStudents() {
  return prisma.student.findMany({
    select: {
      id: true,
      registerNumber: true,
      studentName: true,
      email: true,
      department: true,
      year: true,
      section: true,
      studentType: true,
      profilePhotoUrl: true,
      profilePhotoPublicId: true,
      createdAt: true,
    },
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
        { studentType: { contains: cleanQuery } },
      ],
    },
    select: {
      id: true,
      registerNumber: true,
      studentName: true,
      email: true,
      department: true,
      year: true,
      section: true,
      studentType: true,
      profilePhotoUrl: true,
      profilePhotoPublicId: true,
      createdAt: true,
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
  invalidateCache();
  const normalizedDate = normalizeDate(date);

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
  invalidateCache();
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
    select: {
      id: true,
      studentId: true,
      date: true,
      period: true,
      status: true,
      student: {
        select: {
          id: true,
          registerNumber: true,
          studentName: true,
          email: true,
          department: true,
          year: true,
          section: true,
          profilePhotoUrl: true,
        },
      },
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
    select: {
      id: true,
      studentId: true,
      date: true,
      period: true,
      status: true,
      student: {
        select: {
          id: true,
          registerNumber: true,
          studentName: true,
          email: true,
          department: true,
          year: true,
          section: true,
          profilePhotoUrl: true,
        },
      },
    },
  });
}

export async function getStudentAttendanceHistory(studentId: number) {
  return prisma.attendance.findMany({
    where: {
      studentId,
    },
    select: {
      id: true,
      studentId: true,
      date: true,
      period: true,
      status: true,
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
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      createdAt: true,
    },
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

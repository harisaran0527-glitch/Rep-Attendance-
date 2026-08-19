'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { 
  setAdminSession, 
  clearAdminSession, 
  isAdminAuthenticated,
  setStudentSession,
  clearStudentSession,
  getStudentSession,
  isStudentAuthenticated,
  setTeacherSession,
  clearTeacherSession,
  getTeacherSession,
  isTeacherAuthenticated,
  isStaffAuthenticated
} from '@/lib/auth';
import { isSundayDate, isHoliday } from '@/lib/holidays';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import {
  addStudent,
  editStudent,
  deleteStudent,
  saveAttendance,
  normalizeDate,
  AttendanceStatus,
  getAllStudents as dbGetAllStudents,
  getSmtpSettings,
  updateSmtpSettings,
  getEmailLogs,
  logSentEmail,
  deleteEmailLog,
  deleteAllEmailLogs,
  calculateOverallAttendance,
  calculateAllStudentsAttendanceStats,
  getWorkingDaysCount,
  getValidWorkingDates,
  ATTENDANCE_START_DATE,
  SUBJECTS,
  addTeacher,
  getAllTeachers,
  deleteTeacher,
  findTeacherByEmail,
  normalizeStatus,
  invalidateCache
} from '@/lib/db-api';
import { sendLowAttendanceEmail } from '@/lib/email';
import { runMonthlyWarningEmailJob, MonthlyWarningJobOptions } from '@/lib/monthly-scheduler';

export async function getAllStudents() {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }
  return dbGetAllStudents();
}

// Action to get students with their percentages
export async function getAllStudentsWithStats() {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    // 1. Fetch active students and settings in parallel
    const [students, settings] = await Promise.all([
      dbGetAllStudents(),
      getSmtpSettings(),
    ]);

    const now = normalizeDate(new Date());
    const stats = await calculateAllStudentsAttendanceStats(now.toISOString().split('T')[0]);

    // Map all students
    const results = students.map((student) => {
      const studentStats = stats.getStudentStats(student.id);

      return {
        ...student,
        percentage: studentStats.percentage,
        attended: studentStats.attended,
        totalClasses: studentStats.total,
        daysPresent: studentStats.attended,
        daysAbsent: studentStats.absent,
        savedRows: studentStats.savedRows,
        missing: studentStats.missing,
      };
    });

    return results;
  } catch (error) {
    console.error('Error calculating bulk stats, falling back to base student list:', error);
    const students = await dbGetAllStudents();
    return students.map((student) => ({
      ...student,
      percentage: 100.0,
      attended: 0,
      totalClasses: 0,
      daysPresent: 0,
      daysAbsent: 0,
      savedRows: 0,
      missing: 0,
    }));
  }
}

// ==========================================
// AUTH ACTIONS
// ==========================================

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const admin = await prisma.admin.findUnique({
    where: { email: email.trim() },
  });

  if (!admin || admin.password !== password) {
    return { success: false, error: 'Invalid email or password.' };
  }

  await setAdminSession(admin.email);
  return { success: true };
}

export async function logoutAction() {
  await clearAdminSession();
  return { success: true };
}

// ==========================================
// STUDENT ACTIONS
// ==========================================

export async function addStudentAction(data: {
  registerNumber: string;
  studentName: string;
  email: string;
  password?: string;
  department: string;
  year: string;
  section: string;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  if (!data.email || !data.email.trim()) {
    return { success: false, error: 'Student Email is required.' };
  }

  if (!data.password || !data.password.trim()) {
    return { success: false, error: 'Student Password is required.' };
  }

  try {
    const rawPassword = data.password.trim();
    const hashedPassword = hashPassword(rawPassword);
    await addStudent({ 
      ...data, 
      email: data.email.trim().toLowerCase(),
      password: hashedPassword 
    });
    revalidatePath('/students');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Roll Number or Email already exists.' };
    }
    return { success: false, error: 'Failed to add student.' };
  }
}

export async function addBulkStudentsAction(studentsList: {
  registerNumber: string;
  studentName: string;
  email: string;
  password?: string;
  department: string;
  year: string;
  section: string;
}[]) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    let addedCount = 0;
    let failedList: string[] = [];

    for (const studentData of studentsList) {
      try {
        if (!studentData.email || !studentData.password) {
          failedList.push(`${studentData.registerNumber} (Missing Email or Password)`);
          continue;
        }
        const hashedPassword = hashPassword(studentData.password.trim());
        await addStudent({ 
          ...studentData, 
          email: studentData.email.trim().toLowerCase(),
          password: hashedPassword 
        });
        addedCount++;
      } catch (error: any) {
        console.error('Failed to seed bulk student:', studentData.registerNumber, error);
        failedList.push(studentData.registerNumber);
      }
    }
    revalidatePath('/students');
    revalidatePath('/dashboard');
    return { success: true, addedCount, failedList };
  } catch (err) {
    return { success: false, error: 'Bulk upload action failed.' };
  }
}

export async function editStudentAction(
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
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const updatePayload: any = { ...data };
    if (data.password && data.password.trim() !== '') {
      updatePayload.password = hashPassword(data.password.trim());
    } else {
      delete updatePayload.password;
    }
    await editStudent(id, updatePayload);
    revalidatePath('/students');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Roll Number or Email already exists.' };
    }
    return { success: false, error: 'Failed to edit student.' };
  }
}

export async function deleteStudentAction(id: number) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    await deleteStudent(id);
    revalidatePath('/students');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete student.' };
  }
}

// ==========================================
// SMTP SETTINGS & EMAIL LOGS ACTIONS
// ==========================================

export async function getSmtpSettingsAction() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  return getSmtpSettings();
}

export async function updateSmtpSettingsAction(data: {
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
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    const result = await updateSmtpSettings(data);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update settings.' };
  }
}

export async function getEmailLogsAction() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  return getEmailLogs();
}

export async function deleteEmailLogAction(id: number) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await deleteEmailLog(id);
    revalidatePath('/emaillogs');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete email log.' };
  }
}

export async function deleteAllEmailLogsAction() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await deleteAllEmailLogs();
    revalidatePath('/emaillogs');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete all email logs.' };
  }
}

export async function sendTestEmailAction(testEmail: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    const settings = await getSmtpSettings();
    const result = await sendLowAttendanceEmail({
      studentName: 'Test Student',
      studentEmail: testEmail,
      registerNumber: 'TEST101',
      department: 'CSE',
      year: 'II',
      section: 'A',
      percentage: 72.5,
      threshold: settings.lowThreshold,
      totalWorkingSessions: 100,
      presentCount: 72,
      absentCount: 28,
      month: '2026-07',
      warningDate: '2026-07-28',
      smtpSettings: settings,
    });
    return result;
  } catch (err: any) {
    return { success: false, status: 'Simulated', error: err.message };
  }
}

// ==========================================
// ATTENDANCE ACTIONS
// ==========================================

export async function saveBulkAttendanceAction(
  dateString: string,
  records: { studentId: number; status: AttendanceStatus }[]
) {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  // Server-side day validation — reject saves for Sunday or explicitly configured holidays
  if (isSundayDate(dateString) || isHoliday(dateString)) {
    const reason = isSundayDate(dateString) ? 'Sunday' : 'Holiday';
    console.warn(`[BLOCKED] Attempted to save attendance for ${reason} ${dateString}.`);
    return { success: false, error: `Cannot save attendance for ${reason} (${dateString}).` };
  }

  try {
    const targetDateNorm = normalizeDate(dateString);

    // Fast 2-query atomic transaction (deleteMany + createMany)
    await prisma.$transaction([
      prisma.attendance.deleteMany({
        where: { date: targetDateNorm },
      }),
      prisma.attendance.createMany({
        data: records.map((r) => ({
          studentId: r.studentId,
          date: targetDateNorm,
          period: 1,
          status: r.status,
        })),
      }),
    ]);

    // Invalidate working dates cache for instant accuracy
    invalidateCache();

    revalidatePath('/attendance');
    revalidatePath('/history');
    revalidatePath('/dashboard');
    revalidatePath('/student/dashboard');

    const updatedStudents = await getAllStudentsWithStats();
    return { success: true, updatedStudents };
  } catch (error) {
    console.error('Bulk attendance save error:', error);
    return { success: false, error: 'Failed to save attendance.' };
  }
}



export async function clearSavedAttendanceAction(dateString: string) {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const targetDate = normalizeDate(new Date(dateString));

    // Count records that will be deleted
    const count = await prisma.attendance.count({
      where: { date: targetDate },
    });

    if (count === 0) {
      return { success: false, error: 'No saved attendance found for this date.' };
    }

    // Delete only attendance records for this specific date
    await prisma.attendance.deleteMany({
      where: { date: targetDate },
    });

    invalidateCache();

    revalidatePath('/attendance');
    revalidatePath('/history');
    revalidatePath('/dashboard');
    revalidatePath('/student/dashboard');
    return { success: true, deletedCount: count };
  } catch (error) {
    console.error('Error clearing saved attendance:', error);
    return { success: false, error: 'Failed to clear saved attendance.' };
  }
}

export async function getAttendanceForDateAction(dateString: string) {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const targetDate = normalizeDate(new Date(dateString));
    const records = await prisma.attendance.findMany({
      where: {
        date: targetDate,
      },
      select: {
        studentId: true,
        status: true,
      },
    });

    // Map to { [studentId]: status }
    const mapping: Record<number, AttendanceStatus> = {};
    records.forEach((r) => {
      mapping[r.studentId] = r.status as AttendanceStatus;
    });

    return { success: true, data: mapping };
  } catch (error) {
    console.error('Error fetching attendance mapping:', error);
    return { success: false, error: 'Failed to load attendance records.' };
  }
}

export async function getAllAttendanceSessionsAction() {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const settings = await getSmtpSettings();
    const openingDateStr = settings.collegeOpeningDate || '2026-07-13';
    const openingDate = normalizeDate(openingDateStr);

    const [totalStudents, groupCounts] = await Promise.all([
      prisma.student.count(),
      prisma.attendance.groupBy({
        by: ['date', 'status'],
        where: {
          date: {
            gte: openingDate,
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          date: 'desc',
        },
      }),
    ]);

    const sessionsMap: Record<string, {
      dateStr: string;
      counts: { Present: number; Absent: number; OD: number; 'Medical Leave': number; 'Long Absent': number };
    }> = {};

    groupCounts.forEach((item) => {
      const dateStr = item.date.toISOString().split('T')[0];
      if (!sessionsMap[dateStr]) {
        sessionsMap[dateStr] = {
          dateStr,
          counts: { Present: 0, Absent: 0, OD: 0, 'Medical Leave': 0, 'Long Absent': 0 },
        };
      }
      const norm = normalizeStatus(item.status);
      type CountKeys = 'Present' | 'Absent' | 'OD' | 'Medical Leave' | 'Long Absent';
      if (norm in sessionsMap[dateStr].counts) {
        sessionsMap[dateStr].counts[norm as CountKeys] += item._count.id;
      }
    });

    const sessions = Object.values(sessionsMap).map((item) => ({
      id: item.dateStr,
      date: item.dateStr,
      subject: 'General Daily Attendance',
      period: 1,
      totalStudents,
      present: item.counts['Present'],
      absent: item.counts['Absent'],
      od: item.counts['OD'],
      ml: item.counts['Medical Leave'],
      la: item.counts['Long Absent'],
      savedAt: item.dateStr,
      savedBy: 'Class Representative Admin',
    }));

    return { success: true, data: sessions };
  } catch (error) {
    console.error('Error fetching attendance sessions:', error);
    return { success: false, error: 'Failed to load attendance history sessions.' };
  }
}

export async function getSessionStudentDetailsAction(dateString: string) {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const targetDate = normalizeDate(dateString);
    const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));

    console.log(`[getSessionStudentDetailsAction] Querying dateString: "${dateString}" (Range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()})`);
    
    const allStudents = await prisma.student.findMany({
      select: {
        id: true,
        studentName: true,
        registerNumber: true,
        profilePhotoUrl: true,
      },
      orderBy: { studentName: 'asc' },
    });

    const attRecords = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        studentId: true,
        status: true,
      },
    });

    console.log(`[getSessionStudentDetailsAction] Found ${attRecords.length} attendance records for date "${dateString}".`);

    const statusMap: Record<number, string> = {};
    attRecords.forEach((a) => {
      statusMap[a.studentId] = a.status;
    });

    const list = allStudents.map((s) => ({
      id: s.id,
      studentName: s.studentName,
      registerNumber: s.registerNumber,
      status: statusMap[s.id] || 'Unmarked',
      profilePhotoUrl: s.profilePhotoUrl,
    }));

    return { success: true, data: list };
  } catch (error) {
    console.error('Error fetching session student details:', error);
    return { success: false, error: 'Failed to load session student details.' };
  }
}

export async function getDashboardStatsAction(dateString: string) {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const targetDate = normalizeDate(new Date(dateString));

  const totalStudents = await prisma.student.count();

  const attendances = await prisma.attendance.findMany({
    where: {
      date: targetDate,
    },
  });

  const counts = {
    Present: 0,
    Absent: 0,
    'On Duty (OD)': 0,
    'Medical Leave (ML)': 0,
    'Long Absent': 0,
  };

  attendances.forEach((att) => {
    if (att.status in counts) {
      counts[att.status as keyof typeof counts]++;
    }
  });

  return {
    totalStudents,
    present: counts['Present'],
    absent: counts['Absent'],
    late: 0,
    od: counts['On Duty (OD)'],
    ml: counts['Medical Leave (ML)'],
    la: counts['Long Absent'],
  };
}

// ==========================================
// REPORTS ACTIONS
// ==========================================

export async function getDailyReportAction(dateString: string) {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const targetDate = normalizeDate(new Date(dateString));

  // Get all students
  const students = await prisma.student.findMany({
    orderBy: { registerNumber: 'asc' },
  });

  // Get all attendance for the day
  const attendances = await prisma.attendance.findMany({
    where: { date: targetDate },
  });

  // Structure: student -> period 1, 2, 3, 4, 5 statuses
  const report = students.map((student) => {
    const studentAtts = attendances.filter((a) => a.studentId === student.id);
    const periods: Record<number, string> = { 1: '-', 2: '-', 3: '-', 4: '-', 5: '-' };
    studentAtts.forEach((a) => {
      periods[a.period] = a.status;
    });

    return {
      id: student.id,
      registerNumber: student.registerNumber,
      studentName: student.studentName,
      department: student.department,
      year: student.year,
      section: student.section,
      ...periods,
    };
  });

  return report;
}

export async function getSubjectWiseReportAction(startDateStr: string, endDateStr: string, period: number) {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const reqStart = normalizeDate(new Date(startDateStr));
  const start = reqStart < ATTENDANCE_START_DATE ? ATTENDANCE_START_DATE : reqStart;
  const end = normalizeDate(new Date(endDateStr));

  const students = await prisma.student.findMany({
    orderBy: { registerNumber: 'asc' },
  });

  const attendances = await prisma.attendance.findMany({
    where: {
      period,
      date: {
        gte: start,
        lte: end,
      },
    },
  });

  // Calculate percentages/counts for each student for this specific subject (period)
  const report = students.map((student) => {
    const studentAtts = attendances.filter((a) => a.studentId === student.id);
    const totalPeriods = studentAtts.length;

    const counts = {
      Present: 0,
      Absent: 0,
      'On Duty (OD)': 0,
      'Medical Leave (ML)': 0,
      'Long Absent': 0,
    };

    studentAtts.forEach((a) => {
      if (a.status in counts) {
        counts[a.status as keyof typeof counts]++;
      }
    });

    // Attendance rate = (Present + OD) / Total marked * 100
    const attended = counts['Present'] + counts['On Duty (OD)'];
    const percentage = totalPeriods > 0 ? Math.round((attended / totalPeriods) * 100) : 0;

    return {
      registerNumber: student.registerNumber,
      studentName: student.studentName,
      department: student.department,
      year: student.year,
      section: student.section,
      totalClasses: totalPeriods,
      present: counts['Present'],
      absent: counts['Absent'],
      late: 0,
      od: counts['On Duty (OD)'],
      ml: counts['Medical Leave (ML)'],
      la: counts['Long Absent'],
      percentage,
    };
  });

  return report;
}

export async function getStudentWiseReportAction(studentId: number, startDateStr: string, endDateStr: string) {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const reqStart = normalizeDate(new Date(startDateStr));
  const start = reqStart < ATTENDANCE_START_DATE ? ATTENDANCE_START_DATE : reqStart;
  const end = normalizeDate(new Date(endDateStr));

  const student = await prisma.student.findUnique({
    where: { id: studentId },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  const attendances = await prisma.attendance.findMany({
    where: {
      studentId,
      date: {
        gte: start,
        lte: end,
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  // Group by date, and map periods 1-5
  const dateMap: Record<string, Record<number, string>> = {};

  attendances.forEach((a) => {
    const dStr = a.date.toISOString().split('T')[0];
    if (!dateMap[dStr]) {
      dateMap[dStr] = { 1: '-', 2: '-', 3: '-', 4: '-', 5: '-' };
    }
    dateMap[dStr][a.period] = a.status;
  });

  const report = Object.entries(dateMap).map(([date, periods]) => ({
    date,
    ...periods,
  }));

  return {
    student,
    report,
  };
}

export async function getRecentActivityAction() {
  if (!(await isStaffAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const activities = await prisma.attendance.findMany({
    take: 5,
    orderBy: {
      updatedAt: 'desc',
    },
    include: {
      student: true,
    },
  });

  return activities.map((act) => ({
    id: act.id,
    studentName: act.student.studentName,
    registerNumber: act.student.registerNumber,
    status: act.status,
    period: act.period,
    date: act.date.toISOString().split('T')[0],
    updatedAt: act.updatedAt,
  }));
}

// ==========================================
// STUDENT PORTAL ACTIONS
// ==========================================

export async function studentLoginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const student = await prisma.student.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!student) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const isMatch = verifyPassword(password, student.password);
  if (!isMatch) {
    return { success: false, error: 'Invalid email or password.' };
  }

  await setStudentSession(student.email, student.id);
  return { success: true };
}

export async function studentLogoutAction() {
  await clearStudentSession();
  return { success: true };
}

export async function studentGoogleLoginAction(googleEmail: string) {
  if (!googleEmail || !googleEmail.trim()) {
    return { success: false, error: 'Google Email address is required.' };
  }

  const cleanEmail = googleEmail.trim().toLowerCase();

  const student = await prisma.student.findUnique({
    where: { email: cleanEmail },
  });

  if (!student) {
    return {
      success: false,
      error: `Access Denied: The Google account "${cleanEmail}" is not registered in the student system. Only registered students are allowed to log in. Please contact your Administrator.`,
    };
  }

  await setStudentSession(student.email, student.id);
  return { success: true };
}

export async function getStudentProfileStatsAction() {
  const session = await getStudentSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const student = await prisma.student.findUnique({
    where: { id: session.studentId },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  const stats = await calculateOverallAttendance(student.id);

  return {
    success: true,
    student: {
      id: student.id,
      studentName: student.studentName,
      registerNumber: student.registerNumber,
      email: student.email,
      department: student.department,
      year: student.year,
      section: student.section,
      profilePhotoUrl: student.profilePhotoUrl,
    },
    stats: {
      percentage: stats.percentage,
      attended: stats.attended,
      totalClasses: stats.total,
      absent: stats.absent,
      daysPresent: stats.daysPresent,
      daysAbsent: stats.daysAbsent,
      totalDays: stats.totalDays,
    },
  };
}

export async function getStudentHistoryAction() {
  const session = await getStudentSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const settings = await getSmtpSettings();
  const openingDateStr = settings.collegeOpeningDate || '2026-07-13';
  const validDates = await getValidWorkingDates(openingDateStr);

  const attendances = await prisma.attendance.findMany({
    where: {
      studentId: session.studentId,
      date: {
        in: validDates,
      },
    },
    orderBy: { date: 'desc' },
  });

  return attendances.map((att) => ({
    id: att.id,
    date: att.date.toISOString().split('T')[0],
    period: att.period || 1,
    subject: SUBJECTS[att.period as keyof typeof SUBJECTS] || 'General Subject',
    status: att.status,
  }));
}

export async function getCollegeSettingsAction() {
  try {
    const settings = await getSmtpSettings();
    return {
      collegeName: settings.senderName || 'College Attendance Portal',
    };
  } catch (error) {
    return {
      collegeName: 'College Attendance Portal',
    };
  }
}

export async function getStudentSubjectStatsAction() {
  return [];
}

export async function getStudentMonthlyStatsAction() {
  const session = await getStudentSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const settings = await getSmtpSettings();
  const openingDateStr = settings.collegeOpeningDate || '2026-07-13';
  const validDates = await getValidWorkingDates(openingDateStr);

  const attendances = await prisma.attendance.findMany({
    where: {
      studentId: session.studentId,
      date: {
        in: validDates,
      },
    },
    orderBy: { date: 'asc' },
  });

  const attendedStatuses = ['Present', 'On Duty (OD)', 'Medical Leave (ML)', 'Medical Leave'];

  // Count working days per month
  const monthlyWorkingDays: Record<string, number> = {};
  validDates.forEach((d) => {
    const dateObj = new Date(d);
    const yearMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    monthlyWorkingDays[yearMonth] = (monthlyWorkingDays[yearMonth] || 0) + 1;
  });

  const monthlyData: Record<string, { total: number; attended: number; monthName: string }> = {};

  attendances.forEach((a) => {
    const s = a.status;
    const isAttended = attendedStatuses.includes(s);

    const dateObj = new Date(a.date);
    const yearMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const monthName = dateObj.toLocaleString('default', { month: 'short', year: '2-digit' });

    if (!monthlyData[yearMonth]) {
      monthlyData[yearMonth] = { total: monthlyWorkingDays[yearMonth] || 0, attended: 0, monthName };
    }

    if (isAttended) {
      monthlyData[yearMonth].attended++;
    }
  });

  const results = Object.entries(monthlyData).map(([yearMonth, stats]) => ({
    yearMonth,
    monthName: stats.monthName,
    month: stats.monthName,
    attended: stats.attended,
    total: stats.total,
    percentage: stats.total > 0 ? Math.round((stats.attended / stats.total) * 10000) / 100 : 100.0,
  }));

  return results;
}

// ==========================================
// TEACHER ACTIONS
// ==========================================

export async function teacherLoginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const teacher = await findTeacherByEmail(email);
  if (!teacher) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const isMatch = verifyPassword(password, teacher.password);
  if (!isMatch) {
    return { success: false, error: 'Invalid email or password.' };
  }

  await setTeacherSession(teacher.email, teacher.id);
  return { success: true };
}

export async function teacherLogoutAction() {
  await clearTeacherSession();
  return { success: true };
}

export async function addTeacherAction(data: {
  name: string;
  email: string;
  password?: string;
  department?: string;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  if (!data.name || !data.name.trim()) {
    return { success: false, error: 'Name is required.' };
  }

  if (!data.email || !data.email.trim()) {
    return { success: false, error: 'Email is required.' };
  }

  if (!data.password || !data.password.trim()) {
    return { success: false, error: 'Password is required.' };
  }

  try {
    const hashedPassword = hashPassword(data.password.trim());
    await addTeacher({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      department: data.department
    });
    revalidatePath('/settings');
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Teacher email already exists.' };
    }
    return { success: false, error: 'Failed to add teacher.' };
  }
}

export async function getTeachersAction() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  return getAllTeachers();
}

export async function deleteTeacherAction(id: number) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    await deleteTeacher(id);
    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete teacher.' };
  }
}

export async function checkUserRoleAction() {
  const isAdmin = await isAdminAuthenticated();
  const isTeacher = await isTeacherAuthenticated();
  return { success: true, isAdmin, isTeacher };
}

export async function getDailyAttendanceSummaryAction(dateString: string) {
  try {
    if (!(await isStaffAuthenticated())) {
      return {
        success: false,
        error: 'Unauthorized',
        date: dateString,
        totalStudents: 0,
        presentTodayCount: 0,
        absentTodayCount: 0,
        absentStudentsList: [],
      };
    }

    const targetDate = normalizeDate(new Date(dateString));

    // Fetch all active students
    const students = await prisma.student.findMany({
      orderBy: { registerNumber: 'asc' },
    });

    // Fetch attendance records for the date
    const attendances = await prisma.attendance.findMany({
      where: { date: targetDate },
    });

    // Build a lookup map: studentId → attendance record
    const attendanceMap: Record<number, { status: string; period: number }> = {};
    attendances.forEach((a) => {
      attendanceMap[a.studentId] = { status: a.status, period: a.period || 1 };
    });

    const absentStudentsList: any[] = [];
    let presentTodayCount = 0;

    students.forEach((student) => {
      const rec = attendanceMap[student.id];

      if (!rec) {
        // No attendance record for this date
        return;
      }

      const status = rec.status;

      if (status === 'Absent' || status === 'Long Absent') {
        // Explicitly absent
        absentStudentsList.push({
          id: student.id,
          registerNumber: student.registerNumber,
          studentName: student.studentName,
          email: student.email,
          department: student.department,
          year: student.year,
          section: student.section,
          status,
          absentPeriods: [rec.period],
          absentSubjects: [status],
          isFullDayAbsent: status === 'Long Absent' || status === 'Absent',
          markedPeriodsCount: 1,
          statusSummaryText: status,
        });
      } else if (status === 'Present' || status === 'On Duty (OD)' || status === 'Medical Leave (ML)') {
        presentTodayCount++;
      }
    });

    return {
      success: true,
      date: dateString,
      totalStudents: students.length,
      presentTodayCount,
      absentTodayCount: absentStudentsList.length,
      absentStudentsList,
    };
  } catch (error) {
    console.error('Error in getDailyAttendanceSummaryAction:', error);
    return {
      success: false,
      error: 'Failed to fetch daily summary.',
      date: dateString,
      totalStudents: 0,
      presentTodayCount: 0,
      absentTodayCount: 0,
      absentStudentsList: [],
    };
  }
}

export async function triggerMonthlyWarningJobAction(options: { force?: boolean; dryRun?: boolean } = {}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const summary = await runMonthlyWarningEmailJob({
      forceRun: options.force ?? true,
      dryRun: options.dryRun ?? false,
    });
    revalidatePath('/emaillogs');
    revalidatePath('/settings');
    return { success: true, summary };
  } catch (error: any) {
    console.error('Error triggering monthly warning job action:', error);
    return { success: false, error: error?.message || 'Failed to execute monthly warning job.' };
  }
}



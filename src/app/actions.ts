'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { setAdminSession, clearAdminSession, isAdminAuthenticated } from '@/lib/auth';
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
  calculateOverallAttendance,
} from '@/lib/db-api';
import { sendLowAttendanceEmail } from '@/lib/email';

export async function getAllStudents() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  return dbGetAllStudents();
}

// Action to get students with their percentages
export async function getAllStudentsWithStats() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  const students = await dbGetAllStudents();
  const results = await Promise.all(
    students.map(async (student) => {
      const stats = await calculateOverallAttendance(student.id);
      return {
        ...student,
        percentage: stats.percentage,
        attended: stats.attended,
        totalClasses: stats.total,
      };
    })
  );
  return results;
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
  department: string;
  year: string;
  section: string;
}) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    await addStudent(data);
    revalidatePath('/students');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Register Number or Email already exists.' };
    }
    return { success: false, error: 'Failed to add student.' };
  }
}

export async function addBulkStudentsAction(studentsList: {
  registerNumber: string;
  studentName: string;
  email: string;
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
        await addStudent(studentData);
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
    department: string;
    year: string;
    section: string;
  }
) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    await editStudent(id, data);
    revalidatePath('/students');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Register Number or Email already exists.' };
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

export async function sendTestEmailAction(testEmail: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }
  try {
    const settings = await getSmtpSettings();
    const result = await sendLowAttendanceEmail(
      'Test Student',
      testEmail,
      72.5,
      settings.lowThreshold,
      settings
    );
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
  period: number,
  records: { studentId: number; status: AttendanceStatus }[]
) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const targetDate = new Date(dateString);
    await prisma.$transaction(
      records.map((r) =>
        prisma.attendance.upsert({
          where: {
            studentId_date_period: {
              studentId: r.studentId,
              date: normalizeDate(targetDate),
              period,
            },
          },
          update: { status: r.status },
          create: {
            studentId: r.studentId,
            date: normalizeDate(targetDate),
            period,
            status: r.status,
          },
        })
      )
    );

    // Auto warning email alerts trigger block
    const affectedStudentIds = Array.from(new Set(records.map((r) => r.studentId)));
    const settings = await getSmtpSettings();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const studentId of affectedStudentIds) {
      const { percentage } = await calculateOverallAttendance(studentId);
      if (percentage < settings.lowThreshold) {
        // Avoid sending multiple alerts in the same day
        const warnedToday = await prisma.emailLog.findFirst({
          where: {
            studentId,
            sentAt: {
              gte: today,
            },
          },
        });

        if (!warnedToday) {
          const student = await prisma.student.findUnique({
            where: { id: studentId },
          });

          if (student && student.email) {
            const emailResult = await sendLowAttendanceEmail(
              student.studentName,
              student.email,
              percentage,
              settings.lowThreshold,
              settings
            );

            await logSentEmail({
              studentId,
              email: student.email,
              percentage,
              subject: `Urgent: Low Attendance Warning (${percentage}%)`,
              body: `Dear ${student.studentName}, your overall attendance of ${percentage}% has fallen below the required threshold of ${settings.lowThreshold}%.`,
              status: emailResult.status,
            });
          }
        }
      }
    }

    revalidatePath('/attendance');
    revalidatePath('/history');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Bulk attendance save error:', error);
    return { success: false, error: 'Failed to save attendance.' };
  }
}

export async function getAttendanceForDateAndPeriodAction(dateString: string, period: number) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  try {
    const targetDate = normalizeDate(new Date(dateString));
    const records = await prisma.attendance.findMany({
      where: {
        date: targetDate,
        period,
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

// ==========================================
// DASHBOARD & STATS ACTIONS
// ==========================================

export async function getDashboardStatsAction(dateString: string, period: number) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const targetDate = normalizeDate(new Date(dateString));

  const totalStudents = await prisma.student.count();

  const attendances = await prisma.attendance.findMany({
    where: {
      date: targetDate,
      period,
    },
  });

  const counts = {
    Present: 0,
    Absent: 0,
    Late: 0,
    'On Duty (OD)': 0,
    'Medical Leave (ML)': 0,
    'Long Absent': 0,
  };

  attendances.forEach((att) => {
    if (att.status in counts) {
      counts[att.status as keyof typeof counts]++;
    }
  });

  // Calculate overall day present (students marked present in at least one period today)
  // This is a nice-to-have, but let's stick exactly to the dashboard requirements:
  // "Present Count, Absent Count, ELITE Count, On Duty Count, Medical Leave Count, Long Leave Count"
  // referring to the selected date and period.

  return {
    totalStudents,
    present: counts['Present'],
    absent: counts['Absent'],
    late: counts['Late'],
    od: counts['On Duty (OD)'],
    ml: counts['Medical Leave (ML)'],
    la: counts['Long Absent'],
  };
}

// ==========================================
// REPORTS ACTIONS
// ==========================================

export async function getDailyReportAction(dateString: string) {
  if (!(await isAdminAuthenticated())) {
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
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const start = normalizeDate(new Date(startDateStr));
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
      Late: 0,
      'On Duty (OD)': 0,
      'Medical Leave (ML)': 0,
      'Long Absent': 0,
    };

    studentAtts.forEach((a) => {
      if (a.status in counts) {
        counts[a.status as keyof typeof counts]++;
      }
    });

    // Attendance rate = (Present + Late + OD + ML) / Total marked * 100
    const attended = counts['Present'] + counts['Late'] + counts['On Duty (OD)'] + counts['Medical Leave (ML)'];
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
      late: counts['Late'],
      od: counts['On Duty (OD)'],
      ml: counts['Medical Leave (ML)'],
      la: counts['Long Absent'],
      percentage,
    };
  });

  return report;
}

export async function getStudentWiseReportAction(studentId: number, startDateStr: string, endDateStr: string) {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized');
  }

  const start = normalizeDate(new Date(startDateStr));
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

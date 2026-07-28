import { prisma } from './db';
import { getSmtpSettings, calculateAllStudentsAttendanceStats } from './db-api';
import { sendLowAttendanceEmail } from './email';

export interface MonthlyWarningJobOptions {
  forceRun?: boolean;
  dryRun?: boolean;
}

export interface MonthlyWarningJobSummary {
  success: boolean;
  message: string;
  warningMonth: string;
  totalChecked: number;
  eligibleBelowThreshold: number;
  emailsSent: number;
  skippedCount: number;
  alreadyWarnedCount: number;
  failedList: Array<{ studentId: number; registerNumber: string; studentName: string; error: string }>;
  isDryRun?: boolean;
}

/**
 * Returns current date/time components in Asia/Kolkata (IST, UTC+5:30) timezone.
 */
export function getKolkataDateInfo(dateInput: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(dateInput);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = parseInt(getPart('day'), 10);
  const warningMonth = `${year}-${month}`; // Format: YYYY-MM
  const fullDateStr = `${year}-${month}-${getPart('day')}`; // Format: YYYY-MM-DD

  return {
    year,
    month,
    day,
    warningMonth,
    fullDateStr,
  };
}

/**
 * Monthly Attendance Warning Email Job
 * Automatically runs on the 27th of every month in Asia/Kolkata timezone.
 */
export async function runMonthlyWarningEmailJob(
  options: MonthlyWarningJobOptions = {}
): Promise<MonthlyWarningJobSummary> {
  const { forceRun = false, dryRun = false } = options;
  const kolkata = getKolkataDateInfo();
  const warningMonth = kolkata.warningMonth;
  const targetDateStr = kolkata.fullDateStr;

  const settings = await getSmtpSettings();

  // Rule 1: Run automatically on the 27th of the month unless forced or dry-run
  if (!forceRun && !dryRun && kolkata.day !== 27) {
    return {
      success: true,
      message: `Skipped: Monthly warning job only runs automatically on the 27th (Today in IST is day ${kolkata.day}).`,
      warningMonth,
      totalChecked: 0,
      eligibleBelowThreshold: 0,
      emailsSent: 0,
      skippedCount: 0,
      alreadyWarnedCount: 0,
      failedList: [],
      isDryRun: dryRun,
    };
  }

  // Rule 2: Do not run duplicate monthly job in the same calendar month unless forced or dry-run
  if (!forceRun && !dryRun && settings.lastMonthlyWarningRun === warningMonth) {
    return {
      success: true,
      message: `Skipped: Monthly warning emails already processed for ${warningMonth}.`,
      warningMonth,
      totalChecked: 0,
      eligibleBelowThreshold: 0,
      emailsSent: 0,
      skippedCount: 0,
      alreadyWarnedCount: 0,
      failedList: [],
      isDryRun: dryRun,
    };
  }

  // Fetch all active students with strict column selection (excluding password)
  const students = await prisma.student.findMany({
    select: {
      id: true,
      studentName: true,
      registerNumber: true,
      email: true,
      department: true,
      year: true,
      section: true,
    },
    orderBy: { registerNumber: 'asc' },
  });

  const totalChecked = students.length;
  if (totalChecked === 0) {
    return {
      success: true,
      message: 'No active students found in database.',
      warningMonth,
      totalChecked: 0,
      eligibleBelowThreshold: 0,
      emailsSent: 0,
      skippedCount: 0,
      alreadyWarnedCount: 0,
      failedList: [],
      isDryRun: dryRun,
    };
  }

  // Batch calculate overall attendance stats up to target date
  const batchStats = await calculateAllStudentsAttendanceStats(targetDateStr);
  const threshold = settings.lowThreshold; // Default 75.0%

  // Find students whose overall attendance is strictly below 75% (< 75.0%)
  const eligibleStudents = students.filter((student) => {
    const stats = batchStats.getStudentStats(student.id);
    return stats.percentage < threshold; // Strictly below 75%
  });

  const skippedCount = totalChecked - eligibleStudents.length;

  // Check database for existing EmailLog records for this warningMonth
  const existingLogs = await prisma.emailLog.findMany({
    where: {
      warningMonth,
      status: { in: ['Sent', 'Simulated'] },
    },
    select: {
      studentId: true,
    },
  });

  const warnedStudentIds = new Set(existingLogs.map((l) => l.studentId));

  const studentsToWarn = eligibleStudents.filter((s) => !warnedStudentIds.has(s.id));
  const alreadyWarnedCount = eligibleStudents.length - studentsToWarn.length;

  if (dryRun) {
    return {
      success: true,
      message: `[DRY-RUN COMPLETE] Evaluated ${totalChecked} students for ${warningMonth}. Eligible (<${threshold}%): ${eligibleStudents.length}, Already Warned: ${alreadyWarnedCount}, Pending Emails: ${studentsToWarn.length}, Skipped (>=${threshold}%): ${skippedCount}.`,
      warningMonth,
      totalChecked,
      eligibleBelowThreshold: eligibleStudents.length,
      emailsSent: studentsToWarn.length,
      skippedCount,
      alreadyWarnedCount,
      failedList: [],
      isDryRun: true,
    };
  }

  let emailsSent = 0;
  const failedList: Array<{ studentId: number; registerNumber: string; studentName: string; error: string }> = [];

  for (const student of studentsToWarn) {
    const stats = batchStats.getStudentStats(student.id);
    try {
      const emailResult = await sendLowAttendanceEmail({
        studentName: student.studentName,
        studentEmail: student.email,
        registerNumber: student.registerNumber,
        department: student.department,
        year: student.year,
        section: student.section,
        percentage: stats.percentage,
        threshold,
        totalWorkingSessions: stats.totalDays,
        presentCount: stats.daysPresent,
        absentCount: stats.daysAbsent,
        month: warningMonth,
        warningDate: targetDateStr,
        smtpSettings: settings,
      });

      const subjectText = `Monthly Attendance Warning – Attendance Below 75%`;
      const bodyText = `MONTHLY ATTENDANCE WARNING – ATTENDANCE BELOW 75%
${settings.senderName || 'College Attendance Portal'}

Dear ${student.studentName},

This is an official monthly attendance warning notification for ${warningMonth}. Your overall attendance percentage is ${stats.percentage}%, which is strictly below the required minimum of ${threshold}%.

Student Details:
- Name: ${student.studentName}
- Register Number: ${student.registerNumber}
- Department: ${student.department}
- Year: ${student.year}
- Section: ${student.section}
- Current Attendance: ${stats.percentage}%
- Required Minimum: ${threshold}%
- Total Working Sessions: ${stats.totalDays} Days
- Days Present (incl. OD): ${stats.daysPresent} Days
- Days Absent: ${stats.daysAbsent} Days
- Month: ${warningMonth}
- Warning Date: ${targetDateStr}

Please contact your Class Representative or Department Administration immediately to clarify your attendance status.

Regards,
${settings.senderName || 'College Attendance Portal'} Administration`;

      await prisma.emailLog.create({
        data: {
          studentId: student.id,
          email: student.email,
          percentage: stats.percentage,
          subject: subjectText,
          body: bodyText,
          warningMonth,
          status: emailResult.status === 'Sent' ? 'Sent' : emailResult.status === 'Simulated' ? 'Simulated' : 'Failed',
        },
      });

      emailsSent++;
    } catch (err: any) {
      console.error(`Monthly warning email failed for student ${student.registerNumber}:`, err);
      failedList.push({
        studentId: student.id,
        registerNumber: student.registerNumber,
        studentName: student.studentName,
        error: err?.message || 'Email sending failed',
      });
      // Continue processing remaining students even if one fails
    }
  }

  // Update lastMonthlyWarningRun on SmtpSettings
  await prisma.smtpSettings.update({
    where: { id: 1 },
    data: { lastMonthlyWarningRun: warningMonth },
  });

  return {
    success: true,
    message: `Monthly warning job completed for ${warningMonth}. Sent ${emailsSent} email(s), ${failedList.length} failed, ${alreadyWarnedCount} already warned, ${skippedCount} skipped (>=75%).`,
    warningMonth,
    totalChecked,
    eligibleBelowThreshold: eligibleStudents.length,
    emailsSent,
    skippedCount,
    alreadyWarnedCount,
    failedList,
    isDryRun: false,
  };
}

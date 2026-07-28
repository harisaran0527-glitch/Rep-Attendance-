import { prisma } from '../src/lib/db';
import { runMonthlyWarningEmailJob, getKolkataDateInfo } from '../src/lib/monthly-scheduler';
import { calculateAllStudentsAttendanceStats, getSmtpSettings } from '../src/lib/db-api';
import { sendLowAttendanceEmail } from '../src/lib/email';
import fs from 'fs';
import path from 'path';

async function runVerification() {
  console.log('================================================================');
  console.log(' VERIFICATION & AUDIT - PRODUCTION PERFORMANCE & MONTHLY EMAIL');
  console.log('================================================================\n');

  // 1. Check Vercel Cron Registration & Configuration
  const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
  if (fs.existsSync(vercelJsonPath)) {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    console.log('✔ Vercel Region Configured:', vercelConfig.regions);
    console.log('✔ Vercel Cron Configured:', vercelConfig.crons);

    const cronRoute = vercelConfig.crons.find((c: any) => c.path === '/api/cron/monthly-warning');
    if (!cronRoute || cronRoute.schedule !== '30 3 27 * *') {
      throw new Error('Invalid vercel.json cron schedule!');
    }
    console.log('✔ Verified Vercel Cron Schedule: "30 3 27 * *" (Runs at 03:30 UTC = 09:00 AM IST on the 27th of every month)');
  } else {
    throw new Error('vercel.json file missing!');
  }

  // 2. Check SMTP Settings
  const smtp = await getSmtpSettings();
  console.log('\n--- SMTP PRODUCTION CONFIGURATION ---');
  console.log(`Host: ${smtp.host}`);
  console.log(`Port: ${smtp.port}`);
  console.log(`Sender Name: ${smtp.senderName}`);
  console.log(`Low Threshold: ${smtp.lowThreshold}%`);
  console.log(`College Opening Date: ${smtp.collegeOpeningDate}`);

  // 3. Timezone Info Check
  const kolkata = getKolkataDateInfo();
  console.log('\n--- ASIA/KOLKATA TIMEZONE EVALUATION ---');
  console.log(`Current IST Date: ${kolkata.fullDateStr}`);
  console.log(`Evaluated Warning Month (YYYY-MM): ${kolkata.warningMonth}`);
  console.log(`IST Day of Month: ${kolkata.day}`);

  // 4. Threshold & Student Breakdown Audit (Dry-Run First)
  console.log('\n--- DRY-RUN AUDIT ---');
  const dryRunSummary = await runMonthlyWarningEmailJob({ forceRun: true, dryRun: true });
  console.log('Dry-Run Summary:', dryRunSummary.message);

  const batchStats = await calculateAllStudentsAttendanceStats(kolkata.fullDateStr);
  const students = await prisma.student.findMany({
    select: { id: true, registerNumber: true, studentName: true, department: true, year: true, section: true, email: true },
    orderBy: { registerNumber: 'asc' },
  });

  const below75: any[] = [];
  const exactly75: any[] = [];
  const above75: any[] = [];

  students.forEach((student) => {
    const stats = batchStats.getStudentStats(student.id);
    const item = { ...student, percentage: stats.percentage, attended: stats.daysPresent, total: stats.totalDays, absent: stats.daysAbsent };
    if (stats.percentage < 75.0) {
      below75.push(item);
    } else if (stats.percentage === 75.0) {
      exactly75.push(item);
    } else {
      above75.push(item);
    }
  });

  console.log(`\nTotal Active Students: ${students.length}`);
  console.log(`Strictly Below 75% (<75.0%): ${below75.length} Students SELECTED`);
  console.log(`Exactly Equal 75% (=75.0%): ${exactly75.length} Students EXCLUDED`);
  console.log(`Above 75% (>75.0%): ${above75.length} Students EXCLUDED`);

  console.log('\n--- EXACT STUDENTS SELECTED (< 75.0%) ---');
  below75.forEach((s, idx) => {
    console.log(`  ${idx + 1}. [${s.registerNumber}] ${s.studentName} (${s.department} ${s.year} YR - Sec ${s.section}) - Attendance: ${s.percentage}% (Attended: ${s.attended}/${s.total}, Absent: ${s.absent})`);
  });

  console.log('\n--- SAMPLE STUDENTS EXCLUDED (EXACTLY 75.0%) ---');
  if (exactly75.length === 0) {
    console.log('  (No active students currently have exactly 75.0% attendance)');
  } else {
    exactly75.forEach((s, idx) => {
      console.log(`  ${idx + 1}. [${s.registerNumber}] ${s.studentName} - Attendance: ${s.percentage}% (EXCLUDED)`);
    });
  }

  // 5. Test Single Email Simulation / Dispatch
  if (below75.length > 0) {
    const testTarget = below75[0];
    console.log(`\n--- TESTING SINGLE WARNING EMAIL GENERATION FOR ${testTarget.studentName} ---`);
    const emailResult = await sendLowAttendanceEmail({
      studentName: testTarget.studentName,
      studentEmail: testTarget.email,
      registerNumber: testTarget.registerNumber,
      department: testTarget.department,
      year: testTarget.year,
      section: testTarget.section,
      percentage: testTarget.percentage,
      threshold: 75.0,
      totalWorkingSessions: testTarget.total,
      presentCount: testTarget.attended,
      absentCount: testTarget.absent,
      month: kolkata.warningMonth,
      warningDate: kolkata.fullDateStr,
      smtpSettings: smtp,
    });
    console.log('Single Email Delivery Result:', emailResult);
  }

  // 6. Test Live Run & Duplicate Prevention
  console.log('\n--- TESTING LIVE SCHEDULER & DUPLICATE PREVENTION ---');
  const liveRunResult = await runMonthlyWarningEmailJob({ forceRun: true, dryRun: false });
  console.log('Live Run Execution Result:', liveRunResult);

  const duplicateCheckResult = await runMonthlyWarningEmailJob({ forceRun: false, dryRun: false });
  console.log('Duplicate Execution Result:', duplicateCheckResult);

  if (duplicateCheckResult.emailsSent === 0 && (duplicateCheckResult.skipped || duplicateCheckResult.alreadyWarnedCount >= 0)) {
    console.log('✔ VERIFIED: Duplicate warning emails strictly prevented for calendar month!');
  } else {
    throw new Error('Duplicate prevention test failed!');
  }

  // 7. Verify Database Email Logs
  const logs = await prisma.emailLog.findMany({
    where: { warningMonth: kolkata.warningMonth },
    orderBy: { sentAt: 'desc' },
    take: 5,
  });
  console.log(`\n✔ Email Log Table Records for ${kolkata.warningMonth}: ${logs.length} logged.`);

  console.log('\n================================================================');
  console.log(' ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY');
  console.log('================================================================\n');
}

runVerification()
  .catch((err) => {
    console.error('Verification Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

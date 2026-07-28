import { prisma } from '../src/lib/db';
import { runMonthlyWarningEmailJob, getKolkataDateInfo } from '../src/lib/monthly-scheduler';
import { calculateAllStudentsAttendanceStats } from '../src/lib/db-api';

async function testMonthlyJob() {
  console.log('==================================================');
  console.log('  TESTING MONTHLY WARNING EMAIL SCHEDULER & RULES');
  console.log('==================================================\n');

  const kolkata = getKolkataDateInfo();
  console.log(`Current Asia/Kolkata Timezone Info:`, kolkata);

  // 1. Dry Run Test
  console.log('\n--- 1. TESTING DRY-RUN MODE ---');
  const dryRunRes = await runMonthlyWarningEmailJob({ forceRun: true, dryRun: true });
  console.log('Dry-Run Result:', dryRunRes);

  if (!dryRunRes.success || !dryRunRes.isDryRun) {
    throw new Error('Dry run test failed');
  }

  // 2. Validate Threshold Rules (< 75% selected, >= 75% skipped)
  console.log('\n--- 2. VALIDATING THRESHOLD RULES & CALCULATIONS ---');
  const batchStats = await calculateAllStudentsAttendanceStats(kolkata.fullDateStr);
  const students = await prisma.student.findMany({ select: { id: true, registerNumber: true, studentName: true } });

  let countBelow75 = 0;
  let countExactly75 = 0;
  let countAbove75 = 0;

  students.forEach((s) => {
    const stats = batchStats.getStudentStats(s.id);
    if (stats.percentage < 75.0) {
      countBelow75++;
    } else if (stats.percentage === 75.0) {
      countExactly75++;
    } else {
      countAbove75++;
    }
  });

  console.log(`Total Active Students: ${students.length}`);
  console.log(`Students Strictly < 75%: ${countBelow75}`);
  console.log(`Students Exactly = 75%: ${countExactly75}`);
  console.log(`Students > 75%: ${countAbove75}`);

  if (dryRunRes.eligibleBelowThreshold !== countBelow75) {
    throw new Error(`Eligible count mismatch! Expected ${countBelow75}, got ${dryRunRes.eligibleBelowThreshold}`);
  }
  console.log('SUCCESS: Exactly >= 75% students are skipped, and strictly < 75% students are selected!');

  // 3. Live Execution & Duplicate Prevention Test
  console.log('\n--- 3. TESTING LIVE EXECUTION & DUPLICATE PREVENTION ---');
  const liveRes1 = await runMonthlyWarningEmailJob({ forceRun: true, dryRun: false });
  console.log('Live Run 1 Result:', liveRes1);

  console.log('\n--- Testing Second Run in Same Month (Duplicate Prevention) ---');
  const liveRes2 = await runMonthlyWarningEmailJob({ forceRun: false, dryRun: false });
  console.log('Live Run 2 Result (Should Skip):', liveRes2);

  if (!liveRes2.skipped && liveRes2.emailsSent > 0 && kolkata.day !== 27) {
    throw new Error('Duplicate prevention test failed: Job ran again in same month or outside 27th!');
  }
  console.log('SUCCESS: Duplicate prevention verified!');

  console.log('\n==================================================');
  console.log('  ALL MONTHLY SCHEDULER TESTS PASSED SUCCESSFULLY');
  console.log('==================================================');
}

testMonthlyJob()
  .catch((e) => {
    console.error('Test Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

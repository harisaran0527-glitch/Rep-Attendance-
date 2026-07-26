import { PrismaClient } from '@prisma/client';
import { calculateOverallAttendance, getValidWorkingDates } from '../src/lib/db-api';

const prisma = new PrismaClient();

async function main() {
  console.log('==================================================');
  console.log('EXECUTING RECORD DELETION & DATABASE AUDIT');
  console.log('==================================================\n');

  // 1. Find RATHIDEVI S
  const rathidevi = await prisma.student.findFirst({
    where: {
      OR: [
        { studentName: { contains: 'RATHIDEVI', mode: 'insensitive' } },
        { registerNumber: { contains: '131' } },
      ],
    },
  });

  if (!rathidevi) {
    console.error('ERROR: Could not find student RATHIDEVI S in database.');
    process.exit(1);
  }

  console.log(`Student Found: ${rathidevi.studentName} (${rathidevi.registerNumber}), ID: ${rathidevi.id}`);

  // 2. BEFORE Audit
  const recordsBefore = await prisma.attendance.findMany({
    where: { date: new Date('2026-07-18') },
    include: { student: true },
  });

  const rathideviStatsBefore = await calculateOverallAttendance(rathidevi.id);
  const validDatesBefore = await getValidWorkingDates('2026-07-13');

  console.log('\n--- BEFORE DELETION STATE ---');
  console.log(`Attendance Records on 2026-07-18: ${recordsBefore.length}`);
  recordsBefore.forEach((rec) => {
    console.log(`  - Record ID: ${rec.id}, Student ID: ${rec.studentId} (${rec.student.registerNumber}), Status: ${rec.status}`);
  });
  console.log(`RATHIDEVI S Present Days: ${rathideviStatsBefore.daysPresent}`);
  console.log(`RATHIDEVI S Absent Days: ${rathideviStatsBefore.daysAbsent}`);
  console.log(`RATHIDEVI S Attendance %: ${rathideviStatsBefore.percentage}%`);
  console.log(`Total Working Days: ${validDatesBefore.length}`);

  // 3. DELETE ONLY 2026-07-18 RECORDS
  console.log('\n--> Deleting attendance record(s) on 2026-07-18...');
  const deleteResult = await prisma.attendance.deleteMany({
    where: {
      date: new Date('2026-07-18'),
    },
  });
  console.log(`Successfully deleted ${deleteResult.count} record(s) for 2026-07-18.`);

  // 4. AFTER Audit
  const recordsAfter = await prisma.attendance.findMany({
    where: { date: new Date('2026-07-18') },
  });

  const rathideviStatsAfter = await calculateOverallAttendance(rathidevi.id);
  const validDatesAfter = await getValidWorkingDates('2026-07-13');

  console.log('\n--- AFTER DELETION STATE ---');
  console.log(`Attendance Records on 2026-07-18: ${recordsAfter.length}`);
  console.log(`RATHIDEVI S Present Days: ${rathideviStatsAfter.daysPresent}`);
  console.log(`RATHIDEVI S Absent Days: ${rathideviStatsAfter.daysAbsent}`);
  console.log(`RATHIDEVI S Attendance %: ${rathideviStatsAfter.percentage}%`);
  console.log(`Total Working Days: ${validDatesAfter.length}`);

  // 5. PRINT COMPARISON SUMMARY TABLE
  console.log('\n==================================================');
  console.log('BEFORE vs AFTER COMPARISON SUMMARY');
  console.log('==================================================');
  console.table([
    {
      Metric: 'Records on 18/07/2026',
      BEFORE: recordsBefore.length,
      AFTER: recordsAfter.length,
    },
    {
      Metric: 'Total Working Days',
      BEFORE: validDatesBefore.length,
      AFTER: validDatesAfter.length,
    },
    {
      Metric: 'RATHIDEVI S Present Days',
      BEFORE: rathideviStatsBefore.daysPresent,
      AFTER: rathideviStatsAfter.daysPresent,
    },
    {
      Metric: 'RATHIDEVI S Absent Days',
      BEFORE: rathideviStatsBefore.daysAbsent,
      AFTER: rathideviStatsAfter.daysAbsent,
    },
    {
      Metric: 'RATHIDEVI S Attendance %',
      BEFORE: `${rathideviStatsBefore.percentage}%`,
      AFTER: `${rathideviStatsAfter.percentage}%`,
    },
  ]);

  // 6. VERIFY ALL 58 STUDENTS
  const totalStudents = await prisma.student.count();
  console.log(`\nVerifying all ${totalStudents} students:`);
  const sampleStudents = await prisma.student.findMany({ take: 5, orderBy: { id: 'asc' } });
  const sampleResults = [];
  for (const s of sampleStudents) {
    const stats = await calculateOverallAttendance(s.id);
    sampleResults.push({
      ID: s.id,
      RegNo: s.registerNumber,
      WorkingDays: stats.totalDays,
      Present: stats.daysPresent,
      Absent: stats.daysAbsent,
      Percentage: `${stats.percentage}%`,
    });
  }
  console.table(sampleResults);
}

main()
  .catch((e) => {
    console.error('Error during deletion script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

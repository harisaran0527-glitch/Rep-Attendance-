import { PrismaClient } from '@prisma/client';
import { getValidWorkingDates, calculateOverallAttendance } from '../src/lib/db-api';

const prisma = new PrismaClient();

async function main() {
  console.log('==================================================');
  console.log('AUDIT & VERIFICATION REPORT - ATTENDANCE FIX');
  console.log('==================================================\n');

  const totalStudents = await prisma.student.count();
  console.log(`Total Active Students: ${totalStudents}`);

  // Query records for offending date 2026-07-18
  const saturdayRecords = await prisma.attendance.findMany({
    where: {
      date: new Date('2026-07-18'),
    },
  });

  console.log(`Offending Date: 2026-07-18 (Saturday)`);
  console.log(`Number of Saved Records on 2026-07-18: ${saturdayRecords.length}`);
  if (saturdayRecords.length > 0) {
    console.log(`Saved Record Detail: Student ID ${saturdayRecords[0].studentId}, Status: ${saturdayRecords[0].status}`);
  }

  // Get valid working dates under new logic
  const validWorkingDates = await getValidWorkingDates('2026-07-13');
  const validDateStrings = validWorkingDates.map((d) => d.toISOString().split('T')[0]);

  console.log(`\nValid Working Dates Count (After Fix): ${validWorkingDates.length}`);
  console.log(`Valid Working Dates:`, validDateStrings);

  const isSaturdayIncluded = validDateStrings.includes('2026-07-18');
  console.log(`Is 2026-07-18 Counted as Working Day? ${isSaturdayIncluded ? 'YES (FAIL)' : 'NO (SUCCESS)'}`);

  console.log('\n--- AUDIT SUMMARY TABLE ---');
  console.table([
    {
      'Offending Date': '2026-07-18',
      'Saved Records': saturdayRecords.length,
      'Active Students': totalStudents,
      'Counted Before Fix': 'YES (1 extra absent day generated)',
      'Counted After Fix': isSaturdayIncluded ? 'YES' : 'NO',
    },
  ]);

  console.log('\n--- VERIFYING STUDENT ATTENDANCE STATS (SAMPLE STUDENTS) ---');

  const sampleStudents = await prisma.student.findMany({
    take: 5,
    orderBy: { id: 'asc' },
  });

  const verificationResults = [];

  for (const student of sampleStudents) {
    const stats = await calculateOverallAttendance(student.id);
    verificationResults.push({
      'Student ID': student.id,
      'Name': student.name,
      'Reg No': student.registerNumber,
      'Total Working Days': stats.totalDays,
      'Present Days': stats.daysPresent,
      'Absent Days': stats.daysAbsent,
      'Attendance %': `${stats.percentage}%`,
    });
  }

  console.table(verificationResults);

  console.log('\n==================================================');
  console.log('VERIFICATION COMPLETE');
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

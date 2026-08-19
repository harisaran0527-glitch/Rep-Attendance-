const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Inline implementation of calculateOverallAttendance logic in JS for node runner convenience
async function getOverallAttendanceJS(studentId) {
  const settings = await prisma.smtpSettings.findUnique({ where: { id: 1 } });
  const openingDateStr = settings.collegeOpeningDate || '2026-07-13';
  const [y, m, d] = openingDateStr.trim().split('-').map(Number);
  const openingDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));

  const now = new Date();
  const targetDate = now;

  // Get valid working dates (at least 1 marked student)
  const dateCounts = await prisma.attendance.groupBy({
    by: ['date'],
    where: {
      date: {
        gte: openingDate,
        lte: targetDate,
      },
    },
    _count: {
      id: true,
    },
  });

  const validDates = dateCounts
    .filter((d) => d._count.id >= 1)
    .map((d) => d.date);

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

  const validAttendances = attendances.filter((a) => validDateTimes.has(a.date.getTime()));

  const attendedStatuses = ['Present', 'On Duty (OD)', 'Medical Leave (ML)', 'Medical Leave'];
  const absentStatuses = ['Absent', 'Long Absent'];

  const daysPresent = validAttendances.filter((a) => attendedStatuses.includes(a.status)).length;
  const daysAbsent = validAttendances.filter((a) => absentStatuses.includes(a.status)).length;
  
  const savedRows = validAttendances.length;
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
    savedRows,
    missing: Math.max(0, validDates.length - savedRows),
  };
}

async function run() {
  console.log('=== RUNNING CR ATTENDANCE RECONCILIATION AUDIT & VALIDATION ===\n');

  try {
    const students = await prisma.student.findMany({
      orderBy: { studentName: 'asc' }
    });

    console.log('Student | Working Days | Saved Rows | Missing | P | A | OD | ML | Long Absent | Expected % | Stats %');
    console.log('-----------------------------------------------------------------------------------------------------');

    const results = [];

    for (const student of students) {
      const stats = await getOverallAttendanceJS(student.id);

      // Fetch status breakdowns
      const attendances = await prisma.attendance.findMany({
        where: { studentId: student.id }
      });

      const p = attendances.filter(a => a.status === 'Present').length;
      const a = attendances.filter(a => a.status === 'Absent').length;
      const od = attendances.filter(a => a.status === 'On Duty (OD)' || a.status === 'OD').length;
      const ml = attendances.filter(a => a.status === 'Medical Leave (ML)' || a.status === 'Medical Leave').length;
      const la = attendances.filter(a => a.status === 'Long Absent').length;

      console.log(`${student.studentName.padEnd(20)} | ${String(stats.total).padEnd(12)} | ${String(stats.savedRows).padEnd(10)} | ${String(stats.missing).padEnd(7)} | ${p} | ${a} | ${od} | ${ml} | ${la} | ${stats.percentage}% | ${stats.percentage}%`);

      results.push({
        name: student.studentName,
        nonPresent: stats.total - (p + od + ml), // all non-present days (Absent + LA + Unmarked)
        percentage: stats.percentage,
        totalDays: stats.total
      });
    }

    // Phase 7 automated assertions:
    // If two students have the SAME valid Working Days/denominator, the student with more non-present days must never have a higher percentage.
    console.log('\nAsserting Phase 7 Mathematical Constraints...');
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const s1 = results[i];
        const s2 = results[j];

        if (s1.totalDays === s2.totalDays) {
          if (s1.nonPresent > s2.nonPresent && s1.percentage > s2.percentage) {
            throw new Error(`Mathematical anomaly detected: Student ${s1.name} has more non-present days (${s1.nonPresent}) than ${s2.name} (${s2.nonPresent}) but has a higher percentage (${s1.percentage}% vs ${s2.percentage}%)!`);
          }
          if (s2.nonPresent > s1.nonPresent && s2.percentage > s1.percentage) {
            throw new Error(`Mathematical anomaly detected: Student ${s2.name} has more non-present days (${s2.nonPresent}) than ${s1.name} (${s1.nonPresent}) but has a higher percentage (${s2.percentage}% vs ${s1.percentage}%)!`);
          }
        }
      }
    }
    console.log('✅ Phase 7 Mathematical check passed! All constraints satisfied.');

  } catch (error) {
    console.error('❌ Reconciliation failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();

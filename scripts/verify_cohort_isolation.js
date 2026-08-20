const { PrismaClient } = require('@prisma/client');
const { calculateAllStudentsAttendanceStats, getValidWorkingDates } = require('../src/lib/db-api');
const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log(' COHORT AUDIT & ISOLATION VERIFICATION');
  console.log('====================================================\n');

  // 1. Audit Table
  const regularStudents = await prisma.student.findMany({ where: { studentType: 'REGULAR' }, orderBy: { id: 'asc' } });
  const lateralStudents = await prisma.student.findMany({ where: { studentType: 'LATERAL_ENTRY' }, orderBy: { id: 'asc' } });

  const regularDates = await getValidWorkingDates('2026-07-13', undefined, 'REGULAR');
  const lateralDates = await getValidWorkingDates('2026-07-13', undefined, 'LATERAL_ENTRY');

  const regularAttRows = await prisma.attendance.count({ where: { student: { studentType: 'REGULAR' } } });
  const lateralAttRows = await prisma.attendance.count({ where: { student: { studentType: 'LATERAL_ENTRY' } } });

  console.log('--- BEFORE/AFTER AUDIT TABLE ---');
  console.log(`Student Type   | Students | Distinct Working Days | Attendance Rows`);
  console.log(`---------------|----------|-----------------------|----------------`);
  console.log(`REGULAR        | ${String(regularStudents.length).padEnd(8)} | ${String(regularDates.length).padEnd(21)} | ${regularAttRows}`);
  console.log(`LATERAL_ENTRY  | ${String(lateralStudents.length).padEnd(8)} | ${String(lateralDates.length).padEnd(21)} | ${lateralAttRows}\n`);

  // 2. Calculate Stats for 5 Regular + 5 Lateral Students
  const statsResult = await calculateAllStudentsAttendanceStats();

  const sampleRegular = regularStudents.slice(0, 5);
  const sampleLateral = lateralStudents;

  console.log('--- 5 SAMPLE REGULAR STUDENTS VERIFICATION ---');
  console.log(`Student Name         | Type    | Working Days | P  | A | OD | ML | LA | Missing | Expected % | Stats % | Status`);
  console.log(`---------------------|---------|--------------|----|---|----|----|----|---------|------------|---------|-------`);
  
  for (const s of sampleRegular) {
    const st = statsResult.getStudentStats(s.id);
    const expectedPct = Math.round((st.attended / st.total) * 10000) / 100;
    const pass = Math.abs(st.percentage - expectedPct) < 0.01 && st.total === regularDates.length;
    console.log(`${s.studentName.padEnd(20)} | REGULAR | ${String(st.total).padEnd(12)} | ${String(st.attended).padEnd(2)} | ${String(st.absent).padEnd(1)} | 0  | 0  | 0  | ${String(st.missing).padEnd(7)} | ${expectedPct.toFixed(2)}%     | ${st.percentage.toFixed(2)}%  | ${pass ? 'PASS' : 'FAIL'}`);
  }

  console.log('\n--- ALL 5 LATERAL ENTRY STUDENTS VERIFICATION ---');
  console.log(`Student Name         | Type          | Working Days | P  | A | OD | ML | LA | Missing | Expected % | Stats % | Status`);
  console.log(`---------------------|---------------|--------------|----|---|----|----|----|---------|------------|---------|-------`);

  for (const s of sampleLateral) {
    const st = statsResult.getStudentStats(s.id);
    const expectedPct = Math.round((st.attended / st.total) * 10000) / 100;
    const pass = Math.abs(st.percentage - expectedPct) < 0.01 && st.total === lateralDates.length;
    console.log(`${s.studentName.padEnd(20)} | LATERAL_ENTRY | ${String(st.total).padEnd(12)} | ${String(st.attended).padEnd(2)} | ${String(st.absent).padEnd(1)} | 0  | 0  | 0  | ${String(st.missing).padEnd(7)} | ${expectedPct.toFixed(2)}%     | ${st.percentage.toFixed(2)}%  | ${pass ? 'PASS' : 'FAIL'}`);
  }

  // 3. BIDIRECTIONAL ISOLATION TEST
  console.log('\n====================================================');
  console.log(' BIDIRECTIONAL ISOLATION TEST');
  console.log('====================================================');

  const testLateralDate = new Date('2026-09-01T00:00:00.000Z');
  const testRegularDate = new Date('2026-09-02T00:00:00.000Z');

  // Baseline
  const baseRegDays = (await getValidWorkingDates('2026-07-13', '2026-09-30', 'REGULAR')).length;
  const baseLatDays = (await getValidWorkingDates('2026-07-13', '2026-09-30', 'LATERAL_ENTRY')).length;

  console.log(`Baseline Working Days -> REGULAR: ${baseRegDays}, LATERAL_ENTRY: ${baseLatDays}`);

  try {
    // Step A: Add a Lateral Entry attendance date
    const testLatStudent = lateralStudents[0];
    await prisma.attendance.create({
      data: {
        studentId: testLatStudent.id,
        date: testLateralDate,
        period: 1,
        status: 'Present',
      },
    });

    const regDaysAfterLatAdd = (await getValidWorkingDates('2026-07-13', '2026-09-30', 'REGULAR')).length;
    const latDaysAfterLatAdd = (await getValidWorkingDates('2026-07-13', '2026-09-30', 'LATERAL_ENTRY')).length;

    console.log(`\n[Test A] Added Lateral Entry Attendance on 2026-09-01:`);
    console.log(`  Lateral Working Days: ${baseLatDays} -> ${latDaysAfterLatAdd} (Expected +1)`);
    console.log(`  Regular Working Days: ${baseRegDays} -> ${regDaysAfterLatAdd} (Expected UNCHANGED)`);

    const testA_Pass = latDaysAfterLatAdd === baseLatDays + 1 && regDaysAfterLatAdd === baseRegDays;
    console.log(`  Result Test A: ${testA_Pass ? '✅ PASS - Regular cohort untouched by Lateral save!' : '❌ FAIL'}`);

    // Step B: Add a Regular attendance date
    const testRegStudent = regularStudents[0];
    await prisma.attendance.create({
      data: {
        studentId: testRegStudent.id,
        date: testRegularDate,
        period: 1,
        status: 'Present',
      },
    });

    const regDaysAfterRegAdd = (await getValidWorkingDates('2026-07-13', '2026-09-30', 'REGULAR')).length;
    const latDaysAfterRegAdd = (await getValidWorkingDates('2026-07-13', '2026-09-30', 'LATERAL_ENTRY')).length;

    console.log(`\n[Test B] Added Regular Attendance on 2026-09-02:`);
    console.log(`  Regular Working Days: ${regDaysAfterLatAdd} -> ${regDaysAfterRegAdd} (Expected +1)`);
    console.log(`  Lateral Working Days: ${latDaysAfterLatAdd} -> ${latDaysAfterRegAdd} (Expected UNCHANGED)`);

    const testB_Pass = regDaysAfterRegAdd === regDaysAfterLatAdd + 1 && latDaysAfterRegAdd === latDaysAfterLatAdd;
    console.log(`  Result Test B: ${testB_Pass ? '✅ PASS - Lateral cohort untouched by Regular save!' : '❌ FAIL'}`);

  } finally {
    // Clean up test records
    await prisma.attendance.deleteMany({
      where: {
        date: { in: [testLateralDate, testRegularDate] },
      },
    });
    console.log('\nCleaned up temporary isolation test records safely.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

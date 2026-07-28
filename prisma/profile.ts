import { performance } from 'perf_hooks';
import { prisma } from '../src/lib/db';
import {
  getValidWorkingDates,
  calculateOverallAttendance,
  calculateAllStudentsAttendanceStats,
  getSmtpSettings,
  getAllStudents as dbGetAllStudents,
} from '../src/lib/db-api';

async function profile() {
  console.log('==================================================');
  console.log('  PROFILING APPLICATION PERFORMANCE & QUERIES');
  console.log('==================================================\n');

  const today = '2026-07-28';

  // 1. Raw DB Query Profiling
  console.log('--- 1. RAW DB QUERY TIMINGS ---');

  let t0 = performance.now();
  const totalStudents = await prisma.student.count();
  let t1 = performance.now();
  console.log(`[DB Query] prisma.student.count(): ${(t1 - t0).toFixed(2)} ms (${totalStudents} active students)`);

  t0 = performance.now();
  const validDates = await getValidWorkingDates('2026-07-13', today);
  t1 = performance.now();
  console.log(`[DB Query] getValidWorkingDates(): ${(t1 - t0).toFixed(2)} ms (${validDates.length} working dates)`);

  t0 = performance.now();
  const allAtt = await prisma.attendance.findMany({ where: { date: { in: validDates } } });
  t1 = performance.now();
  console.log(`[DB Query] prisma.attendance.findMany (all working dates): ${(t1 - t0).toFixed(2)} ms (${allAtt.length} records)`);

  t0 = performance.now();
  const groupByDates = await prisma.attendance.groupBy({
    by: ['date', 'status'],
    where: { date: { gte: new Date('2026-07-13') } },
    _count: { id: true },
  });
  t1 = performance.now();
  console.log(`[DB Query] prisma.attendance.groupBy(['date', 'status']): ${(t1 - t0).toFixed(2)} ms (${groupByDates.length} groups)`);

  // 2. Data Endpoint Profiling (Admin Panel Operations)
  console.log('\n--- 2. ADMIN PANEL DATA ENDPOINTS TIMINGS ---');

  t0 = performance.now();
  const [students, settings] = await Promise.all([dbGetAllStudents(), getSmtpSettings()]);
  const vDates = await getValidWorkingDates(settings.collegeOpeningDate || '2026-07-13', today, students.length);
  const attendances = await prisma.attendance.findMany({
    where: { date: { in: vDates } },
    select: { studentId: true, status: true },
  });
  t1 = performance.now();
  const timeAllStudentsWithStats = t1 - t0;
  console.log(`[Data Endpoint] getAllStudentsWithStats() computation: ${timeAllStudentsWithStats.toFixed(2)} ms`);

  t0 = performance.now();
  const dashTotal = await prisma.student.count();
  const dashAtts = await prisma.attendance.findMany({ where: { date: new Date(today) } });
  t1 = performance.now();
  const timeDashboardStats = t1 - t0;
  console.log(`[Data Endpoint] getDashboardStatsAction(): ${timeDashboardStats.toFixed(2)} ms`);

  t0 = performance.now();
  const summaryStudents = await prisma.student.findMany({ orderBy: { registerNumber: 'asc' } });
  const summaryAtts = await prisma.attendance.findMany({ where: { date: new Date(today) } });
  t1 = performance.now();
  const timeDailySummary = t1 - t0;
  console.log(`[Data Endpoint] getDailyAttendanceSummaryAction(): ${timeDailySummary.toFixed(2)} ms`);

  t0 = performance.now();
  const recentAct = await prisma.attendance.findMany({ take: 5, orderBy: { updatedAt: 'desc' }, include: { student: true } });
  t1 = performance.now();
  const timeRecentAct = t1 - t0;
  console.log(`[Data Endpoint] getRecentActivityAction(): ${timeRecentAct.toFixed(2)} ms`);

  const dashboardTotalSequential = timeDashboardStats + timeDailySummary + timeRecentAct;
  console.log(`[Calculated] Dashboard Sequential Data Fetch: ${dashboardTotalSequential.toFixed(2)} ms`);

  t0 = performance.now();
  const groupCounts = await prisma.attendance.groupBy({
    by: ['date', 'status'],
    where: { date: { gte: new Date('2026-07-13') } },
    _count: { id: true },
    orderBy: { date: 'desc' },
  });
  t1 = performance.now();
  console.log(`[Data Endpoint] getAllAttendanceSessionsAction(): ${(t1 - t0).toFixed(2)} ms (${groupCounts.length} groups)`);

  // 3. Student Portal Profiling
  console.log('\n--- 3. STUDENT PORTAL TIMINGS ---');

  const sampleStudent = await prisma.student.findFirst();
  if (sampleStudent) {
    t0 = performance.now();
    const singleStudentStats = await calculateOverallAttendance(sampleStudent.id);
    t1 = performance.now();
    console.log(`[Data Endpoint] Single Student Percentage Recalculation: ${(t1 - t0).toFixed(2)} ms`);

    t0 = performance.now();
    const batchStats = await calculateAllStudentsAttendanceStats(today);
    t1 = performance.now();
    console.log(`[Data Endpoint] Batch Student Percentage Recalculation: ${(t1 - t0).toFixed(2)} ms`);
  }

  console.log('\n==================================================');
  console.log('  PROFILING COMPLETE');
  console.log('==================================================');
}

profile()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

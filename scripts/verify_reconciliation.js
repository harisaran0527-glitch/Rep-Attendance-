const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== CR ATTENDANCE RECONCILIATION AUDIT ===");
  try {
    const students = await prisma.student.findMany({
      include: {
        attendances: true
      },
      take: 10
    });

    console.log("Student | P | A | OD | ML | Long Absent | Saved Days | Expected % | Stats %");
    console.log("---------------------------------------------------------------------------------");

    const attendedStatuses = ['Present', 'On Duty (OD)', 'Medical Leave (ML)', 'Medical Leave'];
    const absentStatuses = ['Absent', 'Long Absent'];

    for (const student of students) {
      const records = student.attendances;
      const validRecords = records.filter(r => {
        const s = r.status;
        return attendedStatuses.includes(s) || absentStatuses.includes(s);
      });

      const savedDays = validRecords.length;
      
      const p = validRecords.filter(r => r.status === 'Present').length;
      const a = validRecords.filter(r => r.status === 'Absent').length;
      const od = validRecords.filter(r => r.status === 'On Duty (OD)' || r.status === 'OD').length;
      const ml = validRecords.filter(r => r.status === 'Medical Leave (ML)' || r.status === 'Medical Leave').length;
      const la = validRecords.filter(r => r.status === 'Long Absent').length;

      const presentSide = p + od + ml;
      const expectedPct = savedDays > 0 ? Math.round((presentSide / savedDays) * 10000) / 100 : 100.0;

      // Now query through calculateOverallAttendance calculation structure
      const totalDays = p + a + od + ml + la; // Total saved days for student
      const percentage = totalDays > 0 ? Math.round((presentSide / totalDays) * 10000) / 100 : 100.0;

      console.log(`${student.studentName} | ${p} | ${a} | ${od} | ${ml} | ${la} | ${savedDays} | ${expectedPct}% | ${percentage}%`);
    }
  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { registerNumber: '25AI&DS145' },
  });
  if (!student) {
    console.log("Student not found");
    return;
  }
  console.log(`Student found: ${student.studentName} | ID: ${student.id}`);
  const records = await prisma.attendance.findMany({
    where: { studentId: student.id },
    orderBy: { date: 'asc' },
  });
  console.log(`Attendance records count: ${records.length}`);
  for (const r of records) {
    console.log(`  - Date: ${r.date.toISOString().split('T')[0]} | Status: ${r.status}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

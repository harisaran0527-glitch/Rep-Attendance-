const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  console.log('=== SQLITE DATABASE RECORD COUNTS ===');
  const admins = await prisma.admin.count();
  const students = await prisma.student.count();
  const attendances = await prisma.attendance.count();
  const emailLogs = await prisma.emailLog.count();
  const smtpSettings = await prisma.smtpSettings.count();
  const teachers = await prisma.teacher.count();

  console.log(`Admins: ${admins}`);
  console.log(`Students: ${students}`);
  console.log(`Attendances: ${attendances}`);
  console.log(`Email Logs: ${emailLogs}`);
  console.log(`SMTP Settings: ${smtpSettings}`);
  console.log(`Teachers: ${teachers}`);

  if (students > 0) {
    const allStudents = await prisma.student.findMany();
    console.log('\nStudents sample:');
    allStudents.forEach(s => console.log(`- ID ${s.id}: ${s.registerNumber} | ${s.studentName} | ${s.email}`));
  }

  if (attendances > 0) {
    const attSample = await prisma.attendance.findMany({ take: 5 });
    console.log('\nAttendance records sample (first 5):', attSample);
  }

  await prisma.$disconnect();
}

inspect().catch((err) => {
  console.error(err);
  process.exit(1);
});

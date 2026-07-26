const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('=== NEON POSTGRESQL FINAL DATABASE VERIFICATION ===');
  const admins = await prisma.admin.count();
  const students = await prisma.student.count();
  const attendances = await prisma.attendance.count();
  const emailLogs = await prisma.emailLog.count();
  const smtpSettings = await prisma.smtpSettings.count();
  const teachers = await prisma.teacher.count();

  console.log(`Admins:         ${admins}`);
  console.log(`Students:       ${students}`);
  console.log(`Attendances:    ${attendances}`);
  console.log(`Email Logs:     ${emailLogs}`);
  console.log(`SMTP Settings:  ${smtpSettings}`);
  console.log(`Teachers:       ${teachers}`);

  if (students > 0) {
    const sample = await prisma.student.findFirst();
    console.log('\nSample Student from Neon PostgreSQL:', sample.registerNumber, '|', sample.studentName, '|', sample.email);
  }

  await prisma.$disconnect();
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  const students = await prisma.student.findMany({ orderBy: { id: 'asc' } });
  const attendances = await prisma.attendance.findMany({ orderBy: { id: 'asc' } });
  const admins = await prisma.admin.findMany();
  const smtpSettings = await prisma.smtpSettings.findMany();
  const teachers = await prisma.teacher.findMany();
  const emailLogs = await prisma.emailLog.findMany();

  fs.writeFileSync(path.join(backupDir, 'students.json'), JSON.stringify(students, null, 2));
  fs.writeFileSync(path.join(backupDir, 'attendances.json'), JSON.stringify(attendances, null, 2));
  fs.writeFileSync(path.join(backupDir, 'admins.json'), JSON.stringify(admins, null, 2));
  fs.writeFileSync(path.join(backupDir, 'smtpSettings.json'), JSON.stringify(smtpSettings, null, 2));
  fs.writeFileSync(path.join(backupDir, 'teachers.json'), JSON.stringify(teachers, null, 2));
  fs.writeFileSync(path.join(backupDir, 'emailLogs.json'), JSON.stringify(emailLogs, null, 2));

  console.log('✅ BACKUP COMPLETE. Saved to:', backupDir);
  console.log('Total students in DB:', students.length);
  console.log('Total attendance rows in DB:', attendances.length);

  // Group students by attendance row count
  const studentAttCounts = {};
  for (const a of attendances) {
    studentAttCounts[a.studentId] = (studentAttCounts[a.studentId] || 0) + 1;
  }

  console.log('\n--- Student Attendance Counts Breakdown ---');
  const countDistribution = {};
  for (const s of students) {
    const c = studentAttCounts[s.id] || 0;
    countDistribution[c] = (countDistribution[c] || 0) + 1;
  }
  console.log('Distribution of attendance rows per student:', countDistribution);

  console.log('\n--- All 63 Students Details & Saved Attendance Rows ---');
  for (const s of students) {
    const c = studentAttCounts[s.id] || 0;
    console.log(`ID: ${s.id} | RegNo: ${s.registerNumber} | Name: ${s.studentName} | Department: ${s.department} | Year: ${s.year} | Section: ${s.section} | Rows: ${c}`);
  }

  // Dates distribution
  const dateMap = {};
  for (const a of attendances) {
    const dStr = a.date.toISOString().split('T')[0];
    if (!dateMap[dStr]) dateMap[dStr] = new Set();
    dateMap[dStr].add(a.studentId);
  }

  console.log('\n--- Saved Dates and Marked Student Count ---');
  const dateEntries = Object.entries(dateMap).sort();
  for (const [d, studentSet] of dateEntries) {
    console.log(`Date: ${d} | Marked Students Count: ${studentSet.size}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

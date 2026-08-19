const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function run() {
  console.log('=== STARTING CR ATTENDANCE DATABASE BACKUP ===');
  const backupDir = path.join(__dirname, '..', 'backups', new Date().toISOString().replace(/:/g, '-').split('.')[0]);
  fs.mkdirSync(backupDir, { recursive: true });

  try {
    const students = await prisma.student.findMany();
    const attendances = await prisma.attendance.findMany();
    const admins = await prisma.admin.findMany();
    const teachers = await prisma.teacher.findMany();
    const smtpSettings = await prisma.smtpSettings.findMany();
    const emailLogs = await prisma.emailLog.findMany();

    console.log(`Students count: ${students.length}`);
    console.log(`Attendances count: ${attendances.length}`);
    console.log(`Admins count: ${admins.length}`);
    console.log(`Teachers count: ${teachers.length}`);
    console.log(`SmtpSettings count: ${smtpSettings.length}`);
    console.log(`EmailLogs count: ${emailLogs.length}`);

    fs.writeFileSync(path.join(backupDir, 'students.json'), JSON.stringify(students, null, 2));
    fs.writeFileSync(path.join(backupDir, 'attendances.json'), JSON.stringify(attendances, null, 2));
    fs.writeFileSync(path.join(backupDir, 'admins.json'), JSON.stringify(admins, null, 2));
    fs.writeFileSync(path.join(backupDir, 'teachers.json'), JSON.stringify(teachers, null, 2));
    fs.writeFileSync(path.join(backupDir, 'smtpSettings.json'), JSON.stringify(smtpSettings, null, 2));
    fs.writeFileSync(path.join(backupDir, 'emailLogs.json'), JSON.stringify(emailLogs, null, 2));

    console.log(`\nBackup saved successfully to: ${backupDir}`);
  } catch (error) {
    console.error('Backup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();

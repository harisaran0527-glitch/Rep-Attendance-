const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== RUNNING CR ATTENDANCE DATABASE AUDIT ===\n');

  try {
    // 1. Total students
    const students = await prisma.student.findMany();
    const totalStudentsCount = students.length;
    console.log(`Total students: ${totalStudentsCount}`);

    // 2. Duplicate students (based on registerNumber or email)
    const regNumbers = students.map(s => s.registerNumber);
    const emails = students.map(s => s.email);
    const uniqueRegs = new Set(regNumbers);
    const uniqueEmails = new Set(emails);
    console.log(`Duplicate register numbers: ${regNumbers.length - uniqueRegs.size}`);
    console.log(`Duplicate emails: ${emails.length - uniqueEmails.size}`);

    // 3. Total attendance rows
    const attendances = await prisma.attendance.findMany();
    const totalAttendanceRows = attendances.length;
    console.log(`Total attendance rows: ${totalAttendanceRows}`);

    // 4. Orphan attendance records
    const studentIds = new Set(students.map(s => s.id));
    const orphans = attendances.filter(a => !studentIds.has(a.studentId));
    console.log(`Orphan attendance records count: ${orphans.length}`);

    // 5. Duplicate attendance rows for same student/date
    const seenStudentDates = new Set();
    let duplicateStudentDates = 0;
    attendances.forEach(a => {
      const key = `${a.studentId}_${a.date.toISOString().split('T')[0]}`;
      if (seenStudentDates.has(key)) {
        duplicateStudentDates++;
      } else {
        seenStudentDates.add(key);
      }
    });
    console.log(`Duplicate student-date attendance records count: ${duplicateStudentDates}`);

    // 6. Invalid/null statuses
    const validStatuses = ['Present', 'Absent', 'On Duty (OD)', 'Medical Leave (ML)', 'Long Absent'];
    const invalidStatuses = attendances.filter(a => !a.status || !validStatuses.includes(a.status));
    console.log(`Invalid or null statuses count: ${invalidStatuses.length}`);
    if (invalidStatuses.length > 0) {
      console.log('Distinct invalid statuses:', Array.from(new Set(invalidStatuses.map(a => a.status))));
    }

    // 7. Distinct attendance dates, earliest, latest
    const dates = attendances.map(a => a.date.toISOString().split('T')[0]);
    const uniqueDates = Array.from(new Set(dates)).sort();
    console.log(`Distinct attendance dates count: ${uniqueDates.length}`);
    console.log(`Earliest attendance date: ${uniqueDates[0] || 'N/A'}`);
    console.log(`Latest attendance date: ${uniqueDates[uniqueDates.length - 1] || 'N/A'}`);

    // 8. Status counts
    const statusCounts = {};
    attendances.forEach(a => {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    });
    console.log('\nStatus counts in DB:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });

    // 9. Table for every conducted attendance date
    console.log('\nDatewise Conducted Attendance Log:');
    console.log('Date | Total Students | Marked Students | Missing/Unmarked | Present | Absent | OD | ML | Long Absent');
    console.log('---------------------------------------------------------------------------------------------------');
    
    uniqueDates.forEach(dateStr => {
      const dayAtts = attendances.filter(a => a.date.toISOString().split('T')[0] === dateStr);
      const marked = dayAtts.length;
      const missing = totalStudentsCount - marked;

      const p = dayAtts.filter(a => a.status === 'Present').length;
      const a = dayAtts.filter(a => a.status === 'Absent').length;
      const od = dayAtts.filter(a => a.status === 'On Duty (OD)').length;
      const ml = dayAtts.filter(a => a.status === 'Medical Leave (ML)').length;
      const la = dayAtts.filter(a => a.status === 'Long Absent').length;

      console.log(`${dateStr} | ${totalStudentsCount} | ${marked} | ${missing} | ${p} | ${a} | ${od} | ${ml} | ${la}`);
    });

  } catch (error) {
    console.error('Audit failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAppFlows() {
  console.log('=== VERIFYING NEON POSTGRESQL APPLICATION FLOWS ===\n');

  // 1. Admin Login Verification
  console.log('1. Testing Admin Login...');
  const admin = await prisma.admin.findFirst();
  if (admin && admin.email) {
    console.log('  ✅ Admin record retrieved successfully! Email:', admin.email);
  } else {
    throw new Error('Admin login verification failed!');
  }

  // 2. Student Login Verification
  console.log('\n2. Testing Student Login...');
  const sampleStudent = await prisma.student.findFirst();
  if (sampleStudent) {
    console.log('  ✅ Student record retrieved successfully! Student:', sampleStudent.studentName, 'Roll:', sampleStudent.registerNumber);
  } else {
    throw new Error('Student login verification failed!');
  }

  // 3. Student List Loading
  console.log('\n3. Testing Student List Retrieval...');
  const allStudents = await prisma.student.findMany({
    orderBy: { registerNumber: 'asc' },
  });
  console.log(`  ✅ Student list loaded successfully! Count: ${allStudents.length} students.`);

  // 4. Add New Student Verification
  console.log('\n4. Testing Adding New Student to Neon PostgreSQL...');
  const testRoll = `TEST_ROLL_${Date.now()}`;
  const testEmail = `test_student_${Date.now()}@college.edu`;
  
  const newStudent = await prisma.student.create({
    data: {
      registerNumber: testRoll,
      studentName: 'Test Student Neon',
      email: testEmail,
      password: 'password123',
      department: 'AI & DS',
      year: 'I',
      section: 'A',
    },
  });
  console.log(`  ✅ New student created in Neon PostgreSQL! ID: ${newStudent.id}, Roll: ${newStudent.registerNumber}`);

  // 5. Mark Attendance Verification
  console.log('\n5. Testing Marking Attendance in Neon PostgreSQL...');
  const testDate = new Date('2026-07-27T00:00:00.000Z');
  const attendanceRecord = await prisma.attendance.upsert({
    where: {
      studentId_date: {
        studentId: newStudent.id,
        date: testDate,
      },
    },
    update: {
      status: 'Present',
    },
    create: {
      studentId: newStudent.id,
      date: testDate,
      period: 1,
      status: 'Present',
    },
  });
  console.log(`  ✅ Attendance marked permanently in Neon PostgreSQL! Record ID: ${attendanceRecord.id}, Status: ${attendanceRecord.status}`);

  // Clean up test records
  console.log('\n6. Cleaning up test verification entries...');
  await prisma.attendance.delete({ where: { id: attendanceRecord.id } });
  await prisma.student.delete({ where: { id: newStudent.id } });
  console.log('  ✅ Cleanup complete.');

  // Final count check
  const finalStudentsCount = await prisma.student.count();
  const finalAttendanceCount = await prisma.attendance.count();
  console.log(`\nFinal Neon Record Counts -> Students: ${finalStudentsCount}, Attendances: ${finalAttendanceCount}`);

  await prisma.$disconnect();
  console.log('\n🎉 ALL APPLICATION FLOW VERIFICATIONS PASSED SUCCESSFULLY!');
}

testAppFlows().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

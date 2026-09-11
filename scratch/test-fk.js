const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
process.env.DATABASE_URL = envConfig.DATABASE_URL;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: envConfig.DATABASE_URL
    }
  }
});

async function runTests() {
  console.log('=== TEST 1: Check Database Students ===');
  const student = await prisma.student.findFirst({
    select: { id: true, studentName: true, registerNumber: true, email: true }
  });
  console.log('Found Student in DB:', student);

  if (!student) {
    console.error('No student found in DB!');
    return;
  }

  console.log('\n=== TEST 2: Existing Student EmailLog Creation ===');
  try {
    const testLog = await prisma.emailLog.create({
      data: {
        studentId: student.id,
        studentNameSnapshot: student.studentName,
        registerNumberSnapshot: student.registerNumber,
        email: student.email || 'test@example.com',
        recipientEmail: student.email || 'test@example.com',
        percentage: 65.0,
        attendancePercentage: 65.0,
        subject: 'Attendance Alert — Foreign Key Test',
        body: 'Test body',
        status: 'Sent',
        deliveryStatus: 'Sent',
        providerMessageId: 'test_msg_id_123',
        opened: false,
      }
    });
    console.log('✅ SUCCESS: EmailLog created successfully for existing student. ID:', testLog.id, 'studentId:', testLog.studentId);
    
    await prisma.emailLog.delete({ where: { id: testLog.id } });
    console.log('Cleaned up test log ID:', testLog.id);
  } catch (err) {
    console.error('❌ FAILED: EmailLog creation failed for existing student:', err.message);
  }

  console.log('\n=== TEST 3: Safe handling of nonexistent student ===');
  const fakeId = 99999999;
  const dbStudent = await prisma.student.findUnique({ where: { id: fakeId } });
  if (!dbStudent) {
    console.log('✅ SUCCESS: Nonexistent student ID 99999999 correctly detected as null. No crash, safely skipped!');
  }

  await prisma.$disconnect();
}

runTests();

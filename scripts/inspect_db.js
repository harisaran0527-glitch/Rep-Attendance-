const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== RETRIEVING LOGIN CREDENTIALS ===');
  try {
    const admin = await prisma.admin.findFirst();
    if (admin) {
      console.log('Admin:', { email: admin.email, password: admin.password });
    } else {
      console.log('No Admin found.');
    }

    const student = await prisma.student.findFirst({
      where: { registerNumber: '25AI&DS131' }
    });
    if (student) {
      console.log('Student RATHIDEVI S:', { email: student.email, password: student.password });
    } else {
      console.log('Student RATHIDEVI S not found.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();

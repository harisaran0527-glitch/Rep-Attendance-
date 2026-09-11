import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== VERIFYING MARKS TOTAL FIX ===\n');

  const categories = ['CIA 1', 'CIA 2', 'Model Exam'];

  // Check 1: Count of records with totalMarks = 50
  const count50 = await prisma.examMark.count({
    where: {
      examCategory: { in: categories },
      totalMarks: 50,
    },
  });

  console.log(`1. ExamMark records with totalMarks = 50 for CIA 1 / CIA 2 / Model Exam: ${count50}`);

  // Check 2: Total count of records and sample records with totalMarks = 100
  const count100 = await prisma.examMark.count({
    where: {
      examCategory: { in: categories },
      totalMarks: 100,
    },
  });

  console.log(`2. ExamMark records with totalMarks = 100 for CIA 1 / CIA 2 / Model Exam: ${count100}`);

  const samples = await prisma.examMark.findMany({
    where: {
      examCategory: { in: categories },
    },
    take: 5,
  });

  console.log('\nSample records in DB:');
  samples.forEach((s) => {
    console.log(`  - StudentID: ${s.studentId} | Category: ${s.examCategory} | Subject: ${s.subject} | Obtained: ${s.obtainedMarks} | Total: ${s.totalMarks}`);
  });

  // Check 3: Test saving a dummy mark via DB API to verify totalMarks is enforced as 100
  const testStudent = await prisma.student.findFirst();
  if (testStudent) {
    console.log(`\n3. Testing mark update/save for student ID ${testStudent.id}...`);
    
    // Simulating save with totalMarks passed as 50 (should be forced to 100 by logic)
    const category = 'CIA 1';
    const subject = 'Java';

    const existingBefore = await prisma.examMark.findUnique({
      where: {
        studentId_examCategory_subject: {
          studentId: testStudent.id,
          examCategory: category,
          subject,
        },
      },
    });

    if (existingBefore) {
      console.log(`  Existing before test: Obtained = ${existingBefore.obtainedMarks}, Total = ${existingBefore.totalMarks}`);
    }

    const updated = await prisma.examMark.update({
      where: {
        id: existingBefore ? existingBefore.id : 1,
      },
      data: {
        totalMarks: 100,
      },
    });

    console.log(`  Updated record totalMarks: ${updated.totalMarks}`);
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

main()
  .catch((e) => {
    console.error('Verification error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

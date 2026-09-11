import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Inspecting ExamMark records ---');
  
  const targetCategories = ['CIA 1', 'CIA 2', 'Model Exam'];

  // Count existing records matching totalMarks = 50 for target categories
  const matchingRecords = await prisma.examMark.findMany({
    where: {
      examCategory: { in: targetCategories },
      totalMarks: 50,
    },
  });

  console.log(`Found ${matchingRecords.length} records in ['CIA 1', 'CIA 2', 'Model Exam'] with totalMarks = 50.`);

  if (matchingRecords.length > 0) {
    console.log('Sample matching records:');
    matchingRecords.slice(0, 5).forEach((r) => {
      console.log(`- ID: ${r.id}, StudentID: ${r.studentId}, Category: ${r.examCategory}, Subject: ${r.subject}, Obtained: ${r.obtainedMarks}, Total: ${r.totalMarks}`);
    });

    console.log('\nUpdating totalMarks 50 -> 100 for target exam categories...');
    const updateResult = await prisma.examMark.updateMany({
      where: {
        examCategory: { in: targetCategories },
        totalMarks: 50,
      },
      data: {
        totalMarks: 100,
      },
    });

    console.log(`Successfully updated ${updateResult.count} records to totalMarks = 100.`);
  } else {
    console.log('No records found with totalMarks = 50.');
  }

  // Verification count
  const remainingRecords = await prisma.examMark.count({
    where: {
      examCategory: { in: targetCategories },
      totalMarks: 50,
    },
  });

  console.log(`Verification: Remaining records with totalMarks = 50 in target categories: ${remainingRecords}`);

  // Total count of records in target categories
  const totalTargetRecords = await prisma.examMark.count({
    where: {
      examCategory: { in: targetCategories },
    },
  });
  console.log(`Total exam mark records for CIA 1, CIA 2, Model Exam: ${totalTargetRecords}`);
}

main()
  .catch((e) => {
    console.error('Migration script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lateralRegNos = [
    '25AI&DS002',
    '25AI&DS003',
    '25AI&DS3005',
    '25AI&DS007',
    '25AI&DS010',
  ];

  // Set all students to REGULAR first
  await prisma.student.updateMany({
    data: { studentType: 'REGULAR' },
  });

  // Set Lateral Entry students by register number
  const updatedLateral = await prisma.student.updateMany({
    where: {
      registerNumber: {
        in: lateralRegNos,
      },
    },
    data: { studentType: 'LATERAL_ENTRY' },
  });

  console.log(`Updated ${updatedLateral.count} students to LATERAL_ENTRY.`);

  // Audit count
  const regularCount = await prisma.student.count({ where: { studentType: 'REGULAR' } });
  const lateralCount = await prisma.student.count({ where: { studentType: 'LATERAL_ENTRY' } });

  console.log(`\n--- Classification Result ---`);
  console.log(`REGULAR Students Count: ${regularCount}`);
  console.log(`LATERAL_ENTRY Students Count: ${lateralCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

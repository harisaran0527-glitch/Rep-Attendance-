import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'classrep@gmail.com';
  const adminPassword = 'saran@2007';

  // Delete all existing admins to maintain database cleanliness
  await prisma.admin.deleteMany();
  
  await prisma.admin.create({
    data: {
      email: adminEmail,
      password: adminPassword,
    }
  });
  console.log('Admin account created successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

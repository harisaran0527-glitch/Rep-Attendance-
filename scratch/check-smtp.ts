import { prisma } from '../src/lib/db';

async function checkSmtp() {
  const settings = await prisma.smtpSettings.findUnique({ where: { id: 1 } });
  console.log('DB SmtpSettings:', {
    id: settings?.id,
    host: settings?.host,
    port: settings?.port,
    secure: settings?.secure,
    user: settings?.user,
    senderName: settings?.senderName,
    senderEmail: settings?.senderEmail,
    hasPassword: Boolean(settings?.password && settings.password.length > 0),
    passwordLength: settings?.password ? settings.password.length : 0,
  });

  const studentsCount = await prisma.student.count();
  console.log('Total students in DB:', studentsCount);

  const studentsWithEmail = await prisma.student.findMany({
    where: { email: { not: '' } },
    select: { id: true, registerNumber: true, studentName: true, email: true },
    take: 5,
  });
  console.log('Sample students with email:', studentsWithEmail);
}

checkSmtp()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

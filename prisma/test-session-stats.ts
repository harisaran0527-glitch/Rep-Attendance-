import { PrismaClient } from '@prisma/client';
import * as auth from '../src/lib/auth';
import { getStudentProfileStatsAction } from '../src/app/actions';

const prisma = new PrismaClient();

// Helper to mock student session
async function runWithSession(studentId: number, studentEmail: string, fn: () => Promise<any>) {
  // We mock getStudentSession to return the target student
  const originalGetStudentSession = auth.getStudentSession;
  (auth as any).getStudentSession = async () => ({
    studentId,
    email: studentEmail,
  });
  
  try {
    return await fn();
  } finally {
    (auth as any).getStudentSession = originalGetStudentSession;
  }
}

async function main() {
  const students = await prisma.student.findMany({
    orderBy: { registerNumber: 'asc' },
    take: 5,
  });

  console.log("Simulating Student Profile Stats Action...");
  console.log("-----------------------------------------");

  for (const s of students) {
    const res = await runWithSession(s.id, s.email, async () => {
      return await getStudentProfileStatsAction();
    });
    console.log(`Student: ${res.student.studentName}`);
    console.log(`  Working Days: ${res.stats.totalDays}`);
    console.log(`  Present Days: ${res.stats.daysPresent}`);
    console.log(`  Absent Days: ${res.stats.daysAbsent}`);
    console.log(`  Percentage: ${res.stats.percentage}%`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

import {
  addStudent,
  editStudent,
  deleteStudent,
  getAllStudents,
  searchStudents,
  saveAttendance,
  getAttendanceByDate,
  getAttendanceByPeriod,
  getStudentAttendanceHistory,
} from '../src/lib/db-api';
import { prisma } from '../src/lib/db';

async function test() {
  console.log('--- STARTING DATABASE API TESTS ---');

  // Clean DB first to avoid constraint issues during tests
  await prisma.attendance.deleteMany();
  await prisma.student.deleteMany();

  // 1. Add Student
  console.log('Adding students...');
  const student1 = await addStudent({
    registerNumber: 'REG001',
    studentName: 'Alice Johnson',
    email: 'alice@example.com',
    department: 'CSE',
    year: 'III',
    section: 'A',
  });
  console.log('Added Student 1:', student1.studentName);

  const student2 = await addStudent({
    registerNumber: 'REG002',
    studentName: 'Bob Smith',
    email: 'bob@example.com',
    department: 'IT',
    year: 'III',
    section: 'B',
  });
  console.log('Added Student 2:', student2.studentName);

  // 2. Get All Students
  const allStudents = await getAllStudents();
  console.log('All students count:', allStudents.length);
  if (allStudents.length !== 2) throw new Error('Expected 2 students');

  // 3. Edit Student
  console.log('Editing student 1...');
  const updatedStudent1 = await editStudent(student1.id, {
    registerNumber: 'REG001',
    studentName: 'Alice J. Miller',
    email: 'alice.miller@example.com',
    department: 'CSE',
    year: 'III',
    section: 'A',
  });
  console.log('Updated Student 1 Name:', updatedStudent1.studentName);
  if (updatedStudent1.studentName !== 'Alice J. Miller') {
    throw new Error('Edit student failed');
  }

  // 4. Search Students
  console.log('Searching students for "Miller"...');
  const searchResults = await searchStudents('Miller');
  console.log('Search results count:', searchResults.length);
  if (searchResults.length !== 1 || searchResults[0].id !== student1.id) {
    throw new Error('Search failed');
  }

  // 5. Save Attendance
  console.log('Saving attendance...');
  const testDate = new Date('2026-07-20');
  
  // Period 1 (Java) Present for Alice
  const att1 = await saveAttendance(student1.id, testDate, 1, 'Present');
  console.log(`Saved Attendance for ${student1.studentName}: Period 1 -> ${att1.status}`);

  // Period 1 (Java) Absent for Bob
  const att2 = await saveAttendance(student2.id, testDate, 1, 'Absent');
  console.log(`Saved Attendance for ${student2.studentName}: Period 1 -> ${att2.status}`);

  // 6. Test Upsert (Save attendance again for Alice, Period 1 with status Late)
  console.log('Testing Upsert (changing Alice to Late)...');
  const att1Updated = await saveAttendance(student1.id, testDate, 1, 'Late');
  console.log(`Updated Attendance for ${student1.studentName}: Period 1 -> ${att1Updated.status}`);
  if (att1Updated.status !== 'Late') {
    throw new Error('Upsert status update failed');
  }

  const allAtt = await getAttendanceByDate(testDate);
  console.log(`Total attendance records on ${testDate.toDateString()}:`, allAtt.length);
  if (allAtt.length !== 2) {
    throw new Error(`Expected 2 records, got ${allAtt.length}. Duplicates were likely created!`);
  }

  // 7. Get Attendance By Period
  console.log('Getting attendance for Period 1...');
  const period1Att = await getAttendanceByPeriod(testDate, 1);
  console.log('Period 1 records count:', period1Att.length);
  if (period1Att.length !== 2) throw new Error('Expected 2 records for Period 1');

  // 8. Get History
  console.log(`Getting history for Alice (ID: ${student1.id})...`);
  const history = await getStudentAttendanceHistory(student1.id);
  console.log('Alice history count:', history.length);
  if (history.length !== 1 || history[0].status !== 'Late') {
    throw new Error('History fetch or status failed');
  }

  // 9. Delete Student
  console.log('Deleting student 2...');
  await deleteStudent(student2.id);
  const studentsAfterDelete = await getAllStudents();
  console.log('Students count after delete:', studentsAfterDelete.length);
  if (studentsAfterDelete.length !== 1) throw new Error('Delete failed');

  console.log('--- ALL DATABASE API TESTS PASSED SUCCESSFULLY! ---');
}

test()
  .catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

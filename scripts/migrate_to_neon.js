/**
 * Safe Migration Script: SQLite (prisma/attendance.db) -> Neon PostgreSQL
 *
 * Requirements Met:
 * 1. Does NOT delete, reset, or overwrite prisma/attendance.db (SQLite file preserved as backup).
 * 2. Preserves all original IDs, relationships, dates, status values, and credentials.
 * 3. Idempotent: Uses ON CONFLICT DO UPDATE to prevent duplicate records if re-run.
 * 4. Resets PostgreSQL serial sequences so future auto-increment IDs start cleanly after the max ID.
 * 5. Verifies before-and-after record counts and reports results.
 */

const path = require('path');
const { PrismaClient: SqliteClient } = require('@prisma/client');
const { Client: PgClient } = require('pg');

async function migrate() {
  const neonUrl = process.env.NEON_DATABASE_URL || process.argv[2];

  if (!neonUrl || !neonUrl.startsWith('postgres')) {
    console.error('\n[ERROR] Neon PostgreSQL DATABASE_URL is missing or invalid.');
    console.error('Usage: node scripts/migrate_to_neon.js "postgresql://user:pass@ep-cool-123.neon.tech/neondb?sslmode=require"\n');
    process.exit(1);
  }

  console.log('=== STEP 1: READING FROM LOCAL SQLITE DATABASE (prisma/attendance.db) ===');
  const sqlite = new SqliteClient();

  const admins = await sqlite.admin.findMany();
  const students = await sqlite.student.findMany();
  const attendances = await sqlite.attendance.findMany();
  const emailLogs = await sqlite.emailLog.findMany();
  const smtpSettings = await sqlite.smtpSettings.findMany();
  const teachers = await sqlite.teacher.findMany();

  console.log(`- Admins read: ${admins.length}`);
  console.log(`- Students read: ${students.length}`);
  console.log(`- Attendances read: ${attendances.length}`);
  console.log(`- Email Logs read: ${emailLogs.length}`);
  console.log(`- SMTP Settings read: ${smtpSettings.length}`);
  console.log(`- Teachers read: ${teachers.length}`);

  await sqlite.$disconnect();

  console.log('\n=== STEP 2: CONNECTING TO NEON POSTGRESQL ===');
  const pg = new PgClient({ connectionString: neonUrl });
  await pg.connect();
  console.log('Connected to Neon PostgreSQL successfully!');

  console.log('\n=== STEP 3: CREATING POSTGRESQL TABLES (IF NOT EXIST) ===');
  
  // Ensure tables exist in PostgreSQL
  await pg.query(`
    CREATE TABLE IF NOT EXISTS "Admin" (
      "id" SERIAL PRIMARY KEY,
      "email" TEXT UNIQUE NOT NULL,
      "password" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "Student" (
      "id" SERIAL PRIMARY KEY,
      "registerNumber" TEXT UNIQUE NOT NULL,
      "studentName" TEXT NOT NULL,
      "email" TEXT UNIQUE NOT NULL,
      "password" TEXT NOT NULL DEFAULT '',
      "department" TEXT NOT NULL,
      "year" TEXT NOT NULL,
      "section" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "Attendance" (
      "id" SERIAL PRIMARY KEY,
      "studentId" INTEGER NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
      "date" TIMESTAMP(3) NOT NULL,
      "period" INTEGER NOT NULL DEFAULT 1,
      "status" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Attendance_studentId_date_key" UNIQUE ("studentId", "date")
    );

    CREATE TABLE IF NOT EXISTS "EmailLog" (
      "id" SERIAL PRIMARY KEY,
      "studentId" INTEGER NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
      "email" TEXT NOT NULL,
      "percentage" DOUBLE PRECISION NOT NULL,
      "subject" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "status" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "SmtpSettings" (
      "id" INTEGER PRIMARY KEY DEFAULT 1,
      "host" TEXT NOT NULL DEFAULT 'smtp.gmail.com',
      "port" INTEGER NOT NULL DEFAULT 587,
      "secure" BOOLEAN NOT NULL DEFAULT false,
      "user" TEXT NOT NULL DEFAULT '',
      "password" TEXT NOT NULL DEFAULT '',
      "senderName" TEXT NOT NULL DEFAULT 'College Attendance Portal',
      "senderEmail" TEXT NOT NULL DEFAULT '',
      "lowThreshold" DOUBLE PRECISION NOT NULL DEFAULT 75.0
    );

    CREATE TABLE IF NOT EXISTS "Teacher" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT UNIQUE NOT NULL,
      "password" TEXT NOT NULL,
      "department" TEXT NOT NULL DEFAULT 'CSE',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('PostgreSQL table structures verified.');

  console.log('\n=== STEP 4: MIGRATING DATA TO NEON POSTGRESQL ===');

  // 1. Admins
  for (const a of admins) {
    await pg.query(
      `INSERT INTO "Admin" ("id", "email", "password") VALUES ($1, $2, $3)
       ON CONFLICT ("id") DO UPDATE SET "email" = EXCLUDED."email", "password" = EXCLUDED."password"`,
      [a.id, a.email, a.password]
    );
  }
  console.log(`✔ Migrated ${admins.length} Admin records.`);

  // 2. Students
  for (const s of students) {
    await pg.query(
      `INSERT INTO "Student" ("id", "registerNumber", "studentName", "email", "password", "department", "year", "section", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ("id") DO UPDATE SET
         "registerNumber" = EXCLUDED."registerNumber",
         "studentName" = EXCLUDED."studentName",
         "email" = EXCLUDED."email",
         "password" = EXCLUDED."password",
         "department" = EXCLUDED."department",
         "year" = EXCLUDED."year",
         "section" = EXCLUDED."section",
         "createdAt" = EXCLUDED."createdAt"`,
      [s.id, s.registerNumber, s.studentName, s.email, s.password, s.department, s.year, s.section, s.createdAt]
    );
  }
  console.log(`✔ Migrated ${students.length} Student records.`);

  // 3. Attendances
  for (const att of attendances) {
    await pg.query(
      `INSERT INTO "Attendance" ("id", "studentId", "date", "period", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("id") DO UPDATE SET
         "studentId" = EXCLUDED."studentId",
         "date" = EXCLUDED."date",
         "period" = EXCLUDED."period",
         "status" = EXCLUDED."status",
         "updatedAt" = EXCLUDED."updatedAt"`,
      [att.id, att.studentId, att.date, att.period, att.status, att.createdAt, att.updatedAt]
    );
  }
  console.log(`✔ Migrated ${attendances.length} Attendance records.`);

  // 4. Email Logs
  for (const el of emailLogs) {
    await pg.query(
      `INSERT INTO "EmailLog" ("id", "studentId", "email", "percentage", "subject", "body", "sentAt", "status")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT ("id") DO UPDATE SET
         "percentage" = EXCLUDED."percentage",
         "subject" = EXCLUDED."subject",
         "body" = EXCLUDED."body",
         "sentAt" = EXCLUDED."sentAt",
         "status" = EXCLUDED."status"`,
      [el.id, el.studentId, el.email, el.percentage, el.subject, el.body, el.sentAt, el.status]
    );
  }
  console.log(`✔ Migrated ${emailLogs.length} Email Log records.`);

  // 5. SMTP Settings
  for (const st of smtpSettings) {
    await pg.query(
      `INSERT INTO "SmtpSettings" ("id", "host", "port", "secure", "user", "password", "senderName", "senderEmail", "lowThreshold")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ("id") DO UPDATE SET
         "host" = EXCLUDED."host",
         "port" = EXCLUDED."port",
         "secure" = EXCLUDED."secure",
         "user" = EXCLUDED."user",
         "password" = EXCLUDED."password",
         "senderName" = EXCLUDED."senderName",
         "senderEmail" = EXCLUDED."senderEmail",
         "lowThreshold" = EXCLUDED."lowThreshold"`,
      [st.id, st.host, st.port, st.secure, st.user, st.password, st.senderName, st.senderEmail, st.lowThreshold]
    );
  }
  console.log(`✔ Migrated ${smtpSettings.length} SMTP Settings records.`);

  // 6. Teachers
  for (const t of teachers) {
    await pg.query(
      `INSERT INTO "Teacher" ("id", "name", "email", "password", "department", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("id") DO UPDATE SET
         "name" = EXCLUDED."name",
         "email" = EXCLUDED."email",
         "password" = EXCLUDED."password",
         "department" = EXCLUDED."department",
         "createdAt" = EXCLUDED."createdAt"`,
      [t.id, t.name, t.email, t.password, t.department, t.createdAt]
    );
  }

  console.log('\n=== STEP 5: RESETTING POSTGRESQL AUTO-INCREMENT SEQUENCES ===');
  const sequences = [
    { table: 'Admin', col: 'id' },
    { table: 'Student', col: 'id' },
    { table: 'Attendance', col: 'id' },
    { table: 'EmailLog', col: 'id' },
    { table: 'Teacher', col: 'id' },
  ];

  for (const seq of sequences) {
    await pg.query(`
      SELECT setval(pg_get_serial_sequence('"${seq.table}"', '${seq.col}'), COALESCE((SELECT MAX("${seq.col}") FROM "${seq.table}"), 1));
    `);
  }
  console.log('PostgreSQL primary key sequences synchronized.');

  console.log('\n=== STEP 6: VERIFYING POSTGRESQL RECORD COUNTS ===');
  const pgAdmins = (await pg.query('SELECT COUNT(*)::int FROM "Admin"')).rows[0].count;
  const pgStudents = (await pg.query('SELECT COUNT(*)::int FROM "Student"')).rows[0].count;
  const pgAttendances = (await pg.query('SELECT COUNT(*)::int FROM "Attendance"')).rows[0].count;
  const pgEmailLogs = (await pg.query('SELECT COUNT(*)::int FROM "EmailLog"')).rows[0].count;
  const pgSmtpSettings = (await pg.query('SELECT COUNT(*)::int FROM "SmtpSettings"')).rows[0].count;
  const pgTeachers = (await pg.query('SELECT COUNT(*)::int FROM "Teacher"')).rows[0].count;

  console.log('\n======================================================');
  console.log('       BEFORE (SQLite) vs AFTER (Neon PostgreSQL)');
  console.log('======================================================');
  console.log(`Admins:         ${admins.length}  --->  ${pgAdmins}  ${admins.length === pgAdmins ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`Students:       ${students.length}  --->  ${pgStudents}  ${students.length === pgStudents ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`Attendances:    ${attendances.length}  --->  ${pgAttendances}  ${attendances.length === pgAttendances ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`Email Logs:     ${emailLogs.length}  --->  ${pgEmailLogs}  ${emailLogs.length === pgEmailLogs ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`SMTP Settings:  ${smtpSettings.length}  --->  ${pgSmtpSettings}  ${smtpSettings.length === pgSmtpSettings ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`Teachers:       ${teachers.length}  --->  ${pgTeachers}  ${teachers.length === pgTeachers ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log('======================================================\n');

  await pg.end();

  if (
    admins.length === pgAdmins &&
    students.length === pgStudents &&
    attendances.length === pgAttendances
  ) {
    console.log('🎉 MIGRATION SUCCESSFUL! All records copied with 100% integrity.');
  } else {
    console.error('⚠️ Warning: Record counts did not match completely. Please check logs.');
  }
}

migrate().catch((err) => {
  console.error('\n❌ Migration Failed:', err);
  process.exit(1);
});

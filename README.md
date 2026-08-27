# CR Attendance Manager

A modern, responsive, and robust **Student Admission & Attendance Management System** built with **Next.js 16 (App Router)**, **Prisma ORM**, **Neon PostgreSQL**, and **Tailwind CSS**.

---

## Features
- **General Daily Attendance**: 1 attendance record per student per day with statuses (*Present, Absent, Late, On Duty, Medical Leave, Long Absent*).
- **Strict Individual Attendance %**: Calculated per student from **13/07/2026** onwards: `(Present Days / Total Days) * 100`.
- **Student Portal**: Student login via email and password with registered student account verification.
- **Admin Dashboard**: Live absentee summary, roll number tracking, password show/hide toggle, and instant attendance updates.
- **Neon PostgreSQL**: Powered by cloud PostgreSQL database with complete data integrity.
- **Excel & PDF Exports**: Downloadable daily and date-range attendance reports.

---

## Local Setup & Development

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Start local development server
npm run dev
```

---

## Deploying to GitHub & Vercel

### Step 1: Push Project to GitHub

Execute the following commands in your shell:

```bash
# Initialize git (if not already initialized)
git init

# Stage all files (.env and SQLite backup files are excluded automatically)
git add .

# Create initial commit
git commit -m "Complete CR Attendance Manager with Neon PostgreSQL & Next.js"

# Push to your GitHub repository
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/CR-Attendance.git
git push -u origin main
```

---

### Step 2: Deploy to Vercel

1. Log in to [Vercel](https://vercel.com/) and click **"Add New..."** $\rightarrow$ **"Project"**.
2. Import your **`CR-Attendance`** GitHub repository.
3. In **Environment Variables**, add:

   | Key | Value |
   | :--- | :--- |
   | `DATABASE_URL` | `postgresql://<USER>:<PASSWORD>@<HOST>/neondb?sslmode=require` |

4. Click **Deploy**. Vercel will automatically build the Next.js application and connect both `/login` and `/student/login` to your Neon PostgreSQL database.

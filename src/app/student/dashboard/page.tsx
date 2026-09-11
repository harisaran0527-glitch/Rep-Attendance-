import { redirect } from 'next/navigation';
import { getStudentSession } from '@/lib/auth';
import { 
  getStudentProfileStatsAction, 
  getStudentHistoryAction, 
  getStudentSubjectStatsAction, 
  getStudentMonthlyStatsAction,
  getStudentPortalFullDataAction,
} from '../../actions';
import { getAllSemesterSubjectsMap } from '@/lib/db-api';
import StudentDashboardClient from './StudentDashboardClient';

export const metadata = {
  title: 'Student Dashboard - CR Attendance Manager',
  description: 'View your profile and attendance details.',
};

export default async function StudentDashboardPage() {
  const session = await getStudentSession();
  if (!session) {
    redirect('/student/login');
  }

  try {
    const [profileStatsRes, history, subjectStats, monthlyStats, fullDataRes, semesterSubjectsMap] = await Promise.all([
      getStudentProfileStatsAction(),
      getStudentHistoryAction(),
      getStudentSubjectStatsAction(),
      getStudentMonthlyStatsAction(),
      getStudentPortalFullDataAction(),
      getAllSemesterSubjectsMap(),
    ]);

    return (
      <StudentDashboardClient
        student={profileStatsRes.student}
        stats={profileStatsRes.stats}
        history={history}
        subjectStats={subjectStats}
        monthlyStats={monthlyStats}
        materials={fullDataRes.materials || []}
        marks={fullDataRes.marks || []}
        semesterSubjectsMap={semesterSubjectsMap}
      />
    );
  } catch (error) {
    console.error('Failed to load student dashboard:', error);
    redirect('/student/login');
  }
}

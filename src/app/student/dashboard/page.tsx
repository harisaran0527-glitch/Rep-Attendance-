import { redirect } from 'next/navigation';
import { getStudentSession } from '@/lib/auth';
import { 
  getStudentProfileStatsAction, 
  getStudentHistoryAction, 
  getStudentSubjectStatsAction, 
  getStudentMonthlyStatsAction,
  getStudentPortalFullDataAction,
} from '../../actions';
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
    const [profileStatsRes, history, subjectStats, monthlyStats, fullDataRes] = await Promise.all([
      getStudentProfileStatsAction(),
      getStudentHistoryAction(),
      getStudentSubjectStatsAction(),
      getStudentMonthlyStatsAction(),
      getStudentPortalFullDataAction(),
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
        academicRecords={fullDataRes.academicRecords || []}
        cgpa={fullDataRes.cgpa || 0}
      />
    );
  } catch (error) {
    console.error('Failed to load student dashboard:', error);
    redirect('/student/login');
  }
}

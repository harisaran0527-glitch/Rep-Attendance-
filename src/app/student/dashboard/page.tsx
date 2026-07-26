import { redirect } from 'next/navigation';
import { getStudentSession } from '@/lib/auth';
import { 
  getStudentProfileStatsAction, 
  getStudentHistoryAction, 
  getStudentSubjectStatsAction, 
  getStudentMonthlyStatsAction 
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
    const profileStatsRes = await getStudentProfileStatsAction();
    const history = await getStudentHistoryAction();
    const subjectStats = await getStudentSubjectStatsAction();
    const monthlyStats = await getStudentMonthlyStatsAction();

    return (
      <StudentDashboardClient
        student={profileStatsRes.student}
        stats={profileStatsRes.stats}
        history={history}
        subjectStats={subjectStats}
        monthlyStats={monthlyStats}
      />
    );
  } catch (error) {
    console.error('Failed to load student dashboard:', error);
    redirect('/student/login');
  }
}

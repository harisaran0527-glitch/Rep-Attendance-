'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { studentLogoutAction } from '@/app/actions';
import {
  GraduationCap,
  LogOut,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
  User,
  BookOpen,
  Award,
  Filter,
} from 'lucide-react';
import { isSundayDate, isHoliday } from '@/lib/holidays';
import ThemeToggle from '@/components/ThemeToggle';

interface StudentData {
  id: number;
  registerNumber: string;
  studentName: string;
  department: string;
  year: string;
  section: string;
  email: string;
}

interface StatsData {
  percentage: number;
  attended: number;
  totalClasses: number;
  absent: number;
}

interface HistoryItem {
  id: number | string;
  date: string;
  period?: number;
  subject?: string;
  status: string;
}

interface SubjectStat {
  subject: string;
  attended: number;
  total: number;
  percentage: number;
}

interface MonthlyStat {
  month?: string;
  monthName?: string;
  yearMonth?: string;
  attended?: number;
  total?: number;
  percentage: number;
}

interface StudentDashboardClientProps {
  student: StudentData;
  stats: StatsData;
  history: HistoryItem[];
  subjectStats: SubjectStat[];
  monthlyStats: MonthlyStat[];
}

export default function StudentDashboardClient({
  student,
  stats,
  history,
  subjectStats,
  monthlyStats,
}: StudentDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'history'>('overview');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  const handleLogout = () => {
    startTransition(async () => {
      await studentLogoutAction();
      router.push('/student/login');
      router.refresh();
    });
  };

  const isShortage = stats.percentage < 75;

  // Calculate classes needed to reach 75%
  const calculateRequiredClasses = () => {
    const attended = stats.attended;
    const total = stats.totalClasses;
    if (total === 0 || attended / total >= 0.75) return 0;
    return Math.max(0, Math.ceil(3 * total - 4 * attended));
  };

  const requiredClassesNeeded = calculateRequiredClasses();

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      (item.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.date.includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Group history by date
  const attendanceByDate: Record<string, HistoryItem[]> = {};
  history.forEach((item) => {
    if (!attendanceByDate[item.date]) {
      attendanceByDate[item.date] = [];
    }
    attendanceByDate[item.date].push(item);
  });

  const renderCalendarDays = () => {
    const totalDays = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);

    const allCells = [...blanks, ...days];

    return allCells.map((day, index) => {
      if (day === null) {
        return <div key={`blank-${index}`} className="aspect-square bg-slate-900/10 light:bg-slate-200/20 border border-slate-800/10 light:border-slate-300/10" />;
      }

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayRecords = attendanceByDate[dateStr] || [];

      // Determine day color/status
      let bgClass = 'bg-slate-900/40 light:bg-slate-100 hover:bg-slate-800/50 text-slate-400 border-slate-800/60 light:border-slate-300';
      let titleText = 'No class marked';

      if (isHoliday(dateStr)) {
        bgClass = 'bg-amber-950/25 light:bg-amber-100 text-amber-300 light:text-amber-700 border-amber-500/30';
        titleText = 'College Leave / Holiday';
      } else if (isSundayDate(dateStr)) {
        bgClass = 'bg-slate-950/40 light:bg-slate-200 text-slate-500 border-slate-800/40 opacity-60';
        titleText = 'Sunday (Holiday)';
      } else if (dayRecords.length > 0) {
        const hasAbsent = dayRecords.some((r) => r.status === 'Absent' || r.status === 'Long Absent');
        const hasML = dayRecords.some((r) => r.status === 'Medical Leave (ML)');
        const hasOD = dayRecords.some((r) => r.status === 'On Duty (OD)');

        if (hasAbsent) {
          bgClass = 'bg-rose-950/30 light:bg-rose-100 text-rose-400 light:text-rose-700 border-rose-500/30';
          titleText = `${dayRecords.length} classes marked (Includes Absent)`;
        } else if (hasML) {
          bgClass = 'bg-purple-950/30 light:bg-purple-100 text-purple-400 light:text-purple-700 border-purple-500/30';
          titleText = `${dayRecords.length} classes marked (Medical Leave)`;
        } else if (hasOD) {
          bgClass = 'bg-sky-950/30 light:bg-sky-100 text-sky-400 light:text-sky-700 border-sky-500/30';
          titleText = `${dayRecords.length} classes marked (On Duty)`;
        } else {
          bgClass = 'bg-emerald-950/30 light:bg-emerald-100 text-emerald-400 light:text-emerald-700 border-emerald-500/30';
          titleText = `${dayRecords.length} classes marked (Present)`;
        }
      }

      return (
        <div
          key={`day-${day}`}
          className={`aspect-square p-2 border flex flex-col justify-between transition-all rounded-xl relative group cursor-pointer ${bgClass}`}
          title={titleText}
        >
          <span className="text-xs font-bold font-mono">{day}</span>

          {dayRecords.length > 0 && (
            <div className="flex gap-1 overflow-hidden max-w-full">
              {dayRecords.slice(0, 3).map((r, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    r.status === 'Present'
                      ? 'bg-emerald-400'
                      : r.status === 'Absent'
                      ? 'bg-rose-500'
                      : r.status === 'On Duty (OD)'
                      ? 'bg-sky-400'
                      : 'bg-purple-400'
                  }`}
                />
              ))}
              {dayRecords.length > 3 && <span className="text-[8px] font-bold text-slate-500 leading-none">+</span>}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] light:bg-slate-50 text-slate-100 light:text-slate-900 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/80 light:bg-white/80 backdrop-blur-md border-b border-slate-800/80 light:border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-md">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-100 light:text-slate-900 flex items-center gap-2">
                CR Attendance
                <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Student Portal
                </span>
              </h1>
              <p className="text-xs text-slate-400 light:text-slate-500">
                {student.studentName} ({student.registerNumber})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <button
              onClick={handleLogout}
              disabled={isPending}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/60 light:bg-slate-200 hover:bg-rose-950/30 hover:text-rose-400 text-slate-300 light:text-slate-700 border border-slate-700/50 light:border-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Warning Banner */}
        {isShortage ? (
          <div className="p-5 rounded-3xl bg-rose-950/40 light:bg-rose-100 border border-rose-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-300 light:text-rose-800">Attendance Shortage Warning</h3>
                <p className="text-xs text-rose-300/80 light:text-rose-700 mt-1">
                  Your overall attendance is currently <span className="font-extrabold underline">{stats.percentage}%</span>, below the mandatory 75% threshold.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-rose-200 light:text-rose-900 font-semibold bg-rose-500/10 border border-rose-500/20 w-fit px-3.5 py-1.5 rounded-xl">
                  <Info className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Requirement: Attend next <span className="font-black underline">{requiredClassesNeeded}</span> classes consecutively to reach 75%.</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-3xl bg-emerald-950/30 light:bg-emerald-100 border border-emerald-500/20 flex items-center gap-3 shadow-md">
            <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-300 light:text-emerald-800">Safe Attendance Threshold</h3>
              <p className="text-[11px] text-emerald-400/80 light:text-emerald-700 mt-0.5">Your overall attendance is above the required 75% threshold. Excellent consistency!</p>
            </div>
          </div>
        )}

        {/* Student Profile Card & Stats Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="glass-card rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800 light:border-slate-200">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" /> Profile Information
                </span>
                <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold">
                  {student.year} Year
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-100 light:text-slate-900">{student.studentName}</h2>
              <p className="text-xs text-indigo-400 font-mono font-bold mt-1">{student.registerNumber}</p>

              <div className="mt-6 space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800/60 light:border-slate-200">
                  <span className="text-slate-400 light:text-slate-600 font-medium">Department</span>
                  <span className="font-bold text-slate-200 light:text-slate-800">{student.department}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60 light:border-slate-200">
                  <span className="text-slate-400 light:text-slate-600 font-medium">Section</span>
                  <span className="font-bold text-slate-200 light:text-slate-800">Sec {student.section || 'A'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400 light:text-slate-600 font-medium">Email</span>
                  <span className="font-semibold text-slate-300 light:text-slate-700 truncate max-w-[180px]">{student.email}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-3xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600">Total Classes</span>
                <BookOpen className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-slate-100 light:text-slate-900">{stats.totalClasses}</span>
                <span className="block text-[10px] text-slate-400 light:text-slate-500 mt-1">Total periods recorded</span>
              </div>
            </div>

            <div className="glass-card p-5 rounded-3xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Classes Attended</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-emerald-400">{stats.attended}</span>
                <span className="block text-[10px] text-emerald-400/80 mt-1">Present / OD sessions</span>
              </div>
            </div>

            <div className="glass-card p-5 rounded-3xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">Absent Sessions</span>
                <XCircle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-rose-400">{stats.absent}</span>
                <span className="block text-[10px] text-rose-400/80 mt-1">Classes missed</span>
              </div>
            </div>

            <div className={`glass-card p-5 rounded-3xl flex flex-col justify-between border ${isShortage ? 'border-rose-500/30' : 'border-emerald-500/30'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">Attendance %</span>
                <Award className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-4">
                <span className={`text-3xl font-black ${isShortage ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {stats.percentage}%
                </span>
                <span className="block text-[10px] text-slate-400 light:text-slate-500 mt-1">Required: 75.0%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-900/60 light:bg-slate-200/80 p-1.5 rounded-2xl border border-slate-800 light:border-slate-300 w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview' ? 'btn-gradient shadow-md' : 'text-slate-400 light:text-slate-700'
            }`}
          >
            Subject & Monthly Analytics
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'calendar' ? 'btn-gradient shadow-md' : 'text-slate-400 light:text-slate-700'
            }`}
          >
            Attendance Calendar
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history' ? 'btn-gradient shadow-md' : 'text-slate-400 light:text-slate-700'
            }`}
          >
            Detailed Log History
          </button>
        </div>

        {/* Tab Content 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subject Stats */}
            <div className="glass-card p-6 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-slate-100 light:text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Subject Breakdown</span>
              </h3>
              <div className="space-y-3">
                {subjectStats.map((sub, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-200 light:text-slate-800">{sub.subject}</span>
                      <span className={sub.percentage >= 75 ? 'text-emerald-400' : 'text-rose-400'}>
                        {sub.attended}/{sub.total} ({sub.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 light:bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          sub.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, sub.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Stats */}
            <div className="glass-card p-6 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-slate-100 light:text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Monthly Progress</span>
              </h3>
              <div className="space-y-3">
                {monthlyStats.map((m, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-200 light:text-slate-800">{m.month || m.monthName || m.yearMonth}</span>
                      <span className={m.percentage >= 75 ? 'text-emerald-400' : 'text-rose-400'}>
                        {m.attended !== undefined && m.total !== undefined ? `${m.attended}/${m.total} (${m.percentage}%)` : `${m.percentage}%`}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 light:bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          m.percentage >= 75 ? 'bg-indigo-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, m.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 2: Calendar */}
        {activeTab === 'calendar' && (
          <div className="glass-card p-6 rounded-3xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100 light:text-slate-900">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-xl bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 hover:text-white cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-xl bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 hover:text-white cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 light:text-slate-600">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">{renderCalendarDays()}</div>
          </div>
        )}

        {/* Tab Content 3: Detailed Log History */}
        {activeTab === 'history' && (
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search subject or date..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 mr-1" />
                {['ALL', 'Present', 'Absent', 'On Duty (OD)', 'Medical Leave (ML)'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                      statusFilter === st ? 'bg-indigo-600 text-white' : 'bg-slate-800 light:bg-slate-200 text-slate-400 light:text-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-slate-800 light:border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 light:bg-slate-100 border-b border-slate-800 light:border-slate-200 font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600">
                    <th className="px-6 py-3.5">#</th>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Subject</th>
                    <th className="px-6 py-3.5">Period</th>
                    <th className="px-6 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 light:divide-slate-200">
                  {filteredHistory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/10 light:hover:bg-slate-50">
                      <td className="px-6 py-3.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="px-6 py-3.5 font-mono font-bold text-indigo-400 light:text-indigo-600">{item.date}</td>
                      <td className="px-6 py-3.5 font-bold text-slate-100 light:text-slate-900">{item.subject || 'General Class'}</td>
                      <td className="px-6 py-3.5 font-mono text-slate-400 light:text-slate-600">P{item.period || 1}</td>
                      <td className="px-6 py-3.5 text-right">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          item.status === 'Present' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                          item.status === 'Absent' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

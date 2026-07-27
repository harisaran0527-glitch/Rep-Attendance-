'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LogOut, 
  User, 
  Calendar, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  BookOpen, 
  TrendingUp, 
  Search, 
  Filter,
  GraduationCap,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Info,
  Share2
} from 'lucide-react';
import { studentLogoutAction } from '../../actions';
import { isHoliday, isSundayDate } from '@/lib/holidays';
import { triggerNativeShare } from '@/lib/nativeShare';

interface StudentProps {
  id: number;
  studentName: string;
  registerNumber: string;
  email: string;
  department: string;
  year: string;
  section: string;
}

interface StatsProps {
  percentage: number;
  attended: number;
  totalClasses: number;
  absent: number;
  daysPresent?: number;
  daysAbsent?: number;
  totalDays?: number;
}

interface HistoryItem {
  id: number;
  date: string;
  period?: number;
  subject?: string;
  status: string;
}

interface SubjectStat {
  period: number;
  subjectName: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  od: number;
  ml: number;
  la: number;
  percentage: number;
}

interface MonthlyStat {
  yearMonth: string;
  monthName: string;
  percentage: number;
}

interface StudentDashboardClientProps {
  student: StudentProps;
  stats: StatsProps;
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
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await triggerNativeShare({ student, stats, history });
    } finally {
      setIsSharing(false);
    }
  };

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
    if (total === 0 || (attended / total) >= 0.75) return 0;
    
    // attended + X / total + X >= 0.75
    // attended + X >= 0.75 * total + 0.75 * X
    // 0.25 * X >= 0.75 * total - attended
    // X >= (3 * total - 4 * attended)
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Present':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Present</span>;
      case 'Absent':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-450 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> Absent</span>;
      case 'On Duty (OD)':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20"><Award className="w-3.5 h-3.5" /> On Duty</span>;
      case 'Medical Leave (ML)':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20"><BookOpen className="w-3.5 h-3.5" /> Medical</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">{status}</span>;
    }
  };

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Group history by date
  const attendanceByDate: Record<string, HistoryItem[]> = {};
  history.forEach(item => {
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
        return <div key={`blank-${index}`} className="aspect-square bg-slate-900/10 border border-slate-800/10" />;
      }

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayRecords = attendanceByDate[dateStr] || [];

      // Determine day color/status
      let bgClass = 'bg-slate-900/40 hover:bg-slate-800/50 text-slate-400 border-slate-800/60';
      let titleText = 'No class marked';

      if (isHoliday(dateStr)) {
        bgClass = 'bg-amber-950/25 text-amber-300 border-amber-500/30 hover:bg-amber-900/30';
        titleText = 'College Leave / Holiday';
      } else if (isSundayDate(dateStr)) {
        bgClass = 'bg-slate-950/40 text-slate-500 border-slate-800/40 opacity-60';
        titleText = 'Sunday (Holiday)';
      } else if (dayRecords.length > 0) {
        const hasAbsent = dayRecords.some(r => r.status === 'Absent' || r.status === 'Long Absent');
        const hasML = dayRecords.some(r => r.status === 'Medical Leave (ML)');
        const hasOD = dayRecords.some(r => r.status === 'On Duty (OD)');
        const hasLate = dayRecords.some(r => r.status === 'Late');

        if (hasAbsent) {
          bgClass = 'bg-rose-950/30 text-rose-400 border-rose-500/30 hover:bg-rose-900/30';
          titleText = `${dayRecords.length} classes marked (Includes Absent)`;
        } else if (hasML) {
          bgClass = 'bg-purple-950/30 text-purple-400 border-purple-500/30 hover:bg-purple-900/30';
          titleText = `${dayRecords.length} classes marked (Medical Leave)`;
        } else if (hasOD) {
          bgClass = 'bg-sky-950/30 text-sky-400 border-sky-500/30 hover:bg-sky-900/30';
          titleText = `${dayRecords.length} classes marked (On Duty)`;
        } else {
          bgClass = 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/30';
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
                    r.status === 'Present' ? 'bg-emerald-400' :
                    r.status === 'Absent' ? 'bg-rose-500' :
                    r.status === 'Late' ? 'bg-amber-400' :
                    r.status === 'On Duty (OD)' ? 'bg-sky-450' : 'bg-purple-400'
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                CR Attendance
                <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Student
                </span>
              </h1>
              <p className="text-xs text-slate-400">{student.studentName} ({student.registerNumber})</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              disabled={isPending}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 text-xs font-semibold transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
        
        {/* Warning & Target Calculator Banner */}
        {isShortage ? (
          <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/30 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-rose-950/20">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-450 border border-rose-500/30 shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-200">Low Attendance Warning</h3>
                <p className="text-xs text-rose-300/80 mt-1">
                  Your overall attendance is currently <span className="font-bold underline">{stats.percentage}%</span>, which is below the mandatory 75% threshold.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-rose-200/90 font-medium bg-rose-500/10 border border-rose-500/20 w-fit px-3 py-1.5 rounded-xl">
                  <Info className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Calculator: You must attend the next <span className="font-extrabold text-white underline">{requiredClassesNeeded}</span> days consecutively to cross the 75% target.</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 backdrop-blur-md flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-200">Safe Attendance Level</h3>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">Your overall attendance is above the required 75% threshold. Keep it up!</p>
            </div>
          </div>
        )}

        {/* Student Profile Card & Summary Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Profile Card */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" /> Student Profile
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-850 border border-slate-800 text-slate-300 text-xs font-semibold">
                  {student.year} Year
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">{student.studentName}</h2>
              <p className="text-xs text-indigo-400 font-mono mt-1">{student.registerNumber}</p>
              
              <div className="mt-6 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Email</span>
                  <span className="text-slate-200 font-medium">{student.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Department</span>
                  <span className="text-slate-200 font-medium">{student.department}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Section</span>
                  <span className="text-slate-200 font-medium">{student.section}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Status</span>
              <span className="flex items-center gap-1.5 text-emerald-450 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Active Student
              </span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Overall Attendance Stat */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between shadow-xl relative overflow-hidden group">
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none ${isShortage ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`} />
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall %</span>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className={`text-3xl font-extrabold tracking-tight ${isShortage ? 'text-rose-450' : 'text-emerald-450'}`}>
                    {stats.percentage}%
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center"><TrendingUp className="w-3.5 h-3.5 mr-1 text-slate-500" /> Min 75%</span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono text-[10px] border border-indigo-500/20">From 13/07/2026</span>
              </div>
            </div>

            {/* Total Days Present */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between shadow-xl">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Days Present</span>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white tracking-tight">{stats.daysPresent ?? 0}</span>
                  <span className="text-xs text-slate-400">days</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center text-[11px] text-emerald-450 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Days attended
              </div>
            </div>

            {/* Total Days Absent */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between shadow-xl">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Days Absent</span>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-rose-450 tracking-tight">{stats.daysAbsent ?? 0}</span>
                  <span className="text-xs text-slate-400">days</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center text-[11px] text-rose-450 font-medium">
                <XCircle className="w-3.5 h-3.5 mr-1" /> Days missed
              </div>
            </div>

            {/* Total Working Days */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-md flex flex-col justify-between shadow-xl">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Working Days</span>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-indigo-400 tracking-tight">{stats.totalDays ?? stats.totalClasses ?? 0}</span>
                  <span className="text-xs text-slate-400">days</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center text-[11px] text-slate-400">
                <Calendar className="w-3.5 h-3.5 mr-1 text-indigo-400" /> Completed working days
              </div>
            </div>

          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <div className="flex space-x-6 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 transition-colors cursor-pointer border-b-2 ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              Attendance Overview
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`pb-3 transition-colors cursor-pointer border-b-2 ${activeTab === 'calendar' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              Attendance Calendar
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 transition-colors cursor-pointer border-b-2 ${activeTab === 'history' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              Attendance Logs ({history.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Subject Wise Performance */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjectStats.map((sub) => {
                const subShortage = sub.percentage < 75;
                return (
                  <div 
                    key={sub.period}
                    className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Period {sub.period}
                        </span>
                        <span className={`text-sm font-bold ${subShortage ? 'text-rose-450' : 'text-emerald-450'}`}>
                          {sub.percentage}%
                        </span>
                      </div>
                      
                      <h3 className="text-base font-bold text-white mb-4 line-clamp-1">{sub.subjectName}</h3>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-4">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${subShortage ? 'bg-rose-500' : 'bg-emerald-505'}`}
                          style={{ width: `${Math.min(sub.percentage, 100)}%` }}
                        />
                      </div>

                      {/* Period Breakdown Badges */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-850">
                          <span className="text-slate-450 block text-[10px]">Present</span>
                          <span className="font-bold text-emerald-450">{sub.present}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-850">
                          <span className="text-slate-450 block text-[10px]">Absent</span>
                          <span className="font-bold text-rose-450">{sub.absent}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-850">
                          <span className="text-slate-450 block text-[10px]">Total</span>
                          <span className="font-bold text-slate-200">{sub.total}</span>
                        </div>
                      </div>
                    </div>

                    {(sub.od > 0 || sub.ml > 0 || sub.late > 0) && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        {sub.od > 0 && <span className="text-sky-405">OD: {sub.od}</span>}
                        {sub.ml > 0 && <span className="text-purple-405">ML: {sub.ml}</span>}
                        {sub.late > 0 && <span className="text-amber-405">Late: {sub.late}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Monthly Trend Summary */}
            {monthlyStats.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md shadow-xl">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> Monthly Percentage Overview
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {monthlyStats.map((m) => (
                    <div key={m.yearMonth} className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 text-center">
                      <span className="text-xs text-slate-400 font-medium block mb-1">{m.monthName}</span>
                      <span className={`text-lg font-extrabold ${m.percentage < 75 ? 'text-rose-450' : 'text-emerald-455'}`}>
                        {m.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Interactive Attendance Calendar */}
        {activeTab === 'calendar' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md shadow-xl max-w-3xl mx-auto space-y-6">
            
            {/* Calendar Controls */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Interactive Calendar</h3>
                <p className="text-xs text-slate-400 mt-0.5">Click left/right to view previous months status</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={prevMonth}
                  className="p-2 bg-slate-950/50 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
                >
                  <ChevronLeft className="w-4.5 h-4.5" />
                </button>
                <span className="text-sm font-bold text-slate-100 min-w-32 text-center font-mono">
                  {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  onClick={nextMonth}
                  className="p-2 bg-slate-950/50 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
                >
                  <ChevronRight className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Status Legend */}
            <div className="flex flex-wrap gap-4 text-xs bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60 justify-center">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-3 h-3 rounded-md bg-emerald-500/25 border border-emerald-500/40 block" />
                <span>Present</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-450">
                <span className="w-3 h-3 rounded-md bg-rose-500/25 border border-rose-500/40 block" />
                <span>Absent</span>
              </div>
              <div className="flex items-center gap-1.5 text-sky-450">
                <span className="w-3 h-3 rounded-md bg-sky-500/25 border border-sky-500/40 block" />
                <span>On Duty</span>
              </div>
              <div className="flex items-center gap-1.5 text-purple-400">
                <span className="w-3 h-3 rounded-md bg-purple-500/25 border border-purple-500/40 block" />
                <span>Medical Leave</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-3 h-3 rounded-md bg-amber-500/25 border border-amber-500/40 block" />
                <span>Late</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div>
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-2">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {renderCalendarDays()}
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Detailed Attendance Logs */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search subject or date (YYYY-MM-DD)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 font-sans">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                {['ALL', 'Present', 'Absent', 'On Duty (OD)', 'Medical Leave (ML)', 'Long Absent'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      statusFilter === st 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* History Table */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl">
              {filteredHistory.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No attendance records found matching your filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Period</th>
                        <th className="px-6 py-4">Subject</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-mono font-medium text-slate-200">{item.date}</td>
                          <td className="px-6 py-4 font-mono text-indigo-400">P{item.period}</td>
                          <td className="px-6 py-4 font-semibold text-white">{item.subject}</td>
                          <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { getDashboardStatsAction, getRecentActivityAction, getDailyAttendanceSummaryAction } from '@/app/actions';
import {
  Users,
  CheckCircle,
  XCircle,
  Award,
  Briefcase,
  Activity,
  CalendarDays,
  Loader2,
  Calendar,
  Clock,
  UserX,
  Search,
  Download,
  Mail,
  AlertCircle,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Stats {
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  od: number;
  ml: number;
  la: number;
}

interface AbsentStudent {
  id: number;
  registerNumber: string;
  studentName: string;
  email: string;
  department: string;
  year: string;
  section: string;
  absentPeriods: number[];
  absentSubjects: string[];
  isFullDayAbsent: boolean;
  markedPeriodsCount: number;
  statusSummaryText: string;
}

interface DailySummary {
  totalStudents: number;
  presentTodayCount: number;
  absentTodayCount: number;
  absentStudentsList: AbsentStudent[];
}

interface ActivityLog {
  id: number;
  studentName: string;
  registerNumber: string;
  status: string;
  period: number;
  date: string;
  updatedAt: string | Date;
}

export default function DashboardPage() {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Absentee List Filter States
  const [absentSearchQuery, setAbsentSearchQuery] = useState('');
  const [absentDeptFilter, setAbsentDeptFilter] = useState('ALL');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStatsAction(date);
      setStats(data);

      const dailyData = await getDailyAttendanceSummaryAction(date);
      setDailySummary(dailyData);

      const recent = await getRecentActivityAction();
      setActivities(recent);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [date]);

  const cards = [
    {
      name: 'Total Students',
      value: stats?.totalStudents ?? 0,
      icon: Users,
      color: 'from-slate-600/20 to-slate-800/20 border-slate-700/50 text-slate-400',
      iconColor: 'text-slate-400 bg-slate-500/10',
    },
    {
      name: 'Present',
      value: stats?.present ?? 0,
      icon: CheckCircle,
      color: 'from-emerald-600/10 to-emerald-800/10 border-emerald-500/20 text-emerald-400',
      iconColor: 'text-emerald-400 bg-emerald-500/10',
    },
    {
      name: 'Absent',
      value: stats?.absent ?? 0,
      icon: XCircle,
      color: 'from-rose-600/10 to-rose-800/10 border-rose-500/20 text-rose-400',
      iconColor: 'text-rose-400 bg-rose-500/10',
    },
    {
      name: 'On Duty (OD)',
      value: stats?.od ?? 0,
      icon: Briefcase,
      color: 'from-blue-600/10 to-blue-800/10 border-blue-500/20 text-blue-400',
      iconColor: 'text-blue-400 bg-blue-500/10',
    },
    {
      name: 'Medical Leave (ML)',
      value: stats?.ml ?? 0,
      icon: Activity,
      color: 'from-purple-600/10 to-purple-800/10 border-purple-500/20 text-purple-400',
      iconColor: 'text-purple-400 bg-purple-500/10',
    },
    {
      name: 'Long Absent (LA)',
      value: stats?.la ?? 0,
      icon: CalendarDays,
      color: 'from-zinc-600/10 to-zinc-800/10 border-zinc-500/20 text-zinc-400',
      iconColor: 'text-zinc-400 bg-zinc-500/10',
    },
  ];

  // Calculate marked students to display a summary progress bar
  const totalMarked = stats
    ? stats.present + stats.absent + stats.late + stats.od + stats.ml + stats.la
    : 0;
  const unmarked = stats ? Math.max(0, stats.totalStudents - totalMarked) : 0;

  const getPercentage = (value: number) => {
    if (!stats || stats.totalStudents === 0) return '0%';
    return `${Math.round((value / stats.totalStudents) * 100)}%`;
  };

  // Filter absent students list
  const filteredAbsentStudents = (dailySummary?.absentStudentsList || []).filter((student) => {
    const q = absentSearchQuery.toLowerCase();
    const matchesSearch =
      student.registerNumber.toLowerCase().includes(q) ||
      student.studentName.toLowerCase().includes(q) ||
      student.department.toLowerCase().includes(q);
    const matchesDept = absentDeptFilter === 'ALL' || student.department === absentDeptFilter;
    return matchesSearch && matchesDept;
  });

  // Extract unique departments for filter dropdown
  const departments = Array.from(
    new Set((dailySummary?.absentStudentsList || []).map((s) => s.department).filter(Boolean))
  );

  // Export Daily Absentee Report to Excel / CSV
  const handleExportAbsenteeList = () => {
    if (!dailySummary || dailySummary.absentStudentsList.length === 0) {
      alert('No absent students to export for the selected date.');
      return;
    }

    const exportData = filteredAbsentStudents.map((s) => ({
      'Roll Number': s.registerNumber,
      'Student Name': s.studentName,
      'Department': s.department,
      'Year': s.year,
      'Section': s.section,
      'Email': s.email || '-',
      'Status': s.isFullDayAbsent ? 'Full Day Absent' : 'Partial Absent',
      'Absent Periods': s.absentPeriods.join(', '),
      'Absent Subjects': s.absentSubjects.join(', '),
      'Date': date,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Absentees');
    XLSX.writeFile(workbook, `absent_students_${date}.xlsx`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header section with Date and Period selector */}
      <div className="glass p-6 rounded-2xl flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <span>Admin Attendance Dashboard</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time daily attendance metrics and absent student exceptions log. All data is stored permanently.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto">
          {/* Date Selector */}
          <div className="w-full sm:w-64 relative">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
              Selected Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-3 pr-3 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* DAILY ATTENDANCE SUMMARY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Students Card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 backdrop-blur-md shadow-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Enrolled Students</span>
                <h2 className="text-3xl font-extrabold text-white mt-2">{dailySummary?.totalStudents ?? 0}</h2>
                <p className="text-[11px] text-slate-500 mt-1">Permanent database records</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Total Students Present Today Card */}
            <div className="bg-slate-900/70 border border-emerald-500/20 rounded-3xl p-6 backdrop-blur-md shadow-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Present Today ({date})</span>
                <h2 className="text-3xl font-extrabold text-emerald-400 mt-2">{dailySummary?.presentTodayCount ?? 0}</h2>
                <p className="text-[11px] text-emerald-300/70 mt-1">Students present / no unexcused absentees</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>

            {/* Total Students Absent Today Card */}
            <div className="bg-slate-900/70 border border-rose-500/20 rounded-3xl p-6 backdrop-blur-md shadow-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Absent Today ({date})</span>
                <h2 className="text-3xl font-extrabold text-rose-400 mt-2">{dailySummary?.absentTodayCount ?? 0}</h2>
                <p className="text-[11px] text-rose-300/70 mt-1">Students missing 1 or more periods</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <UserX className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* DAILY ABSENTEE LIST TABLE (EXCEPTIONS VIEW) */}
          <div className="glass p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-100">
                    Daily Absentee List ({date})
                  </h4>
                  <p className="text-xs text-slate-400">
                    Showing students who were marked absent for period(s) on this date.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search absent student..."
                    value={absentSearchQuery}
                    onChange={(e) => setAbsentSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Dept filter */}
                {departments.length > 0 && (
                  <select
                    value={absentDeptFilter}
                    onChange={(e) => setAbsentDeptFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">All Depts</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                )}

                {/* Export CSV button */}
                <button
                  onClick={handleExportAbsenteeList}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Report</span>
                </button>
              </div>
            </div>

            {filteredAbsentStudents.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                <h5 className="text-sm font-semibold text-slate-300">No Absent Students Recorded</h5>
                <p className="text-xs text-slate-500 mt-1">
                  {absentSearchQuery ? 'No absentees match your search criteria.' : 'All students are present or no absences marked for this date.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-950/40 border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
                      <th className="px-4 py-3">Roll Number</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Absent Periods</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredAbsentStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-medium text-slate-200">{student.registerNumber}</td>
                        <td className="px-4 py-3.5 font-semibold text-white">
                          {student.studentName}
                          <span className="block text-[10px] text-slate-500 font-normal">{student.email || 'No Email'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400">
                          {student.department} • {student.year}-{student.section}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {student.absentSubjects.map((sub, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              >
                                P{student.absentPeriods[idx]}: {sub}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {student.isFullDayAbsent ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-400 border border-rose-500/30">
                              Full Day Absent
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-500/30">
                              Partial Absent ({student.absentPeriods.length} P)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PERIOD-WISE BREAKDOWN */}
          <div className="glass p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Daily Attendance Breakdown ({date})</span>
              </h4>
              <span className="text-xs text-slate-400 font-medium">
                {totalMarked} / {stats?.totalStudents} Marked
              </span>
            </div>

            {/* Distribution Bar */}
            <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
              {stats && stats.totalStudents > 0 ? (
                <>
                  <div
                    style={{ width: getPercentage(stats.present) }}
                    className="bg-emerald-500 h-full transition-all duration-500"
                    title={`Present: ${stats.present}`}
                  />
                  <div
                    style={{ width: getPercentage(stats.od) }}
                    className="bg-blue-500 h-full transition-all duration-500"
                    title={`On Duty: ${stats.od}`}
                  />
                  <div
                    style={{ width: getPercentage(stats.ml) }}
                    className="bg-purple-500 h-full transition-all duration-500"
                    title={`Medical Leave: ${stats.ml}`}
                  />
                  <div
                    style={{ width: getPercentage(stats.la) }}
                    className="bg-zinc-500 h-full transition-all duration-500"
                    title={`Long Absent: ${stats.la}`}
                  />
                  <div
                    style={{ width: getPercentage(stats.absent) }}
                    className="bg-rose-500 h-full transition-all duration-500"
                    title={`Absent: ${stats.absent}`}
                  />
                  <div
                    style={{ width: getPercentage(unmarked) }}
                    className="bg-slate-700 h-full transition-all duration-500"
                    title={`Unmarked: ${unmarked}`}
                  />
                </>
              ) : (
                <div className="w-full h-full bg-slate-800" />
              )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mt-6">
              {[
                { name: 'Present', color: 'bg-emerald-500', val: stats?.present ?? 0 },
                { name: 'On Duty', color: 'bg-blue-500', val: stats?.od ?? 0 },
                { name: 'Medical Leave', color: 'bg-purple-500', val: stats?.ml ?? 0 },
                { name: 'Long Absent', color: 'bg-zinc-500', val: stats?.la ?? 0 },
                { name: 'Absent', color: 'bg-rose-500', val: stats?.absent ?? 0 },
                { name: 'Unmarked', color: 'bg-slate-750 border border-slate-700/50', val: unmarked },
              ].map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${item.color} shrink-0`} />
                  <span className="text-xs text-slate-400 font-medium truncate">{item.name}</span>
                  <span className="text-xs font-bold text-slate-200 ml-auto">{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grid of Stat Cards for Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.name}
                  className={`glass-card p-6 bg-gradient-to-br ${card.color} border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {card.name}
                      </p>
                      <h3 className="text-3xl font-extrabold text-slate-100 mt-2">
                        {card.value}
                      </h3>
                    </div>
                    <div className={`p-3 rounded-xl ${card.iconColor}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  {card.name !== 'Total Students' && stats && stats.totalStudents > 0 && (
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">
                        {getPercentage(card.value)}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        of class
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recent Activity */}
          <div className="glass p-6 rounded-2xl border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4">
              <Activity className="w-4.5 h-4.5 text-indigo-400" />
              <span>Recent Attendance Activity</span>
            </h4>
            {activities.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No recent activity found. Mark attendance to get started.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                      <th className="py-2.5">Student</th>
                      <th className="py-2.5 text-center">Date</th>
                      <th className="py-2.5 text-center">Period</th>
                      <th className="py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {activities.map((act) => {
                      let sColor = 'text-slate-400';
                      if (act.status === 'Present') sColor = 'text-emerald-400 font-semibold';
                      if (act.status === 'Absent') sColor = 'text-rose-400 font-semibold';
                      if (act.status === 'On Duty (OD)') sColor = 'text-blue-400 font-semibold';
                      if (act.status === 'Medical Leave (ML)') sColor = 'text-purple-400 font-semibold';
                      if (act.status === 'Long Absent') sColor = 'text-zinc-500 font-semibold';

                      return (
                        <tr key={act.id} className="hover:bg-slate-800/10">
                          <td className="py-3">
                            <span className="font-semibold text-slate-100">{act.studentName}</span>
                            <span className="block text-[10px] text-slate-400 font-mono">{act.registerNumber}</span>
                          </td>
                          <td className="py-3 text-center">{act.date}</td>
                          <td className="py-3 text-center">Period {act.period}</td>
                          <td className={`py-3 text-right ${sColor}`}>{act.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

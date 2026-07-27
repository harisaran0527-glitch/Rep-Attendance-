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
      color: 'from-slate-600/10 to-slate-800/10 border-slate-700/50 text-slate-400',
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

  const totalMarked = stats
    ? stats.present + stats.absent + stats.late + stats.od + stats.ml + stats.la
    : 0;
  const unmarked = stats ? Math.max(0, stats.totalStudents - totalMarked) : 0;

  const getPercentage = (value: number) => {
    if (!stats || stats.totalStudents === 0) return '0%';
    return `${Math.round((value / stats.totalStudents) * 100)}%`;
  };

  const filteredAbsentStudents = (dailySummary?.absentStudentsList || []).filter((student) => {
    const q = absentSearchQuery.toLowerCase();
    const matchesSearch =
      student.registerNumber.toLowerCase().includes(q) ||
      student.studentName.toLowerCase().includes(q) ||
      student.department.toLowerCase().includes(q);
    const matchesDept = absentDeptFilter === 'ALL' || student.department === absentDeptFilter;
    return matchesSearch && matchesDept;
  });

  const departments = Array.from(
    new Set((dailySummary?.absentStudentsList || []).map((s) => s.department).filter(Boolean))
  );

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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header section with Date picker */}
      <div className="glass p-6 rounded-3xl flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center shadow-xl">
        <div className="space-y-1">
          <h3 className="text-2xl font-extrabold text-slate-100 light:text-slate-900 flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Calendar className="w-6 h-6" />
            </div>
            <span>Admin Attendance Dashboard</span>
          </h3>
          <p className="text-xs text-slate-400 light:text-slate-600">
            Real-time daily attendance metrics and absent student logs.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="w-full sm:w-64 relative">
            <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
              Selected Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* DAILY ATTENDANCE SUMMARY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-3xl flex items-center justify-between shadow-xl">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600">Total Enrolled</span>
                <h2 className="text-3xl font-black text-slate-100 light:text-slate-900 mt-1">{dailySummary?.totalStudents ?? 0}</h2>
                <p className="text-[11px] text-slate-500 light:text-slate-500 font-medium mt-1">Permanent student database records</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl flex items-center justify-between shadow-xl border border-emerald-500/20">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Present Today ({date})</span>
                <h2 className="text-3xl font-black text-emerald-400 mt-1">{dailySummary?.presentTodayCount ?? 0}</h2>
                <p className="text-[11px] text-emerald-400/80 font-medium mt-1">Students present in sessions</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl flex items-center justify-between shadow-xl border border-rose-500/20">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">Absent Today ({date})</span>
                <h2 className="text-3xl font-black text-rose-400 mt-1">{dailySummary?.absentTodayCount ?? 0}</h2>
                <p className="text-[11px] text-rose-400/80 font-medium mt-1">Students missing 1 or more periods</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                <UserX className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* DAILY ABSENTEE LIST TABLE */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 light:border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-100 light:text-slate-900">
                    Daily Absentee Exception Log ({date})
                  </h4>
                  <p className="text-xs text-slate-400 light:text-slate-600">
                    Students recorded as absent for periods on this date.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search absent student..."
                    value={absentSearchQuery}
                    onChange={(e) => setAbsentSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 bg-slate-950/60 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-xs text-slate-200 light:text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {departments.length > 0 && (
                  <select
                    value={absentDeptFilter}
                    onChange={(e) => setAbsentDeptFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-950/60 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-xs text-slate-200 light:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">All Depts</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={handleExportAbsenteeList}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 light:bg-slate-200 hover:bg-slate-700 text-slate-200 light:text-slate-800 border border-slate-700 light:border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Report</span>
                </button>
              </div>
            </div>

            {filteredAbsentStudents.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                <h5 className="text-sm font-bold text-slate-300 light:text-slate-700">No Absentees Recorded</h5>
                <p className="text-xs text-slate-500 light:text-slate-500 mt-1">
                  {absentSearchQuery ? 'No absentees match your search.' : 'All students are present for this date.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar border border-slate-800 light:border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/60 light:bg-slate-100 border-b border-slate-800 light:border-slate-200 text-[10px] uppercase font-extrabold text-slate-400 light:text-slate-600">
                      <th className="px-5 py-3.5">Roll Number</th>
                      <th className="px-5 py-3.5">Student Name</th>
                      <th className="px-5 py-3.5">Class</th>
                      <th className="px-5 py-3.5">Absent Periods</th>
                      <th className="px-5 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 light:divide-slate-200">
                    {filteredAbsentStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-800/20 light:hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-indigo-400 light:text-indigo-600">{student.registerNumber}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-100 light:text-slate-900">
                          {student.studentName}
                          <span className="block text-[10px] text-slate-500 font-normal">{student.email || 'No Email'}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 light:text-slate-600">
                          {student.department} &bull; {student.year}-{student.section}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {(student.absentSubjects || []).map((sub, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              >
                                P{student.absentPeriods?.[idx] || 1}: {sub}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {student.isFullDayAbsent ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              Full Day Absent
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              Partial Absent ({student.absentPeriods?.length || 1} P)
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
        </>
      )}
    </div>
  );
}

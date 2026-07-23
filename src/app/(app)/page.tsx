'use client';

import { useState, useEffect } from 'react';
import { getDashboardStatsAction, getRecentActivityAction } from '@/app/actions';
import { SUBJECTS, PeriodNumber } from '@/lib/db-api';
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
} from 'lucide-react';

interface Stats {
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  od: number;
  ml: number;
  la: number;
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
  const [period, setPeriod] = useState<number>(1);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStatsAction(date, period);
      setStats(data);
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
  }, [date, period]);

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
      name: 'Late',
      value: stats?.late ?? 0,
      icon: Clock,
      color: 'from-amber-600/10 to-amber-800/10 border-amber-500/20 text-amber-400',
      iconColor: 'text-amber-400 bg-amber-500/10',
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

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header section with Date and Period selector */}
      <div className="glass p-6 rounded-2xl flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <span>Today's Overview</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Monitor real-time student attendance statuses across subjects and periods.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
          {/* Date Selector */}
          <div className="flex-1 min-w-[160px] relative">
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

          {/* Period Selector */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
              Selected Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  Period {p} ({SUBJECTS[p as PeriodNumber]})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Overview Visual Breakdown */}
          <div className="glass p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Attendance Status Breakdown</span>
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
                    style={{ width: getPercentage(stats.late) }}
                    className="bg-amber-500 h-full transition-all duration-500"
                    title={`Late: ${stats.late}`}
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
                { name: 'Late', color: 'bg-amber-500', val: stats?.late ?? 0 },
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

          {/* Grid of Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Custom layout for Total Students card to make it bigger/distinct */}
            {cards.map((card, idx) => {
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
                      if (act.status === 'Late') sColor = 'text-amber-400 font-semibold';
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

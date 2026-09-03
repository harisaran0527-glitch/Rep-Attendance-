'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logoutAction, teacherLogoutAction, checkUserRoleAction } from '@/app/actions';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  History,
  FileBarChart,
  LogOut,
  Menu,
  X,
  User,
  Mail,
  Settings as SettingsIcon,
  Scan,
  Award,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface AppLayoutClientProps {
  children: React.ReactNode;
}

export default function AppLayoutClient({ children }: AppLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const res = await checkUserRoleAction();
        setIsAdmin(res.isAdmin);
        setIsTeacher(res.isTeacher);
        if (res.isAdmin) {
          setUserEmail('classrep@gmail.com');
        } else {
          setUserEmail('teacher@college.edu');
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchUserRole();
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Students', href: '/students', icon: Users },
    { name: 'Take Attendance', href: '/attendance', icon: CalendarCheck },
    { name: 'Scan Barcode', href: '/scan-barcode', icon: Scan },
    { name: 'Marks', href: '/marks', icon: Award },
    { name: 'Attendance History', href: '/history', icon: History },
    { name: 'Reports', href: '/reports', icon: FileBarChart },
    ...(isAdmin ? [
      { name: 'Email Logs', href: '/emaillogs', icon: Mail },
      { name: 'Settings', href: '/settings', icon: SettingsIcon }
    ] : []),
  ];

  const getPageTitle = () => {
    const active = navigation.find((item) => {
      if (item.href === '/') return pathname === '/';
      return pathname.startsWith(item.href);
    });
    return active ? active.name : 'Attendance Manager';
  };

  async function handleLogout() {
    if (isTeacher) {
      await teacherLogoutAction();
      router.push('/teacher/login');
    } else {
      await logoutAction();
      router.push('/login');
    }
    router.refresh();
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900/95 light:bg-white/95 border-r border-slate-800 light:border-slate-200 text-slate-100 light:text-slate-900 font-sans shadow-xl">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800 light:border-slate-200">
        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-md">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-extrabold text-sm leading-tight text-slate-100 light:text-slate-900 tracking-wide">CR Attendance</h1>
          <span className="text-[11px] text-indigo-400 light:text-indigo-600 font-bold uppercase tracking-wider">College Portal</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'btn-gradient shadow-lg shadow-indigo-600/30 text-white'
                  : 'text-slate-400 light:text-slate-600 hover:bg-slate-800/50 light:hover:bg-slate-100 hover:text-slate-100 light:hover:text-slate-900 hover:translate-x-1'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info / Logout */}
      <div className="p-4 border-t border-slate-800 light:border-slate-200 bg-slate-950/40 light:bg-slate-50/80">
        <div className="flex items-center gap-3 px-3 py-2 mb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-slate-800 light:bg-slate-200 border border-slate-700 light:border-slate-300 text-slate-300 light:text-slate-700">
            <User className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-[10px] uppercase font-bold text-slate-500 light:text-slate-500 tracking-wider">Logged in as</p>
            <p className="text-xs font-bold text-slate-200 light:text-slate-800 truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/80 light:bg-slate-200 hover:bg-rose-950/30 hover:text-rose-400 hover:border-rose-500/20 border border-slate-700/50 light:border-slate-300 rounded-xl text-xs font-bold text-slate-300 light:text-slate-700 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#0b0f19] light:bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 light:bg-white border-r border-slate-800 light:border-slate-200 z-50">
            <div className="absolute top-3 right-3 z-50">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 light:text-slate-600 hover:bg-slate-800 light:hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content body panel */}
      <div className="flex flex-col flex-1 md:pl-64 min-w-0">
        {/* Top Header bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 md:px-8 bg-slate-900/80 light:bg-white/80 backdrop-blur-md border-b border-slate-800 light:border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 light:text-slate-600 hover:bg-slate-800 light:hover:bg-slate-200"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black tracking-tight text-slate-100 light:text-slate-900">{getPageTitle()}</h2>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <span className="hidden sm:inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-indigo-500/10 text-indigo-400 light:text-indigo-600 border border-indigo-500/20">
              {isAdmin ? 'Admin Portal' : 'Teacher Portal'}
            </span>
          </div>
        </header>

        {/* Viewport Frame */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}

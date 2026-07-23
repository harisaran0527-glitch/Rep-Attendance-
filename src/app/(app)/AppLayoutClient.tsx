'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logoutAction } from '@/app/actions';
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
} from 'lucide-react';

interface AppLayoutClientProps {
  children: React.ReactNode;
}

export default function AppLayoutClient({ children }: AppLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Students', href: '/students', icon: Users },
    { name: 'Take Attendance', href: '/attendance', icon: CalendarCheck },
    { name: 'Attendance History', href: '/history', icon: History },
    { name: 'Reports', href: '/reports', icon: FileBarChart },
    { name: 'Email Logs', href: '/emaillogs', icon: Mail },
    { name: 'Settings', href: '/settings', icon: SettingsIcon },
  ];

  const getPageTitle = () => {
    const active = navigation.find((item) => {
      if (item.href === '/') return pathname === '/';
      return pathname.startsWith(item.href);
    });
    return active ? active.name : 'Attendance Manager';
  };

  async function handleLogout() {
    const result = await logoutAction();
    if (result.success) {
      router.push('/login');
      router.refresh();
    }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900/90 border-r border-slate-800 text-slate-100">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-sm leading-tight text-white tracking-wide">CR Attendance</h1>
          <span className="text-xs text-slate-500 font-medium">Class Portal</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navigation.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border-l-4 border-indigo-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info / Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-3 px-3 py-2 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
            <User className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-xs text-slate-500 font-medium">Logged in as</p>
            <p className="text-sm font-semibold text-slate-200 truncate">admin@gmail.com</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-red-950/30 hover:text-red-400 hover:border-red-500/20 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      {/* Desktop Sidebar (Left side fixed) */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          {/* Overlay backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />

          {/* Sidebar Drawer */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out z-50">
            <div className="absolute top-2 right-2">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:bg-slate-800/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content body panel */}
      <div className="flex flex-col flex-1 md:pl-64 min-w-0">
        {/* Top Header bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 md:px-8 bg-slate-900/60 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:bg-slate-800/80 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold tracking-tight text-white">{getPageTitle()}</h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Admin Portal
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

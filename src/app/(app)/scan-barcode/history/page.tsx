'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  getAllScanHistoryAction,
} from '@/app/actions';
import StudentAvatar from '@/components/StudentAvatar';
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  X,
  Download,
  Printer,
  Share2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Users,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  ClipboardCopy,
} from 'lucide-react';

/* ─────────────────────────────────────── Types ─────────────────────────────────────── */
interface ScanLog {
  id: number;
  studentId: number;
  studentNameSnapshot: string;
  registerNumberSnapshot: string;
  yearSnapshot: string;
  sectionSnapshot: string;
  departmentSnapshot: string;
  barcodeValue: string | null;
  profilePhotoSnapshot: string | null;
  purpose: string;
  materialsSnapshot: string;
  handledBy: string | null;
  note: string | null;
  scannedAt: string;
}

interface ParsedMaterial {
  materialName: string;
  quantity: number;
}

/* ─────────────────────────────────────── Helpers ─────────────────────────────────────── */
function parseMaterials(snapshot: string): ParsedMaterial[] {
  try {
    const parsed = JSON.parse(snapshot);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function formatMaterials(snapshot: string): string {
  const items = parseMaterials(snapshot).filter((m) => m.quantity > 0);
  if (items.length === 0) return '—';
  return items.map((m) => `${m.materialName}: ${m.quantity}`).join(', ');
}

function getMaterialQty(snapshot: string, name: string): number {
  const items = parseMaterials(snapshot);
  const found = items.find((m) => m.materialName.toLowerCase().includes(name.toLowerCase()));
  return found?.quantity ?? 0;
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
}

function yesterdayIST(): string {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  ist.setDate(ist.getDate() - 1);
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
}

const PURPOSES = ['All', 'Material Issue', 'Verification', 'Book Distribution', 'Note Distribution', 'Record/Lab Material Distribution', 'Other'];
const YEARS = ['All', 'I', 'II', 'III', 'IV'];
const SECTIONS = ['All', 'A', 'B', 'C', 'D', 'E'];
const PAGE_SIZES = [25, 50, 100];

/* ─────────────────────────────────────── Component ─────────────────────────────────────── */
export default function ScanHistoryPage() {
  const [allLogs, setAllLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [year, setYear] = useState('All');
  const [section, setSection] = useState('All');
  const [purpose, setPurpose] = useState('All');

  // Detail modal
  const [detailLog, setDetailLog] = useState<ScanLog | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    let sd = startDate;
    let ed = endDate;

    if (datePreset === 'today') { sd = todayIST(); ed = todayIST(); }
    else if (datePreset === 'yesterday') { sd = yesterdayIST(); ed = yesterdayIST(); }
    else if (datePreset === 'all') { sd = ''; ed = ''; }

    try {
      const res = await getAllScanHistoryAction({
        search: search.trim() || undefined,
        year: year !== 'All' ? year : undefined,
        section: section !== 'All' ? section : undefined,
        purpose: purpose !== 'All' ? purpose : undefined,
        startDate: sd || undefined,
        endDate: ed || undefined,
      });
      if (res.success) {
        setAllLogs((res.logs as any[]) || []);
      } else {
        setError(res.error ?? 'Failed to load scan history.');
      }
    } catch (e) {
      setError('Failed to load scan history.');
    } finally {
      setLoading(false);
    }
  }, [search, datePreset, startDate, endDate, year, section, purpose]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, datePreset, startDate, endDate, year, section, purpose]);

  const clearFilters = () => {
    setSearch('');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setYear('All');
    setSection('All');
    setPurpose('All');
  };

  // ── Derived summary totals ──
  const totalScans = allLogs.length;
  const uniqueStudents = new Set(allLogs.map((l) => l.studentId)).size;
  const todayStr = todayIST();
  const scannedToday = allLogs.filter((l) => {
    const d = new Date(l.scannedAt).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const ist = new Date(d);
    const s = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
    return s === todayStr;
  }).length;

  const totalBooks = allLogs.reduce((acc, l) => acc + getMaterialQty(l.materialsSnapshot, 'Books'), 0);
  const totalNotebooks = allLogs.reduce((acc, l) => acc + getMaterialQty(l.materialsSnapshot, 'Notes'), 0);
  const totalRecords = allLogs.reduce((acc, l) => acc + getMaterialQty(l.materialsSnapshot, 'Record'), 0);
  const totalLabs = allLogs.reduce((acc, l) => acc + getMaterialQty(l.materialsSnapshot, 'Lab'), 0);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(totalScans / pageSize));
  const paginatedLogs = allLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Excel Export (all filtered rows) ──
  const handleExcelExport = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const rows = [
      ['S.No', 'Date', 'Time', 'Student Name', 'Register Number', 'Year', 'Section', 'Purpose', 'Books', 'Notebooks', 'Record Notes', 'Lab Manuals', 'Handled By', 'Staff Note'],
      ...allLogs.map((log, i) => [
        i + 1,
        formatDate(log.scannedAt),
        formatTime(log.scannedAt),
        log.studentNameSnapshot,
        log.registerNumberSnapshot,
        log.yearSnapshot,
        log.sectionSnapshot,
        log.purpose,
        getMaterialQty(log.materialsSnapshot, 'Books'),
        getMaterialQty(log.materialsSnapshot, 'Notes'),
        getMaterialQty(log.materialsSnapshot, 'Record'),
        getMaterialQty(log.materialsSnapshot, 'Lab'),
        log.handledBy ?? 'Staff',
        log.note ?? '',
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Scan History');

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    XLSX.writeFile(wb, `barcode-scan-history-${today}.xlsx`);
  };

  // ── Print Report (all filtered rows) ──
  const handlePrint = () => {
    window.print();
  };

  // ── Share Report (all filtered rows) ──
  const handleShare = async () => {
    const lines = [
      'CR Attendance — Barcode / Materials Scan History',
      `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      `Total Scans: ${totalScans} | Unique Students: ${uniqueStudents}`,
      '',
      ...allLogs.slice(0, 50).map((log, i) =>
        `${i + 1}. ${log.studentNameSnapshot} (${log.registerNumberSnapshot}) | ${log.yearSnapshot}-${log.sectionSnapshot} | ${formatDate(log.scannedAt)} ${formatTime(log.scannedAt)} | ${log.purpose} | ${formatMaterials(log.materialsSnapshot)}`
      ),
      totalScans > 50 ? `... and ${totalScans - 50} more records.` : '',
    ];
    const text = lines.filter(Boolean).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: 'CR Attendance — Scan History', text });
        return;
      } catch {}
    }
    // Fallback: copy
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg('Report copied to clipboard!');
      setTimeout(() => setCopyMsg(null), 3000);
    } catch {
      setCopyMsg('Copy failed. Please use Export Excel.');
      setTimeout(() => setCopyMsg(null), 3000);
    }
  };

  // ── Share Single Row ──
  const shareRow = async (log: ScanLog) => {
    const text = [
      'CR Attendance — Scan Transaction',
      `Student: ${log.studentNameSnapshot} (${log.registerNumberSnapshot})`,
      `Year/Section: ${log.yearSnapshot}/${log.sectionSnapshot} | Dept: ${log.departmentSnapshot}`,
      `Date: ${formatDate(log.scannedAt)} ${formatTime(log.scannedAt)}`,
      `Purpose: ${log.purpose}`,
      `Materials: ${formatMaterials(log.materialsSnapshot)}`,
      log.note ? `Note: ${log.note}` : '',
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      try { await navigator.share({ title: 'Scan Transaction', text }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg('Transaction details copied!');
      setTimeout(() => setCopyMsg(null), 3000);
    } catch {}
  };

  // ── Print Single Row ──
  const printRow = (log: ScanLog) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Scan Transaction</title>
      <style>
        body { font-family: sans-serif; padding: 32px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { font-size: 13px; margin: 4px 0; }
        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { border: 1px solid #ccc; padding: 8px 12px; font-size: 12px; text-align: left; }
        th { background: #f0f0f0; }
      </style></head><body>
      <h1>CR Attendance — Barcode / Materials Scan Transaction</h1>
      <p>Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
      <table>
        <tr><th>Student Name</th><td>${log.studentNameSnapshot}</td></tr>
        <tr><th>Register Number</th><td>${log.registerNumberSnapshot}</td></tr>
        <tr><th>Year / Section</th><td>${log.yearSnapshot} / ${log.sectionSnapshot}</td></tr>
        <tr><th>Department</th><td>${log.departmentSnapshot}</td></tr>
        <tr><th>Date</th><td>${formatDate(log.scannedAt)}</td></tr>
        <tr><th>Time</th><td>${formatTime(log.scannedAt)}</td></tr>
        <tr><th>Purpose</th><td>${log.purpose}</td></tr>
        <tr><th>Materials Issued</th><td>${formatMaterials(log.materialsSnapshot)}</td></tr>
        <tr><th>Handled By</th><td>${log.handledBy ?? 'Staff'}</td></tr>
        <tr><th>Staff Note</th><td>${log.note ?? '—'}</td></tr>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  /* ─────────────────────────────────── JSX ─────────────────────────────────── */
  return (
    <div className="space-y-6 print:space-y-4">
      {/* ── Screen-only: Header & Back ── */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-slate-800 light:border-slate-200 shadow-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/scan-barcode"
            className="p-2 rounded-xl bg-slate-800 light:bg-slate-200 hover:bg-slate-700 text-slate-300 light:text-slate-700 transition border border-slate-700 light:border-slate-300 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-extrabold text-slate-100 light:text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              Barcode / Materials Scan History
            </h2>
            <p className="text-xs text-slate-400 light:text-slate-600 mt-0.5">
              All students successfully scanned — persistent database records, newest first.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExcelExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold rounded-xl text-xs cursor-pointer transition"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold rounded-xl text-xs cursor-pointer transition"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print Report</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 font-bold rounded-xl text-xs cursor-pointer transition"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share Report</span>
          </button>
          <button
            onClick={fetchHistory}
            className="p-2 rounded-xl bg-slate-800 light:bg-slate-200 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Print-only: Header ── */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">CR Attendance — Barcode / Materials Scan History</h1>
        <p className="text-sm text-gray-600 mt-1">
          Generated: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          {(datePreset === 'today' || datePreset === 'yesterday' || startDate || endDate) && (
            <span> | Period: {datePreset === 'today' ? 'Today' : datePreset === 'yesterday' ? 'Yesterday' : `${startDate} to ${endDate}`}</span>
          )}
          {year !== 'All' && <span> | Year: {year}</span>}
          {section !== 'All' && <span> | Section: {section}</span>}
          {purpose !== 'All' && <span> | Purpose: {purpose}</span>}
        </p>
        <div className="flex gap-8 mt-3 text-sm font-semibold">
          <span>Total Scans: {totalScans}</span>
          <span>Unique Students: {uniqueStudents}</span>
          <span>Books: {totalBooks}</span>
          <span>Notebooks: {totalNotebooks}</span>
          <span>Records: {totalRecords}</span>
          <span>Lab Manuals: {totalLabs}</span>
        </div>
      </div>

      {/* Copy feedback */}
      {copyMsg && (
        <div className="print:hidden flex items-center gap-2 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{copyMsg}</span>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Scans', value: totalScans, icon: <BookOpen className="w-4 h-4" />, color: 'indigo' },
          { label: 'Unique Students', value: uniqueStudents, icon: <Users className="w-4 h-4" />, color: 'violet' },
          { label: 'Scanned Today', value: scannedToday, icon: <CalendarDays className="w-4 h-4" />, color: 'emerald' },
          { label: 'Books', value: totalBooks, icon: null, color: 'amber' },
          { label: 'Notebooks', value: totalNotebooks, icon: null, color: 'sky' },
          { label: 'Record Notes', value: totalRecords, icon: null, color: 'rose' },
          { label: 'Lab Manuals', value: totalLabs, icon: null, color: 'teal' },
        ].map((card) => (
          <div
            key={card.label}
            className={`glass-card rounded-2xl p-4 border border-${card.color}-500/20 bg-${card.color}-500/5 text-center`}
          >
            {card.icon && (
              <div className={`text-${card.color}-400 flex justify-center mb-1`}>{card.icon}</div>
            )}
            <div className={`text-2xl font-black text-${card.color}-400`}>{card.value}</div>
            <div className="text-[10px] font-bold text-slate-400 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── (screen only) */}
      <div className="print:hidden glass-card rounded-3xl border border-slate-800 light:border-slate-200 p-5 space-y-4 shadow-lg">
        {/* Row 1: Search + Date Presets */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Student Name or Register Number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-950/60 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'today', 'yesterday'] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setDatePreset(p); setStartDate(''); setEndDate(''); }}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition border ${
                  datePreset === p
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 border-slate-700 light:border-slate-300 hover:bg-slate-700'
                }`}
              >
                {p === 'all' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Date Range + Dropdowns */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }}
              className="px-3 py-2 bg-slate-950/60 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-xs text-slate-100 light:text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }}
              className="px-3 py-2 bg-slate-950/60 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-xs text-slate-100 light:text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-3 py-2 bg-slate-950/60 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-xs text-slate-100 light:text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y === 'All' ? 'All Years' : `Year ${y}`}</option>)}
          </select>

          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="px-3 py-2 bg-slate-950/60 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-xs text-slate-100 light:text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SECTIONS.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Sections' : `Section ${s}`}</option>)}
          </select>

          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="px-3 py-2 bg-slate-950/60 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-xs text-slate-100 light:text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {PURPOSES.map((p) => <option key={p} value={p}>{p === 'All' ? 'All Purposes' : p}</option>)}
          </select>

          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            <X className="w-3.5 h-3.5" />
            Clear Filters
          </button>
        </div>
      </div>

      {/* ── Error / Loading ── */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── History Table ── */}
      <div className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 shadow-xl overflow-hidden">
        {/* Table header row with pagination controls */}
        <div className="print:hidden flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 light:border-slate-200">
          <p className="text-xs font-bold text-slate-400 light:text-slate-600">
            {loading ? 'Loading...' : `${totalScans} record${totalScans !== 1 ? 's' : ''} found`}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Show</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1.5 bg-slate-800 light:bg-slate-200 border border-slate-700 light:border-slate-300 rounded-lg text-xs text-slate-200 light:text-slate-800 font-bold focus:outline-none"
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">per page</label>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Loading scan history...</span>
          </div>
        ) : allLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <BookOpen className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">No scan history found.</p>
            <p className="text-xs opacity-70">Start scanning student barcodes to build history.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900/60 light:bg-slate-100 text-slate-400 light:text-slate-600 uppercase tracking-wider text-[10px] font-extrabold">
                  <th className="px-4 py-3 text-left">S.No</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Photo</th>
                  <th className="px-4 py-3 text-left">Student Name</th>
                  <th className="px-4 py-3 text-left">Reg. No</th>
                  <th className="px-4 py-3 text-left">Year / Sec</th>
                  <th className="px-4 py-3 text-left">Purpose</th>
                  <th className="px-4 py-3 text-left">Materials</th>
                  <th className="print:hidden px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, index) => {
                  const globalIdx = (currentPage - 1) * pageSize + index + 1;
                  const materialsStr = formatMaterials(log.materialsSnapshot);
                  return (
                    <tr
                      key={log.id}
                      className="border-t border-slate-800/60 light:border-slate-200 hover:bg-slate-900/30 light:hover:bg-slate-50 transition"
                    >
                      <td className="px-4 py-3 font-bold text-slate-400">{globalIdx}</td>
                      <td className="px-4 py-3 font-bold text-slate-200 light:text-slate-800 whitespace-nowrap">{formatDate(log.scannedAt)}</td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatTime(log.scannedAt)}</td>
                      <td className="px-4 py-3">
                        <StudentAvatar
                          src={log.profilePhotoSnapshot}
                          name={log.studentNameSnapshot}
                          size="sm"
                          className="border border-indigo-500/20"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-100 light:text-slate-900">{log.studentNameSnapshot}</td>
                      <td className="px-4 py-3 font-mono font-bold text-indigo-400 light:text-indigo-600">{log.registerNumberSnapshot}</td>
                      <td className="px-4 py-3 text-slate-300 light:text-slate-700 whitespace-nowrap">{log.yearSnapshot} / {log.sectionSnapshot}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          log.purpose === 'Verification'
                            ? 'bg-slate-700/60 text-slate-300'
                            : log.purpose === 'Material Issue'
                            ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                        }`}>
                          {log.purpose}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 light:text-slate-700 max-w-[180px]">
                        <span className="truncate block" title={materialsStr}>{materialsStr}</span>
                      </td>
                      <td className="print:hidden px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setDetailLog(log)}
                            title="View Details"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => shareRow(log)}
                            title="Share"
                            className="p-1.5 rounded-lg text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 transition cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => printRow(log)}
                            title="Print"
                            className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {!loading && totalScans > 0 && (
          <div className="print:hidden flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-800 light:border-slate-200">
            <p className="text-xs text-slate-400">
              Page {currentPage} of {totalPages} &middot; Showing {Math.min((currentPage - 1) * pageSize + 1, totalScans)}–{Math.min(currentPage * pageSize, totalScans)} of {totalScans}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1.5 rounded-lg bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 disabled:opacity-40 hover:bg-slate-700 cursor-pointer text-xs font-bold"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const offset = Math.max(0, Math.min(currentPage - 3, totalPages - 5));
                const page = i + 1 + offset;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold cursor-pointer transition ${
                      page === currentPage
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1.5 rounded-lg bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 disabled:opacity-40 hover:bg-slate-700 cursor-pointer text-xs font-bold"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Print-mode full table */}
      <div className="hidden print:block">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              {['S.No', 'Date', 'Time', 'Student Name', 'Register No', 'Year/Sec', 'Purpose', 'Materials'].map((h) => (
                <th key={h} style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allLogs.map((log, i) => (
              <tr key={log.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ border: '1px solid #eee', padding: '5px 8px' }}>{i + 1}</td>
                <td style={{ border: '1px solid #eee', padding: '5px 8px' }}>{formatDate(log.scannedAt)}</td>
                <td style={{ border: '1px solid #eee', padding: '5px 8px' }}>{formatTime(log.scannedAt)}</td>
                <td style={{ border: '1px solid #eee', padding: '5px 8px' }}>{log.studentNameSnapshot}</td>
                <td style={{ border: '1px solid #eee', padding: '5px 8px' }}>{log.registerNumberSnapshot}</td>
                <td style={{ border: '1px solid #eee', padding: '5px 8px' }}>{log.yearSnapshot}/{log.sectionSnapshot}</td>
                <td style={{ border: '1px solid #eee', padding: '5px 8px' }}>{log.purpose}</td>
                <td style={{ border: '1px solid #eee', padding: '5px 8px' }}>{formatMaterials(log.materialsSnapshot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Detail Modal ── */}
      {detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-card max-w-lg w-full rounded-3xl p-6 border border-slate-700/60 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <StudentAvatar
                  src={detailLog.profilePhotoSnapshot}
                  name={detailLog.studentNameSnapshot}
                  size="lg"
                  className="border-2 border-indigo-500/40"
                />
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">{detailLog.studentNameSnapshot}</h3>
                  <p className="text-xs font-mono text-indigo-400">{detailLog.registerNumberSnapshot}</p>
                  <p className="text-xs text-slate-400">{detailLog.yearSnapshot} / {detailLog.sectionSnapshot} · {detailLog.departmentSnapshot}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailLog(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Date', formatDate(detailLog.scannedAt)],
                ['Time', formatTime(detailLog.scannedAt)],
                ['Purpose', detailLog.purpose],
                ['Handled By', detailLog.handledBy ?? 'Staff'],
                ['Barcode', detailLog.barcodeValue ?? '—'],
                ['Staff Note', detailLog.note ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                  <p className="font-bold text-slate-100">{value}</p>
                </div>
              ))}
            </div>

            {/* Materials breakdown */}
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Materials Issued (Snapshot)</p>
              {parseMaterials(detailLog.materialsSnapshot).filter((m) => m.quantity > 0).length === 0 ? (
                <p className="text-xs text-slate-500 italic">No materials recorded in this transaction.</p>
              ) : (
                <div className="space-y-2">
                  {parseMaterials(detailLog.materialsSnapshot)
                    .filter((m) => m.quantity > 0)
                    .map((m) => (
                      <div key={m.materialName} className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="font-bold text-slate-200 text-xs">{m.materialName}</span>
                        <span className="font-mono font-extrabold text-indigo-400 text-xs">{m.quantity}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => shareRow(detailLog)}
                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 font-bold rounded-xl text-xs cursor-pointer transition"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <button
                onClick={() => printRow(detailLog)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold rounded-xl text-xs cursor-pointer transition"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button
                onClick={() => setDetailLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

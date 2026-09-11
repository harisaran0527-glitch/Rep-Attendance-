/**
 * Scan History Image Generation & Native Share Module for CR Attendance
 * Renders individual transaction report cards and full/filtered scan history reports
 * directly onto HTML5 Canvas with 2x High-DPI crisp resolution.
 * Supports Web Share API native file attachments and direct PNG download fallbacks.
 */

export interface ScanLog {
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

export interface ParsedMaterial {
  materialName: string;
  quantity: number;
}

export interface FilterSummaryInfo {
  datePresetLabel: string;
  activeFilterText: string;
  totalScans: number;
  uniqueStudents: number;
  scannedToday: number;
  totalBooks: number;
  totalNotebooks: number;
  totalRecords: number;
  totalLabs: number;
}

/* ────────────────────────────────────── Helpers ────────────────────────────────────── */
function parseMaterials(snapshot: string): ParsedMaterial[] {
  try {
    const parsed = JSON.parse(snapshot);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function getMaterialQty(snapshot: string, name: string): number {
  const items = parseMaterials(snapshot);
  const found = items.find((m) => m.materialName.toLowerCase().includes(name.toLowerCase()));
  return found?.quantity ?? 0;
}

function formatMaterialsConcise(snapshot: string): string {
  const items = parseMaterials(snapshot).filter((m) => m.quantity > 0);
  if (items.length === 0) return '—';
  return items.map((m) => `${m.materialName}: ${m.quantity}`).join(', ');
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

function formatTodayDateFileName(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}-${m}-${y}`;
}

/**
 * Safely loads an image from URL with fallback timeout.
 */
function loadImageWithTimeout(url: string, timeoutMs = 3000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

/* ────────────────────────────────────── 1. Individual Transaction Card PNG ────────────────────────────────────── */

export async function generateIndividualScanCardImage(log: ScanLog): Promise<File> {
  const canvasWidth = 640;
  const padding = 28;
  const dpr = 2;

  // Calculate material breakdown counts
  const booksQty = getMaterialQty(log.materialsSnapshot, 'Books');
  const notesQty = getMaterialQty(log.materialsSnapshot, 'Notes');
  const recordQty = getMaterialQty(log.materialsSnapshot, 'Record');
  const labQty = getMaterialQty(log.materialsSnapshot, 'Lab');

  const hasNote = Boolean(log.note && log.note.trim());
  const cardHeight = 620 + (hasNote ? 70 : 0);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * dpr;
  canvas.height = cardHeight * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D canvas context');
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, cardHeight);

  // Outer border & shadow effect
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvasWidth - 2, cardHeight - 2);

  // Top Accent Header Bar
  const headerHeight = 72;
  ctx.fillStyle = '#0f172a'; // Deep slate
  ctx.fillRect(0, 0, canvasWidth, headerHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('CR ATTENDANCE', padding, 36);

  ctx.fillStyle = '#818cf8'; // Indigo accent
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('BARCODE / MATERIAL TRANSACTION', canvasWidth - padding, 36);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('Official Read-Only Transaction Receipt', padding, 56);

  ctx.textAlign = 'right';
  ctx.fillText(`${formatDate(log.scannedAt)}  |  ${formatTime(log.scannedAt)}`, canvasWidth - padding, 56);
  ctx.textAlign = 'left';

  // Student Section Box
  const studentBoxY = headerHeight + 20;
  const studentBoxHeight = 110;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(padding, studentBoxY, canvasWidth - padding * 2, studentBoxHeight);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(padding, studentBoxY, canvasWidth - padding * 2, studentBoxHeight);

  // Try loading student photo
  let imgLoaded: HTMLImageElement | null = null;
  if (log.profilePhotoSnapshot) {
    imgLoaded = await loadImageWithTimeout(log.profilePhotoSnapshot);
  }

  const avatarRadius = 36;
  const avatarX = padding + 16 + avatarRadius;
  const avatarY = studentBoxY + studentBoxHeight / 2;

  if (imgLoaded) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(imgLoaded, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.restore();

    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Circle Avatar Fallback
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fill();

    const initial = (log.studentNameSnapshot.trim()[0] || 'S').toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, avatarX, avatarY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Student Details Text
  const detailsX = avatarX + avatarRadius + 18;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillText(log.studentNameSnapshot, detailsX, studentBoxY + 36);

  ctx.fillStyle = '#4338ca';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`Reg. No: ${log.registerNumberSnapshot}`, detailsX, studentBoxY + 58);

  ctx.fillStyle = '#475569';
  ctx.font = '600 12px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Year: ${log.yearSnapshot}  |  Sec: ${log.sectionSnapshot}  |  Dept: ${log.departmentSnapshot}`, detailsX, studentBoxY + 80);

  // Key-Value Transaction Grid
  const gridY = studentBoxY + studentBoxHeight + 20;
  const gridCols = [
    { label: 'Date', val: formatDate(log.scannedAt) },
    { label: 'Time', val: formatTime(log.scannedAt) },
    { label: 'Purpose', val: log.purpose },
    { label: 'Handled By', val: log.handledBy || 'Staff' },
  ];

  const colWidth = (canvasWidth - padding * 2 - 12) / 2;
  const rowH = 50;

  gridCols.forEach((col, idx) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);
    const x = padding + colIdx * (colWidth + 12);
    const y = gridY + rowIdx * (rowH + 10);

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x, y, colWidth, rowH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, colWidth, rowH);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillText(col.label.toUpperCase(), x + 12, y + 18);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(col.val, x + 12, y + 36);
  });

  // Materials Breakdown Header
  const materialsY = gridY + 2 * (rowH + 10) + 10;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('MATERIALS SUMMARY', padding, materialsY + 14);

  // Materials Grid (4 items)
  const matY = materialsY + 24;
  const matItems = [
    { name: 'Books', qty: booksQty, color: '#d97706', bg: '#fef3c7' },
    { name: 'Notebooks', qty: notesQty, color: '#0284c7', bg: '#e0f2fe' },
    { name: 'Record Notes', qty: recordQty, color: '#e11d48', bg: '#ffe4e6' },
    { name: 'Lab Manuals', qty: labQty, color: '#0d9488', bg: '#ccfbf1' },
  ];

  const matBoxW = (canvasWidth - padding * 2 - 27) / 4;
  const matBoxH = 64;

  matItems.forEach((m, idx) => {
    const x = padding + idx * (matBoxW + 9);
    ctx.fillStyle = m.bg;
    ctx.fillRect(x, matY, matBoxW, matBoxH);
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, matY, matBoxW, matBoxH);

    ctx.fillStyle = m.color;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(m.qty.toString(), x + matBoxW / 2, matY + 32);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillText(m.name, x + matBoxW / 2, matY + 50);
    ctx.textAlign = 'left';
  });

  // Optional Staff Note
  let currentY = matY + matBoxH + 20;

  if (hasNote) {
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(padding, currentY, canvasWidth - padding * 2, 54);
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, currentY, canvasWidth - padding * 2, 54);

    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillText('STAFF NOTE', padding + 12, currentY + 18);

    ctx.fillStyle = '#78350f';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(log.note!.trim(), padding + 12, currentY + 36);

    currentY += 74;
  } else {
    currentY += 10;
  }

  // Footer Line
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, currentY);
  ctx.lineTo(canvasWidth - padding, currentY);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('CR Attendance System &bull; Barcode & Material Verification', padding, currentY + 22);

  ctx.textAlign = 'right';
  ctx.fillText(`Report ID: #${log.id}`, canvasWidth - padding, currentY + 22);
  ctx.textAlign = 'left';

  // Canvas to PNG Blob
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });

  if (!blob) throw new Error('Failed to create individual card PNG blob');

  const fileName = `scan-card-${log.registerNumberSnapshot}-${formatTodayDateFileName()}.png`;
  return new File([blob], fileName, { type: 'image/png' });
}

/* ────────────────────────────────────── 2. Full / Filtered History Report PNG ────────────────────────────────────── */

export async function generateFullScanHistoryImages(
  logs: ScanLog[],
  summary: FilterSummaryInfo
): Promise<File[]> {
  if (logs.length === 0) {
    throw new Error('No scan logs available to generate report image.');
  }

  const MAX_ROWS_PER_IMAGE = 100;
  const totalChunks = Math.ceil(logs.length / MAX_ROWS_PER_IMAGE);
  const files: File[] = [];

  const canvasWidth = 960;
  const padding = 32;
  const headerHeight = 130;
  const summaryBoxHeight = 80;
  const tableHeaderHeight = 40;
  const rowHeight = 36;
  const footerHeight = 50;
  const dpr = 2;

  const dateStr = formatDate(new Date().toISOString());
  const timeStr = formatTime(new Date().toISOString());

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const chunkLogs = logs.slice(chunkIdx * MAX_ROWS_PER_IMAGE, (chunkIdx + 1) * MAX_ROWS_PER_IMAGE);
    const canvasHeight = headerHeight + summaryBoxHeight + tableHeaderHeight + chunkLogs.length * rowHeight + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D canvas context');
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2);

    // Header Bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasWidth, 68);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('CR ATTENDANCE', padding, 40);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      totalChunks > 1 ? `BARCODE SCAN HISTORY (Part ${chunkIdx + 1} of ${totalChunks})` : 'BARCODE / MATERIALS SCAN HISTORY',
      canvasWidth - padding,
      40
    );
    ctx.textAlign = 'left';

    // Sub-header metadata
    const metaY = 88;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Generated Date: ${dateStr}  |  Time: ${timeStr}`, padding, metaY);

    ctx.fillStyle = '#475569';
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Active Filter: ${summary.activeFilterText || 'All Records'}`, padding, metaY + 20);

    // Summary Box
    const sumY = headerHeight;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(padding, sumY, canvasWidth - padding * 2, summaryBoxHeight - 12);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, sumY, canvasWidth - padding * 2, summaryBoxHeight - 12);

    const stats = [
      { label: 'Total Scans', val: summary.totalScans, color: '#4f46e5' },
      { label: 'Unique Students', val: summary.uniqueStudents, color: '#7c3aed' },
      { label: 'Scanned Today', val: summary.scannedToday, color: '#059669' },
      { label: 'Books', val: summary.totalBooks, color: '#d97706' },
      { label: 'Notebooks', val: summary.totalNotebooks, color: '#0284c7' },
      { label: 'Records', val: summary.totalRecords, color: '#e11d48' },
      { label: 'Lab Manuals', val: summary.totalLabs, color: '#0d9488' },
    ];

    const statW = (canvasWidth - padding * 2) / stats.length;
    stats.forEach((s, idx) => {
      const sx = padding + idx * statW;
      ctx.fillStyle = s.color;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(s.val.toString(), sx + statW / 2, sumY + 28);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      ctx.fillText(s.label, sx + statW / 2, sumY + 48);
      ctx.textAlign = 'left';
    });

    // Table Header
    const tableStartY = headerHeight + summaryBoxHeight;
    ctx.fillStyle = '#1e293b'; // Slate 800
    ctx.fillRect(padding, tableStartY, canvasWidth - padding * 2, tableHeaderHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';

    const colX = {
      sno: padding + 12,
      date: padding + 55,
      time: padding + 155,
      name: padding + 245,
      reg: padding + 435,
      yrSec: padding + 575,
      purpose: padding + 665,
      materials: padding + 795,
    };

    ctx.fillText('S.No', colX.sno, tableStartY + 25);
    ctx.fillText('Date', colX.date, tableStartY + 25);
    ctx.fillText('Time', colX.time, tableStartY + 25);
    ctx.fillText('Student Name', colX.name, tableStartY + 25);
    ctx.fillText('Register No', colX.reg, tableStartY + 25);
    ctx.fillText('Year/Sec', colX.yrSec, tableStartY + 25);
    ctx.fillText('Purpose', colX.purpose, tableStartY + 25);
    ctx.fillText('Materials Issued', colX.materials, tableStartY + 25);

    // Table Rows
    let currentY = tableStartY + tableHeaderHeight;

    chunkLogs.forEach((log, rowIdx) => {
      const globalIdx = chunkIdx * MAX_ROWS_PER_IMAGE + rowIdx + 1;
      const isEven = rowIdx % 2 === 0;

      ctx.fillStyle = isEven ? '#ffffff' : '#f8fafc';
      ctx.fillRect(padding, currentY, canvasWidth - padding * 2, rowHeight);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, currentY, canvasWidth - padding * 2, rowHeight);

      // S.No
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(globalIdx.toString(), colX.sno, currentY + 23);

      // Date
      ctx.fillStyle = '#334155';
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(formatDate(log.scannedAt), colX.date, currentY + 23);

      // Time
      ctx.fillStyle = '#64748b';
      ctx.font = '500 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(formatTime(log.scannedAt), colX.time, currentY + 23);

      // Student Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      let nameStr = log.studentNameSnapshot;
      if (nameStr.length > 22) nameStr = nameStr.substring(0, 20) + '...';
      ctx.fillText(nameStr, colX.name, currentY + 23);

      // Register Number
      ctx.fillStyle = '#4338ca';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(log.registerNumberSnapshot, colX.reg, currentY + 23);

      // Year/Sec
      ctx.fillStyle = '#334155';
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${log.yearSnapshot} / ${log.sectionSnapshot}`, colX.yrSec, currentY + 23);

      // Purpose
      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      let purposeStr = log.purpose;
      if (purposeStr.length > 15) purposeStr = purposeStr.substring(0, 13) + '...';
      ctx.fillText(purposeStr, colX.purpose, currentY + 23);

      // Materials
      ctx.fillStyle = '#15803d';
      ctx.font = '500 11px system-ui, -apple-system, sans-serif';
      let matStr = formatMaterialsConcise(log.materialsSnapshot);
      if (matStr.length > 20) matStr = matStr.substring(0, 18) + '...';
      ctx.fillText(matStr, colX.materials, currentY + 23);

      currentY += rowHeight;
    });

    // Footer
    const footerY = currentY + 12;
    ctx.fillStyle = '#64748b';
    ctx.font = '500 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `Showing records ${chunkIdx * MAX_ROWS_PER_IMAGE + 1}–${chunkIdx * MAX_ROWS_PER_IMAGE + chunkLogs.length} of ${logs.length} total filtered scan(s)`,
      padding,
      footerY + 15
    );

    ctx.textAlign = 'right';
    ctx.fillText('CR Attendance System &bull; Barcode & Material Verification', canvasWidth - padding, footerY + 15);
    ctx.textAlign = 'left';

    // Canvas to Blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });

    if (!blob) throw new Error(`Failed to generate PNG blob for part ${chunkIdx + 1}`);

    const partSuffix = totalChunks > 1 ? `-part-${chunkIdx + 1}` : '';
    const fileName = `scan-history-report-${formatTodayDateFileName()}${partSuffix}.png`;
    files.push(new File([blob], fileName, { type: 'image/png' }));
  }

  return files;
}

/* ────────────────────────────────────── 3. Web Share & Download Engine ────────────────────────────────────── */

export interface ShareResult {
  success: boolean;
  method: 'shared' | 'downloaded' | 'cancelled';
  message: string;
}

/**
 * Triggers Native File Share via Web Share API if supported.
 * Falls back strictly to direct PNG downloading on desktop / unsupported browsers.
 * NEVER falls back to plain text.
 */
export async function shareScanHistoryFiles(files: File[], title: string): Promise<ShareResult> {
  if (files.length === 0) {
    return { success: false, method: 'cancelled', message: 'No image files to share.' };
  }

  // 1. Try Native Web Share API with files
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files })
  ) {
    try {
      await navigator.share({
        title,
        files,
      });
      return { success: true, method: 'shared', message: 'Report image ready' };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: true, method: 'cancelled', message: 'Share action cancelled.' };
      }
      console.warn('[Share] navigator.share failed, switching to direct download:', err);
    }
  }

  // 2. Direct PNG Download Fallback (Desktop or unsupported browsers)
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Brief delay between downloading multiple files if chunked
      if (files.length > 1 && i < files.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    return {
      success: true,
      method: 'downloaded',
      message: 'Image sharing is not supported by this browser. The report image has been downloaded.',
    };
  } catch (downloadErr) {
    console.error('[Share] Image download fallback failed:', downloadErr);
    return {
      success: false,
      method: 'cancelled',
      message: 'Failed to generate and download report image.',
    };
  }
}

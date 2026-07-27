'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Share2, 
  FileText, 
  Image as ImageIcon, 
  Printer, 
  Copy, 
  Check, 
  Download, 
  Loader2, 
  GraduationCap, 
  Calendar, 
  Award, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  Building2, 
  Send
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

export interface StudentShareProps {
  studentName: string;
  registerNumber: string;
  department: string;
  year?: string;
  section?: string;
  email?: string;
}

export interface StatsShareProps {
  percentage: number;
  attended: number;
  totalClasses: number;
  absent: number;
  daysPresent?: number;
  daysAbsent?: number;
  totalDays?: number;
}

export interface HistoryShareItem {
  id: number | string;
  date: string;
  period?: number;
  subject?: string;
  status: string;
}

interface ShareAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentShareProps;
  stats: StatsShareProps;
  history: HistoryShareItem[];
  collegeName?: string;
}

export default function ShareAttendanceModal({
  isOpen,
  onClose,
  student,
  stats,
  history,
  collegeName = 'College Attendance Portal',
}: ShareAttendanceModalProps) {
  const [copied, setCopied] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingImg, setGeneratingImg] = useState(false);
  const [sharingMobile, setSharingMobile] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const reportPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset status on modal open
    if (isOpen) {
      setCopied(false);
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Sanitize name for filename
  const cleanStudentName = student.studentName.trim().replace(/[^a-zA-Z0-9]/g, '_');
  const cleanRegNo = student.registerNumber.trim().replace(/[^a-zA-Z0-9]/g, '_');
  const baseFileName = `Attendance_${cleanStudentName}_${cleanRegNo}`;
  const pdfFileName = `${baseFileName}.pdf`;
  const pngFileName = `${baseFileName}.png`;

  // Calculated detailed status breakdown
  const presentDays = history.filter(h => h.status === 'Present').length;
  const absentDays = history.filter(h => h.status === 'Absent').length;
  const odDays = history.filter(h => h.status === 'On Duty (OD)' || h.status === 'On Duty').length;
  const mlDays = history.filter(h => h.status === 'Medical Leave (ML)' || h.status === 'Medical Leave').length;
  const laDays = history.filter(h => h.status === 'Long Absent').length;
  const totalWorkingDays = stats.totalDays ?? stats.totalClasses ?? history.length;
  const dateGenerated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // -------------------------------------------------------------
  // 1. GENERATE CLEAN A4 PDF
  // -------------------------------------------------------------
  const generatePDFBlob = (): { doc: jsPDF; blob: Blob } => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

    // Header Background Banner (Slate 900)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Accent line (Indigo 500)
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    // College Logo & Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(collegeName.toUpperCase(), 14, 13);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(199, 210, 254);
    doc.text('OFFICIAL STUDENT ATTENDANCE HISTORY REPORT', 14, 20);

    // Date Generated (Top-Right)
    doc.setFontSize(9);
    doc.setTextColor(226, 232, 240);
    doc.text(`Date Generated: ${dateGenerated}`, pageWidth - 14, 15, { align: 'right' });
    doc.text('Status: Strictly Read-Only', pageWidth - 14, 21, { align: 'right' });

    // Student Info Card (Light slate box)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 34, pageWidth - 28, 24, 2, 2, 'FD');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(student.studentName, 18, 42);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Register No: ${student.registerNumber}`, 18, 48);
    doc.text(`Department: ${student.department} ${student.year ? `(${student.year} Year${student.section ? ` - Sec ${student.section}` : ''})` : ''}`, 18, 53);

    // Attendance Percentage Highlight Box (Top-Right of Info Card)
    const pctColor: [number, number, number] = stats.percentage >= 75 ? [16, 185, 129] : [244, 63, 94];
    doc.setFillColor(pctColor[0], pctColor[1], pctColor[2]);
    doc.roundedRect(pageWidth - 62, 38, 44, 16, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('ATTENDANCE %', pageWidth - 40, 43, { align: 'center' });
    doc.setFontSize(13);
    doc.text(`${stats.percentage}%`, pageWidth - 40, 50, { align: 'center' });

    // Summary Statistics Table / Metrics Block
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('ATTENDANCE SUMMARY BREAKDOWN', 14, 64);

    const summaryHeaders = [['Total Working Days', 'Present Days', 'Absent Days', 'OD Days', 'Medical Leave', 'Long Absent', 'Overall %']];
    const summaryRows = [[
      String(totalWorkingDays),
      String(presentDays),
      String(absentDays),
      String(odDays),
      String(mlDays),
      String(laDays),
      `${stats.percentage}%`
    ]];

    autoTable(doc, {
      startY: 67,
      head: summaryHeaders,
      body: summaryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229], // Indigo 600
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
        textColor: [30, 41, 59],
      },
      styles: {
        cellPadding: 2.5,
      },
    });

    // Complete Attendance History Table
    const summaryTableFinalY = (doc as any).lastAutoTable.previous.finalY || 80;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('COMPLETE ATTENDANCE HISTORY LOG', 14, summaryTableFinalY + 8);

    const historyHeaders = [['#', 'Date', 'Subject', 'Period', 'Attendance Status']];
    const historyRows = history.map((item, index) => [
      String(index + 1),
      item.date,
      item.subject || 'General Class',
      item.period ? `Period ${item.period}` : 'P1',
      item.status,
    ]);

    autoTable(doc, {
      startY: summaryTableFinalY + 11,
      head: historyHeaders,
      body: historyRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 32 },
        2: { cellWidth: 65 },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 50, fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = String(data.cell.raw);
          if (val === 'Present') {
            data.cell.styles.textColor = [5, 150, 105]; // Emerald
          } else if (val === 'Absent') {
            data.cell.styles.textColor = [225, 29, 72]; // Rose
          } else if (val.includes('Duty') || val.includes('OD')) {
            data.cell.styles.textColor = [2, 132, 199]; // Sky
          } else if (val.includes('Medical') || val.includes('ML')) {
            data.cell.styles.textColor = [147, 51, 234]; // Purple
          } else if (val === 'Long Absent') {
            data.cell.styles.textColor = [100, 116, 139]; // Slate
          }
        }
      },
      didDrawPage: (data) => {
        // Footer on every page
        const currentPage = doc.internal.pages.length - 1;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${data.pageNumber} • ${collegeName} • Official System Record`,
          14,
          pageHeight - 8
        );
        doc.text(
          'Read-Only Document',
          pageWidth - 14,
          pageHeight - 8,
          { align: 'right' }
        );
      },
    });

    const blob = doc.output('blob');
    return { doc, blob };
  };

  const handleDownloadPDF = async () => {
    setGeneratingPdf(true);
    try {
      const { doc } = generatePDFBlob();
      doc.save(pdfFileName);
      setStatusMsg('PDF downloaded successfully!');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      setStatusMsg('Error generating PDF report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // -------------------------------------------------------------
  // 2. GENERATE CLEAN A4 IMAGE (PNG)
  // -------------------------------------------------------------
  const generatePNGBlob = async (): Promise<{ dataUrl: string; blob: Blob }> => {
    if (!reportPreviewRef.current) {
      throw new Error('Preview element not ready');
    }

    const canvas = await html2canvas(reportPreviewRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0f172a',
      logging: false,
    } as any);

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject('Failed canvas blob')), 'image/png');
    });

    return { dataUrl, blob };
  };

  const handleDownloadImage = async () => {
    setGeneratingImg(true);
    try {
      const { dataUrl } = await generatePNGBlob();
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = pngFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatusMsg('Image (PNG) downloaded successfully!');
    } catch (err) {
      console.error('Failed to generate image:', err);
      setStatusMsg('Error generating image.');
    } finally {
      setGeneratingImg(false);
    }
  };

  // -------------------------------------------------------------
  // 3. PRINT REPORT
  // -------------------------------------------------------------
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the attendance report.');
      return;
    }

    const rowsHtml = history.map((item, idx) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${item.date}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${item.subject || 'General Class'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #6366f1;">P${item.period || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; ${
          item.status === 'Present' ? 'color: #059669;' :
          item.status === 'Absent' ? 'color: #e11d48;' :
          item.status.includes('Duty') || item.status.includes('OD') ? 'color: #0284c7;' :
          item.status.includes('Medical') || item.status.includes('ML') ? 'color: #9333ea;' : 'color: #64748b;'
        }">${item.status}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${pdfFileName}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 24px; color: #1e293b; }
            .header { background: #0f172a; color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
            .header p { margin: 4px 0 0 0; font-size: 11px; color: #c7d2fe; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .info h2 { margin: 0 0 4px 0; font-size: 16px; color: #0f172a; }
            .info p { margin: 2px 0; font-size: 12px; color: #475569; }
            .badge { background: ${stats.percentage >= 75 ? '#10b981' : '#f43f5e'}; color: white; padding: 8px 16px; border-radius: 8px; text-align: center; }
            .badge span { display: block; font-size: 9px; font-weight: bold; }
            .badge strong { font-size: 18px; }
            .metrics { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 20px; text-align: center; }
            .metric-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 4px; }
            .metric-box span { display: block; font-size: 9px; color: #64748b; font-weight: bold; text-transform: uppercase; }
            .metric-box strong { display: block; font-size: 14px; color: #0f172a; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #1e293b; color: white; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
            .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
            @media print {
              body { padding: 0; }
              @page { size: A4; margin: 15mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${collegeName}</h1>
              <p>OFFICIAL STUDENT ATTENDANCE HISTORY REPORT</p>
            </div>
            <div style="text-align: right; font-size: 11px;">
              <div>Date Generated: ${dateGenerated}</div>
              <div style="font-weight: bold; color: #38bdf8;">Strictly Read-Only</div>
            </div>
          </div>

          <div class="card">
            <div class="info">
              <h2>${student.studentName}</h2>
              <p>Register Number: <strong>${student.registerNumber}</strong></p>
              <p>Department: ${student.department} ${student.year ? `(${student.year} Year${student.section ? ` - Sec ${student.section}` : ''})` : ''}</p>
            </div>
            <div class="badge">
              <span>ATTENDANCE</span>
              <strong>${stats.percentage}%</strong>
            </div>
          </div>

          <div class="metrics">
            <div class="metric-box"><span>Working Days</span><strong>${totalWorkingDays}</strong></div>
            <div class="metric-box"><span>Present</span><strong style="color:#059669;">${presentDays}</strong></div>
            <div class="metric-box"><span>Absent</span><strong style="color:#e11d48;">${absentDays}</strong></div>
            <div class="metric-box"><span>OD Days</span><strong style="color:#0284c7;">${odDays}</strong></div>
            <div class="metric-box"><span>ML Days</span><strong style="color:#9333ea;">${mlDays}</strong></div>
            <div class="metric-box"><span>Long Absent</span><strong style="color:#64748b;">${laDays}</strong></div>
            <div class="metric-box"><span>Percentage</span><strong style="color:#6366f1;">${stats.percentage}%</strong></div>
          </div>

          <h3 style="font-size: 14px; margin-bottom: 8px;">Complete Attendance History</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th style="width: 100px;">Date</th>
                <th>Subject</th>
                <th style="width: 60px; text-align: center;">Period</th>
                <th style="width: 120px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <span>${collegeName} • Official System Record</span>
            <span>Read-Only Attendance History</span>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // -------------------------------------------------------------
  // 4. COPY TEXT SUMMARY TO CLIPBOARD
  // -------------------------------------------------------------
  const handleCopySummary = async () => {
    const summaryText = `🎓 ${collegeName.toUpperCase()}
OFFICIAL STUDENT ATTENDANCE SUMMARY
--------------------------------------------------
Student Name   : ${student.studentName}
Register No    : ${student.registerNumber}
Department     : ${student.department} ${student.year ? `(${student.year} Year - Sec ${student.section || 'A'})` : ''}
Date Generated : ${dateGenerated}

📊 ATTENDANCE BREAKDOWN:
• Total Working Days : ${totalWorkingDays}
• Present Days       : ${presentDays}
• Absent Days        : ${absentDays}
• On Duty (OD)       : ${odDays}
• Medical Leave (ML) : ${mlDays}
• Long Absent        : ${laDays}
⭐ Attendance %      : ${stats.percentage}%

📅 COMPLETE HISTORY LOG (${history.length} Entries):
${history.map((h, i) => `${i + 1}. ${h.date} | P${h.period || 1} (${h.subject || 'Class'}) | ${h.status}`).join('\n')}
--------------------------------------------------
Status: Strictly Read-Only Record`;

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setStatusMsg('Summary copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setStatusMsg('Failed to copy to clipboard.');
    }
  };

  // -------------------------------------------------------------
  // 5. MOBILE WEB SHARE API INTEGRATION
  // -------------------------------------------------------------
  const handleMobileShare = async () => {
    setSharingMobile(true);
    setStatusMsg(null);

    try {
      const { blob: pdfBlob } = generatePDFBlob();
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

      // Check if Web Share API and file sharing are supported
      if (typeof navigator !== 'undefined' && navigator.share) {
        const shareData: ShareData = {
          title: `Attendance Report - ${student.studentName}`,
          text: `Attendance Report for ${student.studentName} (${student.registerNumber}) - Overall ${stats.percentage}%`,
        };

        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          shareData.files = [pdfFile];
        }

        await navigator.share(shareData);
        setStatusMsg('Shared successfully!');
      } else {
        // Fallback: Trigger PDF download and provide manual share link
        handleDownloadPDF();
        const whatsappText = encodeURIComponent(
          `🎓 Attendance Report for *${student.studentName}* (${student.registerNumber})\nDepartment: ${student.department}\nOverall Attendance: *${stats.percentage}%*\nTotal Working Days: ${totalWorkingDays} | Present: ${presentDays} | Absent: ${absentDays}`
        );
        window.open(`https://api.whatsapp.com/send?text=${whatsappText}`, '_blank');
      }
    } catch (err: any) {
      // Abort error is common when user cancels native share dialog
      if (err?.name !== 'AbortError') {
        console.error('Mobile share failed:', err);
        handleDownloadPDF();
      }
    } finally {
      setSharingMobile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Share Attendance Report
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Read-Only
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {student.studentName} ({student.registerNumber}) &bull; {student.department}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Action Bar & Buttons */}
        <div className="p-6 bg-slate-900 border-b border-slate-800 shrink-0 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Share / Download PDF */}
            <button
              onClick={handleDownloadPDF}
              disabled={generatingPdf}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
            >
              {generatingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Share as PDF</span>
            </button>

            {/* Share / Download Image PNG */}
            <button
              onClick={handleDownloadImage}
              disabled={generatingImg}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-purple-600/20 cursor-pointer disabled:opacity-50"
            >
              {generatingImg ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
              <span>Share as Image</span>
            </button>

            {/* Print Report */}
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs transition-all border border-slate-700 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-indigo-400" />
              <span>Print</span>
            </button>

            {/* Copy Summary */}
            <button
              onClick={handleCopySummary}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs transition-all border border-slate-700 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>
          </div>

          {/* Mobile Web Share API Trigger Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              onClick={handleMobileShare}
              disabled={sharingMobile}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              {sharingMobile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Share via Apps (WhatsApp / Gmail / Telegram)</span>
            </button>

            {statusMsg && (
              <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">
                {statusMsg}
              </span>
            )}
          </div>
        </div>

        {/* Live A4 Document Preview Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 custom-scrollbar space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider">Report Document Live Preview (A4 Format)</span>
            <span>Generated on {dateGenerated}</span>
          </div>

          {/* Styled A4 Document Container */}
          <div
            ref={reportPreviewRef}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-slate-100 font-sans"
          >
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-white uppercase">{collegeName}</h2>
                  <p className="text-xs text-indigo-400 font-semibold tracking-wide mt-0.5">
                    OFFICIAL STUDENT ATTENDANCE HISTORY REPORT
                  </p>
                </div>
              </div>

              <div className="text-right text-xs space-y-1">
                <div className="text-slate-400">Date Generated: <span className="font-mono text-slate-200">{dateGenerated}</span></div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[10px]">
                  Strictly Read-Only
                </div>
              </div>
            </div>

            {/* Student Info Card */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">{student.studentName}</h3>
                <div className="mt-1 text-xs text-slate-400 space-y-0.5">
                  <p><span className="text-slate-500">Register Number:</span> <span className="font-mono text-indigo-300 font-semibold">{student.registerNumber}</span></p>
                  <p><span className="text-slate-500">Department:</span> <span className="text-slate-200">{student.department} {student.year ? `(${student.year} Year${student.section ? ` - Sec ${student.section}` : ''})` : ''}</span></p>
                  {student.email && <p><span className="text-slate-500">Email:</span> <span className="text-slate-300">{student.email}</span></p>}
                </div>
              </div>

              {/* Overall Percentage Badge */}
              <div className={`px-5 py-3 rounded-2xl border text-center shrink-0 ${
                stats.percentage >= 75
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider block">Attendance %</span>
                <span className="text-2xl font-extrabold tracking-tight">{stats.percentage}%</span>
              </div>
            </div>

            {/* Summary Metrics Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Attendance Summary Breakdown</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-center text-xs">
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Working Days</span>
                  <span className="text-base font-extrabold text-white mt-1 block">{totalWorkingDays}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="block text-[10px] text-emerald-400 font-bold uppercase">Present</span>
                  <span className="text-base font-extrabold text-emerald-300 mt-1 block">{presentDays}</span>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <span className="block text-[10px] text-rose-400 font-bold uppercase">Absent</span>
                  <span className="text-base font-extrabold text-rose-300 mt-1 block">{absentDays}</span>
                </div>
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                  <span className="block text-[10px] text-sky-400 font-bold uppercase">OD Days</span>
                  <span className="text-base font-extrabold text-sky-300 mt-1 block">{odDays}</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="block text-[10px] text-purple-400 font-bold uppercase">ML Days</span>
                  <span className="text-base font-extrabold text-purple-300 mt-1 block">{mlDays}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Long Absent</span>
                  <span className="text-base font-extrabold text-slate-300 mt-1 block">{laDays}</span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <span className="block text-[10px] text-indigo-400 font-bold uppercase">Overall %</span>
                  <span className="text-base font-extrabold text-indigo-300 mt-1 block">{stats.percentage}%</span>
                </div>
              </div>
            </div>

            {/* Attendance History Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <h4 className="font-bold uppercase tracking-wider text-slate-400">Complete Attendance History Table</h4>
                <span className="text-slate-500 font-mono">{history.length} records</span>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                    <tr>
                      <th className="px-4 py-3 text-center w-10">#</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3 text-center">Period</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                          No attendance records logged yet.
                        </td>
                      </tr>
                    ) : (
                      history.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-200 font-semibold">{item.date}</td>
                          <td className="px-4 py-2.5 font-semibold text-white">{item.subject || 'General Class'}</td>
                          <td className="px-4 py-2.5 text-center font-mono text-indigo-400 font-bold">P{item.period || 1}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-block ${
                              item.status === 'Present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              item.status === 'Absent' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              item.status.includes('Duty') || item.status.includes('OD') ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                              item.status.includes('Medical') || item.status.includes('ML') ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
              <span>{collegeName} &bull; Official Student Attendance Record</span>
              <span className="font-mono">Strictly Read-Only &bull; Page 1 of 1</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

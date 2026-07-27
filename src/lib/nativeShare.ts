import html2canvas from 'html2canvas';

export interface NativeShareParams {
  student: {
    studentName: string;
    registerNumber: string;
    department: string;
    year?: string;
    section?: string;
    email?: string;
  };
  stats: {
    percentage: number;
    attended: number;
    totalClasses: number;
    absent: number;
    daysPresent?: number;
    daysAbsent?: number;
    totalDays?: number;
  };
  history: Array<{
    id: number | string;
    date: string;
    period?: number;
    subject?: string;
    status: string;
  }>;
  collegeName?: string;
}

export interface SessionDateShareParams {
  session: {
    id?: string;
    date: string;
    subject: string;
    period: number;
    totalStudents: number;
    present: number;
    absent: number;
    od: number;
    ml: number;
    la: number;
    savedAt?: string;
    savedBy?: string;
  };
  studentDetails: Array<{
    id: number;
    studentName: string;
    registerNumber: string;
    status: string;
  }>;
  collegeName?: string;
}

export async function triggerSessionDateShare({
  session,
  studentDetails,
  collegeName = 'College Attendance Portal',
}: SessionDateShareParams) {
  const cleanDate = session.date.trim().replace(/[^a-zA-Z0-9]/g, '_');
  const pngFileName = `Attendance_Session_${cleanDate}_P${session.period}.png`;

  // Construct structured text summary for selected date session
  const summaryText = `🎓 ${collegeName.toUpperCase()}
DAILY ATTENDANCE SESSION REPORT
--------------------------------------------------
Date        : ${session.date}
Subject     : ${session.subject}
Period      : Period ${session.period}
Saved At    : ${session.savedAt || 'N/A'} (By ${session.savedBy || 'Class Rep'})

📊 SESSION SUMMARY:
• Total Students  : ${session.totalStudents}
• Present         : ${session.present}
• Absent          : ${session.absent}
• On Duty (OD)    : ${session.od}
• Medical Leave   : ${session.ml}
• Long Absent     : ${session.la}

📋 FULL STUDENT ATTENDANCE LIST (${studentDetails.length} Students):
${studentDetails.map((st, idx) => `${idx + 1}. [${st.registerNumber}] ${st.studentName} - ${st.status}`).join('\n')}
--------------------------------------------------
Status: Strictly Read-Only Record`;

  // Generate PNG image of the selected date session in background
  let imageFile: File | null = null;
  try {
    const offscreenContainer = document.createElement('div');
    offscreenContainer.style.position = 'fixed';
    offscreenContainer.style.left = '-9999px';
    offscreenContainer.style.top = '-9999px';
    offscreenContainer.style.width = '800px';
    offscreenContainer.style.backgroundColor = '#0f172a';
    offscreenContainer.style.color = '#f8fafc';
    offscreenContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    offscreenContainer.style.padding = '32px';
    offscreenContainer.style.borderRadius = '24px';
    offscreenContainer.style.border = '1px solid #1e293b';

    const rowsHtml = studentDetails
      .map(
        (st, idx) => `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 8px 12px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px 12px; font-weight: 700; color: #ffffff;">${st.studentName}</td>
        <td style="padding: 8px 12px; font-family: monospace; color: #a5b4fc;">${st.registerNumber}</td>
        <td style="padding: 8px 12px; text-align: right;">
          <span style="padding: 4px 10px; border-radius: 9999px; font-size: 10px; font-weight: 800; display: inline-block; ${
            st.status === 'Present'
              ? 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);'
              : st.status === 'Absent'
              ? 'background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3);'
              : st.status === 'On Duty (OD)'
              ? 'background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);'
              : st.status === 'Medical Leave (ML)'
              ? 'background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);'
              : 'background: rgba(113, 113, 122, 0.15); color: #a1a1aa; border: 1px solid rgba(113, 113, 122, 0.3);'
          }">${st.status}</span>
        </td>
      </tr>
    `
      )
      .join('');

    offscreenContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #ffffff; letter-spacing: 0.5px;">${collegeName}</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 600; color: #818cf8;">DAILY ATTENDANCE SESSION REPORT</p>
        </div>
        <div style="text-align: right; font-size: 11px; color: #94a3b8;">
          <div>Date: <strong style="color: #ffffff;">${session.date}</strong></div>
          <div style="color: #34d399; font-weight: bold; margin-top: 2px;">Saved by ${session.savedBy || 'Class Rep'}</div>
        </div>
      </div>

      <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-radius: 16px; padding: 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #ffffff;">${session.subject}</h2>
          <p style="margin: 0; font-size: 12px; color: #818cf8; font-weight: 600;">Period ${session.period} &bull; Date: ${session.date}</p>
        </div>
        <div style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); color: #a5b4fc; padding: 10px 18px; border-radius: 14px; text-align: center;">
          <span style="display: block; font-size: 10px; font-weight: 800; text-transform: uppercase;">Total Students</span>
          <strong style="font-size: 20px; font-weight: 800;">${session.totalStudents}</strong>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px; text-align: center; font-size: 11px;">
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 10px; border-radius: 10px;"><span style="color: #34d399; font-weight: 700;">Present</span><strong style="display: block; font-size: 15px; color: #34d399; margin-top: 2px;">${session.present}</strong></div>
        <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); padding: 10px; border-radius: 10px;"><span style="color: #fb7185; font-weight: 700;">Absent</span><strong style="display: block; font-size: 15px; color: #fb7185; margin-top: 2px;">${session.absent}</strong></div>
        <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 10px; border-radius: 10px;"><span style="color: #60a5fa; font-weight: 700;">OD</span><strong style="display: block; font-size: 15px; color: #60a5fa; margin-top: 2px;">${session.od}</strong></div>
        <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.2); padding: 10px; border-radius: 10px;"><span style="color: #c084fc; font-weight: 700;">ML</span><strong style="display: block; font-size: 15px; color: #c084fc; margin-top: 2px;">${session.ml}</strong></div>
        <div style="background: rgba(113, 113, 122, 0.1); border: 1px solid rgba(113, 113, 122, 0.2); padding: 10px; border-radius: 10px;"><span style="color: #a1a1aa; font-weight: 700;">Long Absent</span><strong style="display: block; font-size: 15px; color: #a1a1aa; margin-top: 2px;">${session.la}</strong></div>
      </div>

      <h3 style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin: 0 0 10px 0;">Student List for ${session.date}</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #020617; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 10px; text-transform: uppercase;">
            <th style="padding: 8px 12px; width: 30px; text-align: center;">#</th>
            <th style="padding: 8px 12px; text-align: left;">Student Name</th>
            <th style="padding: 8px 12px; text-align: left;">Register No</th>
            <th style="padding: 8px 12px; text-align: right;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; display: flex; justify-content: space-between;">
        <span>${collegeName} • Date Session Record</span>
        <span>Strictly Read-Only</span>
      </div>
    `;

    document.body.appendChild(offscreenContainer);

    const canvas = await html2canvas(offscreenContainer, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0f172a',
      logging: false,
    } as any);

    document.body.removeChild(offscreenContainer);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject('Blob error')), 'image/png');
    });

    imageFile = new File([blob], pngFileName, { type: 'image/png' });
  } catch (err) {
    console.warn('Offscreen session image generation skipped:', err);
  }

  // Trigger Native Web Share Sheet
  if (typeof navigator !== 'undefined' && navigator.share) {
    const shareData: ShareData = {
      title: `Attendance Report - ${session.date} (${session.subject})`,
      text: summaryText,
    };

    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      shareData.files = [imageFile];
    }

    try {
      await navigator.share(shareData);
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.warn('Native session file share fallback to text:', err);
      try {
        await navigator.share({
          title: `Attendance Report - ${session.date}`,
          text: summaryText,
        });
        return;
      } catch (textErr: any) {
        if (textErr?.name === 'AbortError') return;
      }
    }
  }

  // Clipboard fallback for desktop without Web Share API
  try {
    await navigator.clipboard.writeText(summaryText);
    alert(`Attendance details for ${session.date} copied to clipboard! You can paste and share it in WhatsApp, Gmail, etc.`);
  } catch (clipErr) {
    console.error('Clipboard error:', clipErr);
  }
}

export async function triggerNativeShare({
  student,
  stats,
  history,
  collegeName = 'College Attendance Portal',
}: NativeShareParams) {
  const cleanStudentName = student.studentName.trim().replace(/[^a-zA-Z0-9]/g, '_');
  const cleanRegNo = student.registerNumber.trim().replace(/[^a-zA-Z0-9]/g, '_');
  const pngFileName = `Attendance_${cleanStudentName}_${cleanRegNo}.png`;

  const totalWorkingDays = stats.totalDays ?? stats.totalClasses ?? history.length;
  const presentDays = history.filter((h) => h.status === 'Present').length;
  const absentDays = history.filter((h) => h.status === 'Absent').length;
  const dateGenerated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Construct structured text summary
  const summaryText = `🎓 ${collegeName.toUpperCase()}
OFFICIAL STUDENT ATTENDANCE REPORT
--------------------------------------------------
Student Name   : ${student.studentName}
Register No    : ${student.registerNumber}
Department     : ${student.department} ${student.year ? `(${student.year} Year - Sec ${student.section || 'A'})` : ''}
Date Generated : ${dateGenerated}

📊 SUMMARY STATISTICS:
• Total Working Days : ${totalWorkingDays}
• Present Days       : ${presentDays}
• Absent Days        : ${absentDays}
⭐ Attendance %      : ${stats.percentage}%

📅 ATTENDANCE HISTORY LOG (${history.length} Entries):
${history.map((h, i) => `${i + 1}. ${h.date} | P${h.period || 1} (${h.subject || 'Class'}) | ${h.status}`).join('\n')}
--------------------------------------------------
Status: Strictly Read-Only Record`;

  // Generate PNG image in background (offscreen container)
  let imageFile: File | null = null;
  try {
    const offscreenContainer = document.createElement('div');
    offscreenContainer.style.position = 'fixed';
    offscreenContainer.style.left = '-9999px';
    offscreenContainer.style.top = '-9999px';
    offscreenContainer.style.width = '800px';
    offscreenContainer.style.backgroundColor = '#0f172a';
    offscreenContainer.style.color = '#f8fafc';
    offscreenContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    offscreenContainer.style.padding = '32px';
    offscreenContainer.style.borderRadius = '24px';
    offscreenContainer.style.border = '1px solid #1e293b';

    const historyRowsHtml = history
      .map(
        (h, i) => `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 8px 12px; text-align: center; color: #64748b;">${i + 1}</td>
        <td style="padding: 8px 12px; font-family: monospace; font-weight: 600; color: #e2e8f0;">${h.date}</td>
        <td style="padding: 8px 12px; font-weight: 600; color: #ffffff;">${h.subject || 'General Class'}</td>
        <td style="padding: 8px 12px; text-align: center; font-family: monospace; font-weight: bold; color: #818cf8;">P${h.period || 1}</td>
        <td style="padding: 8px 12px; text-align: right;">
          <span style="padding: 4px 10px; border-radius: 9999px; font-size: 10px; font-weight: 800; display: inline-block; ${
            h.status === 'Present'
              ? 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);'
              : h.status === 'Absent'
              ? 'background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3);'
              : 'background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.3);'
          }">${h.status}</span>
        </td>
      </tr>
    `
      )
      .join('');

    offscreenContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #ffffff; letter-spacing: 0.5px;">${collegeName}</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 600; color: #818cf8;">OFFICIAL STUDENT ATTENDANCE REPORT</p>
        </div>
        <div style="text-align: right; font-size: 11px; color: #94a3b8;">
          <div>Date Generated: ${dateGenerated}</div>
          <div style="color: #34d399; font-weight: bold; margin-top: 2px;">Strictly Read-Only</div>
        </div>
      </div>

      <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-radius: 16px; padding: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 700; color: #ffffff;">${student.studentName}</h2>
          <p style="margin: 2px 0; font-size: 12px; color: #94a3b8;">Register Number: <strong style="color: #a5b4fc; font-family: monospace;">${student.registerNumber}</strong></p>
          <p style="margin: 2px 0; font-size: 12px; color: #94a3b8;">Department: <strong style="color: #e2e8f0;">${student.department} ${student.year ? `(${student.year} Year${student.section ? ` - Sec ${student.section}` : ''})` : ''}</strong></p>
        </div>
        <div style="background: ${stats.percentage >= 75 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)'}; border: 1px solid ${stats.percentage >= 75 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}; color: ${stats.percentage >= 75 ? '#34d399' : '#fb7185'}; padding: 12px 20px; border-radius: 16px; text-align: center;">
          <span style="display: block; font-size: 10px; font-weight: 800; text-transform: uppercase;">Attendance %</span>
          <strong style="font-size: 24px; font-weight: 800;">${stats.percentage}%</strong>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; text-align: center; font-size: 12px;">
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #1e293b; padding: 12px; border-radius: 12px;"><span style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase;">Total Working Days</span><strong style="display: block; font-size: 16px; color: #ffffff; margin-top: 4px;">${totalWorkingDays}</strong></div>
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 12px; border-radius: 12px;"><span style="color: #34d399; font-size: 10px; font-weight: 700; text-transform: uppercase;">Present Days</span><strong style="display: block; font-size: 16px; color: #34d399; margin-top: 4px;">${presentDays}</strong></div>
        <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); padding: 12px; border-radius: 12px;"><span style="color: #fb7185; font-size: 10px; font-weight: 700; text-transform: uppercase;">Absent Days</span><strong style="display: block; font-size: 16px; color: #fb7185; margin-top: 4px;">${absentDays}</strong></div>
        <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); padding: 12px; border-radius: 12px;"><span style="color: #818cf8; font-size: 10px; font-weight: 700; text-transform: uppercase;">Attendance %</span><strong style="display: block; font-size: 16px; color: #818cf8; margin-top: 4px;">${stats.percentage}%</strong></div>
      </div>

      <h3 style="font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin: 0 0 10px 0;">Complete Attendance History</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #020617; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 10px; text-transform: uppercase;">
            <th style="padding: 8px 12px; width: 30px; text-align: center;">#</th>
            <th style="padding: 8px 12px; text-align: left;">Date</th>
            <th style="padding: 8px 12px; text-align: left;">Subject</th>
            <th style="padding: 8px 12px; text-align: center;">Period</th>
            <th style="padding: 8px 12px; text-align: right;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${historyRowsHtml}
        </tbody>
      </table>

      <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; display: flex; justify-content: space-between;">
        <span>${collegeName} • Official Record</span>
        <span>Strictly Read-Only</span>
      </div>
    `;

    document.body.appendChild(offscreenContainer);

    const canvas = await html2canvas(offscreenContainer, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0f172a',
      logging: false,
    } as any);

    document.body.removeChild(offscreenContainer);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject('Blob error')), 'image/png');
    });

    imageFile = new File([blob], pngFileName, { type: 'image/png' });
  } catch (err) {
    console.warn('Offscreen image generation skipped:', err);
  }

  // Trigger Native Web Share Sheet (1-Click)
  if (typeof navigator !== 'undefined' && navigator.share) {
    const shareData: ShareData = {
      title: `Attendance Report - ${student.studentName}`,
      text: summaryText,
    };

    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      shareData.files = [imageFile];
    }

    try {
      await navigator.share(shareData);
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // User cancelled share sheet
      console.warn('Native file share fallback to text share:', err);
      try {
        await navigator.share({
          title: `Attendance Report - ${student.studentName}`,
          text: summaryText,
        });
        return;
      } catch (textErr: any) {
        if (textErr?.name === 'AbortError') return;
      }
    }
  }

  // Final Desktop fallback if navigator.share is unsupported: copy summary to clipboard
  try {
    await navigator.clipboard.writeText(summaryText);
    alert('Attendance summary copied to clipboard! You can paste and share it directly in WhatsApp, Gmail, or any app.');
  } catch (clipErr) {
    console.error('Clipboard copy fallback error:', clipErr);
  }
}

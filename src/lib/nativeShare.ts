import html2canvas from 'html2canvas';

export interface ShareElementParams {
  element: HTMLElement;
  date: string;
  subject: string;
  period: number;
  present: number;
  absent: number;
  od: number;
  ml: number;
  la: number;
  totalStudents: number;
  studentDetails: Array<{
    id?: number;
    studentName: string;
    registerNumber: string;
    status: string;
  }>;
}

export async function shareDetailsElement({
  element,
  date,
  subject,
  period,
  present,
  absent,
  od,
  ml,
  la,
  totalStudents,
  studentDetails,
}: ShareElementParams) {
  const cleanDate = date.trim().replace(/[^a-zA-Z0-9]/g, '_');
  const pngFileName = `Attendance_Report_${cleanDate}_P${period}.png`;

  // 1. Construct formatted text summary matching visible section
  const summaryText = `🎓 COLLEGE ATTENDANCE PORTAL
ATTENDANCE REPORT — ${date}
--------------------------------------------------
Date        : ${date}
Subject     : ${subject}
Period      : Period ${period}

📊 SESSION SUMMARY:
• Present         : ${present}
• Absent          : ${absent}
• On Duty (OD)    : ${od}
• Medical Leave   : ${ml}
• Long Absent     : ${la}
• Total Students  : ${totalStudents}

📋 STUDENT ATTENDANCE LIST (${studentDetails.length} Students):
${studentDetails.map((st, i) => `${i + 1}. [${st.registerNumber}] ${st.studentName} — ${st.status}`).join('\n')}
--------------------------------------------------
Status: Strictly Read-Only Attendance Record`;

  // 2. Capture clean PNG image of ONLY the currently expanded Show Details section
  let imageFile: File | null = null;
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: document.documentElement.classList.contains('light') ? '#ffffff' : '#0f172a',
      logging: false,
    } as any);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });

    if (blob) {
      imageFile = new File([blob], pngFileName, { type: 'image/png' });
    }
  } catch (err) {
    console.warn('Canvas image capture fallback to text share:', err);
  }

  // 3. Web Share API Execution
  if (typeof navigator !== 'undefined' && navigator.share) {
    // Attempt A: File Share via Web Share API if supported
    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      try {
        await navigator.share({
          title: `Attendance Report - ${date}`,
          text: summaryText,
          files: [imageFile],
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // User cancelled share sheet
        console.warn('File Web Share failed, falling back to text-only Web Share:', err);
      }
    }

    // Attempt B: Text-only Web Share API
    try {
      await navigator.share({
        title: `Attendance Report - ${date}`,
        text: summaryText,
      });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // User cancelled share sheet
      console.warn('Text Web Share failed, falling back to WhatsApp URL:', err);
    }
  }

  // 4. WhatsApp Fallback (Valid text-only URL format: https://wa.me/?text=<encoded_text>)
  try {
    const validWaUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(validWaUrl, '_blank');
    return;
  } catch (err) {
    console.warn('WhatsApp link fallback failed, attempting clipboard copy:', err);
  }

  // 5. Final Clipboard Fallback
  try {
    await navigator.clipboard.writeText(summaryText);
    alert(`Attendance report for ${date} copied to clipboard! You can paste and send it on WhatsApp.`);
  } catch (clipErr) {
    console.error('Clipboard copy failed:', clipErr);
  }
}

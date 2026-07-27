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

/**
 * Captures ONLY a status detail card element as a clean PNG image
 * and shares ONLY the image via Web Share API or triggers direct image download.
 * Does NOT share text, does NOT generate PDF, does NOT use print, does NOT capture the whole page.
 */
export async function shareStatusCardAsImage(element: HTMLElement, fileName: string) {
  const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
  
  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: isLight ? '#ffffff' : '#0f172a',
    logging: false,
  } as any);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });

  if (!blob) {
    throw new Error('Failed to generate image canvas');
  }

  const imageFile = new File([blob], fileName, { type: 'image/png' });

  // 1. Share ONLY as image using Web Share API
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [imageFile] })
  ) {
    try {
      await navigator.share({
        files: [imageFile],
      });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // User cancelled share sheet
      console.warn('Native image file share failed, falling back to image download:', err);
    }
  }

  // 2. Direct PNG Download Fallback for browsers without native file sharing
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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
    console.warn('Canvas image capture fallback:', err);
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      try {
        await navigator.share({
          title: `Attendance Report - ${date}`,
          text: summaryText,
          files: [imageFile],
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.share({
        title: `Attendance Report - ${date}`,
        text: summaryText,
      });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }
  }

  try {
    const validWaUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(validWaUrl, '_blank');
    return;
  } catch (err) {
    console.warn('WhatsApp link fallback failed:', err);
  }
}

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

  // 2. Capture clean PNG image of ONLY the currently visible Show Details section
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

  // 3. Directly open WhatsApp / Native Share sheet without any options modal
  // Attempt A: Native share sheet with Image File + Text (Supported on Mobile Browsers & Windows with WhatsApp)
  if (typeof navigator !== 'undefined' && navigator.share) {
    const shareData: ShareData = {
      title: `Attendance Report - ${date}`,
      text: summaryText,
    };

    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      shareData.files = [imageFile];
    }

    try {
      await navigator.share(shareData);
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // User canceled share
      console.warn('Native share error, falling back to WhatsApp deep link:', err);
    }
  }

  // Attempt B: WhatsApp direct URI scheme launch
  try {
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(summaryText)}`;
    const webWhatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
    
    // Check if on mobile or try opening deep link
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = whatsappUrl;
      return;
    } else {
      window.open(webWhatsappUrl, '_blank');
      return;
    }
  } catch (err) {
    console.warn('WhatsApp deep link failed, copying text to clipboard:', err);
  }

  // Attempt C: Clipboard fallback for desktop without native share or WhatsApp app protocol
  try {
    await navigator.clipboard.writeText(summaryText);
    alert(`Attendance report for ${date} copied to clipboard! You can now paste and send it directly on WhatsApp.`);
  } catch (clipErr) {
    console.error('Clipboard copy failed:', clipErr);
  }
}

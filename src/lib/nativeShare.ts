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
 * Log errors to console and handle failures gracefully.
 */
export async function shareStatusCardAsImage(element: HTMLElement, fileName: string): Promise<boolean> {
  const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');

  console.log('[Share] Starting html2canvas capture for element:', element);

  let canvas: HTMLCanvasElement;
  try {
    const html2canvasPromise = html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: isLight ? '#ffffff' : '#0f172a',
      logging: false,
      onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
        // 1. Hide share buttons in cloned element so they don't appear in the captured image
        const buttons = clonedElement.querySelectorAll('button');
        buttons.forEach((btn) => {
          if (btn.textContent?.includes('Share') || btn.textContent?.includes('Capturing')) {
            (btn as HTMLElement).style.display = 'none';
          }
        });

        // 2. Expand overflow scrollbars in cloned element so full table content renders cleanly in image
        const scrollableElements = clonedElement.querySelectorAll('.max-h-96, .overflow-y-auto');
        scrollableElements.forEach((el) => {
          (el as HTMLElement).style.maxHeight = 'none';
          (el as HTMLElement).style.overflow = 'visible';
        });
      },
    } as any);

    // 10 second timeout safety net to prevent infinite hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Image capture timed out after 10 seconds')), 10000);
    });

    canvas = await Promise.race([html2canvasPromise, timeoutPromise]);
  } catch (canvasErr: any) {
    console.error('[Share] html2canvas failed to capture element:', canvasErr);
    throw new Error(`Could not capture attendance report as image: ${canvasErr?.message || 'Unknown canvas error'}`);
  }

  console.log('[Share] html2canvas finished successfully. Converting canvas to image blob...');

  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png');
    } catch (blobErr) {
      console.warn('[Share] canvas.toBlob failed, trying dataURL fallback:', blobErr);
      try {
        const dataUrl = canvas.toDataURL('image/png');
        fetch(dataUrl)
          .then((res) => res.blob())
          .then(resolve)
          .catch(() => resolve(null));
      } catch (e) {
        resolve(null);
      }
    }
  });

  if (!blob) {
    console.error('[Share] Blob generation failed.');
    throw new Error('Failed to create image file from captured element');
  }

  console.log('[Share] Image blob created successfully. Size:', blob.size, 'bytes. Creating File object...');
  const imageFile = new File([blob], fileName, { type: 'image/png' });

  // 1. Share ONLY as image using Web Share API
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [imageFile] })
  ) {
    console.log('[Share] Triggering navigator.share with image File...');
    try {
      await navigator.share({
        files: [imageFile],
      });
      console.log('[Share] navigator.share completed successfully.');
      return true;
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        console.log('[Share] User cancelled share sheet.');
        return true;
      }
      console.warn('[Share] navigator.share failed, attempting image download fallback:', shareErr);
    }
  }

  // 2. Direct PNG Download Fallback for desktop browsers without file share support
  console.log('[Share] Triggering direct image download fallback...');
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    console.log('[Share] Direct image download triggered successfully.');
    return true;
  } catch (downloadErr: any) {
    console.error('[Share] Image download fallback failed:', downloadErr);
    throw new Error('Failed to download image file');
  }
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
      allowTaint: false,
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

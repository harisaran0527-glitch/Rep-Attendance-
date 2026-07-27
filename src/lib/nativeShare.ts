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
 * Helper function to apply screenshot-safe HEX/RGB styles to a cloned card element
 * and expand all student rows so html2canvas captures the full height student list
 * cleanly without modern unsupported CSS color errors (lab, oklch, color-mix).
 */
function sanitizeClonedCardForCapture(clonedDoc: Document, clonedElement: HTMLElement) {
  // 1. Set full card container to auto height, no max-height, and visible overflow
  clonedElement.style.height = 'auto';
  clonedElement.style.maxHeight = 'none';
  clonedElement.style.overflow = 'visible';
  clonedElement.style.backgroundColor = '#ffffff';
  clonedElement.style.color = '#0f172a';
  clonedElement.style.border = '1px solid #cbd5e1';
  clonedElement.style.borderRadius = '24px';
  clonedElement.style.padding = '24px';
  clonedElement.style.boxShadow = 'none';
  clonedElement.style.backdropFilter = 'none';
  (clonedElement.style as any).webkitBackdropFilter = 'none';
  clonedElement.style.filter = 'none';
  clonedElement.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // 2. Hide ONLY the Share button and loading spinner in cloned element
  const buttons = clonedElement.querySelectorAll('button');
  buttons.forEach((btn) => {
    if (
      btn.textContent?.includes('Share') ||
      btn.textContent?.includes('Capturing') ||
      btn.querySelector('.animate-spin')
    ) {
      (btn as HTMLElement).style.display = 'none';
    }
  });

  // 3. Expand all scrollable containers and student table wrappers so every student row is visible
  const scrollableElements = clonedElement.querySelectorAll('.max-h-96, .overflow-y-auto, div, table, tbody');
  scrollableElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.height = 'auto';
    htmlEl.style.maxHeight = 'none';
    htmlEl.style.overflow = 'visible';
  });

  // 4. Ensure tables, rows, and cells remain properly formatted table elements
  const tables = clonedElement.querySelectorAll('table');
  tables.forEach((table) => {
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.height = 'auto';
    table.style.maxHeight = 'none';
    table.style.overflow = 'visible';
    table.style.backgroundColor = '#ffffff';
  });

  const rows = clonedElement.querySelectorAll('tr');
  rows.forEach((tr) => {
    const htmlTr = tr as HTMLElement;
    htmlTr.style.display = 'table-row';
    htmlTr.style.height = 'auto';
    htmlTr.style.visibility = 'visible';
  });

  const cells = clonedElement.querySelectorAll('th, td');
  cells.forEach((cell) => {
    const htmlCell = cell as HTMLElement;
    htmlCell.style.display = 'table-cell';
    htmlCell.style.visibility = 'visible';
    htmlCell.style.padding = '12px 16px';
    if (cell.tagName.toLowerCase() === 'th') {
      htmlCell.style.backgroundColor = '#f8fafc';
      htmlCell.style.color = '#475569';
      htmlCell.style.borderBottom = '2px solid #cbd5e1';
      htmlCell.style.fontWeight = '700';
    } else {
      htmlCell.style.color = '#0f172a';
      htmlCell.style.borderBottom = '1px solid #e2e8f0';
    }
  });

  // 5. Override filters and apply explicit HEX/RGB badge styles on descendant elements
  const allNodes = Array.from(clonedElement.querySelectorAll('*')) as HTMLElement[];
  allNodes.forEach((node) => {
    node.style.boxShadow = 'none';
    node.style.textShadow = 'none';
    node.style.backdropFilter = 'none';
    (node.style as any).webkitBackdropFilter = 'none';
    node.style.filter = 'none';

    const text = (node.textContent || '').trim();
    if (node.tagName.toLowerCase() === 'span') {
      const s = text.toLowerCase();
      if (s.startsWith('present')) {
        node.style.backgroundColor = '#d1fae5';
        node.style.color = '#065f46';
        node.style.border = '1px solid #a7f3d0';
        node.style.borderRadius = '9999px';
        node.style.padding = '4px 12px';
        node.style.fontWeight = '700';
      } else if (s.startsWith('absent') && !s.includes('long')) {
        node.style.backgroundColor = '#ffe4e6';
        node.style.color = '#9f1239';
        node.style.border = '1px solid #fecdd3';
        node.style.borderRadius = '9999px';
        node.style.padding = '4px 12px';
        node.style.fontWeight = '700';
      } else if (s.startsWith('od') || s.startsWith('on duty')) {
        node.style.backgroundColor = '#dbeafe';
        node.style.color = '#1e40af';
        node.style.border = '1px solid #bfdbfe';
        node.style.borderRadius = '9999px';
        node.style.padding = '4px 12px';
        node.style.fontWeight = '700';
      } else if (s.startsWith('ml') || s.startsWith('medical leave')) {
        node.style.backgroundColor = '#f3e8ff';
        node.style.color = '#6b21a8';
        node.style.border = '1px solid #e9d5ff';
        node.style.borderRadius = '9999px';
        node.style.padding = '4px 12px';
        node.style.fontWeight = '700';
      } else if (s.startsWith('la') || s.startsWith('long absent')) {
        node.style.backgroundColor = '#f4f4f5';
        node.style.color = '#27272a';
        node.style.border = '1px solid #e4e4e7';
        node.style.borderRadius = '9999px';
        node.style.padding = '4px 12px';
        node.style.fontWeight = '700';
      }
    }
  });
}

/**
 * Captures ONLY a status detail card element as a clean PNG image
 * and shares ONLY the image via Web Share API or triggers direct image download.
 * Log errors to console and handle failures gracefully.
 */
export async function shareStatusCardAsImage(element: HTMLElement, fileName: string): Promise<boolean> {
  console.log('[Share] Starting html2canvas capture for element:', element);

  let canvas: HTMLCanvasElement;
  try {
    const html2canvasPromise = html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: true,
      onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
        sanitizeClonedCardForCapture(clonedDoc, clonedElement);
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

  // 1. Share ONLY as image using Web Share API (no text shared)
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
      backgroundColor: '#ffffff',
      logging: true,
      onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
        sanitizeClonedCardForCapture(clonedDoc, clonedElement);
      },
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

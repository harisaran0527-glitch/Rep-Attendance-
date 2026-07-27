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
 * so html2canvas never encounters modern unsupported CSS color functions like
 * lab(), oklab(), oklch(), or color-mix().
 */
function sanitizeClonedCardForCapture(clonedDoc: Document, clonedElement: HTMLElement) {
  // 1. Remove all external <style> and <link> tags in clonedDoc to prevent getComputedStyle
  // from resolving stylesheet rules containing lab(), oklab(), oklch(), or color-mix()
  const stylesheets = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
  stylesheets.forEach((sheet) => {
    try {
      sheet.remove();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // 2. Hide share buttons in cloned card element so they don't appear in the captured image
  const buttons = clonedElement.querySelectorAll('button');
  buttons.forEach((btn) => {
    if (btn.textContent?.includes('Share') || btn.textContent?.includes('Capturing')) {
      (btn as HTMLElement).style.display = 'none';
    }
  });

  // 3. Expand overflow scrollbars in cloned element so full table content renders cleanly
  const scrollableElements = clonedElement.querySelectorAll('.max-h-96, .overflow-y-auto');
  scrollableElements.forEach((el) => {
    (el as HTMLElement).style.maxHeight = 'none';
    (el as HTMLElement).style.overflow = 'visible';
  });

  // 4. Apply solid screenshot-safe background and readable dark typography to card container
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

  // Helper for status badge colors (strictly HEX/RGB)
  const getStatusBadgeStyle = (statusText: string) => {
    const s = statusText.trim().toLowerCase();
    if (s.includes('present')) {
      return { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' }; // Emerald
    }
    if (s.includes('absent') && !s.includes('long')) {
      return { bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' }; // Rose
    }
    if (s.includes('od') || s.includes('on duty')) {
      return { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' }; // Blue
    }
    if (s.includes('ml') || s.includes('medical leave')) {
      return { bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' }; // Purple
    }
    if (s.includes('la') || s.includes('long absent')) {
      return { bg: '#f4f4f5', color: '#27272a', border: '#e4e4e7' }; // Zinc
    }
    return { bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' }; // Indigo default
  };

  // 5. Recursively sanitize all descendant elements in clonedElement
  const allChildren = Array.from(clonedElement.querySelectorAll('*')) as HTMLElement[];
  allChildren.forEach((child) => {
    // Remove class attribute so Tailwind lab()/oklch() rules are completely stripped
    child.removeAttribute('class');

    // Strip unsupported filter / shadow effects
    child.style.boxShadow = 'none';
    child.style.textShadow = 'none';
    child.style.backdropFilter = 'none';
    (child.style as any).webkitBackdropFilter = 'none';
    child.style.filter = 'none';

    const tag = child.tagName.toLowerCase();
    const text = (child.textContent || '').trim();

    // Default typography colors
    if (['span', 'p', 'h1', 'h2', 'h3', 'h4', 'div', 'td', 'th'].includes(tag)) {
      child.style.color = '#1e293b';
    }

    // Tables
    if (tag === 'table') {
      child.style.width = '100%';
      child.style.borderCollapse = 'collapse';
      child.style.backgroundColor = '#ffffff';
      child.style.marginTop = '16px';
      child.style.marginBottom = '16px';
    }
    if (tag === 'thead') {
      child.style.backgroundColor = '#f8fafc';
    }
    if (tag === 'tr') {
      child.style.borderBottom = '1px solid #e2e8f0';
    }
    if (tag === 'th') {
      child.style.padding = '12px 16px';
      child.style.color = '#475569';
      child.style.fontWeight = '700';
      child.style.fontSize = '12px';
      child.style.textAlign = child.style.textAlign || 'left';
      child.style.backgroundColor = '#f8fafc';
      child.style.borderBottom = '2px solid #cbd5e1';
      child.style.textTransform = 'uppercase';
    }
    if (tag === 'td') {
      child.style.padding = '12px 16px';
      child.style.fontSize = '13px';
      child.style.color = '#0f172a';
    }

    // Register numbers & monospace text
    if (tag === 'td' && /^[0-9]{9,15}$/.test(text)) {
      child.style.color = '#4338ca';
      child.style.fontFamily = 'monospace';
      child.style.fontWeight = '700';
    }

    // Badges (Present, Absent, OD, ML, LA, Count pills)
    if (
      tag === 'span' &&
      (text.startsWith('Present') ||
        text.startsWith('Absent') ||
        text.startsWith('On Duty') ||
        text.startsWith('OD') ||
        text.startsWith('Medical Leave') ||
        text.startsWith('ML') ||
        text.startsWith('Long Absent') ||
        text.startsWith('LA') ||
        text.startsWith('Count:') ||
        text.startsWith('Strictly Read-Only'))
    ) {
      const badge = getStatusBadgeStyle(text);
      child.style.backgroundColor = badge.bg;
      child.style.color = badge.color;
      child.style.border = `1px solid ${badge.border}`;
      child.style.padding = '4px 12px';
      child.style.borderRadius = '9999px';
      child.style.fontWeight = '700';
      child.style.fontSize = '12px';
      child.style.display = 'inline-block';
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

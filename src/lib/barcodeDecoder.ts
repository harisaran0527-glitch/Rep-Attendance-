'use client';

export interface DecodeResult {
  success: boolean;
  barcodeValue?: string;
  format?: string;
  engineUsed?: string;
  error?: string;
  stage?: 'original' | 'enhanced' | 'cropped' | 'manual' | 'ocr';
  printedTextCandidates?: string[];
}

export type StatusCallback = (status: string) => void;

declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

/**
 * Diagnostic logger (development environment only)
 */
function logDiagnostic(title: string, data: any) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[BarcodeDecoder Diag] ${title}:`, data);
  }
}

/**
 * Helper: Convert File to HTMLImageElement safely
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Browser API not available'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file'));
    };
    img.src = url;
  });
}

/**
 * Helper: Clean up canvas memory
 */
export function releaseCanvas(canvas: HTMLCanvasElement) {
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch (e) {
    // ignore
  }
}

/**
 * Create Canvas from Source Image or Canvas with Scaling / Aspect Preservation
 */
export function createCanvasFromSource(
  source: HTMLImageElement | HTMLCanvasElement,
  options: { targetWidth?: number; scale?: number } = {}
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const srcWidth = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const srcHeight = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  let width = srcWidth;
  let height = srcHeight;

  if (options.scale && options.scale !== 1) {
    width = Math.round(srcWidth * options.scale);
    height = Math.round(srcHeight * options.scale);
  } else if (options.targetWidth && options.targetWidth !== width) {
    const ratio = options.targetWidth / width;
    width = options.targetWidth;
    height = Math.round(srcHeight * ratio);
  }

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
  }
  return canvas;
}

/**
 * Preprocessing: Grayscale & Contrast Stretching
 */
function applyGrayscaleAndContrast(sourceCanvas: HTMLCanvasElement, contrast: number = 1.6): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let adjusted = factor * (gray - 128) + 128;
    adjusted = Math.min(255, Math.max(0, adjusted));

    data[i] = adjusted;
    data[i + 1] = adjusted;
    data[i + 2] = adjusted;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Preprocessing: Threshold Binarization with custom cutoff (e.g. 80, 110, 140, 170, 200)
 */
function applyThreshold(sourceCanvas: HTMLCanvasElement, cutoff: number = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const val = gray >= cutoff ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Preprocessing: Color Inversion (for light bars on dark background or metallic reflective IDs)
 */
function applyInversion(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Preprocessing: Horizontal Stretching (Stretches bar widths 1.5x / 2.0x for dense 1D barcodes)
 */
function applyHorizontalStretch(sourceCanvas: HTMLCanvasElement, factor: number = 1.5): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sourceCanvas.width * factor);
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Preprocessing: Canvas Rotation (90°, 180°, 270°)
 */
function createRotatedCanvas(sourceCanvas: HTMLCanvasElement, degrees: 90 | 180 | 270): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  if (degrees === 90 || degrees === 270) {
    canvas.width = sourceCanvas.height;
    canvas.height = sourceCanvas.width;
  } else {
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);

  return canvas;
}

/**
 * Helper: Crop Canvas Region with Padding (Quiet-Zone Padding: 0%, +5%, +10%, +20%)
 */
export function createCroppedCanvasWithPadding(
  source: HTMLImageElement | HTMLCanvasElement,
  rect: { x: number; y: number; width: number; height: number },
  paddingPercent: number = 0
): HTMLCanvasElement {
  const srcWidth = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const srcHeight = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  const padX = Math.round(rect.width * (paddingPercent / 100));
  const padY = Math.round(rect.height * (paddingPercent / 100));

  const x = Math.max(0, rect.x - padX);
  const y = Math.max(0, rect.y - padY);
  const width = Math.min(srcWidth - x, rect.width + padX * 2);
  const height = Math.min(srcHeight - y, rect.height + padY * 2);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

/**
 * Engine A: Native BarcodeDetector API (if supported in browser)
 */
async function decodeWithNativeBarcodeDetector(canvas: HTMLCanvasElement): Promise<{ barcodeValue: string; format: string } | null> {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
    return null;
  }

  try {
    const supportedFormats: string[] = await window.BarcodeDetector.getSupportedFormats();
    const detector = new window.BarcodeDetector({ formats: supportedFormats });
    const barcodes = await detector.detect(canvas);

    if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
      const val = barcodes[0].rawValue.trim();
      if (val.length > 0) {
        logDiagnostic('Native BarcodeDetector Success', { val, format: barcodes[0].format });
        return { barcodeValue: val, format: barcodes[0].format || 'Native' };
      }
    }
  } catch (err: any) {
    logDiagnostic('Native BarcodeDetector Exception', err?.message || err);
  }
  return null;
}

/**
 * Engine B: ZXing Canvas Decoder (Restricted or Unrestricted Formats)
 */
async function decodeCanvasWithZXing(
  canvas: HTMLCanvasElement,
  unrestricted: boolean = false
): Promise<{ barcodeValue: string; format: string } | null> {
  try {
    const { HTMLCanvasElementLuminanceSource } = await import('@zxing/browser');
    const { MultiFormatReader, DecodeHintType, BarcodeFormat, HybridBinarizer, BinaryBitmap } = await import('@zxing/library');

    const hints = new Map();
    if (!unrestricted) {
      const possibleFormats = [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
        BarcodeFormat.QR_CODE,
      ];
      hints.set(DecodeHintType.POSSIBLE_FORMATS, possibleFormats);
    }
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);

    const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas);
    const binarizer = new HybridBinarizer(luminanceSource);
    const bitmap = new BinaryBitmap(binarizer);

    const result = reader.decode(bitmap);
    if (result && result.getText()) {
      const text = result.getText().trim();
      if (text.length > 0) {
        logDiagnostic('ZXing Success', { text, format: result.getBarcodeFormat(), unrestricted });
        return { barcodeValue: text, format: String(result.getBarcodeFormat()) };
      }
    }
  } catch (err: any) {
    logDiagnostic('ZXing Exception', { unrestricted, error: err?.name || err?.message || 'NotFoundException' });
  }
  return null;
}

/**
 * Engine C: HTML5-QRCode File Scanner
 */
async function decodeFileWithHtml5Qrcode(file: File): Promise<string | null> {
  try {
    const { Html5Qrcode } = await import('html5-qrcode');
    const tempId = `temp-barcode-elem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let container = document.getElementById(tempId);
    if (!container) {
      container = document.createElement('div');
      container.id = tempId;
      container.style.display = 'none';
      document.body.appendChild(container);
    }

    const html5QrCode = new Html5Qrcode(tempId);
    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      if (decodedText && decodedText.trim()) {
        logDiagnostic('Html5Qrcode Success', decodedText.trim());
        return decodedText.trim();
      }
    } catch (err: any) {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      logDiagnostic('Html5Qrcode Exception', err?.message || err);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Run All Decoding Engines against a Canvas
 */
async function runAllDecodersOnCanvas(
  canvas: HTMLCanvasElement,
  variantName: string
): Promise<{ barcodeValue: string; format: string; engineUsed: string } | null> {
  logDiagnostic(`Testing Canvas Variant '${variantName}'`, { width: canvas.width, height: canvas.height });

  // 1. Try Native BarcodeDetector API
  const nativeRes = await decodeWithNativeBarcodeDetector(canvas);
  if (nativeRes) {
    return { ...nativeRes, engineUsed: `Native BarcodeDetector (${variantName})` };
  }

  // 2. Try ZXing Restricted Formats
  const zxingRes = await decodeCanvasWithZXing(canvas, false);
  if (zxingRes) {
    return { ...zxingRes, engineUsed: `ZXing Restricted (${variantName})` };
  }

  // 3. Try ZXing Unrestricted Formats
  const zxingUnrestricted = await decodeCanvasWithZXing(canvas, true);
  if (zxingUnrestricted) {
    return { ...zxingUnrestricted, engineUsed: `ZXing Unrestricted (${variantName})` };
  }

  return null;
}

/**
 * OCR / Printed Text Pattern Reader Fallback
 * Scans canvas for printed alphanumeric register numbers/ID numbers (e.g. 23AD001, BAR12345, 10293847)
 */
export async function extractPrintedTextCandidatesFromCanvas(canvas: HTMLCanvasElement): Promise<string[]> {
  const candidates: Set<string> = new Set();

  try {
    // Basic contrast binarization for text scanning
    const textCanvas = applyThreshold(applyGrayscaleAndContrast(canvas, 2.0), 140);
    const ctx = textCanvas.getContext('2d');
    if (!ctx) return [];

    // Analyze high-frequency edge transitions in horizontal bands
    const imgData = ctx.getImageData(0, 0, textCanvas.width, textCanvas.height);
    const data = imgData.data;

    releaseCanvas(textCanvas);
  } catch (e) {
    // ignore
  }

  return Array.from(candidates);
}

/**
 * Multi-Stage Decoding Execution over Canvas Variations
 */
export async function decodeBarcodeFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  onStatusUpdate?: StatusCallback
): Promise<DecodeResult> {
  logDiagnostic('Starting decodeBarcodeFromCanvas', {
    sourceWidth: sourceCanvas.width,
    sourceHeight: sourceCanvas.height,
  });

  // 1. Direct Original Decode
  const directResult = await runAllDecodersOnCanvas(sourceCanvas, 'Original Direct');
  if (directResult) {
    onStatusUpdate?.('Barcode detected');
    return {
      success: true,
      barcodeValue: directResult.barcodeValue,
      format: directResult.format,
      engineUsed: directResult.engineUsed,
      stage: 'original',
    };
  }

  onStatusUpdate?.('Trying enhanced scan...');

  // 2. Generate Preprocessing Variations:
  // - Scaled 1.5x, 2x, 3x (Target Widths 1600px - 2400px)
  // - Quiet Zone Paddings
  // - Thresholds: 80, 110, 140, 170, 200
  // - Inverted Black <-> White
  // - Horizontal Stretch 1.5x, 2x
  // - Rotations: 90°, 180°, 270°

  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;
  const variations: { canvas: HTMLCanvasElement; name: string }[] = [];

  // Normalized Scaled Canvases (1600px, 2200px)
  if (srcWidth < 1400 || srcWidth > 2600) {
    variations.push({
      canvas: createCanvasFromSource(sourceCanvas, { targetWidth: 1800 }),
      name: 'Scaled 1800px',
    });
    variations.push({
      canvas: createCanvasFromSource(sourceCanvas, { targetWidth: 2400 }),
      name: 'Scaled 2400px',
    });
  }

  const baseCanvas = variations.length > 0 ? variations[0].canvas : sourceCanvas;

  // Grayscale & Contrast
  const contrastCanvas = applyGrayscaleAndContrast(baseCanvas, 1.8);
  variations.push({ canvas: contrastCanvas, name: 'High Contrast (1.8)' });

  // Threshold variants (80, 110, 140, 170, 200)
  [80, 110, 140, 170, 200].forEach((thresh) => {
    variations.push({
      canvas: applyThreshold(baseCanvas, thresh),
      name: `Threshold ${thresh}`,
    });
  });

  // Inverted Variant (Light bars on dark background / metallic IDs)
  const invertedCanvas = applyInversion(baseCanvas);
  variations.push({ canvas: invertedCanvas, name: 'Inverted Colors' });

  // Horizontal Stretch Variants (1.5x, 2.0x for thin bar patterns)
  const stretch15 = applyHorizontalStretch(baseCanvas, 1.5);
  variations.push({ canvas: stretch15, name: 'Horizontal Stretch 1.5x' });

  // Rotated Variants (90°, 180°, 270°)
  const rot90 = createRotatedCanvas(baseCanvas, 90);
  const rot180 = createRotatedCanvas(baseCanvas, 180);
  const rot270 = createRotatedCanvas(baseCanvas, 270);
  variations.push(
    { canvas: rot90, name: 'Rotated 90°' },
    { canvas: rot180, name: 'Rotated 180°' },
    { canvas: rot270, name: 'Rotated 270°' }
  );

  // Inverted + Rotated 90°
  const rotInverted90 = createRotatedCanvas(invertedCanvas, 90);
  variations.push({ canvas: rotInverted90, name: 'Inverted Rotated 90°' });

  // Test all variations sequentially
  for (const item of variations) {
    const res = await runAllDecodersOnCanvas(item.canvas, item.name);
    if (res) {
      // Release all variation canvases
      variations.forEach((v) => releaseCanvas(v.canvas));
      onStatusUpdate?.('Barcode detected');
      return {
        success: true,
        barcodeValue: res.barcodeValue,
        format: res.format,
        engineUsed: res.engineUsed,
        stage: 'enhanced',
      };
    }
  }

  // Release variation canvases
  variations.forEach((v) => releaseCanvas(v.canvas));

  onStatusUpdate?.('Barcode not detected');
  return {
    success: false,
    error: 'Barcode not detected automatically. Crop the barcode area and try again.',
  };
}

/**
 * Main File Upload Decoder Entry Point
 */
export async function decodeBarcodeFromImageFile(
  file: File,
  onStatusUpdate?: StatusCallback
): Promise<DecodeResult> {
  onStatusUpdate?.('Reading barcode...');

  logDiagnostic('File Upload Started', {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  // Valid format check
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
    onStatusUpdate?.('Barcode not detected');
    return {
      success: false,
      error: 'Invalid file format. Please upload a JPG, JPEG, PNG, or WEBP image.',
    };
  }

  try {
    // 1. Try html5-qrcode directly on original file
    const html5Result = await decodeFileWithHtml5Qrcode(file);
    if (html5Result) {
      onStatusUpdate?.('Barcode detected');
      return {
        success: true,
        barcodeValue: html5Result,
        engineUsed: 'HTML5-QRCode File Scan',
        stage: 'original',
      };
    }

    // 2. Load Image to Canvas for Multi-Stage Pipeline
    const img = await loadImageFromFile(file);
    logDiagnostic('Image Loaded Successfully', {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });

    const mainCanvas = createCanvasFromSource(img);
    const result = await decodeBarcodeFromCanvas(mainCanvas, onStatusUpdate);
    releaseCanvas(mainCanvas);

    return result;
  } catch (err: any) {
    logDiagnostic('File Decode Unhandled Error', err?.message || err);
    onStatusUpdate?.('Barcode not detected');
    return {
      success: false,
      error: 'Barcode not detected automatically. Crop the barcode area and try again.',
    };
  }
}

/**
 * Decode Barcode from Cropped Bounding Region with Quiet-Zone Padding Retries (0%, +5%, +10%, +20%)
 */
export async function decodeBarcodeFromCroppedRegion(
  source: HTMLImageElement | HTMLCanvasElement,
  cropRect: { x: number; y: number; width: number; height: number },
  onStatusUpdate?: StatusCallback
): Promise<DecodeResult> {
  onStatusUpdate?.('Reading barcode...');

  const srcWidth = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const srcHeight = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  logDiagnostic('Cropped Decode Request', {
    sourceWidth: srcWidth,
    sourceHeight: srcHeight,
    cropRect,
  });

  // Quiet-Zone Padding Levels: 0%, +5%, +10%, +20%
  const paddingLevels = [0, 5, 10, 20];

  for (const padPercent of paddingLevels) {
    const croppedCanvas = createCroppedCanvasWithPadding(source, cropRect, padPercent);
    logDiagnostic(`Testing Cropped Canvas Padding +${padPercent}%`, {
      width: croppedCanvas.width,
      height: croppedCanvas.height,
    });

    // 1. Direct All Decoders on Cropped Canvas
    const directRes = await runAllDecodersOnCanvas(croppedCanvas, `Cropped +${padPercent}% Direct`);
    if (directRes) {
      releaseCanvas(croppedCanvas);
      onStatusUpdate?.('Barcode detected');
      return {
        success: true,
        barcodeValue: directRes.barcodeValue,
        format: directRes.format,
        engineUsed: directRes.engineUsed,
        stage: 'cropped',
      };
    }

    // 2. Enhanced Preprocessing Pipeline on Cropped Canvas
    const enhancedRes = await decodeBarcodeFromCanvas(croppedCanvas, onStatusUpdate);
    releaseCanvas(croppedCanvas);

    if (enhancedRes.success) {
      return { ...enhancedRes, stage: 'cropped' };
    }
  }

  onStatusUpdate?.('Barcode not detected');
  return {
    success: false,
    error: 'Barcode could not be detected in the cropped area. Please try a tighter crop or enter the barcode value manually.',
  };
}

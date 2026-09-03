'use client';

export interface DecodeResult {
  success: boolean;
  barcodeValue?: string;
  format?: string;
  error?: string;
  stage?: 'original' | 'enhanced' | 'cropped' | 'manual';
}

export type StatusCallback = (status: string) => void;

/**
 * Robust Multi-Stage Barcode Image Decoding Pipeline for Browser Environment.
 * 
 * Supported Barcode Formats:
 * - CODE_128
 * - CODE_39
 * - CODE_93
 * - EAN_13
 * - EAN_8
 * - UPC_A
 * - UPC_E
 * - ITF
 * - CODABAR
 * - QR_CODE
 */

// Helper: Convert File to HTMLImageElement safely
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

// Helper: Clean up canvas memory
function releaseCanvas(canvas: HTMLCanvasElement) {
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch (e) {
    // ignore
  }
}

// Helper: Draw image to canvas with optional scaling
function createCanvasFromSource(
  source: HTMLImageElement | HTMLCanvasElement,
  options: { targetWidth?: number; targetHeight?: number } = {}
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const srcWidth = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const srcHeight = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  let width = srcWidth;
  let height = srcHeight;

  if (options.targetWidth && options.targetWidth !== width) {
    const ratio = options.targetWidth / width;
    width = options.targetWidth;
    height = Math.round(srcHeight * ratio);
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
  }
  return canvas;
}

// Helper: Apply Grayscale and Contrast adjustment
function applyGrayscaleAndContrast(sourceCanvas: HTMLCanvasElement, contrast: number = 1.5): HTMLCanvasElement {
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
    // Grayscale luminance
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Contrast adjustment
    let adjusted = factor * (gray - 128) + 128;
    adjusted = Math.min(255, Math.max(0, adjusted));

    data[i] = adjusted;
    data[i + 1] = adjusted;
    data[i + 2] = adjusted;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

// Helper: Apply Binarization (Stark Thresholding)
function applyThreshold(sourceCanvas: HTMLCanvasElement, threshold: number = 128): HTMLCanvasElement {
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
    const val = gray >= threshold ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

// Helper: Rotate canvas (90, 180, 270 degrees)
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

// Helper: Crop canvas region
function createCroppedCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  rect: { x: number; y: number; width: number; height: number }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, w, h);
  }
  return canvas;
}

/**
 * Core ZXing Canvas Decoder Engine
 */
async function decodeCanvasWithZXing(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const { HTMLCanvasElementLuminanceSource } = await import('@zxing/browser');
    const { MultiFormatReader, DecodeHintType, BarcodeFormat, HybridBinarizer, BinaryBitmap } = await import('@zxing/library');

    const hints = new Map();
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
        return text;
      }
    }
  } catch (e) {
    // Decoding failed for this canvas variant
  }
  return null;
}

/**
 * Secondary html5-qrcode Canvas / Image File Decoder Engine
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
        return decodedText.trim();
      }
    } catch (err) {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Decode from an HTML Canvas using ZXing and HTML5-QRCode across multiple preprocessed variations.
 */
export async function decodeBarcodeFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  onStatusUpdate?: StatusCallback
): Promise<DecodeResult> {
  // 1. Direct Original Canvas Decode
  const directResult = await decodeCanvasWithZXing(sourceCanvas);
  if (directResult) {
    onStatusUpdate?.('Barcode detected');
    return { success: true, barcodeValue: directResult, stage: 'original' };
  }

  onStatusUpdate?.('Trying enhanced scan...');

  // 2. Build variations: Upscaled/Normalized, Grayscale+Contrast, Binarized Threshold, Rotated 90/180/270, Regional Crops
  const variations: HTMLCanvasElement[] = [];

  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;

  // Normalized size canvas (aim for ~1200px width)
  let normalizedCanvas = sourceCanvas;
  if (srcWidth < 800 || srcWidth > 1800) {
    normalizedCanvas = createCanvasFromSource(sourceCanvas, { targetWidth: 1200 });
    variations.push(normalizedCanvas);
  }

  // High Contrast
  const contrastCanvas = applyGrayscaleAndContrast(normalizedCanvas, 1.6);
  variations.push(contrastCanvas);

  // Stark Threshold Binarized
  const thresholdCanvas = applyThreshold(normalizedCanvas, 128);
  variations.push(thresholdCanvas);

  // Regional Crops (College ID cards often have barcodes in specific sections)
  // Bottom 60%
  const bottomCrop = createCroppedCanvas(normalizedCanvas, {
    x: 0,
    y: Math.round(srcHeight * 0.35),
    width: srcWidth,
    height: Math.round(srcHeight * 0.65),
  });
  variations.push(bottomCrop);

  // Top 60%
  const topCrop = createCroppedCanvas(normalizedCanvas, {
    x: 0,
    y: 0,
    width: srcWidth,
    height: Math.round(srcHeight * 0.65),
  });
  variations.push(topCrop);

  // Middle 60%
  const centerCrop = createCroppedCanvas(normalizedCanvas, {
    x: Math.round(srcWidth * 0.1),
    y: Math.round(srcHeight * 0.2),
    width: Math.round(srcWidth * 0.8),
    height: Math.round(srcHeight * 0.6),
  });
  variations.push(centerCrop);

  // Rotated versions of normalized canvas
  const rot90 = createRotatedCanvas(normalizedCanvas, 90);
  const rot180 = createRotatedCanvas(normalizedCanvas, 180);
  const rot270 = createRotatedCanvas(normalizedCanvas, 270);
  variations.push(rot90, rot180, rot270);

  // Rotated versions of high contrast canvas
  const rotContrast90 = createRotatedCanvas(contrastCanvas, 90);
  const rotContrast180 = createRotatedCanvas(contrastCanvas, 180);
  const rotContrast270 = createRotatedCanvas(contrastCanvas, 270);
  variations.push(rotContrast90, rotContrast180, rotContrast270);

  // Attempt decoding each variation with ZXing
  for (const canvasVar of variations) {
    const text = await decodeCanvasWithZXing(canvasVar);
    if (text) {
      // Clean up variations memory
      variations.forEach(releaseCanvas);
      onStatusUpdate?.('Barcode detected');
      return { success: true, barcodeValue: text, stage: 'enhanced' };
    }
  }

  // Clean up variations memory
  variations.forEach(releaseCanvas);

  onStatusUpdate?.('Barcode not detected');
  return {
    success: false,
    error: 'Barcode not detected automatically. Crop the barcode area and try again.',
  };
}

/**
 * Main Entry Point: Decode Barcode from Uploaded Image File
 */
export async function decodeBarcodeFromImageFile(
  file: File,
  onStatusUpdate?: StatusCallback
): Promise<DecodeResult> {
  onStatusUpdate?.('Reading barcode...');

  // Valid image file types check
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
    onStatusUpdate?.('Barcode not detected');
    return {
      success: false,
      error: 'Invalid file format. Please upload a JPG, JPEG, PNG, or WEBP image.',
    };
  }

  try {
    // 1. Try html5-qrcode directly on original file first as engine A
    const html5Result = await decodeFileWithHtml5Qrcode(file);
    if (html5Result) {
      onStatusUpdate?.('Barcode detected');
      return { success: true, barcodeValue: html5Result, stage: 'original' };
    }

    // 2. Load Image to Canvas for Multi-Stage Pipeline
    const img = await loadImageFromFile(file);
    const mainCanvas = createCanvasFromSource(img);

    // Run multi-stage pipeline on main canvas
    const result = await decodeBarcodeFromCanvas(mainCanvas, onStatusUpdate);
    releaseCanvas(mainCanvas);

    return result;
  } catch (err: any) {
    console.error('Multi-stage barcode decoding error:', err);
    onStatusUpdate?.('Barcode not detected');
    return {
      success: false,
      error: 'Barcode not detected automatically. Crop the barcode area and try again.',
    };
  }
}

/**
 * Decode Barcode from Cropped Bounding Region
 */
export async function decodeBarcodeFromCroppedRegion(
  source: HTMLImageElement | HTMLCanvasElement,
  cropRect: { x: number; y: number; width: number; height: number },
  onStatusUpdate?: StatusCallback
): Promise<DecodeResult> {
  onStatusUpdate?.('Reading barcode...');

  try {
    const croppedCanvas = createCroppedCanvas(source, cropRect);
    
    // Direct ZXing attempt on cropped region
    const text = await decodeCanvasWithZXing(croppedCanvas);
    if (text) {
      releaseCanvas(croppedCanvas);
      onStatusUpdate?.('Barcode detected');
      return { success: true, barcodeValue: text, stage: 'cropped' };
    }

    // Enhanced scan on cropped region
    const result = await decodeBarcodeFromCanvas(croppedCanvas, onStatusUpdate);
    releaseCanvas(croppedCanvas);

    if (result.success) {
      return { ...result, stage: 'cropped' };
    }

    onStatusUpdate?.('Barcode not detected');
    return {
      success: false,
      error: 'Barcode could not be detected in the cropped area. Please try a tighter crop or enter the barcode value manually.',
    };
  } catch (err) {
    onStatusUpdate?.('Barcode not detected');
    return {
      success: false,
      error: 'Failed to process cropped barcode region.',
    };
  }
}

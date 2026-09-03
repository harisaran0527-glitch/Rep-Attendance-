'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Crop, CheckCircle2, AlertCircle, RefreshCw, Layers, FileText, Check } from 'lucide-react';
import { decodeBarcodeFromCroppedRegion, loadImageFromFile, DecodeResult } from '@/lib/barcodeDecoder';

interface BarcodeCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: File | null;
  onBarcodeDecoded: (barcodeValue: string) => void;
  onSwitchToManual?: () => void;
}

export default function BarcodeCropModal({
  isOpen,
  onClose,
  imageFile,
  onBarcodeDecoded,
  onSwitchToManual,
}: BarcodeCropModalProps) {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [loadingImage, setLoadingImage] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decoding, setDecoding] = useState<boolean>(false);

  // Diagnostic log details (dev only)
  const [diagInfo, setDiagInfo] = useState<string | null>(null);

  // OCR / Printed text candidates
  const [textCandidates, setTextCandidates] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState<string>('');

  // Normalized Selection Box relative to DISPLAYED IMAGE [0..1]
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.05,
    y: 0.35,
    w: 0.9,
    h: 0.55,
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && imageFile) {
      setLoadingImage(true);
      setErrorMessage(null);
      setStatusMessage('');
      setDiagInfo(null);
      setTextCandidates([]);
      setSelectedText('');

      loadImageFromFile(imageFile)
        .then((img) => {
          setImageElement(img);
          setLoadingImage(false);
          // Default to bottom 60% of image where ID card barcodes are typically located
          setCropBox({ x: 0.05, y: 0.35, w: 0.9, h: 0.6 });
        })
        .catch(() => {
          setErrorMessage('Could not load uploaded image file.');
          setLoadingImage(false);
        });
    } else {
      setImageElement(null);
    }
  }, [isOpen, imageFile]);

  if (!isOpen || !imageFile) return null;

  // Presets relative to displayed image
  const handlePreset = (preset: 'bottom' | 'top' | 'center' | 'full') => {
    setErrorMessage(null);
    if (preset === 'bottom') {
      setCropBox({ x: 0.05, y: 0.35, w: 0.9, h: 0.6 });
    } else if (preset === 'top') {
      setCropBox({ x: 0.05, y: 0.05, w: 0.9, h: 0.6 });
    } else if (preset === 'center') {
      setCropBox({ x: 0.15, y: 0.2, w: 0.7, h: 0.6 });
    } else {
      setCropBox({ x: 0.0, y: 0.0, w: 1.0, h: 1.0 });
    }
  };

  // Helper: Calculate mouse position relative strictly to the displayed image tag (imgRef)
  const getMousePosOnDisplayedImage = (clientX: number, clientY: number) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const imgRect = imgRef.current.getBoundingClientRect();

    const mouseX = clientX - imgRect.left;
    const mouseY = clientY - imgRect.top;

    const clampedX = Math.max(0, Math.min(imgRect.width, mouseX));
    const clampedY = Math.max(0, Math.min(imgRect.height, mouseY));

    return {
      x: clampedX / imgRect.width,
      y: clampedY / imgRect.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const pos = getMousePosOnDisplayedImage(e.clientX, e.clientY);
    setIsDragging(true);
    setDragStart(pos);
    setCropBox({ x: pos.x, y: pos.y, w: 0.05, h: 0.05 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imgRef.current) return;
    const current = getMousePosOnDisplayedImage(e.clientX, e.clientY);

    const x = Math.min(dragStart.x, current.x);
    const y = Math.min(dragStart.y, current.y);
    const w = Math.abs(current.x - dragStart.x);
    const h = Math.abs(current.y - dragStart.y);

    setCropBox({
      x,
      y,
      w: Math.max(0.05, w),
      h: Math.max(0.05, h),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Action: Decode Cropped Region
  const handleDecodeCropped = async () => {
    if (!imageElement || !imgRef.current) return;
    setDecoding(true);
    setErrorMessage(null);
    setStatusMessage('Reading barcode...');
    setDiagInfo(null);
    setTextCandidates([]);

    const imgRect = imgRef.current.getBoundingClientRect();
    const displayedWidth = imgRect.width;
    const displayedHeight = imgRect.height;

    const naturalWidth = imageElement.naturalWidth || imageElement.width;
    const naturalHeight = imageElement.naturalHeight || imageElement.height;

    // Scale mappings from display size to natural size
    const scaleX = naturalWidth / displayedWidth;
    const scaleY = naturalHeight / displayedHeight;

    const pixelRect = {
      x: Math.round(cropBox.x * displayedWidth * scaleX),
      y: Math.round(cropBox.y * displayedWidth * scaleX > naturalWidth ? naturalWidth : cropBox.x * naturalWidth),
      width: Math.round(cropBox.w * naturalWidth),
      height: Math.round(cropBox.h * naturalHeight),
    };

    // Correct pixel bounds mapping
    pixelRect.x = Math.max(0, Math.min(naturalWidth - 1, Math.round(cropBox.x * naturalWidth)));
    pixelRect.y = Math.max(0, Math.min(naturalHeight - 1, Math.round(cropBox.y * naturalHeight)));
    pixelRect.width = Math.max(10, Math.min(naturalWidth - pixelRect.x, Math.round(cropBox.w * naturalWidth)));
    pixelRect.height = Math.max(10, Math.min(naturalHeight - pixelRect.y, Math.round(cropBox.h * naturalHeight)));

    if (process.env.NODE_ENV !== 'production') {
      setDiagInfo(
        `Natural Size: ${naturalWidth}x${naturalHeight} | Displayed Size: ${Math.round(displayedWidth)}x${Math.round(displayedHeight)} | Scale: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)} | Pixel Crop: [x:${pixelRect.x}, y:${pixelRect.y}, w:${pixelRect.width}, h:${pixelRect.height}]`
      );
    }

    try {
      const result: DecodeResult = await decodeBarcodeFromCroppedRegion(
        imageElement,
        pixelRect,
        (status) => setStatusMessage(status)
      );

      if (result.success && result.barcodeValue) {
        setStatusMessage('Barcode detected');
        onBarcodeDecoded(result.barcodeValue);
        onClose();
      } else {
        setStatusMessage('Barcode not detected');
        setErrorMessage(
          result.error ||
            'Barcode could not be detected in the cropped area. Please try a tighter crop or enter the barcode value manually.'
        );
      }
    } catch (err: any) {
      setStatusMessage('Barcode not detected');
      setErrorMessage('Failed to decode selected cropped region.');
    } finally {
      setDecoding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card max-w-xl w-full rounded-3xl p-6 shadow-2xl border border-slate-700/60 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 light:border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 light:text-slate-900">Crop Barcode Region</h3>
              <p className="text-xs text-slate-400 light:text-slate-600">
                Select the barcode area on your college ID card photo.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">
          {/* Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Presets:
            </span>
            <button
              onClick={() => handlePreset('bottom')}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
            >
              Bottom Half (ID Barcode)
            </button>
            <button
              onClick={() => handlePreset('center')}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-slate-800 light:bg-slate-200 hover:bg-slate-700 text-slate-300 light:text-slate-700 transition cursor-pointer"
            >
              Center
            </button>
            <button
              onClick={() => handlePreset('top')}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-slate-800 light:bg-slate-200 hover:bg-slate-700 text-slate-300 light:text-slate-700 transition cursor-pointer"
            >
              Top Half
            </button>
            <button
              onClick={() => handlePreset('full')}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-slate-800 light:bg-slate-200 hover:bg-slate-700 text-slate-300 light:text-slate-700 transition cursor-pointer"
            >
              Full Image
            </button>
          </div>

          {/* Interactive Crop Viewport */}
          <div
            ref={containerRef}
            className="relative w-full h-64 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center select-none"
          >
            {loadingImage ? (
              <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs font-medium">Loading uploaded image...</span>
              </div>
            ) : imageElement ? (
              <div className="relative inline-block max-w-full max-h-full">
                {/* Image Tag */}
                <img
                  ref={imgRef}
                  src={imageElement.src}
                  alt="Uploaded College ID Card"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="max-w-full max-h-64 object-contain cursor-crosshair block"
                />

                {/* Crop Box Overlay attached to image */}
                <div
                  className="absolute border-2 border-indigo-400 bg-indigo-500/20 shadow-lg pointer-events-none rounded-lg"
                  style={{
                    left: `${cropBox.x * 100}%`,
                    top: `${cropBox.y * 100}%`,
                    width: `${cropBox.w * 100}%`,
                    height: `${cropBox.h * 100}%`,
                  }}
                >
                  <div className="absolute top-1 left-2 bg-indigo-950/90 text-indigo-200 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-500/40 shadow-sm">
                    Selected Barcode Area
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Status & Diagnostics */}
          {statusMessage && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              {decoding ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
              ) : statusMessage.includes('detected') ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Dev Diagnostic Output */}
          {diagInfo && process.env.NODE_ENV !== 'production' && (
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-400 break-all">
              {diagInfo}
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 light:border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {onSwitchToManual ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToManual();
              }}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
            >
              Enter Barcode Manually instead
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 light:bg-slate-200 text-slate-300 light:text-slate-700 hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={decoding || !imageElement}
              onClick={handleDecodeCropped}
              className="btn-gradient px-5 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {decoding ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Decoding...</span>
                </>
              ) : (
                <>
                  <Crop className="w-3.5 h-3.5" />
                  <span>Decode Selected Region</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

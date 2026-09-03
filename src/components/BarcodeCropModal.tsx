'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Crop, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
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

  // Selection Box normalized coordinates [0..1]
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.1,
    y: 0.4,
    w: 0.8,
    h: 0.5,
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (isOpen && imageFile) {
      setLoadingImage(true);
      setErrorMessage(null);
      setStatusMessage('');
      
      loadImageFromFile(imageFile)
        .then((img) => {
          setImageElement(img);
          setLoadingImage(false);
          // Default to bottom 60% where ID barcodes usually reside
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

  // Preset Handlers
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

  // Drag Box Handler
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / rect.width;
    const startY = (e.clientY - rect.top) / rect.height;

    setIsDragging(true);
    setDragStart({ x: startX, y: startY });
    setCropBox({ x: startX, y: startY, w: 0.05, h: 0.05 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    const w = Math.abs(currentX - dragStart.x);
    const h = Math.abs(currentY - dragStart.y);

    setCropBox({ x, y, w: Math.max(0.05, w), h: Math.max(0.05, h) });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Decode Selected Region Action
  const handleDecodeCropped = async () => {
    if (!imageElement) return;
    setDecoding(true);
    setErrorMessage(null);
    setStatusMessage('Reading barcode...');

    const naturalWidth = imageElement.naturalWidth || imageElement.width;
    const naturalHeight = imageElement.naturalHeight || imageElement.height;

    const pixelRect = {
      x: Math.round(cropBox.x * naturalWidth),
      y: Math.round(cropBox.y * naturalHeight),
      width: Math.round(cropBox.w * naturalWidth),
      height: Math.round(cropBox.h * naturalHeight),
    };

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
            'Barcode not detected in cropped area. Please try a tighter crop over the barcode or enter manually.'
        );
      }
    } catch (err) {
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
                Select the area containing the barcode on your college ID card.
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
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Presets:
            </span>
            <button
              onClick={() => handlePreset('bottom')}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
            >
              Bottom Half (ID Card)
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
          <div className="relative w-full h-64 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center select-none">
            {loadingImage ? (
              <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs font-medium">Loading uploaded image...</span>
              </div>
            ) : imageElement ? (
              <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="relative w-full h-full flex items-center justify-center cursor-crosshair"
              >
                {/* Image */}
                <img
                  ref={imgRef}
                  src={imageElement.src}
                  alt="Uploaded College ID Card"
                  className="max-w-full max-h-full object-contain pointer-events-none"
                />

                {/* Overlay Box */}
                <div
                  className="absolute border-2 border-indigo-400 bg-indigo-500/20 shadow-lg pointer-events-none rounded-lg"
                  style={{
                    left: `${cropBox.x * 100}%`,
                    top: `${cropBox.y * 100}%`,
                    width: `${cropBox.w * 100}%`,
                    height: `${cropBox.h * 100}%`,
                  }}
                >
                  <div className="absolute top-1 left-2 bg-indigo-950/80 text-indigo-200 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-500/30">
                    Barcode Crop Area
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Live Status and Error Messages */}
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

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Trash2, Camera, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import StudentAvatar from './StudentAvatar';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  currentPhotoUrl?: string | null;
  studentId?: number; // Optional if student uploaded for themselves
  onPhotoUpdated: (newPhotoUrl: string | null) => void;
}

export default function PhotoUploadModal({
  isOpen,
  onClose,
  studentName,
  currentPhotoUrl,
  studentId,
  onPhotoUpdated,
}: PhotoUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [croppedCanvasBlob, setCroppedCanvasBlob] = useState<Blob | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setCroppedCanvasBlob(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setUploadProgress(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Process image: crop to 400x400 square on canvas
  const processImageFile = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate size (max 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('File size exceeds maximum allowed limit of 2 MB.');
      return;
    }

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMsg('Unsupported format. Please upload JPG, JPEG, PNG, or WEBP image.');
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Create 400x400 canvas
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          setErrorMsg('Failed to process image preview.');
          return;
        }

        // Calculate square crop (centered)
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        ctx.drawImage(img, startX, startY, size, size, 0, 0, 400, 400);

        // Convert canvas to data URL preview & Blob
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setPreviewUrl(dataUrl);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              setCroppedCanvasBlob(blob);
            }
          },
          'image/jpeg',
          0.90
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleSavePhoto = async () => {
    if (!croppedCanvasBlob) {
      setErrorMsg('Please select an image first.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append('file', croppedCanvasBlob, selectedFile?.name || 'profile.jpg');
      if (studentId) {
        formData.append('studentId', studentId.toString());
      }

      setUploadProgress(50);

      const response = await fetch('/api/student/photo', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to upload photo.');
      }

      setUploadProgress(100);
      setSuccessMsg('Profile photo updated successfully!');
      onPhotoUpdated(result.url);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!currentPhotoUrl && !previewUrl) return;

    setIsDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/student/photo', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to remove photo.');
      }

      setSuccessMsg('Profile photo removed.');
      setSelectedFile(null);
      setPreviewUrl(null);
      setCroppedCanvasBlob(null);
      onPhotoUpdated(null);

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while removing photo.');
    } finally {
      setIsDeleting(false);
    }
  };

  const activePhotoSrc = previewUrl || currentPhotoUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {currentPhotoUrl ? 'Manage Profile Photo' : 'Upload Profile Photo'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{studentName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={uploading || isDeleting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-6 flex flex-col items-center justify-center">
          {/* Avatar Preview */}
          <div className="relative group">
            <StudentAvatar
              src={activePhotoSrc}
              name={studentName}
              size="3xl"
              className="ring-4 ring-slate-800 shadow-xl"
            />
            {previewUrl && (
              <span className="absolute bottom-1 right-1 bg-emerald-500 text-white p-1 rounded-full text-xs shadow-md">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-4 text-center">
            Upload JPG, PNG, or WEBP (Max size 2 MB).<br />
            Photos are automatically cropped to 400x400 square.
          </p>

          {/* Action Buttons: Gallery or Camera */}
          <div className="grid grid-cols-2 gap-3 w-full mt-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isDeleting}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700/60 transition shadow-sm"
            >
              <Upload className="w-4 h-4 text-blue-400" />
              Choose Photo
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading || isDeleting}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700/60 transition shadow-sm"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              Take Camera Photo
            </button>
          </div>

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="user"
            className="hidden"
          />

          {/* Progress Bar */}
          {uploading && (
            <div className="w-full mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Uploading to cloud storage...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Messages */}
          {errorMsg && (
            <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs w-full">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs w-full">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          {(currentPhotoUrl || previewUrl) ? (
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={uploading || isDeleting}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium py-2 px-3 rounded-lg hover:bg-rose-500/10 transition"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Remove Photo
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading || isDeleting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>

            {croppedCanvasBlob && (
              <button
                type="button"
                onClick={handleSavePhoto}
                disabled={uploading || isDeleting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Photo'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

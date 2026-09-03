'use client';

import { useState, useEffect, useRef } from 'react';
import {
  scanBarcodeLookupAction,
  saveStudentMaterialsAction,
} from '@/app/actions';
import {
  Camera,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  BookOpen,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';
import StudentAvatar from '@/components/StudentAvatar';

interface StudentInfo {
  id: number;
  studentName: string;
  registerNumber: string;
  year: string;
  section: string;
  department: string;
  profilePhotoUrl?: string | null;
  barcodeValue?: string | null;
}

interface MaterialItem {
  id?: number;
  materialName: string;
  quantity: number;
}

const DEFAULT_MATERIALS = [
  'Books',
  'Notes / Notebooks',
  'Record Notes',
  'Lab Manuals',
];

export default function ScanBarcodePage() {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Scanned Student & Materials State
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [savingMaterials, setSavingMaterials] = useState(false);

  // Reference for html5-qrcode instance
  const html5QrCodeRef = useRef<any>(null);
  const isComponentMounted = useRef(true);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      stopCameraScanner();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'camera' && !student) {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }
  }, [activeTab, student]);

  const startCameraScanner = async () => {
    setCameraError(null);
    setScanError(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Stop existing if running
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode('barcode-reader-view');
      html5QrCodeRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 280, height: 180 } };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText: string) => {
          if (decodedText && isComponentMounted.current) {
            // Lock scan result and stop scanner to avoid continuous scans
            stopCameraScanner();
            handleProcessBarcode(decodedText.trim());
          }
        },
        () => {
          // Frame error ignored
        }
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error('Camera barcode scan error:', err);
      setIsScanning(false);
      if (err?.name === 'NotAllowedError' || err?.toString().includes('Permission')) {
        setCameraError('Camera access denied. Please grant camera permission in your browser or use the image upload option.');
      } else {
        setCameraError('Unable to start live camera scanner. Please check your camera permissions or use image upload.');
      }
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.error('Error stopping barcode reader:', e);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLookupLoading(true);
    setScanError(null);

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const codeReader = new BrowserMultiFormatReader();
      const imageUrl = URL.createObjectURL(file);

      try {
        const result = await codeReader.decodeFromImageUrl(imageUrl);
        if (result && result.getText()) {
          const decoded = result.getText().trim();
          URL.revokeObjectURL(imageUrl);
          await handleProcessBarcode(decoded);
          return;
        }
      } catch (err) {
        try {
          const { Html5Qrcode } = await import('html5-qrcode');
          const html5QrCode = new Html5Qrcode('barcode-reader-view-hidden');
          const decodedText = await html5QrCode.scanFile(file, true);
          if (decodedText) {
            URL.revokeObjectURL(imageUrl);
            await handleProcessBarcode(decodedText.trim());
            return;
          }
        } catch (innerErr) {
          // both failed
        }
        URL.revokeObjectURL(imageUrl);
      }

      setScanError('No barcode detected in the uploaded image. Please ensure the barcode on the ID card is clear and well-lit.');
    } catch (err) {
      setScanError('Error processing image file.');
    } finally {
      setLookupLoading(false);
      e.target.value = '';
    }
  };

  const handleProcessBarcode = async (barcodeVal: string) => {
    if (!barcodeVal) return;
    setLookupLoading(true);
    setScanError(null);
    setSaveSuccess(null);

    try {
      const result = await scanBarcodeLookupAction(barcodeVal);
      if (result.success && result.student) {
        setStudent(result.student);

        // Pre-fill materials list: existing DB records combined with defaults if missing
        const dbMaterialsMap = new Map<string, number>();
        (result.materials || []).forEach((m: any) => {
          dbMaterialsMap.set(m.materialName, m.quantity);
        });

        const merged: MaterialItem[] = DEFAULT_MATERIALS.map((name) => ({
          materialName: name,
          quantity: dbMaterialsMap.has(name) ? dbMaterialsMap.get(name)! : 0,
        }));

        // Add any custom items saved previously that aren't in defaults
        (result.materials || []).forEach((m: any) => {
          if (!DEFAULT_MATERIALS.includes(m.materialName)) {
            merged.push({
              materialName: m.materialName,
              quantity: m.quantity,
            });
          }
        });

        setMaterials(merged);
      } else {
        setStudent(null);
        setMaterials([]);
        setScanError(result.error || 'Student not found / Barcode not registered');
      }
    } catch (err) {
      console.error('Barcode lookup failed:', err);
      setScanError('Failed to search barcode.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      handleProcessBarcode(manualBarcode.trim());
    }
  };

  const handleQuantityChange = (index: number, val: number) => {
    const validVal = Math.max(0, Math.floor(val || 0));
    setMaterials((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: validVal } : item))
    );
  };

  const handleAddCustomMaterial = () => {
    const name = prompt('Enter new material name (e.g. Workshop Tools, Drawing Sheet):');
    if (name && name.trim()) {
      const cleanName = name.trim();
      if (!materials.some((m) => m.materialName.toLowerCase() === cleanName.toLowerCase())) {
        setMaterials((prev) => [...prev, { materialName: cleanName, quantity: 0 }]);
      }
    }
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveMaterials = async () => {
    if (!student) return;
    setSavingMaterials(true);
    setSaveSuccess(null);
    setScanError(null);

    try {
      const res = await saveStudentMaterialsAction(student.id, materials);
      if (res.success) {
        setSaveSuccess('College materials saved successfully!');
      } else {
        setScanError(res.error || 'Failed to save materials.');
      }
    } catch (err) {
      setScanError('An error occurred while saving materials.');
    } finally {
      setSavingMaterials(false);
    }
  };

  const handleScanAgain = () => {
    setStudent(null);
    setMaterials([]);
    setSaveSuccess(null);
    setScanError(null);
    setManualBarcode('');
    if (activeTab === 'camera') {
      startCameraScanner();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-slate-800 light:border-slate-200 shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 light:text-slate-900 tracking-tight flex items-center gap-2">
            <Camera className="w-6 h-6 text-indigo-400" />
            <span>Scan Student ID Barcode</span>
          </h2>
          <p className="text-xs text-slate-400 light:text-slate-600 mt-1">
            Scan or upload a college ID card barcode to identify students and manage allocated college materials.
          </p>
        </div>

        {student && (
          <button
            onClick={handleScanAgain}
            className="btn-gradient flex items-center justify-center gap-2 px-4 py-2.5 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 text-xs cursor-pointer hover:scale-105 transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Scan Another ID Card</span>
          </button>
        )}
      </div>

      {!student ? (
        <div className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 shadow-xl p-6 space-y-6">
          {/* Scanning Mode Tabs */}
          <div className="flex bg-slate-950/60 light:bg-slate-100 p-1.5 rounded-2xl border border-slate-800 light:border-slate-200 max-w-md mx-auto">
            <button
              onClick={() => setActiveTab('camera')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'camera'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 light:text-slate-600 hover:text-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Live Camera</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 light:text-slate-600 hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload Photo</span>
            </button>

            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 light:text-slate-600 hover:text-slate-200'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Manual Entry</span>
            </button>
          </div>

          {scanError && (
            <div className="max-w-md mx-auto p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{scanError}</span>
            </div>
          )}

          {lookupLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
              <p className="text-xs font-bold text-slate-300 light:text-slate-700">Finding student record...</p>
            </div>
          )}

          {!lookupLoading && activeTab === 'camera' && (
            <div className="flex flex-col items-center justify-center max-w-md mx-auto">
              <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border-2 border-indigo-500/40 shadow-inner flex items-center justify-center">
                <div id="barcode-reader-view" className="w-full h-full" />
                {!isScanning && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 p-4 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
                    <p className="text-xs text-slate-300 font-bold">Initializing camera stream...</p>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="mt-4 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-medium text-center space-y-2">
                  <p>{cameraError}</p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-500"
                  >
                    Switch to Upload Photo
                  </button>
                </div>
              )}

              <p className="text-[11px] text-slate-500 mt-4 text-center font-medium">
                Hold the college ID card barcode steadily in front of the camera lens.
              </p>
            </div>
          )}

          {!lookupLoading && activeTab === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 max-w-md mx-auto border-2 border-dashed border-slate-700 light:border-slate-300 rounded-3xl bg-slate-950/30 light:bg-slate-50 p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200 light:text-slate-800">Upload ID Card Image</h4>
                <p className="text-xs text-slate-400 light:text-slate-600 mt-1">
                  Upload a clear photo of the student's college ID card barcode (CODE_128, CODE_39, EAN, QR).
                </p>
              </div>
              <label className="btn-gradient px-5 py-2.5 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-indigo-600/20 hover:scale-105 transition">
                <span>Select Image File</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <div id="barcode-reader-view-hidden" style={{ display: 'none' }} />
            </div>
          )}

          {!lookupLoading && activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="max-w-md mx-auto space-y-4 py-6">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1.5">
                  Enter Barcode Value
                </label>
                <input
                  type="text"
                  required
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="e.g. BAR123456789"
                  className="w-full px-4 py-3 bg-slate-950/60 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-2xl text-slate-100 light:text-slate-900 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="w-full btn-gradient py-3 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                Search Barcode Record
              </button>
            </form>
          )}
        </div>
      ) : (
        /* Scanned Student Information & College Materials Workspace */
        <div className="space-y-6">
          {/* Student Profile Card */}
          <div className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <StudentAvatar
                src={student.profilePhotoUrl}
                name={student.studentName}
                size="lg"
                className="border-2 border-indigo-500/40 shadow-lg"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-100 light:text-slate-900">{student.studentName}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/10 text-indigo-400 light:text-indigo-600 border border-indigo-500/20">
                    Verified ID
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 light:text-slate-600 font-medium">
                  <p>Roll No: <span className="font-mono font-bold text-indigo-400 light:text-indigo-600">{student.registerNumber}</span></p>
                  <p>Dept: <span className="font-bold text-slate-200 light:text-slate-800">{student.department}</span></p>
                  <p>Year/Sec: <span className="font-bold text-slate-200 light:text-slate-800">{student.year} - {student.section}</span></p>
                </div>
                {student.barcodeValue && (
                  <p className="text-[11px] font-mono text-slate-500">
                    Barcode: <span className="text-slate-300 light:text-slate-700">{student.barcodeValue}</span>
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleScanAgain}
              className="px-4 py-2.5 bg-slate-800 light:bg-slate-200 hover:bg-slate-700 light:hover:bg-slate-300 text-slate-200 light:text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer border border-slate-700 light:border-slate-300 shrink-0"
            >
              Scan Different Student
            </button>
          </div>

          {/* College Materials Manager */}
          <div className="glass-card rounded-3xl border border-slate-800 light:border-slate-200 p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 light:border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 light:text-slate-900">College Materials Allocated</h3>
                  <p className="text-xs text-slate-400 light:text-slate-600">Update and track items issued to {student.studentName}.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddCustomMaterial}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 light:bg-slate-200 hover:bg-slate-700 light:hover:bg-slate-300 text-slate-200 light:text-slate-800 font-bold rounded-xl text-xs cursor-pointer border border-slate-700 light:border-slate-300"
              >
                <Plus className="w-4 h-4" />
                <span>Add Material Item</span>
              </button>
            </div>

            {saveSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {scanError && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {materials.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-200 rounded-2xl space-x-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs">
                      {idx + 1}
                    </div>
                    <span className="text-xs font-bold text-slate-200 light:text-slate-800 truncate">{item.materialName}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Qty:</label>
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value))}
                        className="w-20 px-3 py-1.5 bg-slate-900 light:bg-white border border-slate-700 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {!DEFAULT_MATERIALS.includes(item.materialName) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMaterial(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-800 light:border-slate-200 flex justify-end">
              <button
                onClick={handleSaveMaterials}
                disabled={savingMaterials}
                className="btn-gradient flex items-center gap-2 px-6 py-3 text-white font-bold rounded-2xl text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer hover:scale-105 disabled:opacity-50"
              >
                {savingMaterials ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Materials...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Materials Record</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

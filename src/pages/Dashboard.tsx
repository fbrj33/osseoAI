import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Upload,
  ZoomIn,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { API, useAuth } from '@/src/hooks/useAuth';

function resolveMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) {
    return import.meta.env.DEV ? path : `${API}${path}`;
  }
  return import.meta.env.DEV ? `/${path}` : `${API}/${path}`;
}

interface HistoryRow {
  study_uid?: string;
  analysis_id: string;
  confidence?: number;
  created_at: string;
  study_images_count?: number;
  fracture?: boolean;
  model_used?: string;
  gradcam_path?: string;
  image_path?: string;
  filename: string;
  patient_name?: string;
  bone_type?: string;
}

const BONE_OPTIONS = ['shoulder', 'wrist', 'elbow', 'finger', 'forearm', 'hand', 'humerus'];

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [boneType, setBoneType] = useState('');

  const [batchMeta, setBatchMeta] = useState<any>(null);
  const [batchSummary, setBatchSummary] = useState<any>(null);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const [folderName, setFolderName] = useState('');
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [patientForm, setPatientForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    notes: '',
  });
  const [currentPatientId, setCurrentPatientId] = useState<number | null>(null);
  const [manualPatientName, setManualPatientName] = useState('');
  const [tempAnalysisData, setTempAnalysisData] = useState<any>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const patientId = searchParams.get('patient_id');
  const patientName = searchParams.get('patient_name');

  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (!selected.length) { toast.error('Please select image files'); return; }
    if (!patientId) {
      const firstFile = selected[0] as any;
      const relativePath = firstFile.webkitRelativePath || '';
      const folder = relativePath.split('/')[0] || 'Unknown';
      setFolderName(folder);
    }
    setFiles(selected);
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const slice = selected.slice(0, 6);
    const previewUrls = slice.map((f) => URL.createObjectURL(f));
    previewUrlsRef.current = previewUrls;
    setPreviews(previewUrls);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      let patient_id = currentPatientId;
      if (!patient_id) {
        const fd = new FormData();
        Object.entries(patientForm).forEach(([k, v]) => fd.append(k, v));
        const createRes = await fetch(`${API}/api/patients`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!createRes.ok) {
          const errorData = await createRes.json();
          throw new Error(errorData.detail || 'Failed to create patient');
        }
        const newPatient = await createRes.json();
        patient_id = newPatient.id;
        toast.success('Patient created successfully');
      } else {
        const fd = new FormData();
        Object.entries(patientForm).forEach(([k, v]) => fd.append(k, v));
        const updateRes = await fetch(`${API}/api/patients/${patient_id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!updateRes.ok) throw new Error('Failed to update patient');
        toast.success('Patient information updated successfully');
      }
      if (tempAnalysisData) {
        try {
          const saveRes = await fetch(`${API}/api/patients/${patient_id}/save-analysis`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(tempAnalysisData),
          });
          if (!saveRes.ok) {
            const errorData = await saveRes.json();
            throw new Error(errorData.detail || 'Failed to save analysis');
          }
          toast.success('Analysis saved successfully');
          setTempAnalysisData(null);
        } catch (analysisErr: any) {
          toast.error('Analysis save failed: ' + analysisErr.message);
        }
      }
      setShowPatientForm(false);
      setCurrentPatientId(null);
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length) { toast.error('Please select at least one X-ray image'); return; }
    setUploading(true);
    setBatchMeta(null);
    setBatchSummary(null);
    setBatchResults([]);
    setSelectedResult(null);
    setAnalysisResults([]);
    setShowPatientForm(false);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      files.forEach((f) => {
        fd.append('files', f);
        fd.append('file_relative_paths', (f as any).webkitRelativePath || f.name);
      });
      if (boneType) fd.append('bone_type', boneType);
      let res, data;
      if (patientId) {
        fd.append('patient_id', patientId);
        res = await fetch(`${API}/api/patients/${patientId}/analyze`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        data = await res.json();
        if (!res.ok || data.detail) throw new Error(data.detail || 'Analysis failed');
        const results = Array.isArray(data.results) ? data.results : [];
        const summary = data.summary || null;
        const highlighted = results.find((r) => r.selected_for_gradcam) || results[0] || null;
        setBatchMeta({
          bone_type: data.bone_type || highlighted?.bone_type || '',
          bone_confidence: Number(data.bone_confidence ?? highlighted?.bone_confidence ?? 0),
          model_used: data.model_used || highlighted?.model_used || 'specialist',
          routing_source: data.routing_source || 'general_router',
        });
        setBatchSummary(summary);
        setBatchResults(results);
        setSelectedResult(highlighted);
        toast.success('Study analysis complete', {
          description: `${summary?.images_count ?? results.length} image(s), ${summary?.fracture_count ?? 0} flagged`,
        });
      } else {
        if (manualPatientName.trim()) {
          fd.append('patient_name', manualPatientName.trim());
        } else if (folderName) {
          fd.append('patient_name', folderName);
        }
        res = await fetch(`${API}/api/analyze-batch-temp`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        data = await res.json();
        if (!res.ok || data.detail) throw new Error(data.detail || 'Analysis failed');
        const results = Array.isArray(data.results) ? data.results : [];
        const summary = data.summary || null;
        const highlighted = results.find((r: any) => r.selected_for_gradcam) || results[0] || null;
        setBatchMeta({
          bone_type: data.bone_type || highlighted?.bone_type || '',
          bone_confidence: Number(data.bone_confidence ?? highlighted?.bone_confidence ?? 0),
          model_used: data.model_used || highlighted?.model_used || 'specialist',
          routing_source: data.routing_source || 'general_router',
        });
        setBatchSummary(summary);
        setBatchResults(results);
        setSelectedResult(highlighted);
        setAnalysisResults([]);
        setTempAnalysisData({
          study_uid: data.study_uid,
          bone_type: data.bone_type,
          bone_confidence: data.bone_confidence,
          router_probability: data.router_probability,
          model_used: data.model_used,
          selected_index: data.selected_index,
          summary: data.summary,
          results: data.results,
          file_bytes: data.file_bytes,
          fracture: data.summary?.fracture_detected || false,
          confidence: data.summary?.study_confidence || 0,
          probability: data.summary?.study_probability || 0,
          threshold: data.summary?.threshold || 0.5,
        });
        setCurrentPatientId(null);
        setPatientForm({
          full_name: manualPatientName.trim() || folderName || '',
          date_of_birth: '',
          gender: '',
          phone: '',
          notes: '',
        });
        setShowPatientForm(true);
        toast.success('Analysis complete', {
          description: `${summary?.images_count ?? results.length} image(s) analyzed. Please fill in patient information.`,
        });
      }
      setFiles([]);
      setPreviews([]);
      setBoneType('');
      setFolderName('');
      setManualPatientName('');
    } catch (err: any) {
      toast.error('Analysis failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const studyFracture = Boolean(batchSummary?.fracture_detected);
  const studyConfidence = Number(batchSummary?.study_confidence ?? selectedResult?.confidence ?? 0);
  const studyImagesCount = Number(batchSummary?.images_count ?? batchResults.length);
  const outputPath = selectedResult?.gradcam_path || selectedResult?.image_path || '';

  return (
    <div className="p-8 flex flex-col gap-6">
      {/* Lightbox overlay */}
      {lightboxOpen && outputPath && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={resolveMediaUrl(outputPath)}
            alt="Grad-CAM full view"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl font-light"
          >
            ✕
          </button>
        </div>
      )}

      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#f0f0f2] mb-1">
            {patientName ? `Patient: ${patientName}` : 'Doctor Dashboard'}
          </h1>
          <p className="text-sm text-[#a1a1aa]">
            {patientId
              ? 'Upload one folder or multiple X-rays. One router decision is used for the whole study.'
              : 'Upload folders containing X-ray images. Patient records will be created automatically from folder names.'}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-[#16161a] px-4 py-2 rounded-full border border-[#2d2d35]">
          <div className="w-2 h-2 rounded-full bg-[#10b981]" />
          <span className="text-sm font-medium text-[#f0f0f2]">Dr. {user?.full_name}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* ── Upload Panel ── */}
        <section className="bg-[#16161a] rounded-2xl border border-[#2d2d35] p-6 flex flex-col gap-5">
          <div
            className="border-2 border-dashed border-[#2d2d35] rounded-xl p-8 text-center flex flex-col items-center gap-3 cursor-pointer hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-all"
            onClick={() => document.getElementById('xray-upload')?.click()}
          >
            {previews.length > 0 ? (
              <div className="w-full space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {previews.map((src, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-[#2d2d35]">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#3b82f6] font-medium">
                  {files.length} image(s) selected{folderName ? ` from folder: ${folderName}` : ''}
                </p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-[#1e1e24] rounded-xl flex items-center justify-center">
                  <Upload className="h-6 w-6 text-[#a1a1aa]" />
                </div>
                <p className="text-sm font-medium text-[#f0f0f2]">
                  {patientId ? 'Upload X-ray Images' : 'Upload X-ray Folders'}
                </p>
                <p className="text-xs text-[#a1a1aa]">
                  {patientId
                    ? 'PNG/JPG files, single image or full study folder'
                    : 'Select folders containing X-ray images. Folder names will become patient names.'}
                </p>
              </>
            )}
            <input
              id="xray-upload"
              type="file"
              className="hidden"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              {...(patientId ? {} : ({ webkitdirectory: '' } as any))}
            />
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase text-[#a1a1aa] tracking-wider">
                Bone Type{' '}
                <span className="normal-case font-normal">
                  {patientId ? '(optional override)' : '(optional — auto-detected)'}
                </span>
              </label>
              <select
                value={boneType}
                onChange={(e) => setBoneType(e.target.value)}
                className="w-full mt-1 bg-[#1e1e24] border border-[#2d2d35] text-[#f0f0f2] rounded-md h-10 px-3 text-sm"
              >
                <option value="">{patientId ? 'Auto-detect from study' : 'Auto-detect from image'}</option>
                {BONE_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-[#3b82f6]/5 border border-[#3b82f6]/10 rounded-xl flex gap-2 text-[10px] text-[#3b82f6]">
              <BrainCircuit className="w-4 h-4 shrink-0" />
              {patientId
                ? 'General model runs once for the study to choose bone type, then each image uses that specialist model.'
                : 'General model detects bone type automatically, then routes to the specialist model for accurate fracture detection.'}
            </div>

            {!patientId && (
              <div>
                <label className="text-[11px] font-bold uppercase text-[#a1a1aa] tracking-wider">
                  Patient Name <span className="normal-case font-normal">(required)</span>
                </label>
                <Input
                  value={manualPatientName}
                  onChange={(e) => setManualPatientName(e.target.value)}
                  placeholder="Enter patient name or folder name will be used"
                  className="w-full mt-1 bg-[#1e1e24] border-[#2d2d35] text-[#f0f0f2] h-10 text-sm"
                />
              </div>
            )}

            <Button
              className="w-full bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-bold h-12"
              type="submit"
              disabled={uploading || !files.length}
            >
              {uploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
              ) : patientId ? 'Run Batch Analysis' : 'Run Analysis'}
            </Button>
          </form>

          {/* Patient Information Form */}
          {showPatientForm && (
            <div className="bg-[#1e1e24] border border-[#2d2d35] rounded-xl p-4">
              <h4 className="text-sm font-semibold text-[#f0f0f2] mb-3">Patient Information</h4>
              <form onSubmit={handleSavePatient} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#a1a1aa] font-medium">Full Name</label>
                    <Input
                      value={patientForm.full_name}
                      onChange={(e) => setPatientForm({ ...patientForm, full_name: e.target.value })}
                      className="bg-[#16161a] border-[#2d2d35] text-[#f0f0f2] h-8 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#a1a1aa] font-medium">Date of Birth</label>
                    <Input
                      type="date"
                      value={patientForm.date_of_birth}
                      onChange={(e) => setPatientForm({ ...patientForm, date_of_birth: e.target.value })}
                      className="bg-[#16161a] border-[#2d2d35] text-[#f0f0f2] h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#a1a1aa] font-medium">Gender</label>
                    <select
                      value={patientForm.gender}
                      onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}
                      className="w-full bg-[#16161a] border border-[#2d2d35] text-[#f0f0f2] rounded-md h-8 px-3 text-sm"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#a1a1aa] font-medium">Phone</label>
                    <Input
                      value={patientForm.phone}
                      onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                      className="bg-[#16161a] border-[#2d2d35] text-[#f0f0f2] h-8 text-sm"
                      placeholder="+213..."
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#a1a1aa] font-medium">Notes</label>
                  <textarea
                    value={patientForm.notes}
                    onChange={(e) => setPatientForm({ ...patientForm, notes: e.target.value })}
                    className="w-full bg-[#16161a] border border-[#2d2d35] text-[#f0f0f2] rounded-md h-20 px-3 py-2 text-sm resize-none"
                    placeholder="Additional notes..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white h-8 text-sm">
                    Save Patient Info
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPatientForm(false)}
                    className="border-[#2d2d35] text-[#a1a1aa] hover:bg-[#1e1e24] h-8 text-sm"
                  >
                    Skip
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Analysis Results for folder upload */}
          {analysisResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[#f0f0f2]">Analysis Results</h4>
              {analysisResults.map((result, index) => (
                <div key={index} className={`p-4 rounded-xl border ${result.fracture ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {result.fracture ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    <span className={`font-bold text-sm ${result.fracture ? 'text-red-400' : 'text-emerald-400'}`}>
                      {result.fracture ? 'FRACTURE DETECTED' : 'NORMAL — No Fracture'}
                    </span>
                  </div>
                  <div className="text-xs text-[#a1a1aa] space-y-1">
                    <p>File: <span className="text-[#f0f0f2] font-medium">{result.filename}</span></p>
                    <p>Bone Region: <span className="text-[#f0f0f2] font-medium capitalize">{result.bone_type}</span></p>
                    <p>Confidence: <span className="text-[#f0f0f2] font-medium">{result.confidence}%</span></p>
                    <p>Bone Detection: <span className="text-[#f0f0f2] font-medium">{result.bone_confidence}%</span></p>
                    <p>Model: <span className="text-[#f0f0f2] font-medium capitalize">{result.model_used}</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Output / Result Panel ── */}
        <section className="bg-[#16161a] rounded-2xl border border-[#2d2d35] overflow-hidden flex flex-col">
          {(batchSummary || selectedResult) ? (
            <div className={`flex flex-col h-full rounded-2xl border-2 overflow-hidden ${
              studyFracture
                ? 'border-red-500/40 bg-gradient-to-b from-red-950/40 to-[#16161a]'
                : 'border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 to-[#16161a]'
            }`}>
              {/* Status banner */}
              <div className={`px-6 py-4 flex items-center gap-4 ${
                studyFracture ? 'bg-red-500/20' : 'bg-emerald-500/20'
              }`}>
                {studyFracture ? (
                  <AlertTriangle className="w-8 h-8 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                )}
                <div>
                  <p className={`font-bold text-xl leading-tight ${studyFracture ? 'text-red-300' : 'text-emerald-300'}`}>
                    {studyFracture ? 'Fracture Detected' : 'Study Normal'}
                  </p>
                  <p className="text-sm text-[#a1a1aa]">
                    {studyImagesCount} image(s) · <span className="capitalize">{batchMeta?.bone_type || '-'}</span> · Model: {batchMeta?.model_used || '-'}
                  </p>
                </div>

              </div>

              {/* Grad-CAM image — fills available space */}
              {outputPath && (
                <div
                  className="relative cursor-zoom-in group flex-1"
                  onClick={() => setLightboxOpen(true)}
                >
                  <img
                    src={resolveMediaUrl(outputPath)}
                    alt="Grad-CAM output"
                    className="w-full h-full object-contain"
                    style={{ minHeight: '320px', maxHeight: '520px' }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-4">
                      <ZoomIn className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
                    Grad-CAM · Click to enlarge
                  </div>
                </div>
              )}

              {/* Meta grid */}
              <div className="px-6 py-4 grid grid-cols-3 gap-x-6 gap-y-2 text-sm border-t border-[#2d2d35]">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#6b6b78] mb-0.5">Bone Router</p>
                  <p className="text-[#f0f0f2] font-semibold">{Number(batchMeta?.bone_confidence || 0).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#6b6b78] mb-0.5">Routing</p>
                  <p className="text-[#f0f0f2] font-semibold">{batchMeta?.routing_source || 'general_router'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#6b6b78] mb-0.5">Decision Basis</p>
                  <p className="text-[#f0f0f2] font-semibold truncate">{batchSummary?.decision_basis || 'mil_study_probability'}</p>
                </div>
                {selectedResult && (
                  <div className="col-span-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#6b6b78] mb-0.5">Selected Image</p>
                    <p className="text-[#f0f0f2] font-semibold truncate">{selectedResult.filename} ({selectedResult.confidence}%)</p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {outputPath && (
                <div className="px-6 pb-5 flex gap-3">
                  <a
                    href={resolveMediaUrl(outputPath)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#2d2d35] text-[#f0f0f2] text-sm font-medium hover:bg-[#1e1e24] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" /> Open Output
                  </a>
                  <a
                    href={resolveMediaUrl(outputPath)}
                    download
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#2d2d35] text-[#f0f0f2] text-sm font-medium hover:bg-[#1e1e24] transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                </div>
              )}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
              <div className="w-20 h-20 rounded-2xl bg-[#1e1e24] border border-[#2d2d35] flex items-center justify-center mb-4">
                <BrainCircuit className="w-10 h-10 text-[#2d2d35]" />
              </div>
              <p className="text-base font-semibold text-[#f0f0f2] mb-1">No analysis yet</p>
              <p className="text-sm text-[#6b6b78]">Upload X-ray images and run an analysis to see the Grad-CAM output and fracture detection results here.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
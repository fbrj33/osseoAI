import React, { useState, useEffect } from 'react';
import { FileText, Activity, AlertTriangle, CheckCircle2, Loader2, RefreshCw, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { API } from '@/src/hooks/useAuth';

function resolveMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return import.meta.env.DEV ? path : `${API}${path}`;
  return import.meta.env.DEV ? `/${path}` : `${API}/${path}`;
}

// ── Patient detail modal (reused from Patients page) ─────────────────────────
const PatientModal: React.FC<{ patientId: number; patientName: string; onClose: () => void }> = ({
  patientId, patientName, onClose,
}) => {
  const [patient, setPatient]   = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const [pRes, aRes] = await Promise.all([
          fetch(`${API}/api/patients/${patientId}`, { headers }),
          fetch(`${API}/api/patients/${patientId}/analyses`, { headers }),
        ]);
        const pData = await pRes.json();
        const aData = await aRes.json();
        setPatient(pData);
        setAnalyses(Array.isArray(aData) ? aData : []);
      } catch {
        toast.error('Failed to load patient file');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [patientId]);

  return (
    <>
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full view" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl">✕</button>
        </div>
      )}

      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[#16161a] border border-[#2d2d35] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2d35] sticky top-0 bg-[#16161a] z-10">
            <div>
              <h2 className="text-lg font-bold text-[#f0f0f2]">{patientName}</h2>
              <p className="text-xs text-[#a1a1aa]">Patient File</p>
            </div>
            <button onClick={onClose} className="text-[#a1a1aa] hover:text-[#f0f0f2] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]" /></div>
          ) : (
            <>
              {/* Patient info */}
              {patient && (
                <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[#2d2d35]">
                  {[
                    { label: 'Date of Birth', value: patient.date_of_birth || '—' },
                    { label: 'Gender', value: patient.gender || '—' },
                    { label: 'Phone', value: patient.phone || '—' },
                    { label: 'Registered', value: new Date(patient.created_at).toLocaleDateString() },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] uppercase tracking-widest text-[#6b6b78] mb-0.5">{label}</p>
                      <p className="text-sm text-[#f0f0f2] font-medium capitalize">{value}</p>
                    </div>
                  ))}
                  {patient.notes && (
                    <div className="col-span-2 sm:col-span-4">
                      <p className="text-[10px] uppercase tracking-widest text-[#6b6b78] mb-0.5">Notes</p>
                      <p className="text-sm text-[#a1a1aa]">{patient.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Analyses */}
              <div className="px-6 py-4">
                <h3 className="text-sm font-bold text-[#f0f0f2] mb-3">Analysis History</h3>
                {analyses.length === 0 ? (
                  <p className="text-sm text-[#a1a1aa] text-center py-8">No analyses found for this patient.</p>
                ) : (
                  <div className="space-y-4">
                    {analyses.map((a: any, i: number) => {
                      const imgPath = a.gradcam_path || a.image_path || '';
                      return (
                        <div key={i} className={`rounded-xl border overflow-hidden ${a.fracture ? 'border-red-500/30 bg-red-950/20' : 'border-emerald-500/30 bg-emerald-950/20'}`}>
                          <div className={`px-4 py-3 flex items-center gap-3 ${a.fracture ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                            {a.fracture
                              ? <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                              : <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-sm ${a.fracture ? 'text-red-300' : 'text-emerald-300'}`}>
                                {a.fracture ? 'Fracture Detected' : 'Normal'}
                              </p>
                              <p className="text-xs text-[#a1a1aa] truncate">
                                <span className="capitalize">{a.bone_type}</span>
                                {a.filename ? ` · ${a.filename}` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-xl font-black tabular-nums ${a.fracture ? 'text-red-400' : 'text-emerald-400'}`}>
                                {Number(a.confidence || 0).toFixed(0)}%
                              </p>
                              <p className="text-[10px] text-[#6b6b78]">
                                {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>

                          {imgPath && (
                            <div className="relative cursor-zoom-in group" onClick={() => setLightbox(resolveMediaUrl(imgPath))}>
                              <img
                                src={resolveMediaUrl(imgPath)}
                                alt="Grad-CAM"
                                className="w-full object-contain bg-black"
                                style={{ maxHeight: '260px' }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full px-3 py-1 text-white text-xs">
                                  Click to enlarge
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="px-4 py-2 grid grid-cols-3 gap-2 text-xs border-t border-[#2d2d35]/50">
                            <div><p className="text-[#6b6b78]">Model</p><p className="text-[#f0f0f2] capitalize">{a.model_used || 'specialist'}</p></div>
                            <div><p className="text-[#6b6b78]">Bone conf.</p><p className="text-[#f0f0f2]">{Number(a.bone_confidence || 0).toFixed(1)}%</p></div>
                            <div><p className="text-[#6b6b78]">Images</p><p className="text-[#f0f0f2]">{a.study_images_count || 1}</p></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ── Reports page ──────────────────────────────────────────────────────────────
const Reports: React.FC = () => {
  const [history, setHistory]     = useState<any[]>([]);
  const [stats, setStats]         = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [selectedCase, setSelectedCase] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token   = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [histRes, statRes] = await Promise.all([
        fetch(`${API}/api/history?limit=100`, { headers }),
        fetch(`${API}/api/stats`,             { headers }),
      ]);

      const histData = await histRes.json();
      const statData = await statRes.json();

      setHistory(Array.isArray(histData) ? histData : []);
      setStats(statData.total_analyses !== undefined ? statData : null);
    } catch (err: any) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const caseHistory = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const row of history) {
      const key = row.patient_id ? `patient_${row.patient_id}` : row.study_uid || `analysis_${row.analysis_id}`;
      const confidence = Number(row.confidence || 0);
      const createdAt = row.created_at || new Date().toISOString();
      if (!map.has(key)) {
        map.set(key, { ...row, key, confidence, images_count: Number(row.study_images_count || 1), fracture_count: row.fracture ? 1 : 0, created_at: createdAt });
        continue;
      }
      const existing = map.get(key);
      existing.images_count = Math.max(existing.images_count, Number(row.study_images_count || 1));
      if (row.fracture) existing.fracture_count += 1;
      if (confidence > Number(existing.confidence || 0)) existing.confidence = confidence;
      if (new Date(createdAt).getTime() > new Date(existing.created_at).getTime()) {
        Object.assign(existing, row, { key, confidence: Math.max(confidence, Number(existing.confidence || 0)), images_count: existing.images_count, fracture_count: existing.fracture_count, created_at: createdAt });
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [history]);

  const uniquePatientCount = React.useMemo(() => {
    return new Set(history.map((row) => row.patient_id)).size;
  }, [history]);

  const displayStats = React.useMemo(() => {
    const total = caseHistory.length;
    const fractures = caseHistory.filter(a => a.fracture).length;
    const avgConfidence = total
      ? Math.round((caseHistory.reduce((sum, a) => sum + Number(a.confidence || 0), 0) / total) * 10) / 10
      : 0;
    return {
      total_patients: stats?.total_patients ?? uniquePatientCount,
      total_analyses: total,
      fractures,
      normal: total - fractures,
      avg_confidence: avgConfidence,
    };
  }, [caseHistory, stats, uniquePatientCount]);

  const boneBreakdown = caseHistory.reduce((acc: Record<string, { total: number; fractures: number }>, a) => {
    const bt = a.bone_type || 'unknown';
    if (!acc[bt]) acc[bt] = { total: 0, fractures: 0 };
    acc[bt].total++;
    if (a.fracture) acc[bt].fractures++;
    return acc;
  }, {});

  const boneEntries = (Object.entries(boneBreakdown) as [string, { total: number; fractures: number }][])
    .sort((a, b) => b[1].total - a[1].total);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6 max-w-7xl mx-auto">
      {selectedCase && (
        <PatientModal
          patientId={selectedCase.id}
          patientName={selectedCase.name}
          onClose={() => setSelectedCase(null)}
        />
      )}

      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#f0f0f2] mb-1">Reports & Analytics</h1>
          <p className="text-sm text-[#a1a1aa]">Overview of all your diagnostic analyses</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 text-sm text-[#3b82f6] hover:text-[#3b82f6]/80 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Patients',    value: displayStats.total_patients, icon: Activity,       color: '#3b82f6' },
          { label: 'Total Analyses',    value: displayStats.total_analyses, icon: FileText,       color: '#8b5cf6' },
          { label: 'Fractures Detected',value: displayStats.fractures,      icon: AlertTriangle,  color: '#ef4444' },
          { label: 'Normal Results',    value: displayStats.normal,         icon: CheckCircle2,   color: '#10b981' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#16161a] border border-[#2d2d35] rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <p className="text-xs text-[#a1a1aa] font-bold uppercase tracking-wider">{label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-[#f0f0f2]">{value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Bone breakdown */}
        <div className="bg-[#16161a] border border-[#2d2d35] rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#f0f0f2] uppercase tracking-wider mb-4">By Bone Type</h3>
          {boneEntries.length === 0 ? (
            <p className="text-[#a1a1aa] text-sm text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {boneEntries.map(([bone, { total, fractures }]) => {
                const pct = Math.round((fractures / total) * 100);
                return (
                  <div key={bone}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-[#f0f0f2] capitalize">{bone}</span>
                      <span className="text-[10px] text-[#a1a1aa]">{fractures}/{total} fractures</span>
                    </div>
                    <div className="h-1.5 bg-[#2d2d35] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct > 50 ? '#ef4444' : '#3b82f6' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {displayStats.total_analyses > 0 && (
            <div className="mt-6 pt-4 border-t border-[#2d2d35]">
              <p className="text-[10px] text-[#a1a1aa] uppercase tracking-wider mb-1">Avg Confidence</p>
              <p className="text-2xl font-bold text-[#3b82f6]">{displayStats.avg_confidence}%</p>
            </div>
          )}
        </div>

        {/* History table — clickable patient names */}
        <div className="bg-[#16161a] border border-[#2d2d35] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2d2d35]">
            <h3 className="text-sm font-bold text-[#f0f0f2]">Analysis History</h3>
            <p className="text-xs text-[#a1a1aa] mt-0.5">Last {caseHistory.length} cases · Click a patient name to open their file</p>
          </div>

          <div className="overflow-y-auto max-h-[500px]">
            {caseHistory.length === 0 ? (
              <div className="text-center py-16 text-[#a1a1aa]">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No analyses yet</p>
                <p className="text-xs mt-1">Upload X-rays from the Dashboard to see reports here</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#2d2d35] bg-[#1e1e24]/40">
                    {['Patient', 'Bone', 'Result', 'Confidence', 'Model', 'Date', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2d35]">
                  {caseHistory.map(a => (
                    <tr key={a.key} className="hover:bg-[#1e1e24]/30 transition-colors">
                      <td className="px-4 py-3">
                        {a.patient_id ? (
                          <button
                            onClick={() => setSelectedCase({ id: a.patient_id, name: a.patient_name || '—' })}
                            className="text-sm font-semibold text-[#3b82f6] hover:underline text-left"
                          >
                            {a.patient_name || '—'}
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-[#f0f0f2]">{a.patient_name || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#a1a1aa] capitalize">{a.bone_type}</td>
                      <td className="px-4 py-3">
                        {a.fracture ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertTriangle className="w-3 h-3" /> Fracture
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Normal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[#a1a1aa]">{a.confidence}%</td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa] capitalize">{a.model_used || 'specialist'}</td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa]">
                        {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        {a.patient_id && (
                          <ChevronRight className="w-4 h-4 text-[#a1a1aa]" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { API, useAuth } from '@/src/hooks/useAuth';

function resolveMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return import.meta.env.DEV ? path : `${API}${path}`;
  return import.meta.env.DEV ? `/${path}` : `${API}/${path}`;
}

const PatientModal: React.FC<{ patient: any; onClose: () => void }> = ({ patient, onClose }) => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/api/patients/${patient.id}/analyses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setAnalyses(Array.isArray(data) ? data : []);
      } catch {
        toast.error('Failed to load patient analyses');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalyses();
  }, [patient.id]);

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Full view" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl">✕</button>
        </div>
      )}

      {/* Modal backdrop */}
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-[#16161a] border border-[#2d2d35] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2d35] sticky top-0 bg-[#16161a] z-10">
            <div>
              <h2 className="text-lg font-bold text-[#f0f0f2]">{patient.full_name}</h2>
              <p className="text-xs text-[#a1a1aa]">Patient File</p>
            </div>
            <button onClick={onClose} className="text-[#a1a1aa] hover:text-[#f0f0f2] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Patient info */}
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

          {/* Analyses */}
          <div className="px-6 py-4">
            <h3 className="text-sm font-bold text-[#f0f0f2] mb-3">Analysis History</h3>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" /></div>
            ) : analyses.length === 0 ? (
              <p className="text-sm text-[#a1a1aa] text-center py-8">No analyses found for this patient.</p>
            ) : (
              <div className="space-y-4">
                {analyses.map((a: any, i: number) => {
                  const imgPath = a.gradcam_path || a.image_path || '';
                  return (
                    <div key={i} className={`rounded-xl border overflow-hidden ${a.fracture ? 'border-red-500/30 bg-red-950/20' : 'border-emerald-500/30 bg-emerald-950/20'}`}>
                      {/* Analysis header */}
                      <div className={`px-4 py-3 flex items-center gap-3 ${a.fracture ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                        {a.fracture
                          ? <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                          : <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm ${a.fracture ? 'text-red-300' : 'text-emerald-300'}`}>
                            {a.fracture ? 'Fracture Detected' : 'Normal'}
                          </p>
                          <p className="text-xs text-[#a1a1aa] truncate">
                            {a.bone_type ? <span className="capitalize">{a.bone_type}</span> : null}
                            {a.filename ? ` · ${a.filename}` : null}
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

                      {/* Grad-CAM image */}
                      {imgPath && (
                        <div
                          className="relative cursor-zoom-in group"
                          onClick={() => setLightbox(resolveMediaUrl(imgPath))}
                        >
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

                      {/* Meta */}
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
        </div>
      </div>
    </>
  );
};

const Patients: React.FC = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientDoctorFilter, setPatientDoctorFilter] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  useEffect(() => { fetchPatients(); }, [user]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const endpoint = user?.role === 'admin' ? '/api/admin/patients' : '/api/patients';
      const res = await fetch(`${API}${endpoint}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load patients');
      setPatients(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Failed to load patients: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(p => {
    const query = patientSearch.trim().toLowerCase();
    const matchesSearch = !query || [p.full_name, p.doctor_name, p.phone, p.gender]
      .some(value => String(value || '').toLowerCase().includes(query));
    const matchesDoctor = patientDoctorFilter === 'all' || p.doctor_name === patientDoctorFilter;
    return matchesSearch && matchesDoctor;
  });

  const doctorOptions = Array.from(new Set(patients.map(p => p.doctor_name)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      {selectedPatient && (
        <PatientModal patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
      )}

      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#f0f0f2] mb-1">All Patients</h1>
          <p className="text-sm text-[#a1a1aa]">Every patient registered across all doctors in the system</p>
        </div>
      </header>

      <Card className="bg-[#16161a] border-[#2d2d35] rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 min-w-0">
              <label className="text-xs uppercase tracking-widest text-[#a1a1aa]">Search patients</label>
              <input
                type="search"
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Search by name, doctor, phone, gender..."
                className="mt-2 w-full rounded-xl border border-[#2d2d35] bg-[#0f0f13] px-3 py-2 text-sm text-[#f0f0f2] outline-none transition focus:border-[#3b82f6]"
              />
            </div>
            <div className="w-full lg:w-64">
              <label className="text-xs uppercase tracking-widest text-[#a1a1aa]">Filter by doctor</label>
              <select
                value={patientDoctorFilter}
                onChange={e => setPatientDoctorFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#2d2d35] bg-[#0f0f13] px-3 py-2 text-sm text-[#f0f0f2] outline-none transition focus:border-[#3b82f6]"
              >
                <option value="all">All doctors</option>
                {doctorOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-[#2d2d35] overflow-hidden">
            <Table>
              <TableHeader className="bg-[#1e1e24]">
                <TableRow className="border-[#2d2d35] hover:bg-transparent">
                  {['Patient Name', 'Doctor', 'Date of Birth', 'Gender', 'Phone', 'X-rays', 'Analyses', 'Registered', ''].map(h => (
                    <TableHead key={h} className="text-[#a1a1aa] font-bold uppercase text-[11px] tracking-wider">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-[#a1a1aa]">No patients registered yet</TableCell>
                  </TableRow>
                ) : filteredPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-[#a1a1aa]">No matching patients found</TableCell>
                  </TableRow>
                ) : (
                  filteredPatients.map(p => (
                    <TableRow
                      key={p.id}
                      className="border-[#2d2d35] hover:bg-[#1e1e24]/80 cursor-pointer transition-colors"
                      onClick={() => setSelectedPatient(p)}
                    >
                      <TableCell className="font-semibold text-[#3b82f6] hover:underline">{p.full_name}</TableCell>
                      <TableCell className="text-[#3b82f6] font-medium">Dr. {p.doctor_name}</TableCell>
                      <TableCell className="text-[#a1a1aa] text-sm">{p.date_of_birth || '—'}</TableCell>
                      <TableCell className="text-[#a1a1aa] capitalize">{p.gender || '—'}</TableCell>
                      <TableCell className="text-[#a1a1aa] text-sm">{p.phone || '—'}</TableCell>
                      <TableCell className="text-[#f0f0f2] font-mono">{p.xray_count}</TableCell>
                      <TableCell className="text-[#f0f0f2] font-mono">{p.analysis_count}</TableCell>
                      <TableCell className="text-[#a1a1aa] text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-[#a1a1aa]"><ChevronRight className="w-4 h-4" /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Patients;
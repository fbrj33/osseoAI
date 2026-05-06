import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Activity, CheckCircle2, XCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API } from '@/src/hooks/useAuth';

const Admin: React.FC = () => {
  const [doctors,  setDoctors]  = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actioning, setActioning] = useState<number | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token   = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [drRes, anRes] = await Promise.all([
        fetch(`${API}/api/admin/doctors`,  { headers }),
        fetch(`${API}/api/admin/analyses`, { headers }),
      ]);

      const drData = await drRes.json();
      const anData = await anRes.json();

      setDoctors (Array.isArray(drData) ? drData : []);
      setAnalyses(Array.isArray(anData) ? anData : []);
    } catch (err: any) {
      toast.error('Failed to load admin data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (doctorId: number, approved: boolean) => {
    setActioning(doctorId);
    try {
      const token = localStorage.getItem('token');
      const fd    = new FormData();
      fd.append('doctor_id', String(doctorId));
      fd.append('approved',  String(approved));

      const res  = await fetch(`${API}/api/admin/approve`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');

      toast.success(approved ? 'Doctor approved ✓' : 'Account and all data deleted permanently');
      fetchData();
    } catch (err: any) {
      toast.error('Action failed: ' + err.message);
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#f0f0f2] mb-1">Admin Panel</h1>
          <p className="text-sm text-[#a1a1aa]">Manage users and monitor system-wide activity</p>
        </div>
        <div className="flex items-center gap-3 bg-[#16161a] px-4 py-2 rounded-full border border-[#2d2d35]">
          <ShieldCheck className="h-4 w-4 text-[#3b82f6]" />
          <span className="text-sm font-medium text-[#f0f0f2]">System Administrator</span>
        </div>
      </header>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-[#16161a] border border-[#2d2d35] p-1 h-12 rounded-xl w-fit">
          <TabsTrigger value="users"
            className="gap-2 rounded-lg data-[state=active]:bg-[#1e1e24] data-[state=active]:text-[#f0f0f2] text-[#a1a1aa]">
            <Users className="h-4 w-4" /> User Management
          </TabsTrigger>
          <TabsTrigger value="scans"
            className="gap-2 rounded-lg data-[state=active]:bg-[#1e1e24] data-[state=active]:text-[#f0f0f2] text-[#a1a1aa]">
            <Activity className="h-4 w-4" /> All Analyses
          </TabsTrigger>
        </TabsList>

        {/* ── DOCTORS TAB ── */}
        <TabsContent value="users">
          <Card className="bg-[#16161a] border-[#2d2d35] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-[#f0f0f2]">Doctor Management</CardTitle>
              <CardDescription className="text-[#a1a1aa]">
                Approve doctors or permanently delete their accounts and all associated data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-[#2d2d35] overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#1e1e24]">
                    <TableRow className="border-[#2d2d35] hover:bg-transparent">
                      {['Name', 'Email', 'License', 'Status', 'Joined', 'Actions'].map(h => (
                        <TableHead key={h} className="text-[#a1a1aa] font-bold uppercase text-[11px] tracking-wider">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.filter(d => d.role === 'doctor').length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-[#a1a1aa]">
                          No doctors registered yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      doctors.filter(d => d.role === 'doctor').map(doc => (
                        <TableRow key={doc.id} className="border-[#2d2d35] hover:bg-[#1e1e24]/50">
                          <TableCell className="font-medium text-[#f0f0f2]">{doc.full_name}</TableCell>
                          <TableCell className="text-[#a1a1aa] text-sm">{doc.email}</TableCell>
                          <TableCell className="text-[#a1a1aa] text-sm">{doc.license_no || '—'}</TableCell>
                          <TableCell>
                            {doc.approved ? (
                              <Badge className="bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20">Approved</Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[#a1a1aa] text-sm">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {!doc.approved ? (
                                <Button size="sm"
                                  className="bg-[#10b981] hover:bg-[#10b981]/90 text-white font-bold"
                                  onClick={() => handleApproval(doc.id, true)}
                                  disabled={actioning === doc.id}>
                                  {actioning === doc.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <><CheckCircle2 className="h-4 w-4 mr-1" />Approve</>}
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline"
                                  className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                                  onClick={() => handleApproval(doc.id, false)}
                                  disabled={actioning === doc.id}>
                                  {actioning === doc.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <><XCircle className="h-4 w-4 mr-1" />Delete Account</>}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ANALYSES TAB ── */}
        <TabsContent value="scans">
          <Card className="bg-[#16161a] border-[#2d2d35] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-[#f0f0f2]">All Analyses</CardTitle>
              <CardDescription className="text-[#a1a1aa]">
                Every X-ray analysis across all doctors in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-[#2d2d35] overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#1e1e24]">
                    <TableRow className="border-[#2d2d35] hover:bg-transparent">
                      {['Doctor', 'Patient', 'Bone', 'Result', 'Confidence', 'Date'].map(h => (
                        <TableHead key={h} className="text-[#a1a1aa] font-bold uppercase text-[11px] tracking-wider">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-[#a1a1aa]">
                          No analyses in the system yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      analyses.map(a => (
                        <TableRow key={a.analysis_id} className="border-[#2d2d35] hover:bg-[#1e1e24]/50">
                          <TableCell className="text-[#3b82f6] font-medium">Dr. {a.doctor_name}</TableCell>
                          <TableCell className="text-[#f0f0f2]">{a.patient_name}</TableCell>
                          <TableCell className="text-[#a1a1aa] capitalize">{a.bone_type}</TableCell>
                          <TableCell>
                            {a.fracture ? (
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Fracture</Badge>
                            ) : (
                              <Badge className="bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20">Normal</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[#a1a1aa] font-mono">{a.confidence}%</TableCell>
                          <TableCell className="text-[#a1a1aa] text-sm">
                            {new Date(a.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;

import React, { useEffect, useMemo, useState } from 'react';
import ModuleLayout from '@/components/ModuleLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Download, Loader2, IndianRupee, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { downloadSalarySlip } from '@/lib/salarySlipPdf';

const blankForm = {
  admin_id: '', salary_month: new Date().toISOString().slice(0, 7) + '-01',
  basic_salary: 0, hra: 0, allowances: 0, bonus: 0, deductions: 0, tax: 0,
  paid_days: 0, working_days: 0, status: 'draft' as 'draft' | 'approved' | 'paid',
  payment_date: '', notes: '',
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const Payroll: React.FC = () => {
  const { adminProfile } = useAuth();
  const isSuper = adminProfile?.role === 'super_admin';
  const [records, setRecords] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>(blankForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: recs }, { data: admList }] = await Promise.all([
      supabase.from('payroll_records' as any).select('*').order('salary_month', { ascending: false }),
      isSuper ? supabase.from('admins').select('id, name, email, role').eq('is_active', true).order('name') : Promise.resolve({ data: [] }),
    ]);
    const ids = Array.from(new Set((recs || []).map((r: any) => r.admin_id)));
    let adminMap: Record<string, any> = {};
    if (ids.length) {
      const { data: rels } = await supabase.from('admins').select('id, name, email, role').in('id', ids);
      (rels || []).forEach((a) => (adminMap[a.id] = a));
    }
    setRecords((recs || []).map((r: any) => ({ ...r, admin: adminMap[r.admin_id] })));
    setAdmins(admList || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [adminProfile?.id]);

  const gross = useMemo(() => Number(form.basic_salary) + Number(form.hra) + Number(form.allowances) + Number(form.bonus), [form]);
  const net = useMemo(() => gross - Number(form.deductions) - Number(form.tax), [gross, form]);

  const save = async () => {
    if (!form.admin_id) { toast({ title: 'Pick an admin', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      admin_id: form.admin_id,
      salary_month: form.salary_month,
      basic_salary: Number(form.basic_salary), hra: Number(form.hra),
      allowances: Number(form.allowances), bonus: Number(form.bonus),
      deductions: Number(form.deductions), tax: Number(form.tax),
      paid_days: Number(form.paid_days), working_days: Number(form.working_days),
      gross_salary: gross, net_salary: net,
      status: form.status, payment_date: form.payment_date || null, notes: form.notes || null,
      generated_by: adminProfile?.id,
    };
    const { error } = await supabase.from('payroll_records' as any).upsert(payload, { onConflict: 'admin_id,salary_month' });
    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Salary record saved' });
    setDialogOpen(false); setForm(blankForm); load();
  };

  const download = (r: any) => downloadSalarySlip(r, r.admin, adminProfile?.name);

  const totals = useMemo(() => {
    const totalNet = records.reduce((s, r) => s + Number(r.net_salary || 0), 0);
    const paid = records.filter((r) => r.status === 'paid').length;
    return { totalNet, paid, count: records.length };
  }, [records]);

  return (
    <ModuleLayout title="Payroll" description={isSuper ? 'Generate and approve monthly salary slips for every admin.' : 'View and download your monthly salary slips.'}
      actions={isSuper ? (<Button onClick={() => { setForm(blankForm); setDialogOpen(true); }} className="gradient-primary"><Plus className="w-4 h-4 mr-2" />New Salary Record</Button>) : null}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="bg-card border-white/10"><CardContent className="p-5 flex items-center gap-3"><IndianRupee className="w-6 h-6 text-emerald-400" /><div><p className="text-xs text-muted-foreground">Total Net Disbursed</p><p className="text-xl font-bold text-white">{inr(totals.totalNet)}</p></div></CardContent></Card>
        <Card className="bg-card border-white/10"><CardContent className="p-5 flex items-center gap-3"><FileText className="w-6 h-6 text-blue-400" /><div><p className="text-xs text-muted-foreground">Records</p><p className="text-xl font-bold text-white">{totals.count}</p></div></CardContent></Card>
        <Card className="bg-card border-white/10"><CardContent className="p-5 flex items-center gap-3"><Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Paid</Badge><div><p className="text-xs text-muted-foreground">Paid Slips</p><p className="text-xl font-bold text-white">{totals.paid}</p></div></CardContent></Card>
      </div>

      <Card className="bg-card border-white/10">
        <CardHeader><CardTitle className="text-white text-lg">Salary Slips</CardTitle></CardHeader>
        <CardContent>
          {loading ? (<div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No payroll records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Admin</TableHead><TableHead>Month</TableHead><TableHead>Gross</TableHead><TableHead>Deductions</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead><TableHead>Slip</TableHead></TableRow></TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><div className="font-medium text-white">{r.admin?.name || '—'}</div><div className="text-xs text-muted-foreground">{r.admin?.email}</div></TableCell>
                      <TableCell>{new Date(r.salary_month).toLocaleString('en-IN', { month: 'short', year: 'numeric' })}</TableCell>
                      <TableCell>{inr(r.gross_salary)}</TableCell>
                      <TableCell>{inr(Number(r.deductions) + Number(r.tax))}</TableCell>
                      <TableCell className="font-semibold text-emerald-300">{inr(r.net_salary)}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{r.status}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => download(r)}><Download className="w-3 h-3 mr-1" />PDF</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Salary Record</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Admin</Label>
              <Select value={form.admin_id} onValueChange={(v) => setForm((s: any) => ({ ...s, admin_id: v }))}>
                <SelectTrigger className="bg-black/40 border-white/10"><SelectValue placeholder="Select admin" /></SelectTrigger>
                <SelectContent>{admins.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name} · {a.role.replace('_', ' ')}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div><Label>Salary Month</Label><Input type="date" value={form.salary_month} onChange={(e) => setForm((s: any) => ({ ...s, salary_month: e.target.value }))} className="bg-black/40 border-white/10" /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((s: any) => ({ ...s, status: v }))}>
                <SelectTrigger className="bg-black/40 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
              </Select>
            </div>
            {[['basic_salary','Basic'], ['hra','HRA'], ['allowances','Allowances'], ['bonus','Bonus'], ['deductions','Deductions'], ['tax','Tax'], ['paid_days','Paid Days'], ['working_days','Working Days']].map(([k, l]) => (
              <div key={k}><Label>{l}</Label><Input type="number" value={form[k]} onChange={(e) => setForm((s: any) => ({ ...s, [k]: e.target.value }))} className="bg-black/40 border-white/10" /></div>
            ))}
            <div><Label>Payment Date</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm((s: any) => ({ ...s, payment_date: e.target.value }))} className="bg-black/40 border-white/10" /></div>
            <div className="sm:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((s: any) => ({ ...s, notes: e.target.value }))} className="bg-black/40 border-white/10" placeholder="Optional notes" /></div>
            <div className="sm:col-span-2 rounded-lg border border-white/10 bg-black/30 p-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Gross: <span className="text-white font-semibold">{inr(gross)}</span></span>
              <span className="text-muted-foreground">Net Pay: <span className="text-emerald-300 font-semibold">{inr(net)}</span></span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Record'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  );
};

export default Payroll;
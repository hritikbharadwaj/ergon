import React, { useEffect, useMemo, useState } from 'react';
import ModuleLayout from '@/components/ModuleLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Trash2, Pencil, UserPlus, Globe, Mail, Phone, PhoneCall } from 'lucide-react';
import { Download, FileText } from 'lucide-react';
import { downloadCsv } from '@/lib/csvExport';
import { buildReport } from '@/lib/pdfReport';
import { notifySuperAdmins } from '@/lib/notify';

const STATUSES = ['reached', 'rejected', 'approved', 'followed_up'] as const;
const SOURCES = ['website', 'email', 'referral', 'call'] as const;

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  reached: { label: 'Reached', cls: 'border-[#5B8DEF]/40 text-[#9BC0FF]' },
  rejected: { label: 'Rejected', cls: 'border-rose-500/40 text-rose-300' },
  approved: { label: 'Approved', cls: 'border-emerald-500/40 text-emerald-300' },
  followed_up: { label: 'Followed Up', cls: 'border-[#A06CFF]/40 text-[#D6BFFF]' },
};
const SOURCE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  website: Globe, email: Mail, referral: UserPlus, call: PhoneCall,
};

interface Client {
  id: string; name: string; contact: string;
  status: typeof STATUSES[number]; source: typeof SOURCES[number];
  notes: string | null; assigned_to: string | null; created_by: string | null;
  created_at: string; updated_at: string;
}

const empty = (): Partial<Client> => ({ name: '', contact: '', status: 'reached', source: 'email', notes: '' });

const Clients: React.FC = () => {
  const { adminProfile } = useAuth();
  const { toast } = useToast();
  const isSuper = adminProfile?.role === 'super_admin';
  const [clients, setClients] = useState<Client[]>([]);
  const [adminMap, setAdminMap] = useState<Record<string, { name: string; role: string }>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Client> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from('clients').select('*').order('created_at', { ascending: false });
    setClients((data || []) as Client[]);
    const { data: adminRows } = await supabase.from('admins').select('id, name, role');
    const m: Record<string, any> = {};
    (adminRows || []).forEach((a: any) => { m[a.id] = { name: a.name, role: a.role }; });
    setAdminMap(m);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q);
    });
  }, [clients, search, statusFilter]);

  /** Aggregate: clients grouped by the admin who added them (created_by). */
  const byAdmin = useMemo(() => {
    const m = new Map<string, { name: string; role: string; total: number; approved: number; rejected: number }>();
    clients.forEach(c => {
      const key = c.created_by || 'unknown';
      const meta = adminMap[key] || { name: 'Unknown', role: '-' };
      const cur = m.get(key) || { name: meta.name, role: meta.role, total: 0, approved: 0, rejected: 0 };
      cur.total += 1;
      if (c.status === 'approved') cur.approved += 1;
      if (c.status === 'rejected') cur.rejected += 1;
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [clients, adminMap]);

  const startNew = () => { setEditing(empty()); setOpen(true); };
  const startEdit = (c: Client) => { setEditing(c); setOpen(true); };

  const save = async () => {
    if (!editing?.name?.trim() || !editing?.contact?.trim()) {
      toast({ title: 'Missing', description: 'Name & contact are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const previousStatus = (editing as Client).id ? clients.find(c => c.id === (editing as Client).id)?.status : null;
    const payload: any = {
      name: editing.name.trim(),
      contact: editing.contact.trim(),
      status: editing.status || 'reached',
      source: editing.source || 'email',
      notes: editing.notes?.trim() || null,
      assigned_to: adminProfile!.id,
      created_by: adminProfile!.id,
    };
    let err;
    if ((editing as Client).id) {
      ({ error: err } = await (supabase as any).from('clients').update(payload).eq('id', (editing as Client).id));
    } else {
      ({ error: err } = await (supabase as any).from('clients').insert([payload]));
    }
    setSaving(false);
    if (err) { toast({ title: 'Failed', description: err.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Saved', description: 'Client record updated.' });
    // Notify super admins if status changed or new client added
    if (!(editing as Client).id) {
      notifySuperAdmins({
        title: '🧑‍💼 New client added',
        message: `${adminProfile?.name || 'An admin'} added client "${payload.name}" via ${payload.source}.`,
        senderAdminId: adminProfile!.id,
      });
    } else if (previousStatus && previousStatus !== payload.status) {
      notifySuperAdmins({
        title: '🔁 Client status changed',
        message: `${adminProfile?.name || 'An admin'} moved "${payload.name}" from ${previousStatus} → ${payload.status}.`,
        senderAdminId: adminProfile!.id,
        priority: payload.status === 'approved' || payload.status === 'rejected' ? 'high' : 'normal',
      });
    }
    setOpen(false); setEditing(null);
    load();
  };

  const remove = async (c: Client) => {
    if (!confirm(`Delete ${c.name}?`)) return;
    await (supabase as any).from('clients').delete().eq('id', c.id);
    toast({ title: 'Deleted' });
    load();
  };

  const exportCsv = () => {
    const rows = filtered.map(c => ({
      Name: c.name, Contact: c.contact, Status: STATUS_CFG[c.status].label,
      Source: c.source, Notes: c.notes || '', Created: new Date(c.created_at).toLocaleString(),
    }));
    downloadCsv(`clients-${new Date().toISOString().slice(0,10)}.csv`, rows);
    toast({ title: 'CSV downloaded' });
  };

  const exportPdf = () => {
    buildReport({
      title: 'Client Pipeline Report',
      subtitle: `${filtered.length} clients · filter: ${statusFilter}`,
      generatedBy: adminProfile?.name || 'Admin',
      theme: 'minimal',
      range: { from: new Date(), to: new Date() },
      kpis: STATUSES.map(s => ({
        label: STATUS_CFG[s].label,
        value: String(filtered.filter(c => c.status === s).length),
      })),
      sections: [{
        title: 'Clients',
        head: [['Name', 'Contact', 'Source', 'Status', 'Notes']],
        body: filtered.map(c => [c.name, c.contact, c.source, STATUS_CFG[c.status].label, c.notes || '—']),
      }],
    }).save(`clients-report-${new Date().toISOString().slice(0,10)}.pdf`);
    toast({ title: 'PDF downloaded' });
  };

  return (
    <ModuleLayout title="Clients" description="Track outreach: name, contact, source and pipeline status.">
      {/* Per-admin summary — who's brought in how many clients */}
      {byAdmin.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Clients per Admin</p>
            <p className="text-xs text-white/50">{clients.length} total · {byAdmin.length} contributors</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {byAdmin.map((a, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium text-white">{a.name}</span>
                  <span className="text-lg font-black text-[#A06CFF]">{a.total}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-white/50 capitalize">{a.role.replace('_', ' ')}</div>
                <div className="mt-1 flex gap-2 text-[10px]">
                  <span className="text-emerald-400">✓ {a.approved}</span>
                  <span className="text-rose-400">✗ {a.rejected}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or contact…"
            className="pl-9 bg-[#0a0a14] border-white/10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-[#0a0a14] border-white/10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2 border-white/10" onClick={exportCsv} data-track="clients_csv">
          <Download className="h-4 w-4" /> CSV
        </Button>
        <Button variant="outline" className="gap-2 border-white/10" onClick={exportPdf} data-track="clients_pdf">
          <FileText className="h-4 w-4" /> PDF
        </Button>
        <Button onClick={startNew} className="gap-2 bg-gradient-to-r from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4] text-white"
          data-track="client_new">
          <Plus className="h-4 w-4" /> New client
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-white/60">
            <UserPlus className="mx-auto mb-3 h-10 w-10 text-white/30" />
            <p>No clients yet. Click "New client" to add one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => {
            const Icon = SOURCE_ICON[c.source];
            return (
              <div key={c.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-[#A06CFF]/40 transition-all">
                <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br from-[#5B8DEF]/20 via-[#A06CFF]/20 to-[#E94CC4]/20 blur-2xl opacity-0 group-hover:opacity-100 transition" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-white truncate">{c.name}</p>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_CFG[c.status].cls}`}>{STATUS_CFG[c.status].label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-white/70 truncate">{c.contact}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/50 capitalize">
                    <Icon className="h-3 w-3" /> via {c.source}
                  </div>
                  {c.notes && <p className="mt-2 text-xs text-white/60 line-clamp-2">{c.notes}</p>}
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/50">
                    <UserPlus className="h-3 w-3" />
                    Added by <span className="text-white/80">{adminMap[c.created_by || '']?.name || 'Unknown'}</span>
                    {adminMap[c.created_by || '']?.role && (
                      <span className="text-white/40 capitalize">· {adminMap[c.created_by || '']!.role.replace('_', ' ')}</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-white/60 hover:text-white" onClick={() => startEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {(isSuper || c.created_by === adminProfile?.id || c.assigned_to === adminProfile?.id) && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-400 hover:text-rose-300" onClick={() => remove(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border border-white/10 bg-black">
          <DialogHeader>
            <DialogTitle className="text-white">{(editing as Client)?.id ? 'Edit client' : 'New client'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="bg-[#0a0a14] border-white/10" />
              </div>
              <div>
                <Label className="text-xs">Contact (phone / email / handle) *</Label>
                <Input value={editing.contact || ''} onChange={(e) => setEditing({ ...editing, contact: e.target.value })}
                  className="bg-[#0a0a14] border-white/10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Source</Label>
                  <Select value={editing.source} onValueChange={(v: any) => setEditing({ ...editing, source: v })}>
                    <SelectTrigger className="bg-[#0a0a14] border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={editing.status} onValueChange={(v: any) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger className="bg-[#0a0a14] border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Conversation summary, follow-up date, deal size…"
                  className="bg-[#0a0a14] border-white/10 min-h-[80px]" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-white/10" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}
              className="bg-gradient-to-r from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4] text-white"
              data-track="client_save">
              {saving ? 'Saving…' : 'Save client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  );
};

export default Clients;
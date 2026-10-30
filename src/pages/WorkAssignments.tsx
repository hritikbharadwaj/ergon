import React, { useEffect, useMemo, useState } from 'react';
import ModuleLayout from '@/components/ModuleLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Download, Plus, Trash2, FileText, ClipboardList, Sparkles } from 'lucide-react';
import { buildReport } from '@/lib/pdfReport';

interface Assignment {
  id: string; assigned_to_admin_id: string; assigned_by_admin_id: string;
  title: string; description: string | null; details: any; priority: string;
  status: string; due_date: string | null; created_at: string; week_key: string;
}

const WorkAssignments: React.FC = () => {
  const { adminProfile } = useAuth();
  const { toast } = useToast();
  const isPrivileged = adminProfile?.role === 'super_admin' || (adminProfile?.role as string) === 'hr_admin';

  const [items, setItems] = useState<Assignment[]>([]);
  const [admins, setAdmins] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    assigned_to_admin_id: '', title: '', description: '',
    priority: 'medium', due_date: '',
  });

  const load = async () => {
    const { data } = await supabase.from('work_assignments')
      .select('*').order('created_at', { ascending: false }).limit(200);
    setItems((data || []) as any);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    supabase.from('admins').select('id, name, role').eq('is_active', true).then(({ data }) => {
      setAdmins((data || []) as any);
    });
  }, []);

  const adminName = (id: string) => admins.find(a => a.id === id)?.name || 'Unknown';

  const createAssignment = async () => {
    if (!form.assigned_to_admin_id || !form.title.trim()) {
      toast({ title: 'Missing', description: 'Pick a teammate and add a title.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from('work_assignments').insert([{
      assigned_to_admin_id: form.assigned_to_admin_id,
      assigned_by_admin_id: adminProfile!.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      due_date: form.due_date || null,
      status: 'pending',
    }]);
    setCreating(false);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Assigned', description: 'Work given to teammate.' });

    // Branded email to the assignee (super admins only — function enforces it)
    if (adminProfile?.role === 'super_admin') {
      try {
        const { data: r } = await supabase
          .from('admins').select('name, email, otp_email')
          .eq('id', form.assigned_to_admin_id).single();
        const to = (r as any)?.otp_email || (r as any)?.email;
        if (to) {
          const dueLine = form.due_date ? `<p style="margin:8px 0 0;color:#555;">📅 Due: <b>${form.due_date}</b></p>` : '';
          const desc = form.description.trim()
            ? `<p style="margin:12px 0 0;color:#333;white-space:pre-wrap;">${form.description.trim().replace(/</g,'&lt;')}</p>` : '';
          await supabase.functions.invoke('send-branded-email', {
            body: {
              recipientEmail: to,
              recipientName: (r as any)?.name,
              recipientAdminId: form.assigned_to_admin_id,
              kind: 'work_assignment',
              subject: `📌 New work assigned: ${form.title.trim()}`,
              heading: 'You have a new task',
              message: `<p>You've been assigned new work by <b>${adminProfile.name}</b>.</p>
                <p style="margin:14px 0 0;font-size:17px;color:#1f2937;"><b>${form.title.trim()}</b></p>
                <p style="margin:4px 0 0;color:#555;">Priority: <b style="text-transform:capitalize;">${form.priority}</b></p>
                ${dueLine}${desc}`,
              ctaLabel: 'Open Admin Portal',
              ctaUrl: 'https://admin.Ergon.in/dashboard/work-given',
            },
          });
        }
      } catch (e) { console.warn('branded email failed', e); }
    }

    setForm({ assigned_to_admin_id: '', title: '', description: '', priority: 'medium', due_date: '' });
    load();
  };

  const removeAssignment = async (id: string) => {
    if (!confirm('Delete this assignment?')) return;
    await supabase.from('work_assignments').delete().eq('id', id);
    load();
  };

  const purgeOld = async () => {
    if (!confirm('Purge all assignments older than 7 days?')) return;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    await supabase.from('work_assignments').delete().lt('created_at', cutoff.toISOString());
    toast({ title: 'Weekly cleanup done' });
    load();
  };

  const downloadPdf = (a: Assignment) => {
    const assignedToName = adminName(a.assigned_to_admin_id);
    const assignedByName = adminName(a.assigned_by_admin_id);
    buildReport({
      title: `Work Assignment · ${assignedToName}`,
      subtitle: a.title,
      generatedBy: assignedByName,
      theme: 'minimal',
      range: { from: new Date(a.created_at), to: a.due_date ? new Date(a.due_date) : new Date(a.created_at) },
      kpis: [
        { label: 'Priority', value: a.priority.toUpperCase() },
        { label: 'Status', value: a.status.toUpperCase() },
        { label: 'Assigned To', value: assignedToName },
        { label: 'Due', value: a.due_date || '—' },
      ],
      sections: [{
        title: 'Assignment details',
        head: [['Field', 'Value']],
        body: [
          ['Title', a.title],
          ['Description', a.description || '—'],
          ['Assigned by', assignedByName],
          ['Assigned to', assignedToName],
          ['Priority', a.priority],
          ['Due date', a.due_date || 'No due date'],
          ['Created', new Date(a.created_at).toLocaleString()],
          ['Status', a.status],
        ],
      }],
    }).save(`assignment-${a.title.slice(0, 24).replace(/\s+/g, '-')}.pdf`);
  };

  const myItems = useMemo(() => items.filter(i => i.assigned_to_admin_id === adminProfile?.id), [items, adminProfile?.id]);
  const allItems = items;

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('work_assignments').update({ status }).eq('id', id);
    load();
  };

  return (
    <ModuleLayout
      title="Work Given"
      description="Tasks assigned to teammates with downloadable PDF briefs. Auto-purge weekly."
      actions={isPrivileged ? (
        <Button variant="outline" className="border-white/10 gap-2" onClick={purgeOld} data-track="assignments_weekly_purge">
          <Trash2 className="h-4 w-4" /> Weekly cleanup
        </Button>
      ) : undefined}
    >
      {isPrivileged && (
        <Card className="bg-card border-border mb-5">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> New assignment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Assign to</Label>
              <Select value={form.assigned_to_admin_id} onValueChange={(v) => setForm(f => ({ ...f, assigned_to_admin_id: v }))}>
                <SelectTrigger className="bg-[#0a0a14] border-white/10"><SelectValue placeholder="Pick a teammate" /></SelectTrigger>
                <SelectContent>{admins.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.role})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="bg-[#0a0a14] border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>{['low','medium','high','urgent'].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Q3 social calendar"
                className="bg-[#0a0a14] border-white/10" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Outline the deliverables, scope, references..."
                className="bg-[#0a0a14] border-white/10 min-h-[100px]" />
            </div>
            <div>
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="bg-[#0a0a14] border-white/10" />
            </div>
            <div className="flex items-end">
              <Button onClick={createAssignment} disabled={creating} className="w-full gap-2 bg-gradient-to-r from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4] text-white"
                data-track="assignment_create">
                <Sparkles className="h-4 w-4" /> {creating ? 'Saving…' : 'Assign work'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My assignments */}
      <Card className="bg-card border-border mb-5">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Given to me ({myItems.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {myItems.length === 0 ? (
            <p className="text-center text-sm text-white/40 py-6">Nothing on your plate right now.</p>
          ) : myItems.map(a => (
            <AssignmentRow key={a.id} a={a} mine canUpdateStatus
              onUpdateStatus={updateStatus} onDownload={downloadPdf}
              assignedByName={adminName(a.assigned_by_admin_id)} />
          ))}
        </CardContent>
      </Card>

      {/* All assignments */}
      {isPrivileged && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">All assignments ({allItems.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {allItems.length === 0 ? (
              <p className="text-center text-sm text-white/40 py-6">No assignments yet.</p>
            ) : allItems.map(a => (
              <AssignmentRow key={a.id} a={a}
                onDelete={removeAssignment} onDownload={downloadPdf}
                assignedToName={adminName(a.assigned_to_admin_id)}
                assignedByName={adminName(a.assigned_by_admin_id)} />
            ))}
          </CardContent>
        </Card>
      )}
    </ModuleLayout>
  );
};

const AssignmentRow: React.FC<{
  a: Assignment;
  mine?: boolean;
  canUpdateStatus?: boolean;
  onUpdateStatus?: (id: string, s: string) => void;
  onDelete?: (id: string) => void;
  onDownload: (a: Assignment) => void;
  assignedToName?: string;
  assignedByName?: string;
}> = ({ a, mine, canUpdateStatus, onUpdateStatus, onDelete, onDownload, assignedToName, assignedByName }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-white">{a.title}</p>
          <Badge variant="outline" className={`text-[10px] capitalize ${a.priority === 'urgent' ? 'border-rose-500/40 text-rose-300' : a.priority === 'high' ? 'border-amber-500/40 text-amber-300' : 'border-white/20 text-white/70'}`}>{a.priority}</Badge>
          <Badge variant="outline" className="text-[10px] capitalize border-white/15 text-white/60">{a.status}</Badge>
        </div>
        {a.description && <p className="mt-1 text-xs text-white/60 whitespace-pre-wrap">{a.description}</p>}
        <p className="mt-2 text-[11px] text-white/40">
          {assignedToName && <>To <span className="text-white/70">{assignedToName}</span> · </>}
          {assignedByName && <>From <span className="text-white/70">{assignedByName}</span> · </>}
          {a.due_date ? <>Due <span className="text-white/70">{a.due_date}</span></> : 'No due date'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Button size="sm" variant="outline" className="border-white/10 gap-1.5" onClick={() => onDownload(a)}
          data-track="assignment_download_pdf">
          <Download className="h-3.5 w-3.5" /> PDF
        </Button>
        {canUpdateStatus && a.status !== 'done' && (
          <Button size="sm" variant="ghost" className="text-xs text-emerald-300" onClick={() => onUpdateStatus?.(a.id, 'done')}
            data-track="assignment_mark_done">Mark done</Button>
        )}
        {onDelete && (
          <Button size="sm" variant="ghost" className="text-xs text-rose-400" onClick={() => onDelete(a.id)}
            data-track="assignment_delete"><Trash2 className="h-3.5 w-3.5" /></Button>
        )}
      </div>
    </div>
  </div>
);

export default WorkAssignments;
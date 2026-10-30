import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardEdit,
  Target,
  FileEdit,
  TimerReset,
  Trophy,
  ClipboardCheck,
  LayoutGrid,
  Folder,
  Flag,
  Type as TypeIcon,
  ClipboardList,
  Link as LinkIcon,
  Clock,
  Calendar,
  Play,
  Square,
  Tag,
  Star,
  CloudUpload,
  Bookmark,
  Trash2,
  Send,
  Info,
  ArrowLeft,
} from 'lucide-react';
import ModuleLayout from '@/components/ModuleLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import EarlyWorkLogDialog from '@/components/EarlyWorkLogDialog';
import { isCheckoutWindow, getIndiaNow, loadTimeWindowSettings, workLogWindowLabel } from '@/lib/timeWindow';
import { useTimeWindows } from '@/hooks/useTimeWindows';
import { notifySuperAdmins } from '@/lib/notify';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Monitor, ScanLine, AlertTriangle } from 'lucide-react';
import { formatDateForDB } from '@/lib/utils';

const WORK_TYPES = ['Development', 'Design', 'Content', 'Customer Engagement', 'HR', 'Admin', 'Meeting', 'Research', 'Other'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PROJECT_MODULES = ['Website', 'App', 'Marketing', 'Operations', 'Tournament', 'Internal', 'Client'];

const tipCards = [
  { icon: Target, title: 'Be Accurate', subtitle: 'Log honestly' },
  { icon: FileEdit, title: 'Be Detailed', subtitle: 'Add clear details' },
  { icon: TimerReset, title: 'Be Consistent', subtitle: 'Track daily progress' },
  { icon: Trophy, title: 'Get Recognized', subtitle: 'Great work counts!' },
];

const MOOD_EMOJIS = ['😞', '😕', '😐', '🙂', '🤩'];

const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 + i * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

const WorkLogEntry: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const { adminProfile } = useAuth();
  const isMobile = useIsMobile();
  useTimeWindows();

  useEffect(() => { loadTimeWindowSettings(); }, []);

  const fromCheckout = params.get('checkout') === '1';

  const [showEarlyDialog, setShowEarlyDialog] = useState(false);
  const [needsCheckoutScan, setNeedsCheckoutScan] = useState(false);

  // Hard lock: out-of-window users get a strict dialog that bounces them to /dashboard.
  useEffect(() => {
    if (isMobile) return;
    const tick = () => setShowEarlyDialog(!isCheckoutWindow());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [isMobile]);

  // Require checkout face-scan first.
  useEffect(() => {
    if (isMobile || !adminProfile?.id || adminProfile.role === 'super_admin') return;
    let cancelled = false;
    (async () => {
      const today = formatDateForDB(getIndiaNow());
      const { data } = await supabase
        .from('attendance').select('check_out_time')
        .eq('admin_id', adminProfile.id).eq('date', today).maybeSingle();
      if (cancelled) return;
      if (!data?.check_out_time && isCheckoutWindow()) setNeedsCheckoutScan(true);
      else setNeedsCheckoutScan(false);
    })();
    return () => { cancelled = true; };
  }, [adminProfile?.id, adminProfile?.role, isMobile, showEarlyDialog]);

  const [workType, setWorkType] = useState('');
  const [projectModule, setProjectModule] = useState('');
  const [priority, setPriority] = useState('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [hours, setHours] = useState('');
  const [logDate, setLogDate] = useState(getIndiaNow().toISOString().slice(0, 10));
  const [timeStarted, setTimeStarted] = useState('');
  const [timeEnded, setTimeEnded] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [impact, setImpact] = useState('');
  const [billable, setBillable] = useState(false);
  const [blockers, setBlockers] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [collaborators, setCollaborators] = useState('');
  const [completion, setCompletion] = useState(100);
  const [mood, setMood] = useState<number>(4);
  const [saving, setSaving] = useState(false);
  const [prevLogs, setPrevLogs] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadAttachments = async (): Promise<string[]> => {
    if (!attachments.length || !adminProfile?.id) return [];
    const urls: string[] = [];
    setUploading(true);
    for (const file of attachments) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'Too large', description: `${file.name} exceeds 10MB.`, variant: 'destructive' });
        continue;
      }
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${adminProfile.id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from('work-log-attachments').upload(path, file, { upsert: false });
      if (error) {
        toast({ title: 'Upload failed', description: `${file.name}: ${error.message}`, variant: 'destructive' });
        continue;
      }
      const { data } = supabase.storage.from('work-log-attachments').getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    setUploading(false);
    return urls;
  };

  const loadPrev = async () => {
    if (!adminProfile?.id) return;
    const { data } = await supabase
      .from('work_log_entries')
      .select('id, title, work_type, project_module, hours_spent, log_date, priority, completion_pct, mood, is_draft, created_at')
      .eq('admin_id', adminProfile.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setPrevLogs(data || []);
  };
  useEffect(() => { loadPrev(); }, [adminProfile?.id]);

  const titleCount = title.length;
  const descCount = description.length;
  const impactCount = impact.length;

  const canSubmit = useMemo(
    () => workType && title.trim() && description.trim() && hours && Number(hours) > 0,
    [workType, title, description, hours]
  );

  const tags = useMemo(
    () => tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
    [tagsInput]
  );

  const reset = () => {
    setWorkType(''); setProjectModule(''); setPriority('medium');
    setTitle(''); setDescription(''); setUrl(''); setHours('');
    setTimeStarted(''); setTimeEnded(''); setTagsInput(''); setImpact('');
    setBillable(false); setAttachments([]);
  };

  const handleSubmit = async (asDraft = false) => {
    if (!adminProfile?.id) {
      toast({ title: 'No profile', description: 'Please sign in again.', variant: 'destructive' });
      return;
    }
    if (!asDraft && !isCheckoutWindow()) {
      setShowEarlyDialog(true);
      toast({ title: 'Locked', description: `Work log opens ${workLogWindowLabel()}.`, variant: 'destructive' });
      return;
    }
    if (!asDraft && adminProfile.role !== 'super_admin') {
      const today = formatDateForDB(getIndiaNow());
      const { data: att } = await supabase
        .from('attendance').select('check_out_time')
        .eq('admin_id', adminProfile.id).eq('date', today).maybeSingle();
      if (!att?.check_out_time) { setNeedsCheckoutScan(true); return; }
    }
    if (!asDraft && !canSubmit) {
      toast({ title: 'Missing fields', description: 'Work Type, Title, Description and Hours are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Upload attachments first so URLs can be persisted with the log row.
    const attachmentUrls = await uploadAttachments();

    // 1. Save work log
    const inWindow = isCheckoutWindow();
    const { data: log, error: logErr } = await supabase
      .from('work_log_entries')
      .insert([{
        admin_id: adminProfile.id,
        work_type: workType || 'Other',
        project_module: projectModule || null,
        priority,
        title: title.trim() || 'Untitled',
        description: description.trim() || ' ',
        url: url.trim() || null,
        hours_spent: Number(hours) || 0,
        log_date: logDate,
        time_started: timeStarted || null,
        time_ended: timeEnded || null,
        tags,
        work_impact: impact.trim() || null,
        is_billable: billable,
        is_draft: asDraft,
        blockers: blockers.trim() || null,
        next_steps: nextSteps.trim() || null,
        collaborators: collaborators.trim() || null,
        completion_pct: completion,
        mood,
        attachments_url: attachmentUrls,
      } as any])
      .select()
      .single();

    if (logErr) {
      setSaving(false);
      toast({ title: 'Failed', description: logErr.message, variant: 'destructive' });
      return;
    }

    // 2. If in checkout window AND not draft, also mark check_out on today's attendance
    if (!asDraft && inWindow) {
      const today = getIndiaNow().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      const { data: att } = await supabase
        .from('attendance').select('id, check_out_time')
        .eq('admin_id', adminProfile.id).eq('date', today).maybeSingle();
      if (att && !att.check_out_time) {
        await supabase.from('attendance')
          .update({ check_out_time: nowIso, updated_at: nowIso })
          .eq('id', att.id);
        // link
        await supabase.from('work_log_entries')
          .update({ linked_attendance_id: att.id }).eq('id', log!.id);
      }
    }

    setSaving(false);
    toast({
      title: asDraft ? 'Draft saved' : (inWindow ? '✅ Saved & Checked out' : '✅ Work log saved'),
      description: asDraft ? 'You can edit it later.' : (inWindow ? 'Attendance check-out recorded.' : 'Saved without checkout (outside window).'),
    });
    if (!asDraft) {
      // fire-and-forget: notify super admins so nothing gets missed
      notifySuperAdmins({
        title: '📝 New work log submitted',
        message: `${adminProfile.name || 'An admin'} logged "${title.trim() || 'Untitled'}" (${Number(hours) || 0}h${projectModule ? ` · ${projectModule}` : ''}).`,
        senderAdminId: adminProfile.id,
        priority: 'normal',
      });
    }
    reset();
    loadPrev();
    if (fromCheckout) navigate('/dashboard');
  };

  if (isMobile) {
    return (
      <ModuleLayout title="Work Log Entry" description="Desktop / laptop only.">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-sm w-full text-center rounded-2xl border border-white/10 bg-[#070710]/80 p-6 space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4]">
              <Monitor className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Desktop / Laptop Only</h2>
            <p className="text-sm text-white/70">
              Work log entry can only be submitted from a laptop or desktop, between
              <span className="mx-1 font-semibold text-white">{workLogWindowLabel()}</span>.
              All other sections remain fully usable on mobile.
            </p>
            <Button
          variant="outline"
          onClick={() => navigate('/dashboard')}
          className="mb-6 bg-black/40 border-white/10 text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
          </div>
        </div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout title="Work Log Entry" description="Submit your daily work. In the 9:30pm–12am IST window this also checks you out.">
      <EarlyWorkLogDialog
        open={showEarlyDialog}
        onClose={() => {
          setShowEarlyDialog(false);
          if (!isCheckoutWindow()) navigate('/dashboard');
        }}
      />

      <Dialog open={needsCheckoutScan} onOpenChange={(o) => { if (!o) navigate('/dashboard'); }}>
        <DialogContent className="max-w-md border border-white/10 bg-black p-6 overflow-hidden">
          <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[#E94CC4]/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[#5B8DEF]/30 blur-3xl pointer-events-none" />
          <DialogHeader className="relative">
            <div className="mb-3 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4]">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <DialogTitle className="text-center text-xl text-white">Checkout Face-Scan Required</DialogTitle>
          </DialogHeader>
          <div className="relative space-y-4 text-sm">
            <p className="text-white/80 text-center">
              Complete your <strong>checkout face-scan</strong> first. Work log entry stays locked until checkout attendance is recorded.
            </p>
            <div className="flex flex-col gap-2">
              <Button className="w-full bg-gradient-to-r from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4]"
                onClick={() => navigate('/dashboard/face-attendance')}>
                <ScanLine className="h-4 w-4 mr-2" /> Go to Face Scan
              </Button>
              <Button variant="outline" className="border-white/10" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative rounded-2xl border border-white/10 bg-[#070710]/80 p-5 sm:p-8 overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-24 h-72 w-72 rounded-full bg-[#5B8DEF]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-[#E94CC4]/20 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 right-1/4 h-56 w-56 rounded-full bg-[#A06CFF]/15 blur-3xl" />

        {/* Header */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0}
          className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <ClipboardEdit className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Add New Work Log</h2>
              <p className="mt-1 text-sm text-white/60">
                Track your work, maintain consistency, and measure your impact.
              </p>
            </div>
          </div>
          <div className="relative flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30">
              <ClipboardCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Every log matters!</p>
              <p className="text-xs text-white/60">Your work drives our success.</p>
            </div>
          </div>
        </motion.div>

        {/* Tip strip */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1}
          className="relative mt-6 grid grid-cols-2 gap-3 border-y border-white/10 py-4 sm:grid-cols-4"
        >
          {tipCards.map((t) => (
            <div key={t.title} className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                <t.icon className="h-4 w-4 text-white/80" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{t.title}</p>
                <p className="text-[11px] text-white/50">{t.subtitle}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Form grid */}
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field icon={LayoutGrid} label="Work Type" required>
            <Select value={workType} onValueChange={setWorkType}>
              <SelectTrigger className="bg-[#0a0a14] border-white/10 h-11"><SelectValue placeholder="Select work type" /></SelectTrigger>
              <SelectContent>{WORK_TYPES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field icon={Folder} label="Project / Module">
            <Select value={projectModule} onValueChange={setProjectModule}>
              <SelectTrigger className="bg-[#0a0a14] border-white/10 h-11"><SelectValue placeholder="Select project or module" /></SelectTrigger>
              <SelectContent>{PROJECT_MODULES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field icon={Flag} label="Priority">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-[#0a0a14] border-white/10 h-11"><SelectValue placeholder="Select priority" /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          <Field icon={TypeIcon} label="Title / Task Name" required hint={`${titleCount} / 120`}>
            <Input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Homepage redesign, SEO optimization"
              className="bg-[#0a0a14] border-white/10 h-11" />
          </Field>
          <div className="sm:col-span-2">
            <Field icon={ClipboardList} label="Description" required hint={`${descCount} / 2000`}>
              <Textarea maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the work in detail..."
                className="bg-[#0a0a14] border-white/10 min-h-[90px]" />
            </Field>
          </div>

          <Field icon={LinkIcon} label="URL / Link (optional)" hint="Add any relevant link, page or document">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page"
              className="bg-[#0a0a14] border-white/10 h-11" />
          </Field>
          <Field icon={Clock} label="Hours Spent" required>
            <div className="relative">
              <Input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g., 2.5"
                type="number" step="0.25" min="0"
                className="bg-[#0a0a14] border-white/10 h-11 pr-16" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/50">Hours</span>
            </div>
          </Field>
          <Field icon={Calendar} label="Date" required>
            <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
              className="bg-[#0a0a14] border-white/10 h-11" />
          </Field>

          <Field icon={Play} label="Time Started (optional)">
            <Input type="time" value={timeStarted} onChange={(e) => setTimeStarted(e.target.value)}
              className="bg-[#0a0a14] border-white/10 h-11" />
          </Field>
          <Field icon={Square} label="Time Ended (optional)">
            <Input type="time" value={timeEnded} onChange={(e) => setTimeEnded(e.target.value)}
              className="bg-[#0a0a14] border-white/10 h-11" />
          </Field>
          <Field icon={Tag} label="Tags (optional)" hint="Comma separated">
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Add tags (e.g., SEO, Design, Fix)"
              className="bg-[#0a0a14] border-white/10 h-11" />
          </Field>

          <div className="sm:col-span-2">
            <Field icon={Star} label="Work Impact / Outcome (optional)" hint={`${impactCount} / 300`}>
              <Textarea maxLength={300} value={impact} onChange={(e) => setImpact(e.target.value)}
                placeholder="What was the result or impact of this work?"
                className="bg-[#0a0a14] border-white/10 min-h-[80px]" />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field icon={ClipboardList} label="Blockers (optional)">
              <Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)}
                placeholder="What's slowing you down or needs help?"
                className="bg-[#0a0a14] border-white/10 min-h-[60px]" />
            </Field>
          </div>
          <div>
            <Field icon={Target} label="Next Steps (optional)">
              <Textarea value={nextSteps} onChange={(e) => setNextSteps(e.target.value)}
                placeholder="What's the next concrete step?"
                className="bg-[#0a0a14] border-white/10 min-h-[60px]" />
            </Field>
          </div>

          <Field icon={Tag} label="Collaborators (optional)" hint="Names or emails">
            <Input value={collaborators} onChange={(e) => setCollaborators(e.target.value)}
              placeholder="e.g., Aman, Riya"
              className="bg-[#0a0a14] border-white/10 h-11" />
          </Field>
          <div>
            <Label className="mb-2 block text-sm font-medium text-white/90">Completion %</Label>
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0a0a14] px-3 h-11">
              <input type="range" min={0} max={100} step={5} value={completion}
                onChange={(e) => setCompletion(Number(e.target.value))}
                className="flex-1 accent-[#A06CFF]" />
              <span className="w-12 text-right text-sm font-mono text-white/80">{completion}%</span>
            </div>
          </div>
          <div>
            <Label className="mb-2 block text-sm font-medium text-white/90">Today's Mood</Label>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0a0a14] px-3 h-11">
              {MOOD_EMOJIS.map((e, i) => (
                <button key={i} type="button" onClick={() => setMood(i + 1)}
                  className={`text-xl transition ${mood === i + 1 ? 'scale-125 drop-shadow-[0_0_10px_rgba(160,108,255,0.6)]' : 'opacity-50 hover:opacity-90'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium text-white/90">Attachments (optional)</Label>
            <label className="flex h-[100px] cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-white/10 bg-[#0a0a14] px-4 text-center text-xs text-white/60 transition hover:border-primary/40 hover:text-white">
              <CloudUpload className="h-6 w-6" />
              <div className="text-left">
                <p className="text-sm font-medium text-white/80">
                  {attachments.length ? `${attachments.length} file(s) ready` : 'Drag & drop files here or click to upload'}
                </p>
                <p className="text-[11px] text-white/40">JPG, PNG, PDF, DOC, XLS (Max 10MB each)</p>
              </div>
              <input type="file" multiple className="hidden"
                onChange={(e) => setAttachments(Array.from(e.target.files || []))} />
            </label>
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px] text-white/60">
                {attachments.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded border border-white/10 bg-white/5 px-2 py-1">
                    <span className="truncate">{f.name} · {(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button" className="text-rose-300 hover:text-rose-200"
                      onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer row */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={6}
          className="relative mt-7 flex flex-col items-stretch gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <label className="flex items-center gap-2 text-sm text-white/70">
            <Switch checked={billable} onCheckedChange={setBillable} />
            <span>Mark as billable (if applicable)</span>
            <Info className="h-3.5 w-3.5 text-white/40" />
          </label>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button variant="outline" className="border-white/10 gap-2"
              onClick={() => handleSubmit(true)} disabled={saving}
              data-track="worklog_save_draft">
              <Bookmark className="h-4 w-4" /> Save as Draft
            </Button>
            <Button variant="outline" className="border-white/10 gap-2" onClick={reset}
              data-track="worklog_clear_all">
              <Trash2 className="h-4 w-4" /> Clear All
            </Button>
            <Button
              className="gap-2 bg-gradient-to-r from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4] text-white hover:opacity-95"
              onClick={() => handleSubmit(false)}
              disabled={saving || !canSubmit}
              data-track="worklog_submit"
            >
              <Send className="h-4 w-4" /> {uploading ? 'Uploading…' : saving ? 'Saving…' : 'Add Work Log'}
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Previous work logs */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-[#070710]/80 p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-white">Your previous work logs</h3>
            <p className="text-xs text-white/50">Latest 20 entries — newest first</p>
          </div>
          <Button variant="outline" size="sm" className="border-white/10 text-xs"
            onClick={() => navigate('/dashboard/work-logs')} data-track="worklog_view_all">
            View all
          </Button>
        </div>
        {prevLogs.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/40">No previous logs yet — submit your first one above.</p>
        ) : (
          <div className="grid gap-2 sm:gap-3 max-h-[460px] overflow-y-auto pr-1">
            {prevLogs.map((p: any) => (
              <div key={p.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4 hover:border-[#A06CFF]/40 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                      {p.is_draft && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">Draft</Badge>}
                      <Badge variant="outline" className="text-[10px] border-white/15 text-white/60">{p.work_type}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-white/50 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📅 {p.log_date}</span>
                      <span>⏱ {p.hours_spent}h</span>
                      {p.project_module && <span>📁 {p.project_module}</span>}
                      {p.completion_pct != null && <span>✅ {p.completion_pct}%</span>}
                      {p.mood && <span>{MOOD_EMOJIS[p.mood - 1]}</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleLayout>
  );
};

interface FieldProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}
const Field: React.FC<FieldProps> = ({ icon: Icon, label, required, hint, children }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between">
      <Label className="text-sm font-medium text-white/90">
        {label}{required && <span className="ml-1 text-red-400">*</span>}
      </Label>
      {hint && <span className="text-[11px] text-white/40">{hint}</span>}
    </div>
    <div className="relative">
      <div className="pointer-events-none absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 text-white/40 sm:block">
        <Icon className="h-4 w-4" />
      </div>
      <div className="sm:[&_input]:pl-9 sm:[&_button[role=combobox]]:pl-9 sm:[&_textarea]:pl-9">
        {children}
      </div>
    </div>
  </div>
);

export default WorkLogEntry;
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useHolidays } from '@/hooks/useHolidays';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  ArrowLeft, Save, Loader2, Clock, CalendarDays, LogIn, LogOut,
  ClipboardList, CalendarCheck, CalendarIcon, Plus, Trash2, ShieldAlert,
  History, Undo2, AlertTriangle, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DAYS = [
  { idx: 0, short: 'Sun', long: 'Sunday' },
  { idx: 1, short: 'Mon', long: 'Monday' },
  { idx: 2, short: 'Tue', long: 'Tuesday' },
  { idx: 3, short: 'Wed', long: 'Wednesday' },
  { idx: 4, short: 'Thu', long: 'Thursday' },
  { idx: 5, short: 'Fri', long: 'Friday' },
  { idx: 6, short: 'Sat', long: 'Saturday' },
];

const DEFAULTS = {
  check_in_start: '06:00',
  present_until: '11:00',
  late_until: '17:00',
  attendance_close: '23:59',
  checkout_start: '21:30',
  checkout_end: '23:59',
  worklog_start: '21:30',
  worklog_end: '23:59',
  weekends_are_holidays: true,
  working_days: [1, 2, 3, 4, 5] as number[],
};

type Settings = typeof DEFAULTS;

const TimeField: React.FC<{
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}> = ({ label, icon, value, onChange, hint }) => (
  <div className="space-y-1.5">
    <Label className="text-gray-300 text-xs flex items-center gap-1.5">
      {icon}
      {label}
    </Label>
    <Input
      type="time"
      value={(value || '').slice(0, 5)}
      onChange={(e) => onChange(e.target.value)}
      className="bg-black/50 border-white/10 text-white"
    />
    {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
  </div>
);

const TimeManagement: React.FC = () => {
  const navigate = useNavigate();
  const { adminProfile } = useAuth();
  const isSuperAdmin = adminProfile?.role === 'super_admin';
  const { holidays, isLoading: loadingHolidays, addHoliday, deleteHoliday } = useHolidays();

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Holiday form state
  const [holidayDialog, setHolidayDialog] = useState(false);
  const [hDate, setHDate] = useState<Date | undefined>(new Date());
  const [hName, setHName] = useState('');
  const [hDesc, setHDesc] = useState('');
  const [hRecurring, setHRecurring] = useState(false);

  const [effectiveFrom, setEffectiveFrom] = useState<Date | undefined>(new Date());
  const [previewFrom, setPreviewFrom] = useState<Date | undefined>(new Date());
  const [previewTo, setPreviewTo] = useState<Date | undefined>(new Date(Date.now() + 6 * 86400000));
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [prevSnapshot, setPrevSnapshot] = useState<any>(null);

  const loadAudit = async () => {
    const { data } = await supabase
      .from('time_management_audit' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setAuditRows((data as any[]) || []);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('attendance_settings' as any)
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        setSettingsId((data as any).id);
        setSettings((s) => ({ ...s, ...(data as any), working_days: (data as any).working_days || s.working_days }));
        setPrevSnapshot(data);
      }
      setLoading(false);
      loadAudit();
    })();
  }, []);

  const validate = (s: Settings): string[] => {
    const errs: string[] = [];
    const toMin = (t: string) => {
      const [h, m] = (t || '00:00').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    if (toMin(s.check_in_start) >= toMin(s.present_until)) errs.push('Check-in Opens must be earlier than Present Until.');
    if (toMin(s.present_until) >= toMin(s.late_until)) errs.push('Present Until must be earlier than Late Until.');
    if (toMin(s.late_until) >= toMin(s.attendance_close)) errs.push('Late Until must be earlier than Attendance Closes.');
    if (toMin(s.checkout_start) >= toMin(s.checkout_end)) errs.push('Checkout Opens must be earlier than Checkout Closes.');
    if (toMin(s.worklog_start) >= toMin(s.worklog_end)) errs.push('Work Log Opens must be earlier than Work Log Closes.');
    if (toMin(s.late_until) > toMin(s.checkout_start)) errs.push('Late-until time overlaps with the Checkout window.');
    if (!s.working_days.length) errs.push('Pick at least one working day.');
    return errs;
  };

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const toggleWorkingDay = (idx: number) => {
    const set = new Set(settings.working_days);
    set.has(idx) ? set.delete(idx) : set.add(idx);
    update('working_days', Array.from(set).sort((a, b) => a - b));
  };

  const save = async () => {
    if (!isSuperAdmin) return;
    const errs = validate(settings);
    setValidationErrors(errs);
    if (errs.length) {
      toast({ title: 'Fix these before saving', description: errs[0], variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: any = {
      check_in_start: settings.check_in_start,
      present_until: settings.present_until,
      late_until: settings.late_until,
      attendance_close: settings.attendance_close,
      checkout_start: settings.checkout_start,
      checkout_end: settings.checkout_end,
      worklog_start: settings.worklog_start,
      worklog_end: settings.worklog_end,
      weekends_are_holidays: settings.weekends_are_holidays,
      working_days: settings.working_days,
      updated_by: adminProfile?.id,
    };
    const isScheduled = !!(effectiveFrom && effectiveFrom.getTime() > Date.now() + 60_000);
    const diff: Record<string, { from: any; to: any }> = {};
    if (prevSnapshot) {
      Object.keys(payload).forEach((k) => {
        const a = JSON.stringify((prevSnapshot as any)[k] ?? null);
        const b = JSON.stringify(payload[k] ?? null);
        if (a !== b) diff[k] = { from: (prevSnapshot as any)[k] ?? null, to: payload[k] ?? null };
      });
    }
    if (isScheduled) {
      await supabase.from('time_management_audit' as any).insert({
        changed_by: adminProfile?.id,
        changed_by_name: adminProfile?.name,
        action: 'scheduled_update',
        prev_snapshot: prevSnapshot,
        new_snapshot: { ...payload, effective_from: effectiveFrom!.toISOString() },
        diff,
      });
      setSaving(false);
      toast({ title: 'Scheduled', description: `Rules will apply from ${format(effectiveFrom!, 'PPP')}.` });
      loadAudit();
      return;
    }
    const { data, error } = settingsId
      ? await supabase.from('attendance_settings' as any).update(payload).eq('id', settingsId).select('*').single()
      : await supabase.from('attendance_settings' as any).insert(payload).select('*').single();
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    if ((data as any)?.id) setSettingsId((data as any).id);
    await supabase.from('time_management_audit' as any).insert({
      changed_by: adminProfile?.id,
      changed_by_name: adminProfile?.name,
      action: 'update_settings',
      prev_snapshot: prevSnapshot,
      new_snapshot: data,
      diff,
    });
    setPrevSnapshot(data);
    loadAudit();
    toast({ title: 'Time rules updated', description: 'Attendance, work log and holiday rules are now active.' });
  };

  const revertTo = async (row: any) => {
    if (!isSuperAdmin) return;
    const snap = row.prev_snapshot;
    if (!snap) { toast({ title: 'Nothing to revert to', variant: 'destructive' }); return; }
    const payload: any = { ...snap, updated_by: adminProfile?.id };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const { data, error } = settingsId
      ? await supabase.from('attendance_settings' as any).update(payload).eq('id', settingsId).select('*').single()
      : await supabase.from('attendance_settings' as any).insert(payload).select('*').single();
    if (error) { toast({ title: 'Revert failed', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('time_management_audit' as any).insert({
      changed_by: adminProfile?.id,
      changed_by_name: adminProfile?.name,
      action: 'revert',
      prev_snapshot: prevSnapshot,
      new_snapshot: data,
      diff: { revert_of: { from: null, to: row.id } },
    });
    await supabase.from('time_management_audit' as any).update({ reverted: true, reverted_at: new Date().toISOString(), reverted_by: adminProfile?.id }).eq('id', row.id);
    setPrevSnapshot(data);
    setSettings((s) => ({ ...s, ...(data as any) }));
    loadAudit();
    toast({ title: 'Reverted', description: 'Previous time rules restored.' });
  };

  const addHol = async () => {
    if (!hDate || !hName.trim()) {
      toast({ title: 'Pick a date and enter a name', variant: 'destructive' });
      return;
    }
    const r = await addHoliday({
      date: format(hDate, 'yyyy-MM-dd'),
      name: hName.trim(),
      description: hDesc.trim() || undefined,
      is_recurring: hRecurring,
    });
    if (r) {
      setHolidayDialog(false);
      setHName('');
      setHDesc('');
      setHRecurring(false);
      setHDate(new Date());
    }
  };

  const previewWindow = (start: string, end: string) =>
    `${(start || '').slice(0, 5)} → ${(end || '').slice(0, 5)} IST`;

  const previewRange = useMemo(() => {
    if (!previewFrom || !previewTo) return [] as { date: Date; kind: string }[];
    const holidayDates = new Set(
      (holidays || []).map((h: any) => (h.is_recurring ? `--${h.date.slice(5)}` : h.date)),
    );
    const out: { date: Date; kind: string }[] = [];
    const start = previewFrom.getTime();
    const end = previewTo.getTime();
    for (let t = start; t <= end && out.length < 120; t += 86400000) {
      const d = new Date(t);
      const ds = format(d, 'yyyy-MM-dd');
      const isHol = holidayDates.has(ds) || holidayDates.has(`--${ds.slice(5)}`);
      const isWork = settings.working_days.includes(d.getDay());
      out.push({ date: d, kind: isHol ? 'Holiday' : !isWork ? 'Weekend / Off' : 'Working day' });
    }
    return out;
  }, [previewFrom, previewTo, holidays, settings.working_days]);

  const workingDayCount = settings.working_days.length;
  const restDays = useMemo(
    () => DAYS.filter((d) => !settings.working_days.includes(d.idx)).map((d) => d.short),
    [settings.working_days],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button
          variant="outline"
          onClick={() => navigate('/dashboard')}
          className="mb-6 bg-black/40 border-white/10 text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Clock className="w-7 h-7 text-blue-400" />
                Time Management
              </h1>
              <p className="text-gray-400 mt-1">
                Configure working week, holidays, attendance windows and work-log timing — applied instantly across the app.
              </p>
            </div>
            {isSuperAdmin && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-gray-400">Effective from</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start bg-black/40 border-white/10 text-white h-9">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {effectiveFrom ? format(effectiveFrom, 'PPP') : 'Immediately'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700">
                      <Calendar mode="single" selected={effectiveFrom} onSelect={setEffectiveFrom} initialFocus className={cn('p-3 pointer-events-auto')} />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button onClick={save} disabled={saving} className="gradient-primary h-9">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>

          {validationErrors.length > 0 && (
            <Card className="bg-red-500/10 border-red-500/40 mb-6">
              <CardContent className="p-4 text-sm text-red-200 flex gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <ul className="list-disc pl-4 space-y-1">
                  {validationErrors.map((e, i) => (<li key={i}>{e}</li>))}
                </ul>
              </CardContent>
            </Card>
          )}

          {!isSuperAdmin && (
            <Card className="bg-amber-500/10 border-amber-500/30 mb-6">
              <CardContent className="p-4 flex items-center gap-3 text-amber-200 text-sm">
                <ShieldAlert className="w-5 h-5" />
                Read-only view. Only Super Admins can edit time-management rules.
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="week" className="space-y-6">
            <TabsList className="bg-gray-900/60 border border-white/10">
              <TabsTrigger value="week"><CalendarDays className="w-4 h-4 mr-2" />Working Week</TabsTrigger>
              <TabsTrigger value="attendance"><LogIn className="w-4 h-4 mr-2" />Attendance</TabsTrigger>
              <TabsTrigger value="worklog"><ClipboardList className="w-4 h-4 mr-2" />Work Log & Checkout</TabsTrigger>
              <TabsTrigger value="holidays"><CalendarCheck className="w-4 h-4 mr-2" />Holidays</TabsTrigger>
              <TabsTrigger value="preview"><Eye className="w-4 h-4 mr-2" />Preview</TabsTrigger>
              <TabsTrigger value="audit"><History className="w-4 h-4 mr-2" />Audit & Revert</TabsTrigger>
            </TabsList>

            {/* WORKING WEEK */}
            <TabsContent value="week">
              <Card className="bg-gray-900/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Weekdays & Weekends</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-sm text-gray-400">
                    Tap a day to mark it as a working day. Unselected days won't count as absent or late.
                  </p>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map((d) => {
                      const active = settings.working_days.includes(d.idx);
                      return (
                        <button
                          key={d.idx}
                          type="button"
                          disabled={!isSuperAdmin}
                          onClick={() => toggleWorkingDay(d.idx)}
                          className={cn(
                            'rounded-xl px-2 py-4 text-center border transition-all',
                            active
                              ? 'bg-blue-500/20 border-blue-400 text-white shadow-[0_0_24px_-12px_rgba(59,130,246,0.8)]'
                              : 'bg-black/30 border-white/10 text-gray-500 hover:border-white/30',
                            !isSuperAdmin && 'cursor-not-allowed opacity-80',
                          )}
                        >
                          <div className="text-xs uppercase tracking-wider">{d.short}</div>
                          <div className="text-[10px] mt-1 opacity-70">{active ? 'Working' : 'Off'}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <p className="text-gray-400 text-xs">Working days / week</p>
                      <p className="text-white text-xl font-semibold">{workingDayCount}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <p className="text-gray-400 text-xs">Weekly rest days</p>
                      <p className="text-white text-xl font-semibold">{restDays.length ? restDays.join(', ') : '—'}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-xs">Treat weekends as holidays</p>
                        <p className="text-[11px] text-gray-500">Legacy fallback when no working days are picked.</p>
                      </div>
                      <Switch
                        checked={settings.weekends_are_holidays}
                        disabled={!isSuperAdmin}
                        onCheckedChange={(v) => update('weekends_are_holidays', v)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ATTENDANCE */}
            <TabsContent value="attendance">
              <Card className="bg-gray-900/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Attendance Marking Windows</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <TimeField label="Check-in Opens" icon={<LogIn className="w-3 h-3" />} value={settings.check_in_start} onChange={(v) => update('check_in_start', v)} hint="Earliest face-scan allowed" />
                    <TimeField label="Present Until" value={settings.present_until} onChange={(v) => update('present_until', v)} hint="Marked Present before this" />
                    <TimeField label="Late Until" value={settings.late_until} onChange={(v) => update('late_until', v)} hint="Marked Late before this" />
                    <TimeField label="Attendance Closes" value={settings.attendance_close} onChange={(v) => update('attendance_close', v)} hint="After this → Absent" />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm space-y-2">
                    <p className="text-gray-300 font-medium">Live Preview</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-300">
                      <Badge className="bg-green-500/20 text-green-300 border border-green-500/40 justify-center py-1">Present: {settings.check_in_start.slice(0,5)} – {settings.present_until.slice(0,5)}</Badge>
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 justify-center py-1">Late: {settings.present_until.slice(0,5)} – {settings.late_until.slice(0,5)}</Badge>
                      <Badge className="bg-red-500/20 text-red-300 border border-red-500/40 justify-center py-1">Absent: after {settings.late_until.slice(0,5)}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* WORK LOG / CHECKOUT */}
            <TabsContent value="worklog">
              <Card className="bg-gray-900/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Work Log & Checkout Windows</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-sm text-gray-300 font-medium mb-2 flex items-center gap-1.5"><LogOut className="w-4 h-4 text-pink-400" /> Checkout Face-Scan Window</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TimeField label="Checkout Opens" value={settings.checkout_start} onChange={(v) => update('checkout_start', v)} />
                      <TimeField label="Checkout Closes" value={settings.checkout_end} onChange={(v) => update('checkout_end', v)} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-300 font-medium mb-2 flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-purple-400" /> Work Log Entry Window</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TimeField label="Work Log Opens" value={settings.worklog_start} onChange={(v) => update('worklog_start', v)} />
                      <TimeField label="Work Log Closes" value={settings.worklog_end} onChange={(v) => update('worklog_end', v)} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm space-y-2 text-gray-300">
                    <p className="font-medium text-white">Live Preview</p>
                    <p>Checkout: <span className="text-pink-300">{previewWindow(settings.checkout_start, settings.checkout_end)}</span></p>
                    <p>Work Log: <span className="text-purple-300">{previewWindow(settings.worklog_start, settings.worklog_end)}</span></p>
                    <p className="text-[11px] text-gray-500">Both windows are enforced server-side and only Super Admins can bypass them.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* HOLIDAYS */}
            <TabsContent value="holidays">
              <Card className="bg-gray-900/50 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-white text-lg">Special & Extra Holidays</CardTitle>
                  {isSuperAdmin && (
                    <Dialog open={holidayDialog} onOpenChange={setHolidayDialog}>
                      <DialogTrigger asChild>
                        <Button className="gradient-primary"><Plus className="w-4 h-4 mr-2" /> Add Holiday</Button>
                      </DialogTrigger>
                      <DialogContent className="bg-gray-900 border-gray-700">
                        <DialogHeader>
                          <DialogTitle className="text-white">Add Holiday</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-gray-300">Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start bg-black/40 border-white/10 text-white">
                                  <CalendarIcon className="w-4 h-4 mr-2" />
                                  {hDate ? format(hDate, 'PPP') : 'Pick a date'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700">
                                <Calendar mode="single" selected={hDate} onSelect={setHDate} initialFocus className={cn('p-3 pointer-events-auto')} />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-gray-300">Name</Label>
                            <Input value={hName} onChange={(e) => setHName(e.target.value)} placeholder="e.g. Diwali" className="bg-black/40 border-white/10 text-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-gray-300">Description</Label>
                            <Textarea value={hDesc} onChange={(e) => setHDesc(e.target.value)} placeholder="Optional notes" className="bg-black/40 border-white/10 text-white" />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3">
                            <div>
                              <Label className="text-white">Recurring every year</Label>
                              <p className="text-[11px] text-gray-500">Holiday repeats on the same day & month annually.</p>
                            </div>
                            <Switch checked={hRecurring} onCheckedChange={setHRecurring} />
                          </div>
                          <Button onClick={addHol} className="w-full gradient-primary">Save Holiday</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent>
                  {loadingHolidays ? (
                    <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>
                  ) : holidays.length === 0 ? (
                    <p className="text-center text-gray-500 py-10 text-sm">No holidays added yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10">
                            <TableHead className="text-gray-400">Date</TableHead>
                            <TableHead className="text-gray-400">Name</TableHead>
                            <TableHead className="text-gray-400">Description</TableHead>
                            <TableHead className="text-gray-400">Recurring</TableHead>
                            {isSuperAdmin && <TableHead className="text-gray-400 text-right">Action</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {holidays.map((h) => (
                            <TableRow key={h.id} className="border-white/10">
                              <TableCell className="text-white">{format(new Date(h.date), 'dd MMM yyyy')}</TableCell>
                              <TableCell className="text-white">{h.name}</TableCell>
                              <TableCell className="text-gray-400">{h.description || '—'}</TableCell>
                              <TableCell>
                                {h.is_recurring ? <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40">Yearly</Badge> : <span className="text-gray-500 text-sm">One-time</span>}
                              </TableCell>
                              {isSuperAdmin && (
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { if (confirm('Delete this holiday?')) deleteHoliday(h.id); }}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* PREVIEW */}
            <TabsContent value="preview">
              <Card className="bg-gray-900/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2"><Eye className="w-5 h-5 text-emerald-400" />Impact Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">Pick a range and see how the current (unsaved) rules would classify each day.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start bg-black/40 border-white/10 text-white">
                          <CalendarIcon className="w-4 h-4 mr-2" />From: {previewFrom ? format(previewFrom, 'PPP') : 'Pick'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700">
                        <Calendar mode="single" selected={previewFrom} onSelect={setPreviewFrom} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start bg-black/40 border-white/10 text-white">
                          <CalendarIcon className="w-4 h-4 mr-2" />To: {previewTo ? format(previewTo, 'PPP') : 'Pick'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700">
                        <Calendar mode="single" selected={previewTo} onSelect={setPreviewTo} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow className="border-white/10">
                        <TableHead className="text-gray-400">Date</TableHead>
                        <TableHead className="text-gray-400">Day</TableHead>
                        <TableHead className="text-gray-400">Classification</TableHead>
                        <TableHead className="text-gray-400">On-time before</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {previewRange.map((r) => (
                          <TableRow key={r.date.toISOString()} className="border-white/10">
                            <TableCell className="text-white">{format(r.date, 'dd MMM yyyy')}</TableCell>
                            <TableCell className="text-gray-300">{format(r.date, 'EEEE')}</TableCell>
                            <TableCell>
                              <Badge className={cn(
                                'border',
                                r.kind === 'Holiday' && 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                                r.kind === 'Weekend / Off' && 'bg-gray-500/20 text-gray-300 border-gray-500/40',
                                r.kind === 'Working day' && 'bg-green-500/20 text-green-300 border-green-500/40',
                              )}>{r.kind}</Badge>
                            </TableCell>
                            <TableCell className="text-gray-400 text-sm">
                              {r.kind === 'Working day' ? `${settings.present_until.slice(0,5)} present · ${settings.late_until.slice(0,5)} late` : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* AUDIT */}
            <TabsContent value="audit">
              <Card className="bg-gray-900/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2"><History className="w-5 h-5 text-purple-400" />Change History</CardTitle>
                </CardHeader>
                <CardContent>
                  {auditRows.length === 0 ? (
                    <p className="text-center text-gray-500 py-8 text-sm">No changes recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow className="border-white/10">
                          <TableHead className="text-gray-400">When</TableHead>
                          <TableHead className="text-gray-400">By</TableHead>
                          <TableHead className="text-gray-400">Action</TableHead>
                          <TableHead className="text-gray-400">Changed fields</TableHead>
                          <TableHead className="text-gray-400 text-right">Revert</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {auditRows.map((r) => {
                            const keys = r.diff ? Object.keys(r.diff) : [];
                            return (
                              <TableRow key={r.id} className="border-white/10">
                                <TableCell className="text-white text-xs">{format(new Date(r.created_at), 'dd MMM yyyy · HH:mm')}</TableCell>
                                <TableCell className="text-gray-300 text-xs">{r.changed_by_name || '—'}</TableCell>
                                <TableCell><Badge className="bg-white/10 text-white border-white/20 text-[10px]">{r.action}</Badge></TableCell>
                                <TableCell className="text-gray-400 text-[11px] max-w-[280px] truncate">{keys.length ? keys.join(', ') : '—'}</TableCell>
                                <TableCell className="text-right">
                                  {isSuperAdmin && r.prev_snapshot && !r.reverted && r.action !== 'revert' ? (
                                    <Button size="sm" variant="ghost" onClick={() => { if (confirm('Restore this previous configuration?')) revertTo(r); }} className="text-amber-300 hover:text-amber-200 hover:bg-amber-500/10">
                                      <Undo2 className="w-4 h-4 mr-1" />Revert
                                    </Button>
                                  ) : (
                                    <span className="text-[11px] text-gray-500">{r.reverted ? 'Reverted' : '—'}</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default TimeManagement;
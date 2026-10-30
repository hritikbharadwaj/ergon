import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, LogIn, LogOut, FileText, ShieldCheck, Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isFuture } from 'date-fns';
import { getPresentUntil, getLateUntil } from '@/lib/timeWindow';
import { useTimeWindows } from '@/hooks/useTimeWindows';
import HolidayCard from '@/components/HolidayCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Admin { id: string; name: string; email: string; role: string; avatar?: string }
interface Row {
  admin: Admin;
  check_in_time: string | null;
  check_out_time: string | null;
  work_log_done: boolean;
  attendance_id: string | null;
  final_status: 'present' | 'absent' | null;
  auto_status: 'present' | 'late' | 'absent';
}
interface DayRow {
  date: string;
  d: Date;
  check_in_time: string | null;
  check_out_time: string | null;
  work_log_done: boolean;
  status: 'present' | 'late' | 'absent' | 'weekend' | 'upcoming';
  final_status: 'present' | 'absent' | null;
}

type RTStatus = 'connecting' | 'live' | 'error' | 'closed';

/**
 * Team attendance review cards. Read-only for regular admins (they see the tick/cross
 * for check-in, check-out & work-log). Super admins get Mark Present / Absent / Override
 * controls and a detail popup. Realtime-updated via the attendance & work_log_entries
 * postgres_changes stream so it never flickers or re-mounts on data change.
 */
interface Props {
  /** Extra action buttons (Export CSV / PDF) shown in the header for super admins. */
  headerActions?: React.ReactNode;
}

const TeamAttendanceReviewCards: React.FC<Props> = ({ headerActions }) => {
  const { adminProfile } = useAuth();
  const { toast } = useToast();
  const tzVersion = useTimeWindows();
  const isSuper = adminProfile?.role === 'super_admin';
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [month, setMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [rows, setRows] = useState<Row[]>([]);
  const [dayRows, setDayRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rtStatus, setRtStatus] = useState<RTStatus>('connecting');
  const [dialogRow, setDialogRow] = useState<Row | null>(null);
  const [dialogDay, setDialogDay] = useState<DayRow | null>(null);
  const reconnectRef = useRef<number | null>(null);
  // Super-admin day-wise search: when set, show that admin's monthly day cards instead of the daily team grid.
  const [searchAdminId, setSearchAdminId] = useState<string>('');
  const [searchDayRows, setSearchDayRows] = useState<DayRow[]>([]);
  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('holidays').select('date');
      setHolidaySet(new Set((data || []).map((h: any) => h.date)));
    })();
  }, []);

  const loadTeam = async () => {
    setLoading(true);
    const { data: admins } = await supabase.from('admins')
      .select('id, name, email, role, avatar').eq('is_active', true).order('name');
    const { data: attRows } = await supabase.from('attendance')
      .select('id, admin_id, check_in_time, check_out_time, final_status, marked_at')
      .eq('date', date);
    const presentCutoff = getPresentUntil();
    const lateCutoff = getLateUntil();
    const list: Row[] = [];
    for (const a of (admins || []) as any[]) {
      const att = (attRows || []).find((r: any) => r.admin_id === a.id);
      const { data: hasLog } = await supabase.rpc('admin_has_work_log_for_date' as any, { p_admin_id: a.id, p_date: date });
      const checkIn = att?.check_in_time || att?.marked_at || null;
      let auto: 'present' | 'late' | 'absent' = 'absent';
      if (checkIn) {
        const ist = new Date(new Date(checkIn).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const mins = ist.getHours() * 60 + ist.getMinutes();
        const [ph, pm] = presentCutoff.split(':').map(Number);
        const [lh, lm] = lateCutoff.split(':').map(Number);
        if (mins < ph * 60 + pm) auto = 'present';
        else if (mins < lh * 60 + lm) auto = 'late';
        else auto = 'absent';
      }
      list.push({
        admin: a,
        check_in_time: checkIn,
        check_out_time: att?.check_out_time || null,
        work_log_done: !!hasLog,
        attendance_id: att?.id || null,
        final_status: (att?.final_status as 'present' | 'absent' | null) || null,
        auto_status: auto,
      });
    }
    setRows(list);
    setLoading(false);
  };

  const loadSelfMonth = async () => {
    if (!adminProfile) return;
    setLoading(true);
    const [y, m] = month.split('-').map(Number);
    const start = startOfMonth(new Date(y, m - 1, 1));
    const end = endOfMonth(start);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    const { data: att } = await supabase.from('attendance')
      .select('date, check_in_time, check_out_time, marked_at, status, final_status')
      .eq('admin_id', adminProfile.id)
      .gte('date', startStr).lte('date', endStr);
    const { data: logs } = await supabase.from('work_log_entries')
      .select('log_date, created_at').eq('admin_id', adminProfile.id).eq('is_draft', false)
      .gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59`);
    const logDates = new Set<string>();
    (logs || []).forEach((l: any) => {
      const d = l.log_date || format(new Date(l.created_at), 'yyyy-MM-dd');
      logDates.add(d);
    });
    const days = eachDayOfInterval({ start, end });
    const list: DayRow[] = days.map((d) => {
      const dstr = format(d, 'yyyy-MM-dd');
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const rec = (att || []).find((r: any) => r.date === dstr) as any;
      const upcoming = isFuture(d) && !isSameDay(d, new Date());
      let status: DayRow['status'] = 'absent';
      if (upcoming) status = 'upcoming';
      else if (isWeekend && !rec) status = 'weekend';
      else if (rec?.status === 'present') status = 'present';
      else if (rec?.status === 'late') status = 'late';
      return {
        date: dstr, d,
        check_in_time: rec?.check_in_time || rec?.marked_at || null,
        check_out_time: rec?.check_out_time || null,
        work_log_done: logDates.has(dstr),
        status,
        final_status: (rec?.final_status as any) || null,
      };
    });
    setDayRows(list);
    setLoading(false);
  };

  const load = () => (isSuper ? loadTeam() : loadSelfMonth());

  /** Load a specific admin's monthly day-cards (super-admin search view). */
  const loadSearchAdminMonth = async (adminId: string) => {
    setLoading(true);
    const [y, m] = month.split('-').map(Number);
    const start = startOfMonth(new Date(y, m - 1, 1));
    const end = endOfMonth(start);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    const { data: att } = await supabase.from('attendance')
      .select('date, check_in_time, check_out_time, marked_at, status, final_status')
      .eq('admin_id', adminId)
      .gte('date', startStr).lte('date', endStr);
    const { data: logs } = await supabase.from('work_log_entries')
      .select('log_date, created_at').eq('admin_id', adminId).eq('is_draft', false)
      .gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59`);
    const logDates = new Set<string>();
    (logs || []).forEach((l: any) => {
      const d = l.log_date || format(new Date(l.created_at), 'yyyy-MM-dd');
      logDates.add(d);
    });
    const days = eachDayOfInterval({ start, end });
    const list: DayRow[] = days.map((d) => {
      const dstr = format(d, 'yyyy-MM-dd');
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const rec = (att || []).find((r: any) => r.date === dstr) as any;
      const upcoming = isFuture(d) && !isSameDay(d, new Date());
      let status: DayRow['status'] = 'absent';
      if (upcoming) status = 'upcoming';
      else if (isWeekend && !rec) status = 'weekend';
      else if (rec?.status === 'present') status = 'present';
      else if (rec?.status === 'late') status = 'late';
      return {
        date: dstr, d,
        check_in_time: rec?.check_in_time || rec?.marked_at || null,
        check_out_time: rec?.check_out_time || null,
        work_log_done: logDates.has(dstr),
        status,
        final_status: (rec?.final_status as any) || null,
      };
    });
    setSearchDayRows(list);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuper && searchAdminId) loadSearchAdminMonth(searchAdminId);
    // eslint-disable-next-line
  }, [searchAdminId, month]);

  /** Local list of admins (from Row state) for the super-admin search dropdown. */
  const teamAdmins = useMemo(() => rows.map(r => r.admin), [rows]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date, month, tzVersion, adminProfile?.id, isSuper]);

  // Resilient realtime subscription with reconnect on close/error
  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const connect = () => {
      setRtStatus('connecting');
      const key = isSuper ? `team-att-${date}` : `self-att-${adminProfile?.id}-${month}`;
      ch = supabase.channel(key)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_log_entries' }, () => load())
        .subscribe((status) => {
          if (cancelled) return;
          if (status === 'SUBSCRIBED') setRtStatus('live');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRtStatus('error');
            if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
            reconnectRef.current = window.setTimeout(() => { if (ch) supabase.removeChannel(ch); connect(); }, 3000);
          } else if (status === 'CLOSED') setRtStatus('closed');
        });
    };
    connect();
    return () => {
      cancelled = true;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      if (ch) supabase.removeChannel(ch);
    };
    // eslint-disable-next-line
  }, [date, month, isSuper, adminProfile?.id]);

  const mark = async (row: Row, status: 'present' | 'absent') => {
    if (!isSuper) return;
    const nowIso = new Date().toISOString();
    if (row.attendance_id) {
      await supabase.from('attendance').update({
        final_status: status, final_marked_by: adminProfile?.id, final_marked_at: nowIso, updated_at: nowIso, status,
      } as any).eq('id', row.attendance_id);
    } else {
      await supabase.from('attendance').insert([{
        admin_id: row.admin.id, date, status,
        final_status: status, final_marked_by: adminProfile?.id, final_marked_at: nowIso,
        marked_at: nowIso,
      } as any]);
    }
    toast({ title: `Marked ${status}`, description: `${row.admin.name} · ${date}` });
    setDialogRow(null);
  };

  const stats = useMemo(() => {
    const present = rows.filter(r => (r.final_status || r.auto_status) === 'present').length;
    const absent = rows.filter(r => (r.final_status || r.auto_status) === 'absent').length;
    const late = rows.filter(r => r.final_status == null && r.auto_status === 'late').length;
    const finalized = rows.filter(r => r.final_status != null).length;
    return { present, late, absent, finalized, total: rows.length };
  }, [rows]);

  const selfStats = useMemo(() => {
    const present = dayRows.filter(d => d.status === 'present').length;
    const late = dayRows.filter(d => d.status === 'late').length;
    const absent = dayRows.filter(d => d.status === 'absent').length;
    const workLogs = dayRows.filter(d => d.work_log_done).length;
    return { present, late, absent, workLogs, total: dayRows.filter(d => d.status !== 'weekend' && d.status !== 'upcoming').length };
  }, [dayRows]);

  const Tick = ({ ok }: { ok: boolean }) =>
    ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />;

  const RtBadge = () => {
    if (rtStatus === 'live') return <Badge className="bg-green-500/20 text-green-400 gap-1"><Wifi className="h-3 w-3" />Live</Badge>;
    if (rtStatus === 'connecting') return <Badge className="bg-amber-500/20 text-amber-400 gap-1"><Loader2 className="h-3 w-3 animate-spin" />Connecting</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 gap-1"><WifiOff className="h-3 w-3" />Offline<Button size="sm" variant="ghost" onClick={() => load()} className="h-4 px-1"><RefreshCw className="h-3 w-3" /></Button></Badge>;
  };

  const statusPill = (s: DayRow['status']) => {
    if (s === 'present') return <Badge className="bg-green-500/20 text-green-400">Present</Badge>;
    if (s === 'late') return <Badge className="bg-amber-500/20 text-amber-400">Late</Badge>;
    if (s === 'absent') return <Badge className="bg-red-500/20 text-red-400">Absent</Badge>;
    if (s === 'weekend') return <Badge className="bg-gray-700/50 text-gray-400">Weekend</Badge>;
    return <Badge className="bg-gray-800/50 text-gray-500">Upcoming</Badge>;
  };

  /* -------- Non-super admin: self monthly cards -------- */
  if (!isSuper) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h3 className="text-white font-semibold">My Attendance — {format(new Date(month + '-01'), 'MMMM yyyy')}</h3>
              <p className="text-xs text-muted-foreground">Your own daily check-in, check-out and work-log status for the month.</p>
            </div>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-[170px] bg-gray-900 border-gray-700 text-white" />
              <RtBadge />
              <Badge className="bg-green-500/20 text-green-400">Present {selfStats.present}</Badge>
              <Badge className="bg-amber-500/20 text-amber-400">Late {selfStats.late}</Badge>
              <Badge className="bg-red-500/20 text-red-400">Absent {selfStats.absent}</Badge>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-6 text-sm">Loading…</div>
          ) : (
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {dayRows.map((day) => (
                <Card key={day.date}
                  className={`relative overflow-hidden border cursor-pointer transition hover:shadow-lg ${
                    day.status === 'present' ? 'border-green-500/40' :
                    day.status === 'late' ? 'border-amber-500/40' :
                    day.status === 'absent' ? 'border-red-500/40' :
                    'border-border/40 opacity-60'}`}
                  onClick={() => setDialogDay(day)}>
                  {holidaySet.has(day.date) && <HolidayCard compact />}
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-lg font-bold text-white">{format(day.d, 'dd')}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{format(day.d, 'EEE')}</div>
                      </div>
                      {statusPill(day.status)}
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center gap-1"><LogIn className="h-3 w-3 text-muted-foreground" />
                        <Tick ok={!!day.check_in_time} /></div>
                      <div className="flex items-center gap-1"><LogOut className="h-3 w-3 text-muted-foreground" />
                        <Tick ok={!!day.check_out_time} /></div>
                      <div className="flex items-center gap-1"><FileText className="h-3 w-3 text-muted-foreground" />
                        <Tick ok={day.work_log_done} /></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>

        <Dialog open={!!dialogDay} onOpenChange={(o) => !o && setDialogDay(null)}>
          <DialogContent className="max-w-md">
            {dialogDay && (
              <>
                <DialogHeader><DialogTitle>{format(dialogDay.d, 'EEEE, dd MMM yyyy')}</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span>{statusPill(dialogDay.status)}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Check-in</span>
                    <span className="font-mono">{dialogDay.check_in_time ? format(new Date(dialogDay.check_in_time), 'hh:mm:ss a') : 'Not recorded'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Check-out</span>
                    <span className="font-mono">{dialogDay.check_out_time ? format(new Date(dialogDay.check_out_time), 'hh:mm:ss a') : 'Not recorded'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Work log</span>
                    <span>{dialogDay.work_log_done ? '✅ Submitted' : '❌ Missing'}</span></div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h3 className="text-white font-semibold">Team Attendance</h3>
            <p className="text-xs text-muted-foreground">Tap a card to review; mark Present or Absent to override the auto status.</p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Select value={searchAdminId || 'all'} onValueChange={(v) => setSearchAdminId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[200px] h-9 bg-gray-900 border-gray-700 text-white text-xs">
                <SelectValue placeholder="🔍 Search admin (day-wise)" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="all">All Admins (today)</SelectItem>
                {teamAdmins.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {searchAdminId
              ? <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-[170px] bg-gray-900 border-gray-700 text-white" />
              : <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[180px] bg-gray-900 border-gray-700 text-white" />}
            <RtBadge />
            {headerActions}
          </div>
        </div>

        {/* Super-admin day-wise view for one admin */}
        {searchAdminId ? (
          loading ? (
            <div className="text-center text-muted-foreground py-6 text-sm">Loading…</div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                Showing <span className="text-white font-medium">{teamAdmins.find(a => a.id === searchAdminId)?.name}</span> · {format(new Date(month + '-01'), 'MMMM yyyy')}
              </div>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {searchDayRows.map((day) => (
                  <Card key={day.date}
                    className={`relative overflow-hidden border cursor-pointer transition hover:shadow-lg ${
                      day.status === 'present' ? 'border-green-500/40' :
                      day.status === 'late' ? 'border-amber-500/40' :
                      day.status === 'absent' ? 'border-red-500/40' :
                      'border-border/40 opacity-60'}`}
                    onClick={() => setDialogDay(day)}>
                    {holidaySet.has(day.date) && <HolidayCard compact />}
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-lg font-bold text-white">{format(day.d, 'dd')}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{format(day.d, 'EEE')}</div>
                        </div>
                        {statusPill(day.status)}
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1"><LogIn className="h-3 w-3 text-muted-foreground" />
                          <Tick ok={!!day.check_in_time} /></div>
                        <div className="flex items-center gap-1"><LogOut className="h-3 w-3 text-muted-foreground" />
                          <Tick ok={!!day.check_out_time} /></div>
                        <div className="flex items-center gap-1"><FileText className="h-3 w-3 text-muted-foreground" />
                          <Tick ok={day.work_log_done} /></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )
        ) : (
        <>
        {/* Prominent present / absent summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.present}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Present</div>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.absent}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Absent</div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.late}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Late</div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-center">
            <div className="text-2xl font-bold text-primary">{stats.finalized}/{stats.total}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Finalized</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-6 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-6 text-sm">No admins.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => {
              const finalized = r.final_status != null;
              const isHoliday = holidaySet.has(date);
              return (
                <Card key={r.admin.id}
                  className={`relative overflow-hidden border transition hover:shadow-lg ${isSuper ? 'cursor-pointer' : ''} ${
                    r.final_status === 'present' ? 'border-green-500/50' :
                    r.final_status === 'absent' ? 'border-red-500/50' :
                    'border-border/50'}`}
                  onClick={() => isSuper && setDialogRow(r)}>
                  {isHoliday && <HolidayCard compact />}
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {r.admin.avatar ? <img src={r.admin.avatar} className="h-10 w-10 rounded-full object-cover" alt="" />
                        : <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-semibold">{r.admin.name?.[0]}</div>}
                      <div className="min-w-0">
                        <div className="font-semibold truncate text-white">{r.admin.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.admin.role}</div>
                      </div>
                      {isSuper && finalized && (
                        <Badge className={r.final_status === 'present' ? 'bg-green-500/20 text-green-400 ml-auto' : 'bg-red-500/20 text-red-400 ml-auto'}>
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          {r.final_status}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2"><LogIn className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1">Check-in</span>
                        <span className="font-mono text-xs">{r.check_in_time ? format(new Date(r.check_in_time), 'hh:mm a') : '—'}</span>
                        <Tick ok={!!r.check_in_time} />
                      </div>
                      <div className="flex items-center gap-2"><LogOut className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1">Check-out</span>
                        <span className="font-mono text-xs">{r.check_out_time ? format(new Date(r.check_out_time), 'hh:mm a') : '—'}</span>
                        <Tick ok={!!r.check_out_time} />
                      </div>
                      <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1">Work log</span>
                        <Tick ok={r.work_log_done} />
                      </div>
                    </div>
                    {isSuper && (
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={(e) => { e.stopPropagation(); mark(r, 'present'); }}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Present
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1"
                          onClick={(e) => { e.stopPropagation(); mark(r, 'absent'); }}>
                          <XCircle className="h-4 w-4 mr-1" /> Absent
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </>
        )}
      </CardContent>

      <Dialog open={!!dialogRow} onOpenChange={(o) => !o && setDialogRow(null)}>
        <DialogContent className="max-w-md">
          {dialogRow && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {dialogRow.admin.avatar ? <img src={dialogRow.admin.avatar} className="h-10 w-10 rounded-full object-cover" alt="" />
                    : <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-semibold">{dialogRow.admin.name?.[0]}</div>}
                  <div>
                    <div>{dialogRow.admin.name}</div>
                    <div className="text-xs text-muted-foreground font-normal">{dialogRow.admin.role} · {date}</div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-border/40 p-3 space-y-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Check-in</span>
                    <span className="font-mono">{dialogRow.check_in_time ? format(new Date(dialogRow.check_in_time), 'hh:mm:ss a') : 'Not recorded'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Check-out</span>
                    <span className="font-mono">{dialogRow.check_out_time ? format(new Date(dialogRow.check_out_time), 'hh:mm:ss a') : 'Not recorded'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Work log</span>
                    <span>{dialogRow.work_log_done ? '✅ Submitted' : '❌ Missing'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Auto status</span>
                    <Badge>{dialogRow.auto_status}</Badge></div>
                  {dialogRow.final_status && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Final</span>
                      <Badge className={dialogRow.final_status === 'present' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {dialogRow.final_status.toUpperCase()}
                      </Badge></div>
                  )}
                </div>
                {isSuper && (
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => mark(dialogRow, 'present')}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Present
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => mark(dialogRow, 'absent')}>
                      <XCircle className="h-4 w-4 mr-1" /> Mark Absent
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TeamAttendanceReviewCards;
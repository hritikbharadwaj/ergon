import React, { useEffect, useMemo, useState } from 'react';
import ModuleLayout from '@/components/ModuleLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Clock, User, Briefcase, Eye, FileText, Download, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { downloadCsv } from '@/lib/csvExport';
import { useToast } from '@/components/ui/use-toast';

interface LogRow {
  id: string;
  admin_id: string;
  work_type: string;
  project_module: string | null;
  priority: string;
  title: string;
  description: string;
  url: string | null;
  hours_spent: number;
  log_date: string;
  tags: string[] | null;
  work_impact: string | null;
  is_draft: boolean;
  blockers?: string | null;
  next_steps?: string | null;
  collaborators?: string | null;
  completion_pct?: number | null;
  mood?: number | null;
  created_at: string;
}

const MOODS = ['😞', '😕', '😐', '🙂', '🤩'];

const WorkLogs: React.FC = () => {
  const { adminProfile } = useAuth();
  const { toast } = useToast();
  const isSuper = adminProfile?.role === 'super_admin';
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [admins, setAdmins] = useState<Record<string, { name: string; role: string; avatar: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LogRow | null>(null);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'hours' | 'mood'>('newest');
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [adminFilter, setAdminFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const load = async () => {
    const { data: logsData } = await supabase
      .from('work_log_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setLogs((logsData || []) as any);

    const { data: adminsData } = await supabase
      .from('admins').select('id, name, role, avatar');
    const m: Record<string, any> = {};
    (adminsData || []).forEach((a: any) => { m[a.id] = a; });
    setAdmins(m);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  // For super_admin, show ONE most-recent log per admin (per the brief).
  // For everyone else, show full personal history.
  const visible = useMemo(() => {
    let rows = logs;
    if (!isSuper && adminProfile?.id) {
      rows = rows.filter((l) => l.admin_id === adminProfile.id);
    } else if (!isSuper) {
      rows = [];
    }
    if (isSuper && adminFilter !== 'all') {
      rows = rows.filter(l => l.admin_id === adminFilter);
    }
    if (moodFilter !== 'all') {
      const m = Number(moodFilter);
      rows = rows.filter(l => (l.mood ?? 0) === m);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((l) =>
        l.title?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q) ||
        (admins[l.admin_id]?.name || '').toLowerCase().includes(q));
    }
    // sort
    rows = [...rows].sort((a, b) => {
      if (sort === 'newest') return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === 'oldest') return +new Date(a.created_at) - +new Date(b.created_at);
      if (sort === 'hours')  return (b.hours_spent || 0) - (a.hours_spent || 0);
      if (sort === 'mood')   return (b.mood || 0) - (a.mood || 0);
      return 0;
    });
    return rows;
  }, [logs, isSuper, adminProfile?.id, search, admins, sort, moodFilter, adminFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [search, sort, moodFilter, adminFilter]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageRows = visible.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    const rows = visible.map(l => ({
      Date: l.log_date,
      Admin: admins[l.admin_id]?.name || '—',
      Role: admins[l.admin_id]?.role || '',
      Title: l.title,
      'Work Type': l.work_type,
      Project: l.project_module || '',
      Priority: l.priority,
      Hours: l.hours_spent,
      Completion: l.completion_pct ?? '',
      Mood: l.mood ?? '',
      Description: l.description,
      Blockers: l.blockers || '',
      'Next Steps': l.next_steps || '',
      Collaborators: l.collaborators || '',
      Draft: l.is_draft ? 'yes' : 'no',
      Created: new Date(l.created_at).toLocaleString(),
    }));
    downloadCsv(`work-logs-${new Date().toISOString().slice(0,10)}.csv`, rows);
    toast({ title: 'CSV downloaded' });
  };

  const priColor = (p: string) => ({
    urgent: 'border-rose-500/40 text-rose-300',
    high: 'border-amber-500/40 text-amber-300',
    medium: 'border-[#A06CFF]/40 text-[#C9A8FF]',
    low: 'border-white/20 text-white/60',
  }[p] || 'border-white/20 text-white/60');

  return (
    <ModuleLayout
      title={isSuper ? 'All Admin Work Logs' : 'My Work Logs'}
      description={isSuper
        ? 'Latest work log per admin (one row each, newest first). Click to see full details.'
        : 'Your complete personal work-log history.'}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative w-full sm:flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, description or admin…"
            className="pl-9 bg-[#0a0a14] border-white/10" />
        </div>
        <Select value={sort} onValueChange={(v: any) => setSort(v)}>
          <SelectTrigger className="flex-1 min-w-[120px] sm:flex-none sm:w-[140px] bg-[#0a0a14] border-white/10">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="hours">Most hours</SelectItem>
            <SelectItem value="mood">Best mood</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moodFilter} onValueChange={setMoodFilter}>
          <SelectTrigger className="flex-1 min-w-[110px] sm:flex-none sm:w-[120px] bg-[#0a0a14] border-white/10"><SelectValue placeholder="Mood" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any mood</SelectItem>
            {MOODS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m} ({i + 1})</SelectItem>)}
          </SelectContent>
        </Select>
        {isSuper && (
          <Select value={adminFilter} onValueChange={setAdminFilter}>
            <SelectTrigger className="flex-1 min-w-[140px] sm:flex-none sm:w-[160px] bg-[#0a0a14] border-white/10"><SelectValue placeholder="Admin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All admins</SelectItem>
              {Object.entries(admins).map(([id, a]) => (
                <SelectItem key={id} value={id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" className="gap-1.5 border-white/10 flex-1 sm:flex-none" onClick={exportCsv} data-track="worklogs_csv">
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
        <Badge variant="outline" className="border-white/15 text-white/70 whitespace-nowrap">
          {visible.length} {visible.length === 1 ? 'log' : 'logs'}
        </Badge>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-white/10 bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : pageRows.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-white/60">
            <FileText className="mx-auto mb-3 h-10 w-10 text-white/30" />
            <p>No work logs to display yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid gap-3">
          {pageRows.map((l) => {
            const a = admins[l.admin_id];
            return (
              <div key={l.id}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md hover:border-[#A06CFF]/40 hover:shadow-[0_0_20px_rgba(160,108,255,0.15)] transition-all cursor-pointer"
                onClick={() => setSelected(l)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white truncate">{l.title}</p>
                      <Badge variant="outline" className={`text-[10px] capitalize ${priColor(l.priority)}`}>{l.priority}</Badge>
                      {l.is_draft && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">Draft</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] border-white/15 text-white/60">{l.work_type}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-white/60 line-clamp-2">{l.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/50">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {a?.name || '—'} <span className="text-white/30">· {a?.role?.replace('_', ' ')}</span></span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {l.hours_spent}h</span>
                      <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {l.project_module || 'No module'}</span>
                      <span>{l.log_date}</span>
                      {l.mood && <span>{MOODS[l.mood - 1]}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-white/60 hover:text-white"
                    onClick={(e) => { e.stopPropagation(); setSelected(l); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button size="sm" variant="outline" className="border-white/10" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-white/60">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" className="border-white/10" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl bg-black border-l border-white/10 overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white text-xl flex items-center gap-2">
                  {selected.title}
                </SheetTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className={`text-[10px] capitalize ${priColor(selected.priority)}`}>{selected.priority}</Badge>
                  <Badge variant="outline" className="text-[10px] border-white/15 text-white/60">{selected.work_type}</Badge>
                  {selected.is_draft && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">Draft</Badge>}
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <DetailRow label="Author" value={admins[selected.admin_id]?.name || '—'} />
                <DetailRow label="Role" value={admins[selected.admin_id]?.role?.replace('_', ' ') || '—'} />
                <DetailRow label="Project / Module" value={selected.project_module || '—'} />
                <DetailRow label="Hours spent" value={`${selected.hours_spent}h`} />
                <DetailRow label="Log date" value={selected.log_date} />
                <DetailRow label="Completion" value={`${selected.completion_pct ?? 100}%`} />
                <DetailRow label="Mood" value={selected.mood ? `${MOODS[selected.mood - 1]} (${selected.mood}/5)` : '—'} />
                <DetailRow label="Collaborators" value={selected.collaborators || '—'} />
                <DetailRow label="Tags" value={selected.tags?.join(', ') || '—'} />
                <DetailBlock label="Description" value={selected.description} />
                {selected.work_impact && <DetailBlock label="Work Impact" value={selected.work_impact} />}
                {selected.blockers && <DetailBlock label="Blockers" value={selected.blockers} />}
                {selected.next_steps && <DetailBlock label="Next Steps" value={selected.next_steps} />}
                {selected.url && (
                  <DetailRow label="URL" value={
                    <a href={selected.url} target="_blank" rel="noopener noreferrer"
                      className="text-[#A06CFF] underline break-all">{selected.url}</a>
                  } />
                )}
                <p className="text-[11px] text-white/40 pt-4 border-t border-white/10">
                  Created {new Date(selected.created_at).toLocaleString()}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </ModuleLayout>
  );
};

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-2">
    <span className="text-xs uppercase tracking-wider text-white/40">{label}</span>
    <span className="text-sm text-white/90 text-right">{value}</span>
  </div>
);
const DetailBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border-b border-white/5 pb-2">
    <p className="text-xs uppercase tracking-wider text-white/40 mb-1">{label}</p>
    <p className="text-sm text-white/90 whitespace-pre-wrap">{value}</p>
  </div>
);

export default WorkLogs;
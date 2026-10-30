import React, { useEffect, useMemo, useState } from 'react';
import ModuleLayout from '@/components/ModuleLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MousePointerClick, Video, Activity } from 'lucide-react';

interface ClickRow { admin_id: string; event_key: string; label: string | null; created_at: string; route: string | null; meeting_id: string | null; month_key: string; }
interface TimeRow { admin_id: string; route: string; seconds: number; day: string; month_key: string; }

const currentMonthKey = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const fmtMin = (s: number) => {
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const EngagementAnalytics: React.FC = () => {
  const { adminProfile } = useAuth();
  const [month, setMonth] = useState(currentMonthKey());
  const [clicks, setClicks] = useState<ClickRow[]>([]);
  const [times, setTimes] = useState<TimeRow[]>([]);
  const [admins, setAdmins] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (adminProfile?.role !== 'super_admin') return;
    let cancelled = false;
    const load = async () => {
      const [{ data: c }, { data: t }, { data: a }] = await Promise.all([
        supabase.from('admin_click_events').select('*').eq('month_key', month).order('created_at', { ascending: false }).limit(5000),
        supabase.from('admin_section_time').select('*').eq('month_key', month).limit(5000),
        supabase.from('admins').select('id, name').eq('is_active', true),
      ]);
      if (cancelled) return;
      setClicks((c || []) as any);
      setTimes((t || []) as any);
      setAdmins((a || []) as any);
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [month, adminProfile?.role]);

  const nameOf = (id: string) => admins.find(a => a.id === id)?.name || 'Unknown';

  const clicksPerAdmin = useMemo(() => {
    const map = new Map<string, number>();
    clicks.forEach(c => map.set(c.admin_id, (map.get(c.admin_id) || 0) + 1));
    return Array.from(map.entries())
      .map(([id, n]) => ({ admin: nameOf(id), clicks: n }))
      .sort((a, b) => b.clicks - a.clicks);
  }, [clicks, admins]);

  const meetingJoins = useMemo(() => clicks.filter(c => c.event_key === 'meeting_join'), [clicks]);

  const meetingPerAdmin = useMemo(() => {
    const map = new Map<string, number>();
    meetingJoins.forEach(c => map.set(c.admin_id, (map.get(c.admin_id) || 0) + 1));
    return Array.from(map.entries())
      .map(([id, n]) => ({ admin: nameOf(id), joins: n }))
      .sort((a, b) => b.joins - a.joins);
  }, [meetingJoins, admins]);

  // Heatmap: rows=admins, cols=top 8 routes
  const heatmap = useMemo(() => {
    const routeTotals = new Map<string, number>();
    times.forEach(t => routeTotals.set(t.route, (routeTotals.get(t.route) || 0) + t.seconds));
    const topRoutes = Array.from(routeTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(r => r[0]);
    const adminTotals = new Map<string, Map<string, number>>();
    times.forEach(t => {
      if (!topRoutes.includes(t.route)) return;
      const inner = adminTotals.get(t.admin_id) || new Map();
      inner.set(t.route, (inner.get(t.route) || 0) + t.seconds);
      adminTotals.set(t.admin_id, inner);
    });
    const rows = Array.from(adminTotals.entries()).map(([id, m]) => ({
      admin: nameOf(id),
      values: topRoutes.map(r => m.get(r) || 0),
    })).sort((a, b) => b.values.reduce((s, v) => s + v, 0) - a.values.reduce((s, v) => s + v, 0));
    const max = Math.max(1, ...rows.flatMap(r => r.values));
    return { topRoutes, rows, max };
  }, [times, admins]);

  if (adminProfile && adminProfile.role !== 'super_admin') return <Navigate to="/dashboard" replace />;

  return (
    <ModuleLayout title="Engagement & Meeting Analytics" description="Monthly click activity, meeting joins, and time-on-section heatmap.">
      <div className="mb-5 flex items-end gap-3">
        <div>
          <label className="text-xs text-white/60">Month</label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="h-9 bg-[#0a0a14] border-white/10 mt-1" />
        </div>
        <Badge variant="outline" className="border-white/15 text-xs">{clicks.length} clicks · {times.length} time rows</Badge>
      </div>

      <Tabs defaultValue="clicks">
        <TabsList>
          <TabsTrigger value="clicks" className="gap-2"><MousePointerClick className="h-4 w-4" /> Clicks</TabsTrigger>
          <TabsTrigger value="meetings" className="gap-2"><Video className="h-4 w-4" /> Meeting Joins</TabsTrigger>
          <TabsTrigger value="time" className="gap-2"><Activity className="h-4 w-4" /> Time-on-section</TabsTrigger>
        </TabsList>

        <TabsContent value="clicks" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">Clicks per admin · {month}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={clicksPerAdmin}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <XAxis dataKey="admin" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#0a0a14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Bar dataKey="clicks" fill="hsl(218 100% 55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">Recent clicks</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>When</TableHead><TableHead>Admin</TableHead><TableHead>Event</TableHead>
                    <TableHead>Label</TableHead><TableHead>Route</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {clicks.slice(0, 200).map(c => (
                      <TableRow key={c.created_at + c.admin_id + c.event_key}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{nameOf(c.admin_id)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{c.event_key}</Badge></TableCell>
                        <TableCell className="text-xs text-white/70 max-w-[280px] truncate">{c.label}</TableCell>
                        <TableCell className="text-xs text-white/50">{c.route}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">Meeting joins per admin · {month}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={meetingPerAdmin}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <XAxis dataKey="admin" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#0a0a14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Bar dataKey="joins" fill="hsl(38 100% 55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">Meeting join history</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>When</TableHead><TableHead>Admin</TableHead><TableHead>Meeting</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {meetingJoins.map(c => (
                      <TableRow key={c.created_at + c.admin_id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{nameOf(c.admin_id)}</TableCell>
                        <TableCell className="text-xs text-white/60">{c.meeting_id || c.label || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {meetingJoins.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-xs text-white/40 py-6">No meeting joins yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">Time-on-section heatmap · {month}</CardTitle></CardHeader>
            <CardContent>
              {heatmap.rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/50">No time data yet for this month.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-card text-left p-2 text-white/60">Admin</th>
                        {heatmap.topRoutes.map(r => (
                          <th key={r} className="p-2 text-left text-white/60 whitespace-nowrap max-w-[120px] truncate">{r}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.rows.map(row => (
                        <tr key={row.admin}>
                          <td className="sticky left-0 bg-card p-2 font-medium text-white whitespace-nowrap">{row.admin}</td>
                          {row.values.map((v, i) => {
                            const intensity = v / heatmap.max;
                            return (
                              <td key={i} className="p-1">
                                <div
                                  className="rounded p-2 text-center text-[10px] font-mono"
                                  style={{
                                    background: `hsla(218, 100%, 55%, ${0.08 + intensity * 0.7})`,
                                    color: intensity > 0.5 ? '#fff' : 'rgba(255,255,255,0.7)',
                                  }}
                                  title={`${v}s`}
                                >
                                  {v > 0 ? fmtMin(v) : '·'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ModuleLayout>
  );
};

export default EngagementAnalytics;
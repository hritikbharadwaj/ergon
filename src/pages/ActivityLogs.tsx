import React, { useState, useEffect, useCallback } from 'react';
import ModuleLayout from '@/components/ModuleLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Search, RefreshCw, Clock, User, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ActivityLog {
  id: string;
  user_name: string;
  action: string;
  blog_id: string | null;
  timestamp: string;
  created_at: string;
}

const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async (reset = false) => {
    const currentPage = reset ? 0 : page;
    if (reset) setPage(0);
    setLoading(true);

    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (dateFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('timestamp', `${today}T00:00:00`);
    } else if (dateFilter === '7days') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      query = query.gte('timestamp', d.toISOString());
    }

    const { data, error } = await query;
    if (error) console.error('Error fetching logs:', error);
    
    const newLogs = (data || []) as ActivityLog[];
    setLogs(prev => reset ? newLogs : [...prev, ...newLogs]);
    setHasMore(newLogs.length === PAGE_SIZE);
    setLoading(false);
  }, [page, dateFilter]);

  useEffect(() => { fetchLogs(true); }, [dateFilter]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchLogs(true), 10000);
    return () => clearInterval(interval);
  }, [dateFilter]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('activity-logs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setLogs(prev => [payload.new as ActivityLog, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredLogs = logs.filter(log => {
    if (!search) return true;
    const s = search.toLowerCase();
    return log.user_name.toLowerCase().includes(s) || log.action.toLowerCase().includes(s) || (log.blog_id && log.blog_id.toLowerCase().includes(s));
  });

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <ModuleLayout title="Activity Logs" description="Track blog publishing and admin activities in real-time">
      <div className="space-y-4">
        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user or blog title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full sm:w-40 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => fetchLogs(true)} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Recent Activity
              <Badge variant="outline" className="ml-auto text-xs">{filteredLogs.length} logs</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && logs.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Loading activity logs...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No activity yet</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-1">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    >
                      <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-primary/10 text-primary">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-mono">{formatTime(log.timestamp)}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</span>
                        </div>
                        <p className="text-sm">
                          <span className="font-medium text-primary flex items-center gap-1 inline">
                            <User className="w-3 h-3 inline" /> {log.user_name}
                          </span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="text-foreground">{log.action}</span>
                        </p>
                        {log.blog_id && (
                          <span className="text-[10px] text-muted-foreground font-mono">ID: {log.blog_id}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {hasMore && (
                  <div className="pt-3 text-center">
                    <Button variant="outline" size="sm" onClick={() => { setPage(p => p + 1); fetchLogs(); }}>
                      Load More
                    </Button>
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  );
};

export default ActivityLogs;

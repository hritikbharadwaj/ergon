import React, { useEffect, useState } from 'react';
import ModuleLayout from '@/components/ModuleLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Megaphone, Send, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface AdminRow { id: string; name: string; email: string; role: string; }

const NoticeBroadcast: React.FC = () => {
  const { adminProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState(true);
  const [subject, setSubject] = useState('Important Notice from Ergon Admin');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);

  useEffect(() => {
    if (adminProfile?.role !== 'super_admin') { navigate('/dashboard'); return; }
    (async () => {
      const { data } = await supabase.from('admins')
        .select('id, name, email, role').eq('is_active', true).order('name');
      setAdmins((data as any) || []);
      const map: Record<string, boolean> = {};
      (data || []).forEach((a: any) => { map[a.id] = true; });
      setSelected(map);
    })();
  }, [adminProfile, navigate]);

  const toggleAll = (v: boolean) => {
    setSelectAll(v);
    const map: Record<string, boolean> = {};
    admins.forEach((a) => { map[a.id] = v; });
    setSelected(map);
  };

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({ title: 'Missing fields', description: 'Subject and body are required.', variant: 'destructive' });
      return;
    }
    const recipients = admins.filter((a) => selected[a.id]);
    if (recipients.length === 0) {
      toast({ title: 'No recipients', variant: 'destructive' });
      return;
    }
    setSending(true);
    setProgress({ sent: 0, failed: 0, total: recipients.length });
    const html = `<p style="margin:0 0 14px 0;">This is an official notice from the Ergon Admin team.</p><div style="white-space:pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</div>`;
    let ok = 0, fail = 0;
    for (const r of recipients) {
      try {
        const { error } = await supabase.functions.invoke('send-branded-email', {
          body: {
            recipientEmail: r.email,
            recipientName: r.name,
            recipientAdminId: r.id,
            subject,
            heading: 'NOTICE',
            message: html,
            kind: 'notice',
          },
        });
        if (error) fail++; else ok++;
      } catch { fail++; }
      setProgress({ sent: ok, failed: fail, total: recipients.length });
    }
    setSending(false);
    toast({ title: 'Notice broadcast complete', description: `Sent ${ok} · Failed ${fail}` });
  };

  return (
    <ModuleLayout title="Notice Broadcast" description="Send an official NOTICE email to selected admins in one click.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card><CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold"><Megaphone className="h-5 w-5 text-primary" /> Notice Details</div>
            <div><Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Notice subject" />
            </div>
            <div><Label>Body</Label>
              <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="Write the notice content. Line breaks are preserved." />
            </div>
            <Button onClick={send} disabled={sending} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              {sending ? `Sending… (${progress?.sent || 0}/${progress?.total || 0})` : `Send Notice to ${admins.filter((a) => selected[a.id]).length} admin(s)`}
            </Button>
            {progress && !sending && (
              <div className="text-sm text-muted-foreground">
                Delivered: <Badge className="bg-green-500/20 text-green-400">{progress.sent}</Badge> · Failed: <Badge className="bg-red-500/20 text-red-400">{progress.failed}</Badge>
              </div>
            )}
          </CardContent></Card>
        </div>
        <div className="space-y-3">
          <Card><CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary" /> Recipients</div>
              <div className="flex items-center gap-2 text-xs">
                <Checkbox checked={selectAll} onCheckedChange={(v) => toggleAll(!!v)} /> All
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
              {admins.map((a) => (
                <label key={a.id} className="flex items-center gap-3 p-2 rounded-md border border-border/40 hover:bg-muted/30 cursor-pointer">
                  <Checkbox checked={!!selected[a.id]}
                    onCheckedChange={(v) => setSelected((s) => ({ ...s, [a.id]: !!v }))} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.email} · {a.role}</div>
                  </div>
                </label>
              ))}
            </div>
          </CardContent></Card>
        </div>
      </div>
    </ModuleLayout>
  );
};

export default NoticeBroadcast;
import React, { useEffect, useMemo, useState } from 'react';
import ModuleLayout from '@/components/ModuleLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Mail, Send, Eye, Sparkles, Paperclip, X, Loader2 } from 'lucide-react';

interface AdminRow { id: string; name: string; email: string; otp_email: string | null; role: string; avatar: string | null }

const TEMPLATES: Record<string, { subject: string; heading: string; body: string }> = {
  blank:    { subject: '', heading: '', body: '' },
  task:     { subject: '📌 New task assigned', heading: 'You have a new task',
              body: 'You have been assigned a new task. Please review the details and start the work as per the timeline.' },
  praise:   { subject: '🎉 Great work!', heading: 'Awesome work this week',
              body: 'Just a quick note to appreciate your contribution. Keep it up — the team noticed!' },
  reminder: { subject: '⏰ Friendly reminder', heading: 'A quick reminder',
              body: 'This is a friendly reminder regarding your pending action items. Please address them at the earliest.' },
  meeting:  { subject: '📅 Meeting scheduled', heading: 'You are invited',
              body: 'A meeting has been scheduled. Please make sure you are available at the scheduled time.' },
};

const EmailComposer: React.FC = () => {
  const { adminProfile } = useAuth();
  const { toast } = useToast();
  const isSuper = adminProfile?.role === 'super_admin';

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [templateKey, setTemplateKey] = useState<keyof typeof TEMPLATES>('blank');
  const [subject, setSubject] = useState('');
  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; url: string; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('admins').select('id, name, email, otp_email, role, avatar')
      .eq('is_active', true).order('name').then(({ data }) => setAdmins((data || []) as any));
  }, []);

  const recipient = useMemo(() => admins.find(a => a.id === recipientId), [admins, recipientId]);
  const recipientEmail = recipient?.otp_email || recipient?.email || '';

  const applyTemplate = (k: keyof typeof TEMPLATES) => {
    setTemplateKey(k);
    const t = TEMPLATES[k];
    if (k !== 'blank') { setSubject(t.subject); setHeading(t.heading); setBody(t.body); }
  };

  const send = async () => {
    if (!recipientId || !subject.trim() || !body.trim()) {
      toast({ title: 'Missing fields', description: 'Pick a recipient and fill subject + body.', variant: 'destructive' });
      return;
    }
    setSending(true);
    const escaped = body.split('\n').map(l => `<p style="margin:6px 0;">${l.replace(/</g,'&lt;')}</p>`).join('');
    const { data, error } = await supabase.functions.invoke('send-branded-email', {
      body: {
        recipientEmail,
        recipientName: recipient?.name,
        recipientAdminId: recipient?.id,
        kind: 'composer',
        subject: subject.trim(),
        heading: heading.trim() || subject.trim(),
        message: escaped,
        attachments: attachments.map(a => ({ name: a.name, url: a.url })),
      },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Send failed', description: (data as any)?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Email sent', description: `Delivered to ${recipientEmail} from admin@Ergon.in` });
    setSubject(''); setHeading(''); setBody(''); setRecipientId(''); setTemplateKey('blank'); setAttachments([]);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const uploaded: { name: string; url: string; size: number }[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 15 * 1024 * 1024) {
        toast({ title: 'File too large', description: `${file.name} exceeds 15MB`, variant: 'destructive' });
        continue;
      }
      const path = `email-attachments/${adminProfile?.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type,
      });
      if (upErr) {
        toast({ title: 'Upload failed', description: `${file.name}: ${upErr.message}`, variant: 'destructive' });
        continue;
      }
      const { data: pub } = supabase.storage.from('uploads').getPublicUrl(path);
      uploaded.push({ name: file.name, url: pub.publicUrl, size: file.size });
    }
    setAttachments(prev => [...prev, ...uploaded]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!adminProfile) return null;
  if (!isSuper) return <Navigate to="/dashboard" replace />;

  const previewHtml = body.split('\n').map(l => `<p style="margin:6px 0;">${l.replace(/</g,'&lt;')}</p>`).join('');

  return (
    <ModuleLayout
      title="Branded Email Composer"
      description="Send a beautifully designed email from admin@Ergon.in to any teammate."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Compose</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Recipient</Label>
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger className="bg-[#0a0a14] border-white/10"><SelectValue placeholder="Pick a teammate" /></SelectTrigger>
                <SelectContent>{admins.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name} · {a.role.replace('_',' ')}</SelectItem>
                ))}</SelectContent>
              </Select>
              {recipientEmail && <p className="mt-1 text-[11px] text-white/40">Will deliver to: {recipientEmail}</p>}
            </div>
            <div>
              <Label className="text-xs">Template</Label>
              <Select value={templateKey} onValueChange={(v: any) => applyTemplate(v)}>
                <SelectTrigger className="bg-[#0a0a14] border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Blank</SelectItem>
                  <SelectItem value="task">📌 Task assignment</SelectItem>
                  <SelectItem value="praise">🎉 Praise</SelectItem>
                  <SelectItem value="reminder">⏰ Reminder</SelectItem>
                  <SelectItem value="meeting">📅 Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="bg-[#0a0a14] border-white/10" placeholder="Email subject" />
            </div>
            <div>
              <Label className="text-xs">Heading (shown big in email)</Label>
              <Input value={heading} onChange={e => setHeading(e.target.value)} className="bg-[#0a0a14] border-white/10" placeholder="Defaults to subject" />
            </div>
            <div>
              <Label className="text-xs">Message body</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} className="bg-[#0a0a14] border-white/10 min-h-[180px]" placeholder="Write your message…" />
              <p className="mt-1 text-[11px] text-white/40">Line breaks become paragraphs. HTML is escaped.</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" className="border-white/10 gap-1.5" onClick={() => setPreview(p => !p)} data-track="email_preview_toggle">
                <Eye className="h-4 w-4" /> {preview ? 'Hide preview' : 'Show preview'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => handleUpload(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                className="border-white/10 gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                data-track="email_attach"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                {uploading ? 'Uploading…' : 'Attach files'}
              </Button>
              <Button onClick={send} disabled={sending} className="gap-2 bg-gradient-to-r from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4] text-white" data-track="email_send">
                <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send email'}
              </Button>
              <Badge variant="outline" className="border-white/15 text-white/60 ml-auto">From admin@Ergon.in</Badge>
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((a, i) => (
                  <div key={a.url} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0a0a14] px-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="h-3.5 w-3.5 text-white/50 shrink-0" />
                      <span className="text-xs text-white/80 truncate">{a.name}</span>
                      <span className="text-[10px] text-white/40 shrink-0">{(a.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-white/40 hover:text-white/80"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border border-white/10 overflow-hidden bg-white">
              <div className="bg-[#f3f4f6] p-4 text-center">
                <p className="text-xs text-gray-500">From <b>Ergon Admin</b> &lt;admin@Ergon.in&gt;</p>
                <p className="text-xs text-gray-500">To {recipient?.name || '—'} &lt;{recipientEmail || '—'}&gt;</p>
              </div>
              <div className="p-5 text-center">
                {recipient?.avatar && <img src={recipient.avatar} alt="" className="mx-auto mb-3 h-16 w-16 rounded-full border-2 border-gray-200 object-cover" />}
                <h2 className="text-xl font-extrabold text-gray-900">{heading || subject || 'Email heading'}</h2>
                <p className="mt-2 text-sm text-gray-600">Hello {recipient?.name || 'there'},</p>
                <div className="mt-3 text-left text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: previewHtml || '<p style="margin:6px 0;color:#999;">Message body will appear here…</p>' }} />
              </div>
              <div className="bg-black p-3 text-[11px] text-white text-center">&copy; {new Date().getFullYear()} Ergon</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  );
};

export default EmailComposer;
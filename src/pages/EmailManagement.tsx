import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, Send, Plus, Search, Filter, Loader2, Shield, BarChart3, Eye, Trash2, Paperclip, X } from 'lucide-react';

const EmailManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user, adminProfile } = useAuth();
  const isSuperAdmin = adminProfile?.role === 'super_admin';

  const [identity, setIdentity] = useState<any>(null);
  const [allIdentities, setAllIdentities] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Send form
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [attachFiles, setAttachFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Assign form
  const [assignAdminId, setAssignAdminId] = useState('');
  const [assignName, setAssignName] = useState('');

  // Filters
  const [filterAdmin, setFilterAdmin] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [adminProfile]);

  const fetchData = async () => {
    if (!adminProfile) return;
    try {
      // Fetch own identity
      const { data: id } = await supabase
        .from('admin_email_identities')
        .select('*')
        .eq('admin_id', adminProfile.id)
        .eq('is_active', true)
        .maybeSingle();
      setIdentity(id);

      if (isSuperAdmin) {
        const { data: ids, error: idsErr } = await supabase
          .from('admin_email_identities')
          .select('*, admins!admin_id(name, email, role)')
          .order('created_at', { ascending: false });
        if (idsErr) console.error('identities fetch failed', idsErr);
        setAllIdentities(ids || []);
        const { data: logs } = await supabase.from('admin_email_logs').select('*, admins(name, email)').order('created_at', { ascending: false }).limit(100);
        setEmailLogs(logs || []);
        const { data: a } = await supabase.from('admins').select('id, name, email, role').eq('is_active', true);
        setAdmins(a || []);
      } else {
        const { data: logs } = await supabase.from('admin_email_logs').select('*').eq('admin_id', adminProfile.id).order('created_at', { ascending: false }).limit(50);
        setEmailLogs(logs || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSendEmail = async () => {
    if (!recipientEmail || !subject || !content) {
      toast({ title: 'Missing fields', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      // Upload any attachments to the public "uploads" bucket first.
      const attachments: { name: string; url: string }[] = [];
      if (attachFiles.length) {
        setUploading(true);
        for (const f of attachFiles) {
          if (f.size > 15 * 1024 * 1024) {
            toast({ title: `Skipping ${f.name}`, description: 'Max 15 MB per file.', variant: 'destructive' });
            continue;
          }
          const path = `email-attachments/${adminProfile?.id}/${Date.now()}-${f.name}`;
          const { error: upErr } = await supabase.storage.from('uploads').upload(path, f, { upsert: false });
          if (upErr) { console.error(upErr); continue; }
          const { data: pub } = supabase.storage.from('uploads').getPublicUrl(path);
          attachments.push({ name: f.name, url: pub.publicUrl });
        }
        setUploading(false);
      }
      const { data, error } = await supabase.functions.invoke('send-admin-email', {
        body: {
          recipientEmail,
          subject,
          content,
          heading: subject,
          branded: true,
          attachments,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Failed', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: 'Email Sent!', description: `${data.remaining ?? ''} emails remaining today`.trim() });
        setRecipientEmail('');
        setSubject('');
        setContent('');
        setAttachFiles([]);
        fetchData();
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSending(false);
  };

  const handleAssignIdentity = async () => {
    if (!assignAdminId || !assignName) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    const senderEmail = `${assignName.toLowerCase().replace(/\s+/g, '')}@admin.Ergon.in`;
    const { error } = await supabase.from('admin_email_identities').upsert({
      admin_id: assignAdminId,
      sender_name: assignName,
      sender_email: senderEmail,
      is_active: true,
      created_by: adminProfile?.id,
    }, { onConflict: 'admin_id' });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Identity Assigned', description: `${senderEmail} assigned successfully` });
      setShowAssignDialog(false);
      setAssignAdminId('');
      setAssignName('');
      fetchData();
    }
  };

  const handleDeleteIdentity = async (id: string) => {
    await supabase.from('admin_email_identities').delete().eq('id', id);
    toast({ title: 'Identity Removed' });
    fetchData();
  };

  const filteredLogs = emailLogs.filter(log => {
    if (filterAdmin !== 'all' && log.admin_id !== filterAdmin) return false;
    if (filterDate && !log.created_at.startsWith(filterDate)) return false;
    if (searchTerm && !log.recipient_email.includes(searchTerm) && !log.subject.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const todayCount = identity?.last_sent_date === new Date().toISOString().split('T')[0] ? identity?.emails_sent_today : 0;
  const dailyLimit = identity?.daily_limit || 15;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" /> Email Management
            </h1>
            <p className="text-muted-foreground text-sm">Send professional emails via @admin.Ergon.in</p>
          </div>
        </div>

        {/* Usage Stats Card */}
        {identity && (
          <Card className="mb-6 border-primary/20 bg-card">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm text-muted-foreground">Your Email Identity</p>
                  <p className="text-lg font-bold text-primary">{identity.sender_email}</p>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <p className="text-sm text-muted-foreground">Today's Usage</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(todayCount / dailyLimit) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold">{todayCount}/{dailyLimit}</span>
                  </div>
                </div>
                <div>
                  <Badge variant={todayCount >= dailyLimit ? 'destructive' : 'default'}>
                    {todayCount >= dailyLimit ? 'Limit Reached' : `${dailyLimit - todayCount} remaining`}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No identity message */}
        {!identity && !isSuperAdmin && (
          <Card className="mb-6">
            <CardContent className="pt-6 text-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Email Identity Assigned</h3>
              <p className="text-muted-foreground">Contact your Super Admin to get an email identity assigned.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Email Form */}
          {identity && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> Send Email</CardTitle>
                <CardDescription>Compose and send from {identity.sender_email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>From</Label>
                  <Input value={identity.sender_email} disabled className="bg-muted/50 font-mono" />
                </div>
                <div>
                  <Label>To *</Label>
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Subject *</Label>
                  <Input
                    placeholder="Email subject..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Message *</Label>
                  <Textarea
                    placeholder="Write your email content here... (HTML supported)"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[150px]"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Attachments</Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(e) => setAttachFiles(Array.from(e.target.files || []))}
                    className="cursor-pointer"
                  />
                  {attachFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between rounded border border-border bg-muted/30 px-2 py-1 text-xs">
                          <span className="truncate">{f.name} <span className="text-muted-foreground">({(f.size/1024).toFixed(0)} KB)</span></span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachFiles(attachFiles.filter((_, idx) => idx !== i))}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">Uploads to secure storage. Max 15 MB per file. Recipients get links inside the email.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSendEmail}
                    disabled={sending || uploading || todayCount >= dailyLimit}
                    className="flex-1"
                  >
                    {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    {uploading ? 'Uploading...' : sending ? 'Sending...' : 'Send Email'}
                  </Button>
                  <Dialog open={showPreview} onOpenChange={setShowPreview}>
                    <DialogTrigger asChild>
                      <Button variant="outline" disabled={!content}>
                        <Eye className="h-4 w-4 mr-2" /> Preview
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Email Preview</DialogTitle>
                      </DialogHeader>
                      <div className="border rounded-lg p-4 bg-white text-black">
                        <p className="text-sm text-gray-500 mb-1">From: {identity?.sender_email}</p>
                        <p className="text-sm text-gray-500 mb-1">To: {recipientEmail || '—'}</p>
                        <p className="font-semibold mb-3">{subject || '(No subject)'}</p>
                        <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: content || '<em>No content</em>' }} />
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}

          {/* My Email History */}
          {identity && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> My Sent Emails</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {emailLogs.filter(l => !isSuperAdmin || l.admin_id === adminProfile?.id).slice(0, 20).map(log => (
                    <div key={log.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{log.subject}</span>
                        <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className="text-xs">
                          {log.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">To: {log.recipient_email}</p>
                      <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                  {emailLogs.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No emails sent yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Super Admin Section */}
        {isSuperAdmin && (
          <>
            {/* Assign Identities */}
            <Card className="mt-6 border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Email Identity Management</CardTitle>
                  <CardDescription>Assign @admin.Ergon.in emails to admins</CardDescription>
                </div>
                <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" /> Assign Identity</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Email Identity</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Select Admin</Label>
                        <Select value={assignAdminId} onValueChange={setAssignAdminId}>
                          <SelectTrigger><SelectValue placeholder="Choose admin..." /></SelectTrigger>
                          <SelectContent>
                            {admins.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.name} ({a.role})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Sender Name (before @admin.Ergon.in)</Label>
                        <Input
                          placeholder="e.g. utsav, hr, support"
                          value={assignName}
                          onChange={(e) => setAssignName(e.target.value)}
                        />
                        {assignName && (
                          <p className="text-xs text-primary mt-1">
                            Email: {assignName.toLowerCase().replace(/\s+/g, '')}@admin.Ergon.in
                          </p>
                        )}
                      </div>
                      <Button onClick={handleAssignIdentity} className="w-full">Assign Identity</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admin</TableHead>
                      <TableHead>Sender Email</TableHead>
                      <TableHead>Today</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allIdentities.map(id => (
                      <TableRow key={id.id}>
                        <TableCell>{(id.admins as any)?.name || '—'}</TableCell>
                        <TableCell className="font-mono text-primary">{id.sender_email}</TableCell>
                        <TableCell>{id.emails_sent_today}/{id.daily_limit}</TableCell>
                        <TableCell><Badge variant={id.is_active ? 'default' : 'secondary'}>{id.is_active ? 'Active' : 'Disabled'}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteIdentity(id.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {allIdentities.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No identities assigned</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* All Email Logs */}
            <Card className="mt-6 border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> All Email Logs</CardTitle>
                <div className="flex flex-wrap gap-3 mt-3">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search emails..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <Select value={filterAdmin} onValueChange={setFilterAdmin}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Filter by admin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Admins</SelectItem>
                      {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-48"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Admin</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.slice(0, 50).map(log => (
                        <TableRow key={log.id}>
                          <TableCell>{(log.admins as any)?.name || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{log.sender_email}</TableCell>
                          <TableCell className="text-xs">{log.recipient_email}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{log.subject}</TableCell>
                          <TableCell>
                            <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {filteredLogs.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No logs found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailManagement;

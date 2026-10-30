import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, BookOpen, Plus, Calendar, Loader2, Trash2 } from 'lucide-react';

const MeetingNotes: React.FC = () => {
  const navigate = useNavigate();
  const { adminProfile } = useAuth();
  const isSuperAdmin = adminProfile?.role === 'super_admin';
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    const { data } = await supabase.from('meeting_notes').select('*, admins:created_by(name)').order('meeting_date', { ascending: false });
    setNotes(data || []);
    setLoading(false);
  };

  const addNote = async () => {
    if (!title || !content) { toast({ title: 'Fill all fields', variant: 'destructive' }); return; }
    const { error } = await supabase.from('meeting_notes').insert({ title, content, meeting_date: meetingDate, created_by: adminProfile!.id });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Meeting note added!' });
    setTitle(''); setContent(''); setShowForm(false);
    fetchNotes();
  };

  const deleteNote = async (id: string) => {
    await supabase.from('meeting_notes').delete().eq('id', id);
    fetchNotes();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
           <Button
                     variant="outline"
                     onClick={() => navigate('/dashboard')}
                     className="mb-6 bg-black/40 border-white/10 text-white hover:bg-white/10"
                   >
                     <ArrowLeft className="w-4 h-4 mr-2" />
                     Back to Dashboard
                   </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /> Meeting Notes</h1>
              <p className="text-muted-foreground text-sm">Record and share meeting minutes</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" /> New Note
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Meeting title..." /></div>
                <div><Label>Date</Label><Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Meeting minutes..." className="min-h-[120px]" /></div>
              <Button onClick={addNote}>Save Note</Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {notes.map(note => (
              <Card key={note.id} className="hover:border-primary/20 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{note.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" /> {new Date(note.meeting_date).toLocaleDateString()}
                      </Badge>
                      {isSuperAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteNote(note.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardDescription>By {(note.admins as any)?.name || 'Unknown'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                </CardContent>
              </Card>
            ))}
            {notes.length === 0 && <div className="text-center py-12 text-muted-foreground">No meeting notes yet</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingNotes;

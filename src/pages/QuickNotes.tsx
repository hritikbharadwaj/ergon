import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, StickyNote, Plus, Pin, Trash2, Loader2 } from 'lucide-react';

const colorOptions = [
  { value: 'yellow', bg: 'bg-yellow-500/20 border-yellow-500/30', text: 'text-yellow-200' },
  { value: 'blue', bg: 'bg-blue-500/20 border-blue-500/30', text: 'text-blue-200' },
  { value: 'green', bg: 'bg-green-500/20 border-green-500/30', text: 'text-green-200' },
  { value: 'pink', bg: 'bg-pink-500/20 border-pink-500/30', text: 'text-pink-200' },
  { value: 'purple', bg: 'bg-purple-500/20 border-purple-500/30', text: 'text-purple-200' },
];

const QuickNotes: React.FC = () => {
  const navigate = useNavigate();
  const { adminProfile } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newColor, setNewColor] = useState('yellow');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminProfile) fetchNotes();
  }, [adminProfile]);

  const fetchNotes = async () => {
    const { data } = await supabase.from('quick_notes').select('*').eq('admin_id', adminProfile!.id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    setNotes(data || []);
    setLoading(false);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await supabase.from('quick_notes').insert({ admin_id: adminProfile!.id, content: newNote, color: newColor });
    setNewNote('');
    fetchNotes();
    toast({ title: 'Note added!' });
  };

  const togglePin = async (id: string, current: boolean) => {
    await supabase.from('quick_notes').update({ is_pinned: !current }).eq('id', id);
    fetchNotes();
  };

  const deleteNote = async (id: string) => {
    await supabase.from('quick_notes').delete().eq('id', id);
    fetchNotes();
  };

  const getColorClass = (color: string) => colorOptions.find(c => c.value === color) || colorOptions[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-6">
          <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    className="mb-6 bg-black/40 border-white/10 text-white hover:bg-white/10"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><StickyNote className="h-6 w-6 text-yellow-400" /> Quick Notes</h1>
            <p className="text-muted-foreground text-sm">Your personal sticky notes — pin important ones</p>
          </div>
        </div>

        {/* Add Note */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Textarea placeholder="Write a quick note..." value={newNote} onChange={e => setNewNote(e.target.value)} className="mb-3" />
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {colorOptions.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setNewColor(c.value)}
                    className={`w-6 h-6 rounded-full border-2 ${c.bg} ${newColor === c.value ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                  />
                ))}
              </div>
              <Button onClick={addNote} disabled={!newNote.trim()} className="ml-auto">
                <Plus className="h-4 w-4 mr-2" /> Add Note
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notes Grid */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.map(note => {
              const color = getColorClass(note.color);
              return (
                <Card key={note.id} className={`${color.bg} border transition-all hover:scale-[1.02]`}>
                  <CardContent className="pt-4">
                    <p className={`${color.text} whitespace-pre-wrap mb-3 text-sm`}>{note.content}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePin(note.id, note.is_pinned)}>
                          <Pin className={`h-3.5 w-3.5 ${note.is_pinned ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteNote(note.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {notes.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No notes yet. Add your first one above!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickNotes;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Link2, Plus, ExternalLink, Trash2, Loader2 } from 'lucide-react';

const linkCategories = ['general', 'tools', 'docs', 'social', 'hr', 'finance'];

const CompanyLinks: React.FC = () => {
  const navigate = useNavigate();
  const { adminProfile } = useAuth();
  const isSuperAdmin = adminProfile?.role === 'super_admin';
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('general');

  useEffect(() => { fetchLinks(); }, []);

  const fetchLinks = async () => {
    const { data } = await supabase.from('company_links').select('*').order('category').order('title');
    setLinks(data || []);
    setLoading(false);
  };

  const addLink = async () => {
    if (!title || !url) { toast({ title: 'Fill required fields', variant: 'destructive' }); return; }
    await supabase.from('company_links').insert({ title, url, category, created_by: adminProfile!.id });
    toast({ title: 'Link added!' });
    setTitle(''); setUrl(''); setShowForm(false);
    fetchLinks();
  };

  const deleteLink = async (id: string) => {
    await supabase.from('company_links').delete().eq('id', id);
    fetchLinks();
  };

  const grouped = links.reduce((acc, link) => {
    (acc[link.category] = acc[link.category] || []).push(link);
    return acc;
  }, {} as Record<string, any[]>);

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
              <h1 className="text-2xl font-bold flex items-center gap-2"><Link2 className="h-6 w-6 text-primary" /> Company Links</h1>
              <p className="text-muted-foreground text-sm">Quick access to important resources</p>
            </div>
          </div>
          {isSuperAdmin && <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" /> Add Link</Button>}
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Link title" /></div>
                <div><Label>URL</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." /></div>
                <div><Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{linkCategories.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={addLink}>Add Link</Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(items as any[]).map(link => (
                    <Card key={link.id} className="hover:border-primary/30 transition-all group cursor-pointer" onClick={() => window.open(link.url, '_blank')}>
                      <CardContent className="pt-4 flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate group-hover:text-primary transition-colors">{link.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                          {isSuperAdmin && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteLink(link.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
            {links.length === 0 && <div className="text-center py-12 text-muted-foreground">No links added yet</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyLinks;

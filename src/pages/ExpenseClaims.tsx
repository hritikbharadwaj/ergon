import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Receipt, Plus, Loader2, CheckCircle, XCircle } from 'lucide-react';

const categories = ['travel', 'food', 'supplies', 'software', 'hardware', 'training', 'other'];

const ExpenseClaims: React.FC = () => {
  const navigate = useNavigate();
  const { adminProfile } = useAuth();
  const isSuperAdmin = adminProfile?.role === 'super_admin';
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');

  useEffect(() => { fetchClaims(); }, [adminProfile]);

  const fetchClaims = async () => {
    if (!adminProfile) return;
    let query = supabase.from('expense_claims').select('*, admins:admin_id(name)').order('created_at', { ascending: false });
    if (!isSuperAdmin) query = query.eq('admin_id', adminProfile.id);
    const { data } = await query;
    setClaims(data || []);
    setLoading(false);
  };

  const submitClaim = async () => {
    if (!title || !amount) { toast({ title: 'Fill required fields', variant: 'destructive' }); return; }
    const { error } = await supabase.from('expense_claims').insert({
      admin_id: adminProfile!.id, title, amount: parseFloat(amount), category, description,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Claim submitted!' });
    setTitle(''); setAmount(''); setDescription(''); setShowForm(false);
    fetchClaims();
  };

  const reviewClaim = async (id: string, status: string) => {
    await supabase.from('expense_claims').update({ status, reviewed_by: adminProfile!.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    toast({ title: `Claim ${status}` });
    fetchClaims();
  };

  const statusColor = (s: string) => s === 'approved' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-6xl">
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
              <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6 text-primary" /> Expense Claims</h1>
              <p className="text-muted-foreground text-sm">Submit and track expense reimbursements</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" /> New Claim</Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Expense title" /></div>
                <div><Label>Amount (₹) *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
                <div><Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Details..." /></div>
              <Button onClick={submitClaim}>Submit Claim</Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSuperAdmin && <TableHead>Admin</TableHead>}
                    <TableHead>Title</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    {isSuperAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map(c => (
                    <TableRow key={c.id}>
                      {isSuperAdmin && <TableCell>{(c.admins as any)?.name || '—'}</TableCell>}
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell>₹{c.amount.toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{c.category}</Badge></TableCell>
                      <TableCell><Badge variant={statusColor(c.status)}>{c.status}</Badge></TableCell>
                      <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      {isSuperAdmin && c.status === 'pending' && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reviewClaim(c.id, 'approved')}>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reviewClaim(c.id, 'rejected')}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                      {isSuperAdmin && c.status !== 'pending' && <TableCell>—</TableCell>}
                    </TableRow>
                  ))}
                  {claims.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No claims yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ExpenseClaims;

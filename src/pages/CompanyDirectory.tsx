import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Search, Mail, Phone, Building2, Loader2 } from 'lucide-react';

const CompanyDirectory: React.FC = () => {
  const navigate = useNavigate();
  const { adminProfile } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'admins' | 'employees'>('admins');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: a }, { data: e }] = await Promise.all([
      supabase.from('admins').select('id, name, email, role, is_active, avatar').eq('is_active', true).order('name'),
      supabase.from('employees').select('id, full_name, email, phone, department, designation, status, profile_image_url').eq('status', 'active').order('full_name'),
    ]);
    setAdmins(a || []);
    setEmployees(e || []);
    setLoading(false);
  };

  const filteredAdmins = admins.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase()));
  const filteredEmployees = employees.filter(e => e.full_name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-6xl">
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
            <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /> Company Directory</h1>
            <p className="text-muted-foreground text-sm">Find and connect with team members</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2">
            <Button variant={tab === 'admins' ? 'default' : 'outline'} onClick={() => setTab('admins')}>Admins ({admins.length})</Button>
            <Button variant={tab === 'employees' ? 'default' : 'outline'} onClick={() => setTab('employees')}>Employees ({employees.length})</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tab === 'admins' && filteredAdmins.map(admin => (
              <Card key={admin.id} className="hover:border-primary/30 transition-all">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg border border-primary/30">
                      {admin.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{admin.name}</h3>
                      <Badge variant="secondary" className="text-xs">{admin.role?.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {admin.email}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {tab === 'employees' && filteredEmployees.map(emp => (
              <Card key={emp.id} className="hover:border-primary/30 transition-all">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg border border-accent/30">
                      {emp.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{emp.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{emp.designation}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {emp.email}</p>
                    <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> {emp.department}</p>
                    {emp.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {emp.phone}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyDirectory;

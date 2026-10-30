import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MODULE_PERMISSIONS, roleHasDefaultModule } from '@/lib/modulePermissions';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  admin: { id: string; name: string; role: string } | null;
};

const ModulePermissionsDialog: React.FC<Props> = ({ open, onOpenChange, admin }) => {
  const { adminProfile } = useAuth();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !admin) return;
    setLoading(true);
    supabase
      .from('admin_module_permissions' as any)
      .select('module_key, is_enabled')
      .eq('admin_id', admin.id)
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        MODULE_PERMISSIONS.forEach((m) => { map[m.key] = roleHasDefaultModule(admin.role, m.key); });
        (data || []).forEach((row: any) => { map[row.module_key] = row.is_enabled; });
        setEnabled(map);
        setLoading(false);
      });
  }, [open, admin]);

  const save = async () => {
    if (!admin) return;
    setSaving(true);
    const rows = MODULE_PERMISSIONS.map((m) => ({
      admin_id: admin.id,
      module_key: m.key,
      is_enabled: !!enabled[m.key],
      granted_by: adminProfile?.id,
    }));
    const { error } = await supabase.from('admin_module_permissions' as any).upsert(rows, { onConflict: 'admin_id,module_key' });
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Permissions updated', description: `${admin.name} module authorities saved.` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-blue-400" /> Module Authorities — {admin?.name}</DialogTitle>
          <DialogDescription>Enable or remove individual module access for this admin. Super Admin always has full access.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODULE_PERMISSIONS.map((m) => (
              <div key={m.key} className="flex items-start justify-between rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="pr-3">
                  <p className="text-sm font-medium text-white">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
                <Switch
                  checked={!!enabled[m.key]}
                  onCheckedChange={(v) => setEnabled((s) => ({ ...s, [m.key]: v }))}
                  disabled={admin?.role === 'super_admin'}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading} className="gradient-primary">{saving ? 'Saving…' : 'Save Authorities'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModulePermissionsDialog;
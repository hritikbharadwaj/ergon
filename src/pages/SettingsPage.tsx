import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Volume2, Bell, Vibrate, Loader2, Save, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const defaultAttendanceSettings = {
  check_in_start: '06:00', present_until: '11:00', late_until: '17:00', attendance_close: '23:59',
  checkout_start: '21:30', checkout_end: '23:59', worklog_start: '21:30', worklog_end: '23:59',
  weekends_are_holidays: true,
};

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { adminProfile } = useAuth();
  const { settings, isLoading, updateSettings, triggerHaptic } = useSoundSettings();
  const isSuperAdmin = adminProfile?.role === 'super_admin';
  const [attendanceSettings, setAttendanceSettings] = useState<any>(defaultAttendanceSettings);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [savingSystem, setSavingSystem] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from('attendance_settings' as any).select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setSettingsId((data as any).id);
        setAttendanceSettings({ ...defaultAttendanceSettings, ...(data as any) });
      }
    });
  }, [isSuperAdmin]);

  const handleToggle = async (key: keyof typeof settings, value: boolean) => {
    await updateSettings({ [key]: value });
    
    // Provide feedback
    if (key === 'hapticEnabled' && value) {
      triggerHaptic();
    }
    
    toast({
      title: 'Settings updated',
      description: `${key.replace(/([A-Z])/g, ' $1').replace('Enabled', '')} ${value ? 'enabled' : 'disabled'}`
    });
  };

  const saveSystemSettings = async () => {
    if (!isSuperAdmin) return;
    setSavingSystem(true);
    const payload = { ...attendanceSettings, updated_by: adminProfile?.id };
    const { error, data } = settingsId
      ? await supabase.from('attendance_settings' as any).update(payload).eq('id', settingsId).select('id').single()
      : await supabase.from('attendance_settings' as any).insert(payload).select('id').single();
    setSavingSystem(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    if ((data as any)?.id) setSettingsId((data as any).id);
    toast({ title: 'System settings saved', description: 'Attendance, checkout and work-log rules are now active.' });
  };

  const updateSystemField = (key: string, value: any) => setAttendanceSettings((s: any) => ({ ...s, [key]: value }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Button */}
        <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="mb-6 bg-black/40 border-white/10 text-white hover:bg-white/10"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400 mb-8">Customize your app experience</p>

          {/* Sound & Haptics */}
          <Card className="bg-gray-900/50 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-lg">Sound & Haptics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Button Click Sound */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <Label className="text-white font-medium">Button Click Sounds</Label>
                    <p className="text-sm text-gray-400">Play sound when tapping buttons</p>
                  </div>
                </div>
                <Switch
                  checked={settings.soundEnabled}
                  onCheckedChange={(checked) => handleToggle('soundEnabled', checked)}
                />
              </div>

              {/* Notification Sound */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <Label className="text-white font-medium">Notification Sounds</Label>
                    <p className="text-sm text-gray-400">Play sound for notifications</p>
                  </div>
                </div>
                <Switch
                  checked={settings.notificationSoundEnabled}
                  onCheckedChange={(checked) => handleToggle('notificationSoundEnabled', checked)}
                />
              </div>

              {/* Haptic Feedback */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Vibrate className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <Label className="text-white font-medium">Haptic Feedback</Label>
                    <p className="text-sm text-gray-400">Vibrate on button taps (mobile only)</p>
                  </div>
                </div>
                <Switch
                  checked={settings.hapticEnabled}
                  onCheckedChange={(checked) => handleToggle('hapticEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {isSuperAdmin && (
            <Card className="bg-gray-900/50 border-gray-700 mb-6">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-blue-400" /> System Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ['check_in_start', 'Check-in Opens'], ['present_until', 'Present Until'], ['late_until', 'Late Until'], ['attendance_close', 'Attendance Closes'],
                    ['checkout_start', 'Checkout Opens'], ['checkout_end', 'Checkout Closes'], ['worklog_start', 'Work Log Opens'], ['worklog_end', 'Work Log Closes'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <Label className="text-gray-300 text-xs">{label}</Label>
                      <Input type="time" value={(attendanceSettings[key] || '').slice(0,5)} onChange={(e) => updateSystemField(key, e.target.value)} className="bg-black/50 border-white/10 text-white" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
                  <div>
                    <Label className="text-white">Weekends are holidays</Label>
                    <p className="text-sm text-gray-400">When enabled, Saturday/Sunday do not count as absent or late.</p>
                  </div>
                  <Switch checked={attendanceSettings.weekends_are_holidays} onCheckedChange={(v) => updateSystemField('weekends_are_holidays', v)} />
                </div>
                <p className="text-xs text-gray-500">Special holidays are controlled from Holiday Calendar and affect attendance calculations automatically.</p>
                <Button onClick={saveSystemSettings} disabled={savingSystem} className="gradient-primary"><Save className="w-4 h-4 mr-2" />{savingSystem ? 'Saving…' : 'Save System Rules'}</Button>
              </CardContent>
            </Card>
          )}

          {/* Account Info */}
          <Card className="bg-gray-900/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400">Name</p>
                  <p className="text-white font-medium">{adminProfile?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Email</p>
                  <p className="text-white font-medium">{adminProfile?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Role</p>
                  <p className="text-white font-medium capitalize">
                    {adminProfile?.role?.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

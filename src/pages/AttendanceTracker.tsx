import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ModuleLayout from '@/components/ModuleLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Check, X, Clock, Download, TrendingUp, Users, UserCheck, UserX, AlertCircle, Edit, ChevronDown, ChevronUp, Search, ScanLine, FileDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDateForDB, getMonthStartForDB, getMonthEndForDB } from '@/lib/utils';
import PdfExportDialog from '@/components/PdfExportDialog';
import { buildReport, downloadReport, type PdfPeriod, type PdfTheme } from '@/lib/pdfReport';
import { useTimeWindows } from '@/hooks/useTimeWindows';
import TeamAttendanceReviewCards from '@/components/TeamAttendanceReviewCards';
import HolidayCard from '@/components/HolidayCard';

const CHART_COLORS = ['#3b82f6', '#6b7280', '#1f2937'];

interface AttendanceRecord {
  id: string;
  admin_id: string;
  date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  marked_at: string | null;
  reason: string | null;
  override_status: string | null;
  override_reason: string | null;
  overridden_by: string | null;
  overridden_at: string | null;
  admin?: { name: string; email: string; role: string };
}

const AttendanceTracker: React.FC = () => {
  const navigate = useNavigate();
  const { adminProfile } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const tzVersion = useTimeWindows();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [reason, setReason] = useState('');
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [allAdmins, setAllAdmins] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [myAttendance, setMyAttendance] = useState<any>(null);
  const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAdminForExport, setSelectedAdminForExport] = useState<string>('');
  
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [selectedRecordForOverride, setSelectedRecordForOverride] = useState<AttendanceRecord | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string>('present');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [showWorkLogWarning, setShowWorkLogWarning] = useState(false);
  const [hasWorkLogToday, setHasWorkLogToday] = useState<boolean | null>(null);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [workLogOpen, setWorkLogOpen] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [systemSettings, setSystemSettings] = useState<any>(null);

  const today = new Date();
  // Use utility function for consistent YYYY-MM-DD format
  const todayStr = formatDateForDB(today);
  const isToday = formatDateForDB(selectedDate) === todayStr;
  const isSuperAdmin = adminProfile?.role === 'super_admin';

  const getCurrentTimeBasedStatus = () => {
    return 'present';
  };

  const getTimeBasedMessage = () => {
    const s = systemSettings;
    return { status: 'Configured', message: `Attendance: ${s?.check_in_start?.slice(0,5) || '06:00'}–${s?.attendance_close?.slice(0,5) || '23:59'} IST · Present until ${s?.present_until?.slice(0,5) || '11:00'} · Late until ${s?.late_until?.slice(0,5) || '17:00'}`, color: 'text-blue-500' };
  };

  const checkWorkLogToday = async () => {
    if (!adminProfile) return;
    const role = adminProfile.role as string;
    // esports_admin and super_admin exempt from work log requirement
    if (role === 'esports_admin' || role === 'super_admin') {
      setHasWorkLogToday(true);
      return;
    }

    const todayStart = formatDateForDB(new Date()) + 'T00:00:00';
    const todayEnd = formatDateForDB(new Date()) + 'T23:59:59';
    let hasLog = false;

    try {
      // Unified check first — this covers work_log_entries plus legacy tables.
      const { data: unified } = await supabase.rpc('admin_has_work_log_for_date' as any, {
        p_admin_id: adminProfile.id,
        p_date: formatDateForDB(new Date()),
      });
      if (unified === true) { setHasWorkLogToday(true); return; }

      if (role === 'tech_admin') {
        const { data } = await supabase
          .from('tech_work_logs')
          .select('id')
          .eq('admin_id', adminProfile.id)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd)
          .limit(1);
        hasLog = (data || []).length > 0;
      } else if (role === 'content_admin' || role === 'social_admin') {
        const { data } = await supabase
          .from('content_work_logs')
          .select('id')
          .eq('admin_id', adminProfile.id)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd)
          .limit(1);
        hasLog = (data || []).length > 0;
      } else if (role === 'hr_admin') {
        // HR admins need work logs too - check both content and tech logs
        const { data: contentData } = await supabase
          .from('content_work_logs')
          .select('id')
          .eq('admin_id', adminProfile.id)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd)
          .limit(1);
        const { data: techData } = await supabase
          .from('tech_work_logs')
          .select('id')
          .eq('admin_id', adminProfile.id)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd)
          .limit(1);
        hasLog = ((contentData || []).length > 0) || ((techData || []).length > 0);
      } else {
        hasLog = true;
      }
    } catch (err) {
      console.error('Error checking work log:', err);
      hasLog = true; // Don't block on error
    }

    console.log('Work log check result:', { role, hasLog });
    setHasWorkLogToday(hasLog);
  };

  useEffect(() => {
    if (adminProfile) {
      fetchAdmins();
      fetchAttendanceData();
      fetchTodayAttendance();
      fetchMyAttendance();
      fetchMonthlyAttendance();
      checkWorkLogToday();
    }
  }, [selectedDate, selectedMonth, adminProfile, tzVersion]);

  useEffect(() => {
    supabase.from('attendance_settings' as any).select('*').limit(1).maybeSingle().then(({ data }) => setSystemSettings(data));
  }, [tzVersion]);

  const fetchAdmins = async () => {
    try {
      const { data: admins, error } = await supabase
        .from('admins')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      setAllAdmins(admins || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const fetchAttendanceData = async () => {
    if (!isSuperAdmin) return;
    
    try {
      const dateStr = formatDateForDB(selectedDate);
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select(`
          *,
          admin:admins!admin_id(name, email, role)
        `)
        .eq('date', dateStr)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAttendanceData(attendance || []);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    }
  };

  const fetchTodayAttendance = async () => {
    if (!isSuperAdmin) return;
    
    try {
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select(`
          *,
          admin:admins!admin_id(name, email, role)
        `)
        .eq('date', todayStr);
      
      if (error) throw error;
      setTodayAttendance(attendance || []);
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    }
  };

  const fetchMyAttendance = async () => {
    if (!adminProfile) return;
    
    try {
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('admin_id', adminProfile.id)
        .eq('date', todayStr)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      setMyAttendance(attendance);
    } catch (error) {
      console.error('Error fetching my attendance:', error);
    }
  };

  const fetchMonthlyAttendance = async () => {
    if (!adminProfile) return;
    
    try {
      const monthStart = getMonthStartForDB(selectedMonth);
      const monthEnd = getMonthEndForDB(selectedMonth);
      
      let query = supabase
        .from('attendance')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd);
      
      if (!isSuperAdmin) {
        query = query.eq('admin_id', adminProfile.id);
      }
      
      const { data: attendance, error } = await query;
      
      if (error) throw error;
      setMonthlyAttendance(attendance || []);
    } catch (error) {
      console.error('Error fetching monthly attendance:', error);
    }
  };

  const markAttendance = async () => {
    if (!adminProfile || !isToday) {
      toast({
        title: "Error",
        description: "You can only mark attendance for today",
        variant: "destructive",
      });
      return;
    }

    const { data: statusRpc } = await supabase.rpc('attendance_status_for_time', { _at: new Date().toISOString() } as any);
    const status = (statusRpc as string) || getCurrentTimeBasedStatus();

    // Check if work log is missing (non-esports)
    const role = adminProfile.role as string;
    if (hasWorkLogToday === false && role !== 'esports_admin') {
      setShowWorkLogWarning(true);
      return;
    }

    try {
      setIsLoading(true);
      
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('admin_id', adminProfile.id)
        .eq('date', todayStr)
        .single();

      if (existing) {
        toast({
          title: "Already Marked",
          description: "Your attendance for today has already been recorded",
          variant: "default",
        });
        return;
      }

      const { error } = await supabase
        .from('attendance')
        .insert({
          admin_id: adminProfile.id,
          date: todayStr,
          status: status,
          reason: reason || null,
          marked_by: adminProfile.id,
          marked_at: new Date().toISOString(),
          check_in_time: new Date().toISOString()
        } as any);

      if (error) throw error;

      await logActivity('Marked attendance', { 
        status: status, 
        date: todayStr,
        time: format(new Date(), 'HH:mm:ss'),
        reason: reason || undefined 
      });

      toast({
        title: "Attendance Marked",
        description: `Your attendance has been marked as "${status.charAt(0).toUpperCase() + status.slice(1)}"`,
      });

      setReason('');
      fetchMyAttendance();
      fetchMonthlyAttendance();
      if (isSuperAdmin) {
        fetchAttendanceData();
        fetchTodayAttendance();
      }
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark attendance",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const overrideAttendanceStatus = async () => {
    if (!adminProfile || !isSuperAdmin || !selectedRecordForOverride) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('attendance')
        .update({
          status: overrideStatus,
          override_status: overrideStatus,
          override_reason: overrideReason || null,
          overridden_by: adminProfile.id,
          overridden_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedRecordForOverride.id);

      if (error) throw error;

      await logActivity('Overrode attendance status', {
        admin: selectedRecordForOverride.admin?.name,
        date: selectedRecordForOverride.date,
        old_status: selectedRecordForOverride.status,
        new_status: overrideStatus,
        reason: overrideReason || undefined,
      });

      toast({
        title: "Attendance Updated",
        description: `Status changed to ${overrideStatus} for ${selectedRecordForOverride.admin?.name}`,
      });

      setShowOverrideDialog(false);
      setSelectedRecordForOverride(null);
      setOverrideStatus('present');
      setOverrideReason('');
      fetchAttendanceData();
      fetchTodayAttendance();
      fetchMonthlyAttendance();
    } catch (error: any) {
      console.error('Error overriding attendance:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update attendance",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const [holidays, setHolidays] = useState<string[]>([]);

  // Fetch holidays
  useEffect(() => {
    const fetchHolidays = async () => {
      const { data } = await supabase.from('holidays').select('date');
      setHolidays((data || []).map((h: any) => h.date));
    };
    fetchHolidays();
  }, []);

  // Calculate actual working days in the selected month (excluding weekends AND holidays)
  const getWorkingDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    
    // If current month, count up to today; otherwise count all days in month
    const lastDay = isCurrentMonth ? now.getDate() : new Date(year, month + 1, 0).getDate();

    // Respect the configured working_days from attendance_settings (0=Sun..6=Sat).
    const configured: number[] | undefined = (systemSettings as any)?.working_days;
    const weekendsAreHolidays = (systemSettings as any)?.weekends_are_holidays;
    const workdays: number[] = Array.isArray(configured) && configured.length
      ? configured
      : (weekendsAreHolidays === false ? [0,1,2,3,4,5,6] : [1,2,3,4,5]);

    let workingDays = 0;
    for (let day = 1; day <= lastDay; day++) {
      const d = new Date(year, month, day);
      const dateStr = formatDateForDB(d);
      if (workdays.includes(d.getDay()) && !holidays.includes(dateStr)) {
        workingDays++;
      }
    }
    return workingDays;
  };

  const getMonthlyStats = (adminId?: string) => {
    const relevantAttendance = adminId 
      ? monthlyAttendance.filter(a => a.admin_id === adminId)
      : monthlyAttendance;
    
    const present = relevantAttendance.filter(a => a.status === 'present').length;
    const late = relevantAttendance.filter(a => a.status === 'late').length;
    const absent = relevantAttendance.filter(a => a.status === 'absent').length;
    
    // Use actual working days in the month instead of just recorded days
    const workingDays = getWorkingDaysInMonth(selectedMonth);
    const score = present + (late * 0.5);
    
    // Cap the score to not exceed working days and percentage to 100%
    const cappedScore = Math.min(score, workingDays);
    const percentage = workingDays > 0 ? Math.min(100, Math.round((cappedScore / workingDays) * 100)) : 0;

    // Count holidays that fell inside the month (label separately in UI).
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const holidayCount = holidays.filter(dStr => {
      const d = new Date(dStr);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;

    return { present, late, absent, totalDays: workingDays, holidayCount, score: cappedScore, percentage };
  };

  const myStats = getMonthlyStats(adminProfile?.id);

  const getAttendanceStats = () => {
    const total = allAdmins.length;
    const present = todayAttendance.filter(a => a.status === 'present').length;
    const absent = todayAttendance.filter(a => a.status === 'absent').length;
    const late = todayAttendance.filter(a => a.status === 'late').length;
    const notMarked = total - todayAttendance.length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, late, notMarked, percentage };
  };

  const stats = getAttendanceStats();

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-blue-500 text-white border-blue-500';
      case 'absent':
        return 'bg-gray-700 text-white border-gray-700';
      case 'late':
        return 'bg-gray-500 text-white border-gray-500';
      default:
        return 'bg-gray-600 text-white border-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <Check className="h-4 w-4" />;
      case 'absent':
        return <X className="h-4 w-4" />;
      case 'late':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const exportAttendanceCSV = async (adminId?: string) => {
    try {
      const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      let query = supabase
        .from('attendance')
        .select(`
          *,
          admin:admins!admin_id(name, email, role)
        `)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: true });
      
      if (adminId) {
        query = query.eq('admin_id', adminId);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      const headers = ['Date', 'Admin Name', 'Email', 'Role', 'Status', 'Check-in Time', 'Check-out Time', 'Reason'];
      const rows = (data || []).map(record => [
        record.date,
        record.admin?.name || 'Unknown',
        record.admin?.email || '',
        record.admin?.role?.replace('_', ' ') || '',
        record.status,
        record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm:ss') : (record.marked_at ? format(new Date(record.marked_at), 'HH:mm:ss') : ''),
        record.check_out_time ? format(new Date(record.check_out_time), 'HH:mm:ss') : '',
        record.reason || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const adminName = adminId ? allAdmins.find(a => a.id === adminId)?.name || 'admin' : 'all-admins';
      link.download = `attendance-${adminName}-${format(selectedMonth, 'yyyy-MM')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Attendance data exported successfully",
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export attendance data",
        variant: "destructive",
      });
    }
  };

  const monthlyChartData = [
    { name: 'Present', value: myStats.present, color: CHART_COLORS[0] },
    { name: 'Late', value: myStats.late, color: CHART_COLORS[1] },
    { name: 'Absent', value: myStats.absent, color: CHART_COLORS[2] },
  ];

  const generateAttendancePdf = async (range: { from: Date; to: Date }, period: PdfPeriod, theme: PdfTheme = 'classic') => {
    try {
      const fromStr = formatDateForDB(range.from);
      const toStr = formatDateForDB(range.to);
      const targetAdminId = selectedAdminForExport && selectedAdminForExport !== 'all' ? selectedAdminForExport : null;

      let attQ = supabase
        .from('attendance')
        .select('*, admin:admins!admin_id(name, email, role)')
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', { ascending: true });
      if (targetAdminId) attQ = attQ.eq('admin_id', targetAdminId);
      const { data: att } = await attQ;

      let techQ = supabase.from('tech_work_logs').select('*, admin:admins!admin_id(name, role)').gte('created_at', fromStr).lte('created_at', `${toStr}T23:59:59`);
      let contentQ = supabase.from('content_work_logs').select('*, admin:admins!admin_id(name, role)').gte('created_at', fromStr).lte('created_at', `${toStr}T23:59:59`);
      // Filter by created_at range so entries with missing log_date (post-4-June rows) are still included.
      let unifiedQ = supabase
        .from('work_log_entries')
        .select('*, admin:admins!work_log_entries_admin_id_fkey(name, role)')
        .eq('is_draft', false)
        .gte('created_at', fromStr)
        .lte('created_at', `${toStr}T23:59:59`);
      if (targetAdminId) { techQ = techQ.eq('admin_id', targetAdminId); contentQ = contentQ.eq('admin_id', targetAdminId); unifiedQ = unifiedQ.eq('admin_id', targetAdminId); }
      const [{ data: techLogs }, { data: contentLogs }, { data: unifiedLogs }] = await Promise.all([techQ, contentQ, unifiedQ]);

      // Fallback: if the embedded join failed to resolve admin names, hydrate manually from allAdmins.
      const nameById = new Map<string, { name: string; role: string }>(
        allAdmins.map((a: any) => [a.id, { name: a.name, role: (a.role || '').replace('_', ' ') }])
      );
      const withAdmin = (rows: any[] | null | undefined) =>
        (rows || []).map((r: any) => ({ ...r, admin: r.admin || nameById.get(r.admin_id) || { name: 'Unknown', role: '-' } }));
      const uLogs = withAdmin(unifiedLogs);
      const tLogs = withAdmin(techLogs);
      const cLogs = withAdmin(contentLogs);

      const records = (att || []) as any[];
      // Working days based on configured attendance_settings (respects Sat/Sun toggles + holidays).
      const configured: number[] | undefined = (systemSettings as any)?.working_days;
      const weekendsAreHolidays = (systemSettings as any)?.weekends_are_holidays;
      const workdays: number[] = Array.isArray(configured) && configured.length
        ? configured
        : (weekendsAreHolidays === false ? [0,1,2,3,4,5,6] : [1,2,3,4,5]);
      const holidaySet = new Set(holidays);
      const totalDays = eachDayOfInterval({ start: range.from, end: range.to })
        .filter(d => workdays.includes(d.getDay()) && !holidaySet.has(formatDateForDB(d)))
        .length;

      // Per-admin summary
      const byAdmin = new Map<string, { name: string; role: string; present: number; late: number; absent: number; }>();
      records.forEach((r: any) => {
        const k = r.admin_id;
        const cur = byAdmin.get(k) || { name: r.admin?.name || 'Unknown', role: (r.admin?.role || '').replace('_', ' '), present: 0, late: 0, absent: 0 };
        if (r.status === 'present') cur.present += 1;
        else if (r.status === 'late') cur.late += 1;
        else if (r.status === 'absent') cur.absent += 1;
        byAdmin.set(k, cur);
      });

      const summaryRows = Array.from(byAdmin.values())
        .sort((a, b) => b.present - a.present)
        .map(r => {
          const attendedRaw = r.present + r.late;
          const attended = totalDays ? Math.min(attendedRaw, totalDays) : attendedRaw;
          const pct = totalDays ? Math.min(100, Math.round((attended / totalDays) * 100)) : 0;
          return [r.name, r.role || '-', String(r.present), String(r.late), String(r.absent), `${attended}/${totalDays}`, `${pct}%`];
        });

      const detailRows = records.slice(0, 500).map((r: any) => [
        r.date,
        r.admin?.name || 'Unknown',
        (r.admin?.role || '').replace('_', ' '),
        r.status,
        r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : (r.marked_at ? format(new Date(r.marked_at), 'HH:mm') : '-'),
        r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '-',
        r.reason || '-',
      ]);

      const totalPresent = records.filter(r => r.status === 'present').length;
      const totalLate = records.filter(r => r.status === 'late').length;
      const totalAbsent = records.filter(r => r.status === 'absent').length;
      const overallPct = totalDays && byAdmin.size
        ? Math.min(100, Math.round(((totalPresent + totalLate) / (totalDays * byAdmin.size)) * 100))
        : 0;

      const sections: any[] = [
        {
          title: 'Per-Admin Summary',
          subtitle: `${byAdmin.size} admins · ${totalDays} working days`,
          head: [['Admin', 'Role', 'Present', 'Late', 'Absent', 'Attended', '%']],
          body: summaryRows.length ? summaryRows : [['—', '—', '0', '0', '0', `0/${totalDays}`, '0%']],
          summary: [
            { label: 'Total Present', value: String(totalPresent) },
            { label: 'Total Late', value: String(totalLate) },
            { label: 'Total Absent', value: String(totalAbsent) },
            { label: 'Attendance %', value: `${overallPct}%` },
          ],
        },
        {
          title: 'Attendance Detail',
          subtitle: records.length > 500 ? `Showing first 500 of ${records.length}` : `${records.length} records`,
          head: [['Date', 'Admin', 'Role', 'Status', 'Check-in', 'Check-out', 'Reason']],
          body: detailRows.length ? detailRows : [['—', '—', '—', '—', '—', '—', '—']],
        },
      ];

      const workRows: any[] = [
        ...uLogs.map((l: any) => [l.log_date || format(new Date(l.created_at), 'dd MMM'), l.admin?.name || '-', l.work_type || 'Work', l.title || '-', `${l.hours_spent || 0}h · ${l.completion_pct ?? 100}%`]),
        ...tLogs.map((l: any) => [format(new Date(l.created_at), 'dd MMM'), l.admin?.name || '-', 'Tech', l.title || '-', l.status || '-']),
        ...cLogs.map((l: any) => [format(new Date(l.created_at), 'dd MMM'), l.admin?.name || '-', 'Content', l.title || '-', l.status || '-']),
      ];
      sections.push({
        title: 'Work Logs',
        subtitle: `${workRows.length} entries`,
        head: [['Date', 'Admin', 'Type', 'Title', 'Details / Status']],
        body: workRows.length ? workRows.slice(0, 300) : [['—', '—', '—', '—', '—']],
        summary: [
          { label: 'Work logs', value: String(uLogs.length) },
          { label: 'Tech logs', value: String(tLogs.length) },
          { label: 'Content logs', value: String(cLogs.length) },
        ],
      });

      const adminLabel = targetAdminId ? (allAdmins.find(a => a.id === targetAdminId)?.name || 'admin') : 'All Admins';
      const doc = buildReport({
        title: 'Attendance & Work Report',
        subtitle: `${adminLabel} · ${format(range.from, 'dd MMM yyyy')} – ${format(range.to, 'dd MMM yyyy')}`,
        range,
        theme,
        kpis: [
          { label: 'Working Days', value: String(totalDays) },
          { label: 'Admins', value: String(byAdmin.size || allAdmins.length) },
          { label: 'Attendance %', value: `${overallPct}%` },
          { label: 'Work Logs', value: String(workRows.length) },
        ],
        sections,
      });
      downloadReport(doc, `attendance-${adminLabel.toLowerCase().replace(/\s+/g, '-')}-${period}-${format(new Date(), 'yyyyMMdd')}`);
      toast({ title: 'PDF ready', description: 'Report downloaded successfully.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'PDF failed', description: 'Could not build the report.', variant: 'destructive' });
    }
  };

  const timeInfo = getTimeBasedMessage();

  // Is *today* a holiday? Drives the full-takeover Holiday card on the mark-attendance section.
  const todayIsoStr = format(new Date(), 'yyyy-MM-dd');
  const isTodayHoliday = holidays.includes(todayIsoStr);

  return (
    <ModuleLayout
      title="Attendance Tracker"
      description="Mark daily attendance with time-based status and view your attendance reports"
    >
      {/* Work Log Warning Dialog */}
      <Dialog open={showWorkLogWarning} onOpenChange={setShowWorkLogWarning}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-yellow-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Work Log Not Updated!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-gray-300">You have not submitted your work log for today.</p>
            <p className="text-red-400 font-medium">⚠️ You will be automatically marked ABSENT at 11:59 PM if your work log is not updated.</p>
            <p className="text-gray-400 text-sm">Please go to your work dashboard and submit your work log. Once submitted, your attendance will be automatically marked as present.</p>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setShowWorkLogWarning(false)} className="border-gray-600 text-gray-300">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Work Log Warning Banner */}
        {hasWorkLogToday === false && !myAttendance && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium">⚠️ Work Log Not Updated — Auto Absent at 11:59 PM</p>
              <p className="text-gray-400 text-sm">Your work log for today has not been submitted. You will be automatically marked ABSENT at 11:59 PM. Submit your work log in your dashboard to keep your attendance as present.</p>
            </div>
          </div>
        )}

        {/* If today is a Holiday, take over the mark-attendance card with the celebratory banner.
            HolidayCard owns its entire layout (avatar, name, role, rows, banner) and is driven
            entirely by the logged-in admin's real profile — nothing here is hardcoded. */}
        {isTodayHoliday ? (
          <HolidayCard
            name={adminProfile?.name}
            role={adminProfile?.role}
            avatarUrl={adminProfile?.avatar}
          />
        ) : (
        <Collapsible open={attendanceOpen} onOpenChange={setAttendanceOpen}>
          <Card className="bg-gray-900/50 border-gray-800">
            <CollapsibleTrigger asChild>
              <CardHeader className="p-4 sm:p-6 cursor-pointer hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white text-sm sm:text-base">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    <span className="truncate">Mark Attendance - {format(today, "PP")}</span>
                    {myAttendance && (
                      <Badge className={`ml-2 ${getStatusBadgeClass(myAttendance.status)}`}>
                        {myAttendance.status.charAt(0).toUpperCase() + myAttendance.status.slice(1)}
                      </Badge>
                    )}
                  </CardTitle>
                  {attendanceOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
                <CardDescription className={timeInfo.color}>
                  {timeInfo.message}
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {myAttendance ? (
                  <div className="text-center py-6">
                    <Badge className={`text-lg px-4 py-2 flex items-center gap-2 w-fit mx-auto ${getStatusBadgeClass(myAttendance.status)}`}>
                      {getStatusIcon(myAttendance.status)}
                      {myAttendance.status.charAt(0).toUpperCase() + myAttendance.status.slice(1)}
                    </Badge>
                    <p className="text-sm text-gray-500 mt-3">
                      Marked at {format(new Date(myAttendance.marked_at), 'hh:mm a')}
                    </p>
                    {myAttendance.reason && (
                      <p className="text-sm text-gray-500 mt-1">
                        Reason: {myAttendance.reason}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Attendance is marked via <span className="font-semibold text-primary">Face Scan</span>
                    </p>
                    <Button
                      onClick={() => navigate('/dashboard/face-attendance')}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <ScanLine className="w-4 h-4 mr-2" /> Go to Face Scan
                    </Button>
                    <p className={`text-xs ${timeInfo.color}`}>{timeInfo.message}</p>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        )}

        {/* Monthly Analytics Card - Collapsible */}
        <Collapsible open={workLogOpen} onOpenChange={setWorkLogOpen}>
          <Card className="bg-gray-900/50 border-gray-800">
            <CollapsibleTrigger asChild>
              <CardHeader className="p-4 sm:p-6 cursor-pointer hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-white text-sm sm:text-base">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                      Monthly Analytics
                      <Badge variant="outline" className="ml-2 border-gray-700 text-gray-400">{myStats.percentage}%</Badge>
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-xs sm:text-sm">
                      {format(selectedMonth, "MMMM yyyy")}
                    </CardDescription>
                  </div>
                  {workLogOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex justify-end mb-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs sm:text-sm w-fit">
                        <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Change Month
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800" align="end">
                      <Calendar
                        mode="single"
                        selected={selectedMonth}
                        onSelect={(date) => date && setSelectedMonth(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-2xl font-bold text-blue-500">{myStats.present}</p>
                    <p className="text-xs text-gray-500">Present</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-700/30 border border-gray-600/30">
                    <p className="text-2xl font-bold text-gray-400">{myStats.late}</p>
                    <p className="text-xs text-gray-500">Late (½ day)</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
                    <p className="text-2xl font-bold text-gray-500">{myStats.absent}</p>
                    <p className="text-xs text-gray-500">Absent</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-900/50 border border-gray-800">
                    <p className="text-2xl font-bold text-white">{myStats.percentage}%</p>
                    <p className="text-xs text-gray-500">Score</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>Attendance Score</span>
                    <span className="font-medium">{myStats.score.toFixed(1)} / {myStats.totalDays} working days</span>
                  </div>
                  <Progress value={myStats.percentage} className="h-2 bg-gray-800" />
                  <p className="text-xs text-gray-500 text-center">
                    {myStats.present} Present + {myStats.late} Late out of {myStats.totalDays} working days
                    {myStats.holidayCount > 0 && ` · 🌴 ${myStats.holidayCount} Holiday${myStats.holidayCount > 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="h-[200px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={monthlyChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                      >
                        {monthlyChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Team attendance cards for super admins include export controls;
            regular admins see their own monthly self-cards only. */}
        <TeamAttendanceReviewCards
          headerActions={isSuperAdmin ? (
            <>
              <Select value={selectedAdminForExport} onValueChange={setSelectedAdminForExport}>
                <SelectTrigger className="w-[160px] h-9 bg-gray-900 border-gray-700 text-white text-xs">
                  <SelectValue placeholder="Export for..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800">
                  <SelectItem value="all">All Admins</SelectItem>
                  {allAdmins.map(admin => (
                    <SelectItem key={admin.id} value={admin.id}>{admin.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline" size="sm"
                onClick={() => exportAttendanceCSV(selectedAdminForExport === 'all' ? undefined : selectedAdminForExport)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button
                size="sm"
                onClick={() => setPdfOpen(true)}
                className="bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90"
              >
                <FileDown className="h-4 w-4 mr-1" /> PDF
              </Button>
            </>
          ) : undefined}
        />
      </div>
      <PdfExportDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        title="Export Attendance Report"
        description="Generates a branded PDF with summaries, detailed attendance and work logs."
        onGenerate={generateAttendancePdf}
      />
    </ModuleLayout>
  );
};

export default AttendanceTracker;
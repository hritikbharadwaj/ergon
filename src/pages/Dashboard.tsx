import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import DashboardCard from '@/components/DashboardCard';
import DailyTodos from '@/components/DailyTodos';
import ActivitySummary from '@/components/ActivitySummary';
import MobileDashboard from '@/components/MobileDashboard';
import MeetingPopup from '@/components/MeetingPopup';
import { useAuth } from '@/contexts/AuthContext';
import { rolePermissions } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';
import EsportsPlayerForm from '@/components/EsportsPlayerForm';
import SocialMediaOrderForm from '@/components/SocialMediaOrderForm';
import SuperAdminReviewPanel from '@/components/SuperAdminReviewPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, X, Loader2, RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MODULE_GROUPS, isHubVisibleForRole } from '@/lib/moduleGroups';
import HolidayCard from '@/components/HolidayCard';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, adminProfile } = useAuth();
  const isMobile = useIsMobile();
  const restoreAttemptedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    totalRevenue: 0,
    activeUsers: 0,
    pendingOrders: 0,
    successRate: 0,
    totalAdmins: 0,
    activeAdmins: 0,
    presentToday: 0,
    attendancePercentage: 0,
    presentDaysThisMonth: 0,
    workingDaysInMonth: 0,
    totalDaysInMonth: 0,
    totalCertificates: 0,
    certificatesThisMonth: 0,
    pendingPayments: 0,
    verifiedPaymentsToday: 0,
    totalInternships: 0,
    completedInternships: 0,
    totalMessages: 0,
    monthlyGrowth: 0,
    esportsUsers: 0,
    socialUsers: 20,
    totalUsers: 0,
    todayNotifications: 0,
    esportsRevenue: 0,
    socialRevenue: 0,
    totalAuditLogs: 0,
    todayAuditActions: 0,
    totalFiles: 0,
    bulkUploads: 0,
    socialPosts: 0,
    socialFollowersGained: 0,
    averageFollowers: 0,
    totalEmployees: 0,
    activeEmployees: 0,
    totalCareerApplications: 0,
    pendingCareerApplications: 0,
    techWorkCount: 0,
    techTotalHours: 0,
    contentCount: 0,
    contentPlatforms: 0,
    leaveRequestsCount: 0,
    pendingLeaveRequests: 0,
    dailyAdminsPresentPercentage: 0
  });
  const [activeData, setActiveData] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const [holidayDates, setHolidayDates] = useState<string[]>([]);

  const requestedRestoreY = (() => {
    const routeState = location.state as { restoreScrollY?: number; fromModuleReturn?: boolean } | null;
    if (typeof routeState?.restoreScrollY === 'number' && routeState.restoreScrollY > 0) {
      return routeState.restoreScrollY;
    }
    try {
      const saved = sessionStorage.getItem('scroll:/dashboard');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  })();

  useEffect(() => {
    const routeState = location.state as { restoreScrollY?: number; fromModuleReturn?: boolean } | null;
    const shouldForceRestore = Boolean(routeState?.fromModuleReturn) || requestedRestoreY > 0;

    if (!shouldForceRestore || restoreAttemptedRef.current) return;

    restoreAttemptedRef.current = true;
    const delays = isLoading ? [0, 80, 180, 320, 600, 1000] : [0, 80, 180, 320, 600];
    const timers = delays.map((delay) =>
      window.setTimeout(() => {
        window.scrollTo({ top: requestedRestoreY, behavior: 'auto' });
      }, delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [isLoading, location.state, requestedRestoreY]);

  // Fetch holidays once
  useEffect(() => {
    const fetchHolidays = async () => {
      const { data } = await supabase.from('holidays').select('date');
      setHolidayDates((data || []).map((h: any) => h.date));
    };
    fetchHolidays();
  }, []);

  // Helper to calculate working days in a month up to a specific date (excluding holidays)
  const getWorkingDaysInMonth = (year: number, month: number, upToDay: number) => {
    let workingDays = 0;
    for (let day = 1; day <= upToDay; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      // Exclude weekends (0 = Sunday, 6 = Saturday) AND holidays
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.includes(dateStr)) {
        workingDays++;
      }
    }
    return workingDays;
  };

  const fetchRealDashboardStats = async () => {
    try {
      // Get current month start date for monthly attendance
      // Use explicit YYYY-MM-DD formatting to avoid locale issues
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      const monthStart = `${year}-${month}-01`;
      
      const [
        { data: admins },
        { data: todayAttendanceData },
        { data: monthlyAttendance },
        { data: certificates },
        { data: internships },
        { data: chatMessages },
        { data: paymentVerifications },
        { data: esportsPlayers },
        { data: socialOrders },
        { data: socialAnalytics },
        { data: employees },
        { data: careerApplications },
        { data: techWorkLogs },
        { data: contentWorkLogs },
        { data: leaveRequests }
      ] = await Promise.all([
        supabase.from('admins').select('*'),
        supabase.from('attendance').select('*').eq('date', todayStr),
        // Fetch attendance for the current month to calculate monthly stats
        supabase.from('attendance').select('*')
          .gte('date', monthStart)
          .lte('date', todayStr)
          .eq('admin_id', adminProfile?.id || ''),
        supabase.from('certificates').select('*'),
        supabase.from('internships').select('*'),
        supabase.from('chat_messages').select('*'),
        supabase.from('payment_verifications').select('*'),
        supabase.from('esports_players').select('*'),
        supabase.from('social_media_orders').select('*'),
        supabase.from('social_media_analytics').select('*'),
        supabase.from('employees').select('*'),
        supabase.from('career_applications').select('*'),
        supabase.from('tech_work_logs').select('*'),
        supabase.from('content_work_logs').select('*'),
        adminProfile?.role === 'super_admin' 
          ? supabase.from('leave_requests').select('*')
          : supabase.from('leave_requests').select('*').eq('admin_id', adminProfile?.id || '')
      ]);

      // Calculate esports and social revenue
      const esportsRevenue = esportsPlayers?.filter((p: any) => p.payment_received).reduce((sum: number, p: any) => sum + (p.entry_fees || 0), 0) || 0;
      const socialRevenue = socialOrders?.filter((o: any) => o.payment_received).reduce((sum: number, o: any) => sum + (o.payment_amount || 0), 0) || 0;

      const socialPosts = socialAnalytics?.reduce((sum: number, a: any) => sum + (a.posts_count || 0), 0) || 0;
      const socialFollowersGained = socialAnalytics?.reduce((sum: number, a: any) => sum + (a.followers_gained || 0), 0) || 0;
      const totalFollowers = socialAnalytics?.reduce((sum: number, a: any) => sum + (a.total_followers || 0), 0) || 0;
      const analyticsCount = socialAnalytics?.length || 0;
      const averageFollowers = analyticsCount > 0 ? Math.round(totalFollowers / analyticsCount) : 0;

      const totalEmployees = employees?.length || 0;
      const activeEmployees = employees?.filter((e: any) => e.status === 'active').length || 0;
      const totalCareerApplications = careerApplications?.length || 0;
      const pendingCareerApplications = careerApplications?.filter((a: any) => a.status === 'pending').length || 0;
      const techWorkCount = techWorkLogs?.length || 0;
      const techTotalHours = techWorkLogs?.reduce((sum: number, l: any) => sum + (l.hours_spent || 0), 0) || 0;
      const contentCount = contentWorkLogs?.length || 0;
      const uniquePlatforms = new Set(contentWorkLogs?.map((l: any) => l.platform).filter(Boolean) || []);
      const contentPlatforms = uniquePlatforms.size;

      // Leave requests stats
      const leaveRequestsCount = leaveRequests?.length || 0;
      const pendingLeaveRequests = leaveRequests?.filter((l: any) => l.status === 'pending').length || 0;

      // Calculate working days in current month up to today
      const currentDay = now.getDate();
      const workingDaysInMonth = getWorkingDaysInMonth(now.getFullYear(), now.getMonth(), currentDay);
      
      // Get total days in the current month
      const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      
      // Count attendance score for the current admin (present=1, late=0.5)
      const presentCount = monthlyAttendance?.filter((a: any) => a.status === 'present').length || 0;
      const lateCount = monthlyAttendance?.filter((a: any) => a.status === 'late').length || 0;
      const attendanceScore = presentCount + (lateCount * 0.5);
      
      // Cap the score to not exceed working days (for display purposes)
      const cappedScore = Math.min(attendanceScore, workingDaysInMonth);
      const presentDaysThisMonth = Math.round(cappedScore);
      
      // Calculate attendance percentage based on working days (capped at 100%)
      const monthlyAttendancePercentage = workingDaysInMonth > 0 
        ? Math.min(100, Math.round((cappedScore / workingDaysInMonth) * 100))
        : 0;

      const totalAdmins = admins?.length || 0;
      // Count admins present today (present or late status)
      const presentToday = todayAttendanceData?.filter((a: any) => a.status === 'present' || a.status === 'late').length || 0;
      
      // Calculate daily admin attendance percentage for super admin view
      const dailyAdminsPresentPercentage = totalAdmins > 0 
        ? Math.min(100, Math.round((presentToday / totalAdmins) * 100))
        : 0;
      
      const attendancePercentage = monthlyAttendancePercentage;
      const totalCertificates = certificates?.length || 0;
      const thisMonth = new Date().getMonth();
      const certificatesThisMonth = certificates?.filter((c: any) => new Date(c.created_at).getMonth() === thisMonth).length || 0;
      const totalInternships = internships?.filter((i: any) => i.status === 'active').length || 0;
      const completedInternships = internships?.filter((i: any) => i.status === 'completed').length || 0;
      const totalMessages = chatMessages?.length || 0;
      const verifiedPayments = paymentVerifications?.filter((p: any) => p.payment_received) || [];
      const totalRevenue = verifiedPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) + esportsRevenue + socialRevenue;
      const pendingPayments = paymentVerifications?.filter((p: any) => !p.payment_received).length || 0;
      const verifiedToday = verifiedPayments.filter((p: any) => p.verified_at && new Date(p.verified_at).toDateString() === new Date().toDateString()).length;

      const esportsUserNames = new Set(esportsPlayers?.map((p: any) => p.player_name.toLowerCase()) || []);
      const esportsUsers = esportsUserNames.size;
      const totalUsers = esportsUsers + 20;

      const today = new Date().toDateString();
      const todayPayments = paymentVerifications?.filter(p => 
        new Date(p.created_at).toDateString() === today
      ).length || 0;
      const todayAttendance = todayAttendanceData?.length || 0;
      const todayCertificates = certificates?.filter(c => 
        new Date(c.created_at).toDateString() === today
      ).length || 0;
      const todayNotifications = todayPayments + todayAttendance + todayCertificates;

      const totalAuditLogs = (paymentVerifications?.length || 0) + (certificates?.length || 0) + 
                           (internships?.length || 0) + (todayAttendanceData?.length || 0);
      const todayAuditActions = todayPayments + todayCertificates + todayAttendance;

      setDashboardStats({
        totalRevenue: totalRevenue,
        activeUsers: totalUsers,
        pendingOrders: pendingPayments,
        successRate: verifiedPayments.length > 0 ? Math.round((verifiedPayments.length / (paymentVerifications?.length || 1)) * 100) : 0,
        totalAdmins,
        activeAdmins: totalAdmins,
        presentToday,
        attendancePercentage,
        presentDaysThisMonth,
        workingDaysInMonth,
        totalDaysInMonth,
        totalCertificates,
        certificatesThisMonth,
        pendingPayments,
        verifiedPaymentsToday: verifiedToday,
        totalInternships,
        completedInternships,
        totalMessages,
        monthlyGrowth: certificatesThisMonth > 0 ? Math.round(((certificatesThisMonth / totalCertificates) * 100)) : 0,
        esportsUsers,
        socialUsers: 20,
        totalUsers,
        todayNotifications,
        esportsRevenue,
        socialRevenue,
        totalAuditLogs,
        todayAuditActions,
        totalFiles: 0,
        bulkUploads: 0,
        socialPosts,
        socialFollowersGained,
        averageFollowers,
        totalEmployees,
        activeEmployees,
        totalCareerApplications,
        pendingCareerApplications,
        techWorkCount,
        techTotalHours,
        contentCount,
        contentPlatforms,
        leaveRequestsCount,
        pendingLeaveRequests,
        dailyAdminsPresentPercentage
      });

      console.log('Real dashboard stats loaded successfully');
    } catch (error) {
      console.error('Error fetching real dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoleSpecificData = async () => {
    try {
      let data: any[] = [];
      if (!adminProfile) return;
      
      if (adminProfile.role === 'super_admin' || adminProfile.role === 'esports_admin') {
        const { data: esportsData } = await supabase.from('esports_players').select('*').order('created_at', { ascending: false });
        if (esportsData) {
          data = [...data, ...esportsData.map(item => ({ ...item, type: 'esports' }))];
        }
      }

      if (adminProfile.role === 'super_admin' || adminProfile.role === 'social_admin') {
        const { data: socialData } = await supabase.from('social_media_orders').select('*').order('created_at', { ascending: false });
        if (socialData) {
          data = [...data, ...socialData.map(item => ({ ...item, type: 'social' }))];
        }
      }

      setActiveData(data);
    } catch (error) {
      console.error('Error fetching role-specific data:', error);
      setActiveData([]);
    }
  };

  // Initial load + realtime subscriptions (no more full-page polling → no flicker).
  useEffect(() => {
    fetchRealDashboardStats();

    // Debounced re-fetch so a burst of DB events triggers only a single reload.
    let pending: number | null = null;
    const debouncedFetch = () => {
      if (pending != null) window.clearTimeout(pending);
      pending = window.setTimeout(() => {
        pending = null;
        fetchRealDashboardStats();
      }, 600);
    };

    const tables = [
      'attendance',
      'admins',
      'payment_verifications',
      'certificates',
      'internships',
      'work_log_entries',
      'leave_requests',
    ];
    const channel = supabase.channel('dashboard-stats-live');
    tables.forEach((t) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, debouncedFetch);
    });
    channel.subscribe();

    return () => {
      if (pending != null) window.clearTimeout(pending);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holidayDates]);

  useEffect(() => {
    if (adminProfile) {
      fetchRoleSpecificData();
    }
  }, [adminProfile]);

  const handleDelete = async (item: any) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const tableMap: { [key: string]: string } = {
        'esports': 'esports_players',
        'social': 'social_media_orders'
      };

      const tableName = tableMap[item.type];
      if (!tableName) {
        throw new Error(`Unknown item type: ${item.type}`);
      }

      const { error } = await supabase.from(tableName as any).delete().eq('id', item.id);
      if (error) throw error;

      fetchRoleSpecificData();
      fetchRealDashboardStats();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  if (!user) {
    return null;
  }

  // Show loading state while we're fetching admin profile (with timeout)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div
            className="flex items-center justify-center"
            style={{
              minHeight: requestedRestoreY > 0
                ? Math.max(900, requestedRestoreY + 720)
                : window.innerHeight * 0.6,
            }}
          >
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-white mb-4 mx-auto" />
              <p className="text-white">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If no admin profile after loading, show error
  if (!adminProfile) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-white text-lg mb-2">No admin profile found</p>
              <p className="text-gray-400 text-sm mb-4">
                Please contact a super admin to create your admin account.
              </p>
              <Button onClick={() => window.location.href = '/login'} variant="outline">
                Back to Login
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayProfile = adminProfile;

  const hasPermission = (module: string) => {
    const permissions = rolePermissions[displayProfile.role];
    return permissions.includes('*') || permissions.includes(module);
  };

  const dataEntryCards = [];

  const modules = [
    {
      title: 'Overview Stats',
      description: 'Role-specific summary cards showing sales, orders, trades, and matches performance',
      iconSrc: '/icons/analytics.png',
      route: '/dashboard/overview',
      module: 'analytics',
      stats: [
        { label: 'Total Revenue', value: `₹${dashboardStats.totalRevenue.toLocaleString()}` },
        { label: 'Active Users', value: dashboardStats.activeUsers }
      ]
    },
    {
      title: 'Work Log Entry',
      description: 'Submit your daily work log. In the 10pm–12am IST window this also checks you out.',
      iconSrc: '/icons/analytics.png',
      route: '/dashboard/work-log',
      module: '*',
      badge: 'All Users',
      stats: [{ label: 'Window', value: '10pm–12am IST' }],
    },
    {
      title: 'Work Given',
      description: 'Tasks assigned to you with a downloadable PDF brief. Auto-purges weekly.',
      iconSrc: '/icons/stat.png',
      route: '/dashboard/work-given',
      module: '*',
      badge: 'All Users',
      stats: [{ label: 'Reset', value: 'Weekly' }],
    },
    {
      title: 'Work Logs',
      description: adminProfile?.role === 'super_admin'
        ? 'View every admin\'s most recent work log in one place.'
        : 'Your full personal work-log history.',
      iconSrc: '/icons/analytics.png',
      route: '/dashboard/work-logs',
      module: '*',
      badge: 'All Users',
      stats: [{ label: 'Access', value: adminProfile?.role === 'super_admin' ? 'All Admins' : 'My Logs' }],
    },
    {
      title: 'Clients',
      description: 'CRM: track name, contact, source (Insta / Email / Call) and status (Reached, Approved, Rejected, Followed Up).',
      iconSrc: '/icons/stat.png',
      route: '/dashboard/clients',
      module: '*',
      badge: 'All Users',
      stats: [{ label: 'Source', value: 'Insta / Email / Call' }],
    },
    {
      title: 'Engagement Analytics',
      description: 'Monthly clicks, meeting-join history, time-on-section heatmap.',
      iconSrc: '/icons/stat.png',
      route: '/dashboard/engagement',
      module: 'analytics',
      stats: [{ label: 'Access', value: 'Super Admin' }],
    },
    {
      title: 'Payroll',
      description: adminProfile?.role === 'super_admin'
        ? 'Generate, approve and download branded PDF salary slips for every admin.'
        : 'View and download your monthly salary slips as branded PDFs.',
      iconSrc: '/icons/stat.png',
      route: '/dashboard/payroll',
      module: '*',
      badge: adminProfile?.role === 'super_admin' ? 'Super Admin' : 'My Slips',
      stats: [{ label: 'Access', value: adminProfile?.role === 'super_admin' ? 'All Admins' : 'Personal' }],
    },
    {
      title: 'Attendance Tracker',
      description: 'Mark daily attendance, manage absences with reasons, and view attendance reports',
      iconSrc: '/icons/attendance.png',
      route: '/dashboard/attendance',
      module: '*',
      badge: 'All Users',
      stats: adminProfile?.role === 'super_admin' 
        ? [
            { label: 'Today Present', value: `${dashboardStats.presentToday}/${dashboardStats.totalAdmins}` },
            { label: 'Attendance %', value: `${dashboardStats.dailyAdminsPresentPercentage}%` }
          ]
        : [
            { label: 'This Month', value: `${dashboardStats.presentDaysThisMonth}/${dashboardStats.workingDaysInMonth}` },
            { label: 'Attendance %', value: `${dashboardStats.attendancePercentage}%` }
          ]
    },
    {
      title: 'Real-Time Team Chat',
      description: 'WebSocket-powered team communication with file uploads and role-based messaging',
      iconSrc: '/icons/chat.png',
      route: '/dashboard/chat',
      module: '*',
      badge: 'Live',
      stats: [
        { label: 'Online', value: dashboardStats.activeAdmins },
        { label: 'Messages', value: dashboardStats.totalMessages }
      ]
    },
    {
      title: 'Analytics Dashboard',
      description: 'Revenue breakdown, earnings graphs, and domain-wise performance analytics of Ergon',
      iconSrc: '/icons/stat.png',
      route: '/dashboard/analytics',
      module: 'analytics',
      stats: [
        { label: 'Monthly Growth', value: `${dashboardStats.monthlyGrowth >= 0 ? '+' : ''}${dashboardStats.monthlyGrowth}%` },
        { label: 'Total Revenue', value: `₹${(dashboardStats.totalRevenue / 100000).toFixed(1)}L` }
      ]
    },
    {
      title: 'Payment Verification',
      description: 'Verify user payments, manage transaction IDs, and export payment reports',
      iconSrc: '/icons/card.png',
      route: '/dashboard/payments',
      module: '*',
      badge: 'All Users',
      stats: [
        { label: 'Pending', value: dashboardStats.pendingPayments },
        { label: 'Verified Today', value: dashboardStats.verifiedPaymentsToday }
      ]
    },
    {
      title: 'Certificate Manager',
      description: 'Issue certificates, manage IDs, and provide real-time verification system with Certificate ID',
      iconSrc: '/icons/certificate.png',
      route: '/dashboard/certificates',
      module: 'super_admin_only',
      badge: 'Super Admin',
      stats: [
        { label: 'Total Issued', value: dashboardStats.totalCertificates },
        { label: 'This Month', value: dashboardStats.certificatesThisMonth }
      ]
    },
    {
      title: 'Internship Tracker',
      description: 'Manage intern records, track attendance, assign tasks, and monitor progress',
      iconSrc: '/icons/internship.png',
      route: '/dashboard/internships',
      module: 'super_admin_only',
      badge: 'Super Admin',
      stats: [
        { label: 'Active Interns', value: dashboardStats.totalInternships },
        { label: 'Completed', value: dashboardStats.completedInternships }
      ]
    },
    {
      title: 'Admin Management',
      description: 'Manage admin accounts, assign roles, view activity logs, and reset passwords and see last seen',
      iconSrc: '/icons/admin.png',
      route: '/dashboard/admin-management',
      module: 'super_admin_only',
      badge: 'Super Admin',
      stats: [
        { label: 'Total Admins', value: dashboardStats.totalAdmins },
        { label: 'Active', value: dashboardStats.activeAdmins }
      ]
    },
    {
      title: 'Bulk Upload & Import',
      description: 'Upload CSV/Excel files for tournaments, stocks, and orders with smart validation',
      iconSrc: '/icons/files.png',
      route: '/dashboard/bulk-upload',
      module: '*',
      stats: [
        { label: 'Files Uploaded', value: dashboardStats.bulkUploads },
        { label: 'Success Rate', value: '100%' }
      ]
    },
    {
      title: 'Notification Center',
      description: 'Real-time alerts for orders, matches, stocks with role-based filtering',
      iconSrc: '/icons/active.png',
      route: '/dashboard/notifications',
      module: '*',
      badge: 'Live',
      stats: [
        { label: 'Unread', value: dashboardStats.todayNotifications },
        { label: 'Today', value: dashboardStats.todayNotifications }
      ]
    },
    {
      title: 'File & Media Manager',
      description: 'Upload tournament posters, certificates, receipts with cloud storage',
      iconSrc: '/icons/folder.png',
      route: '/dashboard/files',
      module: '*',
      stats: [
        { label: 'Total Files', value: dashboardStats.totalFiles },
        { label: 'Storage Used', value: '0GB' }
      ]
    },
    {
      title: 'Audit Logs',
      description: 'Track admin actions, login history, and system activity with detailed logs',
      iconSrc: '/icons/log.png',
      route: '/dashboard/audit-logs',
      module: 'super_admin_only',
      badge: 'Super Admin',
      stats: [
        { label: 'Today Actions', value: dashboardStats.todayAuditActions },
        { label: 'Total Logs', value: dashboardStats.totalAuditLogs }
      ]
    },
    {
      title: 'Employee Management',
      description: 'Manage employee records, documents, Aadhar, PAN, offer letters and details',
      iconSrc: '/icons/admin.png',
      route: '/dashboard/employees',
      module: 'super_admin_only',
      badge: 'Super Admin',
      stats: [
        { label: 'Employees', value: dashboardStats.totalEmployees },
        { label: 'Active', value: dashboardStats.activeEmployees }
      ]
    },
    {
      title: 'Career Applications',
      description: 'View and manage job applications, review candidates and track hiring status',
      iconSrc: '/icons/internship.png',
      route: '/dashboard/careers',
      module: 'super_admin_only',
      badge: 'Super Admin',
      stats: [
        { label: 'Applications', value: dashboardStats.totalCareerApplications },
        { label: 'Pending', value: dashboardStats.pendingCareerApplications }
      ]
    },
    {
      title: 'Leave Management',
      description: 'Apply for leave, track leave requests and view approval status',
      iconSrc: '/icons/attendance.png',
      route: '/dashboard/leave',
      module: '*',
      badge: 'All Users',
      stats: [
        { label: 'Requests', value: dashboardStats.leaveRequestsCount },
        { label: 'Pending', value: dashboardStats.pendingLeaveRequests }
      ]
    },
    {
      title: 'HR Dashboard',
      description: 'Access HR functions including employee management, interns, and certificates',
      iconSrc: '/icons/admin.png',
      route: '/dashboard/hr',
      module: 'hr_admin_only',
      badge: 'HR Admin',
      stats: [
        { label: 'Employees', value: dashboardStats.totalEmployees },
        { label: 'Interns', value: dashboardStats.totalInternships }
      ]
    },
    {
      title: 'Holiday Calendar',
      description: 'Manage company holidays (excluded from working days calculation)',
      iconSrc: '/icons/attendance.png',
      route: '/dashboard/holidays',
      module: 'super_admin_only',
      badge: 'Super Admin',
      stats: [
        { label: 'Holidays', value: '0' },
        { label: 'This Year', value: new Date().getFullYear() }
      ]
    },
    {
      title: 'Time Management',
      description: 'Edit working week, holidays, attendance & work-log windows in one place.',
      iconSrc: '/icons/attendance.png',
      route: '/dashboard/time-management',
      module: 'super_admin_only',
      badge: 'Super Admin',
      stats: [
        { label: 'Scope', value: 'Org-wide' },
        { label: 'Applies', value: 'Instantly' }
      ]
    },
    // Attendance Review merged into the Attendance Tracker (super-admin cards inline).
    {
      title: 'Notice Broadcast',
      description: 'Send an official NOTICE email to all admins with one click.',
      iconSrc: '/icons/chat.png',
      route: '/dashboard/notice-broadcast',
      module: 'super_admin_only',
      badge: 'Super Admin',
      stats: [
        { label: 'Template', value: 'Branded' },
        { label: 'Delivery', value: 'Instant' }
      ]
    },
    {
      title: 'Announcements',
      description: 'Company-wide announcements and important updates for all team members',
      iconSrc: '/icons/active.png',
      route: '/dashboard/announcements',
      module: '*',
      badge: 'Live',
      stats: [
        { label: 'Board', value: 'Live' },
        { label: 'All Roles', value: '✓' }
      ]
    },
    {
      title: 'Polls & Surveys',
      description: 'Create polls, gather team opinions, and make data-driven decisions',
      iconSrc: '/icons/stat.png',
      route: '/dashboard/polls',
      module: '*',
      stats: [
        { label: 'Voting', value: 'Live' },
        { label: 'Anonymous', value: '✓' }
      ]
    },
    {
      title: 'Task Board',
      description: 'Kanban-style task management with assignments, priorities, and due dates',
      iconSrc: '/icons/trade.png',
      route: '/dashboard/tasks',
      module: '*',
      badge: 'Live',
      stats: [
        { label: 'Kanban', value: '4 Cols' },
        { label: 'Realtime', value: '✓' }
      ]
    },
    {
      title: 'Daily Standups',
      description: 'Quick daily updates — yesterday, today, blockers with mood tracking',
      iconSrc: '/icons/chat.png',
      route: '/dashboard/standups',
      module: '*',
      stats: [
        { label: 'Daily', value: 'Updates' },
        { label: 'Mood', value: '✓' }
      ]
    },
    {
      title: 'Feedback',
      description: 'Share anonymous or named feedback, suggestions, and bug reports',
      iconSrc: '/icons/social-media.png',
      route: '/dashboard/feedback',
      module: '*',
      stats: [
        { label: 'System', value: 'Open' },
        { label: 'Anonymous', value: '✓' }
      ]
    },
    {
      title: 'Team Events',
      description: 'Calendar of meetings, trainings, celebrations, and deadlines',
      iconSrc: '/icons/attendance.png',
      route: '/dashboard/events',
      module: '*',
      stats: [
        { label: 'Calendar', value: 'Live' },
        { label: 'Types', value: '5' }
      ]
    },
    {
      title: 'Performance Scores',
      description: 'Auto-calculated performance rankings based on attendance and work logs',
      iconSrc: '/icons/analytics.png',
      route: '/dashboard/performance',
      module: '*',
      badge: 'Live',
      stats: [
        { label: 'Rankings', value: 'Live' },
        { label: 'Metrics', value: '3' }
      ]
    },
    {
      title: 'Admin Reports',
      description: 'Generate detailed per-admin reports with attendance, work logs, and leave data',
      iconSrc: '/icons/files.png',
      route: '/dashboard/reports',
      module: 'super_admin_only',
      badge: 'Super Admin',
      stats: [
        { label: 'Export', value: 'CSV' },
        { label: 'Detailed', value: '✓' }
      ]
    },
    {
      title: 'Birthday Reminders',
      description: 'Never miss a team member\'s birthday — upcoming and today\'s celebrations',
      iconSrc: '/icons/certificate.png',
      route: '/dashboard/birthdays',
      module: '*',
      stats: [
        { label: 'Reminders', value: 'Auto' },
        { label: 'Team', value: '✓' }
      ]
    },
    {
      title: 'Email Management',
      description: 'Send professional emails via @admin.Ergon.in with usage tracking',
      iconSrc: '/icons/chat.png',
      route: '/dashboard/email',
      module: 'email_identity',
      badge: 'New',
      stats: [
        { label: 'Send', value: 'Pro' },
        { label: 'Track', value: '✓' }
      ]
    },
    {
      title: 'Quick Notes',
      description: 'Personal sticky notes — pin, color-code, and organize your thoughts',
      iconSrc: '/icons/files.png',
      route: '/dashboard/notes',
      module: '*',
      stats: [
        { label: 'Personal', value: '✓' },
        { label: 'Pinnable', value: '✓' }
      ]
    },
    {
      title: 'Company Directory',
      description: 'Find and connect with all team members — admins and employees',
      iconSrc: '/icons/admin.png',
      route: '/dashboard/directory',
      module: '*',
      stats: [
        { label: 'Search', value: 'Live' },
        { label: 'All Staff', value: '✓' }
      ]
    },
    {
      title: 'Meeting Notes',
      description: 'Record and share meeting minutes with the team',
      iconSrc: '/icons/files.png',
      route: '/dashboard/meetings',
      module: '*',
      stats: [
        { label: 'Minutes', value: 'Shared' },
        { label: 'Archive', value: '✓' }
      ]
    },
    {
      title: 'Expense Claims',
      description: 'Submit expense reimbursements and track approval status',
      iconSrc: '/icons/card.png',
      route: '/dashboard/expenses',
      module: '*',
      stats: [
        { label: 'Claims', value: 'Live' },
        { label: 'Approval', value: '✓' }
      ]
    },
    {
      title: 'Company Links',
      description: 'Quick access to important company resources and bookmarks',
      iconSrc: '/icons/social-media.png',
      route: '/dashboard/links',
      module: '*',
      stats: [
        { label: 'Resources', value: 'All' },
        { label: 'Categorized', value: '✓' }
      ]
    },
    {
      title: 'Face Scan Attendance',
      description: 'Mark attendance using face recognition — auto-detect and verify',
      iconSrc: '/icons/attendance.png',
      route: '/dashboard/face-attendance',
      module: '*',
      badge: 'Live',
      stats: [
        { label: 'Method', value: 'Face ID' },
        { label: 'Auto', value: '✓' }
      ]
    },
    {
      title: 'Activity Logs',
      description: 'Track blog publishing and admin activity in real-time',
      iconSrc: '/icons/log.png',
      route: '/dashboard/activity-logs',
      module: '*',
      stats: [
        { label: 'Realtime', value: '✓' },
        { label: 'API', value: 'Ready' }
      ]
    },
  ];

  const availableModules = modules.filter(module => {
    if (module.module === '*') return true;
    if (module.module === 'email_identity') {
      // Show for super_admin always, for others only if they have an email identity
      return adminProfile.role === 'super_admin' || true; // Will be filtered in the page itself
    }
    if (module.module === 'super_admin_only') return adminProfile.role === 'super_admin';
    if (module.module === 'hr_admin_only') return (adminProfile.role as string) === 'hr_admin' || adminProfile.role === 'super_admin';
    if (module.module === 'social_admin') return adminProfile.role === 'social_admin' || adminProfile.role === 'super_admin';
    return hasPermission(module.module);
  });

  // Custom ordering for System Modules section
  const moduleOrderPriority: string[] = [
    'Attendance Tracker',
    'Daily Standups',
    'Analytics Dashboard',
    'Admin Management',
    'Employee Management',
    'Leave Management',
    'Email Management',
    'Face Scan Attendance',
  ];
  availableModules.sort((a, b) => {
    const ia = moduleOrderPriority.indexOf(a.title);
    const ib = moduleOrderPriority.indexOf(b.title);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const availableDataEntryCards = dataEntryCards.filter(card => card.visible);

  const renderActiveSection = () => {
    if (!activeSection) return null;

    const handleCloseSection = () => {
      setActiveSection(null);
      setEditingItem(null);
    };

    return (
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {activeSection === 'esports' && 'Clients & Customers Management'}
            {activeSection === 'social' && 'Client Requests Management'}
            {activeSection === 'trading' && 'Trading Users Management'}
            {activeSection === 'betting' && 'Betting Events Management'}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleCloseSection}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {activeSection === 'esports' && (
              <EsportsPlayerForm 
                onPlayerAdded={() => { fetchRoleSpecificData(); fetchRealDashboardStats(); }} 
                editingPlayer={editingItem?.type === 'esports' ? editingItem : undefined}
                onCancelEdit={() => setEditingItem(null)}
              />
            )}
            {activeSection === 'social' && (
              <SocialMediaOrderForm 
                onOrderAdded={() => { fetchRoleSpecificData(); fetchRealDashboardStats(); }}
                editingOrder={editingItem?.type === 'social' ? editingItem : undefined}
                onCancelEdit={() => setEditingItem(null)}
              />
            )}

            {/* Data Table */}
            {activeData.filter(item => item.type === activeSection).length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Recent {activeSection} Data</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Details</TableHead>
                      <TableHead>Amount/Revenue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeData
                      .filter(item => item.type === activeSection)
                      .slice(0, 10)
                      .map((item) => (
                        <TableRow key={`${item.type}-${item.id}`}>
                          <TableCell>
                            {item.type === 'esports' && `${item.player_name} - ${item.tournament_name}`}
                            {item.type === 'social' && `${item.service_type} ${item.order_type}`}
                            {item.type === 'trading' && `${item.user_name} (${item.email || 'No email'})`}
                            {item.type === 'betting' && `${item.user_name} - ${item.event_name}`}
                          </TableCell>
                          <TableCell>
                            {item.type === 'esports' && `₹${item.entry_fees}`}
                            {item.type === 'social' && `₹${item.payment_amount}`}
                            {item.type === 'trading' && `₹${item.wallet_balance}`}
                            {item.type === 'betting' && `₹${item.fees_paid}`}
                          </TableCell>
                          <TableCell>
                            {(item.payment_received !== undefined) && (
                              <Badge variant={item.payment_received ? "default" : "secondary"}>
                                {item.payment_received ? "Paid" : "Pending"}
                              </Badge>
                            )}
                            {item.type === 'trading' && <Badge variant="default">Active</Badge>}
                          </TableCell>
                          <TableCell>
                            {new Date(item.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingItem(item)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(item)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render mobile dashboard for mobile devices
  if (isMobile) {
    return (
      <>
        <Header />
        <MobileDashboard adminProfile={adminProfile} dashboardStats={dashboardStats} />
      </>
    );
  }

  return (
    <>
      <Header />
      <MeetingPopup />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 typewriter-welcome">
              Welcome Back, {displayProfile.name} 🩵
            </h1>
            <p className="text-muted-foreground">
              Manage your {displayProfile.role.replace('_', ' ')} dashboard and access your authorized modules
            </p>
          </div>
          {/* Live Updates pill — no arrow */}
          <div className="hidden md:inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-white/15 bg-black/60 px-4 py-2.5 text-sm text-white/90 shadow-sm">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse" />
            <RefreshCw className="w-3.5 h-3.5 text-white/70 animate-spin [animation-duration:3s]" />
            <span className="font-medium">Live Updates</span>
          </div>
        </div>

        {/* Show a global Holiday banner on the dashboard whenever today is marked as a holiday. */}
        {(() => {
          const today = new Date();
          const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          if (!holidayDates.includes(ymd)) return null;
          return (
            <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-black p-4 sm:p-6 mb-8">
              <div className="flex items-center gap-4">
                {displayProfile.avatar ? (
                  <img src={displayProfile.avatar} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20 text-lg font-black text-primary">
                    {(displayProfile.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xl font-black uppercase tracking-wide text-white">{displayProfile.name}</div>
                  <div className="text-sm text-gray-400">{displayProfile.role}</div>
                </div>
              </div>
              <div className="mt-4 divide-y divide-gray-800 rounded-xl border border-gray-800 bg-black/40">
                {[{ label: 'Check-in' }, { label: 'Check-out' }, { label: 'Work log' }].map(r => (
                  <div key={r.label} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">📄</div>
                      <span className="text-base font-medium text-white">{r.label}</span>
                    </div>
                    <div className="grid h-8 w-8 place-items-center rounded-full border-2 border-red-500 text-red-500">✕</div>
                  </div>
                ))}
              </div>
              <HolidayCard />
            </div>
          );
        })()}

        {/* Daily Tasks & Activity Summary Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div style={{ animation: 'slideInLeft 0.8s ease-out 0.1s backwards' }} className="stagger-item-1">
            <DailyTodos />
          </div>
          <div style={{ animation: 'slideInRight 0.8s ease-out 0.1s backwards' }} className="stagger-item-2">
            <ActivitySummary />
          </div>
        </div>
        {/* Overview stats */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: 'Team Members', value: dashboardStats.totalEmployees, delay: '0.1s', icon: '/icons/profile.png' },
              { label: 'Employees', value: dashboardStats.totalEmployees, delay: '0.2s', icon: '/icons/admin.png' }
            ].map((stat, idx) => (
              <div
              key={idx}
              style={{ animation: 'fadeInUp 0.6s ease-out', animationDelay: stat.delay }}
              className="p-5 rounded-xl border border-white/15 bg-black hover:border-white/30 group cursor-pointer relative overflow-hidden transition-all duration-300"
              >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                <img src={stat.icon} alt={stat.label} className="h-10 w-10 text-white" />
                <h3 className="text-sm font-medium text-white/60">{stat.label}</h3>
                </div>
                <p className="text-3xl font-bold text-white-400">{stat.value}</p>
                <p className="mt-1 text-xs text-emerald-400/90">vs last month</p>
              </div>
              </div>
            ))}
          </div>
        </div>

        {/* Super Admin Review Panel — compact strip under the overview */}
        {adminProfile?.role === 'super_admin' && (
          <div className="mb-12" style={{ animation: 'slideInUp 0.8s ease-out' }}>
            <SuperAdminReviewPanel />
          </div>
        )}

        {/* Active Section */}
        {renderActiveSection()}

        {/* Data Entry Cards */}
        {availableDataEntryCards.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-white">Data Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {availableDataEntryCards.map((card, index) => (
                <div
                  key={index}
                  style={{ animation: 'fadeInUp 0.6s ease-out', animationDelay: `${0.1 * (index + 1)}s` }}
                >
                  <DashboardCard
                    title={card.title}
                    description={card.description}
                    iconSrc={card.iconSrc}
                    onClick={() => navigate(card.route)}
                    stats={card.stats}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dashboard Cards Grid */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-6 text-white">Modules</h2>
          <p className="text-muted-foreground text-sm mb-4">
            12 grouped modules. Open any group to see its tools.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {MODULE_GROUPS
              .filter((g) => isHubVisibleForRole(g, adminProfile.role as string))
              .map((group) => (
                <DashboardCard
                  key={group.id}
                  title={group.title}
                  description={group.description}
                  iconSrc={group.iconSrc}
                  badge={group.badge}
                  onClick={() => navigate(`/dashboard/hub/${group.id}`)}
                  stats={[
                    { label: 'Tools', value: (isHubVisibleForRole(group, adminProfile.role as string) || []).length },
                    { label: 'Open', value: 'Tap to view' },
                  ]}
                />
              ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;

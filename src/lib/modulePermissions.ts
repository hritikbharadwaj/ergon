import { supabase } from '@/integrations/supabase/client';

export type ModulePermissionDef = {
  key: string;
  label: string;
  description: string;
  defaultRoles?: string[];
};

export const MODULE_PERMISSIONS: ModulePermissionDef[] = [
  { key: 'overview', label: 'Overview', description: 'Dashboard overview and summary analytics', defaultRoles: ['super_admin'] },
  { key: 'attendance', label: 'Attendance Tracker', description: 'View attendance, check-in/out records and exports', defaultRoles: ['super_admin', 'hr_admin'] },
  { key: 'face_attendance', label: 'Face Attendance', description: 'Face scan check-in and checkout attendance', defaultRoles: ['super_admin', 'hr_admin', 'social_admin', 'tech_admin', 'content_admin', 'esports_admin'] },
  { key: 'work_log', label: 'Work Log Entry', description: 'Submit daily work logs', defaultRoles: ['super_admin', 'hr_admin', 'social_admin', 'tech_admin', 'content_admin'] },
  { key: 'work_logs', label: 'Work Logs', description: 'View/search/export work logs', defaultRoles: ['super_admin', 'hr_admin', 'social_admin', 'tech_admin', 'content_admin'] },
  { key: 'work_given', label: 'Work Given', description: 'Create and download assigned work PDFs', defaultRoles: ['super_admin', 'hr_admin'] },
  { key: 'meetings', label: 'Start Meeting', description: 'Start/end standup meetings and meeting controls', defaultRoles: ['super_admin', 'hr_admin'] },
  { key: 'standups', label: 'Daily Standups', description: 'Daily standup logs and meeting join panel', defaultRoles: ['super_admin', 'hr_admin', 'social_admin', 'tech_admin', 'content_admin', 'esports_admin'] },
  { key: 'clients', label: 'Clients CRM', description: 'Client data, status updates and exports', defaultRoles: ['super_admin', 'social_admin'] },
  { key: 'performance', label: 'Performance Scores', description: 'Performance rankings and PDF reports', defaultRoles: ['super_admin', 'hr_admin'] },
  { key: 'payroll', label: 'Payroll', description: 'Salary records and PDF salary slips', defaultRoles: ['super_admin', 'hr_admin'] },
  { key: 'admin_management', label: 'Admin Management', description: 'Admin accounts and module authorities', defaultRoles: ['super_admin'] },
  { key: 'settings', label: 'System Settings', description: 'Attendance/work-log windows and app settings', defaultRoles: ['super_admin'] },
  { key: 'email_composer', label: 'Email Composer', description: 'Send branded emails to admins', defaultRoles: ['super_admin', 'hr_admin'] },
  { key: 'engagement', label: 'Engagement Analytics', description: 'Clicks, meeting joins and section time analytics', defaultRoles: ['super_admin', 'hr_admin'] },
];

export const DEFAULT_MODULES_BY_ROLE = MODULE_PERMISSIONS.reduce<Record<string, Set<string>>>((acc, mod) => {
  (mod.defaultRoles || []).forEach((role) => {
    acc[role] ||= new Set<string>();
    acc[role].add(mod.key);
  });
  return acc;
}, {});

export const roleHasDefaultModule = (role: string | undefined, moduleKey: string) => {
  if (!role) return false;
  if (role === 'super_admin') return true;
  return Boolean(DEFAULT_MODULES_BY_ROLE[role]?.has(moduleKey));
};

export const canAccessModule = async (userId: string | undefined, role: string | undefined, moduleKey: string) => {
  if (!userId) return false;
  if (role === 'super_admin') return true;
  const { data } = await supabase.rpc('admin_has_module_permission', { _user_id: userId, _module_key: moduleKey } as any);
  return Boolean(data) || roleHasDefaultModule(role, moduleKey);
};

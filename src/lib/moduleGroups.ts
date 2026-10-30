import { rolePermissions } from '@/types/auth';

export interface HubChild {
  title: string;
  description: string;
  route: string;
  iconSrc: string;
  visible?: (role: string) => boolean;
  badge?: string;
}

export interface HubGroup {
  id: string;
  title: string;
  description: string;
  iconSrc: string;
  badge?: string;
  children: HubChild[];
}

const anyone = () => true;
const superOnly = (r: string) => r === 'super_admin';
const hrOrSuper = (r: string) => r === 'super_admin' || r === 'hr_admin';

export const MODULE_GROUPS: HubGroup[] = [
  {
    id: 'attendance-time',
    title: 'Attendance & Time',
    description: 'Check-in, face scan, work log, holidays and time windows.',
    iconSrc: '/icons/attendance.png',
    children: [
      { title: 'Attendance Tracker', description: 'Daily attendance & reports', route: '/dashboard/attendance', iconSrc: '/icons/attendance.png' },
      { title: 'Face Scan Attendance', description: 'Face recognition check-in', route: '/dashboard/face-attendance', iconSrc: '/icons/attendance.png' },
      { title: 'Work Log Entry', description: 'Submit daily work log', route: '/dashboard/work-log', iconSrc: '/icons/analytics.png' },
      { title: 'Holiday Calendar', description: 'Manage company holidays', route: '/dashboard/holidays', iconSrc: '/icons/attendance.png', visible: superOnly },
      { title: 'Time Management', description: 'Working windows & rules', route: '/dashboard/time-management', iconSrc: '/icons/attendance.png', visible: superOnly },
    ],
  },
  {
    id: 'work-tasks',
    title: 'Work & Tasks',
    description: 'Assignments, work logs, tasks, standups and meetings.',
    iconSrc: '/icons/trade.png',
    children: [
      { title: 'Work Given', description: 'Tasks assigned to you', route: '/dashboard/work-given', iconSrc: '/icons/stat.png' },
      { title: 'Work Logs', description: 'Full work-log history', route: '/dashboard/work-logs', iconSrc: '/icons/analytics.png' },
      { title: 'Task Board', description: 'Kanban board', route: '/dashboard/tasks', iconSrc: '/icons/trade.png' },
      { title: 'Daily Standups', description: 'Quick daily updates', route: '/dashboard/standups', iconSrc: '/icons/chat.png' },
      { title: 'Meeting Notes', description: 'Minutes & archive', route: '/dashboard/meetings', iconSrc: '/icons/files.png' },
    ],
  },
  {
    id: 'people-hr',
    title: 'People & HR',
    description: 'Employees, admins, leave, payroll and directory.',
    iconSrc: '/icons/admin.png',
    children: [
      { title: 'Employee Management', description: 'Records & documents', route: '/dashboard/employees', iconSrc: '/icons/admin.png', visible: superOnly },
      { title: 'Admin Management', description: 'Admin accounts & roles', route: '/dashboard/admin-management', iconSrc: '/icons/admin.png', visible: superOnly },
      { title: 'Leave Management', description: 'Apply and track leave', route: '/dashboard/leave', iconSrc: '/icons/attendance.png' },
      { title: 'Payroll', description: 'Salary slips (PDF)', route: '/dashboard/payroll', iconSrc: '/icons/stat.png' },
      { title: 'Birthday Reminders', description: 'Upcoming birthdays', route: '/dashboard/birthdays', iconSrc: '/icons/certificate.png' },
      { title: 'Company Directory', description: 'Team directory', route: '/dashboard/directory', iconSrc: '/icons/admin.png' },
      { title: 'Employee Profile', description: 'Your profile', route: '/dashboard/employee-profile', iconSrc: '/icons/admin.png' },
    ],
  },
  {
    id: 'communication',
    title: 'Communication',
    description: 'Chat, announcements, notifications, email and notices.',
    iconSrc: '/icons/chat.png',
    children: [
      { title: 'Team Chat', description: 'Real-time chat', route: '/dashboard/chat', iconSrc: '/icons/chat.png' },
      { title: 'Announcements', description: 'Company updates', route: '/dashboard/announcements', iconSrc: '/icons/active.png' },
      { title: 'Notification Center', description: 'Alerts & updates', route: '/dashboard/notifications', iconSrc: '/icons/active.png' },
      { title: 'Email Management', description: 'Send professional email', route: '/dashboard/email', iconSrc: '/icons/chat.png' },
      { title: 'Email Composer', description: 'Compose branded emails', route: '/dashboard/email-composer', iconSrc: '/icons/chat.png' },
      { title: 'Notice Broadcast', description: 'Bulk NOTICE email', route: '/dashboard/notice-broadcast', iconSrc: '/icons/chat.png', visible: superOnly },
    ],
  },
  {
    id: 'clients-business',
    title: 'Clients & Business',
    description: 'Clients, payments and expenses.',
    iconSrc: '/icons/card.png',
    children: [
      { title: 'Clients & Customers', description: 'Customer records, relationships & enquiries', route: '/dashboard/clients', iconSrc: '/icons/stat.png' },
      { title: 'Payment Verification', description: 'Verify payments', route: '/dashboard/payments', iconSrc: '/icons/card.png' },
      { title: 'Expense Claims', description: 'Reimbursements', route: '/dashboard/expenses', iconSrc: '/icons/card.png' },
      { title: 'Certificate Manager', description: 'Issue certificates', route: '/dashboard/certificates', iconSrc: '/icons/certificate.png', visible: superOnly },
      { title: 'Internship Tracker', description: 'Manage interns', route: '/dashboard/internships', iconSrc: '/icons/internship.png', visible: superOnly },
    ],
  },
  {
    id: 'insights',
    title: 'Insights',
    description: 'Analytics and reports.',
    iconSrc: '/icons/analytics.png',
    children: [
      { title: 'Overview Stats', description: 'Summary cards', route: '/dashboard/overview', iconSrc: '/icons/analytics.png' },
      { title: 'Analytics Dashboard', description: 'Revenue & growth', route: '/dashboard/analytics', iconSrc: '/icons/stat.png' },
      { title: 'Engagement Analytics', description: 'Clicks & heatmap', route: '/dashboard/engagement', iconSrc: '/icons/stat.png' },
      { title: 'Performance Scores', description: 'Rankings', route: '/dashboard/performance', iconSrc: '/icons/analytics.png' },
      { title: 'Admin Reports', description: 'Per-admin reports', route: '/dashboard/reports', iconSrc: '/icons/files.png', visible: superOnly },
      { title: 'Activity Logs', description: 'Blog & admin activity', route: '/dashboard/activity-logs', iconSrc: '/icons/log.png' },
      { title: 'Audit Logs', description: 'System audit trail', route: '/dashboard/audit-logs', iconSrc: '/icons/log.png', visible: superOnly },
    ],
  },
  {
    id: 'feedback-culture',
    title: 'Feedback & Culture',
    description: 'Polls and feedbacks.',
    iconSrc: '/icons/social-media.png',
    children: [
      { title: 'Polls & Surveys', description: 'Gather opinions', route: '/dashboard/polls', iconSrc: '/icons/stat.png' },
      { title: 'Feedback', description: 'Suggestions & bugs', route: '/dashboard/feedback', iconSrc: '/icons/social-media.png' },
      { title: 'Team Events', description: 'Events calendar', route: '/dashboard/events', iconSrc: '/icons/attendance.png' },
      { title: 'Quick Notes', description: 'Personal sticky notes', route: '/dashboard/notes', iconSrc: '/icons/files.png' },
    ],
  },
  {
    id: 'files',
    title: 'Files',
    description: 'File manager and bulk upload.',
    iconSrc: '/icons/folder.png',
    children: [
      { title: 'File Manager', description: 'Files & media', route: '/dashboard/files', iconSrc: '/icons/folder.png' },
      { title: 'Bulk Upload', description: 'CSV / Excel import', route: '/dashboard/bulk-upload', iconSrc: '/icons/files.png' },
    ],
  },
  {
    id: 'hr-dashboard',
    title: 'HR Dashboard',
    description: 'HR with employees and interns.',
    iconSrc: '/icons/admin.png',
    children: [
      { title: 'HR Dashboard', description: 'HR landing', route: '/dashboard/hr', iconSrc: '/icons/admin.png', visible: hrOrSuper },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Personal settings and preferences.',
    iconSrc: '/icons/stat.png',
    children: [
      { title: 'Settings', description: 'Preferences', route: '/dashboard/settings', iconSrc: '/icons/stat.png' },
    ],
  },
  {
    id: 'super-admin',
    title: 'Super Admin Console',
    description: 'Time rules and notice broadcast.',
    iconSrc: '/icons/admin.png',
    badge: 'Super Admin',
    children: [
      { title: 'Time Management', description: 'Windows & rules', route: '/dashboard/time-management', iconSrc: '/icons/attendance.png', visible: superOnly },
      { title: 'Notice Broadcast', description: 'Bulk NOTICE email', route: '/dashboard/notice-broadcast', iconSrc: '/icons/chat.png', visible: superOnly },
      { title: 'Admin Management', description: 'Manage admins', route: '/dashboard/admin-management', iconSrc: '/icons/admin.png', visible: superOnly },
      { title: 'Audit Logs', description: 'System audit', route: '/dashboard/audit-logs', iconSrc: '/icons/log.png', visible: superOnly },
    ],
  },
];

export const isHubVisibleForRole = (group: HubGroup, role: string) => {
  const children = group.children.filter(c => (c.visible ? c.visible(role) : true));
  return children.length > 0 ? children : null;
};

export const findHub = (id: string) => MODULE_GROUPS.find(g => g.id === id) || null;

// re-export for convenience
export { rolePermissions };
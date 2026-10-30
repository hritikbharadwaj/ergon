import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  title: string;
  url: string;
  iconSrc: string;
  superAdminOnly?: boolean;
}

const mainItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', iconSrc: '/icons/analytics.png' },
  { title: 'Attendance Tracker', url: '/dashboard/attendance', iconSrc: '/icons/attendance.png' },
  { title: 'Daily Standups', url: '/dashboard/standups', iconSrc: '/icons/chat.png' },
  { title: 'Analytics DB', url: '/dashboard/analytics', iconSrc: '/icons/stat.png' },
  { title: 'Admin Management', url: '/dashboard/admin-management', iconSrc: '/icons/admin.png', superAdminOnly: true },
  { title: 'Employee Management', url: '/dashboard/employees', iconSrc: '/icons/admin.png', superAdminOnly: true },
  { title: 'Leave Management', url: '/dashboard/leave', iconSrc: '/icons/attendance.png' },
  { title: 'Email Management', url: '/dashboard/email', iconSrc: '/icons/chat.png' },
  { title: 'Branded Email Composer', url: '/dashboard/email-composer', iconSrc: '/icons/chat.png', superAdminOnly: true },
  { title: 'Face Scan Attendance', url: '/dashboard/face-attendance', iconSrc: '/icons/attendance.png' },
];

const quickItems: NavItem[] = [
  { title: 'Team Chat', url: '/dashboard/chat', iconSrc: '/icons/chat.png' },
  { title: 'Notifications', url: '/dashboard/notifications', iconSrc: '/icons/active.png' },
  { title: 'Activity Logs', url: '/dashboard/activity-logs', iconSrc: '/icons/log.png' },
  { title: 'Settings', url: '/dashboard/settings', iconSrc: '/icons/folder.png' },
];

const AppSidebar: React.FC = () => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { adminProfile } = useAuth();
  const isSuperAdmin = adminProfile?.role === 'super_admin';

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (item: NavItem) => {
    if (item.superAdminOnly && !isSuperAdmin) return null;
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild tooltip={item.title}>
          <NavLink
            to={item.url}
            end
            className={({ isActive: a }) =>
              `flex items-center gap-3 px-2 py-2 rounded-md transition-all ${
                a || isActive(item.url)
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`
            }
          >
            <img
              src={item.iconSrc}
              alt={item.title}
              className="w-5 h-5 object-contain shrink-0"
              loading="lazy"
            />
            {!collapsed && <span className="text-sm truncate">{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-background border-r border-border/50">
        <SidebarGroup>
          <SidebarGroupLabel>System Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Quick Access</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{quickItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
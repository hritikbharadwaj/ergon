export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  lastLogin?: Date;
  isActive: boolean;
}

export type UserRole = 
  | 'super_admin'
  | 'social_admin'
  | 'esports_admin'
  | 'tech_admin'
  | 'content_admin'
  | 'hr_admin';

export type UserStatus = 'active' | 'suspended' | 'invited' | 'inactive';

export interface UserSessionMeta {
  ipAddress?: string;
  userAgent?: string;
  loginTime: string;
  geolocation?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

export const rolePermissions: Record<UserRole, string[]> = {
  super_admin: ['*'],
  social_admin: ['social', 'orders', 'inventory', 'analytics'],
  esports_admin: ['esports', 'tournaments', 'analytics'],
  tech_admin: ['tech', 'development', 'analytics'],
  content_admin: ['content', 'media', 'analytics'],
  hr_admin: ['employees', 'internships', 'certificates', 'careers', 'holidays', 'analytics']
};

export const roleNames: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  social_admin: 'Client Operations Admin',
  esports_admin: 'Business Operations Admin',
  tech_admin: 'Tech Admin',
  content_admin: 'Content Admin',
  hr_admin: 'HR Admin'
};

/**
 * Type guard to check if role is super_admin
 */
export function isSuperAdmin(role?: string | null): boolean {
  return role === 'super_admin';
}

/**
 * Check if a role has access to a specific permission scope
 */
export function hasPermission(role: UserRole | string | undefined | null, permission: string): boolean {
  if (!role) return false;
  const permissions = rolePermissions[role as UserRole];
  if (!permissions) return false;
  return permissions.includes('*') || permissions.includes(permission);
}

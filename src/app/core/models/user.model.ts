// 👤 NetoInsight - User Model

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
  avatarUrl?: string;
  isInternal: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  VIEWER = 'viewer',
  INTERNAL = 'internal'
}

export interface Tenant {
  id: string;
  name: string;
  logoUrl?: string;
  tableauGroup: string;
  isActive: boolean;
}

export interface UserSession {
  user: User;
  tenant: Tenant;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}
// 👤 NetoInsight - User Model (Actualizado con Firebase)

export interface User {
  uid: string;              // ← Firebase UID
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
  avatarUrl?: string;
  isInternal: boolean;
  mfaEnabled: boolean;      // ← Nuevo campo
  createdAt: Date;
  lastLogin?: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  VIEWER = 'viewer',
  INTERNAL = 'internal'
}

export interface Tenant {
  id: string;
  name: string;
  displayName: string;
  logoUrl?: string;
  tableauGroup: string;
  isActive: boolean;
  maxUsers: number;
  currentUsers: number;
}

export interface UserSession {
  user: User;
  tenant: Tenant;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}
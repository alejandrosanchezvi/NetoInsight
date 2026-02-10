// 👤 NetoInsight - User Model (Actualizado)

export interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
  avatarUrl?: string;
  isInternal: boolean;
  isActive: boolean;       // ← Nuevo campo
  mfaEnabled: boolean;
  createdAt: Date;
  lastLogin?: Date;
  invitationId?: string;   
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
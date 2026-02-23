// 📧 NetoInsight - Invitation Model

import { UserRole } from './user.model';

export interface Invitation {
  // Identificación
  id: string;
  
  // Datos del invitado
  email: string;
  role: UserRole;
  
  // Relación con tenant
  tenantId: string;
  tenantName: string;
  
  // Token y estado
  token: string;
  status: InvitationStatus;
  
  // Timestamps
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  
  // Quién invitó
  invitedBy: string;      // UID del usuario que invitó
  invitedByEmail: string; // Email del usuario que invitó
  invitedByName: string; // Nombre del usuario que invitó
  
  // Metadata
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    resendCount?: number;
    lastResent?: Date;
  };
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

/**
 * DTO para crear una invitación
 */
export interface CreateInvitationDTO {
  email: string;
  role: UserRole;
  tenantId: string;
}

/**
 * DTO para aceptar una invitación
 */
export interface AcceptInvitationDTO {
  token: string;
  password: string;
  name: string;
}

/**
 * Respuesta al validar un token
 */
export interface ValidateInvitationResponse {
  valid: boolean;
  invitation?: Invitation;
  error?: string;
}
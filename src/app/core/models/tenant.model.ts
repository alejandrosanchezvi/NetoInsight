// 🏢 NetoInsight - Tenant Model

export interface Tenant {
  // Identificación
  tenantId: string;
  proveedorIdInterno: string;
  name: string;
  legalName: string;
  rfc?: string;
  
  // Plan y Licencias
  plan: TenantPlan;
  maxLicenses: number;
  usedLicenses: number;
  
  // Features
  features: TenantFeatures;
  
  // Integración Tableau
  tableauGroup: string;
  tableauSiteId?: string;
  
  // Integración BigQuery
  bigQueryDataset?: string;
  bigQueryFilter?: string;
  
  // Estado
  isActive: boolean;
  contractStart?: Date;
  contractEnd?: Date;
  
  // Contacto
  adminEmail?: string;
  billingEmail?: string;
  
  // Auditoría
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export enum TenantPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  INTERNAL = 'internal'
}

export interface TenantFeatures {
  dashboards: string[];  // IDs de dashboards permitidos
  exports: boolean;
  api: boolean;
  customReports: boolean;
}

/**
 * DTO para crear un nuevo tenant
 */
export interface CreateTenantDTO {
  proveedorIdInterno: string;
  name: string;
  legalName: string;
  rfc?: string;
  plan: TenantPlan;
  maxLicenses: number;
  features: TenantFeatures;
  tableauGroup: string;
  adminEmail?: string;
  billingEmail?: string;
}

/**
 * DTO para actualizar un tenant
 */
export interface UpdateTenantDTO {
  name?: string;
  legalName?: string;
  rfc?: string;
  plan?: TenantPlan;
  maxLicenses?: number;
  features?: Partial<TenantFeatures>;
  isActive?: boolean;
  contractEnd?: Date;
  adminEmail?: string;
  billingEmail?: string;
}

/**
 * Estadísticas de uso del tenant
 */
export interface TenantUsageStats {
  tenantId: string;
  tenantName: string;
  totalUsers: number;
  activeUsers: number;
  licensesUsed: number;
  licensesAvailable: number;
  licensesPercentage: number;
  lastActivity?: Date;
}
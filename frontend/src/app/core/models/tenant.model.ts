// 🏢 NetoInsight - Tenant Model (ACTUALIZADO CON TRIAL)

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
  
  // Trial (solo para plan trial)
  trialEndsAt?: Date;  // ← NUEVO: Fecha de expiración del trial
  
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
  contractStart?: string;
  contractEnd?: string;
  
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
  TRIAL = 'trial',        // ← NUEVO: Prueba 30 días, 1 licencia
  STARTER = 'starter',    // ← NUEVO: 5 licencias permanente
  PRO = 'pro',            // 10 licencias permanente
  ENTERPRISE = 'enterprise', // 25 licencias permanente
  INTERNAL = 'internal'   // 100 licencias (solo Neto)
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
  bigQueryDataset?: string; 
  bigQueryFilter?: string; 
  adminEmail?: string;
  billingEmail?: string;
  contractStart?: Date;
  contractEnd?: Date;
  trialEndsAt?: Date;  // ← NUEVO: Para plan trial
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
  tableauGroup?: string;  
  bigQueryDataset?: string; 
  bigQueryFilter?: string; 
  isActive?: boolean;
  adminEmail?: string;
  billingEmail?: string;
  contractStart?: string;  
  contractEnd?: string;
  trialEndsAt?: Date;  // ← NUEVO: Para actualizar fecha de trial
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

/**
 * Configuración de planes
 */
export interface PlanConfig {
  value: TenantPlan;
  label: string;
  maxLicenses: number;
  trialDays?: number;  // Solo para trial
  description: string;
  price?: string;  // Opcional para mostrar precio
}

/**
 * Planes disponibles
 */
export const PLAN_CONFIGS: PlanConfig[] = [
  {
    value: TenantPlan.TRIAL,
    label: 'Prueba Gratis',
    maxLicenses: 1,
    trialDays: 30,
    description: '30 días de prueba con 1 usuario',
    price: 'Gratis'
  },
  {
    value: TenantPlan.STARTER,
    label: 'Starter',
    maxLicenses: 5,
    description: 'Ideal para equipos pequeños',
    price: 'Permanente'
  },
  {
    value: TenantPlan.PRO,
    label: 'Pro',
    maxLicenses: 10,
    description: 'Para equipos en crecimiento',
    price: 'Permanente'
  },
  {
    value: TenantPlan.ENTERPRISE,
    label: 'Enterprise',
    maxLicenses: 25,
    description: 'Para organizaciones grandes',
    price: 'Permanente'
  },
  {
    value: TenantPlan.INTERNAL,
    label: 'Interno',
    maxLicenses: 100,
    description: 'Solo para uso interno de Neto',
    price: 'Ilimitado'
  }
];

/**
 * Verificar si un tenant está en trial activo
 */
export function isTenantTrialActive(tenant: Tenant): boolean {
  if (tenant.plan !== TenantPlan.TRIAL) return false;
  if (!tenant.trialEndsAt) return false;
  
  const now = new Date();
  const trialEnd = new Date(tenant.trialEndsAt);
  
  return now < trialEnd;
}

/**
 * Obtener días restantes de trial
 */
export function getTenantTrialDaysLeft(tenant: Tenant): number {
  if (tenant.plan !== TenantPlan.TRIAL || !tenant.trialEndsAt) return 0;
  
  const now = new Date();
  const trialEnd = new Date(tenant.trialEndsAt);
  const diffMs = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}
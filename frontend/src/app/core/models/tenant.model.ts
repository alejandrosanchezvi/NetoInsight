// 🏢 NetoInsight - Tenant Model v2.0 — Suscripciones + Control de Acceso

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

  // ── Suscripción (unificado) ──────────────────────────────────
  // Reemplaza `trialEndsAt`. Aplica a TODOS los planes.
  // null / undefined = sin fecha de vencimiento (acceso permanente)
  subscriptionEnd?: Date;
  subscriptionDuration?: SubscriptionDuration; // para referencia visual

  // Legacy — mantener por compatibilidad con docs existentes en Firestore
  trialEndsAt?: Date;

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
  TRIAL = 'trial',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  INTERNAL = 'internal'
}

export type SubscriptionDuration = '30d' | '3m' | '6m' | '1y';

export interface TenantFeatures {
  dashboards: string[];
  exports: boolean;
  api: boolean;
  customReports: boolean;
}

// ─────────────────────────────────────────────────────────────
//  OPCIONES DE SUSCRIPCIÓN
// ─────────────────────────────────────────────────────────────

export interface SubscriptionOption {
  value: SubscriptionDuration;
  label: string;
  days: number;
  description: string;
}

export const SUBSCRIPTION_OPTIONS: SubscriptionOption[] = [
  { value: '30d', label: '30 días (Trial)', days: 30, description: 'Período de prueba' },
  { value: '3m', label: '3 meses', days: 90, description: 'Trimestral' },
  { value: '6m', label: '6 meses', days: 180, description: 'Semestral' },
  { value: '1y', label: '1 año', days: 365, description: 'Anual' },
];

// ─────────────────────────────────────────────────────────────
//  DTOs
// ─────────────────────────────────────────────────────────────

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
  // nuevo
  subscriptionEnd?: Date;
  subscriptionDuration?: SubscriptionDuration;
  // legacy
  trialEndsAt?: Date;
}

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
  // nuevo
  subscriptionEnd?: Date | null;
  subscriptionDuration?: SubscriptionDuration | null;
  // legacy
  trialEndsAt?: Date;
}

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

// ─────────────────────────────────────────────────────────────
//  PLAN CONFIGS
// ─────────────────────────────────────────────────────────────

export interface PlanConfig {
  value: TenantPlan;
  label: string;
  maxLicenses: number;
  trialDays?: number;
  description: string;
  price?: string;
}

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
    maxLicenses: 1,
    description: 'Ideal para equipos pequeños',
    price: 'Permanente'
  },
  {
    value: TenantPlan.PRO,
    label: 'Pro',
    maxLicenses: 3,
    description: 'Para equipos en crecimiento',
    price: 'Permanente'
  },
  {
    value: TenantPlan.ENTERPRISE,
    label: 'Enterprise',
    maxLicenses: 5,
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

// ─────────────────────────────────────────────────────────────
//  HELPERS DE ACCESO
// ─────────────────────────────────────────────────────────────

/**
 * Regla maestra de acceso.
 * Internos SIEMPRE pasan. Todos los demás se bloquean si:
 *   - isActive === false
 *   - subscriptionEnd existe y ya venció
 *   - (legacy) trialEndsAt existe y ya venció (solo plan trial)
 */
export function isTenantAccessAllowed(tenant: Tenant): boolean {
  // Internos nunca se bloquean
  if (tenant.plan === TenantPlan.INTERNAL) return true;

  // Apagado manual
  if (!tenant.isActive) return false;

  const now = new Date();

  // Nuevo campo unificado
  if (tenant.subscriptionEnd) {
    return now < new Date(tenant.subscriptionEnd);
  }

  // Fallback legacy: trialEndsAt (solo trial)
  if (tenant.plan === TenantPlan.TRIAL && tenant.trialEndsAt) {
    return now < new Date(tenant.trialEndsAt);
  }

  // Sin fecha de vencimiento → acceso permitido
  return true;
}

/**
 * Razón del bloqueo (para mostrar mensaje apropiado)
 */
export type AccessBlockReason = 'inactive' | 'trial_expired' | 'subscription_expired' | null;

export function getAccessBlockReason(tenant: Tenant): AccessBlockReason {
  if (tenant.plan === TenantPlan.INTERNAL) return null;
  if (!tenant.isActive) return 'inactive';

  const now = new Date();

  if (tenant.subscriptionEnd && now >= new Date(tenant.subscriptionEnd)) {
    return tenant.plan === TenantPlan.TRIAL ? 'trial_expired' : 'subscription_expired';
  }

  if (tenant.plan === TenantPlan.TRIAL && tenant.trialEndsAt && now >= new Date(tenant.trialEndsAt)) {
    return 'trial_expired';
  }

  return null;
}

/**
 * Días restantes de suscripción (funciona con ambos campos)
 */
export function getSubscriptionDaysLeft(tenant: Tenant): number {
  if (tenant.plan === TenantPlan.INTERNAL) return 9999;

  const endDate = tenant.subscriptionEnd ?? tenant.trialEndsAt;
  if (!endDate) return 9999; // sin vencimiento

  const diffMs = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Calcular nueva fecha de subscriptionEnd a partir de hoy
 */
export function calculateSubscriptionEnd(duration: SubscriptionDuration): Date {
  const opt = SUBSCRIPTION_OPTIONS.find(o => o.value === duration);
  const days = opt?.days ?? 30;
  const end = new Date();
  end.setDate(end.getDate() + days);
  return end;
}

// ─────────────────────────────────────────────────────────────
//  LEGACY helpers (compatibilidad)
// ─────────────────────────────────────────────────────────────

/** @deprecated usar isTenantAccessAllowed */
export function isTenantTrialActive(tenant: Tenant): boolean {
  if (tenant.plan !== TenantPlan.TRIAL) return false;
  const endDate = tenant.subscriptionEnd ?? tenant.trialEndsAt;
  if (!endDate) return false;
  return new Date() < new Date(endDate);
}

/** @deprecated usar getSubscriptionDaysLeft */
export function getTenantTrialDaysLeft(tenant: Tenant): number {
  return getSubscriptionDaysLeft(tenant);
}
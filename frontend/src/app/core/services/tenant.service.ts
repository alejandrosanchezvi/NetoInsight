// 🏢 NetoInsight - Tenant Service v2.0 — Con renovación de suscripción

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection, doc,
  getDoc, getDocs,
  setDoc, updateDoc,
  query, where, orderBy,
  serverTimestamp, increment, Timestamp,
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import {
  Tenant, CreateTenantDTO, UpdateTenantDTO, TenantUsageStats,
  SubscriptionDuration, calculateSubscriptionEnd
} from '../models/tenant.model';

@Injectable({ providedIn: 'root' })
export class TenantService {

  private firestore = inject(Firestore);
  private currentTenantSubject = new BehaviorSubject<Tenant | null>(null);
  public currentTenant$ = this.currentTenantSubject.asObservable();

  constructor() {
    console.log('🏢 [TENANT] TenantService v2.0 initialized');
  }

  // ─────────────────────────────────────────────────────────────
  //  LECTURA
  // ─────────────────────────────────────────────────────────────

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    try {
      const snap = await getDoc(doc(this.firestore, 'tenants', tenantId));
      if (!snap.exists()) return null;
      return this.mapDocToTenant(snap.id, snap.data());
    } catch (e) {
      console.error('❌ [TENANT] getTenantById:', e);
      throw e;
    }
  }

  async getAllTenants(): Promise<Tenant[]> {
    try {
      const q = query(collection(this.firestore, 'tenants'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => this.mapDocToTenant(d.id, d.data()));
    } catch (e) {
      console.error('❌ [TENANT] getAllTenants:', e);
      throw e;
    }
  }

  async getActiveTenants(): Promise<Tenant[]> {
    try {
      const q = query(
        collection(this.firestore, 'tenants'),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => this.mapDocToTenant(d.id, d.data()));
    } catch (e) {
      console.error('❌ [TENANT] getActiveTenants:', e);
      throw e;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  CREAR
  // ─────────────────────────────────────────────────────────────

  async createTenant(data: CreateTenantDTO, createdBy?: string): Promise<Tenant> {
    console.log('🏢 [TENANT] Creating:', data.name);
    try {
      const tenantId = `tenant-${data.name.toLowerCase().replace(/\s+/g, '-')}`;
      const ref = doc(this.firestore, 'tenants', tenantId);

      const existing = await getDoc(ref);
      if (existing.exists()) throw new Error('Ya existe un proveedor con ese nombre');

      const tenantData: any = {
        tenantId,
        proveedorIdInterno: data.proveedorIdInterno,
        name: data.name,
        plan: data.plan,
        maxLicenses: data.maxLicenses,
        usedLicenses: 0,
        features: data.features,
        tableauGroup: data.tableauGroup,
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: createdBy || 'system',
        adminEmail: data.adminEmail,
      };

      // Campos opcionales
      if (data.legalName) tenantData.legalName = data.legalName;
      if (data.rfc) tenantData.rfc = data.rfc;
      if (data.bigQueryDataset) tenantData.bigQueryDataset = data.bigQueryDataset;
      if (data.bigQueryFilter) tenantData.bigQueryFilter = data.bigQueryFilter;
      if (data.billingEmail) tenantData.billingEmail = data.billingEmail;
      if (data.contractStart) tenantData.contractStart = data.contractStart;
      if (data.contractEnd) tenantData.contractEnd = data.contractEnd;

      // Suscripción
      if (data.subscriptionEnd) {
        tenantData.subscriptionEnd = Timestamp.fromDate(data.subscriptionEnd);
      }
      if (data.subscriptionDuration) {
        tenantData.subscriptionDuration = data.subscriptionDuration;
      }
      // Legacy trialEndsAt
      if (data.trialEndsAt) {
        tenantData.trialEndsAt = Timestamp.fromDate(data.trialEndsAt);
      }

      await setDoc(ref, tenantData);
      console.log('✅ [TENANT] Created:', tenantId);
      return (await this.getTenantById(tenantId))!;

    } catch (e) {
      console.error('❌ [TENANT] createTenant:', e);
      throw e;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  ACTUALIZAR
  // ─────────────────────────────────────────────────────────────

  async updateTenant(tenantId: string, data: UpdateTenantDTO, updatedBy: string): Promise<void> {
    try {
      const updateData: any = {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy,
      };

      // Convertir Date → Timestamp para Firestore
      if (data.subscriptionEnd instanceof Date) {
        updateData.subscriptionEnd = Timestamp.fromDate(data.subscriptionEnd);
      } else if (data.subscriptionEnd === null) {
        updateData.subscriptionEnd = null;
      }

      if (data.trialEndsAt instanceof Date) {
        updateData.trialEndsAt = Timestamp.fromDate(data.trialEndsAt);
      }

      await updateDoc(doc(this.firestore, 'tenants', tenantId), updateData);
      console.log('✅ [TENANT] Updated:', tenantId);
    } catch (e) {
      console.error('❌ [TENANT] updateTenant:', e);
      throw e;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  RENOVAR SUSCRIPCIÓN ← NUEVO
  // ─────────────────────────────────────────────────────────────

  /**
   * Renueva la suscripción de un tenant calculando la nueva fecha
   * desde HOY (no desde la fecha de vencimiento anterior).
   * También reactiva el tenant si estaba desactivado.
   */
  async renewSubscription(
    tenantId: string,
    duration: SubscriptionDuration,
    updatedBy: string
  ): Promise<Date> {
    const newEnd = calculateSubscriptionEnd(duration);

    await this.updateTenant(
      tenantId,
      {
        subscriptionEnd: newEnd,
        subscriptionDuration: duration,
        isActive: true,
      },
      updatedBy
    );

    console.log(`✅ [TENANT] Suscripción renovada: ${tenantId} → ${newEnd.toISOString()}`);
    return newEnd;
  }

  // ─────────────────────────────────────────────────────────────
  //  ACTIVAR / DESACTIVAR
  // ─────────────────────────────────────────────────────────────

  async setTenantActive(tenantId: string, isActive: boolean, updatedBy: string): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, 'tenants', tenantId), {
        isActive,
        updatedAt: serverTimestamp(),
        updatedBy,
      });
      console.log(`✅ [TENANT] ${isActive ? 'Activated' : 'Deactivated'}:`, tenantId);
    } catch (e) {
      console.error('❌ [TENANT] setTenantActive:', e);
      throw e;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  LICENCIAS
  // ─────────────────────────────────────────────────────────────

  async updateUsedLicenses(tenantId: string, amount: number): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, 'tenants', tenantId), {
        usedLicenses: increment(amount),
      });
    } catch (e) {
      console.error('❌ [TENANT] updateUsedLicenses:', e);
      throw e;
    }
  }

  async hasAvailableLicenses(tenantId: string): Promise<boolean> {
    const tenant = await this.getTenantById(tenantId);
    return tenant ? tenant.usedLicenses < tenant.maxLicenses : false;
  }

  // ─────────────────────────────────────────────────────────────
  //  ESTADÍSTICAS
  // ─────────────────────────────────────────────────────────────

  async getTenantUsageStats(tenantId: string): Promise<TenantUsageStats | null> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) return null;

    const usersRef = collection(this.firestore, 'users');

    const allSnap = await getDocs(query(usersRef, where('tenantId', '==', tenantId)));
    const totalCount = allSnap.size;

    const activeSnap = await getDocs(
      query(usersRef, where('tenantId', '==', tenantId), where('isActive', '==', true))
    );
    const activeCount = activeSnap.size;

    return {
      tenantId: tenant.tenantId,
      tenantName: tenant.name,
      totalUsers: totalCount,
      activeUsers: activeCount,
      licensesUsed: totalCount,
      licensesAvailable: tenant.maxLicenses - totalCount,
      licensesPercentage: (totalCount / tenant.maxLicenses) * 100,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  TENANT ACTUAL (sesión)
  // ─────────────────────────────────────────────────────────────

  setCurrentTenant(tenant: Tenant | null): void {
    this.currentTenantSubject.next(tenant);
  }

  getCurrentTenant(): Tenant | null {
    return this.currentTenantSubject.value;
  }

  // ─────────────────────────────────────────────────────────────
  //  MAPPER PRIVADO
  // ─────────────────────────────────────────────────────────────

  private mapDocToTenant(id: string, data: any): Tenant {
    return {
      tenantId: id,
      proveedorIdInterno: data['proveedorIdInterno'],
      name: data['name'],
      legalName: data['legalName'],
      rfc: data['rfc'],
      plan: data['plan'],
      maxLicenses: data['maxLicenses'],
      usedLicenses: data['usedLicenses'],
      // Suscripción — nuevo campo y legacy
      subscriptionEnd: data['subscriptionEnd']?.toDate(),
      subscriptionDuration: data['subscriptionDuration'],
      trialEndsAt: data['trialEndsAt']?.toDate(),
      features: data['features'],
      tableauGroup: data['tableauGroup'],
      tableauSiteId: data['tableauSiteId'],
      bigQueryDataset: data['bigQueryDataset'],
      bigQueryFilter: data['bigQueryFilter'],
      isActive: data['isActive'],
      contractStart: data['contractStart'],
      contractEnd: data['contractEnd'],
      adminEmail: data['adminEmail'],
      billingEmail: data['billingEmail'],
      createdAt: data['createdAt']?.toDate() || new Date(),
      createdBy: data['createdBy'],
      updatedAt: data['updatedAt']?.toDate(),
      updatedBy: data['updatedBy'],
    };
  }
}
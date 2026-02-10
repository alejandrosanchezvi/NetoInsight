// 🏢 NetoInsight - Tenant Service (CORREGIDO)

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, from, map } from 'rxjs';
import { Tenant, CreateTenantDTO, UpdateTenantDTO, TenantUsageStats } from '../models/tenant.model';

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private firestore = inject(Firestore);
  private currentTenantSubject = new BehaviorSubject<Tenant | null>(null);
  public currentTenant$ = this.currentTenantSubject.asObservable();

  constructor() {
    console.log('🏢 [TENANT] TenantService initialized');
  }

  /**
   * Obtener tenant por ID
   */
  async getTenantById(tenantId: string): Promise<Tenant | null> {
    console.log('🏢 [TENANT] Fetching tenant:', tenantId);

    try {
      const tenantDocRef = doc(this.firestore, 'tenants', tenantId);
      const tenantDoc = await getDoc(tenantDocRef);

      if (!tenantDoc.exists()) {
        console.warn('⚠️ [TENANT] Tenant not found:', tenantId);
        return null;
      }

      const data = tenantDoc.data();
      const tenant = this.mapDocToTenant(tenantId, data);

      console.log('✅ [TENANT] Tenant fetched:', tenant.name);
      return tenant;
    } catch (error) {
      console.error('❌ [TENANT] Error fetching tenant:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los tenants (solo para admins internos)
   */
  async getAllTenants(): Promise<Tenant[]> {
    console.log('🏢 [TENANT] Fetching all tenants');

    try {
      const tenantsRef = collection(this.firestore, 'tenants');
      const q = query(tenantsRef, orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);

      const tenants: Tenant[] = querySnapshot.docs.map((doc) =>
        this.mapDocToTenant(doc.id, doc.data()),
      );

      console.log('✅ [TENANT] Fetched tenants:', tenants.length);
      return tenants;
    } catch (error) {
      console.error('❌ [TENANT] Error fetching tenants:', error);
      throw error;
    }
  }

  /**
   * Obtener tenants activos
   */
  async getActiveTenants(): Promise<Tenant[]> {
    console.log('🏢 [TENANT] Fetching active tenants');

    try {
      const tenantsRef = collection(this.firestore, 'tenants');
      const q = query(tenantsRef, where('isActive', '==', true), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);

      const tenants: Tenant[] = querySnapshot.docs.map((doc) =>
        this.mapDocToTenant(doc.id, doc.data()),
      );

      console.log('✅ [TENANT] Active tenants:', tenants.length);
      return tenants;
    } catch (error) {
      console.error('❌ [TENANT] Error fetching active tenants:', error);
      throw error;
    }
  }

  /**
   * Crear nuevo tenant
   */
  async createTenant(data: CreateTenantDTO, createdBy?: string): Promise<Tenant> {
    console.log('🏢 [TENANT] Creating tenant:', data.name);

    try {
      const tenantId = `tenant-${data.name.toLowerCase().replace(/\s+/g, '-')}`;
      const tenantDocRef = doc(this.firestore, 'tenants', tenantId);

      // Verificar que no exista
      const existingDoc = await getDoc(tenantDocRef);
      if (existingDoc.exists()) {
        throw new Error('Ya existe un tenant con ese nombre');
      }

      // Construir objeto base (solo campos requeridos)
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

      // Agregar campos opcionales solo si tienen valor
      if (data.legalName) tenantData.legalName = data.legalName;
      if (data.rfc) tenantData.rfc = data.rfc;
      if (data.bigQueryDataset) tenantData.bigQueryDataset = data.bigQueryDataset;
      if (data.bigQueryFilter) tenantData.bigQueryFilter = data.bigQueryFilter;
      if (data.billingEmail) tenantData.billingEmail = data.billingEmail;
      if (data.contractStart) tenantData.contractStart = data.contractStart;
      if (data.contractEnd) tenantData.contractEnd = data.contractEnd;

      await setDoc(tenantDocRef, tenantData);

      console.log('✅ [TENANT] Tenant created:', tenantId);

      // Retornar tenant creado
      return (await this.getTenantById(tenantId))!;
    } catch (error) {
      console.error('❌ [TENANT] Error creating tenant:', error);
      throw error;
    }
  }

  /**
   * Actualizar tenant
   */
  async updateTenant(tenantId: string, data: UpdateTenantDTO, updatedBy: string): Promise<void> {
    console.log('🏢 [TENANT] Updating tenant:', tenantId);

    try {
      const tenantDocRef = doc(this.firestore, 'tenants', tenantId);

      const updateData: any = {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy,
      };

      await updateDoc(tenantDocRef, updateData);

      console.log('✅ [TENANT] Tenant updated:', tenantId);
    } catch (error) {
      console.error('❌ [TENANT] Error updating tenant:', error);
      throw error;
    }
  }

  /**
   * Incrementar/Decrementar licencias usadas
   */
  async updateUsedLicenses(tenantId: string, amount: number): Promise<void> {
    console.log('📊 [TENANT] Updating licenses for tenant:', tenantId, 'amount:', amount);

    try {
      const tenantDocRef = doc(this.firestore, 'tenants', tenantId);

      await updateDoc(tenantDocRef, {
        usedLicenses: increment(amount),
      });

      console.log('✅ [TENANT] Licenses updated');
    } catch (error) {
      console.error('❌ [TENANT] Error updating licenses:', error);
      throw error;
    }
  }

  /**
   * Verificar si hay licencias disponibles
   */
  async hasAvailableLicenses(tenantId: string): Promise<boolean> {
    const tenant = await this.getTenantById(tenantId);

    if (!tenant) {
      return false;
    }

    return tenant.usedLicenses < tenant.maxLicenses;
  }

  /**
   * Obtener estadísticas de uso de un tenant
   * 
   * 🔧 CORREGIDO:
   * - totalUsers: Cuenta TODOS los usuarios en Firestore (activos e inactivos)
   * - activeUsers: Cuenta solo usuarios con isActive === true
   * - licensesUsed: Se sincroniza con el total real de usuarios
   */
  async getTenantUsageStats(tenantId: string): Promise<TenantUsageStats | null> {
    const tenant = await this.getTenantById(tenantId);

    if (!tenant) {
      return null;
    }

    const usersRef = collection(this.firestore, 'users');

    // ✅ Contar TODOS los usuarios (incluyendo inactivos)
    const allUsersQuery = query(
      usersRef,
      where('tenantId', '==', tenantId)
    );
    const allUsersSnapshot = await getDocs(allUsersQuery);
    const totalUsersCount = allUsersSnapshot.size;

    // ✅ Contar solo usuarios activos
    const activeUsersQuery = query(
      usersRef,
      where('tenantId', '==', tenantId),
      where('isActive', '==', true)
    );
    const activeUsersSnapshot = await getDocs(activeUsersQuery);
    const activeUsersCount = activeUsersSnapshot.size;

    console.log('📊 [TENANT] Stats calculated:', {
      tenantId,
      totalUsers: totalUsersCount,
      activeUsers: activeUsersCount,
      tenantUsedLicenses: tenant.usedLicenses
    });

    const stats: TenantUsageStats = {
      tenantId: tenant.tenantId,
      tenantName: tenant.name,
      totalUsers: totalUsersCount,              // ✅ Total real de Firestore
      activeUsers: activeUsersCount,            // ✅ Solo activos
      licensesUsed: totalUsersCount,            // ✅ Sincronizado con total
      licensesAvailable: tenant.maxLicenses - totalUsersCount,
      licensesPercentage: (totalUsersCount / tenant.maxLicenses) * 100,
    };

    return stats;
  }

  /**
   * Activar/Desactivar tenant
   */
  async setTenantActive(tenantId: string, isActive: boolean, updatedBy: string): Promise<void> {
    console.log(`🏢 [TENANT] Setting tenant ${isActive ? 'active' : 'inactive'}:`, tenantId);

    try {
      const tenantDocRef = doc(this.firestore, 'tenants', tenantId);

      await updateDoc(tenantDocRef, {
        isActive,
        updatedAt: serverTimestamp(),
        updatedBy,
      });

      console.log(`✅ [TENANT] Tenant ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('❌ [TENANT] Error updating tenant status:', error);
      throw error;
    }
  }

  /**
   * Establecer tenant actual (para el contexto de la sesión)
   */
  setCurrentTenant(tenant: Tenant | null): void {
    this.currentTenantSubject.next(tenant);
    console.log('🏢 [TENANT] Current tenant set:', tenant?.name);
  }

  /**
   * Obtener tenant actual
   */
  getCurrentTenant(): Tenant | null {
    return this.currentTenantSubject.value;
  }

  /**
   * Mapear documento de Firestore a modelo Tenant
   */
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
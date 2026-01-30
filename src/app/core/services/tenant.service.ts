// 🏢 NetoInsight - Tenant Service

import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query, 
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, from, map } from 'rxjs';
import { 
  Tenant, 
  CreateTenantDTO, 
  UpdateTenantDTO,
  TenantUsageStats
} from '../models/tenant.model';

@Injectable({
  providedIn: 'root'
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

      const tenants: Tenant[] = querySnapshot.docs.map(doc => 
        this.mapDocToTenant(doc.id, doc.data())
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
      const q = query(
        tenantsRef, 
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);

      const tenants: Tenant[] = querySnapshot.docs.map(doc => 
        this.mapDocToTenant(doc.id, doc.data())
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
  async createTenant(data: CreateTenantDTO, createdBy: string): Promise<Tenant> {
    console.log('🏢 [TENANT] Creating tenant:', data.name);
    
    try {
      const tenantId = `tenant-${data.name.toLowerCase().replace(/\s+/g, '-')}`;
      const tenantDocRef = doc(this.firestore, 'tenants', tenantId);

      // Verificar si ya existe
      const existing = await getDoc(tenantDocRef);
      if (existing.exists()) {
        throw new Error(`Tenant con ID ${tenantId} ya existe`);
      }

      // Crear documento
      const tenantData = {
        tenantId,
        proveedorIdInterno: data.proveedorIdInterno,
        name: data.name,
        legalName: data.legalName,
        rfc: data.rfc,
        plan: data.plan,
        maxLicenses: data.maxLicenses,
        usedLicenses: 0,
        features: data.features,
        tableauGroup: data.tableauGroup,
        isActive: true,
        adminEmail: data.adminEmail,
        billingEmail: data.billingEmail,
        createdAt: serverTimestamp(),
        createdBy
      };

      await updateDoc(tenantDocRef, tenantData as any);

      console.log('✅ [TENANT] Tenant created:', tenantId);
      
      // Retornar tenant creado
      return this.getTenantById(tenantId) as Promise<Tenant>;

    } catch (error) {
      console.error('❌ [TENANT] Error creating tenant:', error);
      throw error;
    }
  }

  /**
   * Actualizar tenant
   */
  async updateTenant(
    tenantId: string, 
    data: UpdateTenantDTO,
    updatedBy: string
  ): Promise<void> {
    console.log('🏢 [TENANT] Updating tenant:', tenantId);
    
    try {
      const tenantDocRef = doc(this.firestore, 'tenants', tenantId);
      
      const updateData: any = {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy
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
    console.log('🏢 [TENANT] Updating licenses for tenant:', tenantId, 'amount:', amount);
    
    try {
      const tenantDocRef = doc(this.firestore, 'tenants', tenantId);
      
      await updateDoc(tenantDocRef, {
        usedLicenses: increment(amount)
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
   */
  async getTenantUsageStats(tenantId: string): Promise<TenantUsageStats | null> {
    const tenant = await this.getTenantById(tenantId);
    
    if (!tenant) {
      return null;
    }

    // Contar usuarios activos
    const usersRef = collection(this.firestore, 'users');
    const activeUsersQuery = query(
      usersRef,
      where('tenantId', '==', tenantId),
      where('isActive', '==', true)
    );
    const activeUsersSnapshot = await getDocs(activeUsersQuery);

    const stats: TenantUsageStats = {
      tenantId: tenant.tenantId,
      tenantName: tenant.name,
      totalUsers: tenant.usedLicenses,
      activeUsers: activeUsersSnapshot.size,
      licensesUsed: tenant.usedLicenses,
      licensesAvailable: tenant.maxLicenses - tenant.usedLicenses,
      licensesPercentage: (tenant.usedLicenses / tenant.maxLicenses) * 100
    };

    return stats;
  }

  /**
   * Activar/Desactivar tenant
   */
  async setTenantActive(tenantId: string, isActive: boolean, updatedBy: string): Promise<void> {
    console.log('🏢 [TENANT] Setting tenant active status:', tenantId, isActive);
    
    await this.updateTenant(tenantId, { isActive }, updatedBy);
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
      contractStart: data['contractStart']?.toDate(),
      contractEnd: data['contractEnd']?.toDate(),
      adminEmail: data['adminEmail'],
      billingEmail: data['billingEmail'],
      createdAt: data['createdAt']?.toDate() || new Date(),
      createdBy: data['createdBy'],
      updatedAt: data['updatedAt']?.toDate(),
      updatedBy: data['updatedBy']
    };
  }
}
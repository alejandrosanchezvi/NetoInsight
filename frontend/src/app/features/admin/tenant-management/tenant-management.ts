// 🏢 NetoInsight - Tenant Management (CON LOADING Y NOTIFICACIONES)

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Tenant, TenantUsageStats, isTenantTrialActive, getTenantTrialDaysLeft } from '../../../core/models/tenant.model';
import { CreateTenantModal } from '../create-tenant-modal/create-tenant-modal';
import { EditTenantModal } from '../edit-tenant-modal/edit-tenant-modal';
import { TenantDetailsModal } from '../tenant-details-modal/tenant-details-modal';

@Component({
  selector: 'app-tenant-management',
  standalone: true,
  imports: [CommonModule, FormsModule, EditTenantModal, CreateTenantModal, TenantDetailsModal],
  templateUrl: './tenant-management.html',
  styleUrls: ['./tenant-management.css']
})
export class TenantManagement implements OnInit {
  
  // Estado
  isLoading = true;
  isProcessing = false;  // ← Para loading de acciones
  tenants: Tenant[] = [];
  filteredTenants: Tenant[] = [];
  tenantsStats: Map<string, TenantUsageStats> = new Map();
  
  // Filtros
  searchTerm = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  
  // Modales
  showCreateModal = false;
  showEditModal = false;
  showDetailsModal = false;
  selectedTenant: Tenant | null = null;

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('🏢 [TENANT-MGMT] Initializing...');
    
    // Verificar que usuario sea interno
    if (!this.authService.isInternalUser()) {
      console.warn('⚠️ [TENANT-MGMT] User is not internal, redirecting...');
      this.notificationService.error(
        'Acceso Denegado',
        'Solo los administradores internos de Neto pueden acceder.'
      );
      this.router.navigate(['/categorization']);
      return;
    }

    await this.loadTenants();
  }

  /**
   * Cargar todos los tenants
   */
  async loadTenants(): Promise<void> {
    this.isLoading = true;

    try {
      console.log('🏢 [TENANT-MGMT] Loading tenants...');
      
      this.tenants = await this.tenantService.getAllTenants();
      
      // Cargar estadísticas para cada tenant
      for (const tenant of this.tenants) {
        const stats = await this.tenantService.getTenantUsageStats(tenant.tenantId);
        if (stats) {
          this.tenantsStats.set(tenant.tenantId, stats);
        }
      }

      // Aplicar filtros
      this.applyFilters();

      console.log('✅ [TENANT-MGMT] Tenants loaded:', this.tenants.length);

    } catch (error) {
      console.error('❌ [TENANT-MGMT] Error loading tenants:', error);
      this.notificationService.error(
        'Error al Cargar',
        'No se pudieron cargar los proveedores.'
      );
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Aplicar filtros de búsqueda y estado
   */
  applyFilters(): void {
    this.filteredTenants = this.tenants.filter(tenant => {
      // Filtro de búsqueda
      const matchesSearch = !this.searchTerm || 
        tenant.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        tenant.proveedorIdInterno.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        tenant.adminEmail?.toLowerCase().includes(this.searchTerm.toLowerCase());

      // Filtro de estado
      const matchesStatus = 
        this.statusFilter === 'all' ||
        (this.statusFilter === 'active' && tenant.isActive) ||
        (this.statusFilter === 'inactive' && !tenant.isActive);

      return matchesSearch && matchesStatus;
    });

    console.log('🔍 [TENANT-MGMT] Filtered tenants:', this.filteredTenants.length);
  }

  /**
   * Cambiar filtro de estado
   */
  setStatusFilter(status: 'all' | 'active' | 'inactive'): void {
    this.statusFilter = status;
    this.applyFilters();
  }

  /**
   * Búsqueda en tiempo real
   */
  onSearchChange(): void {
    this.applyFilters();
  }

  /**
   * Abrir modal de crear tenant
   */
  openCreateModal(): void {
    this.showCreateModal = true;
  }

  /**
   * Cerrar modal de crear
   */
  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  /**
   * Abrir modal de editar
   */
  openEditModal(tenant: Tenant): void {
    this.selectedTenant = tenant;
    this.showEditModal = true;
  }

  /**
   * Cerrar modal de editar
   */
  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedTenant = null;
  }

  /**
   * Abrir modal de detalles
   */
  viewDetails(tenant: Tenant): void {
    console.log('👁️ [TENANT-MGMT] View details:', tenant.name);
    this.selectedTenant = tenant;
    this.showDetailsModal = true;
  }

  /**
   * Cerrar modal de detalles
   */
  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedTenant = null;
  }

  /**
   * Callback desde modal de detalles para abrir edición
   */
  onEditFromDetails(tenant: Tenant): void {
    this.closeDetailsModal();
    this.openEditModal(tenant);
  }

  /**
   * Activar/Desactivar tenant
   */
  async toggleTenantStatus(tenant: Tenant): Promise<void> {
    const action = tenant.isActive ? 'desactivar' : 'activar';
    const message = tenant.isActive
      ? `¿Desactivar a ${tenant.name}?\n\nLos usuarios de este proveedor perderán acceso al sistema.`
      : `¿Activar a ${tenant.name}?\n\nLos usuarios recuperarán acceso al sistema.`;

    this.notificationService.confirm(
      tenant.isActive ? 'Desactivar Proveedor' : 'Activar Proveedor',
      message,
      async () => {
        this.isProcessing = true;
        
        try {
          const currentUser = this.authService.getCurrentUser();
          if (!currentUser) return;

          console.log(`🔄 [TENANT-MGMT] ${action}ing tenant:`, tenant.name);

          await this.tenantService.setTenantActive(
            tenant.tenantId, 
            !tenant.isActive, 
            currentUser.uid
          );

          // Recargar tenants
          await this.loadTenants();

          this.notificationService.success(
            `Proveedor ${action === 'desactivar' ? 'Desactivado' : 'Activado'}`,
            `${tenant.name} ha sido ${action}do correctamente.`
          );

          console.log(`✅ [TENANT-MGMT] Tenant ${action}do:`, tenant.name);

        } catch (error) {
          console.error('❌ [TENANT-MGMT] Error toggling tenant status:', error);
          this.notificationService.error(
            'Error',
            `No se pudo ${action} el proveedor.`
          );
        } finally {
          this.isProcessing = false;
        }
      },
      action === 'desactivar' ? 'Desactivar' : 'Activar',
      'Cancelar',
      'warning'
    );
  }

  /**
   * Callback cuando se crea tenant
   */
  async onTenantCreated(): Promise<void> {
    this.closeCreateModal();
    await this.loadTenants();
  }

  /**
   * Callback cuando se edita tenant
   */
  async onTenantUpdated(): Promise<void> {
    this.closeEditModal();
    await this.loadTenants();
  }

  /**
   * Obtener estadísticas de un tenant
   */
  getStats(tenantId: string): TenantUsageStats | undefined {
    return this.tenantsStats.get(tenantId);
  }

  /**
   * Obtener color del badge de plan
   */
  getPlanBadgeColor(plan: string): string {
    const colors: { [key: string]: string } = {
      'trial': 'badge-info',
      'starter': 'badge-gray',
      'pro': 'badge-blue',
      'enterprise': 'badge-purple',
      'internal': 'badge-orange'
    };
    return colors[plan] || 'badge-gray';
  }

  /**
   * Formatear plan
   */
  formatPlan(plan: string): string {
    const plans: { [key: string]: string } = {
      'trial': 'Prueba',
      'starter': 'Starter',
      'pro': 'Pro',
      'enterprise': 'Enterprise',
      'internal': 'Interno'
    };
    return plans[plan] || plan;
  }

  /**
   * Formatear fecha
   */
  formatDate(date: Date | undefined): string {
    if (!date) return '-';
    
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  /**
   * Calcular porcentaje de uso de licencias
   */
  getLicensePercentage(tenantId: string): number {
    const stats = this.getStats(tenantId);
    return stats?.licensesPercentage || 0;
  }

  /**
   * Obtener color de barra de progreso
   */
  getProgressColor(percentage: number): string {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'success';
  }

  /**
   * Contar tenants activos
   */
  getActiveTenants(): number {
    return this.tenants.filter(t => t.isActive).length;
  }

  /**
   * Contar tenants inactivos
   */
  getInactiveTenants(): number {
    return this.tenants.filter(t => !t.isActive).length;
  }

  /**
   * Verificar si tenant está en trial activo
   */
  isTenantTrialActive(tenant: Tenant): boolean {
    return isTenantTrialActive(tenant);
  }

  /**
   * Obtener días restantes de trial
   */
  getTenantTrialDaysLeft(tenant: Tenant): number {
    return getTenantTrialDaysLeft(tenant);
  }

  /**
   * Obtener badge de trial
   */
  getTrialBadge(tenant: Tenant): string {
    if (tenant.plan !== 'trial') return '';
    
    const daysLeft = this.getTenantTrialDaysLeft(tenant);
    
    if (daysLeft === 0) return '⏰ Expirado';
    if (daysLeft <= 3) return `⚠️ ${daysLeft} días`;
    return `⏰ ${daysLeft} días`;
  }

  /**
   * Obtener clase CSS del badge de trial
   */
  getTrialBadgeClass(tenant: Tenant): string {
    if (tenant.plan !== 'trial') return '';
    
    const daysLeft = this.getTenantTrialDaysLeft(tenant);
    
    if (daysLeft === 0) return 'badge-danger';
    if (daysLeft <= 3) return 'badge-warning';
    return 'badge-info';
  }
}
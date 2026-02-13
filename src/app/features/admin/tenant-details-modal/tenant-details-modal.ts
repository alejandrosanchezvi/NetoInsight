// 🏢 NetoInsight - Tenant Details Modal Component

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tenant, TenantUsageStats } from '../../../core/models/tenant.model';
import { User } from '../../../core/models/user.model';
import { TenantService } from '../../../core/services/tenant.service';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy 
} from '@angular/fire/firestore';

interface ActivityLog {
  date: Date;
  action: string;
  user: string;
  type: 'info' | 'success' | 'warning';
}

@Component({
  selector: 'app-tenant-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tenant-details-modal.html',
  styleUrls: ['./tenant-details-modal.css']
})
export class TenantDetailsModal implements OnInit {
  
  @Input() tenant!: Tenant;
  @Output() close = new EventEmitter<void>();
  @Output() editTenant = new EventEmitter<Tenant>();

  // Data
  usageStats: TenantUsageStats | null = null;
  users: User[] = [];
  activityLog: ActivityLog[] = [];
  
  // Loading states
  isLoadingStats = true;
  isLoadingUsers = true;
  isLoadingActivity = true;

  // UI State
  showAllUsers = false;
  showAllActivities = false;

  constructor(
    private tenantService: TenantService,
    private firestore: Firestore
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('👁️ [DETAILS] Loading tenant details:', this.tenant.name);
    
    // Cargar datos en paralelo
    await Promise.all([
      this.loadUsageStats(),
      this.loadUsers(),
      this.loadActivityLog()
    ]);
  }

  /**
   * Cargar estadísticas de uso
   */
  private async loadUsageStats(): Promise<void> {
    try {
      this.usageStats = await this.tenantService.getTenantUsageStats(this.tenant.tenantId);
      console.log('✅ [DETAILS] Stats loaded');
    } catch (error) {
      console.error('❌ [DETAILS] Error loading stats:', error);
    } finally {
      this.isLoadingStats = false;
    }
  }

  /**
   * Cargar usuarios del tenant
   */
  private async loadUsers(): Promise<void> {
    console.log('👥 [DETAILS] Loading users...');
    
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(
        usersRef,
        where('tenantId', '==', this.tenant.tenantId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      this.users = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data['email'],
          name: data['name'],
          role: data['role'],
          tenantId: data['tenantId'],
          tenantName: data['tenantName'],
          avatarUrl: data['avatarUrl'],
          isInternal: data['isInternal'] || false,
          isActive: data['isActive'] !== false,
          mfaEnabled: data['mfaEnabled'] || false,
          createdAt: data['createdAt']?.toDate() || new Date(),
          lastLogin: data['lastLogin']?.toDate(),
          proveedorIdInterno: data['proveedorIdInterno']
        };
      });

      console.log('✅ [DETAILS] Users loaded:', this.users.length);
      
    } catch (error) {
      console.error('❌ [DETAILS] Error loading users:', error);
      this.users = [];
    } finally {
      this.isLoadingUsers = false;
    }
  }

  /**
   * Cargar log de actividad
   */
  private async loadActivityLog(): Promise<void> {
    try {
      // Generar actividades basadas en datos del tenant
      this.activityLog = [];

      // Actividad: Creación
      if (this.tenant.createdAt) {
        this.activityLog.push({
          date: this.tenant.createdAt,
          action: 'Tenant creado',
          user: this.tenant.createdBy || 'Sistema',
          type: 'success'
        });
      }

      // Actividad: Última actualización
      if (this.tenant.updatedAt) {
        this.activityLog.push({
          date: this.tenant.updatedAt,
          action: 'Configuración actualizada',
          user: this.tenant.updatedBy || 'Sistema',
          type: 'info'
        });
      }

      // Actividad: Usuarios agregados (basado en createdAt de users)
      const recentUsers = this.users
        .filter(u => u.createdAt)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 3);

      recentUsers.forEach(user => {
        this.activityLog.push({
          date: user.createdAt,
          action: `Usuario agregado: ${user.name}`,
          user: 'Sistema',
          type: 'info'
        });
      });

      // Ordenar por fecha descendente
      this.activityLog.sort((a, b) => b.date.getTime() - a.date.getTime());

      console.log('✅ [DETAILS] Activity log loaded:', this.activityLog.length);
      
    } catch (error) {
      console.error('❌ [DETAILS] Error loading activity:', error);
      this.activityLog = [];
    } finally {
      this.isLoadingActivity = false;
    }
  }

  /**
   * Cerrar modal
   */
  onClose(): void {
    this.close.emit();
  }

  /**
   * Abrir modal de edición
   */
  onEdit(): void {
    this.editTenant.emit(this.tenant);
    this.close.emit();
  }

  /**
   * Toggle mostrar todos los usuarios
   */
  toggleShowAllUsers(): void {
    this.showAllUsers = !this.showAllUsers;
  }

  /**
   * Toggle mostrar todas las actividades
   */
  toggleShowAllActivities(): void {
    this.showAllActivities = !this.showAllActivities;
  }

  /**
   * Obtener usuarios para mostrar
   */
  get displayedUsers(): User[] {
    return this.showAllUsers ? this.users : this.users.slice(0, 5);
  }

  /**
   * Obtener actividades para mostrar
   */
  get displayedActivities(): ActivityLog[] {
    return this.showAllActivities ? this.activityLog : this.activityLog.slice(0, 5);
  }

  /**
   * Formatear fecha
   */
  formatDate(date: Date | undefined): string {
    if (!date) return '-';
    
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  /**
   * Formatear fecha relativa (hace X días)
   */
  formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
    return `Hace ${Math.floor(diffDays / 365)} años`;
  }

  /**
   * Formatear rol
   */
  formatRole(role: string): string {
    const roles: { [key: string]: string } = {
      'admin': 'Administrador',
      'viewer': 'Visualizador',
      'internal': 'Interno'
    };
    return roles[role] || role;
  }

  /**
   * Formatear plan
   */
  formatPlan(plan: string): string {
    const plans: { [key: string]: string } = {
      'free': 'Gratis',
      'pro': 'Pro',
      'enterprise': 'Enterprise',
      'internal': 'Interno'
    };
    return plans[plan] || plan;
  }

  /**
   * Obtener porcentaje de uso de licencias
   */
  getLicensePercentage(): number {
    return (this.tenant.usedLicenses / this.tenant.maxLicenses) * 100;
  }

  /**
   * Obtener color de la barra de progreso
   */
  getProgressColor(): string {
    const percentage = this.getLicensePercentage();
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'success';
  }

  /**
   * Obtener iniciales del nombre
   */
  getInitials(name: string): string {
    const names = name.split(' ');
    if (names.length >= 2) {
      return names[0][0] + names[1][0];
    }
    return names[0][0];
  }

  /**
   * Copiar al portapapeles
   */
  copyToClipboard(text: string, field: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert(`✅ ${field} copiado al portapapeles`);
    }).catch(err => {
      console.error('Error copiando al portapapeles:', err);
    });
  }

  /**
   * Prevenir cierre al hacer click dentro del modal
   */
  onModalClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  formatContractDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch {
    return '-';
  }
}
}
// 👥 NetoInsight - User Management Component

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { User, UserRole } from '../../../core/models/user.model';
import { Tenant, TenantUsageStats } from '../../../core/models/tenant.model';
import { Invitation, InvitationStatus } from '../../../core/models/invitation.model';
import { InviteUserModal } from '../invite-user-modal/invite-user-modal'
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy 
} from '@angular/fire/firestore';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule,InviteUserModal],
  templateUrl: './user-management.html',
  styleUrls: ['./user-management.css']
})
export class UserManagement implements OnInit {
  
  // Estado
  isLoading = true;
  currentUser: User | null = null;
  currentTenant: Tenant | null = null;
  usageStats: TenantUsageStats | null = null;
  
  // Datos
  users: User[] = [];
  invitations: Invitation[] = [];
  
  // Modal
  showInviteModal = false;
  
  // Tabs
  activeTab: 'users' | 'invitations' = 'users';

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private invitationService: InvitationService,
    private firestore: Firestore
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('👥 [USER-MGMT] Initializing...');
    
    this.currentUser = this.authService.getCurrentUser();
    
    if (!this.currentUser) {
      console.error('❌ [USER-MGMT] No authenticated user');
      return;
    }

    await this.loadData();
  }

  /**
   * Cargar todos los datos
   */
  async loadData(): Promise<void> {
    this.isLoading = true;

    try {
      // 1. Cargar tenant actual
      this.currentTenant = await this.tenantService.getTenantById(this.currentUser!.tenantId);
      
      if (!this.currentTenant) {
        throw new Error('Tenant not found');
      }

      // 2. Cargar estadísticas de uso
      this.usageStats = await this.tenantService.getTenantUsageStats(this.currentUser!.tenantId);

      // 3. Cargar usuarios del tenant
      await this.loadUsers();

      // 4. Cargar invitaciones pendientes
      await this.loadInvitations();

      console.log('✅ [USER-MGMT] Data loaded successfully');

    } catch (error) {
      console.error('❌ [USER-MGMT] Error loading data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Cargar usuarios del tenant
   */
  async loadUsers(): Promise<void> {
    console.log('👥 [USER-MGMT] Loading users...');

    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(
        usersRef,
        where('tenantId', '==', this.currentUser!.tenantId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      this.users = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data['email'],
          name: data['name'],
          role: data['role'] as UserRole,
          tenantId: data['tenantId'],
          tenantName: data['tenantName'],
          avatarUrl: data['avatarUrl'],
          isInternal: data['isInternal'] || false,
          isActive: data['isActive'] !== false, // default true
          mfaEnabled: data['mfaEnabled'] || false,
          createdAt: data['createdAt']?.toDate() || new Date(),
          lastLogin: data['lastLogin']?.toDate()
        };
      });

      console.log('✅ [USER-MGMT] Users loaded:', this.users.length);

    } catch (error) {
      console.error('❌ [USER-MGMT] Error loading users:', error);
      this.users = [];
    }
  }

  /**
   * Cargar invitaciones
   */
  async loadInvitations(): Promise<void> {
    console.log('📧 [USER-MGMT] Loading invitations...');

    try {
      this.invitations = await this.invitationService.getInvitationsByTenant(
        this.currentUser!.tenantId,
        InvitationStatus.PENDING
      );

      console.log('✅ [USER-MGMT] Invitations loaded:', this.invitations.length);

    } catch (error) {
      console.error('❌ [USER-MGMT] Error loading invitations:', error);
      this.invitations = [];
    }
  }

  /**
   * Abrir modal de invitación
   */
  openInviteModal(): void {
    // Verificar si hay licencias disponibles
    if (!this.hasAvailableLicenses()) {
      alert('No hay licencias disponibles. Contacta a Neto para ampliar tu plan.');
      return;
    }

    this.showInviteModal = true;
  }

  /**
   * Cerrar modal
   */
  closeInviteModal(): void {
    this.showInviteModal = false;
  }

  /**
   * Verificar si hay licencias disponibles
   */
  hasAvailableLicenses(): boolean {
    if (!this.usageStats) return false;
    return this.usageStats.licensesAvailable > 0;
  }

  /**
   * Obtener porcentaje de licencias usadas
   */
  getLicensesPercentage(): number {
    if (!this.usageStats) return 0;
    return this.usageStats.licensesPercentage;
  }

  /**
   * Obtener color del badge según porcentaje
   */
  getLicensesBadgeColor(): string {
    const percentage = this.getLicensesPercentage();
    
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'success';
  }

  /**
   * Cambiar tab activo
   */
  setActiveTab(tab: 'users' | 'invitations'): void {
    this.activeTab = tab;
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
   * Formatear rol
   */
  formatRole(role: UserRole): string {
    const roles = {
      [UserRole.ADMIN]: 'Administrador',
      [UserRole.VIEWER]: 'Visualizador',
      [UserRole.INTERNAL]: 'Interno'
    };
    return roles[role] || role;
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
   * Cancelar invitación
   */
  async cancelInvitation(invitation: Invitation): Promise<void> {
    if (!confirm(`¿Cancelar invitación para ${invitation.email}?`)) {
      return;
    }

    try {
      await this.invitationService.cancelInvitation(invitation.id);
      await this.loadInvitations();
      console.log('✅ [USER-MGMT] Invitation cancelled');
    } catch (error) {
      console.error('❌ [USER-MGMT] Error cancelling invitation:', error);
      alert('Error al cancelar invitación');
    }
  }

  /**
   * Reenviar invitación
   */
  async resendInvitation(invitation: Invitation): Promise<void> {
    try {
      await this.invitationService.resendInvitation(invitation.id);
      await this.loadInvitations();
      alert('Invitación reenviada correctamente');
      console.log('✅ [USER-MGMT] Invitation resent');
    } catch (error) {
      console.error('❌ [USER-MGMT] Error resending invitation:', error);
      alert('Error al reenviar invitación');
    }
  }

  /**
   * Copiar link de invitación
   */
  copyInvitationLink(invitation: Invitation): void {
    const link = `${window.location.origin}/accept-invite?token=${invitation.token}`;
    
    navigator.clipboard.writeText(link).then(() => {
      alert('Link copiado al portapapeles');
    }).catch(err => {
      console.error('Error copying to clipboard:', err);
      alert('Error al copiar link');
    });
  }

  /**
   * Callback cuando se crea invitación exitosamente
   */
  async onInvitationCreated(): Promise<void> {
    this.closeInviteModal();
    await this.loadData();
  }
}
// 👥 NetoInsight - User Management Component (CORREGIDO)

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
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from '@angular/fire/firestore';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, InviteUserModal],
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
      console.error('❌ [USER-MGMT] No current user');
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
      // Cargar tenant actual
      this.currentTenant = await this.tenantService.getTenantById(this.currentUser!.tenantId);
      
      if (!this.currentTenant) {
        console.error('❌ [USER-MGMT] No current tenant');
        return;
      }

      // Cargar estadísticas de uso
      this.usageStats = await this.tenantService.getTenantUsageStats(this.currentTenant.tenantId);

      // Cargar usuarios e invitaciones en paralelo
      await Promise.all([
        this.loadUsers(),
        this.loadInvitations()
      ]);

      console.log('✅ [USER-MGMT] Data loaded');

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
    if (!this.currentTenant) return;

    console.log('👥 [USER-MGMT] Loading users...');

    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(
        usersRef,
        where('tenantId', '==', this.currentTenant.tenantId),
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
   * Cargar invitaciones pendientes
   */
  async loadInvitations(): Promise<void> {
    if (!this.currentTenant) return;

    console.log('📧 [USER-MGMT] Loading invitations...');

    try {
      const invitationsRef = collection(this.firestore, 'invitations');
      const q = query(
        invitationsRef,
        where('tenantId', '==', this.currentTenant.tenantId),
        where('status', '==', InvitationStatus.PENDING),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      
      this.invitations = querySnapshot.docs.map(doc => {
        const data = doc.data();
       return {
          id: doc.id,
          email: data['email'],
          role: data['role'],
          tenantId: data['tenantId'],
          tenantName: data['tenantName'],
          token: data['token'],
          status: data['status'],
          invitedBy: data['invitedBy'] || data['createdBy'] || '', 
          invitedByName: data['invitedByName'] || data['invitedBy'] || 'Sistema',
          invitedByEmail: data['invitedByEmail'] || '', 
          createdAt: data['createdAt']?.toDate() || new Date(),
          expiresAt: data['expiresAt']?.toDate() || new Date(),
          acceptedAt: data['acceptedAt']?.toDate()
        };
      });

      console.log('✅ [USER-MGMT] Invitations loaded:', this.invitations.length);

    } catch (error) {
      console.error('❌ [USER-MGMT] Error loading invitations:', error);
      this.invitations = [];
    }
  }

  /**
   * Eliminar usuario
   * 
   * 🔧 CORREGIDO: Ahora decrementa las licencias usadas del tenant
   */
  async deleteUser(user: User): Promise<void> {
    // Validaciones de seguridad
    if (user.uid === this.currentUser?.uid) {
      alert('❌ No puedes eliminarte a ti mismo');
      return;
    }

    if (user.isInternal) {
      alert('❌ No puedes eliminar usuarios internos');
      return;
    }

    // Confirmación doble para admin
    if (user.role === UserRole.ADMIN) {
      const firstConfirm = confirm(
        `⚠️ ATENCIÓN: Vas a eliminar a un ADMINISTRADOR\n\n` +
        `Usuario: ${user.name}\n` +
        `Email: ${user.email}\n\n` +
        `¿Estás seguro?`
      );

      if (!firstConfirm) return;

      const secondConfirm = confirm(
        `⚠️ ÚLTIMA CONFIRMACIÓN\n\n` +
        `Esto eliminará permanentemente al usuario ${user.name}.\n` +
        `Esta acción NO se puede deshacer.\n\n` +
        `¿Continuar?`
      );

      if (!secondConfirm) return;
    } else {
      // Confirmación simple para viewers
      const confirmDelete = confirm(
        `¿Eliminar a ${user.name}?\n\n` +
        `Email: ${user.email}\n` +
        `Rol: ${this.formatRole(user.role)}\n\n` +
        `Esta acción no se puede deshacer.`
      );

      if (!confirmDelete) return;
    }

    try {
      console.log('🗑️ [USER-MGMT] Deleting user:', user.email);

      // 1. Eliminar documento de Firestore
      const userDocRef = doc(this.firestore, 'users', user.uid);
      await deleteDoc(userDocRef);
      console.log('✅ [USER-MGMT] User deleted from Firestore');

      // 2. 🆕 Decrementar licencias usadas del tenant
      await this.tenantService.updateUsedLicenses(
        this.currentUser!.tenantId,
        -1  // ← Valor negativo para decrementar
      );
      console.log('✅ [USER-MGMT] Tenant licenses decremented');

      // 3. Recargar datos
      await this.loadData();

      alert(`✅ Usuario ${user.name} eliminado correctamente`);

    } catch (error) {
      console.error('❌ [USER-MGMT] Error deleting user:', error);
      alert('❌ Error al eliminar usuario. Por favor intenta de nuevo.');
    }
  }

  /**
   * Desactivar/Activar usuario (alternativa a eliminar)
   */
  async toggleUserStatus(user: User): Promise<void> {
    if (user.uid === this.currentUser?.uid) {
      alert('❌ No puedes desactivarte a ti mismo');
      return;
    }

    const action = user.isActive ? 'desactivar' : 'activar';
    const confirmMsg = user.isActive
      ? `¿Desactivar a ${user.name}?\n\nEl usuario perderá acceso al sistema pero su cuenta permanecerá.`
      : `¿Activar a ${user.name}?\n\nEl usuario recuperará acceso al sistema.`;

    if (!confirm(confirmMsg)) return;

    try {
      console.log(`🔄 [USER-MGMT] ${action}ing user:`, user.email);

      const userDocRef = doc(this.firestore, 'users', user.uid);
      await updateDoc(userDocRef, {
        isActive: !user.isActive,
        updatedAt: new Date(),
        updatedBy: this.currentUser?.uid
      });

      console.log(`✅ [USER-MGMT] User ${action}d`);

      // Recargar datos
      await this.loadData();

      alert(`✅ Usuario ${action}do correctamente`);

    } catch (error) {
      console.error(`❌ [USER-MGMT] Error ${action}ing user:`, error);
      alert(`❌ Error al ${action} usuario`);
    }
  }

  /**
   * Abrir modal de invitar usuario
   */
  openInviteModal(): void {
    this.showInviteModal = true;
  }

  /**
   * Cerrar modal de invitar
   */
  closeInviteModal(): void {
    this.showInviteModal = false;
  }

  /**
   * Callback cuando se envía invitación
   */
  async onInvitationSent(): Promise<void> {
    this.closeInviteModal();
    await this.loadInvitations();
  }

  /**
   * Cancelar invitación
   */
  async cancelInvitation(invitation: Invitation): Promise<void> {
    if (!confirm(`¿Cancelar invitación para ${invitation.email}?`)) {
      return;
    }

    try {
      console.log('🚫 [USER-MGMT] Cancelling invitation:', invitation.email);

      await this.invitationService.cancelInvitation(invitation.id);

      console.log('✅ [USER-MGMT] Invitation cancelled');
      
      // Recargar invitaciones
      await this.loadInvitations();

      alert(`✅ Invitación para ${invitation.email} cancelada`);

    } catch (error) {
      console.error('❌ [USER-MGMT] Error cancelling invitation:', error);
      alert('❌ Error al cancelar invitación');
    }
  }

  /**
   * Reenviar invitación
   */
  async resendInvitation(invitation: Invitation): Promise<void> {
    if (!confirm(`¿Reenviar invitación a ${invitation.email}?`)) {
      return;
    }

    try {
      console.log('📧 [USER-MGMT] Resending invitation:', invitation.email);

      await this.invitationService.resendInvitation(invitation.id);

      console.log('✅ [USER-MGMT] Invitation resent');
      
      alert(`✅ Invitación reenviada a ${invitation.email}`);

    } catch (error) {
      console.error('❌ [USER-MGMT] Error resending invitation:', error);
      alert('❌ Error al reenviar invitación');
    }
  }

  /**
   * Cambiar tab activo
   */
  setActiveTab(tab: 'users' | 'invitations'): void {
    this.activeTab = tab;
  }

  /**
   * Verificar si se puede cambiar estado del usuario
   */
  canToggleUserStatus(user: User): boolean {
    // No puede desactivarse a sí mismo
    if (user.uid === this.currentUser?.uid) return false;
    
    // No puede desactivar usuarios internos
    if (user.isInternal) return false;

    return true;
  }

  /**
   * Verificar si se puede eliminar el usuario
   */
  canDeleteUser(user: User): boolean {
    // No puede eliminarse a sí mismo
    if (user.uid === this.currentUser?.uid) return false;
    
    // No puede eliminar usuarios internos
    if (user.isInternal) return false;

    return true;
  }

  /**
   * Formatear rol de usuario
   */
  formatRole(role: UserRole): string {
    const roles: { [key: string]: string } = {
      [UserRole.ADMIN]: 'Administrador',
      [UserRole.VIEWER]: 'Visualizador'
    };
    return roles[role] || role;
  }

  /**
   * Obtener iniciales del nombre
   */
  getInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  /**
   * Formatear fecha
   */
  formatDate(date: Date | undefined): string {
    if (!date) return 'Nunca';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  /**
   * Verificar si invitación está por expirar
   */
  isInvitationExpiringSoon(invitation: Invitation): boolean {
    const now = new Date();
    const expiresAt = new Date(invitation.expiresAt);
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
  }

  /**
   * Verificar si invitación está expirada
   */
  isInvitationExpired(invitation: Invitation): boolean {
    return new Date(invitation.expiresAt) < new Date();
  }

  /**
   * Obtener porcentaje de licencias usadas
   */
  getLicensesPercentage(): number {
    if (!this.usageStats) return 0;
    return this.usageStats.licensesPercentage;
  }

  /**
   * Verificar si hay licencias disponibles
   */
  hasAvailableLicenses(): boolean {
    if (!this.currentTenant) return false;
    return this.currentTenant.usedLicenses < this.currentTenant.maxLicenses;
  }

  /**
   * Obtener color de barra de progreso
   */
  getProgressColor(): string {
    const percentage = this.getLicensesPercentage();
    
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'success';
  }

    /**
   * Callback cuando se crea invitación exitosamente
   */
  async onInvitationCreated(): Promise<void> {
    this.closeInviteModal();
    await this.loadData();
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
}
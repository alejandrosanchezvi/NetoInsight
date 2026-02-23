// 👥 NetoInsight - User Management Component (CALLBACKS CORREGIDOS)

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { NotificationService } from '../../../core/services/notification.service';
import { User, UserRole } from '../../../core/models/user.model';
import { Tenant, TenantUsageStats } from '../../../core/models/tenant.model';
import { Invitation, InvitationStatus } from '../../../core/models/invitation.model';
import { InviteUserModal } from '../invite-user-modal/invite-user-modal';
import { environment } from '../../../../environments/environment';
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
  isProcessing = false;  // ← Para loading de acciones (eliminar, desactivar, etc)
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
    private notificationService: NotificationService,
    private http: HttpClient,
    private firestore: Firestore,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('👥 [USER-MGMT] Initializing...');
    
    this.currentUser = this.authService.getCurrentUser();
    
    if (!this.currentUser) {
      console.error('❌ [USER-MGMT] No current user');
      return;
    }

    // Validar que el usuario es Admin
    if (!this.isAdmin()) {
      console.warn('⚠️ [USER-MGMT] User is not admin, redirecting...');
      this.notificationService.error(
        'Acceso Denegado',
        'Solo los administradores pueden acceder a la gestión de usuarios.'
      );
      this.router.navigate(['/categorization']);
      return;
    }

    await this.loadData();
  }

  /**
   * Verificar si el usuario actual es Admin
   */
  isAdmin(): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.role === UserRole.ADMIN || this.currentUser.isInternal;
  }

  /**
   * Verificar si puede gestionar usuarios (crear, editar, eliminar)
   */
  canManageUsers(): boolean {
    return this.isAdmin();
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
          lastLogin: data['lastLogin']?.toDate(),
          proveedorIdInterno: data['proveedorIdInterno']
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
   * Eliminar usuario COMPLETAMENTE (Firestore + Firebase Auth)
   */
  async deleteUser(user: User): Promise<void> {
    console.log('🗑️ [USER-MGMT] deleteUser called for:', user.email);

    // Verificar permisos
    if (!this.canManageUsers()) {
      this.notificationService.error(
        'Sin Permisos',
        'No tienes permisos para eliminar usuarios.'
      );
      return;
    }

    // Validaciones de seguridad
    if (user.uid === this.currentUser?.uid) {
      this.notificationService.error(
        'Operación no permitida',
        'No puedes eliminarte a ti mismo.'
      );
      return;
    }

    if (user.isInternal) {
      this.notificationService.error(
        'Operación no permitida',
        'No puedes eliminar usuarios internos del sistema.'
      );
      return;
    }

    // Una sola confirmación para todos
    const isAdmin = user.role === UserRole.ADMIN;
    const title = isAdmin ? '⚠️ Eliminar Administrador' : 'Confirmar Eliminación';
    const message = isAdmin 
      ? `ATENCIÓN: Vas a eliminar a un ADMINISTRADOR\n\nUsuario: ${user.name}\nEmail: ${user.email}\n\nEsta acción NO se puede deshacer.\n\n¿Continuar?`
      : `¿Eliminar al usuario ${user.name}?\n\nEmail: ${user.email}\nRol: ${this.formatRole(user.role)}\n\nEsta acción no se puede deshacer.`;
    
    console.log('🔔 [USER-MGMT] Showing confirmation...');
    
    this.notificationService.confirm(
      title,
      message,
      async () => {
        console.log('✅ [USER-MGMT] Confirmation accepted, executing delete...');
        await this.performDeleteUser(user);
      },
      'Eliminar',
      'Cancelar',
      isAdmin ? 'error' : 'warning'
    );
  }

  /**
   * Ejecutar eliminación de usuario
   */
  private async performDeleteUser(user: User): Promise<void> {
    this.isProcessing = true;  // ← Activar loading
    
    try {
      console.log('🗑️ [USER-MGMT] performDeleteUser - Starting deletion for:', user.email);

      // 1. Eliminar documento de Firestore
      const userDocRef = doc(this.firestore, 'users', user.uid);
      await deleteDoc(userDocRef);
      console.log('✅ [USER-MGMT] User deleted from Firestore');

      // 2. Decrementar licencias usadas del tenant
      await this.tenantService.updateUsedLicenses(
        this.currentUser!.tenantId,
        -1
      );
      console.log('✅ [USER-MGMT] Tenant licenses decremented');

      // 3. Eliminar de Firebase Authentication (llamada al backend)
      try {
        const token = await this.authService.getIdToken();
        
        if (!token) {
          console.warn('⚠️ [USER-MGMT] No Firebase token available');
          throw new Error('No se pudo obtener el token de autenticación');
        }

        console.log('🔑 [USER-MGMT] Firebase token obtained');
        
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        });

        const backendUrl = environment.apiUrl || 'http://localhost:8000';
        const deleteAuthUrl = `${backendUrl}/api/users/delete-auth-user`;

        console.log('🌐 [USER-MGMT] Calling backend:', deleteAuthUrl);

        const response = await firstValueFrom(
          this.http.delete<{success: boolean, message: string}>(
            deleteAuthUrl,
            {
              headers,
              body: {
                uid: user.uid,
                email: user.email,
                tenant_id: this.currentUser!.tenantId,
                deleted_by_uid: this.currentUser!.uid
              }
            }
          )
        );

        console.log('✅ [USER-MGMT] Backend response:', response);
        
      } catch (authError: any) {
        console.warn('⚠️ [USER-MGMT] Could not delete from Auth:', authError);
        
        if (authError.status === 0 || authError.status >= 500) {
          console.warn('⚠️ [USER-MGMT] Backend error, but user deleted from Firestore');
        }
      }

      // 4. Recargar datos
      await this.loadData();

      // 5. Mostrar éxito
      this.notificationService.success(
        'Usuario Eliminado',
        `${user.name} ha sido eliminado correctamente del sistema.`
      );

      console.log('✅ [USER-MGMT] performDeleteUser - Deletion completed successfully');

    } catch (error: any) {
      console.error('❌ [USER-MGMT] Error in performDeleteUser:', error);
      this.notificationService.error(
        'Error al Eliminar',
        'No se pudo eliminar el usuario. Por favor intenta de nuevo.'
      );
    } finally {
      this.isProcessing = false;  // ← Desactivar loading
    }
  }

  /**
   * Desactivar/Activar usuario
   */
  async toggleUserStatus(user: User): Promise<void> {
    // Verificar permisos
    if (!this.canManageUsers()) {
      this.notificationService.error(
        'Sin Permisos',
        'No tienes permisos para modificar usuarios.'
      );
      return;
    }

    if (user.uid === this.currentUser?.uid) {
      this.notificationService.error(
        'Operación no permitida',
        'No puedes desactivarte a ti mismo.'
      );
      return;
    }

    const action = user.isActive ? 'desactivar' : 'activar';
    const confirmMsg = user.isActive
      ? `¿Desactivar a ${user.name}?\n\nEl usuario perderá acceso al sistema pero su cuenta permanecerá.`
      : `¿Activar a ${user.name}?\n\nEl usuario recuperará acceso al sistema.`;

    this.notificationService.confirm(
      action === 'desactivar' ? 'Desactivar Usuario' : 'Activar Usuario',
      confirmMsg,
      async () => {
        this.isProcessing = true;  // ← Activar loading
        
        try {
          console.log(`🔄 [USER-MGMT] ${action}ing user:`, user.email);

          const userDocRef = doc(this.firestore, 'users', user.uid);
          await updateDoc(userDocRef, {
            isActive: !user.isActive,
            updatedAt: new Date(),
            updatedBy: this.currentUser?.uid
          });

          await this.loadData();

          this.notificationService.success(
            `Usuario ${action === 'desactivar' ? 'Desactivado' : 'Activado'}`,
            `${user.name} ha sido ${action}do correctamente.`
          );

        } catch (error) {
          console.error(`❌ [USER-MGMT] Error ${action}ing user:`, error);
          this.notificationService.error(
            'Error',
            `No se pudo ${action} el usuario. Por favor intenta de nuevo.`
          );
        } finally {
          this.isProcessing = false;  // ← Desactivar loading
        }
      },
      action === 'desactivar' ? 'Desactivar' : 'Activar',
      'Cancelar',
      'warning'
    );
  }

  /**
   * Abrir modal de invitar usuario
   */
  openInviteModal(): void {
    if (!this.canManageUsers()) {
      this.notificationService.error(
        'Sin Permisos',
        'No tienes permisos para invitar usuarios.'
      );
      return;
    }
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
    this.notificationService.success(
      'Invitación Enviada',
      'La invitación ha sido enviada correctamente.'
    );
  }

  /**
   * Cancelar invitación
   */
  async cancelInvitation(invitation: Invitation): Promise<void> {
    if (!this.canManageUsers()) {
      this.notificationService.error(
        'Sin Permisos',
        'No tienes permisos para cancelar invitaciones.'
      );
      return;
    }

    this.notificationService.confirm(
      'Cancelar Invitación',
      `¿Cancelar la invitación para ${invitation.email}?`,
      async () => {
        try {
          console.log('🚫 [USER-MGMT] Cancelling invitation:', invitation.email);

          await this.invitationService.cancelInvitation(invitation.id);
          await this.loadInvitations();

          this.notificationService.success(
            'Invitación Cancelada',
            `La invitación para ${invitation.email} ha sido cancelada.`
          );

        } catch (error) {
          console.error('❌ [USER-MGMT] Error cancelling invitation:', error);
          this.notificationService.error(
            'Error',
            'No se pudo cancelar la invitación.'
          );
        }
      },
      'Cancelar Invitación',
      'Volver'
    );
  }

  /**
   * Reenviar invitación
   */
  async resendInvitation(invitation: Invitation): Promise<void> {
    if (!this.canManageUsers()) {
      this.notificationService.error(
        'Sin Permisos',
        'No tienes permisos para reenviar invitaciones.'
      );
      return;
    }

    this.isProcessing = true;  // ← Activar loading
    
    try {
      console.log('📧 [USER-MGMT] Resending invitation:', invitation.email);

      await this.invitationService.resendInvitation(invitation.id);

      this.notificationService.success(
        'Invitación Reenviada',
        `La invitación ha sido reenviada a ${invitation.email}.`
      );

    } catch (error) {
      console.error('❌ [USER-MGMT] Error resending invitation:', error);
      this.notificationService.error(
        'Error',
        'No se pudo reenviar la invitación.'
      );
    } finally {
      this.isProcessing = false;  // ← Desactivar loading
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
    if (!this.canManageUsers()) return false;
    if (user.uid === this.currentUser?.uid) return false;
    if (user.isInternal) return false;
    return true;
  }

  /**
   * Verificar si se puede eliminar el usuario
   */
  canDeleteUser(user: User): boolean {
    if (!this.canManageUsers()) return false;
    if (user.uid === this.currentUser?.uid) return false;
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
}
// 👥 NetoInsight - User Management v3.0 — Magic Link integrado

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
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
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, InviteUserModal],
  templateUrl: './user-management.html',
  styleUrls: ['./user-management.css']
})
export class UserManagement implements OnInit, OnDestroy {
  private mfaSubscription: Subscription | null = null;

  isLoading = true;
  isProcessing = false;
  currentUser: User | null = null;
  currentTenant: Tenant | null = null;
  usageStats: TenantUsageStats | null = null;

  users: User[] = [];
  invitations: Invitation[] = [];

  showInviteModal = false;
  activeTab: 'users' | 'invitations' = 'users';

  // ── Magic Link en tabla ────────────────────────────────
  /** Mapa invitationId → { linkCopied, slackCopied } */
  copyStates: Record<string, { linkCopied: boolean; slackCopied: boolean }> = {};

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private invitationService: InvitationService,
    private notificationService: NotificationService,
    private http: HttpClient,
    private firestore: Firestore,
    private router: Router,
    private auth: Auth
  ) { }

  async ngOnInit(): Promise<void> {
    console.log('👥 [USER-MGMT] v3.0 Initializing...');

    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) return;

    if (!this.isAdmin()) {
      this.notificationService.error('Acceso Denegado', 'Solo los administradores pueden acceder.');
      this.router.navigate(['/categorization']);
      return;
    }

    await this.loadData();

    // Suscribirse a cambios de MFA para recargar la tabla
    this.mfaSubscription = this.authService.mfaStatusChanged$.subscribe(async () => {
      console.log('🔄 [USER-MGMT] MFA status change detected, reloading data...');
      await this.loadData();
    });
  }

  ngOnDestroy(): void {
    if (this.mfaSubscription) {
      this.mfaSubscription.unsubscribe();
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  PERMISOS
  // ─────────────────────────────────────────────────────────────

  isAdmin(): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.role === UserRole.ADMIN || this.currentUser.isInternal;
  }

  canManageUsers(): boolean { return this.isAdmin(); }

  canToggleUserStatus(user: User): boolean {
    if (!this.canManageUsers()) return false;
    if (user.uid === this.currentUser?.uid) return false;
    if (user.role === UserRole.INTERNAL) return false;
    return true;
  }

  canDeleteUser(user: User): boolean {
    if (!this.canManageUsers()) return false;
    if (user.uid === this.currentUser?.uid) return false;
    if (user.role === UserRole.INTERNAL) return false;
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  //  CARGA DE DATOS
  // ─────────────────────────────────────────────────────────────

  async loadData(): Promise<void> {
    this.isLoading = true;
    try {
      this.currentTenant = await this.tenantService.getTenantById(this.currentUser!.tenantId);
      if (!this.currentTenant) return;

      this.usageStats = await this.tenantService.getTenantUsageStats(this.currentTenant.tenantId);
      await Promise.all([this.loadUsers(), this.loadInvitations()]);

      console.log('✅ [USER-MGMT] Data loaded');
    } catch (error) {
      console.error('❌ [USER-MGMT] Error loading data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadUsers(): Promise<void> {
    if (!this.currentTenant) return;
    try {
      const q = query(
        collection(this.firestore, 'users'),
        where('tenantId', '==', this.currentTenant.tenantId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      this.users = snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          email: data['email'],
          name: data['name'],
          role: data['role'],
          tenantId: data['tenantId'],
          tenantName: data['tenantName'],
          avatarUrl: data['avatarUrl'],
          isInternal: data['isInternal'] || false,
          isActive: data['isActive'] !== false,
          mfaEnabled: data['mfaEnabled'] || false,
          mfaRequired: data['mfaRequired'] || false,
          createdAt: data['createdAt']?.toDate() || new Date(),
          lastLogin: data['lastLogin']?.toDate(),
          proveedorIdInterno: data['proveedorIdInterno']
        };
      });
    } catch (error) {
      console.error('❌ [USER-MGMT] Error loading users:', error);
      this.users = [];
    }
  }

  async loadInvitations(): Promise<void> {
    if (!this.currentTenant) return;
    try {
      const q = query(
        collection(this.firestore, 'invitations'),
        where('tenantId', '==', this.currentTenant.tenantId),
        where('status', '==', InvitationStatus.PENDING),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      this.invitations = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          email: data['email'],
          role: data['role'],
          tenantId: data['tenantId'],
          tenantName: data['tenantName'],
          token: data['token'],
          status: data['status'],
          invitedBy: data['invitedBy'] || data['createdBy'] || '',
          invitedByName: data['invitedByName'] || 'Sistema',
          invitedByEmail: data['invitedByEmail'] || '',
          createdAt: data['createdAt']?.toDate() || new Date(),
          expiresAt: data['expiresAt']?.toDate() || new Date(),
          acceptedAt: data['acceptedAt']?.toDate()
        };
      });

      // Inicializar estados de copia para cada invitación
      this.invitations.forEach(inv => {
        if (!this.copyStates[inv.id]) {
          this.copyStates[inv.id] = { linkCopied: false, slackCopied: false };
        }
      });

      console.log('✅ [USER-MGMT] Invitations loaded:', this.invitations.length);
    } catch (error) {
      console.error('❌ [USER-MGMT] Error loading invitations:', error);
      this.invitations = [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  MAGIC LINK — desde tabla de invitaciones
  // ─────────────────────────────────────────────────────────────

  async copyInvitationLink(invitation: Invitation): Promise<void> {
    const { magicLink } = this.invitationService.getMagicLinkForInvitation(invitation);
    await this.copyToClipboard(magicLink);

    this.copyStates[invitation.id].linkCopied = true;
    setTimeout(() => (this.copyStates[invitation.id].linkCopied = false), 2500);
  }

  async copyInvitationSlack(invitation: Invitation): Promise<void> {
    const { slackMessage } = this.invitationService.getMagicLinkForInvitation(invitation);
    await this.copyToClipboard(slackMessage);

    this.copyStates[invitation.id].slackCopied = true;
    setTimeout(() => (this.copyStates[invitation.id].slackCopied = false), 2500);
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  ACCIONES DE USUARIO
  // ─────────────────────────────────────────────────────────────

  async deleteUser(user: User): Promise<void> {
    if (!this.canManageUsers()) {
      this.notificationService.error('Sin Permisos', 'No tienes permisos para eliminar usuarios.');
      return;
    }
    if (user.uid === this.currentUser?.uid) {
      this.notificationService.error('Operación no permitida', 'No puedes eliminarte a ti mismo.');
      return;
    }
    if (user.isInternal) {
      this.notificationService.error('Operación no permitida', 'No puedes eliminar usuarios internos.');
      return;
    }

    const isAdmin = user.role === UserRole.ADMIN;
    const title = isAdmin ? '⚠️ Eliminar Administrador' : 'Confirmar Eliminación';
    const message = isAdmin
      ? `ATENCIÓN: Vas a eliminar a un ADMINISTRADOR\n\nUsuario: ${user.name}\nEmail: ${user.email}\n\nEsta acción NO se puede deshacer.\n\n¿Continuar?`
      : `¿Eliminar al usuario ${user.name}?\n\nEmail: ${user.email}\n\nEsta acción no se puede deshacer.`;

    this.notificationService.confirm(title, message, async () => {
      this.isProcessing = true;
      try {
        const idToken = await this.authService.getIdToken();
        const apiUrl = environment.apiUrl;

        await firstValueFrom(
          this.http.post<any>(
            `${apiUrl}/api/users/delete`,
            { uid: user.uid, email: user.email, tenant_id: user.tenantId, deleted_by_uid: this.currentUser?.uid },
            { headers: new HttpHeaders({ 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' }) }
          )
        );

        await this.loadData();
        this.notificationService.success('Usuario Eliminado', `${user.name} ha sido eliminado correctamente.`);
      } catch (error) {
        console.error('❌ [USER-MGMT] Error deleting user:', error);
        this.notificationService.error('Error', 'No se pudo eliminar el usuario.');
      } finally {
        this.isProcessing = false;
      }
    }, 'Eliminar', 'Cancelar', isAdmin ? 'error' : 'warning');
  }

  async toggleUserStatus(user: User): Promise<void> {
    if (!this.canManageUsers()) {
      this.notificationService.error('Sin Permisos', 'No tienes permisos para cambiar el estado de usuarios.');
      return;
    }

    const action = user.isActive ? 'desactivar' : 'activar';
    const confirmMsg = user.isActive
      ? `¿Desactivar a ${user.name}?\n\nEl usuario perderá acceso al sistema.`
      : `¿Activar a ${user.name}?\n\nEl usuario recuperará acceso al sistema.`;

    this.notificationService.confirm(
      action === 'desactivar' ? 'Desactivar Usuario' : 'Activar Usuario',
      confirmMsg,
      async () => {
        this.isProcessing = true;
        try {
          const idToken = await this.authService.getIdToken();
          const apiUrl = environment.apiUrl;

          await firstValueFrom(
            this.http.post<any>(
              `${apiUrl}/api/users/toggle-status`,
              { uid: user.uid, disabled: user.isActive, admin_uid: this.currentUser?.uid },
              { headers: new HttpHeaders({ 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' }) }
            )
          );

          const userDocRef = doc(this.firestore, 'users', user.uid);
          await updateDoc(userDocRef, { isActive: !user.isActive, updatedAt: new Date(), updatedBy: this.currentUser?.uid });
          await this.loadData();
          
          this.notificationService.success(
            `Usuario ${action === 'desactivar' ? 'Desactivado' : 'Activado'}`,
            `${user.name} ha sido ${action}do correctamente.`
          );
        } catch (error) {
          console.error('❌ [USER-MGMT] Error toggling status:', error);
          this.notificationService.error('Error', `No se pudo ${action} el usuario.`);
        } finally {
          this.isProcessing = false;
        }
      },
      action === 'desactivar' ? 'Desactivar' : 'Activar',
      'Cancelar',
      'warning'
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  MFA ACCIONES DE ADMINISTRADOR
  // ─────────────────────────────────────────────────────────────

  /**
   * Toggle MFA desde el switch de la tabla de administración
   */
  async toggleMfa(user: User): Promise<void> {
    if (!this.canManageUsers()) return;

    if (user.mfaEnabled) {
      // Desactivar MFA → llama al endpoint que elimina los factores
      await this.disableMfa(user);
    } else {
      // No se puede activar MFA desde admin (requiere QR en el celular del usuario)
      // Pero podemos notificar al usuario que debe configurarlo
      this.notificationService.confirm(
        'Solicitar MFA',
        `No es posible activar MFA directamente desde aquí porque ${user.name} necesita escanear un código QR con su celular.\n\n¿Deseas notificar al usuario que debe configurar MFA en su próximo inicio de sesión?`,
        async () => {
          this.isProcessing = true;
          try {
            const userDocRef = doc(this.firestore, 'users', user.uid);
            await updateDoc(userDocRef, {
              mfaRequired: true,
              updatedAt: new Date(),
              updatedBy: this.currentUser?.uid
            });
            await this.loadData();
            this.notificationService.success(
              'MFA Requerido',
              `${user.name} deberá configurar MFA en su próximo inicio de sesión.`
            );
          } catch (error) {
            console.error('❌ [USER-MGMT] Error requiring MFA:', error);
            this.notificationService.error('Error', 'No se pudo actualizar la configuración de MFA.');
          } finally {
            this.isProcessing = false;
          }
        },
        'Sí, solicitar MFA',
        'Cancelar',
        'info'
      );
    }
  }

  async disableMfa(user: User): Promise<void> {
    if (!this.canManageUsers()) {
      this.notificationService.error('Sin Permisos', 'No tienes permisos para modificar el MFA del usuario.');
      return;
    }

    this.notificationService.confirm(
      'Deshabilitar MFA',
      `¿Estás seguro de deshabilitar la autenticación de dos pasos para ${user.name}?\n\nAl hacerlo, el usuario podrá ingresar solo con su contraseña corriente y se eliminará el registro de su dispositivo Authenticator asociado.\nEsto es útil si el usuario perdió acceso a su celular.`,
      async () => {
        this.isProcessing = true;
        try {
          const idToken = await this.authService.getIdToken();
          const apiUrl = environment.apiUrl;

          await firstValueFrom(
            this.http.post<any>(
              `${apiUrl}/api/users/disable-mfa`,
              { uid: user.uid, email: user.email, forced_by_uid: this.currentUser?.uid },
              { headers: new HttpHeaders({ 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' }) }
            )
          );

          // Forzar recarga del estado de Firebase Auth para que el SDK actualice su cache
          const fbUser = this.auth.currentUser;
          if (fbUser) {
            await fbUser.reload();
            // Si el usuario deshabilitado es el usuario actual (admin), también actualitar el cache local
            if (user.uid === this.currentUser?.uid) {
              const cachedUser = this.authService.getCurrentUser();
              if (cachedUser) {
                this.authService.setCurrentUser({ ...cachedUser, mfaEnabled: false, mfaRequired: false });
              }
            }
          }

          // Notificar globalmente y recargar localmente
          this.authService.notifyMfaStatusChanged();
          await this.loadData();
          this.notificationService.success('MFA Deshabilitado', `Se desactivó correctamente el MFA para ${user.name}.`);
        } catch (error) {
          console.error('❌ [USER-MGMT] Error disabling MFA:', error);
          this.notificationService.error('Error', 'No se pudo deshabilitar el MFA del usuario.');
        } finally {
          this.isProcessing = false;
        }
      },
      'Deshabilitar MFA',
      'Cancelar',
      'warning'
    );
  }

  async requireMfa(user: User): Promise<void> {
    if (!this.canManageUsers()) {
      this.notificationService.error('Sin Permisos', 'No tienes permisos para modificar el MFA del usuario.');
      return;
    }

    const confirmMsg = user.mfaRequired
      ? `¿Quieres dejar de forzar el MFA para ${user.name}?`
      : `Al forzar el MFA, a ${user.name} se le presentará el bloqueo de configuración de Authenticator obligatoriamente la próxima vez que inicie sesión.\n\n¿Estás seguro de querer forzar esta regla de seguridad?`;

    this.notificationService.confirm(
      user.mfaRequired ? 'Quitar Exigencia MFA' : 'Forzar MFA',
      confirmMsg,
      async () => {
        this.isProcessing = true;
        try {
          const userDocRef = doc(this.firestore, 'users', user.uid);
          await updateDoc(userDocRef, { mfaRequired: !user.mfaRequired, updatedAt: new Date(), updatedBy: this.currentUser?.uid });
          await this.loadData();
          this.notificationService.success(
            'MFA Actualizado',
            user.mfaRequired ? `Se dejó de forzar el MFA para ${user.name}.` : `Se ha forzado el uso de MFA para ${user.name}.`
          );
        } catch (error) {
          console.error('❌ [USER-MGMT] Error requiring MFA:', error);
          this.notificationService.error('Error', 'No se pudo modificar la exigencia de MFA del usuario.');
        } finally {
          this.isProcessing = false;
        }
      },
      user.mfaRequired ? 'Quitar Regla' : 'Forzar MFA',
      'Cancelar',
      'info'
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  MODAL INVITAR
  // ─────────────────────────────────────────────────────────────

  openInviteModal(): void {
    if (!this.canManageUsers()) {
      this.notificationService.error('Sin Permisos', 'No tienes permisos para invitar usuarios.');
      return;
    }
    this.showInviteModal = true;
  }

  closeInviteModal(): void {
    this.showInviteModal = false;
  }

  /** El modal ya emitió invitationSent — recargamos invitaciones */
  async onInvitationSent(): Promise<void> {
    await this.loadInvitations();
    // No cerrar el modal aquí — el modal ahora muestra el step de resultado
  }

  // ─────────────────────────────────────────────────────────────
  //  ACCIONES DE INVITACIÓN
  // ─────────────────────────────────────────────────────────────

  async cancelInvitation(invitation: Invitation): Promise<void> {
    if (!this.canManageUsers()) {
      this.notificationService.error('Sin Permisos', 'No tienes permisos para cancelar invitaciones.');
      return;
    }

    this.notificationService.confirm(
      'Cancelar Invitación',
      `¿Cancelar la invitación para ${invitation.email}?`,
      async () => {
        try {
          await this.invitationService.cancelInvitation(invitation.id);
          await this.loadInvitations();
          this.notificationService.success('Invitación Cancelada', `La invitación para ${invitation.email} fue cancelada.`);
        } catch {
          this.notificationService.error('Error', 'No se pudo cancelar la invitación.');
        }
      },
      'Cancelar Invitación',
      'Volver'
    );
  }

  async resendInvitation(invitation: Invitation): Promise<void> {
    if (!this.canManageUsers()) {
      this.notificationService.error('Sin Permisos', 'No tienes permisos para reenviar invitaciones.');
      return;
    }

    this.isProcessing = true;
    try {
      const result = await this.invitationService.resendInvitation(invitation.id);
      await this.loadInvitations();

      if (result.emailSent) {
        this.notificationService.success(
          'Invitación Reenviada',
          `Correo enviado a ${invitation.email}. También puedes copiar la liga desde la tabla.`
        );
      } else {
        this.notificationService.success(
          'Liga Renovada',
          `No se pudo enviar el correo, pero la liga fue renovada. Cópiala desde la tabla.`
        );
      }
    } catch (error) {
      console.error('❌ [USER-MGMT] Error resending invitation:', error);
      this.notificationService.error('Error', 'No se pudo reenviar la invitación.');
    } finally {
      this.isProcessing = false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  UI HELPERS
  // ─────────────────────────────────────────────────────────────

  setActiveTab(tab: 'users' | 'invitations'): void {
    this.activeTab = tab;
  }

  formatRole(role: UserRole): string {
    const roles: { [key: string]: string } = {
      [UserRole.ADMIN]: 'Administrador',
      [UserRole.VIEWER]: 'Visualizador',
      [UserRole.INTERNAL]: 'Administrador'
    };
    return roles[role] || role;
  }

  getInitials(name: string): string {
    return name.split(' ').map(p => p[0]).join('').toUpperCase().substring(0, 2);
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Nunca';
    const diffMs = new Date().getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  // Muestra cuántos días QUEDAN (fecha futura)
  formatExpiresAt(date: Date | undefined): string {
    if (!date) return '—';
    const now = new Date();
    const expires = new Date(date);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) {
      // Ya expiró — mostrar cuánto hace
      const daysAgo = Math.floor(-diffMs / 86400000);
      return daysAgo === 0 ? 'Expiró hoy' : `Expiró hace ${daysAgo}d`;
    }

    const daysLeft = Math.floor(diffMs / 86400000);
    const hoursLeft = Math.floor(diffMs / 3600000);

    if (hoursLeft < 24) return `Expira en ${hoursLeft}h`;
    if (daysLeft === 1) return 'Expira mañana';
    if (daysLeft < 7) return `Expira en ${daysLeft} días`;

    // Más de una semana — mostrar fecha exacta
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(expires);
  }

  isInvitationExpiringSoon(invitation: Invitation): boolean {
    const hours = (new Date(invitation.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
    return hours < 24 && hours > 0;
  }

  isInvitationExpired(invitation: Invitation): boolean {
    return new Date(invitation.expiresAt) < new Date();
  }

  getLicensesPercentage(): number {
    return this.usageStats?.licensesPercentage ?? 0;
  }

  hasAvailableLicenses(): boolean {
    if (!this.currentTenant) return false;
    return this.currentTenant.usedLicenses < this.currentTenant.maxLicenses;
  }

  getProgressColor(): string {
    const pct = this.getLicensesPercentage();
    if (pct >= 90) return 'error';
    if (pct >= 70) return 'warning';
    return 'success';
  }
}
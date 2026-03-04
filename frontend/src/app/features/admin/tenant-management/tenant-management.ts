// 🏢 NetoInsight - Tenant Management v2.2
// Agrega: botón "Invitar Admin" por tarjeta + mini-modal de invitación

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  Tenant, TenantUsageStats,
  isTenantAccessAllowed, getSubscriptionDaysLeft,
  SubscriptionDuration, calculateSubscriptionEnd
} from '../../../core/models/tenant.model';
import { UserRole } from '../../../core/models/user.model';
import { CreateTenantModal } from '../create-tenant-modal/create-tenant-modal';
import { EditTenantModal } from '../edit-tenant-modal/edit-tenant-modal';
import { TenantDetailsModal } from '../tenant-details-modal/tenant-details-modal';

type RenewDuration = SubscriptionDuration;

const RENEW_OPTIONS: { value: RenewDuration; label: string; desc: string }[] = [
  { value: '1y', label: 'Anual', desc: '12 meses desde hoy' },
  { value: '6m', label: 'Semestral', desc: '6 meses desde hoy' },
  { value: '3m', label: 'Trimestral', desc: '3 meses desde hoy' },
  { value: '30d', label: 'Mensual', desc: '30 días desde hoy' },
];

@Component({
  selector: 'app-tenant-management',
  standalone: true,
  imports: [CommonModule, FormsModule, CreateTenantModal, EditTenantModal, TenantDetailsModal],
  templateUrl: './tenant-management.html',
  styleUrls: ['./tenant-management.css']
})
export class TenantManagement implements OnInit {

  isLoading = true;
  isProcessing = false;
  tenants: Tenant[] = [];
  filteredTenants: Tenant[] = [];
  tenantsStats = new Map<string, TenantUsageStats>();

  searchTerm = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';

  // Modales existentes
  showCreateModal = false;
  showEditModal = false;
  showDetailsModal = false;
  selectedTenant: Tenant | null = null;

  // ── Modal: Renovar suscripción ──────────────────────────────
  showRenewModal = false;
  renewTenant: Tenant | null = null;
  renewDuration: RenewDuration = '1y';
  isRenewing = false;
  readonly renewOptions = RENEW_OPTIONS;

  // ── Modal: Invitar Admin ────────────────────────────────────
  showInviteModal = false;
  inviteTenant: Tenant | null = null;
  isGeneratingLink = false;
  inviteMagicLink = '';
  inviteLinkCopied = false;
  inviteEmailSending = false;
  inviteEmailSent = false;

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private invitationService: InvitationService,
    private notificationService: NotificationService,
    private router: Router
  ) { }

  async ngOnInit(): Promise<void> {
    if (!this.authService.isInternalUser()) {
      this.notificationService.error('Acceso Denegado', 'Solo administradores internos de Neto.');
      this.router.navigate(['/categorization']);
      return;
    }
    await this.loadTenants();
  }

  // ─────────────────────────────────────────────────────────────
  //  CARGA
  // ─────────────────────────────────────────────────────────────

  async loadTenants(): Promise<void> {
    this.isLoading = true;
    try {
      this.tenants = await this.tenantService.getAllTenants();
      for (const t of this.tenants) {
        const stats = await this.tenantService.getTenantUsageStats(t.tenantId);
        if (stats) this.tenantsStats.set(t.tenantId, stats);
      }
      this.applyFilters();
    } catch {
      this.notificationService.error('Error', 'No se pudieron cargar los proveedores.');
    } finally {
      this.isLoading = false;
    }
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase();
    this.filteredTenants = this.tenants.filter(t => {
      const matchSearch = !term ||
        t.name.toLowerCase().includes(term) ||
        t.proveedorIdInterno?.toLowerCase().includes(term) ||
        t.adminEmail?.toLowerCase().includes(term);
      const matchStatus =
        this.statusFilter === 'all' ||
        (this.statusFilter === 'active' && t.isActive) ||
        (this.statusFilter === 'inactive' && !t.isActive);
      return matchSearch && matchStatus;
    });
  }

  setStatusFilter(s: 'all' | 'active' | 'inactive'): void { this.statusFilter = s; this.applyFilters(); }
  onSearchChange(): void { this.applyFilters(); }

  // ─────────────────────────────────────────────────────────────
  //  INVITAR ADMIN ← NUEVO
  // ─────────────────────────────────────────────────────────────

  openInviteModal(tenant: Tenant): void {
    this.inviteTenant = tenant;
    this.inviteMagicLink = '';
    this.inviteLinkCopied = false;
    this.inviteEmailSent = false;
    this.showInviteModal = true;
  }

  closeInviteModal(): void {
    this.showInviteModal = false;
    this.inviteTenant = null;
    this.inviteMagicLink = '';
    this.isGeneratingLink = false;
    this.inviteEmailSending = false;
  }

  async generateInviteLink(): Promise<void> {
    if (!this.inviteTenant?.adminEmail || this.isGeneratingLink) return;
    this.isGeneratingLink = true;
    this.inviteMagicLink = '';

    try {
      const result = await this.invitationService.createInvitation({
        email: this.inviteTenant.adminEmail,
        role: UserRole.ADMIN,
        tenantId: this.inviteTenant.tenantId
      });
      this.inviteMagicLink = result.magicLink;
    } catch (e) {
      this.notificationService.error('Error', 'No se pudo generar la liga de invitación.');
    } finally {
      this.isGeneratingLink = false;
    }
  }

  async sendInviteEmail(): Promise<void> {
    if (!this.inviteTenant?.adminEmail || this.inviteEmailSending) return;
    this.inviteEmailSending = true;

    try {
      const result = await this.invitationService.createInvitation({
        email: this.inviteTenant.adminEmail,
        role: UserRole.ADMIN,
        tenantId: this.inviteTenant.tenantId
      });
      this.inviteMagicLink = result.magicLink;

      if (result.emailSent) {
        this.inviteEmailSent = true;
        this.notificationService.success('Correo enviado', `Invitación enviada a ${this.inviteTenant.adminEmail}`);
      } else {
        this.notificationService.warning('Correo no enviado', 'No se pudo enviar el correo. Copia la liga manualmente.');
      }
    } catch {
      this.notificationService.error('Error', 'No se pudo generar la invitación.');
    } finally {
      this.inviteEmailSending = false;
    }
  }

  async copyInviteLink(): Promise<void> {
    if (!this.inviteMagicLink) return;
    try {
      await navigator.clipboard.writeText(this.inviteMagicLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = this.inviteMagicLink;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    this.inviteLinkCopied = true;
    setTimeout(() => (this.inviteLinkCopied = false), 2500);
  }

  // ─────────────────────────────────────────────────────────────
  //  RENOVAR SUSCRIPCIÓN
  // ─────────────────────────────────────────────────────────────

  openRenewModal(tenant: Tenant): void {
    this.renewTenant = tenant;
    this.renewDuration = '1y';
    this.showRenewModal = true;
  }

  closeRenewModal(): void {
    this.showRenewModal = false;
    this.renewTenant = null;
    this.isRenewing = false;
  }

  async confirmRenew(): Promise<void> {
    if (!this.renewTenant || this.isRenewing) return;
    this.isRenewing = true;
    try {
      const newEnd = calculateSubscriptionEnd(this.renewDuration);
      const opt = this.renewOptions.find(o => o.value === this.renewDuration);

      await this.tenantService.updateTenant(
        this.renewTenant.tenantId,
        { subscriptionEnd: newEnd, subscriptionDuration: this.renewDuration, isActive: true },
        this.authService.getCurrentUser()?.uid || 'system'
      );

      const formatted = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(newEnd);
      this.notificationService.success('Suscripción Renovada',
        `${this.renewTenant.name} renovado — ${opt?.label}.\nVence: ${formatted}`);

      this.closeRenewModal();
      await this.loadTenants();
    } catch {
      this.notificationService.error('Error', 'No se pudo renovar la suscripción.');
    } finally {
      this.isRenewing = false;
    }
  }

  getRenewPreview(): string {
    const end = calculateSubscriptionEnd(this.renewDuration);
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(end);
  }

  // ─────────────────────────────────────────────────────────────
  //  ACTIVAR / DESACTIVAR
  // ─────────────────────────────────────────────────────────────

  async toggleTenantStatus(tenant: Tenant): Promise<void> {
    const msg = tenant.isActive
      ? `¿Desactivar a ${tenant.name}?\nLos usuarios perderán acceso de inmediato.`
      : `¿Activar a ${tenant.name}?\nLos usuarios recuperarán acceso.`;

    this.notificationService.confirm(
      tenant.isActive ? 'Desactivar Proveedor' : 'Activar Proveedor', msg,
      async () => {
        this.isProcessing = true;
        try {
          const uid = this.authService.getCurrentUser()?.uid || 'system';
          await this.tenantService.setTenantActive(tenant.tenantId, !tenant.isActive, uid);
          await this.loadTenants();
          this.notificationService.success(
            tenant.isActive ? 'Proveedor Desactivado' : 'Proveedor Activado',
            `${tenant.name} ${tenant.isActive ? 'desactivado' : 'activado'} correctamente.`
          );
        } catch {
          this.notificationService.error('Error', 'No se pudo cambiar el estado.');
        } finally {
          this.isProcessing = false;
        }
      },
      tenant.isActive ? 'Desactivar' : 'Activar', 'Cancelar', 'warning'
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  MODALES EXISTENTES
  // ─────────────────────────────────────────────────────────────

  openCreateModal(): void { this.showCreateModal = true; }
  closeCreateModal(): void { this.showCreateModal = false; }
  openEditModal(t: Tenant): void { this.selectedTenant = t; this.showEditModal = true; }
  closeEditModal(): void { this.showEditModal = false; this.selectedTenant = null; }
  viewDetails(t: Tenant): void { this.selectedTenant = t; this.showDetailsModal = true; }
  closeDetailsModal(): void { this.showDetailsModal = false; this.selectedTenant = null; }
  onEditFromDetails(t: Tenant): void { this.closeDetailsModal(); this.openEditModal(t); }

  async onTenantCreated(): Promise<void> { this.closeCreateModal(); await this.loadTenants(); }
  async onTenantUpdated(): Promise<void> { this.closeEditModal(); await this.loadTenants(); }

  // ─────────────────────────────────────────────────────────────
  //  DISPLAY HELPERS
  // ─────────────────────────────────────────────────────────────

  getTenantAccessAllowed(t: Tenant): boolean { return isTenantAccessAllowed(t); }

  getSubscriptionEndDate(t: Tenant): string {
    const end = t.subscriptionEnd ?? t.trialEndsAt;
    if (!end) return 'Sin vencimiento';
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(end));
  }

  getSubscriptionBadge(t: Tenant): { label: string; cssClass: string } {
    if (t.plan === 'internal') return { label: 'Interno', cssClass: 'badge-purple' };
    const days = getSubscriptionDaysLeft(t);
    if (days === 9999) return { label: 'Sin vencimiento', cssClass: 'badge-gray' };
    if (days === 0) return { label: 'Vencido', cssClass: 'badge-danger' };
    if (days <= 7) return { label: `${days}d`, cssClass: 'badge-warning' };
    if (days <= 30) return { label: `${days}d`, cssClass: 'badge-info' };
    return { label: `${days}d`, cssClass: 'badge-success' };
  }

  getPlanBadgeColor(plan: string): string {
    const map: Record<string, string> = {
      trial: 'badge-info', starter: 'badge-gray', pro: 'badge-blue',
      enterprise: 'badge-purple', internal: 'badge-orange'
    };
    return map[plan] || 'badge-gray';
  }

  formatPlan(plan: string): string {
    const map: Record<string, string> = {
      trial: 'Prueba', starter: 'Starter', pro: 'Pro',
      enterprise: 'Enterprise', internal: 'Interno'
    };
    return map[plan] || plan;
  }

  formatDate(d: Date | undefined): string {
    if (!d) return '—';
    return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
  }

  getLicensePercentage(tenantId: string): number {
    return this.tenantsStats.get(tenantId)?.licensesPercentage ?? 0;
  }

  getProgressColor(pct: number): string {
    if (pct >= 90) return 'danger';
    if (pct >= 70) return 'warning';
    return 'success';
  }

  getActiveTenants(): number { return this.tenants.filter(t => t.isActive).length; }
  getInactiveTenants(): number { return this.tenants.filter(t => !t.isActive).length; }
  getSuspendedTenants(): number {
    return this.tenants.filter(t => t.isActive && !isTenantAccessAllowed(t)).length;
  }
}
// 📊 NetoInsight - Métricas del Portal (Solo NETO-INTERNAL)

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, getDocs, query, where, orderBy } from '@angular/fire/firestore';
import { AuthService } from '../../../core/services/auth.service';

interface TenantMetric {
    tenantId: string;
    name: string;
    plan: string;
    isActive: boolean;
    subscriptionEnd: Date | null;
    usedLicenses: number;
    maxLicenses: number;
    createdAt: Date;
    adminEmail: string;
}

interface UserMetric {
    uid: string;
    name: string;
    email: string;
    tenantName: string;
    tenantId: string;
    lastLogin: Date | null;
    createdAt: Date;
    isInternal: boolean;
}

interface InvitationMetric {
    id: string;
    status: string;
    tenantName: string;
    email: string;
    createdAt: Date;
}

@Component({
    selector: 'app-metrics',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './metrics.html',
    styleUrls: ['./metrics.css']
})
export class MetricsComponent implements OnInit, OnDestroy {

    isLoading = true;
    lastUpdated: Date | null = null;

    // ── Tarjetas resumen ──────────────────────────────────────────
    totalTenants = 0;
    activeTenants = 0;
    trialTenants = 0;
    trialsExpiringIn7Days = 0;
    totalUsers = 0;
    activeUsersLast30 = 0;
    neverLoggedIn = 0;
    pendingInvitations = 0;
    invitationsSentThisMonth = 0;
    tenantsNeverUsed = 0;

    // ── Tabla de proveedores ──────────────────────────────────────
    tenants: TenantMetric[] = [];
    tenantsSorted: TenantMetric[] = [];
    sortField: 'name' | 'plan' | 'createdAt' | 'daysLeft' = 'createdAt';
    sortDesc = true;

    // ── Tabla de usuarios (últimos logins) ────────────────────────
    recentUsers: UserMetric[] = [];
    neverLoginUsers: UserMetric[] = [];
    showNeverLogin = false;

    // ── Gráfica de crecimiento mensual ───────────────────────────
    growthData: { month: string; tenants: number; users: number }[] = [];
    maxGrowthValue = 1;

    private readonly NOW = new Date();

    constructor(
        private firestore: Firestore,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        this.loadMetrics();
    }

    ngOnDestroy(): void { }

    async loadMetrics(): Promise<void> {
        this.isLoading = true;
        try {
            await Promise.all([
                this.loadTenantMetrics(),
                this.loadUserMetrics(),
                this.loadInvitationMetrics(),
            ]);
            this.buildGrowthChart();
            this.lastUpdated = new Date();
        } catch (e) {
            console.error('❌ [METRICS] Error cargando métricas:', e);
        } finally {
            this.isLoading = false;
        }
    }

    // ──────────────────────────────────────────────────────────────
    //  TENANTS
    // ──────────────────────────────────────────────────────────────
    private async loadTenantMetrics(): Promise<void> {
        const snap = await getDocs(collection(this.firestore, 'tenants'));
        const all: TenantMetric[] = [];

        snap.docs.forEach(doc => {
            const d = doc.data();
            if (d['proveedorIdInterno'] === 'NETO-INTERNAL') return; // excluir tenant interno

            const subEnd = d['subscriptionEnd']?.toDate() ?? null;
            all.push({
                tenantId: doc.id,
                name: d['name'] ?? '',
                plan: d['plan'] ?? 'starter',
                isActive: d['isActive'] !== false,
                subscriptionEnd: subEnd,
                usedLicenses: d['usedLicenses'] ?? 0,
                maxLicenses: d['maxLicenses'] ?? 1,
                createdAt: d['createdAt']?.toDate() ?? new Date(),
                adminEmail: d['adminEmail'] ?? '',
            });
        });

        this.tenants = all;
        this.totalTenants = all.length;
        this.activeTenants = all.filter(t => t.isActive).length;
        this.trialTenants = all.filter(t => t.plan === 'trial').length;
        this.tenantsNeverUsed = all.filter(t => t.usedLicenses === 0).length;

        // Trials que vencen en 7 días
        const in7 = new Date(this.NOW);
        in7.setDate(in7.getDate() + 7);
        this.trialsExpiringIn7Days = all.filter(t =>
            t.plan === 'trial' && t.subscriptionEnd &&
            t.subscriptionEnd > this.NOW && t.subscriptionEnd <= in7
        ).length;

        this.sortTenants();
    }

    // ──────────────────────────────────────────────────────────────
    //  USERS
    // ──────────────────────────────────────────────────────────────
    private async loadUserMetrics(): Promise<void> {
        const snap = await getDocs(collection(this.firestore, 'users'));
        const all: UserMetric[] = [];
        const thirtyDaysAgo = new Date(this.NOW);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        snap.docs.forEach(doc => {
            const d = doc.data();
            if (d['isInternal']) return; // excluir usuarios internos

            const lastLogin = d['lastLogin']?.toDate() ?? null;
            all.push({
                uid: doc.id,
                name: d['name'] ?? '',
                email: d['email'] ?? '',
                tenantName: d['tenantName'] ?? '',
                tenantId: d['tenantId'] ?? '',
                lastLogin,
                createdAt: d['createdAt']?.toDate() ?? new Date(),
                isInternal: false,
            });
        });

        this.totalUsers = all.length;
        this.activeUsersLast30 = all.filter(u =>
            u.lastLogin && u.lastLogin >= thirtyDaysAgo
        ).length;
        this.neverLoggedIn = all.filter(u => !u.lastLogin).length;

        // Últimos 10 logins
        this.recentUsers = all
            .filter(u => u.lastLogin !== null)
            .sort((a, b) => (b.lastLogin?.getTime() ?? 0) - (a.lastLogin?.getTime() ?? 0))
            .slice(0, 10);

        // Sin login
        this.neverLoginUsers = all.filter(u => !u.lastLogin)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // ──────────────────────────────────────────────────────────────
    //  INVITACIONES
    // ──────────────────────────────────────────────────────────────
    private async loadInvitationMetrics(): Promise<void> {
        const snap = await getDocs(collection(this.firestore, 'invitations'));
        const startOfMonth = new Date(this.NOW.getFullYear(), this.NOW.getMonth(), 1);

        let pending = 0;
        let thisMonth = 0;

        snap.docs.forEach(doc => {
            const d = doc.data();
            if (d['status'] === 'pending') pending++;
            const created = d['createdAt']?.toDate() ?? null;
            if (created && created >= startOfMonth) thisMonth++;
        });

        this.pendingInvitations = pending;
        this.invitationsSentThisMonth = thisMonth;
    }

    // ──────────────────────────────────────────────────────────────
    //  GRÁFICA DE CRECIMIENTO
    // ──────────────────────────────────────────────────────────────
    private buildGrowthChart(): void {
        // Últimos 6 meses
        const months: { month: string; tenants: number; users: number }[] = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(this.NOW.getFullYear(), this.NOW.getMonth() - i, 1);
            const label = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
            const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

            const tenantsUntil = this.tenants.filter(t => t.createdAt <= endOfMonth).length;
            // Users we don't have all data here since we don't store all users with dates
            // Use active users approximation
            months.push({ month: label, tenants: tenantsUntil, users: 0 });
        }

        this.growthData = months;
        this.maxGrowthValue = Math.max(...months.map(m => m.tenants), 1);
    }

    // ──────────────────────────────────────────────────────────────
    //  HELPERS
    // ──────────────────────────────────────────────────────────────

    sortTenants(): void {
        const sorted = [...this.tenants];
        sorted.sort((a, b) => {
            if (this.sortField === 'name') {
                return this.sortDesc
                    ? b.name.localeCompare(a.name)
                    : a.name.localeCompare(b.name);
            }
            if (this.sortField === 'plan') {
                return this.sortDesc
                    ? b.plan.localeCompare(a.plan)
                    : a.plan.localeCompare(b.plan);
            }
            if (this.sortField === 'createdAt') {
                return this.sortDesc
                    ? b.createdAt.getTime() - a.createdAt.getTime()
                    : a.createdAt.getTime() - b.createdAt.getTime();
            }
            if (this.sortField === 'daysLeft') {
                return this.sortDesc
                    ? this.getDaysLeft(b) - this.getDaysLeft(a)
                    : this.getDaysLeft(a) - this.getDaysLeft(b);
            }
            return 0;
        });
        this.tenantsSorted = sorted;
    }

    setSort(field: 'name' | 'plan' | 'createdAt' | 'daysLeft'): void {
        if (this.sortField === field) {
            this.sortDesc = !this.sortDesc;
        } else {
            this.sortField = field;
            this.sortDesc = true;
        }
        this.sortTenants();
    }

    getDaysLeft(t: TenantMetric): number {
        if (!t.subscriptionEnd) return 9999;
        const diff = t.subscriptionEnd.getTime() - this.NOW.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    getPlanLabel(plan: string): string {
        const labels: Record<string, string> = {
            trial: 'Trial', starter: 'Starter', pro: 'Pro',
            enterprise: 'Enterprise', internal: 'Interno'
        };
        return labels[plan] ?? plan;
    }

    getPlanClass(plan: string): string {
        const classes: Record<string, string> = {
            trial: 'badge-trial', starter: 'badge-starter',
            pro: 'badge-pro', enterprise: 'badge-enterprise',
            internal: 'badge-internal'
        };
        return classes[plan] ?? '';
    }

    getDaysLeftLabel(t: TenantMetric): string {
        if (t.plan === 'starter' && !t.subscriptionEnd) return 'Sin vencimiento';
        const days = this.getDaysLeft(t);
        if (days < 0) return 'Vencido';
        if (days === 9999) return 'Sin vencimiento';
        if (days === 0) return 'Hoy';
        return `${days}d`;
    }

    getDaysLeftClass(t: TenantMetric): string {
        const days = this.getDaysLeft(t);
        if (days < 0) return 'days-expired';
        if (days <= 7) return 'days-urgent';
        if (days <= 14) return 'days-warning';
        if (days === 9999) return 'days-none';
        return 'days-ok';
    }

    formatDate(date: Date | null): string {
        if (!date) return '—';
        return date.toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    }

    formatLastLogin(date: Date | null): string {
        if (!date) return 'Nunca';
        const diffMs = this.NOW.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 7) return `Hace ${diffDays} días`;
        if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
        return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    getBarHeight(value: number): number {
        return Math.round((value / this.maxGrowthValue) * 100);
    }

    toggleNeverLogin(): void {
        this.showNeverLogin = !this.showNeverLogin;
    }
}
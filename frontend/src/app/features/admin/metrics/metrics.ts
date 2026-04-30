// 📊 NetoInsight - Métricas del Portal (Solo NETO-INTERNAL)

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../../../core/services/auth.service';
import { NgApexchartsModule } from 'ng-apexcharts';

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
    firstLogin: Date | null;
    loginCount: number;
    loginDays: string[];
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
    imports: [CommonModule, NgApexchartsModule],
    templateUrl: './metrics.html',
    styleUrls: ['./metrics.css']
})
export class MetricsComponent implements OnInit, OnDestroy {

    isLoading = true;
    lastUpdated: Date | null = null;

    // ── Tarjetas resumen ──────────────────────────────────────────
    totalTenants = 0;
    activeTenants = 0;
    tenantsWithUsers = 0;
    trialTenants = 0;
    activeTrials = 0;
    starterTenants = 0;
    trialsExpiringIn7Days = 0;
    totalUsers = 0;
    activeUsersLast30 = 0;
    neverLoggedIn = 0;
    pendingInvitations = 0;
    invitationsSentThisMonth = 0;
    tenantsNeverUsed = 0;

    // ── Vista de gráfica ──────────────────────────────────────────
    growthView: 'monthly' | 'weekly' = 'monthly';

    // ── Cache para buildGrowthChart ───────────────────────────────
    private allUsers: UserMetric[] = [];

    // ── Tabla de proveedores ──────────────────────────────────────
    tenants: TenantMetric[] = [];
    tenantsSorted: TenantMetric[] = [];
    sortField: 'name' | 'plan' | 'createdAt' | 'daysLeft' = 'createdAt';
    sortDesc = true;

    // ── Tabla de usuarios (últimos logins) ────────────────────────
    recentUsers: UserMetric[] = [];
    topUsers: UserMetric[] = [];
    neverLoginUsers: UserMetric[] = [];
    showNeverLogin = false;
    avgDaysToFirstLogin: number | null = null;

    // ── Gráfica de crecimiento mensual ───────────────────────────
    growthData: { month: string; tenants: number; users: number }[] = [];
    maxGrowthValue = 1;

    // ── ApexCharts — Área: Crecimiento ────────────────────────────
    areaChartSeries: any[] = [];
    areaChart: any = {
        type: 'area', height: 240, toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 900,
            animateGradually: { enabled: true, delay: 120 } }
    };
    areaXaxis: any = { categories: [], labels: { style: { colors: '#6b7280', fontSize: '12px' } } };
    areaStroke: any = { curve: 'smooth', width: 3 };
    areaFill: any = { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.03, stops: [0, 100] } };
    areaColors = ['#1a56c4', '#f59e0b', '#10b981'];
    areaDataLabels: any = { enabled: false };
    areaGrid: any = { borderColor: '#f1f5f9', strokeDashArray: 4 };
    areaTooltip: any = { theme: 'light' };

    // ── ApexCharts — Donut: Distribución por Plan ─────────────────
    donutSeries: number[] = [];
    donutChart: any = {
        type: 'donut', height: 260,
        animations: { enabled: true, easing: 'easeinout', speed: 800 }
    };
    donutLabels: string[] = ['Trial', 'Starter'];
    donutColors = ['#f59e0b', '#1a56c4'];
    donutLegend: any = { position: 'bottom', fontSize: '13px', markers: { size: 8 } };
    donutDataLabels: any = { enabled: true, style: { fontSize: '13px' } };
    donutPlotOptions: any = { pie: { donut: { size: '65%', labels: {
        show: true,
        total: { show: true, label: 'Total', fontSize: '14px', color: '#374151',
            formatter: (w: any) => w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)
        }
    } } } };

    // ── ApexCharts — Barras: Embudo de usuarios ───────────────────
    barSeries: any[] = [];
    barChart: any = {
        type: 'bar', height: 220, toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 800 }
    };
    barXaxis: any = { categories: ['Total', 'Activos 30d', 'Sin acceso'],
        labels: { style: { colors: '#6b7280', fontSize: '12px' } } };
    barColors = ['#1a56c4', '#10b981', '#ef4444'];
    barPlotOptions: any = { bar: { distributed: true, horizontal: false, columnWidth: '45%', borderRadius: 5 } };
    barDataLabels: any = { enabled: true, style: { fontSize: '13px', colors: ['#fff'] } };
    barGrid: any = { borderColor: '#f1f5f9', strokeDashArray: 4, yaxis: { lines: { show: true } } };
    barLegend: any = { show: false };

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
        this.tenantsWithUsers = all.filter(t => t.usedLicenses > 0).length;
        this.tenantsNeverUsed = all.filter(t => t.usedLicenses === 0).length;
        this.starterTenants = all.filter(t => t.plan === 'starter').length;
        this.trialTenants = all.filter(t => t.plan === 'trial').length;
        this.activeTrials = all.filter(t =>
            t.plan === 'trial' && t.isActive &&
            t.usedLicenses > 0 &&
            (!t.subscriptionEnd || t.subscriptionEnd > this.NOW)
        ).length;
        this.donutSeries = [this.trialTenants, this.starterTenants];

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

            all.push({
                uid: doc.id,
                name: d['name'] ?? '',
                email: d['email'] ?? '',
                tenantName: d['tenantName'] ?? '',
                tenantId: d['tenantId'] ?? '',
                lastLogin: d['lastLogin']?.toDate() ?? null,
                firstLogin: d['firstLogin']?.toDate() ?? null,
                loginCount: d['loginCount'] ?? 0,
                loginDays: d['loginDays'] ?? [],
                createdAt: d['createdAt']?.toDate() ?? new Date(),
                isInternal: false,
            });
        });

        this.allUsers = all;
        this.totalUsers = all.length;
        this.activeUsersLast30 = all.filter(u =>
            u.lastLogin && u.lastLogin >= thirtyDaysAgo
        ).length;
        this.neverLoggedIn = all.filter(u => !u.lastLogin).length;
        this.barSeries = [{ name: 'Usuarios', data: [this.totalUsers, this.activeUsersLast30, this.neverLoggedIn] }];

        // Top usuarios por loginCount
        this.topUsers = [...all]
            .filter(u => u.loginCount > 0)
            .sort((a, b) => b.loginCount - a.loginCount)
            .slice(0, 20);

        // Todos los usuarios con login, ordenados por más reciente
        this.recentUsers = all
            .filter(u => u.lastLogin !== null)
            .sort((a, b) => (b.lastLogin?.getTime() ?? 0) - (a.lastLogin?.getTime() ?? 0));

        // Sin login
        this.neverLoginUsers = all.filter(u => !u.lastLogin)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Promedio de días entre registro y primer login
        const withFirst = all.filter(u => u.firstLogin);
        if (withFirst.length > 0) {
            const totalDays = withFirst.reduce((sum, u) => {
                const diff = (u.firstLogin!.getTime() - u.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                return sum + Math.max(0, diff);
            }, 0);
            this.avgDaysToFirstLogin = Math.round(totalDays / withFirst.length);
        }
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
        const labels: string[] = [];
        const starterData: number[] = [];
        const trialData: number[] = [];
        const activityData: number[] = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(this.NOW.getFullYear(), this.NOW.getMonth() - i, 1);
            const label = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
            const startOfMonth = d;
            const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

            labels.push(label);
            starterData.push(this.tenants.filter(t => t.plan === 'starter' && t.createdAt <= endOfMonth).length);
            trialData.push(this.tenants.filter(t => t.plan === 'trial' && t.createdAt <= endOfMonth).length);
            // Usuarios con lastLogin dentro del mes — proxy de actividad
            activityData.push(this.allUsers.filter(u =>
                u.lastLogin && u.lastLogin >= startOfMonth && u.lastLogin <= endOfMonth
            ).length);
        }

        this.growthData = labels.map((month, i) => ({ month, tenants: starterData[i] + trialData[i], users: activityData[i] }));
        this.maxGrowthValue = Math.max(...this.growthData.map(m => m.tenants), 1);

        this.areaChartSeries = [
            { name: 'Starter', data: starterData },
            { name: 'Trial', data: trialData },
            { name: 'Actividad', data: activityData },
        ];
        this.areaXaxis = { ...this.areaXaxis, categories: labels };
    }

    private buildWeeklyChart(): void {
        const labels: string[] = [];
        const starterData: number[] = [];
        const trialData: number[] = [];
        const activityData: number[] = [];

        for (let i = 7; i >= 0; i--) {
            const weekStart = new Date(this.NOW);
            weekStart.setDate(weekStart.getDate() - i * 7 - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const label = weekStart.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
            labels.push(label);
            starterData.push(this.tenants.filter(t => t.plan === 'starter' && t.createdAt <= weekEnd).length);
            trialData.push(this.tenants.filter(t => t.plan === 'trial' && t.createdAt <= weekEnd).length);
            activityData.push(this.allUsers.filter(u =>
                u.lastLogin && u.lastLogin >= weekStart && u.lastLogin <= weekEnd
            ).length);
        }

        this.areaChartSeries = [
            { name: 'Starter', data: starterData },
            { name: 'Trial', data: trialData },
            { name: 'Actividad', data: activityData },
        ];
        this.areaXaxis = { ...this.areaXaxis, categories: labels };
    }

    switchGrowthView(view: 'monthly' | 'weekly'): void {
        this.growthView = view;
        if (view === 'monthly') this.buildGrowthChart();
        else this.buildWeeklyChart();
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
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        if (diffDays === 1) return `Ayer ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
        if (diffDays < 7) return `Hace ${diffDays} días`;
        if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
        return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    getLastLoginClass(date: Date | null): string {
        if (!date) return 'login-never';
        const diffDays = Math.floor((this.NOW.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'login-today';
        if (diffDays <= 3) return 'login-recent';
        if (diffDays <= 14) return 'login-ok';
        if (diffDays <= 30) return 'login-warning';
        return 'login-old';
    }

    getBarHeight(value: number): number {
        return Math.round((value / this.maxGrowthValue) * 100);
    }

    toggleNeverLogin(): void {
        this.showNeverLogin = !this.showNeverLogin;
    }

    getLoginCountClass(count: number): string {
        if (count >= 20) return 'count-high';
        if (count >= 10) return 'count-mid';
        if (count >= 1) return 'count-low';
        return 'count-zero';
    }

    daysToFirstLogin(u: UserMetric): number | null {
        if (!u.firstLogin) return null;
        return Math.max(0, Math.round(
            (u.firstLogin.getTime() - u.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        ));
    }

    uniqueDays(u: UserMetric): number {
        return u.loginDays.length;
    }

    streak(u: UserMetric): number {
        if (!u.loginDays.length) return 0;
        const sorted = [...u.loginDays].sort().reverse(); // más reciente primero
        const today = new Date().toISOString().slice(0, 10);
        let current = today;
        let count = 0;
        for (const day of sorted) {
            if (day === current) {
                count++;
                const d = new Date(current);
                d.setDate(d.getDate() - 1);
                current = d.toISOString().slice(0, 10);
            } else {
                break;
            }
        }
        return count;
    }
}
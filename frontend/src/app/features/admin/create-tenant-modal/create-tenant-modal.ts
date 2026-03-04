// 🏢 NetoInsight - Create Tenant Modal v2.2
// Cambios vs anterior:
// - Sin campo Licencias Máximas (visible en el plan)
// - 4 planes visibles: Trial(1), Starter(3), Pro(5), Enterprise(10) — Interno oculto
// - Duración: Anual, Semestral, Trimestral, Mensual + "Sin fecha"
// - Proveedor ID: manual, sin botón generar
// - Tableau / BigQuery: ocultos (se asignan automáticamente)
// - Acceso "Sin invitación": explica que se invita desde Gestión de Proveedores
// - Acceso "Liga mágica": también indica que se puede obtener desde Gestión de Proveedores

import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TenantService } from '../../../core/services/tenant.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  TenantPlan, CreateTenantDTO,
  SubscriptionDuration, calculateSubscriptionEnd
} from '../../../core/models/tenant.model';
import { UserRole } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';

type AccessMode = 'none' | 'magic_link' | 'email';
type DurationValue = SubscriptionDuration | 'none';

const VISIBLE_PLANS = [
  {
    value: TenantPlan.TRIAL,
    label: 'Prueba Gratis',
    maxLicenses: 1,
    description: '30 días de prueba con 1 usuario',
    badge: 'Gratis',
    badgeClass: 'badge-green'
  },
  {
    value: TenantPlan.STARTER,
    label: 'Starter',
    maxLicenses: 3,
    description: 'Ideal para equipos pequeños',
    badge: null,
    badgeClass: ''
  },
  {
    value: TenantPlan.PRO,
    label: 'Pro',
    maxLicenses: 5,
    description: 'Para equipos en crecimiento',
    badge: null,
    badgeClass: ''
  },
  {
    value: TenantPlan.ENTERPRISE,
    label: 'Enterprise',
    maxLicenses: 10,
    description: 'Para organizaciones grandes',
    badge: null,
    badgeClass: ''
  },
];

const ALL_DURATIONS: { value: DurationValue; label: string; desc: string }[] = [
  {
    value: 'none',
    label: 'Sin fecha por ahora',
    desc: 'Acceso permanente hasta que definas una fecha con "Renovar"'
  },
  {
    value: '1y',
    label: 'Anual',
    desc: '12 meses desde hoy'
  },
  {
    value: '6m',
    label: 'Semestral',
    desc: '6 meses desde hoy'
  },
  {
    value: '3m',
    label: 'Trimestral',
    desc: '3 meses desde hoy'
  },
  {
    value: '30d',
    label: 'Mensual',
    desc: '30 días desde hoy'
  },
];

@Component({
  selector: 'app-create-tenant-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-tenant-modal.html',
  styleUrls: ['./create-tenant-modal.css']
})
export class CreateTenantModal implements OnInit {

  @Output() close = new EventEmitter<void>();
  @Output() tenantCreated = new EventEmitter<void>();

  createForm: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  currentStep = 1;
  readonly totalSteps = 4;

  readonly planOptions = VISIBLE_PLANS;

  // Paso 2 — duración
  selectedDuration: DurationValue = '1y';

  // Paso 4 — acceso
  accessMode: AccessMode = 'none';
  magicLink = '';
  linkCopied = false;

  dashboardOptions = [
    { id: 'categorization', label: 'Categorización', checked: true },
    { id: 'skus', label: 'SKUs', checked: true },
    { id: 'stocks', label: 'Stocks', checked: true },
    { id: 'purchase-orders', label: 'Órdenes de Compra', checked: true }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private tenantService: TenantService,
    private invitationService: InvitationService,
    private notificationService: NotificationService
  ) {
    this.createForm = this.fb.group({
      // Paso 1
      name: ['', [Validators.required, Validators.minLength(2)]],
      legalName: [''],
      rfc: ['', [Validators.pattern(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/)]],
      proveedorIdInterno: ['', [Validators.required]],
      // Paso 2
      plan: ['starter', Validators.required],
      // Paso 3
      adminEmail: ['', [Validators.required, Validators.email]],
      billingEmail: ['', Validators.email],
    });
  }

  ngOnInit(): void {
    this.createForm.get('plan')?.valueChanges.subscribe(plan => {
      if (plan === TenantPlan.TRIAL) {
        this.selectedDuration = '30d';
      } else if (this.selectedDuration === '30d') {
        this.selectedDuration = '1y';
      }
    });
  }

  // ── Navegación ──────────────────────────────────────────────

  nextStep(): void {
    if (this.currentStep < this.totalSteps && this.validateCurrentStep()) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) this.currentStep--;
  }

  goToStep(step: number): void {
    if (step < this.currentStep) this.currentStep = step;
  }

  private validateCurrentStep(): boolean {
    const stepFields: Record<number, string[]> = {
      1: ['name', 'proveedorIdInterno'],
      2: ['plan'],
      3: ['adminEmail'],
      4: []
    };
    const fields = stepFields[this.currentStep] ?? [];
    fields.forEach(f => this.createForm.get(f)?.markAsTouched());
    const valid = fields.every(f => this.createForm.get(f)?.valid);
    if (!valid) {
      this.errorMessage = 'Por favor completa todos los campos requeridos';
      setTimeout(() => (this.errorMessage = ''), 3000);
    }
    return valid;
  }

  // ── Plan helpers ─────────────────────────────────────────────

  get selectedPlan() {
    return this.planOptions.find(p => p.value === this.createForm.get('plan')?.value);
  }

  get isTrialPlan(): boolean {
    return this.createForm.get('plan')?.value === TenantPlan.TRIAL;
  }

  get visibleDurations() {
    if (this.isTrialPlan) {
      return ALL_DURATIONS.filter(d => d.value === '30d');
    }
    return ALL_DURATIONS.filter(d => d.value !== '30d');
  }

  setDuration(val: DurationValue): void {
    this.selectedDuration = val;
  }

  getDurationPreview(): string {
    if (this.selectedDuration === 'none') return '';
    const end = calculateSubscriptionEnd(this.selectedDuration as SubscriptionDuration);
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(end);
  }

  // ── Acceso ───────────────────────────────────────────────────

  setAccessMode(mode: AccessMode): void {
    this.accessMode = mode;
    this.magicLink = '';
    this.linkCopied = false;
  }

  // ── Submit ───────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const fv = this.createForm.value;
      const plan = fv.plan as TenantPlan;
      const planConfig = this.planOptions.find(p => p.value === plan)!;

      const subscriptionEnd: Date | undefined =
        this.selectedDuration === 'none'
          ? undefined
          : calculateSubscriptionEnd(this.selectedDuration as SubscriptionDuration);

      const name = fv.name.trim();
      const provId = fv.proveedorIdInterno.trim().toUpperCase();

      const createDTO: CreateTenantDTO = {
        proveedorIdInterno: provId,
        name,
        legalName: fv.legalName?.trim() || name,
        rfc: fv.rfc?.trim() || undefined,
        plan,
        maxLicenses: planConfig.maxLicenses,
        features: {
          dashboards: this.getSelectedDashboards(),
          exports: true,
          api: plan === TenantPlan.ENTERPRISE,
          customReports: plan === TenantPlan.ENTERPRISE
        },
        // Campos automáticos — ocultos en UI
        tableauGroup: `${name.replace(/\s+/g, '_')}_Viewers`,
        bigQueryDataset: `proveedores_${name.toLowerCase().replace(/\s+/g, '_')}`,
        bigQueryFilter: `proveedor_id = '${provId}'`,
        adminEmail: fv.adminEmail.trim(),
        billingEmail: fv.billingEmail?.trim() || undefined,
        subscriptionEnd,
        subscriptionDuration: this.selectedDuration === 'none'
          ? undefined
          : this.selectedDuration as SubscriptionDuration,
        trialEndsAt: plan === TenantPlan.TRIAL ? subscriptionEnd : undefined,
      };

      const currentUser = this.authService.getCurrentUser();
      const tenant = await this.tenantService.createTenant(createDTO, currentUser?.uid || 'system');

      if (this.accessMode === 'none') {
        this.notificationService.success(
          'Proveedor Creado',
          `${tenant.name} creado correctamente.\n\nPuedes enviarle la invitación desde su tarjeta en Gestión de Proveedores.`
        );
        this.tenantCreated.emit();

      } else {
        const result = await this.invitationService.createInvitation({
          email: fv.adminEmail.trim(),
          role: UserRole.ADMIN,
          tenantId: tenant.tenantId
        });

        this.magicLink = result.magicLink;

        if (this.accessMode === 'email') {
          const msg = result.emailSent
            ? `📧 Correo enviado a ${fv.adminEmail}`
            : `⚠️ No se pudo enviar el correo. Copia la liga mágica abajo.`;
          this.notificationService.success('Proveedor Creado', `${tenant.name} creado.\n${msg}`);
          this.tenantCreated.emit();
        }
        // accessMode === 'magic_link': modal se queda abierto mostrando el link
      }

    } catch (error: any) {
      console.error('❌ [CREATE-TENANT]', error);
      this.errorMessage = error.message || 'Error al crear proveedor';
      this.notificationService.error('Error', this.errorMessage);
      this.isSubmitting = false;
    }
  }

  async copyMagicLink(): Promise<void> {
    if (!this.magicLink) return;
    try {
      await navigator.clipboard.writeText(this.magicLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = this.magicLink;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    this.linkCopied = true;
    setTimeout(() => (this.linkCopied = false), 2500);
  }

  onCloseFinal(): void {
    this.tenantCreated.emit();
    this.close.emit();
  }

  // ── Utils ────────────────────────────────────────────────────

  private getSelectedDashboards(): string[] {
    return this.dashboardOptions.filter(d => d.checked).map(d => d.id);
  }

  toggleDashboard(id: string): void {
    const d = this.dashboardOptions.find(x => x.id === id);
    if (d) d.checked = !d.checked;
  }

  hasError(field: string): boolean {
    const c = this.createForm.get(field);
    return !!(c?.invalid && c.touched);
  }

  getErrorMessage(field: string): string {
    const c = this.createForm.get(field);
    if (c?.hasError('required')) return 'Este campo es requerido';
    if (c?.hasError('email')) return 'Email inválido';
    if (c?.hasError('minlength')) return `Mínimo ${c.errors?.['minlength'].requiredLength} caracteres`;
    if (c?.hasError('pattern') && field === 'rfc') return 'Formato de RFC inválido';
    return 'Campo inválido';
  }

  onClose(): void {
    if (this.isSubmitting) return;
    if (this.createForm.dirty) {
      this.notificationService.confirm(
        'Cancelar Creación',
        '¿Estás seguro? Los cambios se perderán.',
        () => this.close.emit(),
        'Sí, cancelar', 'Continuar', 'warning'
      );
    } else {
      this.close.emit();
    }
  }

  onModalClick(e: MouseEvent): void { e.stopPropagation(); }
}
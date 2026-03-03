// 🏢 NetoInsight - Create Tenant Modal (CON TRIAL Y NOTIFICACIONES)

import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TenantService } from '../../../core/services/tenant.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantPlan, CreateTenantDTO, PLAN_CONFIGS } from '../../../core/models/tenant.model';
import { UserRole } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';

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
  totalSteps = 3;

  // Opciones de planes (ACTUALIZADAS)
  planOptions = PLAN_CONFIGS;

  // Dashboards disponibles
  dashboardOptions = [
    { id: 'categorization', label: 'Categorización', checked: true },
    { id: 'stores', label: 'Tiendas', checked: true },
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
      // Paso 1: Información Básica
      name: ['', [Validators.required, Validators.minLength(2)]],
      legalName: [''],
      rfc: ['', [Validators.pattern(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/)]],

      // Paso 2: Configuración
      plan: ['starter', Validators.required],  // Starter por defecto
      maxLicenses: [5, [Validators.required, Validators.min(1)]],
      proveedorIdInterno: ['', [Validators.required, Validators.pattern(/^PROV-\d{3}$/)]],

      // Integraciones
      tableauGroup: [''],
      bigQueryDataset: [''],
      bigQueryFilter: [''],

      // Paso 3: Contacto
      adminEmail: ['', [Validators.required, Validators.email]],
      billingEmail: ['', Validators.email],

      // Fechas de contrato (opcional)
      contractStart: [''],
      contractEnd: ['']
    });
  }

  ngOnInit(): void {
    console.log('🏢 [CREATE-TENANT] Modal initialized');

    // Actualizar maxLicenses cuando cambia el plan
    this.createForm.get('plan')?.valueChanges.subscribe(plan => {
      const selectedPlan = this.planOptions.find(p => p.value === plan);
      if (selectedPlan) {
        this.createForm.patchValue({ maxLicenses: selectedPlan.maxLicenses });
      }
    });

    // Auto-generar campos relacionados
    this.createForm.get('name')?.valueChanges.subscribe(name => {
      this.autoGenerateFields(name);
    });
  }

  /**
   * Auto-generar campos basados en el nombre
   */
  private autoGenerateFields(name: string): void {
    if (!name) return;

    const cleanName = name.trim();

    // Tableau Group
    if (!this.createForm.get('tableauGroup')?.value) {
      const tableauGroup = `${cleanName.replace(/\s+/g, '_')}_Viewers`;
      this.createForm.patchValue({ tableauGroup });
    }

    // BigQuery Dataset
    if (!this.createForm.get('bigQueryDataset')?.value) {
      const dataset = `proveedores_${cleanName.toLowerCase().replace(/\s+/g, '_')}`;
      this.createForm.patchValue({ bigQueryDataset: dataset });
    }
  }

  /**
   * Generar siguiente Proveedor ID
   */
  async generateProveedorId(): Promise<void> {
    try {
      // Obtener todos los tenants
      const tenants = await this.tenantService.getAllTenants();

      // Extraer números de IDs existentes
      const existingIds = tenants
        .map(t => t.proveedorIdInterno)
        .filter(id => id.startsWith('PROV-'))
        .map(id => parseInt(id.replace('PROV-', '')))
        .filter(num => !isNaN(num));

      // Calcular siguiente ID
      const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
      const proveedorId = `PROV-${nextId.toString().padStart(3, '0')}`;

      this.createForm.patchValue({ proveedorIdInterno: proveedorId });

      // Auto-generar filtro BigQuery
      this.createForm.patchValue({
        bigQueryFilter: `proveedor_id = '${proveedorId}'`
      });

      console.log('✅ [CREATE-TENANT] Generated Proveedor ID:', proveedorId);

    } catch (error) {
      console.error('❌ [CREATE-TENANT] Error generating ID:', error);
    }
  }

  /**
   * Navegar entre pasos
   */
  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      // Validar paso actual
      if (!this.validateCurrentStep()) {
        return;
      }
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number): void {
    if (step <= this.currentStep) {
      this.currentStep = step;
    }
  }

  /**
   * Validar paso actual
   */
  private validateCurrentStep(): boolean {
    const step1Fields = ['name'];
    const step2Fields = ['plan', 'maxLicenses', 'proveedorIdInterno'];
    const step3Fields = ['adminEmail'];

    let fieldsToValidate: string[] = [];

    switch (this.currentStep) {
      case 1:
        fieldsToValidate = step1Fields;
        break;
      case 2:
        fieldsToValidate = step2Fields;
        break;
      case 3:
        fieldsToValidate = step3Fields;
        break;
    }

    // Marcar campos como touched
    fieldsToValidate.forEach(field => {
      this.createForm.get(field)?.markAsTouched();
    });

    // Validar
    const isValid = fieldsToValidate.every(field => {
      const control = this.createForm.get(field);
      return control && control.valid;
    });

    if (!isValid) {
      this.errorMessage = 'Por favor completa todos los campos requeridos';
      setTimeout(() => this.errorMessage = '', 3000);
    }

    return isValid;
  }

  /**
   * Calcular fecha de expiración del trial (30 días)
   */
  private calculateTrialEndDate(): any {
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 30);
    return trialEnd;  // Firestore lo convertirá automáticamente a Timestamp
  }

  /**
   * Enviar formulario
   */
  async onSubmit(): Promise<void> {
    if (this.createForm.invalid) {
      this.markFormGroupTouched(this.createForm);
      this.errorMessage = 'Por favor completa todos los campos requeridos';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    console.log('🏢 [CREATE-TENANT] Creating tenant...');

    try {
      const formValue = this.createForm.value;
      const selectedPlan = formValue.plan as TenantPlan;

      // Preparar DTO
      const createDTO: CreateTenantDTO = {
        proveedorIdInterno: formValue.proveedorIdInterno,
        name: formValue.name.trim(),
        legalName: formValue.legalName?.trim() || formValue.name.trim(),
        rfc: formValue.rfc?.trim() || undefined,
        plan: selectedPlan,
        maxLicenses: formValue.maxLicenses,
        features: {
          dashboards: this.getSelectedDashboards(),
          exports: true,
          api: selectedPlan === TenantPlan.ENTERPRISE || selectedPlan === TenantPlan.INTERNAL,
          customReports: selectedPlan === TenantPlan.ENTERPRISE || selectedPlan === TenantPlan.INTERNAL
        },
        tableauGroup: formValue.tableauGroup.trim(),
        bigQueryDataset: formValue.bigQueryDataset?.trim(),
        bigQueryFilter: formValue.bigQueryFilter?.trim(),
        adminEmail: formValue.adminEmail.trim(),
        billingEmail: formValue.billingEmail?.trim(),
        contractStart: formValue.contractStart || undefined,
        contractEnd: formValue.contractEnd || undefined,
        trialEndsAt: selectedPlan === TenantPlan.TRIAL ? this.calculateTrialEndDate() : undefined
      };

      // Obtener usuario actual para createdBy
      const currentUser = this.authService.getCurrentUser();

      // 1. Crear tenant
      console.log('🏢 [CREATE-TENANT] Creating tenant in Firestore...');
      const tenant = await this.tenantService.createTenant(createDTO, currentUser?.uid || 'system');
      console.log('✅ [CREATE-TENANT] Tenant created:', tenant.tenantId);

      // 2. Crear invitación para el admin (esto ya envía el email automáticamente)
      console.log('📧 [CREATE-TENANT] Creating invitation for admin...');
      const invitation = await this.invitationService.createInvitation({
        email: formValue.adminEmail.trim(),
        role: UserRole.ADMIN,
        tenantId: tenant.tenantId
      });
      // console.log('✅ [CREATE-TENANT] Invitation created and email sent:', invitation.id);

      // 3. Emitir evento de éxito
      this.tenantCreated.emit();

      // 4. Mostrar modal de éxito
      const trialMessage = selectedPlan === TenantPlan.TRIAL
        ? '\n\n⏰ Trial válido por 30 días desde hoy'
        : '';

      this.notificationService.success(
        'Proveedor Creado',
        `${tenant.name} ha sido creado exitosamente.\n\n` +
        `📧 Invitación enviada a: ${formValue.adminEmail}\n` +
        `📦 Plan: ${this.getPlanLabel(selectedPlan)}\n` +
        `👥 Licencias: ${formValue.maxLicenses}${trialMessage}`
      );

    } catch (error: any) {
      console.error('❌ [CREATE-TENANT] Error:', error);
      this.errorMessage = error.message || 'Error al crear proveedor';

      this.notificationService.error(
        'Error al Crear Proveedor',
        this.errorMessage
      );

      this.isSubmitting = false;
    }
  }

  /**
   * Obtener label del plan
   */
  private getPlanLabel(plan: TenantPlan): string {
    const planConfig = this.planOptions.find(p => p.value === plan);
    return planConfig?.label || plan;
  }

  /**
   * Obtener dashboards seleccionados
   */
  private getSelectedDashboards(): string[] {
    return this.dashboardOptions
      .filter(d => d.checked)
      .map(d => d.id);
  }

  /**
   * Toggle dashboard
   */
  toggleDashboard(dashboardId: string): void {
    const dashboard = this.dashboardOptions.find(d => d.id === dashboardId);
    if (dashboard) {
      dashboard.checked = !dashboard.checked;
    }
  }

  /**
   * Cerrar modal
   */
  onClose(): void {
    if (this.isSubmitting) return;

    if (this.createForm.dirty) {
      this.notificationService.confirm(
        'Cancelar Creación',
        '¿Estás seguro de cancelar? Los cambios se perderán.',
        () => {
          this.close.emit();
        },
        'Sí, cancelar',
        'Continuar editando',
        'warning'
      );
    } else {
      this.close.emit();
    }
  }

  /**
   * Prevenir cierre al hacer click dentro del modal
   */
  onModalClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  /**
   * Marcar todos los campos como touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Verificar si un campo tiene error
   */
  hasError(fieldName: string): boolean {
    const control = this.createForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  /**
   * Obtener mensaje de error
   */
  getErrorMessage(fieldName: string): string {
    const control = this.createForm.get(fieldName);

    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }

    if (control?.hasError('email')) {
      return 'Email inválido';
    }

    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }

    if (control?.hasError('pattern')) {
      if (fieldName === 'rfc') {
        return 'Formato de RFC inválido';
      }
      if (fieldName === 'proveedorIdInterno') {
        return 'Formato debe ser PROV-XXX';
      }
    }

    return 'Campo inválido';
  }
}
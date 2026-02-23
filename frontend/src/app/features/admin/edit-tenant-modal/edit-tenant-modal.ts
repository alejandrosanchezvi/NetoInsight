// 🏢 NetoInsight - Edit Tenant Modal (CON NOTIFICACIONES)

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TenantService } from '../../../core/services/tenant.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Tenant, TenantPlan, UpdateTenantDTO, PLAN_CONFIGS } from '../../../core/models/tenant.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-edit-tenant-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-tenant-modal.html',
  styleUrls: ['./edit-tenant-modal.css']
})
export class EditTenantModal implements OnInit {
  
  @Input() tenant!: Tenant;
  @Output() close = new EventEmitter<void>();
  @Output() tenantUpdated = new EventEmitter<void>();

  editForm: FormGroup;
  isSubmitting = false;
  errorMessage = '';

  // Opciones actualizadas
  planOptions = PLAN_CONFIGS;

  dashboardOptions = [
    { id: 'categorization', label: 'Categorización', checked: false },
    { id: 'stores', label: 'Tiendas', checked: false },
    { id: 'skus', label: 'SKUs', checked: false },
    { id: 'stocks', label: 'Stocks', checked: false },
    { id: 'purchase-orders', label: 'Órdenes de Compra', checked: false }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private tenantService: TenantService,
    private notificationService: NotificationService
  ) {
    this.editForm = this.fb.group({
      legalName: [''],
      rfc: ['', [Validators.pattern(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/)]],
      plan: ['', Validators.required],
      maxLicenses: [0, [Validators.required, Validators.min(1)]],
      tableauGroup: [''],
      bigQueryDataset: [''],
      bigQueryFilter: [''],
      adminEmail: ['', [Validators.required, Validators.email]],
      billingEmail: ['', Validators.email],
      contractStart: [''],
      contractEnd: ['']
    });
  }

  ngOnInit(): void {
    console.log('🏢 [EDIT-TENANT] Initializing:', this.tenant.name);
    this.loadTenantData();
    
    // Actualizar maxLicenses cuando cambia el plan
    this.editForm.get('plan')?.valueChanges.subscribe(plan => {
      const selectedPlan = this.planOptions.find(p => p.value === plan);
      if (selectedPlan) {
        this.editForm.patchValue({ maxLicenses: selectedPlan.maxLicenses });
      }
    });
  }

  private loadTenantData(): void {
    this.editForm.patchValue({
      legalName: this.tenant.legalName || '',
      rfc: this.tenant.rfc || '',
      plan: this.tenant.plan,
      maxLicenses: this.tenant.maxLicenses,
      tableauGroup: this.tenant.tableauGroup,
      bigQueryDataset: this.tenant.bigQueryDataset || '',
      bigQueryFilter: this.tenant.bigQueryFilter || '',
      adminEmail: this.tenant.adminEmail,
      billingEmail: this.tenant.billingEmail || '',
      contractStart: this.tenant.contractStart || '',
      contractEnd: this.tenant.contractEnd || ''
    });

    // Cargar dashboards seleccionados
    if (this.tenant.features?.dashboards) {
      this.dashboardOptions.forEach(option => {
        option.checked = this.tenant.features.dashboards.includes(option.id);
      });
    }
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
   * Obtener dashboards seleccionados
   */
  private getSelectedDashboards(): string[] {
    return this.dashboardOptions
      .filter(d => d.checked)
      .map(d => d.id);
  }

  /**
   * Enviar formulario
   */
  async onSubmit(): Promise<void> {
    if (this.editForm.invalid) {
      this.markFormGroupTouched(this.editForm);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    console.log('🏢 [EDIT-TENANT] Updating tenant:', this.tenant.tenantId);

    try {
      const formValue = this.editForm.value;
      const currentUser = this.authService.getCurrentUser();

      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      // Preparar DTO de actualización
      const updateDTO: UpdateTenantDTO = {
        legalName: formValue.legalName?.trim() || this.tenant.name,
        plan: formValue.plan as TenantPlan,
        maxLicenses: formValue.maxLicenses,
        features: {
          dashboards: this.getSelectedDashboards(),
          exports: true,
          api: formValue.plan === TenantPlan.ENTERPRISE || formValue.plan === TenantPlan.INTERNAL,
          customReports: formValue.plan === TenantPlan.ENTERPRISE || formValue.plan === TenantPlan.INTERNAL
        },
        tableauGroup: formValue.tableauGroup.trim(),
        adminEmail: formValue.adminEmail.trim()
      };

      // Agregar campos opcionales solo si tienen valor
      if (formValue.rfc?.trim()) {
        updateDTO.rfc = formValue.rfc.trim();
      }
      
      if (formValue.bigQueryDataset?.trim()) {
        updateDTO.bigQueryDataset = formValue.bigQueryDataset.trim();
      }
      
      if (formValue.bigQueryFilter?.trim()) {
        updateDTO.bigQueryFilter = formValue.bigQueryFilter.trim();
      }
      
      if (formValue.billingEmail?.trim()) {
        updateDTO.billingEmail = formValue.billingEmail.trim();
      }
      
      if (formValue.contractStart) {
        updateDTO.contractStart = formValue.contractStart;
      }
      
      if (formValue.contractEnd) {
        updateDTO.contractEnd = formValue.contractEnd;
      }

      // Actualizar tenant
      await this.tenantService.updateTenant(
        this.tenant.tenantId,
        updateDTO,
        currentUser.uid
      );

      console.log('✅ [EDIT-TENANT] Tenant updated successfully');

      // Emitir evento
      this.tenantUpdated.emit();

      // Mostrar éxito
      this.notificationService.success(
        'Proveedor Actualizado',
        `${this.tenant.name} ha sido actualizado correctamente.`
      );

    } catch (error: any) {
      console.error('❌ [EDIT-TENANT] Error updating tenant:', error);
      this.errorMessage = error.message || 'Error al actualizar proveedor';
      
      this.notificationService.error(
        'Error al Actualizar',
        this.errorMessage
      );
      
      this.isSubmitting = false;
    }
  }

  /**
   * Cerrar modal
   */
  onClose(): void {
    if (this.isSubmitting) return;

    if (this.editForm.dirty) {
      this.notificationService.confirm(
        'Cancelar Edición',
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
    const control = this.editForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  /**
   * Obtener mensaje de error
   */
  getErrorMessage(fieldName: string): string {
    const control = this.editForm.get(fieldName);
    
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    
    if (control?.hasError('email')) {
      return 'Email inválido';
    }
    
    if (control?.hasError('min')) {
      const min = control.errors?.['min'].min;
      return `El valor mínimo es ${min}`;
    }
    
    if (control?.hasError('pattern')) {
      if (fieldName === 'rfc') {
        return 'Formato de RFC inválido';
      }
    }
    
    return 'Campo inválido';
  }
}
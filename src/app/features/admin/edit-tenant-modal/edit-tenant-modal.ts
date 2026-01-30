// 🏢 NetoInsight - Edit Tenant Modal Component

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TenantService } from '../../../core/services/tenant.service';
import { Tenant, TenantPlan, UpdateTenantDTO } from '../../../core/models/tenant.model';
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

  planOptions = [
    { value: 'free', label: 'Gratis', maxLicenses: 3 },
    { value: 'pro', label: 'Pro', maxLicenses: 10 },
    { value: 'enterprise', label: 'Enterprise', maxLicenses: 50 },
    { value: 'internal', label: 'Interno', maxLicenses: 100 }
  ];

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
    private tenantService: TenantService
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

    if (this.tenant.features?.dashboards) {
      this.dashboardOptions.forEach(dashboard => {
        dashboard.checked = this.tenant.features.dashboards.includes(dashboard.id);
      });
    }
  }

  toggleDashboard(dashboardId: string): void {
    const dashboard = this.dashboardOptions.find(d => d.id === dashboardId);
    if (dashboard) dashboard.checked = !dashboard.checked;
  }

  private getSelectedDashboards(): string[] {
    return this.dashboardOptions.filter(d => d.checked).map(d => d.id);
  }

  async onSubmit(): Promise<void> {
    if (this.editForm.invalid) {
      this.markFormGroupTouched(this.editForm);
      this.errorMessage = 'Por favor completa todos los campos requeridos';
      return;
    }

    const newMaxLicenses = this.editForm.get('maxLicenses')?.value;
    if (newMaxLicenses < this.tenant.usedLicenses) {
      this.errorMessage = `No puedes reducir las licencias a ${newMaxLicenses}. Actualmente hay ${this.tenant.usedLicenses} en uso.`;
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const formValue = this.editForm.value;

      const updateDTO: UpdateTenantDTO = {
        plan: formValue.plan as TenantPlan,
        maxLicenses: formValue.maxLicenses,
        features: {
          dashboards: this.getSelectedDashboards(),
          exports: true,
          api: formValue.plan === 'enterprise' || formValue.plan === 'internal',
          customReports: formValue.plan === 'enterprise' || formValue.plan === 'internal'
        },
        tableauGroup: formValue.tableauGroup?.trim(),
        adminEmail: formValue.adminEmail.trim()
      };

      if (formValue.legalName?.trim()) updateDTO.legalName = formValue.legalName.trim();
      if (formValue.rfc?.trim()) updateDTO.rfc = formValue.rfc.trim();
      if (formValue.bigQueryDataset?.trim()) updateDTO.bigQueryDataset = formValue.bigQueryDataset.trim();
      if (formValue.bigQueryFilter?.trim()) updateDTO.bigQueryFilter = formValue.bigQueryFilter.trim();
      if (formValue.billingEmail?.trim()) updateDTO.billingEmail = formValue.billingEmail.trim();
      if (formValue.contractStart) updateDTO.contractStart = formValue.contractStart;
      if (formValue.contractEnd) updateDTO.contractEnd = formValue.contractEnd;

      const currentUser = this.authService.getCurrentUser();

      await this.tenantService.updateTenant(this.tenant.tenantId, updateDTO, currentUser?.uid || 'system');
      
      this.tenantUpdated.emit();
      alert(`✅ Proveedor actualizado: ${this.tenant.name}`);

    } catch (error: any) {
      console.error('❌ [EDIT-TENANT] Error:', error);
      this.errorMessage = error.message || 'Error al actualizar proveedor';
    } finally {
      this.isSubmitting = false;
    }
  }

  onClose(): void {
    if (this.isSubmitting) return;
    if (this.editForm.dirty && !confirm('¿Cancelar? Los cambios se perderán.')) return;
    this.close.emit();
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      formGroup.get(key)?.markAsTouched();
    });
  }

  hasError(fieldName: string): boolean {
    const control = this.editForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  getErrorMessage(fieldName: string): string {
    const control = this.editForm.get(fieldName);
    if (control?.hasError('required')) return 'Este campo es requerido';
    if (control?.hasError('email')) return 'Email inválido';
    if (control?.hasError('pattern') && fieldName === 'rfc') return 'RFC inválido';
    if (control?.hasError('min')) return 'Debe ser mayor a 0';
    return '';
  }
}
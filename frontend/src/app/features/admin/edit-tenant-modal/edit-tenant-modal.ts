// 🏢 NetoInsight - Edit Tenant Modal v2.1
// Removido: Plan de Suscripción, Tableau Group, BigQuery Dataset/Filter,
//           Inicio/Fin de Contrato, Dashboards Permitidos

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TenantService } from '../../../core/services/tenant.service';
import { NotificationService } from '../../../core/services/notification.service';
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

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private tenantService: TenantService,
    private notificationService: NotificationService
  ) {
    this.editForm = this.fb.group({
      // Información Básica
      legalName: [''],
      rfc: ['', [Validators.pattern(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/)]],
      // Contacto
      adminEmail: ['', [Validators.required, Validators.email]],
      billingEmail: ['', Validators.email],
    });
  }

  ngOnInit(): void {
    this.editForm.patchValue({
      legalName: this.tenant.legalName || '',
      rfc: this.tenant.rfc || '',
      adminEmail: this.tenant.adminEmail || '',
      billingEmail: this.tenant.billingEmail || '',
    });
  }

  async onSubmit(): Promise<void> {
    if (this.editForm.invalid) {
      Object.keys(this.editForm.controls).forEach(k => this.editForm.get(k)?.markAsTouched());
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const fv = this.editForm.value;
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) throw new Error('Usuario no autenticado');

      const updateDTO: UpdateTenantDTO = {
        legalName: fv.legalName?.trim() || this.tenant.name,
        adminEmail: fv.adminEmail.trim(),
        // Mantener features/dashboards existentes sin cambiarlos
        features: this.tenant.features,
        // Mantener plan y licencias sin cambiarlos
        plan: this.tenant.plan,
        maxLicenses: this.tenant.maxLicenses,
      };

      if (fv.rfc?.trim()) updateDTO.rfc = fv.rfc.trim().toUpperCase();
      if (fv.billingEmail?.trim()) updateDTO.billingEmail = fv.billingEmail.trim();

      await this.tenantService.updateTenant(this.tenant.tenantId, updateDTO, currentUser.uid);

      this.tenantUpdated.emit();
      this.notificationService.success('Proveedor Actualizado', `${this.tenant.name} actualizado correctamente.`);

    } catch (error: any) {
      console.error('❌ [EDIT-TENANT]', error);
      this.errorMessage = error.message || 'Error al actualizar proveedor';
      this.notificationService.error('Error al Actualizar', this.errorMessage);
      this.isSubmitting = false;
    }
  }

  onClose(): void {
    if (this.isSubmitting) return;
    if (this.editForm.dirty) {
      this.notificationService.confirm(
        'Cancelar Edición',
        '¿Estás seguro de cancelar? Los cambios se perderán.',
        () => this.close.emit(),
        'Sí, cancelar', 'Continuar editando', 'warning'
      );
    } else {
      this.close.emit();
    }
  }

  onModalClick(e: MouseEvent): void { e.stopPropagation(); }

  hasError(field: string): boolean {
    const c = this.editForm.get(field);
    return !!(c?.invalid && c.touched);
  }

  getErrorMessage(field: string): string {
    const c = this.editForm.get(field);
    if (c?.hasError('required')) return 'Este campo es requerido';
    if (c?.hasError('email')) return 'Email inválido';
    if (c?.hasError('pattern') && field === 'rfc') return 'Formato de RFC inválido';
    return 'Campo inválido';
  }
}
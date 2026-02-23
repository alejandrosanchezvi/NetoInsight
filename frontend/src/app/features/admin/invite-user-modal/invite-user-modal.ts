// 🔧 NetoInsight - Invite User Modal Component (CORREGIDO)

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InvitationService } from '../../../core/services/invitation.service';
import { Tenant } from '../../../core/models/tenant.model';
import { UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-invite-user-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './invite-user-modal.html',
  styleUrls: ['./invite-user-modal.css']
})
export class InviteUserModal implements OnInit {
  
  @Input() tenant!: Tenant;
  @Output() close = new EventEmitter<void>();
  @Output() invitationSent = new EventEmitter<void>();  // ← Nombre correcto

  inviteForm: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  roles = [
    { value: UserRole.VIEWER, label: 'Visualizador', description: 'Solo puede ver dashboards' },
    { value: UserRole.ADMIN, label: 'Administrador', description: 'Puede invitar usuarios y gestionar el equipo' }
  ];

  constructor(
    private fb: FormBuilder,
    private invitationService: InvitationService
  ) {
    this.inviteForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      role: [UserRole.VIEWER, Validators.required]
    });
  }

  ngOnInit(): void {
    console.log('🔧 [INVITE-MODAL] Initialized for tenant:', this.tenant.name);
  }

  /**
   * Enviar invitación
   */
  async onSubmit(): Promise<void> {
    if (this.inviteForm.invalid) {
      this.markFormGroupTouched(this.inviteForm);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { email, role } = this.inviteForm.value;

    console.log('🔧 [INVITE-MODAL] Sending invitation to:', email);

    try {
      const invitation = await this.invitationService.createInvitation({
        email: email.toLowerCase(),
        role,
        tenantId: this.tenant.tenantId
      });

      console.log('✅ [INVITE-MODAL] Invitation created:', invitation.id);
      
      this.successMessage = `Invitación enviada a ${email}`;
      
      // Esperar 1.5 segundos para mostrar mensaje de éxito, luego cerrar
      setTimeout(() => {
        this.invitationSent.emit();  // ← Emitir evento correcto
        this.close.emit();            // ← Cerrar el modal
      }, 1500);

    } catch (error: any) {
      console.error('❌ [INVITE-MODAL] Error creating invitation:', error);
      this.errorMessage = error.message || 'Error al enviar la invitación';
      this.isSubmitting = false;
    }
  }

  /**
   * Cerrar modal
   */
  onClose(): void {
    if (!this.isSubmitting) {
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
   * Obtener mensaje de error para un campo
   */
  getErrorMessage(fieldName: string): string {
    const control = this.inviteForm.get(fieldName);
    
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    
    if (control?.hasError('email')) {
      return 'Email inválido';
    }
    
    return '';
  }

  /**
   * Verificar si un campo tiene error
   */
  hasError(fieldName: string): boolean {
    const control = this.inviteForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }
}
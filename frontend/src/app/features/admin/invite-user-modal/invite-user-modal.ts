// 📧 NetoInsight - Invite User Modal v3.0 — Magic Link + Email

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InvitationService, InvitationResult } from '../../../core/services/invitation.service';
import { Tenant } from '../../../core/models/tenant.model';
import { UserRole } from '../../../core/models/user.model';

type ModalStep = 'form' | 'result';

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
  @Output() invitationSent = new EventEmitter<void>();

  inviteForm: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  step: ModalStep = 'form';

  // Resultado tras crear invitación
  result: InvitationResult | null = null;
  linkCopied = false;
  slackCopied = false;

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
    console.log('🔧 [INVITE-MODAL] v3.0 initialized for tenant:', this.tenant.name);
  }

  // ─────────────────────────────────────────────────────────────
  //  SUBMIT
  // ─────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.inviteForm.invalid) {
      this.markFormGroupTouched(this.inviteForm);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const { email, role } = this.inviteForm.value;

    try {
      const result = await this.invitationService.createInvitation({
        email: email.toLowerCase(),
        role,
        tenantId: this.tenant.tenantId
      });

      this.result = result;
      this.step = 'result';
      this.invitationSent.emit();

      console.log('✅ [INVITE-MODAL] Invitation created. Email sent:', result.emailSent);

    } catch (error: any) {
      console.error('❌ [INVITE-MODAL] Error:', error);
      this.errorMessage = error.message || 'Error al crear la invitación';
    } finally {
      this.isSubmitting = false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  COPY ACTIONS
  // ─────────────────────────────────────────────────────────────

  async copyMagicLink(): Promise<void> {
    if (!this.result?.magicLink) return;
    try {
      await navigator.clipboard.writeText(this.result.magicLink);
      this.linkCopied = true;
      setTimeout(() => (this.linkCopied = false), 2500);
    } catch {
      this.fallbackCopy(this.result.magicLink);
    }
  }

  async copySlackMessage(): Promise<void> {
    if (!this.result?.slackMessage) return;
    try {
      await navigator.clipboard.writeText(this.result.slackMessage);
      this.slackCopied = true;
      setTimeout(() => (this.slackCopied = false), 2500);
    } catch {
      this.fallbackCopy(this.result.slackMessage);
    }
  }

  private fallbackCopy(text: string): void {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // ─────────────────────────────────────────────────────────────
  //  NAVIGATION
  // ─────────────────────────────────────────────────────────────

  onClose(): void {
    if (!this.isSubmitting) {
      this.close.emit();
    }
  }

  onModalClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  // ─────────────────────────────────────────────────────────────
  //  FORM HELPERS
  // ─────────────────────────────────────────────────────────────

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      formGroup.get(key)?.markAsTouched();
    });
  }

  getErrorMessage(fieldName: string): string {
    const control = this.inviteForm.get(fieldName);
    if (control?.hasError('required')) return 'Este campo es requerido';
    if (control?.hasError('email')) return 'Email inválido';
    return '';
  }

  hasError(fieldName: string): boolean {
    const control = this.inviteForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  // ─────────────────────────────────────────────────────────────
  //  DISPLAY HELPERS
  // ─────────────────────────────────────────────────────────────

  getExpiresFormatted(): string {
    if (!this.result) return '';
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' })
      .format(this.result.invitation.expiresAt);
  }
}
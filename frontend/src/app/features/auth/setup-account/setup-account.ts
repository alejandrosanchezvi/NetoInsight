// 🔐 NetoInsight - Setup Account Component (CORREGIDO)

import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, createUserWithEmailAndPassword, UserCredential } from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { InvitationService } from '../../../core/services/invitation.service';
import { TenantService } from '../../../core/services/tenant.service';
import { AuthService } from '../../../core/services/auth.service';
import { Invitation } from '../../../core/models/invitation.model';
import { UserRole } from '../../../core/models/user.model';
import { TotpSecret } from '@angular/fire/auth';

@Component({
  selector: 'app-setup-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './setup-account.html',
  styleUrls: ['./setup-account.css'],
})
export class SetupAccount implements OnInit {
  @Input() invitation!: Invitation;

  setupForm: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  showPassword = false;
  showConfirmPassword = false;

  // MFA Setup State
  step: 'ACCOUNT' | 'MFA_SETUP' = 'ACCOUNT';
  qrCodeUrl: string | null = null;
  totpSecret: TotpSecret | null = null;
  mfaCode = '';
  qrCodeError = '';

  // Password strength
  passwordStrength: 'weak' | 'medium' | 'strong' = 'weak';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private auth: Auth,
    private firestore: Firestore,
    private invitationService: InvitationService,
    private tenantService: TenantService,
    private authService: AuthService,
  ) {
    this.setupForm = this.fb.group(
      {
        name: ['', [Validators.required, Validators.minLength(3)]],
        password: ['', [Validators.required, Validators.minLength(12), this.passwordValidator]],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  ngOnInit(): void {
    console.log('🔐 [SETUP-ACCOUNT] Initialized for:', this.invitation.email);
  }

  /**
   * Validador custom de password
   */
  private passwordValidator(control: any) {
    const value = control.value;

    if (!value) return null;

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumeric = /[0-9]/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);

    const valid = hasUpperCase && hasLowerCase && hasNumeric && hasSpecial;

    if (!valid) {
      return {
        passwordStrength: 'La contraseña debe tener mayúsculas, minúsculas, números y símbolos',
      };
    }

    return null;
  }

  /**
   * Validador de passwords coincidentes
   */
  private passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  /**
   * Calcular fuerza de contraseña
   */
  calculatePasswordStrength(): void {
    const password = this.setupForm.get('password')?.value || '';

    let strength = 0;

    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    if (password.length >= 16) strength++;

    if (strength <= 2) {
      this.passwordStrength = 'weak';
    } else if (strength <= 4) {
      this.passwordStrength = 'medium';
    } else {
      this.passwordStrength = 'strong';
    }
  }

  /**
   * ✅ Métodos para validaciones en template
   */
  hasMinLength(): boolean {
    const password = this.setupForm.get('password')?.value || '';
    return password.length >= 12;
  }

  hasUpperCase(): boolean {
    const password = this.setupForm.get('password')?.value || '';
    return /[A-Z]/.test(password);
  }

  hasLowerCase(): boolean {
    const password = this.setupForm.get('password')?.value || '';
    return /[a-z]/.test(password);
  }

  hasNumber(): boolean {
    const password = this.setupForm.get('password')?.value || '';
    return /[0-9]/.test(password);
  }

  hasSymbol(): boolean {
    const password = this.setupForm.get('password')?.value || '';
    return /[!@#$%^&*(),.?":{}|<>]/.test(password);
  }

  /**
   * Enviar formulario
   */
  async onSubmit(): Promise<void> {
    if (this.setupForm.invalid) {
      this.markFormGroupTouched(this.setupForm);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const { name, password } = this.setupForm.value;

    console.log('🔐 [SETUP-ACCOUNT] Creating account for:', this.invitation.email);

    try {
      // 1. Crear usuario en Firebase Auth
      console.log('🔐 [SETUP-ACCOUNT] Creating Firebase Auth user...');
      const credential: UserCredential = await createUserWithEmailAndPassword(
        this.auth,
        this.invitation.email,
        password,
      );

      const uid = credential.user.uid;
      console.log('✅ [SETUP-ACCOUNT] Firebase Auth user created:', uid);

      // 2. Crear documento en Firestore users
      // 2. Obtener tenant para verificar si es interno
      console.log('🔐 [SETUP-ACCOUNT] Checking tenant...');
      const tenant = await this.tenantService.getTenantById(this.invitation.tenantId);
      const isInternalUser = tenant?.plan === 'internal';
      console.log('🔐 [SETUP-ACCOUNT] Is internal user:', isInternalUser);

      // 3. Crear documento en Firestore users
      console.log('🔐 [SETUP-ACCOUNT] Creating Firestore user document...');
      const userDocRef = doc(this.firestore, 'users', uid);
      await setDoc(userDocRef, {
        uid,
        email: this.invitation.email,
        name,
        role: this.invitation.role,
        tenantId: this.invitation.tenantId,
        tenantName: this.invitation.tenantName,
        isInternal: isInternalUser, // ✅ CORREGIDO - detecta automáticamente
        isActive: true,
        mfaEnabled: false,
        invitationId: this.invitation.id,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });

      console.log('✅ [SETUP-ACCOUNT] Firestore user document created');

      // 3. Marcar invitación como aceptada
      console.log('🔐 [SETUP-ACCOUNT] Marking invitation as accepted...');
      await this.invitationService.acceptInvitation(this.invitation.id, uid);
      console.log('✅ [SETUP-ACCOUNT] Invitation marked as accepted');

      // 4. Incrementar licencias usadas del tenant
      console.log('🔐 [SETUP-ACCOUNT] Updating tenant licenses...');
      await this.tenantService.updateUsedLicenses(this.invitation.tenantId, 1);
      console.log('✅ [SETUP-ACCOUNT] Tenant licenses updated');

      // 5. Auto-login
      console.log('🔐 [SETUP-ACCOUNT] Auto-login...');
      await this.authService.login(this.invitation.email, password);
      console.log('✅ [SETUP-ACCOUNT] User logged in');

      // 6. Redirigir directamente al inicio (MFA deshabilitado temporalmente)
      console.log('✅ [SETUP-ACCOUNT] Account setup complete! Redirecting...');
      this.isSubmitting = false;
      this.router.navigate(['/categorization']);

    } catch (error: any) {
      console.error('❌ [SETUP-ACCOUNT] Error creating account:', error);

      // Mensajes de error amigables
      if (error.code === 'auth/email-already-in-use') {
        this.errorMessage = 'Este email ya está registrado. Intenta iniciar sesión.';
      } else if (error.code === 'auth/weak-password') {
        this.errorMessage = 'La contraseña es muy débil.';
      } else {
        this.errorMessage = error.message || 'Error al crear la cuenta';
      }

      this.isSubmitting = false;
    }
  }

  /**
   * Enviar código MFA para terminar configuración
   */
  async onMfaSubmit(): Promise<void> {
    if (this.mfaCode.length !== 6 || !this.totpSecret) {
      this.qrCodeError = 'Código inválido.';
      return;
    }

    this.isSubmitting = true;
    this.qrCodeError = '';

    try {
      const user = this.auth.currentUser;
      if (!user) throw new Error('Usuario no encontrado en sesión activa');

      await this.authService.enrollTotp(user, this.totpSecret, this.mfaCode);
      
      console.log('✅ [SETUP-ACCOUNT] Account and MFA setup complete! Redirecting...');
      this.router.navigate(['/categorization']);
    } catch (error: any) {
      console.error('❌ [SETUP-ACCOUNT] Error setting up MFA:', error);
      this.isSubmitting = false;
      this.qrCodeError = error.message || 'Código incorrecto. Intenta de nuevo.';
    }
  }

  /**
   * Omitir configuración MFA
   */
  skipMfa(): void {
    console.log('⏩ [SETUP-ACCOUNT] Skipping MFA setup. Redirecting...');
    this.router.navigate(['/categorization']);
  }

  /**
   * Toggle mostrar/ocultar password
   */
  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  /**
   * Marcar todos los campos como touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach((key) => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Obtener mensaje de error
   */
  getErrorMessage(fieldName: string): string {
    const control = this.setupForm.get(fieldName);

    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }

    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }

    if (control?.hasError('passwordStrength')) {
      return control.errors?.['passwordStrength'];
    }

    if (fieldName === 'confirmPassword' && this.setupForm.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden';
    }

    return '';
  }

  /**
   * Verificar si un campo tiene error
   */
  hasError(fieldName: string): boolean {
    const control = this.setupForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }
}

// 🔐 NetoInsight - Login Component (CON FORGOT PASSWORD)

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MultiFactorResolver } from '@angular/fire/auth';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { ForgotPasswordModal } from '../forgot-password/forgot-password-modal';
import { MfaSettingsModal } from '../../../shared/components/mfa-settings/mfa-settings-modal';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ForgotPasswordModal, MfaSettingsModal],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';
  returnUrl = '/categorization';

  // MFA Form (Verify)
  showMfaStep = false;
  mfaCode = '';
  resolver: MultiFactorResolver | null = null;

  // Force MFA Modal (Enrollment)
  showForceMfaModal = false;

  // Modal de recuperación
  showForgotPassword = false;

  // Toggle visibilidad contraseña
  showPassword = false;

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/categorization';

    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.returnUrl]);
    }
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor ingresa email y contraseña';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (user) => {
        console.log('✅ [LOGIN] Login exitoso:', user.email);
        this.isLoading = false;

        // Deshabilitado temporalmente: MFA Forzado
        // if (user.mfaRequired && !user.mfaEnabled) {
        //   console.log('⚠️ [LOGIN] Administrador requiere MFA. Forzando enrolamiento.');
        //   this.sessionService.startSession();
        //   this.showForceMfaModal = true;
        //   return;
        // }

        this.sessionService.startSession();
        this.router.navigate([this.returnUrl]);
      },
      error: (error) => {
        this.isLoading = false;

        // Deshabilitado temporalmente: MFA Requerido (Verificación)
        // if (error.isMfaRequired) {
        //   console.log('🛡️ [LOGIN] MFA Requerido. Pasando a pantalla de código.');
        //   this.showMfaStep = true;
        //   this.resolver = error.resolver;
        //   return;
        // }

        console.error('❌ [LOGIN] Error:', error);
        this.errorMessage = error.message || 'Error al iniciar sesión';
      }
    });
  }

  async onMfaSubmit(): Promise<void> {
    if (!this.mfaCode || this.mfaCode.length !== 6 || !this.resolver) {
      this.errorMessage = 'Ingresa un código válido de 6 dígitos';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const user = await this.authService.verifyTotpForLogin(this.resolver, this.mfaCode);
      console.log('✅ [LOGIN] Login con MFA exitoso:', user.email);
      this.isLoading = false;
      this.sessionService.startSession();
      this.router.navigate([this.returnUrl]);
    } catch (error: any) {
      console.error('❌ [LOGIN] MFA Error:', error);
      this.isLoading = false;
      this.errorMessage = error.message || 'Código incorrecto';
    }
  }

  cancelMfa(): void {
    this.showMfaStep = false;
    this.mfaCode = '';
    this.resolver = null;
    this.password = '';
  }

  quickLogin(email: string): void {
    this.email = email;
    this.password = 'demo';
    this.onSubmit();
  }

  openForgotPassword(): void {
    this.showForgotPassword = true;
  }

  closeForgotPassword(): void {
    this.showForgotPassword = false;
  }

  async closeForceMfaModal(): Promise<void> {
    this.showForceMfaModal = false;

    // Verificamos si completó el proceso (se actualiza el cache)
    const currentUser = this.authService.getCurrentUser();

    if (currentUser?.mfaEnabled) {
      console.log('✅ [LOGIN] Enrolamiento MFA forzado completado. Redirigiendo...');
      this.router.navigate([this.returnUrl]);
    } else {
      console.log('⚠️ [LOGIN] Enrolamiento MFA forzado cancelado. Cerrando sesión...');
      await this.authService.logout();
      this.errorMessage = 'Debes configurar la autenticación de 2 pasos para acceder.';
    }
  }
}
// 🔑 NetoInsight - Reset Password Page
// Recibe el oobCode de Firebase desde la URL y procesa el cambio de contraseña

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Auth,
  verifyPasswordResetCode,
  confirmPasswordReset
} from '@angular/fire/auth';

type PageStep = 'loading' | 'form' | 'success' | 'invalid' | 'expired';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css']
})
export class ResetPassword implements OnInit {

  step: PageStep   = 'loading';
  email            = '';
  oobCode          = '';

  // Form
  newPassword      = '';
  confirmPassword  = '';
  showPassword     = false;
  showConfirm      = false;
  isSubmitting     = false;
  errorMessage     = '';

  // Password strength
  strength: 'weak' | 'medium' | 'strong' = 'weak';

  constructor(
    private auth:  Auth,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    // Firebase redirige con: ?mode=resetPassword&oobCode=XXX
    this.route.queryParams.subscribe(async params => {
      const mode    = params['mode'];
      this.oobCode  = params['oobCode'] || '';

      if (mode !== 'resetPassword' || !this.oobCode) {
        this.step = 'invalid';
        return;
      }

      await this.verifyCode();
    });
  }

  // ── Verificar que el código sea válido ──────────────────────
  private async verifyCode(): Promise<void> {
    try {
      // Verifica el oobCode y devuelve el email asociado
      this.email = await verifyPasswordResetCode(this.auth, this.oobCode);
      console.log('✅ [RESET-PAGE] Code valid for:', this.email);
      this.step = 'form';
    } catch (error: any) {
      console.error('❌ [RESET-PAGE] Invalid code:', error.code);
      if (error.code === 'auth/expired-action-code') {
        this.step = 'expired';
      } else {
        this.step = 'invalid';
      }
    }
  }

  // ── Submit nuevo password ───────────────────────────────────
  async onSubmit(): Promise<void> {
    this.errorMessage = '';

    if (!this.newPassword) {
      this.errorMessage = 'Ingresa tu nueva contraseña';
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage = 'Mínimo 8 caracteres';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden';
      return;
    }

    this.isSubmitting = true;

    try {
      await confirmPasswordReset(this.auth, this.oobCode, this.newPassword);
      console.log('✅ [RESET-PAGE] Password changed for:', this.email);
      this.step = 'success';
    } catch (error: any) {
      console.error('❌ [RESET-PAGE] Error:', error.code);
      if (error.code === 'auth/expired-action-code') {
        this.step = 'expired';
      } else if (error.code === 'auth/weak-password') {
        this.errorMessage = 'La contraseña es muy débil. Usa al menos 8 caracteres.';
      } else {
        this.errorMessage = 'Ocurrió un error. Solicita un nuevo enlace.';
      }
      this.isSubmitting = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────
  calculateStrength(): void {
    const p = this.newPassword;
    let score = 0;
    if (p.length >= 8)  score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    if (score <= 2)      this.strength = 'weak';
    else if (score <= 3) this.strength = 'medium';
    else                 this.strength = 'strong';
  }

  get strengthLabel(): string {
    return { weak: 'Débil', medium: 'Media', strong: 'Fuerte' }[this.strength];
  }

  get passwordsMatch(): boolean {
    return this.newPassword.length > 0 &&
           this.confirmPassword.length > 0 &&
           this.newPassword === this.confirmPassword;
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  requestNewLink(): void {
    this.router.navigate(['/login']);
  }
}
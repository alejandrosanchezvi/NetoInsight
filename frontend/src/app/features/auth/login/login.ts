// 🔐 NetoInsight - Login Component (CON FORGOT PASSWORD)

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { ForgotPasswordModal } from '../forgot-password/forgot-password-modal';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ForgotPasswordModal],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  email       = '';
  password    = '';
  isLoading   = false;
  errorMessage = '';
  returnUrl   = '/categorization';

  // Modal de recuperación
  showForgotPassword = false;

  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

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

    this.isLoading    = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (user) => {
        console.log('✅ [LOGIN] Login exitoso:', user.email);
        this.isLoading = false;
        this.sessionService.startSession();
        this.router.navigate([this.returnUrl]);
      },
      error: (error) => {
        console.error('❌ [LOGIN] Error:', error);
        this.errorMessage = error.message || 'Error al iniciar sesión';
        this.isLoading = false;
      }
    });
  }

  quickLogin(email: string): void {
    this.email    = email;
    this.password = 'demo';
    this.onSubmit();
  }

  openForgotPassword(): void {
    this.showForgotPassword = true;
  }

  closeForgotPassword(): void {
    this.showForgotPassword = false;
  }
}
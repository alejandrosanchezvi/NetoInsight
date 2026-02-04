// 🔐 NetoInsight - Login Component (CORREGIDO)

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';
  returnUrl = '/categorization';

  // Usuarios disponibles para quick login
  quickUsers = [
    { email: 'juan.perez@bimbo.com', name: 'Juan Pérez (Bimbo)', icon: '🏭' },
    { email: 'maria.lopez@cocacola.com', name: 'María López (Coca-Cola)', icon: '🥤' },
    { email: 'admin@neto.com', name: 'Admin Neto (Interno)', icon: '👨‍💼' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Obtener returnUrl de query params
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/categorization';
    
    // Si ya está autenticado, redirigir
    if (this.authService.isAuthenticated()) {
      console.log('✅ [LOGIN] Ya autenticado, redirigiendo...');
      this.router.navigate([this.returnUrl]);
    }
  }

  /**
   * Login tradicional (CORREGIDO para usar Observable)
   */
  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor ingresa email y contraseña';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // AuthService.login() retorna Observable<User>
    this.authService.login(this.email, this.password).subscribe({
      next: (user) => {
        console.log('✅ [LOGIN] Login exitoso:', user.email);
        this.isLoading = false;
        this.router.navigate([this.returnUrl]);
      },
      error: (error) => {
        console.error('❌ [LOGIN] Error:', error);
        this.errorMessage = error.message || 'Error al iniciar sesión';
        this.isLoading = false;
      }
    });
  }

  /**
   * Quick login (para desarrollo)
   */
  quickLogin(email: string): void {
    this.email = email;
    this.password = 'demo';
    this.onSubmit();
  }
}
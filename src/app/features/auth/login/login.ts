// 🔐 NetoInsight - Login Component (Autocompletado Nativo)

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    console.log('🔐 [LOGIN] Login component initialized');
    
    // Si ya está autenticado, redirigir
    if (this.authService.isAuthenticated()) {
      console.log('✅ [LOGIN] User already authenticated, redirecting...');
      this.router.navigate(['/categorization']);
    }
  }

  /**
   * Manejar submit del formulario
   */
  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      console.warn('⚠️ [LOGIN] Form is invalid');
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;
    console.log('🔐 [LOGIN] Attempting login for:', email);

    try {
      const user = await this.authService.login(email, password);
      console.log('✅ [LOGIN] Login successful:', user.email);
      
      // Redirigir al dashboard
      this.router.navigate(['/categorization']);
      
    } catch (error: any) {
      console.error('❌ [LOGIN] Login failed:', error);
      this.errorMessage = error.message || 'Error al iniciar sesión';
      this.isLoading = false;
    }
  }

  /**
   * Toggle mostrar/ocultar contraseña
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Marcar todos los campos como touched para mostrar errores
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
    const control = this.loginForm.get(fieldName);
    
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    
    if (control?.hasError('email')) {
      return 'Email inválido';
    }
    
    if (control?.hasError('minlength')) {
      return 'Mínimo 6 caracteres';
    }
    
    return '';
  }

  /**
   * Verificar si un campo tiene error y fue tocado
   */
  hasError(fieldName: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }
}
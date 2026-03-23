// 🔑 NetoInsight - Forgot Password Modal (VÍA BACKEND + MAILSLURP)

import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

type ModalStep = 'form' | 'success' | 'error';

@Component({
  selector: 'app-forgot-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password-modal.html',
  styleUrls: ['./forgot-password-modal.css']
})
export class ForgotPasswordModal {
  @Output() closeModal = new EventEmitter<void>();

  email        = '';
  isLoading    = false;
  errorMessage = '';
  step: ModalStep = 'form';

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  async onSubmit(): Promise<void> {
    if (!this.email.trim()) {
      this.errorMessage = 'Por favor ingresa tu email';
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.errorMessage = 'Ingresa un email válido';
      return;
    }

    this.isLoading    = true;
    this.errorMessage = '';

    try {
      await firstValueFrom(
        this.http.post<{ success: boolean; message: string }>(
          `${this.apiUrl}/api/auth/send-password-reset`,
          {
            email:        this.email.trim().toLowerCase(),
            frontend_url: window.location.origin
          },
          { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
        )
      );

      // Siempre mostrar éxito (el backend nunca revela si el email existe)
      console.log('✅ [FORGOT-PWD] Reset request sent for:', this.email);
      this.step = 'success';

    } catch (error: any) {
      console.error('❌ [FORGOT-PWD] Error:', error);

      const status = error?.status;

      if (status === 429) {
        this.errorMessage = 'Demasiados intentos. Espera unos minutos.';
        this.step = 'error';
      } else if (status >= 500) {
        this.errorMessage = 'Error en el servidor. Intenta de nuevo más tarde.';
        this.step = 'error';
      } else {
        // Para cualquier otro error también mostrar éxito (seguridad)
        this.step = 'success';
      }
    } finally {
      this.isLoading = false;
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onClose();
    }
  }

  tryAgain(): void {
    this.step         = 'form';
    this.errorMessage = '';
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
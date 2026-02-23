// 📅 NetoInsight - Trial Info Component (VERSIÓN FINAL)

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { getTenantTrialDaysLeft } from '../../../core/models/tenant.model';

@Component({
  selector: 'app-trial-info',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="showInfo" class="trial-info" [ngClass]="getColorClass()">
      <div class="trial-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </div>
      <div class="trial-text">
        <p class="trial-label">PRUEBA GRATIS</p>
        <p class="trial-days">{{ getDaysText() }}</p>
      </div>
    </div>
  `,
  styles: [`
    /* Contenedor principal */
    .trial-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      margin: 0;
      border-left: 3px solid;
      border-radius: 4px;
      transition: all 0.3s ease;
    }

    /* ===== AZUL - 8 a 30 días ===== */
    .trial-info.info {
      background: rgba(59, 130, 246, 0.08);
      border-color: #3b82f6;
    }

    .trial-info.info .trial-icon {
      color: #3b82f6;
    }

    .trial-info.info .trial-label {
      color: #64748b;
    }

    .trial-info.info .trial-days {
      color: #1e293b;
    }

    /* ===== AMARILLO - 4 a 7 días ===== */
    .trial-info.warning {
      background: rgba(245, 158, 11, 0.08);
      border-color: #f59e0b;
    }

    .trial-info.warning .trial-icon {
      color: #f59e0b;
    }

    .trial-info.warning .trial-label {
      color: #92400e;
    }

    .trial-info.warning .trial-days {
      color: #78350f;
    }

    /* ===== ROJO - 0 a 3 días ===== */
    .trial-info.danger {
      background: rgba(239, 68, 68, 0.08);
      border-color: #ef4444;
    }

    .trial-info.danger .trial-icon {
      color: #ef4444;
    }

    .trial-info.danger .trial-label {
      color: #991b1b;
    }

    .trial-info.danger .trial-days {
      color: #7f1d1d;
    }

    /* ===== Elementos internos ===== */
    .trial-icon {
      flex-shrink: 0;
      transition: color 0.3s ease;
    }

    .trial-text {
      flex: 1;
      min-width: 0;
    }

    .trial-label {
      font-size: 0.75rem;
      font-weight: 600;
      margin: 0 0 0.125rem 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: color 0.3s ease;
    }

    .trial-days {
      font-size: 0.875rem;
      font-weight: 600;
      margin: 0;
      transition: color 0.3s ease;
    }
  `]
})
export class TrialInfoComponent implements OnInit {
  
  showInfo = false;
  daysLeft = 0;

  constructor(
    private authService: AuthService,
    private tenantService: TenantService
  ) {}

  async ngOnInit(): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    
    // No mostrar para usuarios internos de Neto
    if (!currentUser || currentUser.isInternal) {
      return;
    }

    try {
      const tenant = await this.tenantService.getTenantById(currentUser.tenantId);
      
      // Solo mostrar si es plan Trial
      if (!tenant || tenant.plan !== 'trial') {
        return;
      }

      // Calcular días restantes
      this.daysLeft = getTenantTrialDaysLeft(tenant);
      this.showInfo = true;

    } catch (error) {
      console.error('[TRIAL-INFO] Error loading tenant:', error);
    }
  }

  /**
   * Obtener clase de color según días restantes
   * 🔵 Azul: 8-30 días (normal)
   * 🟡 Amarillo: 4-7 días (advertencia)
   * 🔴 Rojo: 0-3 días (urgente)
   */
  getColorClass(): string {
    if (this.daysLeft <= 3) return 'danger';    // 🔴 Rojo
    if (this.daysLeft <= 7) return 'warning';   // 🟡 Amarillo
    return 'info';                               // 🔵 Azul
  }

  /**
   * Obtener texto de días restantes
   */
  getDaysText(): string {
    if (this.daysLeft === 0) {
      return 'Expirado hoy';
    }
    if (this.daysLeft === 1) {
      return '1 día restante';
    }
    return `${this.daysLeft} días restantes`;
  }
}
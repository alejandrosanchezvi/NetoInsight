// 📥 NetoInsight - Modal de Descarga de Mes Cerrado

import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableauDashboardService, TableauEmbedConfig, ClosedMonthSheet } from '../../../core/services/tableau-dashboard.service';

export type DownloadModalStep = 'confirming' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-download-closed-month-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './download-closed-month-modal.html',
  styleUrls: ['./download-closed-month-modal.css']
})
export class DownloadClosedMonthModal implements OnInit {

  /** Clave del dashboard para el servicio de Tableau */
  @Input() dashboardKey!: string;

  /** Hojas de Tableau a incluir en el Excel */
  @Input() sheets!: ClosedMonthSheet[];

  /** ID interno del proveedor */
  @Input() providerId!: string;

  /** Config del filtro de proveedor */
  @Input() embedConfig!: TableauEmbedConfig;

  /** Nombre del dashboard para mostrarlo en el modal */
  @Input() dashboardDisplayName: string = 'Dashboard';

  @Output() closeModal = new EventEmitter<void>();

  step: DownloadModalStep = 'confirming';
  progressMessage = '';
  errorMessage = '';

  // Datos del mes calculados en OnInit
  monthLabel = '';       // "Marzo 2026"
  monthName = '';       // "Marzo"
  year = 0;

  constructor(private tableau: TableauDashboardService) { }

  ngOnInit(): void {
    const { label, monthName, year } = this.tableau.getLastMonthRange();
    this.monthLabel = label;
    this.monthName = monthName;
    this.year = year;
  }

  async onConfirm(): Promise<void> {
    this.step = 'loading';
    this.progressMessage = 'Iniciando...';

    const result = await this.tableau.downloadClosedMonthData(
      this.dashboardKey,
      this.sheets,
      this.providerId,
      this.embedConfig,
      (step: string) => { this.progressMessage = step; }
    );

    if (result.success) {
      this.step = 'success';
    } else {
      this.step = 'error';
      this.errorMessage = result.error ?? 'Error desconocido';
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      // Solo cerrar si no está cargando
      if (this.step !== 'loading') {
        this.onClose();
      }
    }
  }

  retry(): void {
    this.step = 'confirming';
    this.errorMessage = '';
    this.progressMessage = '';
  }
}
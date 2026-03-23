// 📊 NetoInsight - Categorization Component (OPTIMIZADO v4)

import {
  Component, OnInit, AfterViewInit, ViewChild, ElementRef,
  OnDestroy, CUSTOM_ELEMENTS_SCHEMA, HostListener, Renderer2
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { TableauDashboardService } from '../../../core/services/tableau-dashboard.service';

@Component({
  selector: 'app-categorization',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './categorization.html',
  styleUrls: ['./categorization.css']
})
export class Categorization implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('tableauContainer', { static: false }) tableauContainer!: ElementRef;

  isLoading = true;
  currentProviderName = '';
  currentProviderId = '';
  authError = '';
  isFullscreen = false
  showExportMenu = false;

  private vizElement: any = null;
  private resizeObserver?: ResizeObserver;
  private destroy$ = new Subject<void>();
  private viewReady = false;

  private readonly CONTAINER_SELECTOR = '.categorization-container';
  private readonly DASHBOARD_KEY = 'categorization';

  constructor(
    private authService: AuthService,
    private tableau: TableauDashboardService,
    private renderer: Renderer2
  ) { }

  ngOnInit(): void {
    console.log('[Categorization] 🟢 ngOnInit');
    this.observeSidebarChanges();

    // ─────────────────────────────────────────────────────────────
    // PROBLEMA EN PRODUCCIÓN — condición de carrera Firebase/Angular:
    //
    // En producción el bundle está optimizado y Angular monta el
    // componente ANTES de que Firebase verifique la sesión. Entonces
    // getCurrentUser() devuelve null, currentProviderId queda vacío
    // y el dashboard carga sin filtro (o con el filtro guardado en
    // la vista de Tableau, que puede ser de otro proveedor).
    //
    // SOLUCIÓN: suscribirse a currentUser$ con filter+take(1) para
    // esperar la primera emisión con usuario válido. El flag viewReady
    // coordina con ngAfterViewInit para evitar cargar el dashboard
    // antes de que el DOM esté disponible.
    // ─────────────────────────────────────────────────────────────
    this.authService.currentUser$
      .pipe(
        filter(user => user !== null),
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe(user => {
        this.currentProviderName = user!.tenantName;
        this.currentProviderId = user!.proveedorIdInterno || '';
        console.log(`[Categorization] 👤 proveedor="${this.currentProviderId}" | nombre="${this.currentProviderName}"`);

        // Si el DOM ya está listo, cargar inmediatamente
        // Si no, ngAfterViewInit lo hará cuando esté listo
        if (this.viewReady) {
          this.initDashboard();
        }
      });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    console.log('[Categorization] 🟡 ngAfterViewInit');
    this.adjustForSidebar();

    // Solo cargar si el usuario ya está disponible (caso local/sesión rápida)
    // Si el usuario aún no llegó, la suscripción de ngOnInit lo hará
    if (this.currentProviderId !== '' || this.authService.getCurrentUser() !== null) {
      this.initDashboard();
    } else {
      console.log('[Categorization] ⏳ DOM listo — esperando usuario de Firebase...');
    }
  }

  ngOnDestroy(): void {
    console.log('[Categorization] 🔴 ngOnDestroy');
    this.destroy$.next();
    this.destroy$.complete();
    this.tableau.disposeViz(this.vizElement);
    this.vizElement = null;
    this.resizeObserver?.disconnect();
  }

  // ──────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────

  private async initDashboard(): Promise<void> {
    console.log(`[Categorization] 🚀 initDashboard — proveedor="${this.currentProviderId}"`);
    this.isLoading = true;
    this.authError = '';

    const result = await this.tableau.loadDashboard(
      this.tableauContainer.nativeElement,
      { dashboardKey: this.DASHBOARD_KEY, containerSelector: this.CONTAINER_SELECTOR },
      this.currentProviderId
    );

    this.vizElement = result.vizElement;
    this.authError = result.error ?? '';
    this.isLoading = false;

    if (!result.error) {
      this.adjustDashboardSize();
    } else {
      console.error(`[Categorization] ❌ Error: "${result.error}"`);
    }
  }

  // ──────────────────────────────────────────────
  // Resize / sidebar
  // ──────────────────────────────────────────────

  private observeSidebarChanges(): void {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;
    this.resizeObserver = new ResizeObserver(() => this.adjustForSidebar());
    this.resizeObserver.observe(mainContent);
    new MutationObserver(() => this.adjustForSidebar())
      .observe(mainContent, { attributes: true, attributeFilter: ['class'] });
  }

  private adjustForSidebar(): void {
    this.tableau.adjustContainerWidth(this.CONTAINER_SELECTOR);
  }

  private adjustDashboardSize(): void {
    if (this.vizElement) {
      this.vizElement.style.width = '100%';
      this.vizElement.style.height = '100%';
    }
    this.adjustForSidebar();
  }

  @HostListener('window:resize')
  onResize() { this.adjustDashboardSize(); }

  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  @HostListener('document:mozfullscreenchange')
  @HostListener('document:MSFullscreenChange')
  onFullscreenChange() {
    this.isFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  }

  // ──────────────────────────────────────────────
  // Acciones de toolbar
  // ──────────────────────────────────────────────

  getCurrentProviderName(): string { return this.currentProviderName || 'tus datos'; }

  async refreshDashboard(): Promise<void> {
    console.log('[Categorization] 🔄 refreshDashboard');
    this.tableau.invalidateJwtCache(this.DASHBOARD_KEY);
    this.tableau.disposeViz(this.vizElement);
    this.vizElement = null;
    await this.initDashboard();
  }

  toggleExportMenu(): void { this.showExportMenu = !this.showExportMenu; }
  async exportToPDF(): Promise<void> { this.showExportMenu = false; try { await this.vizElement?.displayDialogAsync('export-pdf'); } catch { } }
  async exportToImage(): Promise<void> { this.showExportMenu = false; try { await this.vizElement?.displayDialogAsync('export-image'); } catch { } }
  async exportData(): Promise<void> {
    this.showExportMenu = false;
    if (!this.vizElement) return;
    try {
      const activeSheet = this.vizElement.workbook?.activeSheet;
      // En un dashboard, activeSheet es tipo Dashboard. Tomamos la primera hoja con datos.
      const sheet = activeSheet?.worksheets?.[0] ?? activeSheet;
      if (!sheet) return;
      // getUnderlyingDataAsync retorna datos a nivel de fila (no agregados)
      const data = await sheet.getUnderlyingDataAsync({ includeAllColumns: true, ignoreSelection: true, maxRows: 0 });
      const headers = data.columns.map((col: any) => `"${col.fieldName}"`).join(',');
      const rows = data.data.map((row: any[]) =>
        row.map((val: any) => `"${String(val.formattedValue ?? val.value ?? '').replace(/"/g, '""')}"`).join(',')
      );
      const csvContent = [headers, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'categorization-data.csv';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { console.error('Error exportando CSV:', e); }
  }

  // Interceptar Ctrl+P del navegador y redirigir al PDF completo de Tableau
  @HostListener('window:beforeprint')
  onBeforePrint(): void { this.exportToPDF(); }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      this.exportToPDF();
    }
  }

  toggleFullscreen(): void {
    const c = document.querySelector(this.CONTAINER_SELECTOR) as HTMLElement;
    if (!c) return;
    if (!this.isFullscreen) {
      (c.requestFullscreen || (c as any).webkitRequestFullscreen)?.call(c);
    } else {
      (document.exitFullscreen || (document as any).webkitExitFullscreen)?.call(document);
    }
  }
}
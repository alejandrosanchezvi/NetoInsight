// 📊 NetoInsight - Categorization Component (OPTIMIZADO v4)

import {
  Component, OnInit, AfterViewInit, ViewChild, ElementRef,
  OnDestroy, CUSTOM_ELEMENTS_SCHEMA, HostListener, Renderer2
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { filter, take, takeUntil, skip } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { TableauDashboardService } from '../../../core/services/tableau-dashboard.service';
import { ImpersonationService } from '../../../core/services/impersonation.service';
import { buildCsv, downloadCsv } from '../../../core/utils/csv-export.util';
import { DownloadClosedMonthModal } from '../../../shared/components/download-closed-month-modal/download-closed-month-modal';

@Component({
  selector: 'app-categorization',
  standalone: true,
  imports: [CommonModule, DownloadClosedMonthModal],
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

  // Descarga mes cerrado
  readonly downloadSheets = [
    { wsName: 'Tabla-arts', tabName: 'Categorización' }
  ];

  showDownloadModal = false;
  canDownloadClosedMonth = false;
  isTrial = false;

  private vizElement: any = null;
  private resizeObserver?: ResizeObserver;
  private destroy$ = new Subject<void>();
  private viewReady = false;
  private tenantLoaded = false;

  private readonly CONTAINER_SELECTOR = '.categorization-container';
  private readonly DASHBOARD_KEY = 'categorization';

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private tableau: TableauDashboardService,
    private renderer: Renderer2,
    private impersonationService: ImpersonationService,
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
        this.currentProviderId = this.impersonationService.getEffectiveProviderId(user!.proveedorIdInterno || '');
        console.log(`[Categorization] 👤 proveedor="${this.currentProviderId}" | nombre="${this.currentProviderName}"`);

        // Cargar permiso de descarga de mes cerrado
        if (user!.tenantId) {
          this.tenantService.getTenantById(user!.tenantId).then(tenant => {
            this.canDownloadClosedMonth = tenant?.features?.canDownloadClosedMonth === true;
            this.isTrial = tenant?.plan === 'trial';
            console.log(`[Categorization] 📥 isTrial: ${this.isTrial} | canDownloadClosedMonth: ${this.canDownloadClosedMonth}`);
            // Cargar dashboard DESPUÉS de conocer isTrial
            if (this.viewReady) {
              this.initDashboard();
            }
          });
        }
      });

    this.impersonationService.impersonated$
      .pipe(skip(1), takeUntil(this.destroy$))
      .subscribe(imp => {
        const realUser = this.authService.getCurrentUser();
        this.currentProviderId = imp?.proveedorIdInterno ?? realUser?.proveedorIdInterno ?? '';
        if (imp) this.isTrial = imp.plan === 'trial';
        if (this.viewReady) this.refreshDashboard();
      });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    console.log('[Categorization] 🟡 ngAfterViewInit');
    this.adjustForSidebar();
    // initDashboard se llama desde el .then() del tenant, no aquí.
    // Así garantizamos que isTrial y canDownloadClosedMonth ya están listos.
    if (!this.tenantLoaded) {
      console.log('[Categorization] ⏳ DOM listo — esperando tenant de Firestore...');
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
      this.currentProviderId,
      this.isTrial
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
      // Buscamos específicamente la hoja 'tabla-arts'
      const sheet = activeSheet?.worksheets?.find((ws: any) => ws.name === 'Tabla-arts');
      if (!sheet) {
        console.error('[Categorization] ❌ No se encontró la hoja "Tabla-arts". Hojas disponibles:', activeSheet?.worksheets?.map((ws: any) => ws.name));
        return;
      }
      // getSummaryDataAsync retorna los datos tal como se ven en el viz (respeta filtros del dashboard)
      const data = await sheet.getSummaryDataAsync({ ignoreSelection: false });
      // buildCsv detecta y pivota automáticamente el formato Measure Names/Values
      const csvContent = buildCsv(data);
      downloadCsv(csvContent, 'categorization-data.csv');
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

  // ──────────────────────────────────────────────
  // Descarga de mes cerrado
  // ──────────────────────────────────────────────

  openDownloadModal(): void {
    this.showDownloadModal = true;
  }

  closeDownloadModal(): void {
    this.showDownloadModal = false;
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
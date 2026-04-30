// 📊 NetoInsight - Stocks Component (OPTIMIZADO v4)

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
  selector: 'app-stocks',
  standalone: true,
  imports: [CommonModule, DownloadClosedMonthModal],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './stocks.html',
  styleUrls: ['./stocks.css']
})
export class Stocks implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('tableauContainer', { static: false }) tableauContainer!: ElementRef;

  isLoading = true;
  currentProviderName = '';
  currentProviderId = '';
  authError = '';
  isFullscreen = false;
  showExportMenu = false;

  readonly downloadSheets = [
    { wsName: 'Hoja 48', tabName: 'Stocks' }
  ];

  showDownloadModal = false;
  canDownloadClosedMonth = false;
  isTrial = false;

  private vizElement: any = null;
  private resizeObserver?: ResizeObserver;
  private destroy$ = new Subject<void>();
  private viewReady = false;
  private tenantLoaded = false;

  private readonly CONTAINER_SELECTOR = '.stocks-container';
  private readonly DASHBOARD_KEY = 'stocks';

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private tableau: TableauDashboardService,
    private renderer: Renderer2,
    private impersonationService: ImpersonationService,
  ) { }

  ngOnInit(): void {
    console.log('[Stocks] 🟢 ngOnInit');
    this.observeSidebarChanges();

    this.authService.currentUser$
      .pipe(
        filter(user => user !== null),
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe(user => {
        this.currentProviderName = user!.tenantName;
        this.currentProviderId = this.impersonationService.getEffectiveProviderId(user!.proveedorIdInterno || '');

        if (user!.tenantId) {
          this.tenantService.getTenantById(user!.tenantId).then(tenant => {
            this.canDownloadClosedMonth = tenant?.features?.canDownloadClosedMonth === true;
            this.isTrial = tenant?.plan === 'trial';
            this.tenantLoaded = true;
            console.log(`[Stocks] 📥 isTrial: ${this.isTrial} | canDownloadClosedMonth: ${this.canDownloadClosedMonth}`);
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
    console.log('[Stocks] 🟡 ngAfterViewInit');
    this.adjustForSidebar();
    if (!this.tenantLoaded) {
      console.log('[Stocks] ⏳ DOM listo — esperando tenant de Firestore...');
    }
  }

  ngOnDestroy(): void {
    console.log('[Stocks] 🔴 ngOnDestroy');
    this.destroy$.next();
    this.destroy$.complete();
    this.tableau.disposeViz(this.vizElement);
    this.vizElement = null;
    this.resizeObserver?.disconnect();
  }

  private async initDashboard(): Promise<void> {
    console.log(`[Stocks] 🚀 initDashboard — proveedor="${this.currentProviderId}"`);
    this.isLoading = true;
    this.authError = '';

    const result = await this.tableau.loadDashboard(
      this.tableauContainer.nativeElement,
      { dashboardKey: this.DASHBOARD_KEY, containerSelector: this.CONTAINER_SELECTOR },
      this.currentProviderId,
      false // filtro trial de fecha solo activo en categorización
    );

    this.vizElement = result.vizElement;
    this.authError = result.error ?? '';
    this.isLoading = false;

    if (!result.error) {
      this.adjustDashboardSize();
    } else {
      console.error(`[Stocks] ❌ Error: "${result.error}"`);
    }
  }

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

  getCurrentProviderName(): string { return this.currentProviderName || 'tus datos'; }

  async refreshDashboard(): Promise<void> {
    console.log('[Stocks] 🔄 refreshDashboard');
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
      // Buscamos específicamente la hoja 'Hoja 48'
      const sheet = activeSheet?.worksheets?.find((ws: any) => ws.name === 'Hoja 48');
      if (!sheet) {
        console.error('[Stocks] ❌ No se encontró la hoja "Hoja 48". Hojas disponibles:', activeSheet?.worksheets?.map((ws: any) => ws.name));
        return;
      }
      // getSummaryDataAsync retorna los datos tal como se ven en el viz (respeta filtros del dashboard)
      const data = await sheet.getSummaryDataAsync({ ignoreSelection: false });
      // buildCsv detecta y pivota automáticamente el formato Measure Names/Values
      const csvContent = buildCsv(data);
      downloadCsv(csvContent, 'stocks-data.csv');
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

  openDownloadModal(): void { this.showDownloadModal = true; }
  closeDownloadModal(): void { this.showDownloadModal = false; }

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
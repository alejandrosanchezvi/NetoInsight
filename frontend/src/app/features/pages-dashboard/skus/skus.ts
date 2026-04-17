// 📊 NetoInsight - Skus Component (OPTIMIZADO v4)

import {
  Component, OnInit, AfterViewInit, ViewChild, ElementRef,
  OnDestroy, CUSTOM_ELEMENTS_SCHEMA, HostListener, Renderer2
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { TableauDashboardService } from '../../../core/services/tableau-dashboard.service';
import { downloadExcel } from '../../../core/utils/csv-export.util';
import { DownloadClosedMonthModal } from '../../../shared/components/download-closed-month-modal/download-closed-month-modal';

@Component({
  selector: 'app-skus',
  standalone: true,
  imports: [CommonModule, DownloadClosedMonthModal],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './skus.html',
  styleUrls: ['./skus.css']
})
export class Skus implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('tableauContainer', { static: false }) tableauContainer!: ElementRef;

  isLoading = true;
  currentProviderName = '';
  currentProviderId = '';
  authError = '';
  isFullscreen = false;
  showExportMenu = false;

  readonly downloadSheets = [
    { wsName: 'TablaArts', tabName: 'SKUs' }
  ];

  showDownloadModal = false;
  canDownloadClosedMonth = false;

  private vizElement: any = null;
  private resizeObserver?: ResizeObserver;
  private destroy$ = new Subject<void>();
  private viewReady = false;

  private readonly CONTAINER_SELECTOR = '.skus-container';
  private readonly DASHBOARD_KEY = 'skus';

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private tableau: TableauDashboardService,
    private renderer: Renderer2
  ) { }

  ngOnInit(): void {
    console.log('[Skus] 🟢 ngOnInit');
    this.observeSidebarChanges();

    this.authService.currentUser$
      .pipe(
        filter(user => user !== null),
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe(user => {
        this.currentProviderName = user!.tenantName;
        this.currentProviderId = user!.proveedorIdInterno || '';

        if (user!.tenantId) {
          this.tenantService.getTenantById(user!.tenantId).then(tenant => {
            this.canDownloadClosedMonth = tenant?.features?.canDownloadClosedMonth === true;
          });
        }
        console.log(`[Skus] 👤 proveedor="${this.currentProviderId}" | nombre="${this.currentProviderName}"`);

        if (this.viewReady) {
          this.initDashboard();
        }
      });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    console.log('[Skus] 🟡 ngAfterViewInit');
    this.adjustForSidebar();

    if (this.currentProviderId !== '' || this.authService.getCurrentUser() !== null) {
      this.initDashboard();
    } else {
      console.log('[Skus] ⏳ DOM listo — esperando usuario de Firebase...');
    }
  }

  ngOnDestroy(): void {
    console.log('[Skus] 🔴 ngOnDestroy');
    this.destroy$.next();
    this.destroy$.complete();
    this.tableau.disposeViz(this.vizElement);
    this.vizElement = null;
    this.resizeObserver?.disconnect();
  }

  private async initDashboard(): Promise<void> {
    console.log(`[Skus] 🚀 initDashboard — proveedor="${this.currentProviderId}"`);
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
      console.error(`[Skus] ❌ Error: "${result.error}"`);
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
    console.log('[Skus] 🔄 refreshDashboard');
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
      const worksheets = activeSheet?.worksheets ?? [];

      // Hoja 1: TablaArts (datos de SKUs con pivoteo automático)
      const sheetTablaArts = worksheets.find((ws: any) => ws.name === 'TablaArts');
      if (!sheetTablaArts) {
        console.error('[Skus] ❌ No se encontró "TablaArts". Hojas:', worksheets.map((ws: any) => ws.name));
        return;
      }

      // Hoja 2: Catalogo (4ta hoja del dashboard)
      const sheetCatalogo = worksheets.find((ws: any) => ws.name === 'Catalogo');
      if (!sheetCatalogo) {
        console.error('[Skus] ❌ No se encontró "Catalogo". Hojas:', worksheets.map((ws: any) => ws.name));
      }

      const dataTablaArts = await sheetTablaArts.getSummaryDataAsync({ ignoreSelection: false });
      const excelSheets: any[] = [{ sheetName: 'SKUs', tableauData: dataTablaArts }];

      if (sheetCatalogo) {
        const dataCatalogo = await sheetCatalogo.getSummaryDataAsync({ ignoreSelection: false });
        excelSheets.push({ sheetName: 'Catálogo', tableauData: dataCatalogo });
      }

      downloadExcel(excelSheets, 'skus-data.xlsx');
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
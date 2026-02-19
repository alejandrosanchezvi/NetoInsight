// 📊 NetoInsight - Skus Component (EMBEDDING API v3 - OPTIMIZADO)

import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, HostListener, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-skus',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './skus.html',
  styleUrls: ['./skus.css']
})
export class Skus implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('tableauContainer', { static: false }) tableauContainer!: ElementRef;
  
  isLoading: boolean = true;
  currentProviderName: string = '';
  currentProviderId: string = '';
  authError: string = '';
  isFullscreen: boolean = false;
  showExportMenu: boolean = false;
  
  // ═══════════════════════════════════════════════════════════
  // 🔧 CONFIGURACIÓN DE FILTROS
  // ═══════════════════════════════════════════════════════════
  private readonly FILTER_BY_NAME = true;
  private readonly FILTER_ALL_VALUES_NETO = 'Tiendas Neto';
  private readonly FILTER_FIELD_NAME_TEXT = 'Proveedor';
  private readonly FILTER_FIELD_NAME_ID = 'Proveedor Id';
  private readonly WORKSHEETS_TO_SKIP: string[] = [];
  // ═══════════════════════════════════════════════════════════
  
  private jwtToken: string = '';
  private vizElement: any = null;
  private resizeObserver?: ResizeObserver;
  private loadingTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.currentProviderName = currentUser.tenantName;
      this.currentProviderId = currentUser.proveedorIdInterno || '';
    }
    this.loadTableauScript();
    this.observeSidebarChanges();
  }

  ngAfterViewInit(): void {
    this.adjustForSidebar();
  }
  
  ngOnDestroy(): void {
    this.clearLoadingTimeout();
    if (this.vizElement) {
      this.vizElement.dispose?.();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private clearLoadingTimeout(): void {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = undefined;
    }
  }

  private observeSidebarChanges(): void {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      this.resizeObserver = new ResizeObserver(() => this.adjustForSidebar());
      this.resizeObserver.observe(mainContent);

      const observer = new MutationObserver(() => this.adjustForSidebar());
      observer.observe(mainContent, { attributes: true, attributeFilter: ['class'] });
    }
  }

  private adjustForSidebar(): void {
    const container = document.querySelector('.skus-container') as HTMLElement;
    if (container) {
      this.renderer.setStyle(container, 'width', '100%');
      this.renderer.setStyle(container, 'max-width', '100%');
    }
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

  private loadTableauScript(): void {
    const existingScript = document.getElementById('tableau-embedding-script');
    if (existingScript) {
      this.loadDashboard();
      return;
    }

    const script = document.createElement('script');
    script.id = 'tableau-embedding-script';
    script.type = 'module';
    script.src = 'https://us-east-1.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';
    script.onload = () => this.loadDashboard();
    script.onerror = () => {
      this.isLoading = false;
      this.authError = 'script_error';
    };
    document.head.appendChild(script);
  }

  private async loadDashboard(): Promise<void> {
    try {
      const firebaseToken = await this.authService.getFirebaseToken();
      if (!firebaseToken) throw new Error('No Firebase token');
      
      const response = await this.http.get<any>(
        'https://netoinsight-api-staging-609085902384.us-central1.run.app/api/tableau/embed-url',
        {
          params: { dashboard: 'skus' },
          headers: { 'Authorization': `Bearer ${firebaseToken}` }
        }
      ).toPromise();
      
      if (response?.jwt && response?.embedUrl) {
        this.jwtToken = response.jwt;
        await this.createTableauVizElement(response.embedUrl);
      } else {
        throw new Error('JWT o URL no recibido');
      }
      
    } catch (error: any) {
      console.error('Error cargando dashboard:', error);
      this.isLoading = false;
      this.authError = error.status === 401 ? 'auth_error' : 'load_error';
    }
  }

  private async createTableauVizElement(embedUrl: string): Promise<void> {
    try {
      const container = this.tableauContainer.nativeElement;
      container.innerHTML = '';

      const viz = document.createElement('tableau-viz');
      viz.setAttribute('id', 'tableau-viz');
      viz.setAttribute('src', embedUrl);
      viz.setAttribute('token', this.jwtToken);
      viz.setAttribute('width', '100%');
      viz.setAttribute('height', '100%');
      viz.setAttribute('toolbar', 'hidden');
      viz.setAttribute('hide-tabs', 'true');
      
      viz.style.width = '100%';
      viz.style.height = '100%';
      viz.style.display = 'block';
      viz.style.minHeight = '100%';
      viz.style.opacity = '0';
      viz.style.visibility = 'hidden';

      this.vizElement = viz;

      // ✅ Éxito — mostrar dashboard
      viz.addEventListener('firstinteractive', async () => {
        this.clearLoadingTimeout();
        this.adjustDashboardSize();
        
        if (this.FILTER_BY_NAME) {
          await this.applyProviderFilterByName();
        } else {
          await this.applyProviderFilterById();
        }
        
        viz.style.transition = 'opacity 0.4s ease-in-out';
        viz.style.opacity = '1';
        viz.style.visibility = 'visible';
        
        this.isLoading = false;
        this.authError = '';
      });

      // ✅ Error de Tableau — mostrar inmediatamente sin esperar timeout
      viz.addEventListener('vizloadError', (event: any) => {
        this.clearLoadingTimeout();
        console.error('❌ [TABLEAU] Viz Load Error:', event.detail);
        
        const errorCode = event.detail?.errorCode;
        const errorMsg  = event.detail?.errorMessage || '';
        
        // Código 16 = credenciales inválidas / JWT rechazado
        if (errorCode === 16 || errorMsg.includes('"code":16')) {
          this.authError = 'jwt_error';
        } else {
          this.authError = 'viz_error';
        }
        
        this.isLoading = false;
      });

      container.appendChild(viz);

      // ✅ Timeout reducido a 15s (era 30s)
      this.loadingTimeout = setTimeout(() => {
        if (this.isLoading) {
          console.warn('⏱️ [TABLEAU] Timeout alcanzado');
          this.isLoading = false;
          this.authError = 'timeout_error';
        }
      }, 15000);
      
    } catch (error: any) {
      console.error('Error creando viz element:', error);
      this.isLoading = false;
      this.authError = 'load_error';
    }
  }

  private async applyProviderFilterByName(): Promise<void> {
    if (!this.currentProviderName) return;
    try {
      const workbook = await this.vizElement.workbook;
      const activeSheet = await workbook.activeSheet;
      if (activeSheet.sheetType === 'dashboard') {
        const worksheet = activeSheet.worksheets[0];
        if (this.WORKSHEETS_TO_SKIP.includes(worksheet.name)) return;
        if (this.FILTER_ALL_VALUES_NETO === this.currentProviderName) {
          await worksheet.clearFilterAsync(this.FILTER_FIELD_NAME_TEXT);
        } else {
          await worksheet.applyFilterAsync(this.FILTER_FIELD_NAME_TEXT, [this.currentProviderName], 'replace');
        }
      }
    } catch (error: any) {
      console.warn('Error aplicando filtro:', error.message);
    }
  }

  private async applyProviderFilterById(): Promise<void> {
    if (!this.currentProviderId) return;
    try {
      const workbook = await this.vizElement.workbook;
      const activeSheet = await workbook.activeSheet;
      if (activeSheet.sheetType === 'dashboard') {
        const worksheet = activeSheet.worksheets[0];
        if (this.WORKSHEETS_TO_SKIP.includes(worksheet.name)) return;
        await worksheet.applyFilterAsync(this.FILTER_FIELD_NAME_ID, [this.currentProviderId], 'replace');
      }
    } catch (error: any) {
      console.warn('Error aplicando filtro por ID:', error.message);
    }
  }

  private adjustDashboardSize(): void {
    if (this.vizElement) {
      try {
        this.vizElement.style.width = '100%';
        this.vizElement.style.height = '100%';
      } catch (e) {}
    }
    this.adjustForSidebar();
  }

  getCurrentProviderName(): string {
    return this.currentProviderName || 'tus datos';
  }

  // ✅ Refresh idéntico a primera carga
  async refreshDashboard(): Promise<void> {
    this.clearLoadingTimeout();
    this.isLoading = true;
    this.authError = '';

    if (this.vizElement) {
      this.vizElement.style.opacity = '0';
      this.vizElement.style.visibility = 'hidden';
      this.vizElement.style.transition = 'none';
      this.vizElement.dispose?.();
      this.vizElement = null;
    }

    await this.loadDashboard();
  }

  async exportToPDF(): Promise<void> {
    this.showExportMenu = false;
    if (!this.vizElement) return;
    try { await this.vizElement.displayDialogAsync('export-pdf'); } catch (e) { console.error(e); }
  }

  async exportToImage(): Promise<void> {
    this.showExportMenu = false;
    if (!this.vizElement) return;
    try { await this.vizElement.displayDialogAsync('export-image'); } catch (e) { console.error(e); }
  }

  async exportData(): Promise<void> {
    this.showExportMenu = false;
    if (!this.vizElement) return;
    try { await this.vizElement.displayDialogAsync('export-data'); } catch (e) { console.error(e); }
  }

  toggleExportMenu(): void { this.showExportMenu = !this.showExportMenu; }

  toggleFullscreen(): void {
    const container = document.querySelector('.skus-container') as HTMLElement;
    if (!container) return;
    if (!this.isFullscreen) {
      (container.requestFullscreen || (container as any).webkitRequestFullscreen)?.call(container);
    } else {
      (document.exitFullscreen || (document as any).webkitExitFullscreen)?.call(document);
    }
  }
}
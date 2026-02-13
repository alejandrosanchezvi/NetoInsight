// 📊 NetoInsight - Stocks Component (EMBEDDING API v3 - CON FILTRADO ESPECIAL)

import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, HostListener, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-stocks',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './stocks.html',
  styleUrls: ['./stocks.css']
})
export class Stocks implements OnInit, AfterViewInit, OnDestroy {
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
  
  // Usuario especial que ve TODO
  private readonly TIENDAS_NETO_NAME = 'Tiendas Neto';
  
  // Campos de filtro
  private readonly FILTER_FIELD_NAME_TEXT = 'Proveedor';
  private readonly FILTER_FIELD_NAME_ID = 'Proveedor Id';
  
  // Worksheets a omitir (vacío = aplicar a todos)
  private readonly WORKSHEETS_TO_SKIP: string[] = [];
  
  // ═══════════════════════════════════════════════════════════
  
  private jwtToken: string = '';
  private vizElement: any = null;
  private resizeObserver?: ResizeObserver;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    console.log('📊 [STOCKS] Inicializando componente');
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.currentProviderName = currentUser.tenantName;
      this.currentProviderId = currentUser.proveedorIdInterno || '';
      
      console.log(`🏢 [STOCKS] Proveedor: ${this.currentProviderName}`);
      console.log(`🆔 [STOCKS] Proveedor ID: ${this.currentProviderId}`);
      
      // Detectar si es Tiendas Neto
      if (this.currentProviderName === this.TIENDAS_NETO_NAME) {
        console.log(`⭐ [STOCKS] Usuario ESPECIAL: ${this.TIENDAS_NETO_NAME} - Verá TODOS los datos`);
      }
    }
    this.loadTableauScript();
    this.observeSidebarChanges();
  }

  ngAfterViewInit(): void {
    this.adjustForSidebar();
  }
  
  ngOnDestroy(): void {
    if (this.vizElement) {
      this.vizElement.dispose?.();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private observeSidebarChanges(): void {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      this.resizeObserver = new ResizeObserver(() => {
        this.adjustForSidebar();
      });
      this.resizeObserver.observe(mainContent);
    }

    const observer = new MutationObserver(() => {
      this.adjustForSidebar();
    });

    if (mainContent) {
      observer.observe(mainContent, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  private adjustForSidebar(): void {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      const container = document.querySelector('.stocks-container') as HTMLElement;
      
      if (container) {
        this.renderer.setStyle(container, 'width', '100%');
        this.renderer.setStyle(container, 'max-width', '100%');
      }
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.adjustDashboardSize();
  }

  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  @HostListener('document:mozfullscreenchange')
  @HostListener('document:MSFullscreenChange')
  onFullscreenChange() {
    this.isFullscreen = !!(document.fullscreenElement || 
                          (document as any).webkitFullscreenElement || 
                          (document as any).mozFullScreenElement || 
                          (document as any).msFullscreenElement);
  }

  private loadTableauScript(): void {
    console.log('📜 [STOCKS] Cargando Tableau API...');
    const existingScript = document.getElementById('tableau-embedding-script');
    
    if (existingScript) {
      console.log('✅ [STOCKS] Script ya existe');
      this.loadDashboard();
      return;
    }

    const script = document.createElement('script');
    script.id = 'tableau-embedding-script';
    script.type = 'module';
    script.src = 'https://us-east-1.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';
    
    script.onload = () => {
      console.log('✅ Tableau Embedding API v3 cargada');
      this.loadDashboard();
    };
    
    script.onerror = () => {
      this.isLoading = false;
      this.authError = 'Error cargando Tableau Embedding API v3';
    };
    
    document.head.appendChild(script);
  }

  private async loadDashboard(): Promise<void> {
    try {
      const firebaseToken = await this.authService.getFirebaseToken();
      if (!firebaseToken) throw new Error('No Firebase token');
      
      const response = await this.http.get<any>('https://netoinsight-api-staging-609085902384.us-central1.run.app/api/tableau/embed-url', {
        params: { dashboard: 'stocks' },
        headers: { 'Authorization': `Bearer ${firebaseToken}` }
      }).toPromise();
      
      if (response?.jwt && response?.embedUrl) {
        this.jwtToken = response.jwt;
        console.log('✅ JWT recibido, creando tableau-viz element');
        await this.createTableauVizElement(response.embedUrl);
      } else {
        throw new Error('JWT o URL no recibido');
      }
      
    } catch (error: any) {
      console.error('❌ Error:', error);
      this.isLoading = false;
      this.authError = error.status === 401 ? 'Error 401: Verificar Connected App' : 'Error cargando dashboard';
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
      
      // 🔒 OCULTAR hasta aplicar filtros
      viz.style.opacity = '0';
      viz.style.visibility = 'hidden';

      this.vizElement = viz;

      viz.addEventListener('firstinteractive', async () => {
        console.log('✅ Dashboard Stocks cargado - APLICANDO FILTROS...');
        this.adjustDashboardSize();
        
        // 🎯 APLICAR FILTRO CON LÓGICA ESPECIAL
        await this.applyProviderFilter();
        
        // ✅ MOSTRAR DASHBOARD
        console.log('👁️ [DISPLAY] Mostrando dashboard Stocks con filtros aplicados');
        viz.style.opacity = '1';
        viz.style.visibility = 'visible';
        viz.style.transition = 'opacity 0.3s ease-in-out';
        
        // 🎉 QUITAR LOADING
        this.isLoading = false;
        this.authError = '';
      });

      viz.addEventListener('vizloadError', (event: any) => {
        console.error('❌ Viz Load Error:', event.detail);
        this.isLoading = false;
        this.authError = 'Error de autenticación Connected App: ' + (event.detail?.errorCode || 'unknown');
      });

      container.appendChild(viz);
      console.log('📊 tableau-viz element creado (Stocks - oculto hasta aplicar filtros)');

      setTimeout(() => {
        if (this.isLoading) {
          this.isLoading = false;
          this.authError = 'Timeout: Verificar Connected App configuration';
        }
      }, 30000);
      
    } catch (error: any) {
      console.error('❌ Error creando viz element:', error);
      this.isLoading = false;
      this.authError = `Error: ${error.message}`;
    }
  }

  /**
   * 🎯 APLICAR FILTRO CON LÓGICA ESPECIAL
   * - Si es "Tiendas Neto" → clearFilterAsync (mostrar TODO)
   * - Si es otro proveedor → filtrar por su nombre
   */
  private async applyProviderFilter(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('🔎 [STOCKS FILTER] APLICANDO FILTRO');
    console.log('╚═══════════════════════════════════════════════════╝');
    
    const isTiendasNeto = this.currentProviderName === this.TIENDAS_NETO_NAME;
    
    if (isTiendasNeto) {
      console.log(`⭐ [SPECIAL] Usuario: "${this.TIENDAS_NETO_NAME}"`);
      console.log(`🌐 [ACTION] Se LIMPIARÁN todos los filtros (clearFilterAsync)`);
    } else {
      console.log(`📌 [FILTER] Proveedor: "${this.currentProviderName}"`);
      console.log(`🔧 [ACTION] Se FILTRARÁ por: "${this.currentProviderName}"`);
    }
    
    try {
      const workbook = await this.vizElement.workbook;
      const activeSheet = await workbook.activeSheet;

      if (activeSheet.sheetType === 'dashboard') {
        const worksheets = activeSheet.worksheets;
        console.log(`\n📋 Procesando ${worksheets.length} worksheets...\n`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < worksheets.length; i++) {
          const worksheet = worksheets[i];
          const worksheetName = worksheet.name;
          
          console.log(`📝 [${i + 1}/${worksheets.length}] "${worksheetName}"`);
          
          if (this.WORKSHEETS_TO_SKIP.includes(worksheetName)) {
            console.log(`   ⭕ OMITIDO`);
            continue;
          }
          
          try {
            if (isTiendasNeto) {
              // ⭐ TIENDAS NETO: Limpiar filtro (mostrar TODO)
              await worksheet.clearFilterAsync(this.FILTER_FIELD_NAME_TEXT);
              console.log(`   ✅ FILTRO LIMPIADO: Mostrando TODOS`);
            } else {
              // 🔧 OTROS: Filtrar por proveedor
              await worksheet.applyFilterAsync(
                this.FILTER_FIELD_NAME_TEXT,
                [this.currentProviderName],
                'replace'
              );
              console.log(`   ✅ FILTRO APLICADO: "${this.currentProviderName}"`);
            }
            successCount++;
          } catch (error: any) {
            console.warn(`   ⚠️ FALLÓ: ${error.message || 'Error'}`);
            failCount++;
          }
        }
        
        console.log('\n╔═══════════════════════════════════════════════════╗');
        console.log('📊 RESUMEN - FILTRADO STOCKS');
        console.log('╚═══════════════════════════════════════════════════╝');
        if (isTiendasNeto) {
          console.log(`⭐ Usuario: ${this.TIENDAS_NETO_NAME} - Mostrando TODO`);
        } else {
          console.log(`🏢 Proveedor filtrado: "${this.currentProviderName}"`);
        }
        console.log(`✅ Exitosos: ${successCount} | ⚠️ Fallidos: ${failCount}`);
        console.log('╚═══════════════════════════════════════════════════╝\n');
      }
    } catch (error) {
      console.error('❌ Error al aplicar filtro:', error);
    }
  }

  private adjustDashboardSize(): void {
    if (this.vizElement) {
      try {
        this.vizElement.style.width = '100%';
        this.vizElement.style.height = '100%';
      } catch (error) {
        console.warn('No se pudo ajustar tamaño del dashboard:', error);
      }
    }
    this.adjustForSidebar();
  }

  getCurrentProviderName(): string {
    return this.currentProviderName || 'Cargando...';
  }

  async refreshDashboard(): Promise<void> {
    this.isLoading = true;
    this.authError = '';
    
    try {
      if (this.vizElement) {
        await this.vizElement.revertAllAsync();
        console.log('✅ Dashboard refrescado');
        await this.applyProviderFilter();
      } else {
        await this.loadDashboard();
      }
    } catch (error) {
      console.error('Error refrescando dashboard:', error);
      await this.loadDashboard();
    } finally {
      this.isLoading = false;
    }
  }

  async exportToPDF(): Promise<void> {
    try {
      this.showExportMenu = false;
      if (!this.vizElement) {
        alert('Dashboard no está cargado');
        return;
      }
      await this.vizElement.displayDialogAsync('export-pdf');
    } catch (error: any) {
      console.error('❌ Error exportando a PDF:', error);
      alert('Error al exportar a PDF. Verifica los permisos en Tableau.');
    }
  }

  async exportToImage(): Promise<void> {
    try {
      this.showExportMenu = false;
      if (!this.vizElement) {
        alert('Dashboard no está cargado');
        return;
      }
      await this.vizElement.displayDialogAsync('export-image');
    } catch (error: any) {
      console.error('❌ Error exportando a imagen:', error);
      alert('Error al exportar imagen. Verifica los permisos en Tableau.');
    }
  }

  async exportData(): Promise<void> {
    try {
      this.showExportMenu = false;
      if (!this.vizElement) {
        alert('Dashboard no está cargado');
        return;
      }
      await this.vizElement.displayDialogAsync('export-data');
    } catch (error: any) {
      console.error('❌ Error exportando datos:', error);
      alert('Error al exportar datos. Verifica los permisos en Tableau.');
    }
  }

  toggleExportMenu(): void {
    this.showExportMenu = !this.showExportMenu;
  }

  toggleFullscreen(): void {
    const container = document.querySelector('.stocks-container') as HTMLElement;
    
    if (!container) return;

    if (!this.isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        (container as any).mozRequestFullScreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  }
  
}
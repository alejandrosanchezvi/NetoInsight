// 📊 NetoInsight - Categorization Component (EMBEDDING API v3 - OPTIMIZADO)

import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, HostListener, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';

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
      const container = document.querySelector('.categorization-container') as HTMLElement;
      
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
    const existingScript = document.getElementById('tableau-embedding-script');
    
    if (existingScript) {
      this.loadDashboard();
      return;
    }

    const script = document.createElement('script');
    script.id = 'tableau-embedding-script';
    script.type = 'module';
    script.src = 'https://us-east-1.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';
    
    script.onload = () => {
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
        params: { dashboard: 'categorization' },
        headers: { 'Authorization': `Bearer ${firebaseToken}` }
      }).toPromise();
      
      if (response?.jwt && response?.embedUrl) {
        this.jwtToken = response.jwt;
        await this.createTableauVizElement(response.embedUrl);
      } else {
        throw new Error('JWT o URL no recibido');
      }
      
    } catch (error: any) {
      console.error('Error cargando dashboard:', error);
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
      viz.style.opacity = '0';
      viz.style.visibility = 'hidden';

      this.vizElement = viz;

      viz.addEventListener('firstinteractive', async () => {
        this.adjustDashboardSize();
        
        if (this.FILTER_BY_NAME) {
          await this.applyProviderFilterByName();
        } else {
          await this.applyProviderFilterById();
        }
        
        viz.style.opacity = '1';
        viz.style.visibility = 'visible';
        viz.style.transition = 'opacity 0.3s ease-in-out';
        
        this.isLoading = false;
        this.authError = '';
      });

      viz.addEventListener('vizloadError', (event: any) => {
        console.error('Viz Load Error:', event.detail);
        this.isLoading = false;
        this.authError = 'Error de autenticación Connected App: ' + (event.detail?.errorCode || 'unknown');
      });

      container.appendChild(viz);

      setTimeout(() => {
        if (this.isLoading) {
          this.isLoading = false;
          this.authError = 'Timeout: Verificar Connected App configuration';
        }
      }, 30000);
      
    } catch (error: any) {
      console.error('Error creando viz element:', error);
      this.isLoading = false;
      this.authError = `Error: ${error.message}`;
    }
  }

  /**
   * 🔍 DIAGNÓSTICO COMPLETO DEL TABLEAU (Solo para debug manual)
   */
  private async diagnosticarTableau(): Promise<void> {
    try {
      const workbook = await this.vizElement.workbook;
      const activeSheet = await workbook.activeSheet;
      
      console.log('📚 Workbook:', workbook.name);
      console.log('📄 Sheet:', activeSheet.name, '| Tipo:', activeSheet.sheetType);
      
      if (activeSheet.sheetType === 'dashboard') {
        const worksheets = activeSheet.worksheets;
        console.log(`\n📋 Worksheets: ${worksheets.length}`);
        
        for (const worksheet of worksheets) {
          console.log(`\n📝 "${worksheet.name}"`);
          
          try {
            const filters = await worksheet.getFiltersAsync();
            
            if (filters.length === 0) {
              console.log('  🔍 Sin filtros disponibles');
            } else {
              console.log(`  🔍 Filtros: ${filters.length}`);
              filters.forEach((filter: any) => {
                console.log(`     - ${filter.fieldName} (${filter.filterType})`);
                
                if (filter.appliedValues && filter.appliedValues.length > 0) {
                  const values = filter.appliedValues.map((v: any) => {
                    if (typeof v === 'object' && v !== null) {
                      return v.value || v.formattedValue || JSON.stringify(v);
                    }
                    return v;
                  }).slice(0, 5);
                  
                  const moreCount = filter.appliedValues.length - 5;
                  const valuesStr = values.join(', ');
                  const moreStr = moreCount > 0 ? ` ... y ${moreCount} más` : '';
                  
                  console.log(`       Valores: ${valuesStr}${moreStr}`);
                }
              });
            }
            
            const hasProveedorIdFilter = filters.some((f: any) => 
              f.fieldName.toLowerCase() === this.FILTER_FIELD_NAME_ID.toLowerCase()
            );
            
            const hasProveedorFilter = filters.some((f: any) => 
              f.fieldName.toLowerCase() === this.FILTER_FIELD_NAME_TEXT.toLowerCase()
            );
            
            if (this.FILTER_BY_NAME) {
              console.log(hasProveedorFilter ? 
                `  ✅ Campo "${this.FILTER_FIELD_NAME_TEXT}" existe` : 
                `  ❌ Campo "${this.FILTER_FIELD_NAME_TEXT}" no existe`);
            } else {
              console.log(hasProveedorIdFilter ? 
                `  ✅ Campo "${this.FILTER_FIELD_NAME_ID}" existe` : 
                `  ❌ Campo "${this.FILTER_FIELD_NAME_ID}" no existe`);
            }
            
          } catch (error) {
            console.warn('  ⚠️ Error al obtener filtros de este worksheet');
          }
        }
      }
      
    } catch (error) {
      console.error('Error en diagnóstico:', error);
    }
  }

  /**
   * 🎯 MÉTODO 1: FILTRAR POR NOMBRE DE PROVEEDOR
   */
  private async applyProviderFilterByName(): Promise<void> {
    if (!this.currentProviderName) {
      console.error('No hay nombre de proveedor disponible');
      return;
    }
    
    try {
      const workbook = await this.vizElement.workbook;
      const activeSheet = await workbook.activeSheet;

      if (activeSheet.sheetType === 'dashboard') {
        const worksheets = activeSheet.worksheets;
        const worksheet = worksheets[0]; // Solo procesamos el primer worksheet
        
        if (this.WORKSHEETS_TO_SKIP.includes(worksheet.name)) {
          console.log('Worksheet omitido:', worksheet.name);
          return;
        }
        
        try {
          if (this.FILTER_ALL_VALUES_NETO === this.currentProviderName) {
            // LIMPIAR FILTRO = Mostrar TODOS los valores para Tiendas Neto
            await worksheet.clearFilterAsync(this.FILTER_FIELD_NAME_TEXT);
            console.log('✅ Filtro limpiado - Mostrando TODOS los proveedores');
          } else {
            // APLICAR FILTRO ESPECÍFICO para otros proveedores
            await worksheet.applyFilterAsync(this.FILTER_FIELD_NAME_TEXT, [this.currentProviderName], 'replace');
            console.log('✅ Filtro aplicado:', this.currentProviderName);
          }
        } catch (error: any) {
          console.warn('Error aplicando filtro:', error.message);
        }
      }
    } catch (error) {
      console.error('Error al filtrar por nombre:', error);
    }
  }

  /**
   * 🎯 MÉTODO 2: FILTRAR POR ID DE PROVEEDOR
   */
  private async applyProviderFilterById(): Promise<void> {
    if (!this.currentProviderId) {
      console.error('No hay ID de proveedor disponible');
      return;
    }
    
    try {
      const workbook = await this.vizElement.workbook;
      const activeSheet = await workbook.activeSheet;

      if (activeSheet.sheetType === 'dashboard') {
        const worksheets = activeSheet.worksheets;
        const worksheet = worksheets[0]; // Solo procesamos el primer worksheet
        
        if (this.WORKSHEETS_TO_SKIP.includes(worksheet.name)) {
          console.log('Worksheet omitido:', worksheet.name);
          return;
        }
        
        try {
          await worksheet.applyFilterAsync(this.FILTER_FIELD_NAME_ID, [this.currentProviderId], 'replace');
          console.log('✅ Filtro por ID aplicado:', this.currentProviderId);
        } catch (error: any) {
          console.warn('Error aplicando filtro por ID:', error.message);
        }
      }
    } catch (error) {
      console.error('Error al filtrar por ID:', error);
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
        
        if (this.FILTER_BY_NAME) {
          await this.applyProviderFilterByName();
        } else {
          await this.applyProviderFilterById();
        }
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
      console.error('Error exportando a PDF:', error);
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
      console.error('Error exportando a imagen:', error);
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
      console.error('Error exportando datos:', error);
      alert('Error al exportar datos. Verifica los permisos en Tableau.');
    }
  }

  toggleExportMenu(): void {
    this.showExportMenu = !this.showExportMenu;
  }

  toggleFullscreen(): void {
    const container = document.querySelector('.categorization-container') as HTMLElement;
    
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

  async debugAuth(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🔧 DEBUG EMBEDDING API v3');
    console.log('═══════════════════════════════════════════════════');
    console.log('🔧 Método filtro:', this.FILTER_BY_NAME ? 'POR NOMBRE' : 'POR ID');
    console.log('Provider Name:', this.currentProviderName);
    console.log('Provider ID:', this.currentProviderId);
    
    const user = this.authService.getCurrentUser();
    console.log('User Data:', user);
    
    if (this.vizElement) {
      try {
        console.log('\n🔍 Ejecutando diagnóstico...\n');
        await this.diagnosticarTableau();
      } catch (error) {
        console.warn('Error:', error);
      }
    }
    
    console.log('═══════════════════════════════════════════════════\n');
  }
}
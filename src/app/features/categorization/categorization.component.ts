// 📊 NetoInsight - Categorization Component (EMBEDDING API v3 - DUAL FILTER METHODS)

import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, HostListener, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-categorization',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './categorization.component.html',
  styleUrls: ['./categorization.component.css']
})
export class CategorizationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('tableauContainer', { static: false }) tableauContainer!: ElementRef;
  
  isLoading: boolean = true;
  currentProviderName: string = '';
  currentProviderId: string = '';
  authError: string = '';
  isFullscreen: boolean = false;
  showExportMenu: boolean = false;
  
  // ═══════════════════════════════════════════════════════════
  // 🔧 CONFIGURACIÓN DE FILTROS - CAMBIAR AQUÍ PARA PROBAR
  // ═══════════════════════════════════════════════════════════
  
  // Opción 1: Filtrar por NOMBRE (true) o por ID (false)
  private readonly FILTER_BY_NAME = true; // ← CAMBIAR AQUÍ
  
  // Hardcoded para pruebas (dejar vacío '' para usar datos del tenant)
  // private readonly HARDCODED_PROVIDER_NAME = 'BIMBO, S.A. DE C.V.'; // ← Para pruebas por nombre
  // private readonly HARDCODED_PROVIDER_NAME = 'PROPIMEX  S DE R.L DE C.V.'; // ← Para pruebas por nombre
  private readonly HARDCODED_PROVIDER_NAME = '4E GLOBAL'; // ← Para pruebas por nombre
  private readonly HARDCODED_PROVIDER_ID = '1000006'; // ← Para pruebas por ID
  
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
    console.log('🔷 [CATEGORIZATION] Inicializando componente');
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.currentProviderName = currentUser.tenantName;
      this.currentProviderId = currentUser.proveedorIdInterno || '';
      
      console.log(`🏢 [CATEGORIZATION] Proveedor: ${this.currentProviderName}`);
      console.log(`🆔 [CATEGORIZATION] Proveedor ID: ${this.currentProviderId}`);
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
    console.log('📜 [CATEGORIZATION] Cargando Tableau API...');
    const existingScript = document.getElementById('tableau-embedding-script');
    
    if (existingScript) {
      console.log('✅ [CATEGORIZATION] Script ya existe');
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
        params: { dashboard: 'categorization' },
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

      this.vizElement = viz;

      viz.addEventListener('firstinteractive', async () => {
        console.log('✅ Dashboard cargado con SSO');
        this.isLoading = false;
        this.authError = '';
        this.adjustDashboardSize();
        
        // 🔍 EJECUTAR DIAGNÓSTICO
        // await this.diagnosticarTableau();
        
        // 🎯 APLICAR FILTRO SEGÚN CONFIGURACIÓN
        if (this.FILTER_BY_NAME) {
          console.log('🔧 [CONFIG] Usando filtro por NOMBRE');
          await this.applyProviderFilterByName();
        } else {
          console.log('🔧 [CONFIG] Usando filtro por ID');
          await this.applyProviderFilterById();
        }
      });

      viz.addEventListener('vizloadError', (event: any) => {
        console.error('❌ Viz Load Error:', event.detail);
        this.isLoading = false;
        this.authError = 'Error de autenticación Connected App: ' + (event.detail?.errorCode || 'unknown');
      });

      container.appendChild(viz);
      console.log('📊 tableau-viz element creado con JWT token');

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
   * 🔍 DIAGNÓSTICO COMPLETO DEL TABLEAU
   */
  private async diagnosticarTableau(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║        🔍 DIAGNÓSTICO DE TABLEAU                   ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');
    
    try {
      const workbook = await this.vizElement.workbook;
      const activeSheet = await workbook.activeSheet;
      
      console.log('📚 [WORKBOOK]', workbook.name);
      console.log('📄 [SHEET]', activeSheet.name);
      console.log('📄 [TIPO]', activeSheet.sheetType);
      
      if (activeSheet.sheetType === 'dashboard') {
        const worksheets = activeSheet.worksheets;
        console.log(`\n📋 [WORKSHEETS] Total: ${worksheets.length}`);
        
        for (let i = 0; i < worksheets.length; i++) {
          const worksheet = worksheets[i];
          console.log(`\n  📝 ${i + 1}. "${worksheet.name}"`);
          
          try {
            const filters = await worksheet.getFiltersAsync();
            
            if (filters.length === 0) {
              console.log('    🔍 Sin filtros disponibles');
            } else {
              console.log(`    🔍 Filtros disponibles: ${filters.length}`);
              filters.forEach((filter: any) => {
                console.log(`       - ${filter.fieldName} (${filter.filterType})`);
                
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
                  
                  console.log(`         Valores: ${valuesStr}${moreStr}`);
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
              if (hasProveedorFilter) {
                console.log(`    ✅ Campo "${this.FILTER_FIELD_NAME_TEXT}" EXISTE - SE FILTRARÁ POR NOMBRE`);
              } else {
                console.log(`    ❌ Campo "${this.FILTER_FIELD_NAME_TEXT}" NO existe`);
              }
            } else {
              if (hasProveedorIdFilter) {
                console.log(`    ✅ Campo "${this.FILTER_FIELD_NAME_ID}" EXISTE - SE FILTRARÁ POR ID`);
              } else {
                console.log(`    ❌ Campo "${this.FILTER_FIELD_NAME_ID}" NO existe`);
              }
            }
            
          } catch (error) {
            console.warn('    ⚠️ Error al obtener filtros de este worksheet');
          }
        }
      }
      
      console.log('\n╚═══════════════════════════════════════════════════╝\n');
      
    } catch (error) {
      console.error('❌ [DIAGNÓSTICO] Error:', error);
    }
  }

  /**
   * 🎯 MÉTODO 1: FILTRAR POR NOMBRE DE PROVEEDOR
   */
  private async applyProviderFilterByName(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('🔎 [FILTER BY NAME] FILTRO POR NOMBRE');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log(`🔎 [FILTER] Campo: "${this.FILTER_FIELD_NAME_TEXT}"`);
    
    const providerName = this.HARDCODED_PROVIDER_NAME || this.currentProviderName;
    console.log(`📌 [FILTER] Proveedor: "${providerName}"`);
    console.log(`🔧 [FILTER] Modo: ${this.HARDCODED_PROVIDER_NAME ? '⚡ HARDCODED' : '📋 Del Tenant'}`);
    
    if (!providerName) {
      console.error('❌ No hay nombre de proveedor disponible');
      return;
    }
    
    try {
      const workbook = await this.vizElement.workbook;
      const activeSheet = await workbook.activeSheet;

      if (activeSheet.sheetType === 'dashboard') {
        const worksheets = activeSheet.worksheets;
        console.log(`\n📋 Procesando ${worksheets.length} worksheets...\n`);
        
        let successCount = 0;
        let skipCount = 0;
        let failCount = 0;
        
        // for (let i = 0; i < worksheets.length; i++) {
        for (let i = 0; i < 1; i++) {
          const worksheet = worksheets[i];
          const worksheetName = worksheet.name;
          
          console.log(`📝 [${i + 1}/${worksheets.length}] "${worksheetName}"`);
          
          if (this.WORKSHEETS_TO_SKIP.includes(worksheetName)) {
            console.log(`   ⭕ OMITIDO`);
            skipCount++;
            continue;
          }
          
          try {
            await worksheet.applyFilterAsync(this.FILTER_FIELD_NAME_TEXT, [providerName], 'replace');
            console.log(`   ✅ APLICADO: "${providerName}"`);
            successCount++;
          } catch (error: any) {
            console.warn(`   ⚠️ FALLÓ: ${error.message || 'Error'}`);
            failCount++;
          }
        }
        
        console.log('\n╔═══════════════════════════════════════════════════╗');
        console.log('📊 RESUMEN - FILTRADO POR NOMBRE');
        console.log('╚═══════════════════════════════════════════════════╝');
        console.log(`✅ Exitosos: ${successCount} | ⭕ Omitidos: ${skipCount} | ⚠️ Fallidos: ${failCount}`);
        console.log('╚═══════════════════════════════════════════════════╝\n');
      }
    } catch (error) {
      console.error('❌ Error al filtrar por nombre:', error);
    }
  }

  /**
   * 🎯 MÉTODO 2: FILTRAR POR ID DE PROVEEDOR
   */
  private async applyProviderFilterById(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('🔎 [FILTER BY ID] FILTRO POR ID');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log(`🔎 [FILTER] Campo: "${this.FILTER_FIELD_NAME_ID}"`);
    
    const providerId = this.HARDCODED_PROVIDER_ID || this.currentProviderId;
    console.log(`🆔 [FILTER] ID: "${providerId}"`);
    console.log(`🏢 [FILTER] Proveedor: "${this.currentProviderName}"`);
    console.log(`🔧 [FILTER] Modo: ${this.HARDCODED_PROVIDER_ID ? '⚡ HARDCODED' : '📋 Del Tenant'}`);
    
    if (!providerId) {
      console.error('❌ No hay ID de proveedor disponible');
      return;
    }
    
    try {
      const workbook = await this.vizElement.workbook;
      const activeSheet = await workbook.activeSheet;

      if (activeSheet.sheetType === 'dashboard') {
        const worksheets = activeSheet.worksheets;
        console.log(`\n📋 Procesando ${worksheets.length} worksheets...\n`);
        
        let successCount = 0;
        let skipCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < worksheets.length; i++) {
          const worksheet = worksheets[i];
          const worksheetName = worksheet.name;
          
          console.log(`📝 [${i + 1}/${worksheets.length}] "${worksheetName}"`);
          
          if (this.WORKSHEETS_TO_SKIP.includes(worksheetName)) {
            console.log(`   ⭕ OMITIDO`);
            skipCount++;
            continue;
          }
          
          try {
            await worksheet.applyFilterAsync(this.FILTER_FIELD_NAME_ID, [providerId], 'replace');
            console.log(`   ✅ APLICADO: ${providerId}`);
            successCount++;
          } catch (error: any) {
            console.warn(`   ⚠️ FALLÓ: ${error.message || 'Error'}`);
            failCount++;
          }
        }
        
        console.log('\n╔═══════════════════════════════════════════════════╗');
        console.log('📊 RESUMEN - FILTRADO POR ID');
        console.log('╚═══════════════════════════════════════════════════╝');
        console.log(`✅ Exitosos: ${successCount} | ⭕ Omitidos: ${skipCount} | ⚠️ Fallidos: ${failCount}`);
        console.log('╚═══════════════════════════════════════════════════╝\n');
      }
    } catch (error) {
      console.error('❌ Error al filtrar por ID:', error);
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
        // Reaplicar filtro
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
    console.log('Hardcoded Name:', this.HARDCODED_PROVIDER_NAME || 'NO');
    console.log('Hardcoded ID:', this.HARDCODED_PROVIDER_ID || 'NO');
    
    const user = this.authService.getCurrentUser();
    console.log('User Data:', user);
    
    if (this.vizElement) {
      try {
        console.log('\n🔍 RE-EJECUTANDO DIAGNÓSTICO...\n');
        await this.diagnosticarTableau();
      } catch (error) {
        console.warn('Error:', error);
      }
    }
    
    console.log('═══════════════════════════════════════════════════\n');
  }
}
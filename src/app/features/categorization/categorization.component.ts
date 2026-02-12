// 📊 NetoInsight - Categorization Component (EMBEDDING API v3 - ENHANCED)

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
  authError: string = '';
  isFullscreen: boolean = false;
  showExportMenu: boolean = false;
  
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
    }
    this.loadTableauScript();
    this.observeSidebarChanges();
  }

  ngAfterViewInit(): void {
    this.adjustForSidebar();
  }
  
  ngOnDestroy(): void {
    // Cleanup
    if (this.vizElement) {
      this.vizElement.dispose?.();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  /**
   * Observar cambios en el sidebar para ajustar el dashboard
   */
  private observeSidebarChanges(): void {
    // Observar el main-content para detectar cambios en margin-left
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      this.resizeObserver = new ResizeObserver(() => {
        this.adjustForSidebar();
      });
      this.resizeObserver.observe(mainContent);
    }

    // También escuchar cambios de clase en main-content
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

  /**
   * Ajustar el ancho del dashboard según el estado del sidebar
   */
  private adjustForSidebar(): void {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      const isMini = mainContent.classList.contains('sidebar-mini');
      const container = document.querySelector('.categorization-container') as HTMLElement;
      
      if (container) {
        // El main-content ya tiene el margin-left correcto
        // Solo necesitamos asegurar que nuestro container use el 100% del espacio disponible
        this.renderer.setStyle(container, 'width', '100%');
        this.renderer.setStyle(container, 'max-width', '100%');
      }
    }
  }

  // Listener para detectar cambios de tamaño de ventana
  @HostListener('window:resize')
  onResize() {
    this.adjustDashboardSize();
  }

  // Listener para detectar tecla ESC en fullscreen
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

      // Crear elemento tableau-viz según documentación oficial
      const viz = document.createElement('tableau-viz');
      viz.setAttribute('id', 'tableau-viz');
      viz.setAttribute('src', embedUrl);
      viz.setAttribute('token', this.jwtToken);
      viz.setAttribute('width', '100%');
      viz.setAttribute('height', '100%'); // Usar 100% para ocupar todo el espacio del contenedor
      viz.setAttribute('toolbar', 'hidden'); // Ocultamos toolbar de Tableau
      viz.setAttribute('hide-tabs', 'true'); // Ocultamos tabs si los hay
      
      // Estilos inline para forzar expansión completa
      viz.style.width = '100%';
      viz.style.height = '100%';
      viz.style.display = 'block';
      viz.style.minHeight = '100%';

      // Guardar referencia al viz element
      this.vizElement = viz;

      // Event listeners según documentación oficial
      viz.addEventListener('firstinteractive', () => {
        console.log('✅ Dashboard cargado con SSO');
        this.isLoading = false;
        this.authError = '';
        this.adjustDashboardSize();
      });

      viz.addEventListener('vizloadError', (event: any) => {
        console.error('❌ Viz Load Error:', event.detail);
        this.isLoading = false;
        this.authError = 'Error de autenticación Connected App: ' + (event.detail?.errorCode || 'unknown');
      });

      container.appendChild(viz);
      console.log('📊 tableau-viz element creado con JWT token');

      // Timeout
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

  private adjustDashboardSize(): void {
    // Ajustar tamaño del dashboard después de cargar
    if (this.vizElement) {
      try {
        // Force redraw
        this.vizElement.style.width = '100%';
        this.vizElement.style.height = '100%';
      } catch (error) {
        console.warn('No se pudo ajustar tamaño del dashboard:', error);
      }
    }
    
    // También ajustar según el sidebar
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
        // Método 1: Usar revertAllAsync para resetear y refrescar
        await this.vizElement.revertAllAsync();
        console.log('✅ Dashboard refrescado');
      } else {
        // Método 2: Recargar completamente
        await this.loadDashboard();
      }
    } catch (error) {
      console.error('Error refrescando dashboard:', error);
      // Si falla, recargar completamente
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

      console.log('📄 Exportando a PDF...');
      
      // Usar la API de Tableau para abrir el diálogo de exportación
      await this.vizElement.displayDialogAsync('export-pdf');
      
      console.log('✅ Diálogo de exportación PDF abierto');
      
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

      console.log('🖼️ Exportando a imagen...');
      
      // Usar la API de Tableau para abrir el diálogo de exportación
      await this.vizElement.displayDialogAsync('export-image');
      
      console.log('✅ Diálogo de exportación de imagen abierto');
      
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

      console.log('📊 Exportando datos...');
      
      // Usar la API de Tableau para abrir el diálogo de exportación de datos
      await this.vizElement.displayDialogAsync('export-data');
      
      console.log('✅ Diálogo de exportación de datos abierto');
      
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
      // Entrar a fullscreen
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
      // Salir de fullscreen
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

  async undoAction(): Promise<void> {
    try {
      if (!this.vizElement) return;
      
      await this.vizElement.undoAsync();
      console.log('↩️ Undo ejecutado');
    } catch (error) {
      console.warn('No hay acciones para deshacer');
    }
  }

  async redoAction(): Promise<void> {
    try {
      if (!this.vizElement) return;
      
      await this.vizElement.redoAsync();
      console.log('↪️ Redo ejecutado');
    } catch (error) {
      console.warn('No hay acciones para rehacer');
    }
  }

  async debugAuth(): Promise<void> {
    console.log('=== DEBUG EMBEDDING API v3 ===');
    console.log('Loading:', this.isLoading);
    console.log('Error:', this.authError);
    console.log('JWT Token:', this.jwtToken ? `Present (${this.jwtToken.length} chars)` : 'Missing');
    console.log('Fullscreen:', this.isFullscreen);
    
    const user = this.authService.getCurrentUser();
    console.log('User:', user ? user.email : 'Not authenticated');
    
    const vizElement = document.getElementById('tableau-viz');
    console.log('Viz Element:', vizElement ? 'Created' : 'Not created');
    
    if (vizElement) {
      console.log('Viz src:', vizElement.getAttribute('src'));
      console.log('Viz token:', vizElement.getAttribute('token') ? 'Present' : 'Missing');
    }
    
    console.log('Script loaded:', !!document.getElementById('tableau-embedding-script'));

    // Info avanzada
    if (this.vizElement) {
      try {
        const workbook = await this.vizElement.workbook;
        console.log('Workbook:', workbook);
        
        const activeSheet = await workbook.activeSheet;
        console.log('Active Sheet:', activeSheet?.name);
        
        const sheets = await workbook.publishedSheetsInfo;
        console.log('Available Sheets:', sheets?.map((s: any) => s.name));
      } catch (error) {
        console.warn('No se pudo obtener info del workbook:', error);
      }
    }
  }
}
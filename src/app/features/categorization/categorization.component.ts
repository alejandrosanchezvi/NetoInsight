// 📊 NetoInsight - Categorization Component (OPTIMIZADO)

import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-categorization',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './categorization.component.html',
  styleUrls: ['./categorization.component.css']
})
export class CategorizationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('tableauViz', { static: false }) tableauVizElement!: ElementRef;
  
  // Configuración
  tableauVizUrl = 'https://us-east-1.online.tableau.com/t/nexustiendasneto/views/NexusProveedores/Categorizacin';
  currentProviderName = '';
  
  // Estados
  isLoading = true;
  showAuthPrompt = false;
  isInitialized = false;
  
  // Filtros
  private readonly FILTER_FIELD_NAME = 'Proveedor';
  private readonly WORKSHEETS_TO_SKIP: string[] = [];
  
  // Referencias
  private viz: any = null;
  private authAttempted = false;
  private authCheckInterval: any = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    console.log('📊 [TABLEAU] Inicializando...');
    
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.currentProviderName = currentUser.tenantName;
      console.log(`✅ [USER] ${currentUser.name} | ${this.currentProviderName}`);
    } else {
      console.error('❌ [ERROR] No hay usuario autenticado');
    }
    
    this.loadTableauScript();
  }

  ngAfterViewInit(): void {
    console.log('📊 [LIFECYCLE] Component initialized');
  }

  ngOnDestroy(): void {
    // Limpiar intervalo si existe
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
    }
  }

  /**
   * Cargar Tableau Embedding API v3
   */
  private loadTableauScript(): void {
    console.log('📜 [SCRIPT] Loading Tableau Embedding API v3...');
    
    const existingScript = document.getElementById('tableau-embedding-script');
    
    if (existingScript) {
      console.log('✅ [SCRIPT] Already loaded');
      this.isLoading = false;
      return;
    }

    const script = document.createElement('script');
    script.id = 'tableau-embedding-script';
    script.type = 'module';
    script.src = 'https://us-east-1.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';
    
    script.onload = () => {
      console.log('✅ [SCRIPT] Tableau API loaded successfully');
      this.isLoading = false;
    };
    
    script.onerror = (error) => {
      console.error('❌ [SCRIPT] Failed to load:', error);
      this.isLoading = false;
    };
    
    document.head.appendChild(script);
  }

  /**
   * Evento: Tableau cargado
   */
  async onTableauLoad(event: any): Promise<void> {
    console.log('📊 [TABLEAU] Dashboard loaded - firstinteractive event');
    
    this.viz = event.target;
    this.isInitialized = true;
    
    try {
      // Aplicar filtros
      await this.applyProviderFilter();
      
      this.isLoading = false;
      this.showAuthPrompt = false;
      console.log('✅ [SUCCESS] Dashboard fully initialized');
      
    } catch (error) {
      console.error('❌ [ERROR] Initialization failed:', error);
      this.isLoading = false;
    }
  }

  /**
   * Manejar errores de Tableau
   */
  async onTableauError(event: any): Promise<void> {
    console.error('❌ [TABLEAU-ERROR] Error detected:', event);
    
    const detail = event.detail;
    
    // Detectar error 401 (No autenticado)
    if (detail && (detail.errorCode === 'not-authenticated' || detail.message?.includes('401') || detail.message?.includes('redirect=auth'))) {
      console.warn('🔒 [AUTH] 401 Unauthorized - Authentication required');
      
      if (!this.authAttempted) {
        this.authAttempted = true;
        this.showAuthPrompt = true;
        this.isLoading = false;
        
        console.log('💡 [AUTH] Showing authentication prompt');
      }
    } else {
      console.error('❌ [ERROR] Other error:', detail);
      this.isLoading = false;
    }
  }

  /**
   * Abrir autenticación de Tableau
   */
  openTableauAuth(): void {
    console.log('🔐 [AUTH] Opening Tableau authentication...');
    
    const authUrl = 'https://us-east-1.online.tableau.com/t/nexustiendasneto/auth';
    const authWindow = window.open(authUrl, 'TableauAuth', 'width=600,height=700,scrollbars=yes');
    
    if (!authWindow) {
      alert('Por favor permite popups para este sitio');
      return;
    }
    
    // Polling para detectar cierre de ventana
    this.authCheckInterval = setInterval(() => {
      if (authWindow.closed) {
        clearInterval(this.authCheckInterval);
        console.log('✅ [AUTH] Auth window closed, reloading dashboard...');
        this.reloadDashboard();
      }
    }, 500);
  }

  /**
   * Recargar dashboard después de autenticación
   */
  private reloadDashboard(): void {
    console.log('🔄 [RELOAD] Reloading dashboard...');
    
    this.isLoading = true;
    this.showAuthPrompt = false;
    this.authAttempted = false;
    
    // Forzar recarga del viz
    if (this.viz) {
      const timestamp = new Date().getTime();
      this.tableauVizUrl = this.tableauVizUrl.split('?')[0] + `?refresh=${timestamp}`;
      
      // Esperar un momento antes de recargar
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }

  /**
   * Aplicar filtro de proveedor
   */
  private async applyProviderFilter(): Promise<void> {
    if (!this.currentProviderName) {
      console.warn('⚠️ [FILTER] No provider name available');
      return;
    }

    console.log('═══════════════════════════════════════');
    console.log('🔍 [FILTER] Applying provider filter');
    console.log(`📌 Field: "${this.FILTER_FIELD_NAME}"`);
    console.log(`📌 Value: "${this.currentProviderName}"`);
    console.log('═══════════════════════════════════════');
    
    try {
      const workbook = this.viz.workbook;
      const activeSheet = workbook.activeSheet;
      
      if (activeSheet.sheetType === 'dashboard') {
        const worksheets = activeSheet.worksheets;
        console.log(`📋 [WORKSHEETS] Total: ${worksheets.length}`);
        
        let successCount = 0;
        
        for (const worksheet of worksheets) {
          if (this.WORKSHEETS_TO_SKIP.includes(worksheet.name)) {
            continue;
          }
          
          try {
            await worksheet.applyFilterAsync(
              this.FILTER_FIELD_NAME,
              [this.currentProviderName],
              'replace'
            );
            successCount++;
          } catch (error: any) {
            console.warn(`⚠️ [FILTER] Could not apply to "${worksheet.name}":`, error.message);
          }
        }
        
        console.log(`✅ [FILTER] Applied to ${successCount}/${worksheets.length} worksheets`);
        
      } else {
        // Single worksheet
        await activeSheet.applyFilterAsync(
          this.FILTER_FIELD_NAME,
          [this.currentProviderName],
          'replace'
        );
        console.log('✅ [FILTER] Applied to single worksheet');
      }
      
    } catch (error) {
      console.error('❌ [FILTER] Error applying filter:', error);
    }
  }

  /**
   * Refrescar dashboard
   */
  async refreshDashboard(): Promise<void> {
    if (!this.viz || !this.isInitialized) {
      console.warn('⚠️ [REFRESH] Dashboard not initialized');
      return;
    }

    console.log('🔄 [REFRESH] Refreshing data...');
    this.isLoading = true;
    
    try {
      await this.viz.refreshDataAsync();
      console.log('✅ [REFRESH] Data refreshed successfully');
    } catch (error) {
      console.error('❌ [REFRESH] Error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Obtener nombre del proveedor
   */
  getCurrentProviderName(): string {
    return this.currentProviderName || 'Cargando...';
  }
}
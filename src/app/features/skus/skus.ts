// 📊 NetoInsight - Skus

import { Component, OnInit, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { LoadingSpinner } from '../../shared/components/loading-spinner/loading-spinner';

@Component({
  selector: 'app-skus',
  standalone: true,
  imports: [CommonModule, LoadingSpinner],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './skus.html',
  styleUrls: ['./skus.css']
})
export class Skus implements OnInit {
  @ViewChild('tableauViz', { static: false }) tableauVizElement!: ElementRef;
  
  tableauVizUrl: string = 'https://us-east-1.online.tableau.com/t/nexustiendasneto/views/NexusProveedores/Skus';
  isLoading: boolean = true;
  currentProviderName: string = '';
  showDashboard: boolean = false;
  
  private readonly FILTER_FIELD_NAME = 'Proveedor';
  private readonly WORKSHEETS_TO_SKIP: string[] = [];
  private viz: any;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    console.log('📦 [SKUS] Inicializando');
    
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.currentProviderName = currentUser.tenantName;
      console.log(`🏢 [SKUS] Proveedor: ${this.currentProviderName}`);
    }
    
    this.loadTableauScript();
  }

  private loadTableauScript(): void {
    const existingScript = document.getElementById('tableau-embedding-script');
    
    if (existingScript) {
      console.log('✅ [SKUS] Script ya existe');
      return;
    }

    console.log('📜 [SKUS] Cargando Tableau API...');
    
    const script = document.createElement('script');
    script.id = 'tableau-embedding-script';
    script.type = 'module';
    script.src = 'https://us-east-1.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';
    
    script.onload = () => {
      console.log('✅ [SKUS] API cargada');
    };
    
    script.onerror = (error) => {
      console.error('❌ [SKUS] Error:', error);
      this.isLoading = false;
    };
    
    document.head.appendChild(script);
  }

  async onTableauLoad(event: any): Promise<void> {
    console.log('📊 [SKUS] Dashboard cargado');
    this.viz = event.target;
    
    try {
      await this.applyProviderFilter();
      
      this.isLoading = false;
      this.showDashboard = true;
      console.log('✅ [SKUS] Inicializado');
    } catch (error) {
      console.error('❌ [SKUS] Error:', error);
      this.isLoading = false;
      this.showDashboard = true;
    }
  }

  private async applyProviderFilter(): Promise<void> {
    try {
      const workbook = this.viz.workbook;
      const activeSheet = workbook.activeSheet;
      
      console.log(`🔐 [SKUS] Aplicando filtro: ${this.currentProviderName}`);

      if (activeSheet.sheetType === 'dashboard') {
        const worksheets = activeSheet.worksheets;
        console.log(`📝 [SKUS] Procesando ${worksheets.length} worksheets`);
        
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
          } catch (error) {
            console.warn(`⚠️ [SKUS] No se pudo filtrar: ${worksheet.name}`);
          }
        }
        
        console.log(`✅ [SKUS] Filtros aplicados: ${successCount}/${worksheets.length}`);
      } else {
        await activeSheet.applyFilterAsync(
          this.FILTER_FIELD_NAME,
          [this.currentProviderName],
          'replace'
        );
        console.log('✅ [SKUS] Filtro aplicado');
      }
    } catch (error) {
      console.error('❌ [SKUS] Error al filtrar:', error);
      throw error;
    }
  }

  onTableauError(event: any): void {
    console.error('❌ [SKUS] Error en Tableau:', event);
    this.isLoading = false;
    this.showDashboard = true;
  }

  getCurrentProviderName(): string {
    return this.currentProviderName || 'Cargando...';
  }

  async refreshDashboard(): Promise<void> {
    console.log('🔄 [SKUS] Refrescando...');
    this.isLoading = true;
    
    try {
      await this.viz.refreshDataAsync();
      console.log('✅ [SKUS] Actualizado');
    } catch (error) {
      console.error('❌ [SKUS] Error:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
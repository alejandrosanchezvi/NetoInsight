// 📊 NetoInsight - Categorization

import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { LoadingSpinner } from '../../shared/components/loading-spinner/loading-spinner';

@Component({
  selector: 'app-categorization',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './categorization.component.html',
  styleUrls: ['./categorization.component.css']
})
export class CategorizationComponent implements OnInit, AfterViewInit {
  @ViewChild('tableauViz', { static: false }) tableauVizElement!: ElementRef;
  
  tableauVizUrl: string = 'https://us-east-1.online.tableau.com/t/nexustiendasneto/views/NexusProveedores/Categorizacin';
  // tableauVizUrl: string = 'https://us-east-1.online.tableau.com/t/nexustiendasneto/views/NexusProveedores/Categorizacin';
  isLoading: boolean = true;
  currentProviderName: string = '';
  showDashboard: boolean = false;
  
  private readonly FILTER_FIELD_NAME = 'Proveedor';
  private readonly WORKSHEETS_TO_SKIP = ['skus'];
  
  private viz: any;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    console.log('🔷 [CATEGORIZATION] Inicializando componente');
    
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.currentProviderName = currentUser.tenantName;
      console.log(`🏢 [CATEGORIZATION] Proveedor: ${this.currentProviderName}`);
    }
    
    this.loadTableauScript();
  }

  ngAfterViewInit(): void {
    console.log('🔷 [CATEGORIZATION] Vista inicializada');
  }

  private loadTableauScript(): void {
    console.log('📜 [CATEGORIZATION] Cargando Tableau API...');
    
    const existingScript = document.getElementById('tableau-embedding-script');
    
    if (existingScript) {
      console.log('✅ [CATEGORIZATION] Script ya existe');
      return;
    }

    const script = document.createElement('script');
    script.id = 'tableau-embedding-script';
    script.type = 'module';
    script.src = 'https://us-east-1.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';
    
    script.onload = () => {
      console.log('✅ [CATEGORIZATION] Tableau API cargada');
    };
    
    script.onerror = (error) => {
      console.error('❌ [CATEGORIZATION] Error al cargar API:', error);
      this.isLoading = false;
    };
    
    document.head.appendChild(script);
  }

  async onTableauLoad(event: any): Promise<void> {
    console.log('📊 [CATEGORIZATION] Dashboard cargado');
    this.viz = event.target;
    
    try {
      await this.diagnosticarTableau();
      await this.applyProviderFilter();
      
      this.isLoading = false;
      this.showDashboard = true;
      console.log('✅ [CATEGORIZATION] Dashboard inicializado');
    } catch (error) {
      console.error('❌ [CATEGORIZATION] Error al inicializar:', error);
      this.isLoading = false;
      this.showDashboard = true;
    }
  }

  private async applyProviderFilter(): Promise<void> {
    console.log('═══════════════════════════════════════════════════');
    console.log('🔐 [FILTER] INICIANDO APLICACIÓN DE FILTRO');
    console.log('═══════════════════════════════════════════════════');
    console.log(`🔍 [FILTER] Campo: "${this.FILTER_FIELD_NAME}"`);
    console.log(`📌 [FILTER] Valor: "${this.currentProviderName}"`);
    
    try {
      const workbook = this.viz.workbook;
      const activeSheet = workbook.activeSheet;

      if (activeSheet.sheetType === 'dashboard') {
        const worksheets = activeSheet.worksheets;
        console.log(`📋 [WORKSHEETS] Total: ${worksheets.length}`);
        
        let successCount = 0;
        let skipCount = 0;
        
        for (let i = 0; i < worksheets.length; i++) {
          const worksheet = worksheets[i];
          const worksheetName = worksheet.name;
          
          console.log(`\n📝 [WORKSHEET ${i + 1}/${worksheets.length}] ${worksheetName}`);
          
          if (this.WORKSHEETS_TO_SKIP.includes(worksheetName)) {
            console.log(`⏭️ [SKIP] Omitido`);
            skipCount++;
            continue;
          }
          
          try {
            await worksheet.applyFilterAsync(
              this.FILTER_FIELD_NAME,
              [this.currentProviderName],
              'replace'
            );
            console.log(`✅ [SUCCESS] Filtro aplicado`);
            successCount++;
          } catch (error: any) {
            console.warn(`⚠️ [WARNING] No se pudo aplicar filtro`);
            if (error.message && error.message.includes('invalid-fields')) {
              console.warn(`💡 [SUGERENCIA] Agregar "${worksheetName}" a WORKSHEETS_TO_SKIP`);
            }
          }
        }
        
        console.log('\n═══════════════════════════════════════════════════');
        console.log('📊 [RESUMEN] RESULTADOS');
        console.log('═══════════════════════════════════════════════════');
        console.log(`✅ Exitosos: ${successCount}`);
        console.log(`⏭️ Omitidos: ${skipCount}`);
        console.log('═══════════════════════════════════════════════════\n');
        
      } else {
        await activeSheet.applyFilterAsync(
          this.FILTER_FIELD_NAME,
          [this.currentProviderName],
          'replace'
        );
        console.log('✅ [SUCCESS] Filtro aplicado en worksheet único');
      }

      console.log(`✅ [COMPLETE] Filtrado completado para: ${this.currentProviderName}\n`);
      
    } catch (error) {
      console.error('❌ [ERROR] Error al aplicar filtro:', error);
      throw error;
    }
  }

  onTableauError(event: any): void {
    console.error('❌ [CATEGORIZATION] Error en Tableau:', event);
    this.isLoading = false;
    this.showDashboard = true;
  }

  getCurrentProviderName(): string {
    return this.currentProviderName || 'Cargando...';
  }

  async refreshDashboard(): Promise<void> {
    console.log('🔄 [CATEGORIZATION] Refrescando...');
    this.isLoading = true;
    
    try {
      await this.viz.refreshDataAsync();
      console.log('✅ [CATEGORIZATION] Actualizado');
    } catch (error) {
      console.error('❌ [CATEGORIZATION] Error al actualizar:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async diagnosticarTableau(): Promise<void> {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║        🔍 DIAGNÓSTICO DE TABLEAU                   ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    try {
      const workbook = this.viz.workbook;
      const activeSheet = workbook.activeSheet;
      
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
              console.log('    🔍 Sin filtros');
            } else {
              filters.forEach((filter: any) => {
                console.log(`    🔍 ${filter.fieldName} (${filter.filterType})`);
              });
            }
            
            const hasProveedorFilter = filters.some((f: any) => 
              f.fieldName.toLowerCase() === this.FILTER_FIELD_NAME.toLowerCase()
            );
            
            console.log(hasProveedorFilter ? 
              `    ✅ Campo "${this.FILTER_FIELD_NAME}" existe` : 
              `    ⚠️ Campo "${this.FILTER_FIELD_NAME}" no encontrado`
            );
            
          } catch (error) {
            console.warn('    ⚠️ Error al obtener filtros');
          }
        }
      }
      
      console.log('\n╚════════════════════════════════════════════════════╝\n');
      
    } catch (error) {
      console.error('❌ [DIAGNÓSTICO] Error:', error);
    }
  }
}
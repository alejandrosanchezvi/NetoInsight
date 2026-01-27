// 📊 NetoInsight - Categorization Component

import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-categorization',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // Necesario para tableau-viz
  templateUrl: './categorization.component.html',
  styleUrls: ['./categorization.component.css']
})
export class CategorizationComponent implements OnInit, OnDestroy {
  isLoading = true;
  tableauVizUrl = 'https://us-east-1.online.tableau.com/t/nexustiendasneto/views/NexusProveedores/Categorizacin';
  
  ngOnInit(): void {
    // Cargar el script de Tableau Embedding API
    this.loadTableauScript();
    
    // Simular carga completa después de 2 segundos
    setTimeout(() => {
      this.isLoading = false;
    }, 2000);
  }

  ngOnDestroy(): void {
    // Limpiar script si es necesario
    const existingScript = document.querySelector('script[src*="tableau.embedding"]');
    if (existingScript) {
      existingScript.remove();
    }
  }

  /**
   * Cargar el script de Tableau Embedding API dinámicamente
   */
  private loadTableauScript(): void {
    // Verificar si el script ya existe
    const existingScript = document.querySelector('script[src*="tableau.embedding"]');
    if (existingScript) {
      console.log('Tableau script ya cargado');
      return;
    }

    // Crear y agregar el script
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://us-east-1.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';
    script.async = true;
    
    script.onload = () => {
      console.log('✅ Tableau Embedding API cargado exitosamente');
    };
    
    script.onerror = () => {
      console.error('❌ Error al cargar Tableau Embedding API');
      this.isLoading = false;
    };

    document.head.appendChild(script);
  }

  /**
   * Evento cuando Tableau termina de cargar
   */
  onTableauLoad(event: any): void {
    console.log('Dashboard de Tableau cargado:', event);
    this.isLoading = false;
  }

  /**
   * Manejar errores de Tableau
   */
  onTableauError(event: any): void {
    console.error('Error en Tableau:', event);
    this.isLoading = false;
  }
}

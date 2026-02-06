// 🏠 NetoInsight - Main Layout Component (REFINADO)

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    SidebarComponent
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit {
  isSidebarOpen = true;

  constructor(
     private authService: AuthService,
  ){}

  ngOnInit(): void {
    // En móvil, el sidebar empieza cerrado
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    }

    // Escuchar cambios de tamaño de ventana
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  /**
   * Toggle sidebar visibility
   */
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    
    // Opcional: Guardar preferencia en localStorage
    if (window.innerWidth >= 768) {
      localStorage.setItem('sidebarOpen', this.isSidebarOpen.toString());
    }
  }

  /**
   * Cerrar sidebar (útil para móvil)
   */
  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  /**
   * Manejar cambios de tamaño de ventana
   */
  private handleResize(): void {
    // En desktop, restaurar preferencia guardada
    if (window.innerWidth >= 768) {
      const savedState = localStorage.getItem('sidebarOpen');
      if (savedState !== null) {
        this.isSidebarOpen = savedState === 'true';
      } else {
        this.isSidebarOpen = true;
      }
    }
    // En móvil, cerrar automáticamente
    else {
      this.isSidebarOpen = false;
    }
  }

  isInternalUser(): boolean {
  return this.authService.isInternalUser();
}
}
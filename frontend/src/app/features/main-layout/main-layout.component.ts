// 🏠 NetoInsight - Main Layout Component (CON SESSION TIMEOUT)

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { SessionTimeoutModal } from '../../shared/components/session-timeout-modal/session-timeout-modal';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    SessionTimeoutModal       // ← modal de sesión
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  isSidebarOpen = true;

  constructor(
    private authService: AuthService,
    private sessionService: SessionService
  ) {}

  ngOnInit(): void {
    // Iniciar timeout de sesión al entrar al layout protegido
    this.sessionService.startSession();

    // Móvil: sidebar cerrado por defecto
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    }

    window.addEventListener('resize', this.handleResize.bind(this));
  }

  ngOnDestroy(): void {
    // No llamar endSession aquí — solo al hacer logout real
    // para no interrumpir la sesión si Angular recarga el componente
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    if (window.innerWidth >= 768) {
      localStorage.setItem('sidebarOpen', this.isSidebarOpen.toString());
    }
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  private handleResize(): void {
    if (window.innerWidth >= 768) {
      const savedState = localStorage.getItem('sidebarOpen');
      this.isSidebarOpen = savedState !== null ? savedState === 'true' : true;
    } else {
      this.isSidebarOpen = false;
    }
  }

  isInternalUser(): boolean {
    return this.authService.isInternalUser();
  }
}
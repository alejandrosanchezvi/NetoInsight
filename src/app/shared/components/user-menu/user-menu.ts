// 👤 NetoInsight - User Menu Component

import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  divider?: boolean;
  danger?: boolean;
}

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-menu.html',
  styleUrls: ['./user-menu.css']
})
export class UserMenu {
  @Input() user!: User;
  @Output() closeMenu = new EventEmitter<void>();

  menuItems: MenuItem[] = [];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.initializeMenuItems();
  }

  /**
   * Inicializar items del menú
   */
  private initializeMenuItems(): void {
    this.menuItems = [
      {
        id: 'profile',
        label: 'Editar Perfil',
        icon: 'user',
        action: () => this.navigateTo('/profile')
      },
      {
        id: 'settings',
        label: 'Configuración y Privacidad',
        icon: 'settings',
        action: () => this.navigateTo('/settings')
      },
      {
        id: 'help',
        label: 'Ayuda y Soporte',
        icon: 'help-circle',
        action: () => this.navigateTo('/help')
      },
      {
        id: 'accessibility',
        label: 'Display y Accesibilidad',
        icon: 'eye',
        action: () => this.navigateTo('/accessibility')
      },
      {
        id: 'logout',
        label: 'Cerrar Sesión',
        icon: 'log-out',
        action: () => this.onLogout(),
        divider: true,
        danger: true
      }
    ];
  }

  /**
   * Navegar a ruta específica
   */
  private navigateTo(path: string): void {
    this.router.navigate([path]);
    this.closeMenu.emit();
  }

  /**
   * Manejar logout
   */
  private onLogout(): void {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
      this.authService.logout();
      this.router.navigate(['/login']);
      this.closeMenu.emit();
    }
  }

  /**
   * Manejar click en item del menú
   */
  onMenuItemClick(item: MenuItem): void {
    item.action();
  }

  /**
   * Cerrar menú al hacer click fuera
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu') && !target.closest('.user-info-button')) {
      this.closeMenu.emit();
    }
  }

  /**
   * Obtener SVG path según el ícono
   */
  getIconPath(iconName: string): string {
    const icons: { [key: string]: string } = {
      'user': 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'settings': 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'help-circle': 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01 M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z',
      'eye': 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'log-out': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9'
    };

    return icons[iconName] || '';
  }
}

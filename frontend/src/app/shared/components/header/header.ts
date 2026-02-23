// 🎨 NetoInsight - Header Component

import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';
import { UserMenu } from '../user-menu/user-menu';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, UserMenu],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit {
  @Output() toggleSidebar = new EventEmitter<void>();
  
  currentUser: User | null = null;
  showUserMenu = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  /**
   * Emitir evento para toggle del sidebar
   */
  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  /**
   * Toggle del menú de usuario
   */
  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  /**
   * Cerrar menú de usuario
   */
  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  /**
   * Obtener iniciales del usuario para avatar
   */
  getUserInitials(): string {
    if (!this.currentUser) return '?';
    
    const names = this.currentUser.name.split(' ');
    if (names.length >= 2) {
      return names[0][0] + names[1][0];
    }
    return names[0][0];
  }

  /**
   * Obtener nombre del tenant/proveedor
   */
  getTenantName(): string {
    return this.currentUser?.tenantName ?? 'Sin asignar';
  }

  /**
 * Logout del usuario
 */
async onLogout(): Promise<void> {
  try {
    await this.authService.logout();
    // El redirect lo maneja el AuthService
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}
}

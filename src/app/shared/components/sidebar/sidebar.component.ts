// 📂 NetoInsight - Sidebar Component (CON FILTRO DE ROLES)

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole } from '../../../core/models/user.model';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: number;
  internal: boolean;      // Solo usuarios internos de Neto
  adminOnly: boolean;     // Solo usuarios con rol Admin
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent implements OnInit {
  @Input() isOpen = true;
  @Input() isInternalUser = false;
  @Output() closeSidebar = new EventEmitter<void>();

  currentUser: User | null = null;
  activeMenuItem: string = 'categorization';

  // 📋 MENÚ CON PERMISOS
  menuItems: MenuItem[] = [
    {
      id: 'categorization',
      label: 'Categorización',
      icon: 'grid',
      route: '/categorization',
      internal: false,
      adminOnly: false,
    },
    {
      id: 'stores',
      label: 'Tiendas',
      icon: 'store',
      route: '/stores',
      internal: false,
      adminOnly: false,
    },
    {
      id: 'skus',
      label: 'SKUs',
      icon: 'package',
      route: '/skus',
      internal: false,
      adminOnly: false,
    },
    {
      id: 'stocks',
      label: 'Stocks',
      icon: 'box',
      route: '/stocks',
      internal: false,
      adminOnly: false,
    },
    {
      id: 'purchase-orders',
      label: 'Órdenes de Compra',
      icon: 'shoppingcart',
      route: '/purchase-orders',
      internal: false,
      adminOnly: false,
    },
    {
      id: 'users',
      label: 'Usuarios',
      icon: 'users',
      route: '/users',
      internal: false,
      adminOnly: true,       // ← Solo Admins
    },
    {
      id: 'admin-tenants',
      label: 'Proveedores',
      icon: 'truck',
      route: '/admin/tenants',
      internal: true,        // ← Solo Admins Internos de Neto
      adminOnly: false,
    },
  ];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  /**
   * Verificar si el item debe mostrarse según permisos
   */
  shouldShowItem(item: MenuItem): boolean {
    // Si no hay usuario, no mostrar nada
    if (!this.currentUser) {
      return false;
    }

    // Verificar permiso internal
    if (item.internal && !this.isInternalUser) {
      return false;
    }

    // Verificar permiso adminOnly
    if (item.adminOnly) {
      const isAdmin = this.currentUser.role === UserRole.ADMIN || this.currentUser.isInternal;
      if (!isAdmin) {
        return false;
      }
    }

    return true;
  }

  /**
   * Navegar a ruta y cerrar sidebar en móvil
   */
  navigateTo(item: MenuItem): void {
    this.activeMenuItem = item.id;
    this.router.navigate([item.route]);

    // Cerrar sidebar en móvil
    if (window.innerWidth < 768) {
      this.closeSidebar.emit();
    }
  }

  /**
   * Verificar si el item está activo
   */
  isActive(item: MenuItem): boolean {
    return this.activeMenuItem === item.id;
  }

  /**
   * Obtener SVG path según el ícono
   */
  getIconPath(iconName: string): string {
    const icons: { [key: string]: string } = {
      grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
      store:
        'M3 21h18M5 21V7l-2-4h18l-2 4v14M9 21v-8h6v8M10 3v4M14 3v4',
      package: 'M16 16l4-4-4-4M8 8l-4 4 4 4M12 3v18',
      box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
      shoppingcart:
        'M9 2L7 6M15 2l2 4M7 6h10l2 8H5l2-8zM5 14l1 8h12l1-8M10 18h4',
      users:
        'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
      truck:
        'M16 3h5v13h-5zM16 8h5M1 8h15v13H1zM1 11h9',
    };
    return icons[iconName] || '';
  }
}
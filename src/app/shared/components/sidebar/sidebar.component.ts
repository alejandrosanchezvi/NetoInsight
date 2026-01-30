// 📂 NetoInsight - Sidebar Component (MVP ACTUALIZADO)

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  @Input() isOpen = true;
  @Output() closeSidebar = new EventEmitter<void>();

  // 🔹 MENÚ MVP: Solo 5 opciones
  menuItems: MenuItem[] = [
    {
      id: 'categorization',
      label: 'Categorización',
      icon: 'grid',
      route: '/categorization',
    },
    {
      id: 'stores',
      label: 'Tiendas',
      icon: 'store',
      route: '/stores',
    },
    {
      id: 'skus',
      label: 'SKUs',
      icon: 'package',
      route: '/skus',
    },
    {
      id: 'stocks',
      label: 'Stocks',
      icon: 'box',
      route: '/stocks',
    },
    {
      id: 'purchase-orders',
      label: 'Órdenes de Compra',
      icon: 'shopping-cart',
      route: '/purchase-orders',
    },
    {
      id: 'users',
      label: 'Usuarios',
      icon: 'users',
      route: '/users',
    },
    {
      id: 'admin-tenants',
      label: 'Proveedores',
      icon: 'building',
      route: '/admin/tenants',
      // internal: true, // Solo visible para usuarios internos
    },
  ];

  activeMenuItem: string = 'categorization';

  constructor(private router: Router) {}

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
        'M3 21h18M3 7v1a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0 3 3 3 3 0 0 0 3-3v-1M5 21V10.355M19 21V10.355M2 7l1.964-3.282A1 1 0 0 1 4.82 3h14.36a1 1 0 0 1 .856.518L22 7H2z',
      package:
        'M16.5 9.4l-9-5.19 M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12',
      box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12',
      'shopping-cart': 'M9 2L1 4v14l8 2 8-2 8 2V6l-8-2-8 2z M9 2v18 M17 4v18',
      users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    };

    return icons[iconName] || '';
  }
}

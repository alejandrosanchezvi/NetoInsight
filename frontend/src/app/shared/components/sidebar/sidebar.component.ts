// 📂 NetoInsight - Sidebar Component (CORREGIDO - DETECTA RUTA ACTIVA)

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { filter } from 'rxjs/operators';
import { TrialInfoComponent } from './trial-banner.component';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: number;
  internal: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TrialInfoComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent implements OnInit {
  @Input() isOpen = true;
  @Input() isInternalUser = true;
  @Output() closeSidebar = new EventEmitter<void>();

  // 🔹 MENÚ MVP
  menuItems: MenuItem[] = [
    {
      id: 'categorization',
      label: 'Categorización',
      icon: 'grid',
      route: '/categorization',
      internal: false,
    },
    // {
    //   id: 'stores',
    //   label: 'Tiendas',
    //   icon: 'store',
    //   route: '/stores',
    //   internal: false,
    // },
    {
      id: 'skus',
      label: 'SKUs',
      icon: 'package',
      route: '/skus',
      internal: false,
    },
    {
      id: 'stocks',
      label: 'Stocks',
      icon: 'box',
      route: '/stocks',
      internal: false,
    },
    {
      id: 'purchase-orders',
      label: 'Órdenes de Compra',
      icon: 'shoppingcart',
      route: '/purchase-orders',
      internal: false,
    },
    {
      id: 'users',
      label: 'Usuarios',
      icon: 'users',
      route: '/users',
      internal: false,
    },
    {
      id: 'admin-tenants',
      label: 'Proveedores',
      icon: 'truck',
      route: '/admin/tenants',
      internal: true,
    },
    {
      id: 'metrics',
      label: 'Métricas',
      icon: 'metrics',
      route: '/admin/metrics',
      internal: true,
    },
  ];

  activeMenuItem: string = '';

  constructor(private router: Router) { }

  ngOnInit(): void {
    // ✅ Detectar ruta actual al cargar
    this.updateActiveMenuItem(this.router.url);

    // ✅ Escuchar cambios de navegación
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateActiveMenuItem(event.urlAfterRedirects);
      });
  }

  /**
   * Actualizar item activo basado en la URL
   */
  private updateActiveMenuItem(url: string): void {
    // Encontrar el item que coincida con la URL actual
    const foundItem = this.menuItems.find(item => {
      // Comparar rutas (ignorar query params y fragments)
      const currentPath = url.split('?')[0].split('#')[0];
      return currentPath === item.route || currentPath.startsWith(item.route + '/');
    });

    if (foundItem) {
      this.activeMenuItem = foundItem.id;
      console.log('🔹 [SIDEBAR] Active menu item:', foundItem.label, '(', foundItem.route, ')');
    } else {
      // Fallback a categorization si no encuentra match
      this.activeMenuItem = 'categorization';
      console.log('🔹 [SIDEBAR] No match found, defaulting to categorization');
    }
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
   * Verificar si se debe mostrar el item (basado en permisos internos)
   */
  shouldShowItem(item: MenuItem): boolean {
    // Mostrar items no internos siempre
    if (!item.internal) {
      return true;
    }
    // Mostrar items internos solo si el usuario es interno
    return this.isInternalUser;
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
      shoppingcart: 'M9 2L1 4v14l8 2 8-2 8 2V6l-8-2-8 2z M9 2v18 M17 4v18',
      users:
        'M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z M12 14C8.13401 14 5 17.134 5 21H19C19 17.134 15.866 14 12 14Z',
      truck:
        'M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M18.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    };

    if (iconName === 'metrics') {
      return 'M18 20V10M12 20V4M6 20V14';
    }
    return icons[iconName] || '';
  }
}
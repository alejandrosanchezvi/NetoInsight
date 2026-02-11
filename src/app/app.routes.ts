// 🗺️ NetoInsight - App Routes (CON PERMISOS CORREGIDOS)

import { Routes } from '@angular/router';
import { MainLayoutComponent } from './features/main-layout/main-layout.component';
import { CategorizationComponent } from './features/categorization/categorization.component';
import { Skus } from './features/skus/skus';
import { Stocks } from './features/stocks/stocks';
import { Login } from './features/auth/login/login';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { UserManagement } from './features/admin/user-management/user-management';
import { AcceptInvite } from './features/auth/accept-invite/accept-invite';
import { TenantManagement } from './features/admin/tenant-management/tenant-management';
import { internalAdminGuard } from './core/guards/internal-admin.guard';

export const routes: Routes = [
  // 🔓 Ruta pública de Login
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'accept-invite',
    component: AcceptInvite,
  },
  // 🏠 Rutas protegidas del Portal
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      // 👥 Gestión de Usuarios - Solo para Admins
      {
        path: 'users',
        component: UserManagement,
        canActivate: [adminGuard],  // ← AGREGAR adminGuard
      },
      {
        path: '',
        redirectTo: 'categorization',
        pathMatch: 'full',
      },
      // 📊 Dashboards - Todos los usuarios
      {
        path: 'categorization',
        component: CategorizationComponent,
      },
      {
        path: 'stores',
        component: CategorizationComponent,
      },
      {
        path: 'skus',
        component: Skus,
      },
      {
        path: 'stocks',
        component: Stocks,
      },
      {
        path: 'purchase-orders',
        component: CategorizationComponent,
      },
      // 🏢 Gestión de Proveedores - Solo para Admins Internos de Neto
      {
        path: 'admin/tenants',
        component: TenantManagement,
        canActivate: [internalAdminGuard],
      },
    ],
  },
  {
    path: 'admin',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'tenants',
        component: TenantManagement,
        canActivate: [internalAdminGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
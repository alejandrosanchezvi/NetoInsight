// 🗺️ NetoInsight - App Routes (Con Login)

import { Routes } from '@angular/router';
import { MainLayoutComponent } from './features/main-layout/main-layout.component';
import { CategorizationComponent } from './features/categorization/categorization.component';
import { Skus } from './features/skus/skus';
import { Stocks } from './features/stocks/stocks';
import { Login } from './features/auth/login/login';
import { authGuard } from './core/guards/auth.guard';
import { UserManagement } from './features/admin/user-management/user-management';
import { AcceptInvite } from './features/auth/accept-invite/accept-invite';
import { TenantManagement } from './features/admin/tenant-management/tenant-management';
import { internalAdminGuard } from './core/guards/internal-admin.guard';

export const routes: Routes = [
  // 🔐 Ruta pública de Login
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
      {
        path: 'users',
        component: UserManagement,
      },
      {
        path: '',
        redirectTo: 'categorization',
        pathMatch: 'full',
      },
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
      {
        path: 'admin/tenants',
        component: TenantManagement,
        canActivate: [internalAdminGuard], // ✅ AGREGAR ESTO
      },
    ],
  },
  {
    path: 'admin',
    component: MainLayoutComponent,
    children: [
      {
        path: 'tenants',
        component: TenantManagement,
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];

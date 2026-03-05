// 🗺️ NetoInsight - App Routes (CON RESET PASSWORD)

import { Routes } from '@angular/router';
import { MainLayoutComponent } from './features/main-layout/main-layout.component';
import { Categorization } from './features/pages-dashboard/categorization/categorization';
import { Skus } from './features/pages-dashboard/skus/skus';
import { Stocks } from './features/pages-dashboard/stocks/stocks';
import { OrdenesDeCompra } from './features/pages-dashboard/ordenes-compra/ordenes-compra';
import { Login } from './features/auth/login/login';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { UserManagement } from './features/admin/user-management/user-management';
import { AcceptInvite } from './features/auth/accept-invite/accept-invite';
import { TenantManagement } from './features/admin/tenant-management/tenant-management';
import { HelpComponent } from './features/help/help';
import { internalAdminGuard } from './core/guards/internal-admin.guard';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { SubscriptionSuspended } from './features/auth/subscription-suspended/subscription-suspended';

export const routes: Routes = [
  // 🔓 Rutas públicas
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'accept-invite',
    component: AcceptInvite,
  },
  {
    path: 'reset-password',
    component: ResetPassword,
  },
  {
    path: 'subscription-suspended',
    component: SubscriptionSuspended,
  },
  // 🏠 Rutas protegidas
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'users',
        component: UserManagement,
        canActivate: [adminGuard],
      },
      {
        path: '',
        redirectTo: 'categorization',
        pathMatch: 'full',
      },
      {
        path: 'categorization',
        component: Categorization,
      },
      {
        path: 'stores',
        component: Categorization,
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
        component: OrdenesDeCompra,
      },
      {
        path: 'help',
        component: HelpComponent,
      },
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
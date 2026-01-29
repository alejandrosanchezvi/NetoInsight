// 🗺️ NetoInsight - App Routes (Con Login)

import { Routes } from '@angular/router';
import { MainLayoutComponent } from './features/main-layout/main-layout.component';
import { CategorizationComponent } from './features/categorization/categorization.component';
import { Skus } from './features/skus/skus';
import { Stocks } from './features/stocks/stocks';
import { Login } from './features/auth/login/login';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // 🔐 Ruta pública de Login
  {
    path: 'login',
    component: Login
  },

  // 🏠 Rutas protegidas del Portal
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard], // ← Guard aplicado aquí
    children: [
      {
        path: '',
        redirectTo: 'categorization',
        pathMatch: 'full'
      },
      {
        path: 'categorization',
        component: CategorizationComponent
      },
      {
        path: 'stores',
        component: CategorizationComponent
      },
      {
        path: 'skus',
        component: Skus
      },
      {
        path: 'stocks',
        component: Stocks
      },
      {
        path: 'purchase-orders',
        component: CategorizationComponent
      }
    ]
  },

  // 🔄 Redirect por defecto
  {
    path: '**',
    redirectTo: 'login'
  }
];
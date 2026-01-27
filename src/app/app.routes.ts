// 🗺️ NetoInsight - App Routes (MVP)

import { Routes } from '@angular/router';
import { MainLayoutComponent } from './features/main-layout/main-layout.component';
import { CategorizationComponent } from './features/categorization/categorization.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
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
      // 🔹 RUTAS MVP: Solo las 5 opciones del menú
      {
        path: 'stores',
        component: CategorizationComponent // Temporal, usar el mismo componente
      },
      {
        path: 'skus',
        component: CategorizationComponent // Temporal
      },
      {
        path: 'stocks',
        component: CategorizationComponent // Temporal
      },
      {
        path: 'purchase-orders',
        component: CategorizationComponent // Temporal
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
// 🗺️ NetoInsight - App Routes

import { Routes } from '@angular/router';
import { MainLayoutComponent } from './features/main-layout/main-layout.component';
import { CategorizationComponent } from './features/categorization/categorization.component';
import { Skus } from './features/skus/skus';
import { Stocks } from './features/stocks/stocks';

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
  {
    path: '**',
    redirectTo: ''
  }
];
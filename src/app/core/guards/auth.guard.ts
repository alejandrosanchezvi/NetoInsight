// 🔒 NetoInsight - Auth Guard

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔒 [GUARD] Verificando autenticación para:', state.url);

  const isAuthenticated = authService.isAuthenticated();

  if (!isAuthenticated) {
    console.warn('❌ [GUARD] Usuario no autenticado, redirigiendo a login');
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  console.log('✅ [GUARD] Usuario autenticado, acceso permitido');
  return true;
};
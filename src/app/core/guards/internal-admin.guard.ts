// 🔒 NetoInsight - Internal Admin Guard

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const internalAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔒 [GUARD] Checking internal admin access...');

  const isInternal = authService.isInternalUser();

  if (!isInternal) {
    console.warn('❌ [GUARD] Access denied - not internal user');
    alert('Acceso denegado. Solo administradores de Neto pueden acceder a esta página.');
    router.navigate(['/']);
    return false;
  }

  console.log('✅ [GUARD] Access granted');
  return true;
};
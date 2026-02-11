// 🔒 NetoInsight - Internal Admin Guard (SIN ALERTS)

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const internalAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔒 [INTERNAL-ADMIN-GUARD] Checking internal admin access...');

  const isInternal = authService.isInternalUser();

  if (!isInternal) {
    console.warn('❌ [INTERNAL-ADMIN-GUARD] Access denied - not internal user');
    
    // Redirigir silenciosamente a home
    // El modal de error se mostrará desde el componente si es necesario
    router.navigate(['/categorization']);
    return false;
  }

  console.log('✅ [INTERNAL-ADMIN-GUARD] Access granted');
  return true;
};
// 🔒 NetoInsight - Internal Admin Guard (SIN ALERTS)

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const internalAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔒 [INTERNAL-ADMIN-GUARD] Checking internal admin access...');

  const currentUser = authService.getCurrentUser();

  // Requiere: isInternal === true Y role === admin
  // Un viewer interno (como soporte) NO tiene acceso a estas pantallas
  const isInternalAdmin = currentUser?.isInternal === true
    && currentUser?.role === UserRole.ADMIN;

  if (!isInternalAdmin) {
    console.warn('❌ [INTERNAL-ADMIN-GUARD] Access denied');
    console.warn(`   isInternal: ${currentUser?.isInternal} | role: ${currentUser?.role}`);
    router.navigate(['/categorization']);
    return false;
  }

  console.log('✅ [INTERNAL-ADMIN-GUARD] Access granted');
  return true;
};
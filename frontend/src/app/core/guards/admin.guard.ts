// 🔒 NetoInsight - Admin Guard (Requiere rol Admin)

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔒 [ADMIN-GUARD] Checking admin access...');

  const currentUser = authService.getCurrentUser();

  if (!currentUser) {
    console.warn('❌ [ADMIN-GUARD] No user logged in');
    router.navigate(['/login']);
    return false;
  }

  // Permitir si tiene role=admin (en cualquier tenant, incluyendo interno)
  // isInternal por sí solo NO es suficiente — un viewer interno no entra
  const isAdmin = currentUser.role === UserRole.ADMIN;

  if (!isAdmin) {
    console.warn('❌ [ADMIN-GUARD] Access denied - user is not admin');
    console.warn(`   User role: ${currentUser.role} | isInternal: ${currentUser.isInternal}`);
    router.navigate(['/categorization']);
    return false;
  }

  console.log('✅ [ADMIN-GUARD] Access granted');
  return true;
};
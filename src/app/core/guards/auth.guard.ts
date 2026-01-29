// 🛡️ NetoInsight - Auth Guard

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🛡️ [GUARD] Checking authentication for:', state.url);

  if (authService.isAuthenticated()) {
    console.log('✅ [GUARD] User is authenticated, access granted');
    return true;
  }

  console.log('❌ [GUARD] User not authenticated, redirecting to login');
  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url }
  });
  return false;
};
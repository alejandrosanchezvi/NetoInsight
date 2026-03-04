// 🔒 NetoInsight - Auth Guard v2.0 — Con validación de suscripción

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';
import { isTenantAccessAllowed, getAccessBlockReason } from '../models/tenant.model';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const tenantService = inject(TenantService);
  const router = inject(Router);

  console.log('🔒 [AUTH-GUARD] Verificando acceso para:', state.url);

  // ── 1. ¿Está autenticado? ──────────────────────────────────────
  const isAuthenticated = authService.isAuthenticated();
  if (!isAuthenticated) {
    console.warn('❌ [AUTH-GUARD] No autenticado → /login');
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // ── 2. La ruta /suspended NO necesita más validación ──────────
  if (state.url.startsWith('/subscription-suspended')) {
    return true;
  }

  // ── 3. Obtener usuario actual ──────────────────────────────────
  const currentUser = authService.getCurrentUser();
  if (!currentUser) {
    console.warn('❌ [AUTH-GUARD] Sin datos de usuario → /login');
    router.navigate(['/login']);
    return false;
  }

  // ── 4. Internos: siempre tienen acceso ────────────────────────
  if (currentUser.isInternal) {
    console.log('✅ [AUTH-GUARD] Usuario interno — acceso garantizado');
    return true;
  }

  // ── 5. Validar suscripción del tenant ─────────────────────────
  try {
    const tenant = await tenantService.getTenantById(currentUser.tenantId);

    if (!tenant) {
      console.warn('❌ [AUTH-GUARD] Tenant no encontrado → /subscription-suspended');
      router.navigate(['/subscription-suspended'], { queryParams: { reason: 'not_found' } });
      return false;
    }

    const allowed = isTenantAccessAllowed(tenant);

    if (!allowed) {
      const reason = getAccessBlockReason(tenant);
      console.warn(`❌ [AUTH-GUARD] Acceso bloqueado — razón: ${reason}`);
      router.navigate(['/subscription-suspended'], { queryParams: { reason } });
      return false;
    }

    console.log('✅ [AUTH-GUARD] Acceso permitido para tenant:', tenant.name);
    return true;

  } catch (error) {
    console.error('❌ [AUTH-GUARD] Error verificando tenant:', error);
    // En caso de error al leer Firestore, dejar pasar (fail-open)
    // para no bloquear usuarios por problemas de red
    return true;
  }
};
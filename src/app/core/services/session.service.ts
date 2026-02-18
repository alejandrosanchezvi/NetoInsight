// ⏱️ NetoInsight - Session Service
// Maneja el timeout de sesión (30 min inactividad)
// Warning a 2 min del cierre, logout automático al expirar

import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, interval, Subscription } from 'rxjs';
import { AuthService } from './auth.service';

export interface SessionState {
  isActive: boolean;
  remainingSeconds: number;
  showWarning: boolean;
  isExpired: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService implements OnDestroy {

  // ── Configuración ──────────────────────────────────────────────
  private readonly SESSION_TIMEOUT_MS  = 15 * 60 * 1000; // 30 min
  private readonly WARNING_BEFORE_MS   =  2 * 60 * 1000; // aviso 2 min antes
  private readonly TICK_INTERVAL_MS    = 1_000;           // actualizar cada 1 s

  // ── Estado ─────────────────────────────────────────────────────
  private sessionState = new BehaviorSubject<SessionState>({
    isActive: false,
    remainingSeconds: this.SESSION_TIMEOUT_MS / 1000,
    showWarning: false,
    isExpired: false
  });
  public sessionState$ = this.sessionState.asObservable();

  // ── Internals ──────────────────────────────────────────────────
  private lastActivityTime = Date.now();
  private tickSubscription: Subscription | null = null;
  private readonly ACTIVITY_EVENTS = [
    'mousedown', 'mousemove', 'keypress', 'keydown',
    'scroll', 'touchstart', 'click', 'wheel'
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  // ── Public API ─────────────────────────────────────────────────

  /** Llamar al hacer login exitoso */
  startSession(): void {
    console.log('⏱️ [SESSION] Iniciando sesión con timeout de 30 min');
    this.lastActivityTime = Date.now();
    this.registerActivityListeners();
    this.startTicker();
    this.updateState();
  }

  /** Llamar al hacer logout o al expirar */
  endSession(): void {
    console.log('⏱️ [SESSION] Sesión finalizada');
    this.stopTicker();
    this.removeActivityListeners();
    this.sessionState.next({
      isActive: false,
      remainingSeconds: this.SESSION_TIMEOUT_MS / 1000,
      showWarning: false,
      isExpired: false
    });
  }

  /** El usuario eligió "Continuar" en el modal de warning */
  extendSession(): void {
    console.log('⏱️ [SESSION] Sesión extendida por el usuario');
    this.lastActivityTime = Date.now();
    this.updateState();
  }

  /** Obtener snapshot actual */
  getState(): SessionState {
    return this.sessionState.value;
  }

  ngOnDestroy(): void {
    this.endSession();
  }

  // ── Private ────────────────────────────────────────────────────

  private startTicker(): void {
    this.stopTicker();

    // Correr fuera de Zone para no disparar change detection cada segundo
    this.ngZone.runOutsideAngular(() => {
      this.tickSubscription = interval(this.TICK_INTERVAL_MS).subscribe(() => {
        this.ngZone.run(() => this.tick());
      });
    });
  }

  private stopTicker(): void {
    this.tickSubscription?.unsubscribe();
    this.tickSubscription = null;
  }

  private tick(): void {
    const elapsed   = Date.now() - this.lastActivityTime;
    const remaining = Math.max(0, this.SESSION_TIMEOUT_MS - elapsed);
    const remainingSeconds = Math.ceil(remaining / 1000);
    const showWarning      = remaining <= this.WARNING_BEFORE_MS && remaining > 0;
    const isExpired        = remaining === 0;

    this.sessionState.next({
      isActive: !isExpired,
      remainingSeconds,
      showWarning,
      isExpired
    });

    if (isExpired) {
      this.handleExpiration();
    }
  }

  private updateState(): void {
    const elapsed          = Date.now() - this.lastActivityTime;
    const remaining        = Math.max(0, this.SESSION_TIMEOUT_MS - elapsed);
    const remainingSeconds = Math.ceil(remaining / 1000);
    const showWarning      = remaining <= this.WARNING_BEFORE_MS && remaining > 0;

    this.sessionState.next({
      isActive: true,
      remainingSeconds,
      showWarning,
      isExpired: false
    });
  }

  private handleExpiration(): void {
    console.warn('⏱️ [SESSION] Sesión expirada — cerrando sesión');
    this.stopTicker();
    this.removeActivityListeners();

    // Mostrar estado expirado brevemente antes de logout
    setTimeout(async () => {
      await this.authService.logout();
    }, 3000); // 3 s para que el modal "expirado" sea visible
  }

  private onUserActivity = (): void => {
    // Solo resetear si NO estamos en warning (para que el usuario confirme)
    if (!this.sessionState.value.showWarning) {
      this.lastActivityTime = Date.now();
    }
  };

  private registerActivityListeners(): void {
    this.ACTIVITY_EVENTS.forEach(event =>
      document.addEventListener(event, this.onUserActivity, { passive: true })
    );
    console.log('⏱️ [SESSION] Activity listeners registered');
  }

  private removeActivityListeners(): void {
    this.ACTIVITY_EVENTS.forEach(event =>
      document.removeEventListener(event, this.onUserActivity)
    );
    console.log('⏱️ [SESSION] Activity listeners removed');
  }
}
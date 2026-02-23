// ⏱️ NetoInsight - Session Timeout Modal Component

import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SessionService, SessionState } from '../../../core/services/session.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-session-timeout-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-timeout-modal.html',
  styleUrls: ['./session-timeout-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SessionTimeoutModal implements OnInit, OnDestroy {

  state: SessionState = {
    isActive: false,
    remainingSeconds: 1800,
    showWarning: false,
    isExpired: false
  };

  private sub: Subscription | null = null;

  constructor(
    private sessionService: SessionService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.sessionService.sessionState$.subscribe(state => {
      this.state = state;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get minutes(): number {
    return Math.floor(this.state.remainingSeconds / 60);
  }

  get seconds(): string {
    return String(this.state.remainingSeconds % 60).padStart(2, '0');
  }

  get circumference(): number {
    return 2 * Math.PI * 45;
  }

  get circleProgress(): number {
    const warningSeconds = 120;
    const ratio = Math.min(1, this.state.remainingSeconds / warningSeconds);
    return this.circumference * (1 - ratio);
  }

  onExtend(): void {
    this.sessionService.extendSession();
  }

  async onLogout(): Promise<void> {
    this.sessionService.endSession();
    try {
      await this.authService.logout();
    } catch (e) {
      console.error('[SESSION-MODAL] Error en logout:', e);
    }
  }
}
// 🔔 NetoInsight - Notification Modal Component

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, NotificationData } from '../../../core/services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-modal.html',
  styleUrls: ['./notification-modal.css']
})
export class NotificationModal implements OnInit, OnDestroy {
  
  notification: NotificationData | null = null;
  private subscription?: Subscription;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.notification$.subscribe(
      notification => {
        this.notification = notification;
      }
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Confirmar acción
   */
  confirm(): void {
    if (this.notification?.onConfirm) {
      this.notification.onConfirm();
    }
    this.close();
  }

  /**
   * Cancelar acción
   */
  cancel(): void {
    if (this.notification?.onCancel) {
      this.notification.onCancel();
    }
    this.close();
  }

  /**
   * Cerrar modal
   */
  close(): void {
    this.notificationService.close();
  }

  /**
   * Cerrar al hacer clic en el backdrop
   */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
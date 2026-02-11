// 🔔 NetoInsight - Notification Service (Modales)

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface NotificationData {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  
  private notificationSubject = new BehaviorSubject<NotificationData | null>(null);
  public notification$ = this.notificationSubject.asObservable();

  /**
   * Mostrar notificación simple (solo OK)
   */
  show(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ): void {
    this.notificationSubject.next({
      type,
      title,
      message,
      confirmText: 'Entendido',
      showCancel: false
    });
  }

  /**
   * Mostrar notificación de éxito
   */
  success(title: string, message: string): void {
    this.show('success', title, message);
  }

  /**
   * Mostrar notificación de error
   */
  error(title: string, message: string): void {
    this.show('error', title, message);
  }

  /**
   * Mostrar notificación de advertencia
   */
  warning(title: string, message: string): void {
    this.show('warning', title, message);
  }

  /**
   * Mostrar notificación informativa
   */
  info(title: string, message: string): void {
    this.show('info', title, message);
  }

  /**
   * Mostrar confirmación (OK/Cancelar)
   */
  confirm(
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText: string = 'Confirmar',
    cancelText: string = 'Cancelar',
    type: 'warning' | 'error' | 'info' = 'warning'
  ): void {
    this.notificationSubject.next({
      type,
      title,
      message,
      confirmText,
      cancelText,
      showCancel: true,
      onConfirm
    });
  }

  /**
   * Cerrar notificación actual
   */
  close(): void {
    this.notificationSubject.next(null);
  }
}
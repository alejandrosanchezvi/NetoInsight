// 🎭 NetoInsight - ImpersonationService
// Permite a admins NETO-INTERNAL ver el portal como un proveedor específico.
// No escribe en Firestore ni modifica la sesión real — solo memoria.

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ImpersonationTarget {
  tenantId: string;
  name: string;
  proveedorIdInterno: string;
  plan: 'trial' | 'starter';
}

@Injectable({ providedIn: 'root' })
export class ImpersonationService {
  private subject = new BehaviorSubject<ImpersonationTarget | null>(null);
  readonly impersonated$ = this.subject.asObservable();

  get current(): ImpersonationTarget | null { return this.subject.value; }
  get isActive(): boolean { return this.subject.value !== null; }

  getEffectiveProviderId(realId: string): string {
    return this.subject.value?.proveedorIdInterno ?? realId;
  }

  start(target: ImpersonationTarget): void { this.subject.next(target); }
  stop(): void { this.subject.next(null); }
}

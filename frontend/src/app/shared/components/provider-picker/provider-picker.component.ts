// 🎭 NetoInsight - ProviderPickerComponent
// Modal para seleccionar proveedor al simular vista. Solo para admins NETO-INTERNAL.

import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { ImpersonationTarget } from '../../../core/services/impersonation.service';

interface PickerTenant {
  tenantId: string;
  name: string;
  proveedorIdInterno: string;
  plan: 'trial' | 'starter';
  adminEmail: string;
}

@Component({
  selector: 'app-provider-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './provider-picker.component.html',
  styleUrls: ['./provider-picker.component.css'],
})
export class ProviderPickerComponent implements OnInit {
  @Output() selected = new EventEmitter<ImpersonationTarget>();
  @Output() closed = new EventEmitter<void>();

  tenants: PickerTenant[] = [];
  filtered: PickerTenant[] = [];
  search = '';
  isLoading = true;

  constructor(private firestore: Firestore) {}

  async ngOnInit(): Promise<void> {
    const snap = await getDocs(collection(this.firestore, 'tenants'));
    const list: PickerTenant[] = [];

    snap.docs.forEach(doc => {
      const d = doc.data();
      const plan = d['plan'];
      const isActive = d['isActive'] !== false;
      const provId = d['proveedorIdInterno'];

      if (!isActive || !provId || provId === 'NETO-INTERNAL') return;
      if (plan !== 'trial' && plan !== 'starter') return;

      list.push({
        tenantId: doc.id,
        name: d['name'] ?? '',
        proveedorIdInterno: provId,
        plan,
        adminEmail: d['adminEmail'] ?? '',
      });
    });

    this.tenants = list.sort((a, b) => a.name.localeCompare(b.name));
    this.filtered = [...this.tenants];
    this.isLoading = false;
  }

  onSearch(): void {
    const q = this.search.toLowerCase();
    this.filtered = q
      ? this.tenants.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.proveedorIdInterno.includes(q) ||
          t.adminEmail.toLowerCase().includes(q)
        )
      : [...this.tenants];
  }

  select(t: PickerTenant): void {
    this.selected.emit({
      tenantId: t.tenantId,
      name: t.name,
      proveedorIdInterno: t.proveedorIdInterno,
      plan: t.plan,
    });
  }

  close(): void { this.closed.emit(); }
}

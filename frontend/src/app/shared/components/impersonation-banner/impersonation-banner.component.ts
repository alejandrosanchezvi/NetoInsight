// 🎭 NetoInsight - ImpersonationBannerComponent
// Banner naranja visible mientras un admin simula la vista de un proveedor.

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImpersonationService } from '../../../core/services/impersonation.service';

@Component({
  selector: 'app-impersonation-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './impersonation-banner.component.html',
  styleUrls: ['./impersonation-banner.component.css'],
})
export class ImpersonationBannerComponent {
  constructor(public impersonation: ImpersonationService) {}

  stop(): void { this.impersonation.stop(); }
}

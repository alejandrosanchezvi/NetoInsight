// 📧 NetoInsight - Accept Invite Component

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { InvitationService } from '../../../core/services/invitation.service';
import { Invitation } from '../../../core/models/invitation.model';
import { SetupAccount } from '../setup-account/setup-account';


@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [CommonModule, SetupAccount],
  templateUrl: './accept-invite.html',
  styleUrls: ['./accept-invite.css']
})
export class AcceptInvite implements OnInit {
  
  token: string = '';
  invitation: Invitation | null = null;
  
  // Estados
  isValidating = true;
  isValid = false;
  errorMessage = '';
  
  // Flujo
  currentStep: 'validating' | 'invalid' | 'expired' | 'setup' = 'validating';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invitationService: InvitationService
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('📧 [ACCEPT-INVITE] Component initialized');
    
    // Obtener token de query params
    this.route.queryParams.subscribe(async params => {
      this.token = params['token'];
      
      if (!this.token) {
        this.currentStep = 'invalid';
        this.errorMessage = 'Token de invitación no proporcionado';
        this.isValidating = false;
        return;
      }

      await this.validateToken();
    });
  }

  /**
   * Validar token de invitación
   */
  async validateToken(): Promise<void> {
    console.log('📧 [ACCEPT-INVITE] Validating token...');
    this.isValidating = true;

    try {
      const result = await this.invitationService.validateInvitationToken(this.token);

      if (result.valid && result.invitation) {
        this.isValid = true;
        this.invitation = result.invitation;
        this.currentStep = 'setup';
        
        console.log('✅ [ACCEPT-INVITE] Token valid for:', this.invitation.email);
      } else {
        this.isValid = false;
        this.errorMessage = result.error || 'Token inválido';
        
        // Determinar tipo de error
        if (result.error?.includes('expirado')) {
          this.currentStep = 'expired';
        } else {
          this.currentStep = 'invalid';
        }
        
        console.warn('⚠️ [ACCEPT-INVITE] Token validation failed:', result.error);
      }

    } catch (error: any) {
      console.error('❌ [ACCEPT-INVITE] Error validating token:', error);
      this.isValid = false;
      this.currentStep = 'invalid';
      this.errorMessage = 'Error al validar la invitación';
    } finally {
      this.isValidating = false;
    }
  }

  /**
   * Volver al login
   */
  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
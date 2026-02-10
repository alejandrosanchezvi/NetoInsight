// 📧 NetoInsight - Invitation Service (CON FASTAPI + MAILSLURP - CORREGIDO)

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  addDoc,
  updateDoc,
  query, 
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from '@angular/fire/firestore';
import { 
  Invitation, 
  InvitationStatus,
  CreateInvitationDTO,
  ValidateInvitationResponse
} from '../models/invitation.model';
import { TenantService } from './tenant.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  
  private firestore = inject(Firestore);
  private http = inject(HttpClient);
  private tenantService = inject(TenantService);
  private authService = inject(AuthService);
  
  // URL del backend FastAPI
  private apiUrl = environment.apiUrl || 'http://localhost:8000';

  constructor() {
    console.log('📧 [INVITATION] InvitationService initialized with FastAPI + MailSlurp');
  }

  /**
   * Crear nueva invitación Y enviar email
   */
  async createInvitation(data: CreateInvitationDTO): Promise<Invitation> {
    console.log('📧 [INVITATION] Creating invitation for:', data.email);
    
    try {
      // 1. Validar que el tenant tenga licencias disponibles
      const hasLicenses = await this.tenantService.hasAvailableLicenses(data.tenantId);
      if (!hasLicenses) {
        throw new Error('No hay licencias disponibles. Contacta a Neto para ampliar tu plan.');
      }

      // 2. Verificar que el email no esté ya invitado (pendiente)
      const existingInvitation = await this.findPendingInvitationByEmail(data.email, data.tenantId);
      if (existingInvitation) {
        throw new Error('Ya existe una invitación pendiente para este email.');
      }

      // 3. Obtener datos del tenant
      const tenant = await this.tenantService.getTenantById(data.tenantId);
      if (!tenant) {
        throw new Error('Tenant no encontrado');
      }

      // 4. Obtener datos del usuario que invita
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      // 5. Generar token único
      const token = this.generateInvitationToken();

      // 6. Calcular fecha de expiración (7 días) como Timestamp
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );

      // 7. Preparar nombre del usuario (usar 'name' en lugar de 'displayName')
      const invitedByName = currentUser.name || currentUser.email;

      // 8. Crear documento en Firestore
      const invitationData = {
        email: data.email.toLowerCase(),
        role: data.role,
        tenantId: data.tenantId,
        tenantName: tenant.name,
        token: token,
        status: InvitationStatus.PENDING,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
        invitedBy: currentUser.uid,
        invitedByEmail: currentUser.email,
        invitedByName: invitedByName,
        metadata: {
          userAgent: navigator.userAgent,
          createdFrom: 'web-app'
        }
      };

      const invitationsRef = collection(this.firestore, 'invitations');
      const docRef = await addDoc(invitationsRef, invitationData);

      console.log('✅ [INVITATION] Created in Firestore:', docRef.id);

      // 9. NUEVO: Enviar email usando FastAPI + MailSlurp
      try {
        await this.sendInvitationEmailViaAPI({
          email: data.email.toLowerCase(),
          invitation_token: token,
          tenant_name: tenant.name,
          invited_by_name: invitedByName,
          invited_by_email: currentUser.email,
          role: data.role,
          expires_at: expiresAt.toDate().toISOString(),
          frontend_url: window.location.origin
        });

        console.log('✅ [INVITATION] Email sent successfully via FastAPI');
      } catch (emailError) {
        console.warn('⚠️ [INVITATION] Email failed to send, but invitation was created:', emailError);
        // No lanzar error - la invitación ya está creada en Firestore
      }

      // 10. Retornar invitación creada
      return {
        id: docRef.id,
        ...invitationData,
        createdAt: new Date(),
        expiresAt: expiresAt.toDate()
      } as Invitation;

    } catch (error) {
      console.error('❌ [INVITATION] Error creating invitation:', error);
      throw error;
    }
  }

  /**
   * Enviar email de invitación usando FastAPI
   */
  private async sendInvitationEmailViaAPI(data: {
    email: string;
    invitation_token: string;
    tenant_name: string;
    invited_by_name: string;
    invited_by_email: string;
    role: string;
    expires_at: string;
    frontend_url: string;
  }): Promise<void> {
    try {
      // Obtener token de Firebase Auth
      const idToken = await this.authService.getIdToken();
      
      if (!idToken) {
        throw new Error('No se pudo obtener el token de autenticación');
      }

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      });

      const response = await firstValueFrom(
        this.http.post<{success: boolean, message_id?: string, error?: string}>(
          `${this.apiUrl}/api/invitations/send-email`,
          data,
          { headers }
        )
      );

      if (!response.success) {
        throw new Error(response.error || 'Error enviando email');
      }

      console.log('✅ [INVITATION] Email API response:', response);

    } catch (error: any) {
      console.error('❌ [INVITATION] Error calling email API:', error);
      throw error;
    }
  }

  /**
   * Reenviar invitación (solo email)
   */
  async resendInvitation(invitationId: string): Promise<void> {
    console.log('📧 [INVITATION] Resending invitation:', invitationId);
    
    try {
      // 1. Obtener invitación
      const invitation = await this.getInvitationById(invitationId);
      
      if (!invitation) {
        throw new Error('Invitación no encontrada');
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error('Solo se pueden reenviar invitaciones pendientes');
      }

      // Verificar que no haya expirado
      if (new Date() > invitation.expiresAt) {
        throw new Error('Esta invitación ha expirado. Crea una nueva.');
      }

      // 2. Reenviar email
      await this.sendInvitationEmailViaAPI({
        email: invitation.email,
        invitation_token: invitation.token,
        tenant_name: invitation.tenantName,
        invited_by_name: invitation.invitedByName,
        invited_by_email: invitation.invitedByEmail,
        role: invitation.role,
        expires_at: invitation.expiresAt.toISOString(),
        frontend_url: window.location.origin
      });

      console.log('✅ [INVITATION] Email resent successfully');

    } catch (error) {
      console.error('❌ [INVITATION] Error resending invitation:', error);
      throw error;
    }
  }

  /**
   * Validar token de invitación
   */
  async validateInvitationToken(token: string): Promise<ValidateInvitationResponse> {
    console.log('🔍 [INVITATION] Validating token...');
    
    try {
      const invitationsRef = collection(this.firestore, 'invitations');
      const q = query(
        invitationsRef,
        where('token', '==', token),
        where('status', '==', InvitationStatus.PENDING)
      );
      
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return {
          valid: false,
          error: 'Token de invitación inválido o ya utilizado'
        };
      }

      const doc = querySnapshot.docs[0];
      const invitation = this.mapDocToInvitation(doc.id, doc.data());

      // Verificar expiración
      if (new Date() > invitation.expiresAt) {
        return {
          valid: false,
          error: 'Esta invitación ha expirado'
        };
      }

      console.log('✅ [INVITATION] Token valid');
      
      return {
        valid: true,
        invitation
      };

    } catch (error) {
      console.error('❌ [INVITATION] Error validating token:', error);
      return {
        valid: false,
        error: 'Error al validar la invitación'
      };
    }
  }

  /**
   * Marcar invitación como aceptada
   */
  async acceptInvitation(invitationId: string, userId: string): Promise<void> {
    console.log('✅ [INVITATION] Accepting invitation:', invitationId);
    
    try {
      const invitationDocRef = doc(this.firestore, 'invitations', invitationId);
      await updateDoc(invitationDocRef, {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: serverTimestamp(),
        acceptedBy: userId
      });
      
      console.log('✅ [INVITATION] Invitation accepted');

    } catch (error) {
      console.error('❌ [INVITATION] Error accepting invitation:', error);
      throw error;
    }
  }

  /**
   * Cancelar invitación
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    console.log('❌ [INVITATION] Cancelling invitation:', invitationId);
    
    try {
      await this.updateInvitationStatus(invitationId, InvitationStatus.CANCELLED);
      console.log('✅ [INVITATION] Invitation cancelled');

    } catch (error) {
      console.error('❌ [INVITATION] Error cancelling invitation:', error);
      throw error;
    }
  }

  /**
   * Obtener invitaciones por tenant
   */
  async getInvitationsByTenant(tenantId: string): Promise<Invitation[]> {
    console.log('🔍 [INVITATION] Getting invitations for tenant:', tenantId);
    
    try {
      const invitationsRef = collection(this.firestore, 'invitations');
      const q = query(
        invitationsRef,
        where('tenantId', '==', tenantId),
        where('status', '==', InvitationStatus.PENDING),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const invitations = querySnapshot.docs.map(doc => 
        this.mapDocToInvitation(doc.id, doc.data())
      );

      console.log('✅ [INVITATION] Found invitations:', invitations.length);
      return invitations;

    } catch (error) {
      console.error('❌ [INVITATION] Error getting invitations:', error);
      return [];
    }
  }

  /**
   * Obtener invitación por ID
   */
  async getInvitationById(invitationId: string): Promise<Invitation | null> {
    try {
      const invitationDocRef = doc(this.firestore, 'invitations', invitationId);
      const docSnap = await getDoc(invitationDocRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.mapDocToInvitation(docSnap.id, docSnap.data());

    } catch (error) {
      console.error('❌ [INVITATION] Error getting invitation:', error);
      return null;
    }
  }

  /**
   * Buscar invitación pendiente por email
   */
  private async findPendingInvitationByEmail(
    email: string, 
    tenantId: string
  ): Promise<Invitation | null> {
    try {
      const invitationsRef = collection(this.firestore, 'invitations');
      const q = query(
        invitationsRef,
        where('email', '==', email.toLowerCase()),
        where('tenantId', '==', tenantId),
        where('status', '==', InvitationStatus.PENDING)
      );
      
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return this.mapDocToInvitation(doc.id, doc.data());

    } catch (error) {
      console.error('❌ [INVITATION] Error finding pending invitation:', error);
      return null;
    }
  }

  /**
   * Actualizar estado de invitación
   */
  private async updateInvitationStatus(
    invitationId: string, 
    status: InvitationStatus
  ): Promise<void> {
    try {
      const invitationDocRef = doc(this.firestore, 'invitations', invitationId);
      await updateDoc(invitationDocRef, { status });
      
      console.log('✅ [INVITATION] Status updated to:', status);

    } catch (error) {
      console.error('❌ [INVITATION] Error updating status:', error);
      throw error;
    }
  }

  /**
   * Generar token único de invitación
   */
  private generateInvitationToken(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    const token = `inv_${timestamp}_${randomStr}`;
    
    console.log('🔑 [INVITATION] Generated token:', token);
    return token;
  }

  /**
   * Mapear documento de Firestore a modelo Invitation
   */
  private mapDocToInvitation(id: string, data: any): Invitation {
    return {
      id,
      email: data['email'],
      role: data['role'],
      tenantId: data['tenantId'],
      tenantName: data['tenantName'],
      token: data['token'],
      status: data['status'] as InvitationStatus,
      createdAt: data['createdAt']?.toDate() || new Date(),
      expiresAt: data['expiresAt']?.toDate() || new Date(),
      acceptedAt: data['acceptedAt']?.toDate(),
      invitedBy: data['invitedBy'],
      invitedByEmail: data['invitedByEmail'],
      invitedByName: data['invitedByName'],
      metadata: data['metadata']
    };
  }
}
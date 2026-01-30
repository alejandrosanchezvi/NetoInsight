// 📧 NetoInsight - Invitation Service (CORREGIDO)

import { Injectable, inject } from '@angular/core';
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

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  
  private firestore = inject(Firestore);
  private tenantService = inject(TenantService);
  private authService = inject(AuthService);

  constructor() {
    console.log('📧 [INVITATION] InvitationService initialized');
  }

  /**
   * Crear nueva invitación
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

      // 7. Crear documento de invitación
      const invitationData = {
        email: data.email.toLowerCase(),
        role: data.role,
        tenantId: data.tenantId,
        tenantName: tenant.name,
        token,
        status: InvitationStatus.PENDING,
        createdAt: serverTimestamp(),
        expiresAt, // ✅ Ahora es Timestamp
        invitedBy: currentUser.uid,
        invitedByEmail: currentUser.email,
        invitedByName: currentUser.name,
        metadata: {
          resendCount: 0
        }
      };

      const invitationsRef = collection(this.firestore, 'invitations');
      const docRef = await addDoc(invitationsRef, invitationData);

      console.log('✅ [INVITATION] Invitation created:', docRef.id);
      console.log('✅ [INVITATION] Token:', token);

      // 8. Retornar invitación creada
      const invitation = await this.getInvitationById(docRef.id);
      return invitation!;

    } catch (error) {
      console.error('❌ [INVITATION] Error creating invitation:', error);
      throw error;
    }
  }

  /**
   * Obtener invitación por ID
   */
  async getInvitationById(invitationId: string): Promise<Invitation | null> {
    try {
      const invitationDocRef = doc(this.firestore, 'invitations', invitationId);
      const invitationDoc = await getDoc(invitationDocRef);

      if (!invitationDoc.exists()) {
        return null;
      }

      return this.mapDocToInvitation(invitationDoc.id, invitationDoc.data());

    } catch (error) {
      console.error('❌ [INVITATION] Error fetching invitation:', error);
      throw error;
    }
  }

  /**
   * Obtener invitación por token
   */
  async getInvitationByToken(token: string): Promise<Invitation | null> {
    console.log('📧 [INVITATION] Searching for token:', token);
    
    try {
      const invitationsRef = collection(this.firestore, 'invitations');
      const q = query(invitationsRef, where('token', '==', token));
      const querySnapshot = await getDocs(q);

      console.log('📧 [INVITATION] Query results:', querySnapshot.size);

      if (querySnapshot.empty) {
        console.warn('⚠️ [INVITATION] No invitation found with token:', token);
        return null;
      }

      const doc = querySnapshot.docs[0];
      const invitation = this.mapDocToInvitation(doc.id, doc.data());
      
      console.log('✅ [INVITATION] Invitation found:', invitation.email);
      return invitation;

    } catch (error) {
      console.error('❌ [INVITATION] Error fetching invitation by token:', error);
      throw error;
    }
  }

  /**
   * Validar token de invitación
   */
  async validateInvitationToken(token: string): Promise<ValidateInvitationResponse> {
    console.log('📧 [INVITATION] Validating token:', token);
    
    try {
      const invitation = await this.getInvitationByToken(token);

      if (!invitation) {
        console.warn('⚠️ [INVITATION] Token not found');
        return {
          valid: false,
          error: 'Token de invitación inválido'
        };
      }

      console.log('📧 [INVITATION] Invitation status:', invitation.status);
      console.log('📧 [INVITATION] Expires at:', invitation.expiresAt);

      if (invitation.status !== InvitationStatus.PENDING) {
        console.warn('⚠️ [INVITATION] Invitation not pending:', invitation.status);
        return {
          valid: false,
          error: 'Esta invitación ya fue usada o cancelada',
          invitation
        };
      }

      const now = new Date();
      if (now > invitation.expiresAt) {
        console.warn('⚠️ [INVITATION] Invitation expired');
        
        // Marcar como expirada
        await this.updateInvitationStatus(invitation.id, InvitationStatus.EXPIRED);
        
        return {
          valid: false,
          error: 'Esta invitación ha expirado',
          invitation
        };
      }

      console.log('✅ [INVITATION] Token valid!');
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
   * Obtener invitaciones de un tenant
   */
  async getInvitationsByTenant(
    tenantId: string, 
    status?: InvitationStatus
  ): Promise<Invitation[]> {
    console.log('📧 [INVITATION] Fetching invitations for tenant:', tenantId);
    
    try {
      const invitationsRef = collection(this.firestore, 'invitations');
      
      let q = query(
        invitationsRef,
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc')
      );

      if (status) {
        q = query(
          invitationsRef,
          where('tenantId', '==', tenantId),
          where('status', '==', status),
          orderBy('createdAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      
      const invitations = querySnapshot.docs.map(doc => 
        this.mapDocToInvitation(doc.id, doc.data())
      );

      console.log('✅ [INVITATION] Fetched invitations:', invitations.length);
      return invitations;

    } catch (error) {
      console.error('❌ [INVITATION] Error fetching invitations:', error);
      throw error;
    }
  }

  /**
   * Marcar invitación como aceptada
   */
  async acceptInvitation(invitationId: string): Promise<void> {
    console.log('📧 [INVITATION] Accepting invitation:', invitationId);
    
    try {
      const invitationDocRef = doc(this.firestore, 'invitations', invitationId);
      
      await updateDoc(invitationDocRef, {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: serverTimestamp()
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
    console.log('📧 [INVITATION] Cancelling invitation:', invitationId);
    
    await this.updateInvitationStatus(invitationId, InvitationStatus.CANCELLED);
  }

  /**
   * Reenviar invitación (actualizar expiresAt y token)
   */
  async resendInvitation(invitationId: string): Promise<Invitation> {
    console.log('📧 [INVITATION] Resending invitation:', invitationId);
    
    try {
      const invitation = await this.getInvitationById(invitationId);
      
      if (!invitation) {
        throw new Error('Invitación no encontrada');
      }

      // Generar nuevo token
      const newToken = this.generateInvitationToken();
      
      // Nueva fecha de expiración (7 días desde ahora)
      const newExpiresAt = Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );

      // Actualizar documento
      const invitationDocRef = doc(this.firestore, 'invitations', invitationId);
      await updateDoc(invitationDocRef, {
        token: newToken,
        expiresAt: newExpiresAt,
        status: InvitationStatus.PENDING,
        'metadata.resendCount': (invitation.metadata?.resendCount || 0) + 1,
        'metadata.lastResent': serverTimestamp()
      });

      console.log('✅ [INVITATION] Invitation resent');

      // Retornar invitación actualizada
      return (await this.getInvitationById(invitationId))!;

    } catch (error) {
      console.error('❌ [INVITATION] Error resending invitation:', error);
      throw error;
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
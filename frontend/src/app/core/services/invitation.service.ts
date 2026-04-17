// 📧 NetoInsight - Invitation Service v3.0 — Magic Link + Firebase Email + MailSlurp

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

export interface InvitationResult {
  invitation: Invitation;
  magicLink: string;
  slackMessage: string;
  emailSent: boolean;
  emailError?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvitationService {

  private firestore = inject(Firestore);
  private http = inject(HttpClient);
  private tenantService = inject(TenantService);
  private authService = inject(AuthService);

  private apiUrl = environment.apiUrl;

  constructor() {
    console.log('📧 [INVITATION] InvitationService v3.0 — Magic Link + Firebase + MailSlurp');
  }

  // ─────────────────────────────────────────────────────────────
  //  CREAR INVITACIÓN (retorna magic link siempre)
  // ─────────────────────────────────────────────────────────────

  async createInvitation(data: CreateInvitationDTO): Promise<InvitationResult> {
    console.log('📧 [INVITATION] Creating invitation for:', data.email);

    try {
      // 1. Validar licencias disponibles
      const hasLicenses = await this.tenantService.hasAvailableLicenses(data.tenantId);
      if (!hasLicenses) {
        throw new Error('No hay licencias disponibles. Contacta a Neto para ampliar tu plan.');
      }

      // 2. Si existe invitación pendiente anterior → cancelarla automáticamente
      //    Así siempre se puede reinvitar sin necesidad de cancelar manualmente
      const existingInvitation = await this.findPendingInvitationByEmail(data.email, data.tenantId);
      if (existingInvitation) {
        console.log('📧 [INVITATION] Cancelando invitación anterior:', existingInvitation.id);
        await this.cancelInvitation(existingInvitation.id);
        console.log('✅ [INVITATION] Invitación anterior cancelada');
      }

      // 3. Obtener tenant
      const tenant = await this.tenantService.getTenantById(data.tenantId);
      if (!tenant) throw new Error('Tenant no encontrado');

      // 4. Usuario que invita
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) throw new Error('Usuario no autenticado');

      // 5. Generar token y expiración (7 días)
      const token = this.generateInvitationToken();
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );

      const invitedByName = currentUser.name || currentUser.email;
      const frontendUrl = window.location.origin;
      const magicLink = `${frontendUrl}/accept-invite?token=${token}`;

      // 6. Guardar en Firestore
      const invitationData = {
        email: data.email.toLowerCase(),
        role: data.role,
        tenantId: data.tenantId,
        tenantName: tenant.name,
        token,
        status: InvitationStatus.PENDING,
        createdAt: serverTimestamp(),
        expiresAt,
        invitedBy: currentUser.uid,
        invitedByEmail: currentUser.email,
        invitedByName,
        metadata: {
          userAgent: navigator.userAgent,
          createdFrom: 'web-app'
        }
      };

      const invitationsRef = collection(this.firestore, 'invitations');
      const docRef = await addDoc(invitationsRef, invitationData);
      console.log('✅ [INVITATION] Saved to Firestore:', docRef.id);

      // 7. Intentar enviar email (no bloquea el flujo)
      let emailSent = false;
      let emailError: string | undefined;

      try {
        // Primero intentar Firebase Auth email (opción A)
        await this.sendFirebaseInvitationEmail(
          data.email.toLowerCase(),
          token,
          tenant.name,
          invitedByName,
          currentUser.email,
          data.role,
          expiresAt.toDate().toISOString(),
          frontendUrl
        );
        emailSent = true;
        console.log('✅ [INVITATION] Email sent via Firebase/MailSlurp');
      } catch (err: any) {
        emailError = err?.message || 'Error desconocido al enviar email';
        console.warn('⚠️ [INVITATION] Email failed (magic link still available):', emailError);
      }

      // 8. Construir mensaje de Slack listo para copiar
      const roleLabel = data.role === 'admin' ? 'Administrador' : 'Visualizador';
      const expiresFormatted = new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'long'
      }).format(expiresAt.toDate());

      const slackMessage = this.buildSlackMessage({
        email: data.email,
        tenantName: tenant.name,
        invitedByName,
        roleLabel,
        magicLink,
        expiresFormatted
      });

      const invitation: Invitation = {
        id: docRef.id,
        ...invitationData,
        createdAt: new Date(),
        expiresAt: expiresAt.toDate()
      } as Invitation;

      return { invitation, magicLink, slackMessage, emailSent, emailError };

    } catch (error) {
      console.error('❌ [INVITATION] Error:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  REENVIAR — retorna nueva magic link (renueva si expiró)
  // ─────────────────────────────────────────────────────────────

  async resendInvitation(invitationId: string): Promise<InvitationResult> {
    console.log('📧 [INVITATION] Resending invitation:', invitationId);

    const invitation = await this.getInvitationById(invitationId);
    if (!invitation) throw new Error('Invitación no encontrada');
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error('Solo se pueden reenviar invitaciones pendientes.');
    }

    const isExpired = new Date() > new Date(invitation.expiresAt);
    let tokenToUse = invitation.token;
    let expiresDate = new Date(invitation.expiresAt);

    // Renovar si expiró
    if (isExpired) {
      console.log('⏰ [INVITATION] Expired — renewing token...');
      const newToken = this.generateInvitationToken();
      const newExpiresAt = Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );

      const invitationDocRef = doc(this.firestore, 'invitations', invitationId);
      await updateDoc(invitationDocRef, {
        token: newToken,
        expiresAt: newExpiresAt,
        renewedAt: serverTimestamp()
      });

      tokenToUse = newToken;
      expiresDate = newExpiresAt.toDate();
      console.log('✅ [INVITATION] Token renewed');
    }

    const frontendUrl = window.location.origin;
    const magicLink = `${frontendUrl}/accept-invite?token=${tokenToUse}`;
    const roleLabel = invitation.role === 'admin' ? 'Administrador' : 'Visualizador';
    const expiresFormatted = new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'long'
    }).format(expiresDate);

    // Intentar reenviar email
    let emailSent = false;
    let emailError: string | undefined;

    try {
      await this.sendFirebaseInvitationEmail(
        invitation.email,
        tokenToUse,
        invitation.tenantName,
        invitation.invitedByName,
        invitation.invitedByEmail,
        invitation.role,
        expiresDate.toISOString(),
        frontendUrl
      );
      emailSent = true;
    } catch (err: any) {
      emailError = err?.message || 'Error al enviar email';
      console.warn('⚠️ [INVITATION] Resend email failed:', emailError);
    }

    const slackMessage = this.buildSlackMessage({
      email: invitation.email,
      tenantName: invitation.tenantName,
      invitedByName: invitation.invitedByName,
      roleLabel,
      magicLink,
      expiresFormatted
    });

    return {
      invitation: { ...invitation, token: tokenToUse, expiresAt: expiresDate },
      magicLink,
      slackMessage,
      emailSent,
      emailError
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  OBTENER MAGIC LINK de una invitación existente
  // ─────────────────────────────────────────────────────────────

  getMagicLinkForInvitation(invitation: Invitation): { magicLink: string; slackMessage: string } {
    const frontendUrl = window.location.origin;
    const magicLink = `${frontendUrl}/accept-invite?token=${invitation.token}`;
    const roleLabel = invitation.role === 'admin' ? 'Administrador' : 'Visualizador';
    const expiresFormatted = new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'long'
    }).format(new Date(invitation.expiresAt));

    const slackMessage = this.buildSlackMessage({
      email: invitation.email,
      tenantName: invitation.tenantName,
      invitedByName: invitation.invitedByName,
      roleLabel,
      magicLink,
      expiresFormatted
    });

    return { magicLink, slackMessage };
  }

  // ─────────────────────────────────────────────────────────────
  //  EMAIL: Firebase Admin via Backend (Opción A)
  // ─────────────────────────────────────────────────────────────

  private async sendFirebaseInvitationEmail(
    email: string,
    token: string,
    tenantName: string,
    invitedByName: string,
    invitedByEmail: string,
    role: string,
    expiresAt: string,
    frontendUrl: string
  ): Promise<void> {
    const idToken = await this.authService.getIdToken();
    if (!idToken) throw new Error('No se pudo obtener token de autenticación');

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    });

    const response = await firstValueFrom(
      this.http.post<{ success: boolean; message_id?: string; error?: string }>(
        `${this.apiUrl}/api/invitations/send-email`,
        {
          email,
          invitation_token: token,
          tenant_name: tenantName,
          invited_by_name: invitedByName,
          invited_by_email: invitedByEmail,
          role,
          expires_at: expiresAt,
          frontend_url: frontendUrl
        },
        { headers }
      )
    );

    if (!response.success) {
      throw new Error(response.error || 'Error enviando email');
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────────

  private buildSlackMessage(params: {
    email: string;
    tenantName: string;
    invitedByName: string;
    roleLabel: string;
    magicLink: string;
    expiresFormatted: string;
  }): string {
    return `👋 Hola, te invitamos a unirte a *NetoInsight* — ${params.tenantName}

📊 *Plataforma:* NetoInsight — Dashboards de proveedores
👤 *Rol asignado:* ${params.roleLabel}
✉️ *Invitado por:* ${params.invitedByName}
📅 *Link válido hasta:* ${params.expiresFormatted}

🔗 *Haz clic aquí para activar tu cuenta:*
${params.magicLink}

_Al hacer clic en el link podrás configurar tu contraseña y acceder a tus dashboards._`;
  }

  private generateInvitationToken(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `inv_${timestamp}_${randomStr}`;
  }

  // ─────────────────────────────────────────────────────────────
  //  CRUD ESTÁNDAR (sin cambios)
  // ─────────────────────────────────────────────────────────────

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
        return { valid: false, error: 'Token de invitación inválido o ya utilizado' };
      }

      const docSnap = querySnapshot.docs[0];
      const invitation = this.mapDocToInvitation(docSnap.id, docSnap.data());

      if (new Date() > invitation.expiresAt) {
        return { valid: false, error: 'Esta invitación ha expirado' };
      }

      return { valid: true, invitation };

    } catch (error) {
      console.error('❌ [INVITATION] Error validating token:', error);
      return { valid: false, error: 'Error al validar la invitación' };
    }
  }

  async acceptInvitation(invitationId: string, userId: string): Promise<void> {
    const invitationDocRef = doc(this.firestore, 'invitations', invitationId);
    await updateDoc(invitationDocRef, {
      status: InvitationStatus.ACCEPTED,
      acceptedAt: serverTimestamp(),
      acceptedBy: userId
    });
  }

  async cancelInvitation(invitationId: string): Promise<void> {
    const invitationDocRef = doc(this.firestore, 'invitations', invitationId);
    await updateDoc(invitationDocRef, { status: InvitationStatus.CANCELLED });
  }

  async getInvitationsByTenant(tenantId: string): Promise<Invitation[]> {
    try {
      const invitationsRef = collection(this.firestore, 'invitations');
      const q = query(
        invitationsRef,
        where('tenantId', '==', tenantId),
        where('status', '==', InvitationStatus.PENDING),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => this.mapDocToInvitation(d.id, d.data()));
    } catch (error) {
      console.error('❌ [INVITATION] Error getting invitations:', error);
      return [];
    }
  }

  async getInvitationById(invitationId: string): Promise<Invitation | null> {
    try {
      const invitationDocRef = doc(this.firestore, 'invitations', invitationId);
      const docSnap = await getDoc(invitationDocRef);
      if (!docSnap.exists()) return null;
      return this.mapDocToInvitation(docSnap.id, docSnap.data());
    } catch (error) {
      console.error('❌ [INVITATION] Error getting invitation:', error);
      return null;
    }
  }

  private async findPendingInvitationByEmail(email: string, tenantId: string): Promise<Invitation | null> {
    try {
      const invitationsRef = collection(this.firestore, 'invitations');
      const q = query(
        invitationsRef,
        where('email', '==', email.toLowerCase()),
        where('tenantId', '==', tenantId),
        where('status', '==', InvitationStatus.PENDING)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      const d = querySnapshot.docs[0];
      return this.mapDocToInvitation(d.id, d.data());
    } catch {
      return null;
    }
  }

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
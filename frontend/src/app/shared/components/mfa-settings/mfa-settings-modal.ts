import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  Auth, TotpSecret, EmailAuthProvider, reauthenticateWithCredential,
  getMultiFactorResolver, TotpMultiFactorGenerator, multiFactor, User as FirebaseUser
} from '@angular/fire/auth';
import { AuthService } from '../../../core/services/auth.service';
import { Firestore, doc, updateDoc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-mfa-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mfa-settings-modal.html',
  styleUrls: ['./mfa-settings-modal.css'],
})
export class MfaSettingsModal implements OnInit {
  @Output() closeModal = new EventEmitter<void>();

  isLoading = true;
  isSubmitting = false;
  @Input() user: FirebaseUser | null = null;
  
  // States
  step: 'INITIAL' | 'REAUTH_PASSWORD' | 'REAUTH_MFA' | 'ENROLLING' | 'SUCCESS' = 'INITIAL';
  
  mfaEnabled = false;
  
  // Re-auth
  reauthPassword = '';
  showPassword = false;
  
  // Re-auth MFA (when user already has MFA and needs to verify during re-auth)
  private mfaResolver: any = null;
  reauthMfaCode = '';
  
  // Enrollment Info
  qrCodeUrl: string | null = null;
  totpSecret: TotpSecret | null = null;
  mfaCode = '';
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private auth: Auth,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    const fbUser = this.auth.currentUser;
    if (!fbUser) {
      this.mfaEnabled = false;
      this.isLoading = false;
      return;
    }

    // Leer directamente de Firestore (fuente de verdad actualizada por el backend)
    // Evitamos el SDK de Firebase Auth que cachea enrolledFactors en el cliente
    const userRef = doc(this.firestore, 'users', fbUser.uid);
    getDoc(userRef).then(snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        this.mfaEnabled = data['mfaEnabled'] === true;
        console.log(`🔄 [MFA-MODAL] Firestore mfaEnabled=${this.mfaEnabled}`);

        // Actualizar el cache local si está desincronizado
        const cachedUser = this.authService.getCurrentUser();
        if (cachedUser && cachedUser.mfaEnabled !== this.mfaEnabled) {
          this.authService.setCurrentUser({ ...cachedUser, mfaEnabled: this.mfaEnabled });
        }
      } else {
        this.mfaEnabled = false;
      }
      this.isLoading = false;
    }).catch(err => {
      console.error('❌ [MFA-MODAL] Error leyendo Firestore:', err);
      // Fallback: usar lo que esté en cache
      this.mfaEnabled = this.authService.getCurrentUser()?.mfaEnabled ?? false;
      this.isLoading = false;
    });
  }

  close(): void {
    if (!this.isSubmitting) {
      this.closeModal.emit();
    }
  }

  /**
   * Paso 1: Pedir contraseña para re-autenticarse
   */
  startEnrollment(): void {
    this.errorMessage = '';
    this.reauthPassword = '';
    this.step = 'REAUTH_PASSWORD';
  }

  /**
   * Paso 2: Re-autenticarse con la contraseña y generar el secreto TOTP
   */
  async reauthAndGenerateSecret(): Promise<void> {
    if (!this.reauthPassword) {
      this.errorMessage = 'Por favor ingresa tu contraseña.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const fbUser = this.auth.currentUser;
      if (!fbUser || !fbUser.email) throw new Error('Usuario no autenticado en Firebase');

      // Re-autenticar al usuario primero
      console.log('🔐 [MFA-MODAL] Re-autenticando usuario...');
      const credential = EmailAuthProvider.credential(fbUser.email, this.reauthPassword);
      await reauthenticateWithCredential(fbUser, credential);
      console.log('✅ [MFA-MODAL] Re-autenticación exitosa');

      // Generar el secreto TOTP
      await this.proceedWithEnrollment();
    } catch (error: any) {
      console.error('❌ [MFA-MODAL] Error:', error);
      
      if (error.code === 'auth/multi-factor-auth-required') {
        // El usuario YA tiene MFA activado en Firebase Auth
        // Necesitamos que ingrese su código TOTP para completar el re-auth
        console.log('🔐 [MFA-MODAL] MFA requerido para re-autenticación...');
        try {
          this.mfaResolver = getMultiFactorResolver(this.auth, error);
          this.reauthMfaCode = '';
          this.step = 'REAUTH_MFA';
        } catch (resolverError) {
          console.error('❌ [MFA-MODAL] Error obteniendo MFA resolver:', resolverError);
          this.errorMessage = 'Error procesando la verificación MFA. Intenta nuevamente.';
        }
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        this.errorMessage = 'Contraseña incorrecta. Intenta de nuevo.';
      } else if (error.code === 'auth/too-many-requests') {
        this.errorMessage = 'Demasiados intentos. Espera unos minutos.';
      } else {
        this.errorMessage = error.message || 'No se pudo iniciar la configuración. Intenta nuevamente.';
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Paso 2b: Verificar código TOTP durante re-autenticación (cuando ya tiene MFA)
   */
  async completeReauthWithMfa(): Promise<void> {
    if (!this.reauthMfaCode || this.reauthMfaCode.length !== 6) {
      this.errorMessage = 'Ingresa el código de 6 dígitos.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      if (!this.mfaResolver) throw new Error('No hay resolver MFA disponible');

      // Buscar el hint TOTP entre los factores enrollados
      const totpHint = this.mfaResolver.hints.find(
        (hint: any) => hint.factorId === 'totp'
      );

      if (!totpHint) {
        this.errorMessage = 'No se encontró un factor TOTP configurado.';
        return;
      }

      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        totpHint.uid,
        this.reauthMfaCode
      );

      await this.mfaResolver.resolveSignIn(assertion);
      console.log('✅ [MFA-MODAL] Re-autenticación con MFA exitosa');

      // La re-autenticación fue exitosa — NO cambiamos mfaEnabled aquí
      // porque el estado real ya está en Firestore (el ngOnInit lo leerá de nuevo al reabrir)
      // Solo actualizamos la vista del modal sin tocar Firestore
      this.mfaEnabled = true;
      this.step = 'SUCCESS';
    } catch (error: any) {
      console.error('❌ [MFA-MODAL] Error completando re-auth MFA:', error);
      if (error.code === 'auth/invalid-verification-code') {
        this.errorMessage = 'Código incorrecto. Verifica tu aplicación de autenticación.';
      } else {
        this.errorMessage = error.message || 'Error verificando el código. Intenta nuevamente.';
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Generar el secreto TOTP una vez re-autenticado
   */
  private async proceedWithEnrollment(): Promise<void> {
    const fbUser = this.auth.currentUser;
    if (!fbUser) throw new Error('Usuario no autenticado');

    const { secret, qrCodeUrl } = await this.authService.generateTotpSecret(fbUser);
    this.totpSecret = secret;
    this.qrCodeUrl = qrCodeUrl;
    this.step = 'ENROLLING';
  }

  async verifyAndEnroll(): Promise<void> {
    if (this.mfaCode.length !== 6 || !this.totpSecret) {
      this.errorMessage = 'Código inválido.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const fbUser = this.auth.currentUser;
      if (!fbUser) throw new Error('Usuario no encontrado');

      await this.authService.enrollTotp(fbUser, this.totpSecret, this.mfaCode);
      
      this.mfaEnabled = true;
      this.authService.notifyMfaStatusChanged();
      this.step = 'SUCCESS';
    } catch (error: any) {
      console.error('❌ [MFA-MODAL] Error verificando TOTP:', error);
      this.errorMessage = error.message || 'Código incorrecto. Intenta de nuevo.';
    } finally {
      this.isSubmitting = false;
    }
  }

  cancelEnrollment(): void {
    this.step = 'INITIAL';
    this.mfaCode = '';
    this.reauthPassword = '';
    this.reauthMfaCode = '';
    this.errorMessage = '';
    this.totpSecret = null;
    this.qrCodeUrl = null;
    this.mfaResolver = null;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
}

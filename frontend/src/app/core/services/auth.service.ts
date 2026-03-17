// 🔐 NetoInsight - Authentication Service (Firebase) - CORREGIDO

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from, Subject } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';

// Firebase imports
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  UserCredential,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  MultiFactorResolver,
  getMultiFactorResolver,
} from '@angular/fire/auth';

import {
  Firestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';

import { User, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';
import QRCode from 'qrcode';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private mfaStatusChangedSubject = new Subject<void>();
  public mfaStatusChanged$ = this.mfaStatusChangedSubject.asObservable();

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
  ) {
    console.log('🔐 [AUTH] AuthService initialized');
    
    // ✅ IMPORTANTE: Solo cargar desde storage, NO mock
    const storedUser = this.getUserFromStorage();

    if (storedUser) {
      console.log('✅ [AUTH] Sesión recuperada:', storedUser.email);
      this.currentUserSubject.next(storedUser);
    } else {
      console.log('📭 [AUTH] No hay sesión guardada');
    }

    // Iniciar listener de Firebase
    this.initAuthListener();
  }

  notifyMfaStatusChanged(): void {
    this.mfaStatusChangedSubject.next();
  }

  /**
   * Listener de cambios de autenticación de Firebase
   */
  private initAuthListener(): void {
    onAuthStateChanged(this.auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        console.log('🔐 [AUTH] Firebase user detected:', firebaseUser.email);
        const userData = await this.getUserData(firebaseUser.uid);
        if (userData) {
          this.setCurrentUser(userData);
          console.log('✅ [AUTH] User data loaded:', userData.email);
        }
      } else {
        console.log('🔐 [AUTH] No Firebase user');
        this.currentUserSubject.next(null);
        this.clearStorage();
      }
    });
  }

  /**
   * Login con email y password
   * ✅ Retorna Observable<User>
   */
  login(email: string, password: string): Observable<User> {
    console.log('🔐 [AUTH] Login attempt for:', email);

    // Convertir Promise a Observable
    return from(
      signInWithEmailAndPassword(this.auth, email, password)
    ).pipe(
      // Obtener datos del usuario de Firestore
      switchMap(async (credential: UserCredential) => {
        console.log('✅ [AUTH] Firebase authentication successful');

        const userData = await this.getUserData(credential.user.uid);

        if (!userData) {
          throw new Error('User data not found in Firestore');
        }

        // Actualizar última conexión
        await this.updateLastLogin(credential.user.uid);

        console.log('✅ [AUTH] Login complete:', userData.email);
        
        // Guardar en storage
        this.setCurrentUser(userData);
        
        return userData;
      }),
      // Manejo de errores
      catchError((error: any) => {
        console.error('❌ [AUTH] Login error:', error);

        // Mensajes de error amigables
        let errorMessage = 'Error al iniciar sesión';

        if (error.code === 'auth/multi-factor-auth-required') {
          console.warn('⚠️ [AUTH] MFA requerido para:', email);
          const resolver = getMultiFactorResolver(this.auth, error);
          // IMPORTANTE: Se lanza un objeto con isMfaRequired para que el componente lo maneje
          throw { isMfaRequired: true, resolver };
        }

        if (error.code === 'auth/user-not-found') {
          errorMessage = 'Usuario no encontrado';
        } else if (error.code === 'auth/wrong-password') {
          errorMessage = 'Contraseña incorrecta';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'Email inválido';
        } else if (error.code === 'auth/user-disabled') {
          errorMessage = 'Usuario deshabilitado';
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = 'Demasiados intentos. Intenta más tarde';
        } else if (error.code === 'auth/invalid-credential') {
          errorMessage = 'Credenciales inválidas';
        }

        if (error.isMfaRequired) {
          throw error;
        }
        
        throw new Error(errorMessage);
      })
    );
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    console.log('🔐 [AUTH] Logging out...');

    try {
      await signOut(this.auth);
      this.currentUserSubject.next(null);
      this.clearStorage();
      this.router.navigate(['/login']);
      console.log('✅ [AUTH] Logout successful');
    } catch (error) {
      console.error('❌ [AUTH] Logout error:', error);
      throw error;
    }
  }

  /**
   * Obtener datos del usuario desde Firestore.
   * Si el usuario no tiene proveedorIdInterno en su documento,
   * lo busca en el documento del tenant como fallback.
   */
  private async getUserData(uid: string): Promise<User | null> {
    console.log('📄 [AUTH] Fetching user data for UID:', uid);

    try {
      const userDocRef = doc(this.firestore, 'users', uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        console.warn('⚠️ [AUTH] User document not found in Firestore');
        return null;
      }

      const data = userDoc.data();

      // ── Intentar obtener proveedorIdInterno del doc del usuario ──
      let proveedorIdInterno: string = data['proveedorIdInterno'] || '';

      // ── Fallback: buscarlo en el tenant si el usuario no lo tiene ──
      if (!proveedorIdInterno && data['tenantId']) {
        try {
          console.log('🔍 [AUTH] proveedorIdInterno no encontrado en user doc, buscando en tenant:', data['tenantId']);
          const tenantDocRef = doc(this.firestore, 'tenants', data['tenantId']);
          const tenantDoc = await getDoc(tenantDocRef);
          if (tenantDoc.exists()) {
            proveedorIdInterno = tenantDoc.data()['proveedorIdInterno'] || '';
            console.log('✅ [AUTH] proveedorIdInterno obtenido del tenant:', proveedorIdInterno);
          }
        } catch (tenantError) {
          console.warn('⚠️ [AUTH] No se pudo leer tenant para obtener proveedorIdInterno:', tenantError);
        }
      }

      const user: User = {
        uid: uid,
        email: data['email'],
        name: data['name'],
        role: data['role'] as UserRole,
        tenantId: data['tenantId'],
        tenantName: data['tenantName'],
        avatarUrl: data['avatarUrl'],
        isInternal: data['isInternal'] || false,
        isActive: data['isActive'] !== false,
        mfaEnabled: data['mfaEnabled'] || false,
        mfaRequired: data['mfaRequired'] || false,
        createdAt: data['createdAt']?.toDate() || new Date(),
        lastLogin: data['lastLogin']?.toDate(),
        proveedorIdInterno: proveedorIdInterno
      };

      console.log('✅ [AUTH] User data fetched:', user.email, '| proveedorIdInterno:', user.proveedorIdInterno || '(vacío)');
      return user;
    } catch (error) {
      console.error('❌ [AUTH] Error fetching user data:', error);
      return null;
    }
  }

  /**
   * Actualizar última conexión
   */
  private async updateLastLogin(uid: string): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, 'users', uid);
      await updateDoc(userDocRef, {
        lastLogin: serverTimestamp(),
      });
      console.log('✅ [AUTH] Last login updated');
    } catch (error) {
      console.error('⚠️ [AUTH] Error updating last login:', error);
      // No lanzar error, es una actualización secundaria
    }
  }

  /**
   * Obtener usuario actual (síncrono)
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Verificar si está autenticado
   */
  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * Verificar si tiene un rol específico
   */
  hasRole(role: UserRole): boolean {
    const user = this.currentUserSubject.value;
    return user !== null && user.role === role;
  }

  /**
   * Verificar si es usuario interno
   */
  isInternalUser(): boolean {
    const user = this.currentUserSubject.value;
    return user !== null && user.isInternal === true;
  }

  /**
   * Obtener token de Firebase (para llamadas a backend)
   */
  async getIdToken(): Promise<string | null> {
    const firebaseUser = this.auth.currentUser;
    if (firebaseUser) {
      return await firebaseUser.getIdToken();
    }
    return null;
  }

  /**
   * Establecer usuario actual y guardar en storage
   */
  setCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
    this.saveUserToStorage(user);
  }

  /**
   * Guardar usuario en localStorage
   */
  private saveUserToStorage(user: User): void {
    try {
      localStorage.setItem('currentUser', JSON.stringify(user));
      console.log('💾 [AUTH] Usuario guardado en storage');
    } catch (error) {
      console.error('❌ [AUTH] Error al guardar en storage:', error);
    }
  }

  /**
   * Obtener usuario desde localStorage.
   * Si el objeto guardado no tiene campos requeridos del modelo actual,
   * se descarta el cache para forzar recarga desde Firestore.
   */
  private getUserFromStorage(): User | null {
    try {
      const userStr = localStorage.getItem('currentUser');
      
      if (!userStr) {
        return null;
      }

      const userData = JSON.parse(userStr);

      // ✅ Validar que el cache tiene los campos requeridos del modelo actual.
      // Si falta alguno, descartamos el cache — Firestore tiene la verdad.
      const requiredFields: (keyof User)[] = [
        'uid', 'email', 'tenantId', 'tenantName', 'proveedorIdInterno'
      ];
      const missingFields = requiredFields.filter(
        f => userData[f] === undefined || userData[f] === null
      );

      if (missingFields.length > 0) {
        console.warn('⚠️ [AUTH] Cache de usuario desactualizado, campos faltantes:', missingFields);
        console.warn('⚠️ [AUTH] Descartando cache — se recargará desde Firestore');
        localStorage.removeItem('currentUser');
        return null;
      }
      
      // Convertir fechas de string a Date
      if (userData.createdAt) {
        userData.createdAt = new Date(userData.createdAt);
      }
      if (userData.lastLogin) {
        userData.lastLogin = new Date(userData.lastLogin);
      }
      
      return userData as User;
      
    } catch (error) {
      console.error('❌ [AUTH] Error al leer storage:', error);
      return null;
    }
  }

  /**
   * Limpiar storage
   */
  private clearStorage(): void {
    localStorage.removeItem('currentUser');
    console.log('🗑️ [AUTH] Storage limpiado');
  }

  // 🔑 Agregar este método al AuthService

/**
 * Obtiene el token de Firebase del usuario actual
 * @returns Promise con el token de Firebase o null
 */
async getFirebaseToken(): Promise<string | null> {
  try {
    const user = this.auth.currentUser;
    
    if (!user) {
      console.error('No hay usuario autenticado');
      return null;
    }
    
    // Obtener el token de Firebase
    const token = await user.getIdToken();
    return token;
    
  } catch (error) {
    console.error('Error obteniendo token de Firebase:', error);
    return null;
  }
}

  // ─────────────────────────────────────────────────────────────
  //  MFA - TOTP (Google Authenticator)
  // ─────────────────────────────────────────────────────────────

  /**
   * Completar login con código TOTP cuando se requiera MFA
   */
  async verifyTotpForLogin(resolver: MultiFactorResolver, code: string): Promise<User> {
    try {
      console.log('🛡️ [AUTH] Verificando código TOTP para login...');
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        resolver.hints[0].uid,
        code
      );
      
      const credential = await resolver.resolveSignIn(assertion);
      console.log('✅ [AUTH] MFA successful');

      const userData = await this.getUserData(credential.user.uid);
      if (!userData) {
        throw new Error('User data not found in Firestore after MFA');
      }

      await this.updateLastLogin(credential.user.uid);
      this.setCurrentUser(userData);
      
      return userData;
    } catch (error: any) {
      console.error('❌ [AUTH] MFA Verification error:', error);
      if (error.code === 'auth/invalid-multi-factor-session') {
        throw new Error('Sesión de MFA expirada o inválida');
      }
      throw new Error('Código incorrecto');
    }
  }

  /**
   * Verifica automáticamente el email del usuario para evitar 
   * el error auth/unverified-email al intentar enrolarse a MFA.
   * Llama un endpoint del backend que usa el admin SDK de Firebase.
   */
  async verifyEmailForMfa(user: FirebaseUser): Promise<void> {
    try {
      console.log('🛡️ [AUTH] Verificando email para MFA en backend...');
      // 1. Obtener Token para autenticación con el servidor
      const token = await user.getIdToken();

      // 2. Ejecutar la llamada manual directa sin usar HttpClient
      const response = await fetch(`${environment.apiUrl}/api/users/set-email-verified`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: user.uid }),
      });

      if (!response.ok) {
        throw new Error('No se pudo verificar el email desde el servidor (HTTP ' + response.status + ')');
      }

      console.log('✅ [AUTH] Email verificado exitosamente por el servidor.');
      // 3. Forzar refresco local de los claims del usuario
      await user.getIdToken(true);
      await user.reload();
      console.log('✅ [AUTH] Sesión local recargada reconociendo el email verificado.');
    } catch (error) {
      console.error('❌ [AUTH] Error en verifyEmailForMfa:', error);
      throw error;
    }
  }

  /**
   * Generar secreto TOTP para un usuario logueado (Enrollment Step 1)
   */
  async generateTotpSecret(user: FirebaseUser): Promise<{ secret: TotpSecret, qrCodeUrl: string }> {
    try {
      console.log('🛡️ [AUTH] Generando secreto TOTP...');
      // Verificar proactivamente si falta verificar el email e invocar el autoverificador
      if (!user.emailVerified) {
        console.log('⚠️ [AUTH] El usuario no tiene el email verificado, se forzará la verificación...');
        await this.verifyEmailForMfa(user);
      }

      const multiFactorSession = await multiFactor(user).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(multiFactorSession);
      
      // Obtener la URI otpauth:// del secreto
      const otpauthUrl = secret.generateQrCodeUrl(
        user.email || 'NetoInsight',
        'NetoInsight'
      );
      
      // Generar imagen QR como Data URL usando la librería qrcode
      const qrCodeUrl = await QRCode.toDataURL(otpauthUrl, {
        width: 250,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      console.log('🛡️ [AUTH] QR Code data URL generada correctamente');
      
      return { secret, qrCodeUrl };
    } catch (error) {
      console.error('❌ [AUTH] Error generando secreto TOTP:', error);
      throw error;
    }
  }

  /**
   * Verificar código y completar enrolamiento TOTP (Enrollment Step 2)
   */
  async enrollTotp(user: FirebaseUser, secret: TotpSecret, code: string, displayName: string = 'Authenticator App'): Promise<void> {
    try {
      console.log('🛡️ [AUTH] Completando enrolamiento TOTP...');
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
      await multiFactor(user).enroll(assertion, displayName);
      
      // Actualizamos el documento del usuario en Firestore para indicar que tiene MFA
      const uid = user.uid;
      const userRef = doc(this.firestore, 'users', uid);
      await updateDoc(userRef, {
        mfaEnabled: true,
      });

      // Actualizamos el cache
      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.uid === uid) {
        this.setCurrentUser({ ...currentUser, mfaEnabled: true });
      }

      console.log('✅ [AUTH] TOTP enrolado correctamente en Firebase y Firestore');
    } catch (error: any) {
      console.error('❌ [AUTH] Error enrolando TOTP:', error);
      if (error.code === 'auth/invalid-verification-code') {
        throw new Error('Código incorrecto');
      }
      throw error;
    }
  }
}
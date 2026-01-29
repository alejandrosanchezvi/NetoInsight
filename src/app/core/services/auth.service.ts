// 🔐 NetoInsight - Authentication Service (Firebase)

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { switchMap, map, catchError, tap } from 'rxjs/operators';

// Firebase imports
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  UserCredential,
} from '@angular/fire/auth';

import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';

import { User, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
  ) {
    console.log('🔐 [AUTH] AuthService initialized');
    this.initAuthListener();
  }

  /**
   * Listener de cambios de autenticación de Firebase
   */
  private initAuthListener(): void {
    onAuthStateChanged(this.auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        console.log('🔐 [AUTH] Firebase user detected:', firebaseUser.email);
        const userData = await this.getUserData(firebaseUser.uid);
        this.currentUserSubject.next(userData);
        if (userData) {
          console.log('✅ [AUTH] User data loaded:', userData.email);
        }
      } else {
        console.log('🔐 [AUTH] No Firebase user');
        this.currentUserSubject.next(null);
      }
    });
  }

  /**
   * Login con email y password
   */
  async login(email: string, password: string): Promise<User> {
    console.log('🔐 [AUTH] Login attempt for:', email);

    try {
      // 1. Autenticar con Firebase
      const credential: UserCredential = await signInWithEmailAndPassword(
        this.auth,
        email,
        password,
      );

      console.log('✅ [AUTH] Firebase authentication successful');

      // 2. Obtener datos adicionales de Firestore
      const userData = await this.getUserData(credential.user.uid);

      if (!userData) {
        throw new Error('User data not found in Firestore');
      }

      // 3. Actualizar última conexión
      await this.updateLastLogin(credential.user.uid);

      console.log('✅ [AUTH] Login complete:', userData.email);
      return userData;
    } catch (error: any) {
      console.error('❌ [AUTH] Login error:', error);

      // Mensajes de error amigables
      let errorMessage = 'Error al iniciar sesión';

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
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    console.log('🔐 [AUTH] Logging out...');

    try {
      await signOut(this.auth);
      this.currentUserSubject.next(null);
      this.router.navigate(['/login']);
      console.log('✅ [AUTH] Logout successful');
    } catch (error) {
      console.error('❌ [AUTH] Logout error:', error);
      throw error;
    }
  }

  /**
   * Obtener datos del usuario desde Firestore
   */
  private async getUserData(uid: string): Promise<User | null> {
    console.log('📄 [AUTH] Fetching user data for UID:', uid);

    try {
      console.log('uid: '+uid);
      const userDocRef = doc(this.firestore, 'users', uid);
      console.log('uid 2: '+uid);
      const userDoc = await getDoc(userDocRef);
      console.log('uid 3: '+uid);

      if (!userDoc.exists()) {
        console.warn('⚠️ [AUTH] User document not found in Firestore');
        return null;
      }

      const data = userDoc.data();

      const user: User = {
        uid: uid,
        email: data['email'],
        name: data['name'],
        role: data['role'] as UserRole,
        tenantId: data['tenantId'],
        tenantName: data['tenantName'],
        avatarUrl: data['avatarUrl'],
        isInternal: data['isInternal'] || false,
        mfaEnabled: data['mfaEnabled'] || false,
        createdAt: data['createdAt']?.toDate() || new Date(),
        lastLogin: data['lastLogin']?.toDate(),
      };

      console.log('✅ [AUTH] User data fetched:', user.email);
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
}

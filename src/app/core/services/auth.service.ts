// 🔐 NetoInsight - Authentication Service

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User, UserSession, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;

  constructor() {
    // Inicializar con usuario mock para desarrollo
    const mockUser = this.getMockUser();
    this.currentUserSubject = new BehaviorSubject<User | null>(mockUser);
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  /**
   * Obtiene el usuario actual
   */
  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Usuario mock para desarrollo
   */
  private getMockUser(): User {
    return {
      id: 'usr_001',
      email: 'proveedor@bimbo.com',
      name: 'Juan Pérez',
      role: UserRole.VIEWER,
      tenantId: 'tenant_bimbo',
      tenantName: 'Bimbo',
      avatarUrl: undefined,
      isInternal: false,
      createdAt: new Date('2024-01-15'),
      lastLoginAt: new Date()
    };
  }

  /**
   * Login con SSO (Azure AD / Google)
   * TODO: Implementar integración real con IdP
   */
  async login(email: string, password: string): Promise<boolean> {
    try {
      // TODO: Llamar a API de autenticación
      // const response = await this.http.post('/api/auth/login', { email, password });
      
      // Por ahora, usar mock
      const user = this.getMockUser();
      this.currentUserSubject.next(user);
      
      // Guardar token en localStorage (temporal)
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      return true;
    } catch (error) {
      console.error('Error en login:', error);
      return false;
    }
  }

  /**
   * Logout
   */
  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    
    // TODO: Redirigir a página de login
    // this.router.navigate(['/login']);
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.currentUserValue !== null;
  }

  /**
   * Verificar si el usuario es interno
   */
  isInternalUser(): boolean {
    return this.currentUserValue?.isInternal ?? false;
  }

  /**
   * Verificar si el usuario tiene rol específico
   */
  hasRole(role: UserRole): boolean {
    return this.currentUserValue?.role === role;
  }

  /**
   * Obtener tenant del usuario actual
   */
  getCurrentTenant(): string {
    return this.currentUserValue?.tenantName ?? 'Sin asignar';
  }

  /**
   * Actualizar perfil del usuario
   * TODO: Implementar llamada a API
   */
  async updateProfile(userData: Partial<User>): Promise<boolean> {
    try {
      const currentUser = this.currentUserValue;
      if (!currentUser) return false;

      const updatedUser = { ...currentUser, ...userData };
      this.currentUserSubject.next(updatedUser);
      
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      return true;
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      return false;
    }
  }

  /**
   * Refrescar token de sesión
   * TODO: Implementar refresh token logic
   */
  async refreshToken(): Promise<boolean> {
    try {
      // TODO: Llamar a API para refrescar token
      return true;
    } catch (error) {
      console.error('Error refrescando token:', error);
      this.logout();
      return false;
    }
  }
}
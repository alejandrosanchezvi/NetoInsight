// 🔐 NetoInsight - Authentication Service (COMPLETO)

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;

  constructor() {
    // Inicializar con usuario mock o desde localStorage
    const storedUser = this.getUserFromStorage();
    this.currentUserSubject = new BehaviorSubject<User | null>(storedUser || this.getMockUser());
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  /**
   * Obtener usuario actual (sincrónico)
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Obtener observable del usuario actual
   */
  getCurrentUserObservable(): Observable<User | null> {
    return this.currentUser$;
  }

  /**
   * Login mock (simulación)
   */
  login(email: string, password: string): Observable<User> {
    return new Observable(observer => {
      // Simulación de delay de red
      setTimeout(() => {
        const user = this.getMockUser();
        this.setCurrentUser(user);
        observer.next(user);
        observer.complete();
      }, 1000);
    });
  }

  /**
   * Logout
   */
  logout(): void {
    this.currentUserSubject.next(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * Verificar si el usuario tiene un rol específico
   */
  hasRole(role: UserRole): boolean {
    const user = this.currentUserSubject.value;
    return user !== null && user.role === role;
  }

  /**
   * Verificar si el usuario es interno
   */
  isInternalUser(): boolean {
    const user = this.currentUserSubject.value;
    return user !== null && user.isInternal === true;
  }

  /**
   * Actualizar usuario actual
   */
  private setCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
    this.saveUserToStorage(user);
  }

  /**
   * Guardar usuario en localStorage
   */
  private saveUserToStorage(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  /**
   * Obtener usuario desde localStorage
   */
  private getUserFromStorage(): User | null {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        return JSON.parse(userStr) as User;
      } catch (error) {
        console.error('Error parsing user from storage:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * 🔹 MOCK USER - Usuario de prueba
   * En producción, esto vendrá del SSO (Azure AD / Google Workspace)
   */
  private getMockUser(): User {
    return {
      id: 'user-001',
      email: 'juan.perez@bimbo.com',
      name: 'Juan Pérez',
      role: UserRole.VIEWER,
      tenantId: 'tenant-bimbo',
      tenantName: 'ALEN DEL NORTE S.A. DE C.V.', // 🔹 IMPORTANTE: Este valor se usa para filtrar Tableau
      avatarUrl: '', // Opcional: URL de avatar
      isInternal: false,
      createdAt: new Date('2024-01-15'),
      lastLoginAt: new Date()
    };
  }

  /**
   * 🔹 CAMBIAR USUARIO MOCK (para testing)
   * Útil para probar diferentes proveedores sin autenticación real
   */
  setMockUser(providerName: string): void {
    const mockUsers: { [key: string]: User } = {
      'Bimbo': {
        id: 'user-001',
        email: 'juan.perez@bimbo.com',
        name: 'Juan Pérez',
        role: UserRole.VIEWER,
        tenantId: 'tenant-bimbo',
        tenantName: 'Bimbo',
        avatarUrl: '',
        isInternal: false,
        createdAt: new Date('2024-01-15'),
        lastLoginAt: new Date()
      },
      'Coca-Cola': {
        id: 'user-002',
        email: 'maria.lopez@cocacola.com',
        name: 'María López',
        role: UserRole.VIEWER,
        tenantId: 'tenant-cocacola',
        tenantName: 'Coca-Cola',
        avatarUrl: '',
        isInternal: false,
        createdAt: new Date('2024-02-10'),
        lastLoginAt: new Date()
      },
      'Walmart': {
        id: 'user-003',
        email: 'carlos.garcia@walmart.com',
        name: 'Carlos García',
        role: UserRole.VIEWER,
        tenantId: 'tenant-walmart',
        tenantName: 'Walmart',
        avatarUrl: '',
        isInternal: false,
        createdAt: new Date('2024-03-05'),
        lastLoginAt: new Date()
      },
      'Neto-Admin': {
        id: 'admin-001',
        email: 'admin@neto.com',
        name: 'Admin Neto',
        role: UserRole.ADMIN,
        tenantId: 'tenant-neto',
        tenantName: 'Neto',
        avatarUrl: '',
        isInternal: true,
        createdAt: new Date('2023-01-01'),
        lastLoginAt: new Date()
      }
    };

    const user = mockUsers[providerName] || mockUsers['Bimbo'];
    this.setCurrentUser(user);
    console.log(`🔄 Mock user cambiado a: ${user.tenantName}`);
  }

  /**
   * Obtener token (mock)
   * En producción retornará el token JWT real
   */
  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  /**
   * Guardar token
   */
  saveToken(token: string): void {
    localStorage.setItem('authToken', token);
  }
}
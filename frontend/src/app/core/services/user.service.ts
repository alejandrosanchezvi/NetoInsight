// 👥 NetoInsight - User Service

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor() { }

  /**
   * Obtener información del usuario por ID
   * TODO: Implementar llamada a API
   */
  getUserById(userId: string): Observable<User | null> {
    // Mock data por ahora
    return of(null);
  }

  /**
   * Actualizar avatar del usuario
   * TODO: Implementar upload a Cloud Storage
   */
  async updateAvatar(file: File): Promise<string | null> {
    try {
      // TODO: Subir imagen a Cloud Storage
      // const formData = new FormData();
      // formData.append('avatar', file);
      // const response = await this.http.post('/api/user/avatar', formData);
      
      console.log('Avatar file:', file.name);
      return 'https://via.placeholder.com/150';
    } catch (error) {
      console.error('Error subiendo avatar:', error);
      return null;
    }
  }

  /**
   * Obtener preferencias del usuario
   * TODO: Implementar lectura desde base de datos
   */
  getUserPreferences(userId: string): Observable<any> {
    return of({
      theme: 'light',
      language: 'es',
      notifications: true
    });
  }

  /**
   * Guardar preferencias del usuario
   * TODO: Implementar guardado en base de datos
   */
  async saveUserPreferences(userId: string, preferences: any): Promise<boolean> {
    try {
      console.log('Guardando preferencias:', preferences);
      return true;
    } catch (error) {
      console.error('Error guardando preferencias:', error);
      return false;
    }
  }
}
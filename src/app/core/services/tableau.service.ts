// 📊 NetoInsight - Tableau Service (CON DEBUGGING COMPLETO)

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

interface TableauEmbedResponse {
  embedUrl: string;
  providerName: string;
  filterField: string;
  expiresIn: number;
}

@Injectable({
  providedIn: 'root'
})
export class TableauService {
  private readonly API_URL = 'http://localhost:8000';
  private auth = inject(Auth);
  private http = inject(HttpClient);

  constructor() {
    console.log('📊 [TABLEAU-SERVICE] Inicializado');
  }

  async getEmbedUrl(dashboardName: string): Promise<TableauEmbedResponse> {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 [TABLEAU] INICIO - Solicitando URL de embed');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 [TABLEAU] Dashboard solicitado: ${dashboardName}`);

    try {
      // 1. Verificar usuario autenticado
      const currentUser = this.auth.currentUser;
      console.log('👤 [TABLEAU] Usuario actual:', currentUser?.email || 'NO AUTENTICADO');

      if (!currentUser) {
        console.error('❌ [TABLEAU] ERROR: No hay usuario autenticado');
        throw new Error('Usuario no autenticado');
      }

      // 2. Obtener token de Firebase
      console.log('🔐 [TABLEAU] Obteniendo token de Firebase...');
      let firebaseToken: string;
      
      try {
        firebaseToken = await currentUser.getIdToken(false);
        console.log('✅ [TABLEAU] Token obtenido correctamente');
        console.log(`🔑 [TABLEAU] Token (primeros 20 chars): ${firebaseToken.substring(0, 20)}...`);
        console.log(`📏 [TABLEAU] Longitud del token: ${firebaseToken.length} caracteres`);
      } catch (tokenError) {
        console.error('❌ [TABLEAU] ERROR al obtener token:', tokenError);
        throw new Error(`Error obteniendo token: ${tokenError}`);
      }

      // 3. Preparar headers
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      });

      console.log('📤 [TABLEAU] Headers preparados:');
      console.log('   - Authorization: Bearer [TOKEN]');
      console.log('   - Content-Type: application/json');

      // 4. Construir URL
      const url = `${this.API_URL}/api/tableau/embed-url?dashboard=${dashboardName}`;
      console.log(`🌐 [TABLEAU] URL completa: ${url}`);

      // 5. Hacer petición HTTP
      console.log('🚀 [TABLEAU] Enviando petición al backend...');
      
      const response = await firstValueFrom(
        this.http.get<TableauEmbedResponse>(url, { headers })
      );

      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ [TABLEAU] ÉXITO - Respuesta recibida');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📦 [TABLEAU] Respuesta completa:', response);
      console.log(`🔗 [TABLEAU] Embed URL: ${response.embedUrl.substring(0, 100)}...`);
      console.log(`🏢 [TABLEAU] Proveedor: ${response.providerName}`);
      console.log(`⏱️ [TABLEAU] Expira en: ${response.expiresIn} segundos`);

      return response;

    } catch (error: any) {
      console.log('═══════════════════════════════════════════════════════════');
      console.error('❌ [TABLEAU] ERROR COMPLETO');
      console.log('═══════════════════════════════════════════════════════════');
      console.error('🔴 [TABLEAU] Tipo de error:', error?.constructor?.name);
      console.error('🔴 [TABLEAU] Mensaje:', error?.message);
      console.error('🔴 [TABLEAU] Status:', error?.status);
      console.error('🔴 [TABLEAU] Error completo:', error);
      
      if (error?.error) {
        console.error('🔴 [TABLEAU] Detalle del error:', error.error);
      }

      // Throw con mensaje descriptivo
      const errorMessage = error?.error?.detail || error?.message || 'Error desconocido';
      throw new Error(`Error al obtener URL de Tableau: ${errorMessage}`);
    }
  }
}
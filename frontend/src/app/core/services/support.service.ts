import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export interface SupportTicketRequest {
    topic: string;
    details: string;
}

export interface SupportTicketResponse {
    success: boolean;
    message: string;
    message_id?: string;
}

@Injectable({
    providedIn: 'root'
})
export class SupportService {
    private apiUrl = `${environment.apiUrl}/api/support`;

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    /**
     * Envia un ticket de soporte al backend para que se genere
     * un correo a cuenta.conexion@tiendasnetows.com.
     * La identidad y tenant se extraen del token en el backend.
     */
    async submitTicket(data: SupportTicketRequest): Promise<SupportTicketResponse> {
        const token = await this.authService.getIdToken();

        if (!token) {
            throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.');
        }

        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        return firstValueFrom(
            this.http.post<SupportTicketResponse>(`${this.apiUrl}/ticket`, data, { headers })
        );
    }
}

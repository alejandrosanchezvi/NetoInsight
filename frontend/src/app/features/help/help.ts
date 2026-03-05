import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { SupportService } from '../../core/services/support.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
    selector: 'app-help',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './help.html',
    styleUrls: ['./help.css']
})
export class HelpComponent implements OnInit {
    helpForm: FormGroup;
    currentUser: User | null = null;
    submitted = false;
    isSubmitting = false;

    topicOptions = [
        { value: 'Acceso y Autenticación', label: 'Problema al iniciar sesión o acceder a un módulo' },
        { value: 'Error en Tablero (Tableau)', label: 'Un tablero no carga o los datos parecen incorrectos' },
        { value: 'Administración de Usuarios', label: 'Problemas gestionando usuarios o permisos' },
        { value: 'Sugerencia o Mejora', label: 'Tengo una sugerencia para mejorar la plataforma' },
        { value: 'Otro', label: 'Otra consulta general' }
    ];

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private supportService: SupportService,
        private notificationService: NotificationService
    ) {
        this.helpForm = this.fb.group({
            topic: ['', Validators.required],
            details: ['', [Validators.required, Validators.minLength(20)]]
        });
    }

    ngOnInit(): void {
        this.currentUser = this.authService.getCurrentUser();
    }

    async onSubmit(): Promise<void> {
        this.submitted = true;

        if (this.helpForm.invalid || this.isSubmitting) {
            return;
        }

        this.isSubmitting = true;

        try {
            const topic = this.helpForm.get('topic')?.value;
            const details = this.helpForm.get('details')?.value;

            await this.supportService.submitTicket({ topic, details });

            this.notificationService.success(
                'Mensaje Enviado',
                'Tu solicitud de soporte ha sido enviada exitosamente. Nuestro equipo la revisará y se pondrá en contacto contigo pronto.'
            );

            // Limpiar formulario y reiniciar estado
            this.helpForm.reset();
            this.submitted = false;
            this.helpForm.get('topic')?.setValue(''); // Devolver al placeholder

        } catch (error) {
            console.error('Error enviando ticket de soporte:', error);
            this.notificationService.error(
                'Error de Envío',
                'Hubo un problema al intentar enviar tu mensaje. Por favor intenta más tarde o comunícate vía correo manualmente a cuenta.conexion@tiendasnetows.com'
            );
        } finally {
            this.isSubmitting = false;
        }
    }

    resizeTextarea(event: Event): void {
        const textarea = event.target as HTMLTextAreaElement;
        textarea.style.height = 'auto'; // Reset to calculate new height
        textarea.style.height = `${textarea.scrollHeight}px`;
    }
}

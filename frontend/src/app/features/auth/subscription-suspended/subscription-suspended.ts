// 🚫 NetoInsight - Subscription Suspended Page

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';

type SuspendedReason = 'inactive' | 'trial_expired' | 'subscription_expired' | 'not_found' | 'unknown';

interface SuspendedContent {
    icon: string;
    title: string;
    subtitle: string;
    description: string;
    ctaLabel: string;
    ctaType: 'contact' | 'logout';
}

@Component({
    selector: 'app-subscription-suspended',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './subscription-suspended.html',
    styleUrls: ['./subscription-suspended.css']
})
export class SubscriptionSuspended implements OnInit {

    reason: SuspendedReason = 'unknown';
    currentUser: User | null = null;
    isLoggingOut = false;

    readonly CONTENT: Record<SuspendedReason, SuspendedContent> = {
        trial_expired: {
            icon: 'clock',
            title: 'Tu período de prueba ha terminado',
            subtitle: 'El acceso gratuito de 30 días ha concluido',
            description: 'Para continuar usando NetoInsight y acceder a tus dashboards, contacta a tu representante de Tiendas Neto para activar un plan.',
            ctaLabel: 'Contactar a Neto',
            ctaType: 'contact'
        },
        subscription_expired: {
            icon: 'calendar',
            title: 'Tu suscripción ha vencido',
            subtitle: 'El período de tu plan ha concluido',
            description: 'Para renovar el acceso a NetoInsight, comunícate con tu representante de Tiendas Neto.',
            ctaLabel: 'Contactar a Neto',
            ctaType: 'contact'
        },
        inactive: {
            icon: 'pause',
            title: 'Acceso suspendido',
            subtitle: 'Tu cuenta ha sido desactivada temporalmente',
            description: 'El administrador de Tiendas Neto ha suspendido el acceso a esta cuenta. Comunícate con ellos para más información.',
            ctaLabel: 'Contactar a Neto',
            ctaType: 'contact'
        },
        not_found: {
            icon: 'alert',
            title: 'Cuenta no encontrada',
            subtitle: 'No pudimos encontrar tu configuración de acceso',
            description: 'Hubo un problema al cargar tu cuenta. Por favor cierra sesión e intenta de nuevo, o contacta a soporte.',
            ctaLabel: 'Cerrar Sesión',
            ctaType: 'logout'
        },
        unknown: {
            icon: 'alert',
            title: 'Acceso no disponible',
            subtitle: 'No tienes acceso a la plataforma en este momento',
            description: 'Comunícate con tu representante de Tiendas Neto para más información.',
            ctaLabel: 'Contactar a Neto',
            ctaType: 'contact'
        }
    };

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        this.currentUser = this.authService.getCurrentUser();
        const reasonParam = this.route.snapshot.queryParamMap.get('reason');
        this.reason = (reasonParam as SuspendedReason) ?? 'unknown';
        console.log('🚫 [SUSPENDED] Razón de bloqueo:', this.reason);
    }

    get content(): SuspendedContent {
        return this.CONTENT[this.reason] ?? this.CONTENT['unknown'];
    }

    async onCta(): Promise<void> {
        if (this.content.ctaType === 'logout') {
            await this.logout();
        } else {
            // Abrir WhatsApp o email de contacto
            window.open('mailto:soporte@tiendasneto.com?subject=Acceso NetoInsight — ' + this.currentUser?.tenantName, '_blank');
        }
    }

    async logout(): Promise<void> {
        this.isLoggingOut = true;
        try {
            await this.authService.logout();
        } catch {
            this.router.navigate(['/login']);
        }
    }
}
// 📊 NetoInsight - Categorization Component (EMBEDDING API v3 OFICIAL)

import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnDestroy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-skus',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './skus.html',
  styleUrls: ['./skus.css'],
})
export class Skus implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('tableauContainer', { static: false }) tableauContainer!: ElementRef;

  isLoading: boolean = true;
  currentProviderName: string = '';
  authError: string = '';

  private jwtToken: string = '';

  constructor(
    private authService: AuthService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.currentProviderName = currentUser.tenantName;
    }
    this.loadTableauScript();
  }

  ngAfterViewInit(): void {}
  ngOnDestroy(): void {}

  private loadTableauScript(): void {
    const existingScript = document.getElementById('tableau-embedding-script');

    if (existingScript) {
      this.loadDashboard();
      return;
    }

    const script = document.createElement('script');
    script.id = 'tableau-embedding-script';
    script.type = 'module';
    script.src =
      'https://us-east-1.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';

    script.onload = () => {
      console.log('✅ Tableau Embedding API v3 cargada');
      this.loadDashboard();
    };

    script.onerror = () => {
      this.isLoading = false;
      this.authError = 'Error cargando Tableau Embedding API v3';
    };

    document.head.appendChild(script);
  }

  private async loadDashboard(): Promise<void> {
    try {
      const firebaseToken = await this.authService.getFirebaseToken();
      if (!firebaseToken) throw new Error('No Firebase token');

      const response = await this.http
        .get<any>('http://localhost:8000/api/tableau/embed-url', {
          params: { dashboard: 'skus' },
          headers: { Authorization: `Bearer ${firebaseToken}` },
        })
        .toPromise();

      if (response?.jwt && response?.embedUrl) {
        this.jwtToken = response.jwt;
        console.log('✅ JWT recibido, creando tableau-viz element');
        await this.createTableauVizElement(response.embedUrl);
      } else {
        throw new Error('JWT o URL no recibido');
      }
    } catch (error: any) {
      console.error('❌ Error:', error);
      this.isLoading = false;
      this.authError =
        error.status === 401 ? 'Error 401: Verificar Connected App' : 'Error cargando dashboard';
    }
  }

  private async createTableauVizElement(embedUrl: string): Promise<void> {
    try {
      const container = this.tableauContainer.nativeElement;
      container.innerHTML = '';

      // Crear elemento tableau-viz según documentación oficial
      const viz = document.createElement('tableau-viz');
      viz.setAttribute('id', 'tableau-viz');
      viz.setAttribute('src', embedUrl);
      viz.setAttribute('token', this.jwtToken); // JWT as attribute
      viz.setAttribute('width', '100%');
      viz.setAttribute('height', '800px');
      viz.setAttribute('toolbar', 'hidden'); // Como recomienda la doc

      // Event listeners según documentación oficial
      viz.addEventListener('firstinteractive', () => {
        console.log('✅ Dashboard cargado con SSO');
        this.isLoading = false;
        this.authError = '';
      });

      // Event listener para errores de autenticación
      viz.addEventListener('vizloadError', (event: any) => {
        console.error('❌ Viz Load Error:', event.detail);
        this.isLoading = false;
        this.authError =
          'Error de autenticación Connected App: ' + (event.detail?.errorCode || 'unknown');
      });

      container.appendChild(viz);
      console.log('📊 tableau-viz element creado con JWT token');

      // Timeout
      setTimeout(() => {
        if (this.isLoading) {
          this.isLoading = false;
          this.authError = 'Timeout: Verificar Connected App configuration';
        }
      }, 30000);
    } catch (error: any) {
      console.error('❌ Error creando viz element:', error);
      this.isLoading = false;
      this.authError = `Error: ${error.message}`;
    }
  }

  getCurrentProviderName(): string {
    return this.currentProviderName || 'Cargando...';
  }

  async refreshDashboard(): Promise<void> {
    this.isLoading = true;
    this.authError = '';
    await this.loadDashboard();
  }

  async debugAuth(): Promise<void> {
    console.log('=== DEBUG EMBEDDING API v3 ===');
    console.log('Loading:', this.isLoading);
    console.log('Error:', this.authError);
    console.log(
      'JWT Token:',
      this.jwtToken ? `Present (${this.jwtToken.length} chars)` : 'Missing',
    );

    const user = this.authService.getCurrentUser();
    console.log('User:', user ? user.email : 'Not authenticated');

    const vizElement = document.getElementById('tableau-viz');
    console.log('Viz Element:', vizElement ? 'Created' : 'Not created');

    if (vizElement) {
      console.log('Viz src:', vizElement.getAttribute('src'));
      console.log('Viz token:', vizElement.getAttribute('token') ? 'Present' : 'Missing');
    }

    console.log('Script loaded:', !!document.getElementById('tableau-embedding-script'));
  }
}

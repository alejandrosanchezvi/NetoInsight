// 📊 NetoInsight - TableauDashboardService (v4 — Diagnóstico completo)
//
// Incluye:
//   ✅ Cache de JWT en memoria (8 min, con auto-invalidación en error 16)
//   ✅ Carga única del script de Tableau
//   ✅ Filtrado optimizado — 1 sola llamada al campo correcto
//   ✅ Tiempos detallados en cada fase (script, JWT, firstinteractive, filtros)
//   ✅ Snapshot de filtros ANTES y DESPUÉS de aplicar el filtro de proveedor
//   ✅ Diagnóstico claro de qué hace el clear vs qué hace el apply

import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface TableauEmbedConfig {
    dashboardKey: string;
    containerSelector: string;
    filterFieldId?: string;
    netoInternalId?: string;
}

interface JwtCache {
    token: string;
    embedUrl: string;
    expiresAt: number;
}

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

const TABLEAU_SCRIPT_ID = 'tableau-embedding-script';
const TABLEAU_SCRIPT_SRC = 'https://us-east-1.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';
const JWT_EXPIRY_MS = 8 * 60 * 1000;
const LOAD_TIMEOUT_MS = 20_000;
const NETO_INTERNAL_ID = 'NETO-INTERNAL';
const FILTER_FIELD_ID = 'Proveedor Id';   // campo ID numérico
const FILTER_FIELD_NAME = 'Proveedor';      // campo nombre — también persiste en la vista publicada

// ─────────────────────────────────────────────────────────────
// Helpers de diagnóstico
// ─────────────────────────────────────────────────────────────

/** Devuelve cuántos ms pasaron desde `start`, como string legible */
function ms(start: number): string {
    return `${(performance.now() - start).toFixed(0)}ms`;
}

/** Formatea un filtro de Tableau para logging — cubre los 3 tipos principales */
function formatFilter(f: any): object {
    const base = {
        campo: f.fieldName,
        tipo: f.filterType,
        excluir: f.isExcludeMode ?? false,
    };

    // Filtro categórico
    if (f.appliedValues !== undefined) {
        const vals = f.appliedValues.map((v: any) => v.formattedValue);
        return {
            ...base,
            valores: vals.length > 0 ? vals : '(vacío — sin valores activos)',
        };
    }

    // Filtro de rango (numérico / fecha)
    if (f.min !== undefined || f.max !== undefined) {
        return { ...base, min: f.min?.formattedValue ?? null, max: f.max?.formattedValue ?? null };
    }

    // Filtro relativo de fecha
    if (f.periodType !== undefined) {
        return { ...base, periodo: f.periodType, ancla: f.anchorDate ?? null };
    }

    return base;
}

/** Lee todos los filtros de una worksheet sin lanzar excepción */
async function snapshotFilters(ws: any): Promise<object[]> {
    try {
        const filters: any[] = await ws.getFiltersAsync();
        return filters.map(formatFilter);
    } catch {
        return [{ error: 'No se pudieron leer los filtros (ws.getFiltersAsync falló)' }];
    }
}

// ─────────────────────────────────────────────────────────────
// Servicio
// ─────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TableauDashboardService {

    private readonly jwtCache = new Map<string, JwtCache>();
    private scriptLoadPromise: Promise<void> | null = null;
    private renderer: Renderer2;

    constructor(
        private authService: AuthService,
        private http: HttpClient,
        rendererFactory: RendererFactory2
    ) {
        this.renderer = rendererFactory.createRenderer(null, null);
    }

    // ──────────────────────────────────────────────
    // API pública
    // ──────────────────────────────────────────────

    async loadDashboard(
        container: HTMLElement,
        config: TableauEmbedConfig,
        providerId: string
    ): Promise<{ vizElement: any; error?: string }> {
        const tag = `[Tableau:${config.dashboardKey}]`;
        const t0 = performance.now();

        console.group(`${tag} ▶ loadDashboard — proveedor="${providerId || '(vacío)'}"`);
        console.log(`${tag} 🕐 ${new Date().toLocaleTimeString('es-MX')}`);

        try {
            // ── 1. Script ────────────────────────────────────────────
            const tScript = performance.now();
            const scriptCached = !!document.getElementById(TABLEAU_SCRIPT_ID);
            await this.ensureTableauScript();
            console.log(`${tag} 📦 Script Tableau: ${scriptCached ? '(ya en DOM)' : ms(tScript)}`);

            // ── 2. JWT ───────────────────────────────────────────────
            const tJwt = performance.now();
            const jwtCached = this.isJwtCached(config.dashboardKey);
            const { jwt, embedUrl } = await this.getJwt(config.dashboardKey);
            const dashboardPath = embedUrl.split('/views/')[1] ?? embedUrl;
            console.log(`${tag} 🔑 JWT: ${jwtCached ? '(desde cache)' : ms(tJwt)}`);
            console.log(`${tag} 🔗 URL: ${dashboardPath}`);

            // ── 3. Viz ───────────────────────────────────────────────
            const tViz = performance.now();
            const result = await this.createViz(container, embedUrl, jwt, config, providerId, tViz);

            if (result.error) {
                console.warn(`${tag} ❌ Resultado: ${result.error} | total: ${ms(t0)}`);
            } else {
                console.log(`${tag} ✅ Dashboard listo | total: ${ms(t0)}`);
            }
            console.groupEnd();
            return result;

        } catch (err: any) {
            const errorType = err?.status === 401 ? 'auth_error' : 'load_error';
            console.error(`${tag} 💥 Excepción:`, err?.message ?? err);
            console.groupEnd();
            return { vizElement: null, error: errorType };
        }
    }

    invalidateJwtCache(dashboardKey: string): void {
        this.jwtCache.delete(dashboardKey);
        console.log(`[Tableau:${dashboardKey}] 🗑 JWT cache invalidado`);
    }

    // ──────────────────────────────────────────────
    // Script
    // ──────────────────────────────────────────────

    private ensureTableauScript(): Promise<void> {
        if (document.getElementById(TABLEAU_SCRIPT_ID)) return Promise.resolve();
        if (this.scriptLoadPromise) return this.scriptLoadPromise;

        this.scriptLoadPromise = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.id = TABLEAU_SCRIPT_ID;
            script.type = 'module';
            script.src = TABLEAU_SCRIPT_SRC;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('script_error'));
            document.head.appendChild(script);
        });

        return this.scriptLoadPromise;
    }

    // ──────────────────────────────────────────────
    // JWT con cache
    // ──────────────────────────────────────────────

    private isJwtCached(dashboardKey: string): boolean {
        const c = this.jwtCache.get(dashboardKey);
        return !!(c && Date.now() < c.expiresAt);
    }

    private async getJwt(dashboardKey: string): Promise<{ jwt: string; embedUrl: string }> {
        const cached = this.jwtCache.get(dashboardKey);
        if (cached && Date.now() < cached.expiresAt) {
            const mins = ((cached.expiresAt - Date.now()) / 60000).toFixed(1);
            console.log(`[Tableau:${dashboardKey}] 🔑 JWT desde cache — expira en ${mins} min`);
            return { jwt: cached.token, embedUrl: cached.embedUrl };
        }

        console.log(`[Tableau:${dashboardKey}] 🔑 Solicitando JWT nuevo al backend...`);
        // Reintentar hasta 3 veces si Firebase aún no tiene la sesión lista
        // (condición de carrera en producción: Angular monta el componente
        //  antes de que Firebase termine de verificar la sesión)
        let firebaseToken: string | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            firebaseToken = await this.authService.getFirebaseToken();
            if (firebaseToken) break;
            console.warn(`[Tableau:${dashboardKey}] ⚠️ Sin token Firebase (intento ${attempt}/3) — esperando 500ms...`);
            await new Promise(r => setTimeout(r, 500));
        }
        if (!firebaseToken) throw new Error('No Firebase token');

        const response = await this.http.get<any>(
            `${environment.apiUrl}/api/tableau/embed-url`,
            {
                params: { dashboard: dashboardKey },
                headers: { 'Authorization': `Bearer ${firebaseToken}` },
            }
        ).toPromise();

        if (!response?.jwt || !response?.embedUrl) throw new Error('JWT o URL no recibido');

        this.jwtCache.set(dashboardKey, {
            token: response.jwt,
            embedUrl: response.embedUrl,
            expiresAt: Date.now() + JWT_EXPIRY_MS,
        });

        return { jwt: response.jwt, embedUrl: response.embedUrl };
    }

    // ──────────────────────────────────────────────
    // Creación del viz
    // ──────────────────────────────────────────────

    private createViz(
        container: HTMLElement,
        embedUrl: string,
        jwt: string,
        config: TableauEmbedConfig,
        providerId: string,
        tVizStart: number
    ): Promise<{ vizElement: any; error?: string }> {
        const tag = `[Tableau:${config.dashboardKey}]`;

        return new Promise((resolve) => {
            container.innerHTML = '';

            const viz = document.createElement('tableau-viz');
            viz.setAttribute('src', embedUrl);
            viz.setAttribute('token', jwt);
            viz.setAttribute('width', '100%');
            viz.setAttribute('height', '100%');
            viz.setAttribute('toolbar', 'hidden');
            viz.setAttribute('hide-tabs', 'true');
            viz.style.cssText = 'width:100%;height:100%;display:block;min-height:100%;opacity:0;visibility:hidden;';

            let settled = false;

            // ── Timeout ─────────────────────────────────────────────
            const timeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                console.warn(`${tag} ⏱ TIMEOUT — firstinteractive no llegó en ${LOAD_TIMEOUT_MS / 1000}s`);
                console.warn(`${tag}   Posibles causas: conexión lenta, Tableau Cloud saturado, JWT rechazado silenciosamente`);
                resolve({ vizElement: viz, error: 'timeout_error' });
            }, LOAD_TIMEOUT_MS);

            // ── firstinteractive ─────────────────────────────────────
            viz.addEventListener('firstinteractive', async () => {
                clearTimeout(timeoutId);
                if (settled) return;

                console.log(`${tag} 🎯 firstinteractive en ${ms(tVizStart)}`);

                const tFilter = performance.now();
                await this.applyProviderFilter(viz, providerId, config);
                console.log(`${tag} ⏱ Filtrado completo en ${ms(tFilter)}`);

                // Pequeña espera para que Tableau termine de procesar el filtro
                // en el servidor antes de mostrar el viz. applyFilterAsync resuelve
                // cuando Tableau acepta el comando, pero el reset-filter/categorical-filter
                // en el servidor puede tardar 1-2s más en completarse.
                console.log(`${tag} ⏳ Esperando confirmación de Tableau...`);
                await new Promise(r => setTimeout(r, 1500));
                console.log(`${tag} 👁 Mostrando dashboard`);

                viz.style.transition = 'opacity 0.4s ease-in-out';
                viz.style.opacity = '1';
                viz.style.visibility = 'visible';

                settled = true;
                resolve({ vizElement: viz });
            });

            // ── vizloadError ─────────────────────────────────────────
            viz.addEventListener('vizloadError', (event: any) => {
                clearTimeout(timeoutId);
                if (settled) return;
                settled = true;

                const code = event.detail?.errorCode;
                const msg = event.detail?.errorMessage || '';
                const errorType = (code === 16 || msg.includes('"code":16')) ? 'jwt_error' : 'viz_error';

                console.error(`${tag} ❌ vizloadError — código: ${code ?? 'N/A'} | tipo: ${errorType}`);
                if (msg) console.error(`${tag}   Mensaje:`, msg.slice(0, 300));

                if (errorType === 'jwt_error') {
                    this.invalidateJwtCache(config.dashboardKey);
                    console.warn(`${tag}   JWT invalidado — próximo intento pedirá token fresco`);
                }

                resolve({ vizElement: viz, error: errorType });
            });

            container.appendChild(viz);
            console.log(`${tag} 🧩 tableau-viz en DOM — esperando firstinteractive (timeout: ${LOAD_TIMEOUT_MS / 1000}s)...`);
        });
    }

    // ──────────────────────────────────────────────
    // Filtrado con diagnóstico ANTES / DESPUÉS
    // ──────────────────────────────────────────────

    async applyProviderFilter(
        vizElement: any,
        providerId: string,
        config: TableauEmbedConfig
    ): Promise<void> {
        const tag = `[Tableau:${config.dashboardKey}]`;
        const fieldId = config.filterFieldId ?? FILTER_FIELD_ID;  // "Proveedor Id"
        const fieldName = FILTER_FIELD_NAME;                         // "Proveedor"
        const netoId = config.netoInternalId ?? NETO_INTERNAL_ID;

        if (!providerId) {
            console.warn(`${tag} ⚠️ providerId vacío — sin filtro`);
            return;
        }

        const isNetoAdmin = providerId === netoId;
        const accion = isNetoAdmin
            ? `CLEAR ambos campos en todas las sheets (admin Neto)`
            : `APPLY "${fieldId}"="${providerId}" + CLEAR "${fieldName}"`;

        console.group(`${tag} 🔎 Filtros — ${accion}`);

        try {
            const workbook = await vizElement.workbook;
            const activeSheet = await workbook.activeSheet;
            const sheets: any[] = activeSheet.sheetType === 'dashboard'
                ? activeSheet.worksheets
                : [activeSheet];

            console.log(`${tag} 📋 Sheet activa: "${activeSheet.name}" (${activeSheet.sheetType})`);
            console.log(`${tag} 📋 Worksheets (${sheets.length}):`, sheets.map((s: any) => s.name));

            if (isNetoAdmin) {
                // ─────────────────────────────────────────────────────────────────
                // CASO NETO ADMIN
                // Limpiar ambos campos en la PRIMERA worksheet que los acepte.
                // Tableau propaga al resto del dashboard automáticamente.
                // ─────────────────────────────────────────────────────────────────
                let cleared = false;

                for (const ws of sheets) {
                    // Log de filtros ANTES para ver qué trae cada hoja
                    const antes = await snapshotFilters(ws);
                    console.log(`${tag} 📄 "${ws.name}" ANTES →`, antes.length ? antes : '(ningún filtro)');

                    try {
                        const tOp = performance.now();
                        console.log(`${tag} 📄 "${ws.name}" — intentando clear...`);

                        await Promise.race([
                            Promise.all([
                                ws.clearFilterAsync(fieldId),
                                ws.clearFilterAsync(fieldName).catch(() => { }),
                            ]),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('filter-timeout-15s')), 15_000)
                            ),
                        ]);

                        console.log(`${tag} 🧹 clear "${fieldId}" + "${fieldName}" en "${ws.name}" en ${ms(tOp)}`);
                        console.log(`${tag} → Tableau propaga al resto del dashboard`);
                        cleared = true;
                        break;

                    } catch (err: any) {
                        if (err?.message === 'filter-timeout-15s') {
                            console.warn(`${tag} ⏱ TIMEOUT en clear sobre "${ws.name}" (>15s)`);
                            cleared = true;
                        } else {
                            console.log(`${tag} ⏭ "${ws.name}" no tiene "${fieldId}" — siguiente`);
                        }
                        break;
                    }
                }

                if (!cleared) {
                    console.warn(`${tag} ⚠️ NINGUNA worksheet aceptó "${fieldId}"`);
                }

            } else {
                // ─────────────────────────────────────────────────────────────────
                // CASO PROVEEDOR EXTERNO
                // Apply en la primera worksheet que acepte el campo.
                // Timeout de 15s para no bloquear la UI si Tableau tarda.
                // ─────────────────────────────────────────────────────────────────
                let applied = false;

                for (const ws of sheets) {
                    // Log de filtros ANTES para ver qué trae cada hoja
                    const antes = await snapshotFilters(ws);
                    console.log(`${tag} 📄 "${ws.name}" ANTES →`, antes.length ? antes : '(ningún filtro)');

                    try {
                        const tOp = performance.now();
                        console.log(`${tag} 📄 "${ws.name}" — intentando apply...`);

                        await Promise.race([
                            Promise.all([
                                ws.applyFilterAsync(fieldId, [providerId], 'replace'),
                                ws.clearFilterAsync(fieldName).catch(() => { }),
                            ]),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('filter-timeout-15s')), 15_000)
                            ),
                        ]);

                        console.log(`${tag}   applyFilterAsync("${fieldId}", ["${providerId}"]) + clearFilterAsync("${fieldName}") en ${ms(tOp)}`);

                        // Snapshot DESPUÉS para confirmar
                        const snap = await snapshotFilters(ws);
                        const confirmado = snap.find((f: any) => f.campo === fieldId);
                        const quedoName = snap.find((f: any) => f.campo === fieldName);
                        const vals = (quedoName as any)?.valores;
                        const nameOk = !quedoName || !vals || vals === '(vacío — sin valores activos)'
                            || (Array.isArray(vals) && vals.length === 0);

                        console.log(`${tag}   DESPUÉS →`, snap.length ? snap : '(ningún filtro activo)');
                        console.log(`${tag}   ${confirmado ? '✅' : '⚠️'} "${fieldId}": ${confirmado ? `valores=${JSON.stringify((confirmado as any).valores)}` : `NO aparece — "${providerId}" puede no existir en datos`}`);
                        console.log(`${tag}   ${nameOk ? '✅' : '⚠️'} "${fieldName}": ${nameOk ? 'limpiado (sin restricción)' : 'sigue con valores: ' + JSON.stringify(vals)}`);
                        console.log(`${tag}   → Tableau propaga al resto del dashboard`);

                        applied = true;
                        break;

                    } catch (err: any) {
                        if (err?.message === 'filter-timeout-15s') {
                            // Timeout en esta hoja — continuar con la siguiente
                            // No romper el loop: otra worksheet puede responder más rápido
                            console.warn(`${tag}   ⏱ TIMEOUT en "${ws.name}" (>15s) — probando siguiente worksheet...`);
                            continue;
                        } else {
                            // Campo no existe en esta hoja — siguiente
                            console.log(`${tag}   ⏭ "${fieldId}" no existe en "${ws.name}" — siguiente`);
                            continue;
                        }
                    }
                }

                if (!applied) {
                    console.warn(`${tag} ⚠️ NINGUNA worksheet respondió a "${fieldId}" — dashboard se muestra sin filtro`);
                    console.warn(`${tag}    Puede ser carga de Tableau Cloud. El usuario debería refrescar.`);
                }
            }

        } catch (err: any) {
            console.error(`${tag} 💥 Error en applyProviderFilter:`, err?.message ?? err);
        }

        console.groupEnd();
    }

    // ──────────────────────────────────────────────
    // Helpers de layout
    // ──────────────────────────────────────────────

    adjustContainerWidth(containerSelector: string): void {
        const container = document.querySelector(containerSelector) as HTMLElement;
        if (container) {
            this.renderer.setStyle(container, 'width', '100%');
            this.renderer.setStyle(container, 'max-width', '100%');
        }
    }

    disposeViz(vizElement: any): void {
        if (vizElement) {
            vizElement.style.opacity = '0';
            vizElement.style.visibility = 'hidden';
            vizElement.style.transition = 'none';
            vizElement.dispose?.();
        }
    }
}
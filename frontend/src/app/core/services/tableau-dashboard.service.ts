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
import { downloadExcel } from '../utils/csv-export.util';
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

// Configuración de hoja para descarga de mes cerrado
export interface ClosedMonthSheet {
    wsName: string;  // nombre exacto de la hoja en Tableau
    tabName: string;      // nombre de la pestaña en el Excel
    formatAsPercent?: boolean; // convertir decimales a porcentaje
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
const FILTER_FIELD_NAME_DEFAULT = 'GRUPO ALPHALAB DE MEXICO HOME AND BEAUTY CARE SA DE CV';

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
        providerId: string,
        isTrial: boolean = false
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
            const result = await this.createViz(container, embedUrl, jwt, config, providerId, tViz, isTrial);

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

    /**
     * Solicita siempre un JWT nuevo al backend SIN tocar la caché.
     * Necesario para el viz oculto de descarga — el JWT de Tableau Connected Apps
     * tiene un claim `jti` que lo hace de un solo uso: el viz principal ya lo consumió,
     * reutilizarlo en un segundo viz hace que Tableau lo rechace silenciosamente
     * (sin disparar vizloadError, solo timeout).
     */
    private async getJwtFresh(dashboardKey: string): Promise<{ jwt: string; embedUrl: string }> {
        console.log(`[Tableau:${dashboardKey}] 🔑 Solicitando JWT fresco para viz oculto (sin cache)...`);

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

        // ⚠️ NO actualizamos el cache — este JWT es exclusivo del viz oculto
        // El viz principal conserva su propio token en cache intacto
        console.log(`[Tableau:${dashboardKey}] ✅ JWT fresco obtenido para viz oculto`);
        return { jwt: response.jwt, embedUrl: response.embedUrl };
    }

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
        tVizStart: number,
        isTrial: boolean = false
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
                if (isTrial) {
                    await this.applyTrialDateFilter(viz, config.dashboardKey);
                }
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

            // ── filterchanged — re-aplicar filtro trial si usuario lo mueve ──
            if (isTrial) {
                viz.addEventListener('filterchanged', async (event: any) => {
                    const fieldName = event.detail?.fieldName ?? '';
                    if (fieldName === 'Fecha') {
                        console.log(`${tag} 🔒 Trial — filtro de fecha cambiado, reaplicando restricción...`);
                        await new Promise(r => setTimeout(r, 300));
                        await this.applyTrialDateFilter(viz, config.dashboardKey);
                    }
                });
            }

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
                // Limpiar campo numérico y fijar proveedor base de forma SECUENCIAL
                // ─────────────────────────────────────────────────────────────────
                let cleared = false;

                for (const ws of sheets) {
                    try {
                        const tOp = performance.now();

                        // 1) Aplicamos el campo principal primero. Si falla, el campo no existe.
                        await Promise.race([
                            ws.applyFilterAsync(fieldName, [FILTER_FIELD_NAME_DEFAULT], 'replace'),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('filter-timeout-15s')), 15_000))
                        ]);

                        // 2) Si funcionó el campo principal, limpiamos el campo de ID
                        await ws.clearFilterAsync(fieldId).catch(() => { });

                        // Verificamos si Tableau *realmente* guardó el filtro en el backend (a veces falla silenciosamente en la primer hoja)
                        const checkFilters = await snapshotFilters(ws) as any[];
                        const didApply = checkFilters.some((f: any) => f.campo === fieldName && Array.isArray(f.valores) && f.valores.includes(FILTER_FIELD_NAME_DEFAULT));

                        if (didApply) {
                            console.log(`${tag} ✅ Filtro fijado exitósamente ("${fieldName}"="BIMBO...") en la hoja "${ws.name}" en ${ms(tOp)}`);
                            cleared = true;
                            break; // Ahora sí, salimos seguros de que Tableau lo procesó al resto del dashboard
                        } else {
                            console.log(`${tag} ⚠️ "${ws.name}" procesó el comando pero no reflejó los valores. Probando en la siguiente hoja...`);
                        }

                    } catch (err: any) {
                        if (err?.message === 'filter-timeout-15s') {
                            console.warn(`${tag} ⏱ TIMEOUT en "${ws.name}" (>15s)`);
                            break;
                        } else {
                            // Ignoramos silentemente si no existe el filtro en esta hoja para avanzar rápido
                        }
                    }
                }

                console.log(`${tag} → Tableau propaga al resto del dashboard (admin neto)`);

                if (!cleared) {
                    console.warn(`${tag} ⚠️ NINGUNA worksheet aplicó correctamente. dashboard sin filtrar.`);
                }

            } else {
                // ─────────────────────────────────────────────────────────────────
                // CASO PROVEEDOR EXTERNO
                // Aplicar de forma SECUENCIAL para evitar colisiones en VizQL
                // Timeout de 15s para no bloquear la UI si Tableau tarda.
                // ─────────────────────────────────────────────────────────────────
                let applied = false;

                for (const ws of sheets) {
                    try {
                        const tOp = performance.now();

                        // 1) Aplicamos nuestro id
                        await Promise.race([
                            ws.applyFilterAsync(fieldId, [providerId], 'replace'),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('filter-timeout-15s')), 15_000))
                        ]);

                        // 2) Si funcionó (el id existía en la hoja y no falló), limpiamos el nombre
                        await ws.clearFilterAsync(fieldName).catch(() => { });

                        // Verificación de que el filtro existe post-comando
                        const checkFilters = await snapshotFilters(ws) as any[];
                        const didApply = checkFilters.some((f: any) => f.campo === fieldId && Array.isArray(f.valores) && f.valores.includes(providerId));

                        if (didApply) {
                            console.log(`${tag} ✅ Filtro ID aplicado exitósamente en la hoja "${ws.name}" en ${ms(tOp)}`);
                            applied = true;
                            break; // Salimos de iterar sabiendo que funcionó
                        } else {
                            console.log(`${tag} ⚠️ "${ws.name}" procesó el comando de proveedor pero no retuvo el valor. Probando en siguiente hoja...`);
                        }

                    } catch (err: any) {
                        if (err?.message === 'filter-timeout-15s') {
                            console.warn(`${tag}   ⏱ TIMEOUT en "${ws.name}" (>15s) — probando siguiente worksheet...`);
                            continue;
                        } else {
                            // Siguiente hoja
                            continue;
                        }
                    }
                }

                console.log(`${tag} → Tableau propaga al resto del dashboard (proveedor)`);

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

    // ──────────────────────────────────────────────
    // Descarga de mes cerrado (Opción C — viz oculto)
    // ──────────────────────────────────────────────

    /**
     * Descarga los datos del mes anterior para el proveedor dado.
     * Crea un tableau-viz oculto con filtros pre-aplicados,
     * extrae los datos de la hoja indicada y genera un .xlsx.
     *
     * @param dashboardKey  clave del dashboard (ej. 'categorization')
     * @param sheetName     nombre exacto de la hoja en Tableau (ej. 'Tabla-arts')
     * @param providerId    proveedorIdInterno del usuario
     * @param config        config opcional de filtro de proveedor
     * @param onProgress    callback para actualizar el estado al componente
     */
    async downloadClosedMonthData(
        dashboardKey: string,
        sheets: ClosedMonthSheet[],
        providerId: string,
        config: TableauEmbedConfig,
        onProgress?: (step: string) => void
    ): Promise<{ success: boolean; error?: string }> {
        const tag = `[ClosedMonth:${dashboardKey}]`;
        const { firstDay, lastDay, label } = this.getLastMonthRange();

        console.group(`${tag} ▶ downloadClosedMonthData — mes: ${label} | proveedor: ${providerId}`);

        // Contenedor temporal invisible — se agrega al body y se elimina al final
        const tempContainer = document.createElement('div');
        // ⚠️ El viz DEBE estar dentro del viewport para que Tableau dispare firstinteractive.
        // Tableau usa IntersectionObserver internamente — si el elemento está fuera de pantalla
        // (top:-9999px) el observer nunca dispara y el viz se queda congelado.
        // visibility:hidden mantiene el elemento en layout y en viewport sin mostrarlo al usuario.
        tempContainer.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'width:1280px',
            'height:800px',
            'visibility:hidden',    // en layout, en viewport, pero invisible
            'pointer-events:none',  // no interactuable
            'z-index:-9999',        // debajo de todo
            'overflow:hidden',
        ].join(';');
        document.body.appendChild(tempContainer);

        let tempViz: any = null;

        try {
            // ── 1. JWT fresco (no reutilizar el del viz principal — jti es single-use) ─
            onProgress?.('Obteniendo acceso seguro...');
            const { jwt, embedUrl } = await this.getJwtFresh(dashboardKey);
            console.log(`${tag} 🔑 JWT listo`);

            // ── 2. Crear viz oculto con filtros pre-aplicados ────────
            onProgress?.('Iniciando conexión con los datos...');
            console.log(`${tag} 🧩 Creando viz oculto — rango: ${firstDay.toISOString().slice(0, 10)} → ${lastDay.toISOString().slice(0, 10)}`);

            tempViz = document.createElement('tableau-viz');
            tempViz.setAttribute('src', embedUrl);
            tempViz.setAttribute('token', jwt);
            tempViz.setAttribute('width', '1280');
            tempViz.setAttribute('height', '800');
            tempViz.setAttribute('toolbar', 'hidden');
            tempViz.setAttribute('hide-tabs', 'true');

            // Filtro de proveedor (categórico) — pre-inicialización
            const isNetoAdmin = providerId === (config.netoInternalId ?? NETO_INTERNAL_ID);
            if (!isNetoAdmin) {
                const filterProveedor = document.createElement('viz-filter');
                filterProveedor.setAttribute('field', config.filterFieldId ?? FILTER_FIELD_ID);
                filterProveedor.setAttribute('value', providerId);
                tempViz.appendChild(filterProveedor);
                console.log(`${tag} 🔗 Filtro proveedor pre-aplicado: ${providerId}`);
            }

            // Filtro de fecha (rango) — se aplicará después de firstinteractive
            // Los range filters de fecha no se pueden hacer con viz-filter en pre-init
            // los aplicamos vía applyRangeFilterAsync post-firstinteractive

            tempContainer.appendChild(tempViz);

            // ── 3. Esperar firstinteractive del viz oculto ───────────
            onProgress?.('Cargando datos del mes anterior...');
            const vizReady = await this.waitForVizReady(tempViz, dashboardKey);
            if (!vizReady) {
                throw new Error('timeout_hidden_viz');
            }
            console.log(`${tag} 🎯 viz oculto listo`);

            // ── 4. Aplicar filtro de proveedor (para asegurar aislamiento) ─
            onProgress?.('Aplicando filtros...');
            await this.applyProviderFilter(tempViz, providerId, config);

            // ── 5. Aplicar filtro de rango de fecha ──────────────────
            console.log(`${tag} 📅 Aplicando filtro de fecha: ${label}`);
            await this.applyDateRangeFilter(tempViz, firstDay, lastDay, dashboardKey);

            // ── 6. Estabilizar y extraer datos ───────────────────────
            onProgress?.('Extrayendo datos...');
            await new Promise(r => setTimeout(r, 2000)); // esperar que Tableau procese el filtro de fecha

            const workbook = await tempViz.workbook;
            const activeSheet = await workbook.activeSheet;

            // ── 6b. Extraer datos de cada hoja configurada ──────────
            // ⚠️ allWs para no colisionar con el parámetro `sheets: ClosedMonthSheet[]`
            const allWs: any[] = activeSheet.sheetType === 'dashboard'
                ? activeSheet.worksheets
                : [activeSheet];
            const available = allWs.map((ws: any) => ws.name);
            console.log(`${tag} 📋 Hojas disponibles en viz oculto:`, available);

            const excelSheets: any[] = [];

            for (const sheetCfg of sheets) {
                const targetWs = allWs.find((ws: any) => ws.name === sheetCfg.wsName);
                if (!targetWs) {
                    console.warn(`${tag} ⚠️ Hoja "${sheetCfg.wsName}" no encontrada. Disponibles: ${available.join(', ')}`);
                    continue;
                }
                console.log(`${tag} 📊 Extrayendo datos de "${sheetCfg.wsName}"...`);
                const data = await targetWs.getSummaryDataAsync({ ignoreSelection: true });
                console.log(`${tag} ✅ "${sheetCfg.wsName}" — ${data.data?.length ?? 0} filas`);
                excelSheets.push({
                    sheetName: sheetCfg.tabName,
                    tableauData: data,
                    formatAsPercent: sheetCfg.formatAsPercent ?? false,
                });
            }

            if (excelSheets.length === 0) {
                throw new Error('no_sheets_found');
            }

            // ── 7. Generar Excel y descargar ─────────────────────────
            onProgress?.('Generando archivo...');
            const filename = `${dashboardKey}_${label.replace(' ', '_')}.xlsx`;
            downloadExcel(excelSheets, filename);

            console.log(`${tag} ⬇️ Descarga iniciada: ${filename}`);
            console.groupEnd();
            return { success: true };

        } catch (err: any) {
            const errMsg = err?.message ?? String(err);
            console.error(`${tag} 💥 Error:`, errMsg);
            console.groupEnd();
            return { success: false, error: errMsg };

        } finally {
            // ── 8. Limpiar viz oculto siempre ────────────────────────
            if (tempViz) {
                try { tempViz.dispose?.(); } catch { }
            }
            if (tempContainer.parentNode) {
                document.body.removeChild(tempContainer);
            }
            console.log(`${tag} 🗑 Viz oculto eliminado`);
        }
    }

    /** Calcula el primer y último día del mes anterior */
    getLastMonthRange(): { firstDay: Date; lastDay: Date; label: string; monthName: string; year: number } {
        const now = new Date();
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1; // 0-indexed

        const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
        const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthName = MESES[month];
        const label = `${monthName} ${year}`;

        const fmt = (d: Date) => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        console.log(`📅 [ClosedMonth] Rango: ${fmt(firstDay)}  →  ${fmt(lastDay)}  (${label})`);
        return { firstDay, lastDay, label, monthName, year };
    }

    /** Espera el firstinteractive del viz oculto con timeout de 30s */
    private waitForVizReady(viz: any, dashboardKey: string): Promise<boolean> {
        const tag = `[ClosedMonth:${dashboardKey}]`;
        const TIMEOUT_MS = 30_000;

        return new Promise((resolve) => {
            let settled = false;

            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                console.warn(`${tag} ⏱ Timeout viz oculto (${TIMEOUT_MS / 1000}s)`);
                resolve(false);
            }, TIMEOUT_MS);

            viz.addEventListener('firstinteractive', () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(true);
            });

            viz.addEventListener('vizloadError', (event: any) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                const code = event.detail?.errorCode;
                console.error(`${tag} ❌ vizloadError en viz oculto — código: ${code}`);
                if (code === 16) this.invalidateJwtCache(dashboardKey);
                resolve(false);
            });
        });
    }

    /** Aplica el filtro de rango de fecha en todas las worksheets */
    private async applyDateRangeFilter(
        vizElement: any,
        firstDay: Date,
        lastDay: Date,
        dashboardKey: string
    ): Promise<void> {
        const tag = `[ClosedMonth:${dashboardKey}]`;
        const FIELD = 'Fecha';

        try {
            const workbook = await vizElement.workbook;
            const activeSheet = await workbook.activeSheet;
            const sheets: any[] = activeSheet.sheetType === 'dashboard'
                ? activeSheet.worksheets
                : [activeSheet];

            let applied = false;
            for (const ws of sheets) {
                try {
                    await ws.applyRangeFilterAsync(FIELD, { min: firstDay, max: lastDay });
                    console.log(`${tag} 📅 Filtro de fecha aplicado en "${ws.name}"`);
                    applied = true;
                    break; // Tableau propaga el filtro al resto del dashboard
                } catch (e: any) {
                    console.warn(`${tag} ⚠️ Filtro fecha no aplicó en "${ws.name}":`, e?.message ?? e);
                }
            }

            if (!applied) {
                console.warn(`${tag} ⚠️ Ninguna hoja aceptó el filtro de fecha — los datos pueden incluir todos los periodos`);
            }
        } catch (e) {
            console.error(`${tag} 💥 Error en applyDateRangeFilter:`, e);
        }
    }

    /** Restringe el filtro de fecha a los últimos 30 días para usuarios en trial */
    private async applyTrialDateFilter(vizElement: any, dashboardKey: string): Promise<void> {
        const tag = `[Tableau:${dashboardKey}]`;
        const max = new Date();
        const min = new Date();
        min.setDate(min.getDate() - 30);

        console.log(`${tag} 🔒 Trial — restringiendo fechas: ${min.toLocaleDateString('es-MX')} → ${max.toLocaleDateString('es-MX')}`);

        try {
            const workbook = await vizElement.workbook;
            const activeSheet = await workbook.activeSheet;
            const sheets: any[] = activeSheet.sheetType === 'dashboard'
                ? activeSheet.worksheets
                : [activeSheet];

            let applied = false;
            for (const ws of sheets) {
                try {
                    await ws.applyRangeFilterAsync('Fecha', { min, max });
                    console.log(`${tag} 🔒 Filtro trial aplicado en "${ws.name}"`);
                    applied = true;
                    break;
                } catch { continue; }
            }
            if (!applied) console.warn(`${tag} ⚠️ No se pudo aplicar filtro trial de fecha`);
        } catch (e: any) {
            console.error(`${tag} 💥 Error en applyTrialDateFilter:`, e?.message ?? e);
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
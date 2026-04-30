# Tableau — Integración y Configuración

---

## Dashboards disponibles

| Key | Nombre en Tableau | Componente Angular |
|---|---|---|
| `categorization` | `NexusProveedores/Categorizacin` | `categorization` |
| `skus` | `NexusProveedores/SKUs` | `skus` |
| `stocks` | `NexusProveedores/Stocks` | `stocks` |
| `purchase-orders` | `NexusProveedores/OrdCompras` | `ordenes-compra` |

---

## Autenticación — Connected Apps (JWT)

El backend genera JWTs firmados con las credenciales del Connected App de Tableau Cloud.

**Proxy user pattern:**
```python
# Todos los JWT usan el mismo usuario como subject
TABLEAU_USER_EMAIL = "alejandro.sanchezvi@tiendasnetows.com"
```

El aislamiento de datos **no es por usuario de Tableau** — es por filtro en el frontend.

**Claim importante:** `jti` (JWT ID) es único por token. Tableau no acepta el mismo `jti` dos veces. El viz oculto de descarga siempre llama `getJwtFresh()` para obtener un JWT nuevo.

---

## Flujo de carga de un dashboard

```
1. loadDashboard(container, config, providerId, isTrial)
2. ensureTableauScript() — carga el SDK de Tableau si no está en DOM
3. getJwt() — obtiene JWT del backend (cacheado 55 min)
4. createViz() — crea el elemento <tableau-viz> en el DOM
5. firstinteractive event:
   a. applyProviderFilter(viz, providerId)
      → intenta filtro "Proveedor Id" en cada worksheet
      → stop on first success
   b. Si isTrial: applyTrialDateFilter(viz)
      → applyRangeFilterAsync('Fecha', { min: hoy-30d, max: hoy })
   c. Listener filterchanged:
      → si isTrial y campo === 'Fecha': re-aplica el filtro automáticamente
6. Mostrar dashboard (quitar spinner)
```

---

## Filtro de proveedor

El filtro se aplica por `proveedorIdInterno` del usuario, no por nombre:

```typescript
// Campo en Tableau: "Proveedor Id"
await ws.applyFilterAsync('Proveedor Id', [providerId], FilterUpdateType.Replace);
```

NETO-INTERNAL (`proveedorIdInterno === 'NETO-INTERNAL'`) bypasea el filtro — ve todos los datos.

**⚠️ Riesgo:** Si el `proveedorIdInterno` en Firestore no coincide con el valor en el datasource de Tableau, el dashboard se muestra **sin filtro** (todos los datos visibles). En v1.3.0 se debe agregar pantalla de error para este caso.

---

## Descarga de mes cerrado

Usa un viz oculto independiente del viz principal:

```typescript
// El viz oculto debe estar en el viewport con visibility:hidden
// NO fuera de pantalla (top: -9999px) — IntersectionObserver de Tableau
// no dispara firstinteractive si el elemento no está en viewport
```

**Hoja por dashboard:**

| Dashboard | Hoja Tableau | Pestaña Excel | formatAsPercent |
|---|---|---|---|
| Categorización | `Tabla-arts` | `Categorización` | false |
| SKUs | `TablaArts` | `SKUs` | false |
| SKUs | `Catalogo` | `Catálogo` | false |
| Stocks | `Hoja 48` | `Stocks` | false |
| OCs | `TablaFRTda` | `Fill Rate Tienda` | **true** |
| OCs | `TablaFRArt` | `Fill Rate Artículo` | **true** |

**Mes disponible para descarga:**
Siempre el mes anterior cerrado. Si el mes actual es Mayo, descarga Abril.

---

## Restricciones por plan

| Plan | Filtro fechas | Descarga libre | Descarga mes cerrado |
|---|---|---|---|
| trial | Últimos 30 días (Categorización) | ❌ comentado | ❌ |
| starter | Sin restricción | ❌ comentado | ✅ si `canDownloadClosedMonth` |
| pro/enterprise | Sin restricción | ❌ comentado | ✅ si `canDownloadClosedMonth` |
| internal | Sin restricción | ❌ comentado | ✅ siempre |

> La descarga libre (exportar lo que se ve) está comentada en los 4 dashboards. Se activará en una versión futura.

---

## Timeouts configurados

| Evento | Timeout | Nota |
|---|---|---|
| firstinteractive | 20s | Tableau Cloud puede tardar con sesiones frías |
| applyFilter | 25s | Generous dado el procesamiento en la nube |
| Descarga mes cerrado | 30s | El viz oculto tarda más |

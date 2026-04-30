# Changelog — NetoInsight

---

## v1.3.0 — Abril 2026 ✅ En producción

### Nuevo
- **Usuario Mágico / Impersonación** (`ImpersonationService`, `ProviderPickerComponent`, `ImpersonationBannerComponent`) — admin NETO-INTERNAL puede simular la vista de cualquier proveedor activo (trial/starter) sin cambiar de sesión, completamente en memoria
- **Sidebar: botón "Simular proveedor"** — visible solo para `isInternal: true` + `role: admin`; muestra modal de búsqueda con lista de proveedores activos
- **Banner naranja** mientras la impersonación está activa, con botón de salir
- **Dashboards reactivos** — categorization, skus, stocks y ordenes-compra se recargan automáticamente al cambiar de proveedor simulado (`impersonated$.pipe(skip(1))`)
- **Tracking de actividad de usuario** — `loginCount` (acumulador), `loginDays` (array de fechas únicas vía `arrayUnion`), `firstLogin` (escrito una sola vez)

### Métricas admin mejoradas
- **6 cards** en una fila: Total proveedores, Con usuario registrado, Starter, Trial activos, Invitaciones pendientes, Sin usuarios
- **Gráfica de crecimiento** con toggle mensual/semanal y 3 series: Starter, Trial, Actividad
- **Tabla de actividad** con scroll, ranking por `loginCount`, top 20 usuarios
- Trial activo = `plan === 'trial'` + `usedLicenses > 0` + periodo vigente

### Fix
- `internalAdminGuard` y `adminGuard` requieren `role === 'admin'` explícitamente (`isInternal` solo ya no es suficiente)
- `isTrial` en dashboards se actualiza correctamente al impersonar un proveedor trial

---

## v1.2.0 — Abril 2026 ✅ En producción

### Nuevo
- **Pantalla de Métricas** para NETO-INTERNAL admin (`/admin/metrics`):
  - 6 tarjetas de resumen en tiempo real desde Firestore
  - Gráfica de crecimiento de proveedores (últimos 6 meses)
  - Tabla de todos los proveedores ordenable (plan, usuarios, vencimiento)
  - Tabla de actividad de usuarios con toggle "sin actividad"
- **Restricción de fechas para trial** — Categorización aplica automáticamente filtro de últimos 30 días; listener `filterchanged` re-aplica si el usuario intenta moverlo
- **Control de descarga por plan** — menú de exportar oculto para trial; descarga de mes cerrado respeta `canDownloadClosedMonth`
- **Edición de licencias** en Edit Tenant Modal — botones +/− con validación contra `usedLicenses`
- **Script `send_invitations.py`** — diagnóstico y envío masivo con dry-run, modo test y cancelación automática de previas

### Fix
- Condición de carrera en carga de dashboard — `initDashboard()` ahora se llama solo después de que `getTenantById()` resuelve
- Flag `tenantLoaded` previene doble carga desde `ngAfterViewInit`
- Invitaciones: al reinvitar, cancela automáticamente la invitación pendiente anterior
- Validación de usuario activo antes de crear invitación

### Email / DNS
- Templates HTML actualizados a color azul Neto (#0e3b83) en los 3 correos
- Eliminados campos "Contacto Neto" e "Invitado por" de los templates
- DNS Squarespace corregido: DKIM (3 CNAMEs sin dominio duplicado), DMARC en `_dmarc`, SPF unificado con `-all`
- Lógica de selección de template: `provider` vs `user` según `tenant.plan`

### Infra
- Deploy backend a Cloud Run `netoinsight-api-prod` (us-central1)
- Deploy frontend a Firebase Hosting target `production`
- `environment.prod.ts` configurado con URL real de Cloud Run
- Versión unificada a 1.2.0 en `package.json` y `main.py`

---

## v1.1.0 — Marzo 2026

### Nuevo
- **Descarga de mes cerrado** (Excel) — viz oculto con `visibility:hidden`, JWT fresco independiente, filtro de fecha pre-aplicado
- **Toggle `canDownloadClosedMonth`** en Edit y Create Tenant Modal
- **Trial desde creación de cuenta** — `subscriptionEnd = hoy + 30 días` al aceptar invitación
- Auto-login en `setup-account` sin doble `signInWithEmailAndPassword`
- Migración Firestore: 37 tenants con emails reales, planes correctos

### Fix
- Password reset — `UNAUTHORIZED_DOMAIN` corregido (backend lee `FRONTEND_URL` de env var)
- Toggle de contraseña en login (ojito derecha, candado izquierda)

---

## v1.0.0 — Febrero 2026

- MVP inicial — dashboards embebidos de Tableau, autenticación Firebase, multi-tenant básico
- Gestión de proveedores y usuarios desde el portal admin
- Invitaciones por email con magic link
- Trial banner y restricciones básicas

---

## Pendiente para próximas versiones

| Tarea | Prioridad |
|---|---|
| Pantalla de error cuando `proveedorIdInterno` no filtra en Tableau | Alta — riesgo de seguridad |
| Firestore Security Rules en producción | Alta |
| Cloud Scheduler para expirar invitaciones automáticamente | Media |
| Descarga libre (exportar lo que se ve) — menú comentado | Baja |
| Métricas adicionales: conversión de funnel, tiempo de activación | Media |
| Optimizar bundle size — ApexCharts excede presupuesto 2 MB en 78 KB | Baja |

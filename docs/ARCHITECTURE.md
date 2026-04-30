# Arquitectura — NetoInsight

## Estructura del proyecto

```
NetoInsight/
├── frontend/                          # Angular 17 standalone
│   └── src/app/
│       ├── core/
│       │   ├── guards/                # adminGuard, internalAdminGuard
│       │   ├── models/                # user.model.ts, tenant.model.ts
│       │   └── services/
│       │       ├── auth.service.ts
│       │       ├── invitation.service.ts
│       │       ├── tableau-dashboard.service.ts
│       │       ├── tenant.service.ts
│       │       └── view-as.service.ts  # v1.3.0
│       ├── features/
│       │   ├── admin/
│       │   │   ├── metrics/            # Solo NETO-INTERNAL admin
│       │   │   ├── tenant-management/
│       │   │   ├── edit-tenant-modal/
│       │   │   ├── create-tenant-modal/
│       │   │   └── invite-user-modal/
│       │   ├── auth/
│       │   │   ├── login/
│       │   │   ├── setup-account/      # Sin MFA desde v1.3.0
│       │   │   └── accept-invite/
│       │   └── pages-dashboard/
│       │       ├── categorization/
│       │       ├── ordenes-compra/
│       │       ├── skus/
│       │       └── stocks/
│       └── shared/components/
│           ├── sidebar/
│           ├── view-as-banner/         # v1.3.0
│           ├── view-as-selector/       # v1.3.0
│           └── download-closed-month-modal/
└── backend/                           # FastAPI + Python
    ├── main.py
    ├── app/
    │   ├── auth.py                    # verify_token con Firebase Admin
    │   ├── mailslurp_service.py
    │   └── templates/
    │       ├── invitation_provider_email.html
    │       ├── invitation_user_email.html
    │       └── password_reset_email.html
    └── send_invitations.py            # Script de envío masivo
```

---

## Decisiones técnicas clave

### 1. Tableau — Proxy User Pattern
Todos los JWT de Tableau Connected Apps usan un único usuario licenciado como `sub`:
```
alejandro.sanchezvi@tiendasnetows.com
```
El aislamiento de datos se hace por filtro en el frontend con `proveedorIdInterno`, no a nivel de usuario de Tableau. NETO-INTERNAL bypasea todos los filtros.

### 2. Firebase Admin SDK — Inicialización explícita
```python
firebase_admin.initialize_app(
    credentials.ApplicationDefault(),
    {"projectId": os.getenv("FIREBASE_PROJECT_ID", "netoinsight-fed03")}
)
```
El `projectId` debe ser explícito porque el entorno GCP puede tener múltiples proyectos activos (`servisan-eventos` en la cuenta personal). Sin esto, el Admin SDK puede inicializarse contra el proyecto equivocado.

### 3. Trial — inicio al crear cuenta
El `subscriptionEnd` se calcula en `setup-account.ts` cuando el usuario crea su cuenta (no cuando se crea el tenant en Firestore). Así los 30 días empiezan desde que el proveedor realmente empieza a usar el portal.

### 4. Carga de dashboard — orden crítico
```
ngOnInit → subscribirse al usuario
  → getTenantById() [async]
    → isTrial, canDownloadClosedMonth ya disponibles
    → tenantLoaded = true
    → initDashboard() ← se llama AQUÍ
      → loadDashboard(providerId, isTrial)
        → firstinteractive
          → applyProviderFilter()
          → applyTrialDateFilter() si isTrial
```
`ngAfterViewInit` solo establece `viewReady = true`. Nunca llama `initDashboard()` directamente.

### 5. JWT de Tableau — single-use
Cada JWT tiene claim `jti` único. El viz oculto de descarga de mes cerrado usa `getJwtFresh()` que siempre solicita un token nuevo al backend, independiente del caché del viz principal.

### 6. Caché de usuario en localStorage
El objeto de usuario se guarda con versioning para invalidar caché stale:
```typescript
const CACHE_VERSION = 'v2';
const REQUIRED_FIELDS = ['proveedorIdInterno', 'tenantId', 'role'];
```

### 7. View As (v1.3.0)
`ViewAsService` mantiene en memoria la sesión de impersonación. No persiste a localStorage — se limpia al recargar. Solo disponible para `isInternal === true && role === 'admin'`.

---

## Variables de entorno del backend (Cloud Run)

| Variable | Descripción |
|---|---|
| `FIREBASE_PROJECT_ID` | `netoinsight-fed03` |
| `MAILSLURP_API_KEY` | API key de MailSlurp |
| `MAILSLURP_INBOX_ID` | `81ab8878-8987-4a9c-a534-299ef25dbe2f` |
| `MAILSLURP_FROM_EMAIL` | `notificaciones@soyneto.com` |
| `MAILSLURP_FROM_NAME` | `NetoInsight` |
| `FRONTEND_URL` | `https://netoinsight.soyneto.com` |
| `TABLEAU_CLIENT_ID` | Connected App client ID |
| `TABLEAU_SECRET_ID` | Connected App secret ID |
| `TABLEAU_SECRET_VALUE` | Connected App secret value |
| `TABLEAU_USER_EMAIL` | `alejandro.sanchezvi@tiendasnetows.com` |

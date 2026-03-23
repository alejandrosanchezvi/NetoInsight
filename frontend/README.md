# 🎨 NetoInsight — Frontend (Angular SPA)

Interfaz de usuario del portal NetoInsight: una Single Page Application construida con **Angular 18+** en modo Standalone. Integra dashboards de Tableau, gestión de usuarios multi-tenant y autenticación con Firebase.

---

## ✨ Características Principales

| Módulo | Descripción |
|---|---|
| **Tableau Embedding API v3** | Incrusta dashboards de forma nativa con web-components. Exporta PDF completo, datos (CSV) e intercepta la impresión del navegador para garantizar calidad. |
| **Firebase Auth** | Login con email/contraseña. Verificación de sesión y renovación de tokens automática mediante interceptores HTTP. |
| **Multi-Tenant** | Filtros automáticos por proveedor/tenant. Cada usuario accede únicamente a los datos de su organización. |
| **Gestión de Usuarios** | Panel de administración para invitar, activar/desactivar y gestionar roles de usuarios. |
| **Mesa de Ayuda** | Formulario de tickets de soporte integrado con MailSlurp. |
| **CSS Glassmorphism** | Diseño moderno corporativo sin librerías de UI externas. Loaders enmascarados durante la carga de iframes. |

---

## 🛠️ Stack Tecnológico

- [Angular 18+](https://angular.dev/) — Standalone Components, Signals, RxJS
- [AngularFire](https://github.com/angular/angularfire) — Firebase Auth + Firestore
- [Tableau Embedding API v3](https://help.tableau.com/current/api/embedding_api/en-us/) — Web Components nativos
- [Firebase Hosting](https://firebase.google.com/docs/hosting) — CDN global serverless

---

## 🚀 Desarrollo Local

**Requisito:** Node.js v18+ y Angular CLI instalados globalmente.

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar servidor de desarrollo
ng serve -o
```

La app estará disponible en → `http://localhost:4200/`

> Asegúrate de que el backend (`uvicorn main:app --reload --port 8000`) esté corriendo en paralelo, ya que el frontend realiza llamadas a `http://localhost:8000/api` en modo development.

---

## ⚙️ Configuración de Entornos

Los archivos de entorno están en `src/environments/`:

| Archivo | Uso |
|---|---|
| `environment.ts` | Desarrollo local (apunta a `localhost:8000`) |
| `environment.staging.ts` | Build de staging (apunta a la API de staging en Cloud Run) |
| `environment.prod.ts` | Build de producción (apunta a la API de producción en Cloud Run) |

---

## 🚢 Despliegue en Firebase Hosting

Los scripts de `package.json` automatizan el build y el deploy en un solo comando:

### Staging

```bash
npm run deploy:staging
```

### Producción

```bash
npm run deploy:prod
```

> Esto ejecuta `ng build --configuration [env]` seguido de `firebase deploy --only hosting:[target]` automáticamente.

**URLs de acceso:**
- **Producción:** https://netoinsight.soyneto.com
- **Staging:** https://netoinsight-staging.web.app

---

## 📁 Estructura del Proyecto

```
frontend/src/
├── app/
│   ├── core/
│   │   ├── services/         # auth.service, tableau.service, etc.
│   │   └── models/           # User, Tenant, Invitation models
│   ├── features/
│   │   ├── auth/             # Login, setup-account, forgot-password
│   │   ├── pages-dashboard/  # Categorización, SKUs, Stocks, Órdenes
│   │   └── admin/            # Gestión de usuarios (admin)
│   └── shared/
│       └── components/       # Navbar, Sidebar, User Menu
├── environments/             # Configuración por ambiente
└── assets/                   # Imágenes y recursos estáticos
```

---

*NetoInsight · Innovación Digital · Tiendas Neto*

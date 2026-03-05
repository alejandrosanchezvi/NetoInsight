# 🎨 NetoInsight - Frontend (Angular)

El frontend de NetoInsight proporciona la interfaz de usuario moderna, rápida y dinámica para interactuar con los datos de las tiendas, proveedores y tableros incrustados de Tableau.

## ✨ Arquitectura y Tecnologías

El proyecto se basa en las últimas tecnologías frontend, con soporte de Firebase desde Google Cloud.

- **[Angular 17/18+](https://angular.dev/)**: Framework principal para el desarrollo de la Single Page Application (SPA).
- **Standalone Components**: Arquitectura basada en componentes independientes sin necesidad de NgModule.
- **[Firebase & AngularFire](https://github.com/angular/angularfire)**: Utilizado como Identity Provider para la autenticación, con integracion con Firestore para almacenar perfiles de usuarios y roles (Admin Neto vs Proveedor).
- **[Tableau Embedding API v3](https://help.tableau.com/current/api/embedding_api/en-us/index.html)**: Biblioteca para incrustar los tableros de manera segura y enviar JWTs firmados por el Backend y pasar filtros iniciales de seguridad a través del Frontend.
- **Aesthetic UI**: Diseño tipo Glassmorphism alineado con los esquemas de color corporativos de Tiendas Neto (`#0E3B83` - midnight blue, y `#F58220` - naranja brillante).

## 🚀 Inicio Rápido (Desarrollo Local)

Asegúrate de tener instalado [Node.js](https://nodejs.org/) (recomendado 18+) y Angular CLI de forma global (`npm install -g @angular/cli`).

1. **Instalar Dependencias**:
   Ve a la carpeta de `frontend` y ejecuta:

   ```bash
   npm install
   ```

2. **Configuración de Variables de Entorno**:
   Asegúrate de tener correctamente configurados los archivos en `src/environments/`:
   - `environment.ts` (para producción - backend en la nube)
   - `environment.development.ts` (para correr contra un backend local, por ejemplo: `apiUrl: 'http://localhost:8000'`)

3. **Arrancar el Servidor Local**:
   Inicia el servidor en el puerto 4200.

   ```bash
   ng serve
   ```

   Abre el navegador en `http://localhost:4200/`. La aplicación se recargará automáticamente si haces cambios en cualquier archivo dentro de `src/`.

## 🏗️ Construcción (Build)

Para empaquetar la aplicación de manera óptima para producción:

```bash
ng build --configuration production
```

Los artefactos compilados se almacenarán en el directorio `dist/neto-insight/`.

## 🚢 Despliegue en Firebase Hosting

La aplicación puede alojarse de manera sencilla a través de Firebase Hosting. Asegúrate de tener las credenciales correctas configuradas localmente con Google Cloud SDK o a través de `firebase login`.

1. **Autenticación en Firebase**:

   ```bash
   firebase login
   ```

2. **Inicializar Firebase si no se ha hecho** (Cuidado de no sobrescribir la config actual):

   ```bash
   firebase init hosting
   ```

3. **Desplegar a Producción**:

   ```bash
   firebase deploy --only hosting
   ```

   Esto compilará y subirá los archivos del directorio `dist` a los servidores de Firebase Hosting (ej: `https://netoinsight-staging.web.app` o el dominio personalizado `https://netoinsight.soyneto.com`).

## 📞 Estructura del Aplicativo

- `src/app/core/`: Patrones Singleton, Guards y Servicios (Comunicación al Backend v2.5.0, Login/Logout de Firebase, Session Storage Cache).
- `src/app/features/`: Componentes principales divididos por funcionalidad de Negocio (Dashboard de Inicio, Categorización, Tiendas, Ordenes, Formulario de Ayuda, Modales de Administración).
- `src/app/shared/`: Componentes, Servicios, e utilidades reciclables. (Sidebar, Navbar, Loader States, etc).

## 🆘 Troubleshooting y Consejos de Desarrollo

- Si ocurren errores `401 Unauthorized` de permisos con tu backend local en peticiones HTTPS hacia un dominio `::1`, usa un hostname distinto o revisa que `CORS` permita conectividad local explícita en `localhost`.
- La consola del navegador (Inspect) está configurada para mostrar logs útiles estilo `[AUTH]`, `[TABLEAU]`, así que puedes seguir el flujo del JWT y la petición del iframe desde las DevTools.

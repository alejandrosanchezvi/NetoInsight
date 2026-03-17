# 🎨 NetoInsight - Frontend (SPA Angular)

El frontend de NetoInsight provee una asombrosa interfaz de usuario interactiva y fluida para manipular la navegación completa de los tableros **Tableau en Web**. Además, ofrece una experiencia administrable limpia de "Dashboards de Múltiples Inquilinos (Proveedores)", Formularios Tipo Chat (Mesa de Ayuda), y Gestión nativa en App.

---

## ✨ Características de Arquitectura Frontend

El proyecto se despliega localmente rápido usando las ventajas compilar código en base a perfiles de Angular (`production` vs `development`).

- **[Angular 17/18+](https://angular.dev/)**: Utiliza Components en formato `Standalone` con renderizados progresivos y _Signals_ en vez de antiguos observables reactivos RxJS masificados, simplificando mantenibilidad.
- **Tableau Embedding API v3 Native**: Bibliotecas JavaScript insertas de nivel web-component para leer filtros dimensionales desde un Frontend sin pasar variables complejas vía iframes; validando la seguridad con _Single-Use Proxies_.
- **[Firebase Auth & AngularFire](https://github.com/angular/angularfire)**: Comunicación transaccional con GCP. Atrapa el objeto de usuario y valida el acceso de credenciales 2FA/MFA mediante flujos asíncronos antes de cargar el primer módulo.
- **Glassmorphism Aesthetic**: CSS plano modular optimizado que elimina librerías pesadas como Bootstrap en favor del esquema moderno corporativo de **Tiendas Neto**. Integra `loaders` enmascarados de degradado durante tiempos muertos del iFrame BI.
- **Protección JWT Total**: La integración de Headers se encripta automáticamente _bajo el capo_ mediante interceptores que mandan el idToken nativo de Google hasta las factorías del Backend Python.

---

## 🚀 Inicio Rápido en Modo Desarrollador (Local)

Requisito para los ingenieros frontend: _Tener al menos NodeJS v18+_ instalado de manera global en tu OS y la herramienta principal de Angular CLI funcionando. Tu puerto preferido será el `4200` y requerirás un Backend corriendo de lado.

### 1. Descomprimir e Instalar Dependencias del Repositorio Raíz
Ubícate con en la carpeta de `/frontend` y mapea los paquetes de `package.json` hacia NodeJS y compila sus vínculos al DOM Local:
```bash
npm install
```

### 2. Configuración de Entornos y Apuntador de Nube (Environments)
Es vital revisar en qué ambiente estás. Ve a `src/environments/` y ubica que el archivo local por defecto esté pegándole a un `localhost` para hacer llamados API locales hacia Python (no en la nube, hasta en Producción):
- `environment.development.ts`: Usualmente apuntará ciegamente a `apiUrl: 'http://localhost:8000/api'`.

### 3. Engancho al Servidor Local
Para activar de fondo compilaciones interactivas por cada pequeño cambio CSS / TS que hagas sin necesidad de refrescar el App manually *(Vite-Style Reload)* ejecutamos desde tu consola:
```bash
ng serve
```
Y si todo sale en color verde con un "Compiled Successfully", entra ahora mismo a tu buscador web nativo:
👉 **[http://localhost:4200/](http://localhost:4200/)**

---

## 🚢 Compilación a Construcción Final (Production Build)

Para el momento de entregar _(Release)_, compactamos el _tree-shaking_, borramos consolas inútiles, encogemos archivos de estílos, y encapsulamos todas las piezas en un módulo optimizado inyectándole reglas de variables en las nubes. 

Corre esto siempre desde tu CLI sobre este framework Angular:
```bash
ng build --configuration production
```
Esto creará silenciosamente una carpeta intocable llamada `dist/neto-insight/browser` donde estarán exclusivamente los `index.html` compilados como minificados que la Web requiere.

---

## ☁️ Autodespliegue Rápido a Nubes Serverless (Firebase Hosting)

La SPA FrontEnd NetoInsight jamás tocará un Servidor físico local. Gracias al CLI nativo, subiremos el material completo directo de nuestra caja local hacia los CDNs planetarios de _Google Firebase (Identity Platform)_.

**Recomendación de Terminal**: Comprueba antes con un comando `firebase --version` si estás dado de alta en CLI global de Firebase Tools (si no haz un `npm install -g firebase-tools`).

1. Loguéate a GCP si es la primera vez y enlaza tu token en tu navegador:
```bash
firebase login
```
2. Si te pide inicializar tu repositorio como Nube (No recomendado a menos de sobrescribir reglas host de App) hazlo con `firebase init hosting`. Si no, es inútil puesto a que cuentas nativamente con el archivo prefabricado en este repo `firebase.json` que contiene reglas SPA obligatorias (Rewrites Index Html) y Headers.
3. Para publicar desde tu rama master tras un Build hacia Producción total e interactuar con Firebase:

```bash
firebase deploy --only hosting
```
Si te imprime _Deploy Complete_, todo el mundo moderno podrá visualizarte inmediatamente ingresando a:
👉 **https://netoinsight.soyneto.com**

---
_Innovación Digital Corporativa | Aplicación Construida por y para Tiendas Neto y Socios Estratégicos._

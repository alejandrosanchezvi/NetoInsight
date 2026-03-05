# 🌟 NetoInsight - Plataforma de Proveedores

Bienvenido al repositorio oficial del proyecto **NetoInsight**. Esta plataforma permite a los proveedores y personal administrativo de **Tiendas Neto** acceder a increíbles tableros interactivos (dashboards de Tableau), gestionar inquilinos, perfiles de usuario y comunicarse con soporte técnico en una moderna _Single Page Application_.

## 📖 Sobre el Proyecto

NetoInsight abstrae la complejidad de permisos y licenciamientos de BI. Como proveedor, ingresas a una sola plataforma, autenticas tus credenciales corporativas o mediante correo e inmediatamente puedes ver, filtrar, y descargar visualizaciones dinámicas provenientes originalmente de un servidor Tableau.

### 🌐 Arquitectura del Sistema

La aplicación está dividida en dos componentes principales:

1. **[🟢 Frontend (Angular)](./frontend/README.md)**: Proporciona interfaces ricas en estilo Glassmorphism, formularios asincronos y seguridad estricta para el usuario final. Llama al Backend de manera autenticada firmando la sesión con tokens JWT de Firebase.
2. **[⚙️ Backend (FastAPI / Python)](./backend/README.md)**: Funciona como validador de seguridad. Cuando el frontend solicita un Dashboard, el backend responde con un Payload que incluye un Single-Use JWT Proxy de Tableau a través de _Connected Apps_ garantizando trazabilidad y seguridad de incrustación de manera silenciosa, además de lidiar con funciones administrativas como _MailSlurp_ para correos o envíos de Support Tickets.

## 🛠️ Comenzando en Desarrollo

Si quieres comenzar a desarrollar, necesitas abrir y correr ambas carpetas por separado. Asegúrate de verificar las guías integradas en cada tecnología.

- **Frontend**: Requiere [NodeJS y Angular CLI](./frontend/README.md)

   ```sh
   cd frontend
   npm install && ng serve
   ```

- **Backend**: Requiere [Python 3.11+ y requerimientos](./backend/README.md)

   ```sh
   cd backend
   python -m venv venv && source venv/Scripts/activate && pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

## 🚀 Despliegues y Producción

- **Frontend**: [Firebase Hosting (Netoinsight Web App)](https://netoinsight.soyneto.com).
- **Backend API**: [Google Cloud Run (Managed Containers)](#).
- **Autenticación Central**: En _Identity Platform_ / Firebase Auth bajo el tenant ID global de Firebase (netoinsight-fed03).
- **Dashboard Source**: Servidor Tableau Enterprise (Connected apps configuration / API v3).

## 🔒 Control de Rol y Niveles de Permisos

NetoInsight opera con perfiles (ej. `role: 'provider' | 'admin'`):

- **Admins (Internos Neto)**: Pueden invitar tenants proveeedores, crear usuarios directos ilimitados o revocar inicios de sesión. No tienen limitantes de data-filtering automáticos en UI (visualizan data nacional por defecto si no tienen una región atada).
- **Proveedores (Externos)**: Pueden ver los dashboards Tableau atados a su propio `proveedorIdInterno`. En tiempo real, Tableau v3 filtra las métricas y reportes que únicamente atañen o cruzan transaccionalmente con este tenant.

## 📋 Lista de Cambios y Commits Recientes

*(Documentando iterativamente los release-notes principales)_

- Mejora significativa visual en la interfaz de "Ayuda y Soporte" (Slack Style API support integration con MailSlurp Backend Endpoint v2.5.0)
- Importaciones Masivas (Bulk Imports): Parseo CSV resiliente en Python y Endpoint transaccional a Firebase desde el Backend para automatizar altas de cientos de proveedores en lotes de segundos sin congelar la app.
- Dashboard UI: Múltiples mejoras a los placeholders visuales para asegurar "no content flickering", con Glassmorphic loaders y Orbs gradients animados mientas los iFrames de BI terminan la ingesta de scripts.

---
_Hecho por Innovación Digital de Tiendas Neto._

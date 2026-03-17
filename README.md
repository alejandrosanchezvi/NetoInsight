# 🌟 NetoInsight - Plataforma de Proveedores

Bienvenido al repositorio oficial del proyecto **NetoInsight**. Esta plataforma permite a los proveedores y al personal administrativo de **Tiendas Neto** acceder a increíbles tableros interactivos de BI (Tableau), gestionar inquilinos, perfiles de usuario y seguridad en una moderna _Single Page Application_.

---

## 📖 Sobre el Proyecto

NetoInsight abstrae la complejidad de permisos y licenciamientos de Business Intelligence. Como proveedor, ingresas a una sola plataforma, autenticas tus credenciales (con doble factor de seguridad), e inmediatamente puedes ver, filtrar y descargar visualizaciones dinámicas provenientes originalmente de un servidor Tableau. Todo esto de forma incrustada, segura y con una experiencia de usuario (UI/UX) estilo _Glassmorphism_ premium.

### 🌐 Arquitectura del Sistema

La plataforma está dividida en dos grandes componentes totalmente desacoplados:

1. **[🟢 Frontend (Angular)](./frontend/)**: 
   - Proporciona las interfaces interactivas, validaciones en tiempo real, modales de seguridad (MFA) y formularios asíncronos. 
   - Se comunica con el backend mediante peticiones HTTP firmadas con Tokens JWT provenientes de Google Cloud Identity Platform (Firebase).
   - Lee nuestro [README del Frontend](./frontend/README.md) para más detalles técnicos.

2. **[⚙️ Backend (API REST en Python)](./backend/)**: 
   - Construido sobre **FastAPI**, sirve como el validador final de seguridad y emisor de tickets.
   - Genera dinámicamente _Single-Use JWT Proxies_ firmados con certificados de Servidor Tableau (_Connected Apps_) para garantizar la seguridad de incrustación de manera invisible al usuario.
   - Automatiza tareas como el alta masiva de proveedores (Bulk Imports) y envía notificaciones vía sistema de correos (MailSlurp).
   - Lee nuestro [README del Backend](./backend/README.md) para guías de despliegue y desarrollo local.

---

## 🔒 Modelo de Seguridad y Roles

NetoInsight opera con perfiles delimitados por datos de red (`role: 'provider' | 'admin'`):

- **Admins (Internos Neto)**: Pueden invitar tenants proveedores, forzar seguridad MFA a usuarios cautivos, desactivar cuentas o crear usuarios directos ilimitados. No tienen limitantes de `data-filtering` automáticos en UI (fuerzan vista nacional por defecto de tableros BI si no tienen una región atada).
- **Proveedores (Externos)**: Pueden observar únicamente los tableros Tableau que estén transaccionalmente atados a su propio `proveedorIdInterno`. La API inyecta este Id directamente en el Token de Tableau v3 en tiempo real como filtro infranqueable (RLS).
- **MFA (Autenticación Multifactor)**: El acceso a cuentas de Administrador o Proveedor está protegido con **TOTP (Google Authenticator/Authy)** manejado por Identity Platform.

---

## 🛠️ Entornos de Desarrollo Local

Si deseas contribuir o ejecutar el proyecto en tu máquina local, debes levantar ambos servicios (Front y Back) simultáneamente.

### 1. Requisitos Previos Generales
- [Node.js](https://nodejs.org/) (v18+)
- [Angular CLI](https://v17.angular.io/cli) instalado globalmente (`npm install -g @angular/cli`).
- [Python 3.11+](https://www.python.org/downloads/)

### 2. Levantando el Backend
El backend necesita un entorno virtual de Python para aislar sus dependencias:
```bash
cd backend
python -m venv venv
```
Activa el entorno (en Windows):
```bash
venv\Scripts\activate
```
Instala dependencias y corre el servidor en `localhost` puerto 8000:
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
> 👉 *No olvides configurar tu archivo `.env` o `.json` con credenciales de GCP basándote en el `env.example` interno.*

### 3. Levantando el Frontend
Abre **una nueva terminal**, asegúrate de que el Backend está corriendo y ejecuta:
```bash
cd frontend
npm install
ng serve
```
> 👉 *Abre [http://localhost:4200](http://localhost:4200) en tu navegador. El frontend (por defecto en modo de desarrollo) buscará hablar localmente con el backend en el puerto 8000.*

---

## 🚀 Despliegues y Producción

Este proyecto cuenta con arquitectura orientada a la nube. Sus configuraciones están preparadas para Staging (Pruebas) y Producción (Final).

* **Frontend Hosting**: Servido a través de la CDN global de **Firebase Hosting** (`netoinsight.soyneto.com`).
* **Backend API**: Empaquetado en Docker sin servidor administrado por **Google Cloud Run** (`netoinsight-api-prod`).
* **Autenticación Central**: En **Identity Platform** bajo el Project ID global de Firebase (`netoinsight-fed03`).

Para una guía paso a paso con los comandos en terminal de despliegue _(deployment)_ a ambientes de staging/producción, revisa individualmente la [👉 Guía de Deploy Backend](./backend/README.md#-%-despliegue-en-producci%C3%B3n-cloud-run) y la [👉 Guía de Deploy Frontend](./frontend/README.md#-%-despliegue-en-firebase-hosting).

---

## 📋 Changelog (Últimas Mágicas Añadidas)

- **Seguridad TOTP (MFA)**: Autenticación de 2 pasos forzable por administradores vía la web y aplicable opcionalmente para proveedores nuevos. (Marzo 2026)
- **Importaciones Masivas (Bulk CSV)**: Parseo seguro y veloz en Python con Endpoint de persistencia asíncrona a Firebase para dar de alta decenas de tiendas/proveedores en segundos.
- **Mesa de Ayuda (Ticket UI)**: Diseño inspirado en clientes de chat _(Slack-like)_ con integración de Backend de envíos programados usando MailSlurp API v2.
- **Glassmorphism Experience**: Rediseño general de placeholders visuales (orbs interactivos y pseudo-elementos) durante tiempos de carga en el DOM de iFrames de BI.

---
_Innovación Digital | Tiendas Neto © 2026_

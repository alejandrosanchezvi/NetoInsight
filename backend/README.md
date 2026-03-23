# 🏗️ NetoInsight - API Backend (FastAPI)

Bienvenido a la carpeta backend del proyecto NetoInsight. Este repositorio contiene el código fuente de la **API REST** desarrollada en un stack íntegramente de Python Moderno sobre **FastAPI**. Provee toda la lógica de validación de negocio, proxy transaccional para incrustar de forma segura Dashboards Tableau (mediante Connected Apps) y una capa robusta de manejo de identidades y accesos.

---

## 🚀 Características Principales y Arquitectura

- **Integración Single-Sign-On en Tableau (V3)**: El principal caso de uso. El portal consulta nuestro endpoint de dashboard, el cual genera y emite JWTs (Tokens Web JSON) temporalmente encriptados, verificando la correspondencia exacta de Tenant y Dashboard sin revelar credenciales del Servidor Base al mundo `(*Connected Apps*)`.
- **Firebase Auth (Identity Platform Native)**: Interceptación completa vía Admin SDK del Header `Authorization` HTTPS y gestión asincrónica de CRUD con Firebase Platform (MFA, deshabilitación forzada, consultas de claims).
- **Importaciones Masivas (Bulk CSV)**: Endpoints capaces de parsear registros asíncronos en paralelo para la ingesta global de provedores a bases nosql en Firestore.
- **MailSlurp Integration API**: Manejo de plantillas personalizadas y sistema tipo *"Slack"* para *Help Center* usando correos transaccionales para registro, o tickets de soporte enviados directamente al personal interno.
- **Validación Automática Pydantic**: Manejo tipado de esquemas para requests (basados en OpenAPI estricta e internamente autogenerando documentación Redoc/Swagger).

---

## 🛠️ Stack y Tecnologías Clave

- [FastAPI](https://fastapi.tiangolo.com/) - El núcleo veloz y asíncrono para rutas.
- [Firebase Admin SDK 7+](https://firebase.google.com/docs/admin/setup) - Puente de administración directo a la nube sin requerimientos de red cliente.
- [PyJWT](https://pyjwt.readthedocs.io/) - Encriptación RS256 de Connected Apps.
- [Python 3.11+](https://www.python.org/) - Soporte base con type hints estructurados.
- [Uvicorn](https://www.uvicorn.org/) - Servidor local multihebra (ASGI).

---

## ⚙️ Requisitos y Variables de Entorno Previas

Dile adiós a los `.env` caóticos. Solo tienes que configurar dos cosas en tu máquina (Windows/Linux/Mac):

1. Un **Archivo de Credenciales de Firebase Admin SDK** (típicamente llamado `firebase-credentials.json` o bajado de Google Cloud). Lo puedes situar en la raíz y la variable `FIREBASE_CREDENTIALS_PATH` se conectará a la ruta. Alternativamente, la aplicación acepta fallar la primera para agarrar nativamente el Application Default Credentials si ya estás logueado con `gcloud`.
2. Las **Keys de configuración**. Tienes a mano un `env.example`. Cópialo completo y crea un secreto `.env`:

   ```bash
   cp env.example .env
   ```

   Rellena dentro del archivo los parámetros faltantes del proveedor de Tableau (ClientID, SecretValue, SecretId) y la llave encriptada general de MailSlurp.

---

## 📦 Inicialización y Puesta en Marcha (Local Development)

El proyecto depende de la encapsulación en Python para arrancar. Recomendamos 100% que generes siempre un nuevo entorno virtual.

### 1. Activar el Entorno Local

Posicionado en la consola sobre esta carpeta (`/backend`), crea un enviroment aislado:

```bash
python -m venv venv
```

Activa este ambiente de desarrollo seguro en **Windows**:

```bash
source venv/Scripts/activate
```

_(Si estás en Mac o Linux usa `source venv/bin/activate`)*

### 2. Sincronizar Librerías Externas

Instala los motores, el SDK y FastAPI en tu computadora directamente desde el archivo plano en tan sólo unos clics:

```bash
pip install -r requirements.txt
```

### 3. Levantar Servidor a Modo Test

Para inicializar de forma asíncrona la escucha en tu puerto `8000` con `Hot-Reloading` activo si salvas código:

```bash
uvicorn main:app --reload --port 8000
```

La documentación interactiva de la API (Swagger UI automatizada mediante metadatos) estará disponible mágicamente en ➔ `http://localhost:8000/docs`.

---

## 🚢 Despliegue en Producción (Google Cloud Run)

El backend de NetoInsight está preparado localmente para empaquetarse en un contenedor en la nube **(Docker y GCR)** bajo el servicio de Google Cloud Run. La aplicación escalará sola desde cero nodos según la necesidad.

### Pre-Requisito Despliegue (Auth)

Tu terminal debe tener el cli validado y apuntando al proyecto correcto. Tómate 20s en correr esto la primera vez antes del push:

```bash
gcloud auth login
gcloud config set project [TU_PROJECT_ID]   # (Ej. netoinsight-fed03)
```

### ➔ Despliegue a Modo Staging (Ambiente de Pruebas aisladas)

Esto forzará a la consola a precompilar y subir de golpe tu código bajo el nombre temporal `netoinsight-api-staging`. Al terminar te arrojará una URL segura única que puedes pasarle de API Url base a tu Frontend de pruebas.

```bash
gcloud run deploy netoinsight-api-staging \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project netoinsight-fed03 \
  --service-account=cloud-run-backend-netoinsight@netoinsight-fed03.iam.gserviceaccount.com
```

### ➔ Despliegue a Producción (Ambiente Master)

Idéntico esfuerzo, pero generará una instancia distinta en otro dominio HTTPS `(netoinsight-api-prod)` que le dirá al sistema por Variables Internas que active los sistemas productivos de correo y logs.

```bash
gcloud run deploy netoinsight-api-prod \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project netoinsight-fed03 \
  --update-env-vars="ENVIRONMENT=production" \
  --service-account=cloud-run-backend-netoinsight@netoinsight-fed03.iam.gserviceaccount.com
```

_(Nota: El Frontend debe apuntar en su respectivo archivo `environment.ts` de Angular hacia la URL resultante que devuelva este último comando después de compilar exitosamente)*.

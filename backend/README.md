# 🏗️ NetoInsight — API Backend (FastAPI)

API REST del portal NetoInsight, desarrollada en Python moderno con **FastAPI**. Provee la lógica de negocio, la integración segura con Tableau (Connected Apps), y la gestión de identidades sobre Firebase.

---

## ✨ Características Principales

| Módulo | Descripción |
|---|---|
| **Tableau SSO (V3)** | Genera y emite JWTs firmados con RS256 para incrustar dashboards de forma segura sin exponer credenciales del servidor. |
| **Firebase Admin SDK** | Verifica tokens de sesión (`Authorization: Bearer`), gestiona usuarios y sincroniza claims en Identity Platform. |
| **MailSlurp** | Envío de correos transaccionales (invitaciones, reseteo de contraseña) con plantillas personalizadas. |
| **Importaciones Bulk CSV** | Endpoints asíncronos para ingesta masiva de proveedores hacia Firestore. |
| **Validación Pydantic** | Esquemas OpenAPI estrictos con autodocumentación Swagger/ReDoc en `/docs`. |

---

## 🛠️ Stack Tecnológico

- [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/) (ASGI)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) — Identity Platform
- [PyJWT](https://pyjwt.readthedocs.io/) — Connected Apps RS256
- Python 3.11+

---

## ⚙️ Variables de Entorno

Copia el ejemplo y rellena los valores:

```bash
cp env.example .env
```

| Variable | Descripción |
|---|---|
| `FIREBASE_CREDENTIALS_PATH` | Ruta al JSON de credenciales de Firebase Admin SDK |
| `TABLEAU_SERVER` | URL del servidor Tableau (ej. `https://prod-us-usw2b.online.tableau.com`) |
| `TABLEAU_SITE` | Nombre del sitio Tableau |
| `TABLEAU_CONNECTED_APP_CLIENT_ID` | Client ID de la Connected App |
| `TABLEAU_CONNECTED_APP_SECRET_ID` | Secret ID de la Connected App |
| `TABLEAU_CONNECTED_APP_SECRET_VALUE` | Secret Value de la Connected App |
| `BACKEND_URL` | URL pública del backend |
| `FRONTEND_URL` | URL pública del frontend |
| `MAILSLURP_API_KEY` | Clave de API de MailSlurp |
| `MAILSLURP_INBOX_ID` | ID del inbox remitente |
| `MAILSLURP_FROM_EMAIL` | Correo remitente |
| `ENVIRONMENT` | `development` o `production` |

> **Nota:** Si no cuentas con `firebase-credentials.json` localmente, la app usará automáticamente `Application Default Credentials` (ADC) si ya estás autenticado con `gcloud auth application-default login`.

---

## 🚀 Desarrollo Local

```bash
# 1. Crear y activar entorno virtual
python -m venv venv
source venv/Scripts/activate   # Windows
# source venv/bin/activate     # Mac / Linux

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Levantar servidor con hot-reload
uvicorn main:app --reload --port 8000
```

La documentación Swagger estará disponible en → `http://localhost:8000/docs`

---

## 🚢 Despliegue en Google Cloud Run

### Pre-requisito

```bash
gcloud auth login
gcloud config set project netoinsight-fed03
```

### Staging

```bash
gcloud run deploy netoinsight-api-staging \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project netoinsight-fed03 \
  --service-account=cloud-run-backend-netoinsight@netoinsight-fed03.iam.gserviceaccount.com
```

### Producción

```bash
gcloud run deploy netoinsight-api-prod \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project netoinsight-fed03 \
  --service-account=cloud-run-backend-netoinsight@netoinsight-fed03.iam.gserviceaccount.com
```

> Las variables de entorno de producción se configuran directamente en la consola de **Google Cloud Run → Edit & Deploy New Revision → Variables & Secrets**.

---

## 📁 Estructura del Proyecto

```
backend/
├── main.py                  # Aplicación principal FastAPI
├── app/
│   └── user_management.py   # Endpoints de gestión de usuarios
├── requirements.txt         # Dependencias Python
├── Dockerfile               # Imagen para Cloud Run
├── .env                     # Variables de entorno (NO commitear)
└── firebase-credentials.json  # Credenciales Firebase (NO commitear)
```

---

*NetoInsight · Innovación Digital · Tiendas Neto*

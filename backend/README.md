# 🏗️ NetoInsight - API Backend (FastAPI)

Este es el backend de la plataforma NetoInsight, desarrollado con **FastAPI** y **Python 3.11**. Provee la lógica de negocio, integración con Firebase Authentication, autenticación para tableros de Tableau a través de Connected Apps, y notificaciones de correo mediante MailSlurp.

## 🚀 Características Principales

- **Tableau Embedding V3**: Generación segura de tokens JWT para mostrar tableros de Tableau mediante Connected Apps.
- **Firebase Auth Integration**: Verificación de tokens de sesión y gestión de usuarios a través de Firebase Admin SDK.
- **MailSlurp Integration**: Envío de correos transaccionales para registro, restablecimiento de contraseñas y envío de tickets de soporte.
- **API REST Rápida y Moderna**: Aprovecha las ventajas de tipado estático, validación automática con Pydantic, y la velocidad de FastAPI.

## 🛠️ Tecnologías

- [FastAPI](https://fastapi.tiangolo.com/) - Framework web para construir APIs
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) - Gestión de autenticación
- [PyJWT](https://pyjwt.readthedocs.io/) - Para generar tokens JWT para Tableau
- [MailSlurp](https://www.mailslurp.com/) - Para envíos de correos
- [Uvicorn](https://www.uvicorn.org/) - Servidor ASGI

## ⚙️ Requisitos Previos

- Python 3.9 o superior (Recomendado: 3.11+)
- Credenciales de Firebase (archivo JSON o configuradas a través de Application Default Credentials)
- API Key de MailSlurp

## 📦 Instalación y Configuración

1. **Crear y activar un entorno virtual**:

   ```bash
   python -m venv venv
   source venv/Scripts/activate  # En Windows
   # source venv/bin/activate    # En Linux/Mac
   ```

2. **Instalar dependencias**:

   ```bash
   pip install -r requirements.txt
   ```

3. **Configurar variables de entorno**:
   Copia el archivo `env.example` a `.env` y ajusta los valores necesarios:

   ```bash
   cp env.example .env
   ```

## 🚀 Ejecutar el Servidor en Desarrollo

Para levantar el servidor de desarrollo en el puerto 8000 con recarga automática:

```bash
uvicorn main:app --reload --port 8000
```

La documentación interactiva de la API estará disponible en `http://localhost:8000/docs`.

## 🚢 Despliegue en Producción (Cloud Run)

El backend de NetoInsight está preparado para empaquetarse en un contenedor Docker y desplegarse en **Google Cloud Run**.

1. Asegúrate de tener iniciada sesión en el CLI de Google Cloud:

   ```bash
   gcloud auth login
   gcloud config set project [TU_PROJECT_ID]
   ```

2. **Despliegue a Staging** (Ambiente de pruebas):
   Esto creará un servicio llamado `netoinsight-api-staging` y te dará una URL específica para este ambiente.

   ```bash
   gcloud run deploy netoinsight-api-staging \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --project netoinsight-fed03
   ```

3. **Despliegue a Producción** (Ambiente real):
   Al cambiar el nombre del servicio a `netoinsight-api-prod`, Cloud Run crea un servicio completamente separado con su propia URL. De esta manera, no afectas las pruebas cuando actualizas producción.

   ```bash
   gcloud run deploy netoinsight-api-prod \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --project netoinsight-fed03 \
     --set-env-vars="ENVIRONMENT=production"
   ```

*Nota: Una vez que se complete el despliegue, la terminal te imprimirá una "Service URL" para cada ambiente (ej. `https://netoinsight-api-staging-xxxxxxxx-uc.a.run.app`). Deberás poner la URL de staging dentro del `environment.development.ts` de Angular, y la URL de producción dentro del `environment.ts`.*

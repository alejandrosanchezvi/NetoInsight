# 🚀 NetoInsight - FastAPI Backend (v2.5.0 - TABLEAU PROXY USER FIX)

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import Optional
from app.auth import verify_token
from app.tableau_jwt import generate_tableau_jwt
from app.mailslurp_service import get_mailslurp_service
import logging
import os
from app.config import TABLEAU_SERVER, TABLEAU_SITE

from app.user_management import router as user_management_router
from app.bulk_import import router as bulk_import_router

# ===== FIREBASE ADMIN =====
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

if not firebase_admin._apps:
    try:
        firebase_admin.initialize_app(
            credential=credentials.ApplicationDefault(),
            options={
                "projectId": os.getenv("FIREBASE_PROJECT_ID", "netoinsight-fed03")
            },
        )
        logging.getLogger(__name__).info(
            "✅ [FIREBASE-ADMIN] Initialized — project: netoinsight-fed03"
        )
    except Exception as e:
        logging.getLogger(__name__).error(f"❌ [FIREBASE-ADMIN] Init failed: {e}")

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NetoInsight API",
    version="2.5.0",
    description="API para Tableau + MailSlurp Invitations + User Management + Password Reset",
)

# ===== CORS =====
origins = [
    "http://localhost:4200",
    "https://netoinsight-staging.web.app",
    "https://netoinsight.soyneto.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

if os.getenv("ENVIRONMENT") != "production":

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        logger.info(f"🌐 {request.method} {request.url.path}")
        response = await call_next(request)
        logger.info(f"✅ Status: {response.status_code}")
        return response


app.include_router(user_management_router)
app.include_router(bulk_import_router)

# ===== TABLEAU PROXY USER =====
#
# Tableau Connected App autentica por el campo "sub" del JWT.
# Ese usuario DEBE existir en Tableau Cloud como usuario licenciado.
#
# Los proveedores externos NO son usuarios de Tableau, así que
# usamos un usuario "proxy" que sí existe — el filtro de datos
# por proveedor se aplica en el frontend con la Embedding API v3,
# NO a través de Tableau user permissions.
#
# ⚠️  Cambia este valor si el proxy user cambia en Tableau Cloud.
TABLEAU_PROXY_USER = os.getenv(
    "TABLEAU_PROXY_USER",
    "alejandro.sanchezvi@tiendasneto.com",  # ← único usuario que existe en Tableau
)

# ===== PYDANTIC MODELS =====


class SendInvitationRequest(BaseModel):
    email: EmailStr
    invitation_token: str
    tenant_name: str
    invited_by_name: str
    invited_by_email: EmailStr
    role: str
    expires_at: str
    frontend_url: str


class SendInvitationResponse(BaseModel):
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    sent_at: Optional[str] = None


class PasswordResetRequest(BaseModel):
    email: EmailStr
    frontend_url: str


class PasswordResetResponse(BaseModel):
    success: bool
    message: str
    sent_at: Optional[str] = None


# ===== DASHBOARD MAPPING =====
DASHBOARD_MAP = {
    "categorization": "NexusProveedores/Categorizacin",
    "stores": "NexusProveedores/Tiendas",
    "skus": "NexusProveedores/Skus",
    "stocks": "NexusProveedores/Stocks",
    "purchase-orders": "NexusProveedores/Ocs",
}


def get_dashboard_path(dashboard: str) -> str:
    return DASHBOARD_MAP.get(dashboard, dashboard)


# ===== BASIC ENDPOINTS =====


@app.get("/")
def read_root():
    return {
        "status": "ok",
        "service": "NetoInsight API",
        "version": "2.5.0",
        "features": ["Tableau JWT", "MailSlurp", "User Management", "Password Reset"],
        "environment": os.getenv("ENVIRONMENT", "production"),
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "api_version": "v2.5",
        "mailslurp_enabled": bool(os.getenv("MAILSLURP_API_KEY")),
        "firebase_admin_initialized": bool(firebase_admin._apps),
        "tableau_proxy_user": TABLEAU_PROXY_USER,
        "environment": os.getenv("ENVIRONMENT", "production"),
    }


@app.get("/api/test")
def test_endpoint():
    return {"message": "Backend is working!", "version": "2.5.0"}


# ===== INVITATIONS =====


@app.post("/api/invitations/send-email", response_model=SendInvitationResponse)
async def send_invitation_email(
    request: SendInvitationRequest, user_data: dict = Depends(verify_token)
):
    try:
        try:
            expires_at = datetime.fromisoformat(
                request.expires_at.replace("Z", "+00:00")
            )
        except:
            expires_at = datetime.fromisoformat(request.expires_at)

        mailslurp = get_mailslurp_service()
        result = mailslurp.send_invitation_email(
            email=request.email,
            invitation_token=request.invitation_token,
            tenant_name=request.tenant_name,
            invited_by_name=request.invited_by_name,
            invited_by_email=request.invited_by_email,
            role=request.role,
            expires_at=expires_at,
            frontend_url=request.frontend_url,
        )

        if result["success"]:
            return SendInvitationResponse(
                success=True, message_id=result["message_id"], sent_at=result["sent_at"]
            )
        raise HTTPException(
            status_code=500, detail=f"Error enviando email: {result.get('error')}"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending invitation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== PASSWORD RESET =====


@app.post("/api/auth/send-password-reset", response_model=PasswordResetResponse)
async def send_password_reset(request: PasswordResetRequest):
    GENERIC_RESPONSE = PasswordResetResponse(
        success=True,
        message="Si el email está registrado, recibirás el enlace en breve.",
        sent_at=datetime.utcnow().isoformat(),
    )

    try:
        logger.info(f"🔑 [RESET] Password reset requested for: {request.email}")

        if not firebase_admin._apps:
            logger.error("❌ [RESET] Firebase Admin not initialized")
            raise HTTPException(status_code=500, detail="Error interno del servidor")

        try:
            user_record = firebase_auth.get_user_by_email(request.email)
            logger.info(f"✅ [RESET] User found — UID: {user_record.uid}")
        except firebase_auth.UserNotFoundError:
            logger.info(
                f"🔒 [RESET] User not found (generic response): {request.email}"
            )
            return GENERIC_RESPONSE
        except Exception as e:
            logger.error(
                f"❌ [RESET] get_user_by_email failed — {type(e).__name__}: {str(e)}"
            )
            raise HTTPException(status_code=500, detail="Error verificando usuario")

        action_code_settings = firebase_auth.ActionCodeSettings(
            url=f"{request.frontend_url}/reset-password", handle_code_in_app=False
        )

        try:
            reset_link = firebase_auth.generate_password_reset_link(
                request.email, action_code_settings=action_code_settings
            )
            logger.info(f"✅ [RESET] Reset link generated for: {request.email}")
        except Exception as e:
            logger.error(
                f"❌ [RESET] generate_password_reset_link failed — {type(e).__name__}: {str(e)}"
            )
            raise HTTPException(
                status_code=500, detail="Error generando enlace de reset"
            )

        expires_at = datetime.utcnow() + timedelta(hours=1)
        mailslurp = get_mailslurp_service()
        result = mailslurp.send_password_reset_email(
            email=request.email, reset_url=reset_link, expires_at=expires_at
        )

        if result["success"]:
            logger.info(f"✅ [RESET] Email sent to {request.email}")
            return GENERIC_RESPONSE
        else:
            logger.error(f"❌ [RESET] MailSlurp failed: {result.get('error')}")
            raise HTTPException(status_code=500, detail="Error enviando el email")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [RESET] Unexpected error — {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.get("/api/invitations/verify-mailslurp")
async def verify_mailslurp_connection(user_data: dict = Depends(verify_token)):
    try:
        mailslurp = get_mailslurp_service()
        result = mailslurp.verify_connection()
        if result["success"]:
            return {
                "success": True,
                "inbox_id": result["inbox_id"],
                "email_address": result["email_address"],
            }
        raise HTTPException(
            status_code=500,
            detail=f"MailSlurp connection failed: {result.get('error')}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== TABLEAU =====


@app.get("/api/tableau/embed-url")
async def get_embed_url_v3(dashboard: str, user_data: dict = Depends(verify_token)):
    """
    Genera JWT para Tableau usando un usuario proxy.

    ¿Por qué proxy?
    ───────────────
    Tableau Connected App valida que el "sub" del JWT sea un usuario
    existente y licenciado en Tableau Cloud. Los proveedores externos
    de NetoInsight NO son usuarios de Tableau, así que usarían el
    proxy. El filtro de datos por proveedor se aplica en el frontend
    mediante la Embedding API v3 (applyFilterAsync), NO por permisos
    de Tableau.

    El email real del usuario autenticado se devuelve como metadato
    para que el frontend pueda aplicar el filtro correcto.
    """
    try:
        real_email = user_data.get("email")
        if not real_email:
            raise HTTPException(status_code=400, detail="Email not found in token")

        tenant_name = (
            user_data.get("tenant_name") or user_data.get("tenantName") or "Unknown"
        )

        # ✅ Siempre usar el proxy user para el JWT de Tableau
        jwt_token = generate_tableau_jwt(TABLEAU_PROXY_USER)

        dashboard_path = get_dashboard_path(dashboard)
        embed_url = f"{TABLEAU_SERVER}/t/{TABLEAU_SITE}/views/{dashboard_path}"

        logger.info(
            f"✅ [TABLEAU] embed-url — real_user={real_email} "
            f"proxy={TABLEAU_PROXY_USER} dashboard={dashboard}"
        )

        return {
            "embedUrl": embed_url,
            "jwt": jwt_token,
            "providerName": tenant_name,
            "userEmail": real_email,  # ← para que el frontend sepa quién es
            "proxyUser": TABLEAU_PROXY_USER,
            "success": True,
            "apiVersion": "v3",
        }
    except Exception as e:
        logger.error(f"Error generating embed URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tableau/debug-connected-app")
async def debug_connected_app(user_data: dict = Depends(verify_token)):
    try:
        from app.tableau_jwt import validate_jwt_token, get_tableau_server_info

        server_info = get_tableau_server_info()
        jwt_token = generate_tableau_jwt(TABLEAU_PROXY_USER)
        jwt_validation = validate_jwt_token(jwt_token)
        return {
            "debug_info": {
                "real_user": user_data.get("email"),
                "proxy_user": TABLEAU_PROXY_USER,
                "server_info": server_info,
                "jwt_token": {
                    "generated": True,
                    "length": len(jwt_token),
                    "validation": jwt_validation,
                },
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tableau/test-jwt")
async def test_jwt_generation(user_data: dict = Depends(verify_token)):
    try:
        jwt_token = generate_tableau_jwt(TABLEAU_PROXY_USER)
        return {
            "real_email": user_data.get("email"),
            "proxy_user": TABLEAU_PROXY_USER,
            "jwt_generated": True,
            "jwt_length": len(jwt_token),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tableau/dashboards")
def list_available_dashboards():
    names = {
        "categorization": "Categorización",
        "stores": "Tiendas",
        "skus": "SKUs",
        "stocks": "Stocks",
        "purchase-orders": "Órdenes de Compra",
    }
    return {
        "dashboards": [
            {"key": k, "name": names[k], "path": p} for k, p in DASHBOARD_MAP.items()
        ]
    }

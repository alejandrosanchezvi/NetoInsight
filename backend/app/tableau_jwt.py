# 🔐 NetoInsight - Tableau JWT Generation (FIXED - código 16 resuelto)

import jwt
import uuid
from datetime import datetime, timedelta, timezone
from app.config import (
    TABLEAU_CONNECTED_APP_CLIENT_ID,
    TABLEAU_CONNECTED_APP_SECRET_ID,
    TABLEAU_CONNECTED_APP_SECRET_VALUE,
    TABLEAU_SERVER,
    TABLEAU_SITE
)
import logging

logger = logging.getLogger(__name__)


def generate_tableau_jwt(username: str, scopes=None) -> str:
    """
    Genera un JWT para autenticación con Tableau Connected App.

    Corrección aplicada (error code 16 - INVALID_CREDENTIALS):
    ─────────────────────────────────────────────────────────
    PyJWT fusiona los headers custom con los del payload. Tener "iss"
    tanto en headers como en payload generaba un JWT malformado que
    Tableau rechazaba con 401 / code 16.

    Solución: "iss" SOLO en el payload. Los headers solo llevan
    "kid", "typ" y "alg", que es lo que especifica Tableau.
    ─────────────────────────────────────────────────────────

    Ref: https://help.tableau.com/current/online/en-us/connected_apps_eas.htm
    """
    if scopes is None:
        scopes = [
            "tableau:views:embed",
            "tableau:views:embed_authoring",
            "tableau:metrics:embed",
            "tableau:content:read"
        ]

    try:
        now = datetime.now(timezone.utc)

        # ─── Payload ────────────────────────────────────────────────────
        # Todos los claims van en el payload, incluyendo "iss".
        # "iat" (issued at) es recomendado por Tableau para validación.
        payload = {
            "iss": TABLEAU_CONNECTED_APP_CLIENT_ID,   # ← SOLO aquí
            "sub": username,
            "aud": "tableau",
            "jti": str(uuid.uuid4()),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=10)).timestamp()),
            "scp": scopes,
        }

        # ─── Headers ────────────────────────────────────────────────────
        # "kid" identifica el secreto en Tableau Connected App.
        # NO incluir "iss" aquí — PyJWT lo duplicaría/conflictuaría.
        headers = {
            "kid": TABLEAU_CONNECTED_APP_SECRET_ID,
            "typ": "JWT",
            "alg": "HS256",
        }

        token = jwt.encode(
            payload,
            TABLEAU_CONNECTED_APP_SECRET_VALUE,
            algorithm="HS256",
            headers=headers,
        )

        logger.info(f"✅ [JWT] Generated for: {username}")
        return token

    except Exception as e:
        logger.error(f"❌ [JWT] Error generating token: {e}")
        raise


def validate_jwt_token(jwt_token: str) -> dict:
    """
    Valida la estructura de un JWT (sin verificar firma) — útil para debug.
    """
    try:
        headers = jwt.get_unverified_header(jwt_token)
        payload = jwt.decode(jwt_token, options={"verify_signature": False})

        now = datetime.now(timezone.utc)
        exp_datetime = datetime.fromtimestamp(payload.get("exp", 0), timezone.utc)
        is_expired = now > exp_datetime

        # Verificar que "iss" no esté duplicado en headers (bug anterior)
        iss_in_headers = "iss" in headers
        iss_in_payload = "iss" in payload

        return {
            "valid_structure": True,
            "headers": headers,
            "payload": payload,
            "expired": is_expired,
            "expires_at": exp_datetime.isoformat(),
            "time_remaining": str(exp_datetime - now) if not is_expired else "EXPIRED",
            "debug": {
                "iss_in_headers": iss_in_headers,   # debe ser False
                "iss_in_payload": iss_in_payload,   # debe ser True
                "has_iat": "iat" in payload,         # debe ser True
                "has_kid_in_headers": "kid" in headers,  # debe ser True
            }
        }

    except Exception as e:
        logger.error(f"Error validating JWT: {e}")
        return {"valid_structure": False, "error": str(e)}


def get_tableau_server_info() -> dict:
    """Retorna información del servidor Tableau configurado."""
    return {
        "server": TABLEAU_SERVER,
        "site": TABLEAU_SITE,
        "client_id": TABLEAU_CONNECTED_APP_CLIENT_ID,
        "secret_id": TABLEAU_CONNECTED_APP_SECRET_ID,
        "secret_configured": bool(TABLEAU_CONNECTED_APP_SECRET_VALUE),
        "full_url_base": f"{TABLEAU_SERVER}/t/{TABLEAU_SITE}/views/",
    }
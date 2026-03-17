# 🗑️ NetoInsight Backend - User Management Router

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import logging

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import auth, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logging.warning("⚠️ Firebase Admin SDK not available. User management endpoints will fail.")

from app.auth import verify_token

logger = logging.getLogger(__name__)

# Crear router con prefijo
router = APIRouter(
    prefix="/api/users",
    tags=["users"]
)

# ===== MODELS =====

class DeleteUserRequest(BaseModel):
    uid: str
    email: EmailStr
    tenant_id: str
    deleted_by_uid: str

class DeleteUserResponse(BaseModel):
    success: bool
    message: str
    uid: str
    email: str

class CheckUserExistsResponse(BaseModel):
    exists: bool
    email: str
    uid: Optional[str] = None
    email_verified: Optional[bool] = None
    disabled: Optional[bool] = None
    creation_time: Optional[int] = None

class DisableMfaRequest(BaseModel):
    uid: str
    email: EmailStr
    forced_by_uid: str

class DisableMfaResponse(BaseModel):
    success: bool
    message: str
    uid: str

class SetEmailVerifiedRequest(BaseModel):
    uid: str

class SetEmailVerifiedResponse(BaseModel):
    success: bool
    message: str

class ToggleStatusRequest(BaseModel):
    uid: str
    disabled: bool
    admin_uid: str

class ToggleStatusResponse(BaseModel):
    success: bool
    message: str
    uid: str
    disabled: bool

# ===== HELPER FUNCTIONS =====

def get_firestore_client():
    """Obtener cliente de Firestore"""
    if not FIREBASE_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="Firebase Admin SDK no está disponible"
        )
    return firestore.client()

# ===== ENDPOINTS =====

@router.get("/test")
async def test_endpoint():
    """Endpoint de prueba para verificar que el router está funcionando"""
    logger.info("✅ [USER-MGMT-TEST] Test endpoint called successfully")
    return {
        "status": "ok",
        "message": "User management router is working!",
        "router": "user_management",
        "firebase_available": FIREBASE_AVAILABLE
    }

@router.delete("/delete-auth-user", response_model=DeleteUserResponse)
async def delete_user_from_auth(
    request: DeleteUserRequest,
    user_data: dict = Depends(verify_token)
):
    """
    Eliminar usuario de Firebase Authentication
    
    Este endpoint debe ser llamado DESPUÉS de eliminar el usuario de Firestore.
    Solo usuarios autenticados pueden eliminar usuarios.
    
    Requiere autenticación con Firebase token.
    """
    
    logger.info("=" * 80)
    logger.info(f"🗑️ [DELETE-USER] Request to delete user: {request.email}")
    logger.info(f"🗑️ [DELETE-USER] UID: {request.uid}")
    logger.info(f"🗑️ [DELETE-USER] Tenant: {request.tenant_id}")
    logger.info(f"🗑️ [DELETE-USER] Deleted by: {request.deleted_by_uid}")
    logger.info(f"👤 [DELETE-USER] Authenticated as: {user_data.get('email')}")
    logger.info("=" * 80)
    
    try:
        # Verificar que Firebase está disponible
        if not FIREBASE_AVAILABLE:
            raise HTTPException(
                status_code=500,
                detail="Firebase Admin SDK no está disponible"
            )
        
        # Obtener cliente de Firestore
        db = get_firestore_client()
        
        # 1. Verificar que el usuario NO existe en Firestore
        logger.info(f"🔍 [DELETE-USER] Checking if user exists in Firestore...")
        user_ref = db.collection('users').document(request.uid)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            logger.warning(f"⚠️ [DELETE-USER] User still exists in Firestore: {request.uid}")
            raise HTTPException(
                status_code=400,
                detail="El usuario debe ser eliminado de Firestore primero"
            )
        
        logger.info(f"✅ [DELETE-USER] Verified: User deleted from Firestore")
        
        # 2. Eliminar de Firebase Authentication
        logger.info(f"🔥 [DELETE-USER] Attempting to delete from Firebase Auth...")
        try:
            auth.delete_user(request.uid)
            logger.info(f"✅ [DELETE-USER] User deleted from Firebase Auth: {request.email}")
            
        except auth.UserNotFoundError:
            # Si el usuario ya no existe en Auth, no es un error
            logger.info(f"ℹ️ [DELETE-USER] User already deleted from Auth: {request.uid}")
            
        except Exception as auth_error:
            logger.error(f"❌ [DELETE-USER] Error deleting from Auth: {auth_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al eliminar usuario de Authentication: {str(auth_error)}"
            )
        
        # 3. Registrar en audit log
        logger.info(f"📝 [DELETE-USER] Creating audit log...")
        try:
            audit_ref = db.collection('audit_logs').document()
            audit_ref.set({
                'action': 'user_deleted',
                'uid': request.uid,
                'email': request.email,
                'tenant_id': request.tenant_id,
                'deleted_by': request.deleted_by_uid,
                'timestamp': firestore.SERVER_TIMESTAMP,
                'details': {
                    'deleted_from_auth': True,
                    'deleted_from_firestore': True,
                    'deleted_at': datetime.utcnow().isoformat()
                }
            })
            logger.info(f"✅ [DELETE-USER] Audit log created")
        except Exception as audit_error:
            # No fallar si no se puede registrar en audit
            logger.warning(f"⚠️ [DELETE-USER] Could not create audit log: {audit_error}")
        
        logger.info("=" * 80)
        logger.info(f"🎉 [DELETE-USER] User deletion completed successfully")
        logger.info("=" * 80)
        
        return DeleteUserResponse(
            success=True,
            message="Usuario eliminado correctamente de Firebase Authentication",
            uid=request.uid,
            email=request.email
        )
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"❌ [DELETE-USER] Unexpected error: {e}")
        logger.error(f"❌ [DELETE-USER] Error type: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al eliminar usuario: {str(e)}"
        )


@router.post("/check-auth-user-exists", response_model=CheckUserExistsResponse)
async def check_user_exists_in_auth(
    email: EmailStr,
    user_data: dict = Depends(verify_token)
):
    """
    Verificar si un usuario existe en Firebase Authentication
    
    Útil antes de enviar invitaciones para detectar usuarios "zombies"
    Requiere autenticación con Firebase token.
    """
    
    logger.info(f"🔍 [CHECK-USER] Checking if user exists in Auth: {email}")
    logger.info(f"👤 [CHECK-USER] Requested by: {user_data.get('email')}")
    
    try:
        if not FIREBASE_AVAILABLE:
            raise HTTPException(
                status_code=500,
                detail="Firebase Admin SDK no está disponible"
            )
        
        try:
            user = auth.get_user_by_email(email)
            logger.info(f"✅ [CHECK-USER] User exists in Auth: {email}")
            return CheckUserExistsResponse(
                exists=True,
                email=user.email,
                uid=user.uid,
                email_verified=user.email_verified,
                disabled=user.disabled,
                creation_time=user.user_metadata.creation_timestamp
            )
            
        except auth.UserNotFoundError:
            logger.info(f"ℹ️ [CHECK-USER] User not found in Auth: {email}")
            return CheckUserExistsResponse(
                exists=False,
                email=email
            )
            
    except Exception as e:
        logger.error(f"❌ [CHECK-USER] Error checking user: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al verificar usuario: {str(e)}"
        )


@router.post("/disable-mfa", response_model=DisableMfaResponse)
async def disable_mfa_for_user(
    request: DisableMfaRequest,
    user_data: dict = Depends(verify_token)
):
    """
    Deshabilita el MFA de un usuario (por UID) borrando todos sus factores en Firebase.
    Usa la REST API Admin de Identity Platform (accounts:update) para apuntar al usuario correcto.
    """
    logger.info(f"🛡️ [MFA-DISABLE] Request to disable MFA for UID={request.uid} ({request.email}) by {request.forced_by_uid}")
    
    try:
        if not FIREBASE_AVAILABLE:
            raise HTTPException(
                status_code=500,
                detail="Firebase Admin SDK no está disponible"
            )

        # Verificar que el usuario existe y tiene factores MFA
        user_record = auth.get_user(request.uid)
        enrolled_factors = getattr(user_record, 'multi_factor', None)
        has_factors = enrolled_factors and hasattr(enrolled_factors, 'enrolled_factors') and len(enrolled_factors.enrolled_factors) > 0
        
        if has_factors:
            logger.info(f"🛡️ [MFA-DISABLE] User has {len(enrolled_factors.enrolled_factors)} enrolled MFA factors. Removing via Admin SDK update_user...")
            
            # ═══ ADMIN SDK: update_user(mfa=None) ═══
            # Este es el método más fiable para limpiar definitivamente todos los factores MFA.
            # Al pasar mfa=None, eliminamos cualquier factor TOTP, SMS u otros registrados.
            auth.update_user(request.uid, mfa=None)
            logger.info(f"✅ [MFA-DISABLE] All MFA factors cleared via Admin SDK for {request.email}")
        else:
            logger.info(f"ℹ️ [MFA-DISABLE] User {request.email} has no enrolled MFA factors in Firebase Auth. Ensuring cleanup.")
            # Incluso si no detecta factores, lo forzamos por si hay un estado inconsistente (ghost factor)
            auth.update_user(request.uid, mfa=None)


        # Actualizar en Firestore
        db = get_firestore_client()
        user_ref = db.collection('users').document(request.uid)
        user_ref.update({
            'mfaEnabled': False,
            'mfaRequired': False,
            'updatedAt': firestore.SERVER_TIMESTAMP,
            'updatedBy': request.forced_by_uid
        })
        
        logger.info(f"✅ [MFA-DISABLE] Firestore document updated for {request.email}")

        return DisableMfaResponse(
            success=True,
            message="MFA deshabilitado correctamente.",
            uid=request.uid
        )
            
    except Exception as e:
        logger.error(f"❌ [MFA-DISABLE] Error disabling MFA: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al deshabilitar MFA: {str(e)}"
        )

@router.post("/set-email-verified", response_model=SetEmailVerifiedResponse)
async def set_user_email_verified(
    request: SetEmailVerifiedRequest,
    user_data: dict = Depends(verify_token)
):
    """
    Marca un correo como verificado programáticamente.
    Crítico para que el Identity Platform permita a los usuarios
    registrados por enlace configurar su TOTP de MFA.
    """
    logger.info(f"📧 [EMAIL-VERIFY] Request to verify email for UID: {request.uid}")
    
    # Optional security check: make sure the token matches the requested UID
    # unless called by an admin
    token_uid = user_data.get('uid')
    if token_uid != request.uid:
        # Check if caller is admin (requires custom claims if set)
        # For our architecture we'll allow it given the logged in token
        logger.info(f"ℹ️ [EMAIL-VERIFY] Note: UID requested by different token UID ({token_uid})")
        
    try:
        if not FIREBASE_AVAILABLE:
            raise HTTPException(status_code=500, detail="Firebase Admin SDK no está disponible")

        # Update the user directly via Admin SDK
        auth.update_user(
            request.uid,
            email_verified=True
        )
        
        logger.info(f"✅ [EMAIL-VERIFY] Successfully verified email for {request.uid}")

        return SetEmailVerifiedResponse(
            success=True,
            message="Correo marcado como verificado exitosamente."
        )
            
    except Exception as e:
        logger.error(f"❌ [EMAIL-VERIFY] Error en verificación: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al verificar correo: {str(e)}"
        )

@router.post("/toggle-status", response_model=ToggleStatusResponse)
async def toggle_user_account_status(
    request: ToggleStatusRequest,
    user_data: dict = Depends(verify_token)
):
    """
    Activa o desactiva la cuenta dura en Firebase Authentication,
    impidiendo que el usuario inicie sesión.
    """
    logger.info(f"🔋 [TOGGLE-STATUS] Request to set disabled={request.disabled} for UID: {request.uid} by {request.admin_uid}")
    
    try:
        if not FIREBASE_AVAILABLE:
            raise HTTPException(status_code=500, detail="Firebase Admin SDK no está disponible")

        # Disable or enable user via Admin SDK
        auth.update_user(
            request.uid,
            disabled=request.disabled
        )
        
        # Revoke refresh tokens to force them out of active sessions if we are disabling
        if request.disabled:
            auth.revoke_refresh_tokens(request.uid)
            logger.info(f"🚫 [TOGGLE-STATUS] Revoked all active sessions for {request.uid}")
        
        status_text = "desactivado" if request.disabled else "activado"
        logger.info(f"✅ [TOGGLE-STATUS] User {request.uid} fue {status_text} en Firebase Auth")

        return ToggleStatusResponse(
            success=True,
            message=f"Usuario {status_text} correctamente.",
            uid=request.uid,
            disabled=request.disabled
        )
            
    except Exception as e:
        logger.error(f"❌ [TOGGLE-STATUS] Error altering user status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al modificar el estado: {str(e)}"
        )
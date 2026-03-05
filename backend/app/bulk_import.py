# NetoInsight Backend - Bulk Tenant Import Router
# Archivo: backend/app/bulk_import.py
#
# Agregar al main.py:
#   from app.bulk_import import router as bulk_import_router
#   app.include_router(bulk_import_router)
#
# Endpoint: POST /api/admin/tenants/bulk-import
# Solo accesible con token de usuario INTERNO (isInternal = true en Firestore)

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime, timedelta
from firebase_admin import firestore
import logging
import re

from app.auth import verify_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ---------------------------------------------------------------
#  MODELS
# ---------------------------------------------------------------


class TenantImportRow(BaseModel):
    """Un proveedor a importar"""

    proveedorIdInterno: str  # requerido - ej. "1000017"
    name: str  # requerido - razon social corta
    plan: str = "starter"  # trial|starter|pro|enterprise
    adminEmail: EmailStr  # requerido
    legalName: Optional[str] = None
    rfc: Optional[str] = None
    billingEmail: Optional[EmailStr] = None
    subscriptionDuration: Optional[str] = None  # "1y"|"6m"|"3m"|"30d"|None

    @validator("plan")
    def validate_plan(cls, v):
        allowed = {"trial", "starter", "pro", "enterprise"}
        if v not in allowed:
            raise ValueError(f"plan debe ser uno de: {allowed}")
        return v

    @validator("subscriptionDuration")
    def validate_duration(cls, v):
        if v is None:
            return v
        allowed = {"1y", "6m", "3m", "30d"}
        if v not in allowed:
            raise ValueError(f"subscriptionDuration debe ser uno de: {allowed} o null")
        return v

    @validator("rfc")
    def validate_rfc(cls, v):
        if v is None:
            return v
        pattern = r"^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$"
        if not re.match(pattern, v.upper()):
            raise ValueError(f"RFC invalido: {v}")
        return v.upper()


class BulkImportRequest(BaseModel):
    tenants: List[TenantImportRow]
    dry_run: bool = False  # True = solo valida, no escribe


class TenantImportResult(BaseModel):
    proveedorIdInterno: str
    name: str
    status: str  # "created" | "skipped" | "error"
    tenantId: Optional[str] = None
    message: Optional[str] = None


class BulkImportResponse(BaseModel):
    success: bool
    dry_run: bool
    total: int
    created: int
    skipped: int
    errors: int
    results: List[TenantImportResult]


# ---------------------------------------------------------------
#  HELPERS
# ---------------------------------------------------------------

PLAN_LICENSES = {
    "trial": 1,
    "starter": 1,
    "pro": 3,
    "enterprise": 5,
}

DURATION_DAYS = {
    "1y": 365,
    "6m": 180,
    "3m": 90,
    "30d": 30,
}


def calculate_subscription_end(duration: Optional[str]) -> Optional[datetime]:
    if not duration:
        return None
    days = DURATION_DAYS.get(duration)
    if not days:
        return None
    return datetime.utcnow() + timedelta(days=days)


def build_tenant_id(name: str) -> str:
    """Genera tenantId desde el nombre (igual que el frontend)"""
    clean = re.sub(r"\s+", "-", name.strip().lower())
    clean = re.sub(r"[^a-z0-9\-]", "", clean)
    return f"tenant-{clean}"


def build_tableau_group(name: str) -> str:
    clean_name = re.sub(r"\s+", "_", name.strip())
    return f"{clean_name}_Viewers"


def build_bq_dataset(name: str) -> str:
    clean_name = re.sub(r"\s+", "_", name.strip().lower())
    return f"proveedores_{clean_name}"


def build_bq_filter(proveedor_id: str) -> str:
    return f"proveedor_id = '{proveedor_id}'"


def is_internal_user(user_data: dict, db) -> bool:
    """Verifica en Firestore que el usuario sea INTERNAL"""
    uid = user_data.get("uid")
    if not uid:
        return False
    try:
        user_doc = db.collection("users").document(uid).get()
        if not user_doc.exists:
            return False
        data = user_doc.to_dict()
        return data.get("role") == "internal" or data.get("isInternal") == True
    except Exception as e:
        logger.error(f"[BULK] Error verificando permisos: {e}")
        return False


# ---------------------------------------------------------------
#  ENDPOINT
# ---------------------------------------------------------------


@router.post("/tenants/bulk-import", response_model=BulkImportResponse)
async def bulk_import_tenants(
    request: BulkImportRequest, user_data: dict = Depends(verify_token)
):
    """
    Carga masiva de proveedores.

    - Solo usuarios INTERNOS pueden usar este endpoint.
    - dry_run=true valida todo sin escribir a Firestore.
    - Idempotente: si el proveedorIdInterno ya existe, lo omite (no sobreescribe).
    - Hasta 200 tenants por llamada.
    """
    db = firestore.client()

    # -- Verificar que el usuario es interno ---------------------
    if not is_internal_user(user_data, db):
        raise HTTPException(
            status_code=403,
            detail="Solo usuarios internos de Neto pueden usar la importacion masiva.",
        )

    if len(request.tenants) > 200:
        raise HTTPException(
            status_code=400, detail="Maximo 200 tenants por llamada. Divide en lotes."
        )

    logger.info(
        f"[BULK] {'DRY RUN' if request.dry_run else 'IMPORTANDO'} "
        f"{len(request.tenants)} tenants - solicitado por {user_data.get('email')}"
    )

    results: List[TenantImportResult] = []
    created = skipped = errors = 0

    # -- Cargar IDs existentes para chequeo rapido ----------------
    existing_ids: set = set()
    try:
        existing_snap = db.collection("tenants").stream()
        for doc in existing_snap:
            data = doc.to_dict()
            pid = data.get("proveedorIdInterno")
            if pid:
                existing_ids.add(str(pid))
    except Exception as e:
        logger.error(f"[BULK] Error leyendo tenants existentes: {e}")
        raise HTTPException(status_code=500, detail=f"Error consultando Firestore: {e}")

    # -- Procesar cada fila ---------------------------------------
    for row in request.tenants:
        pid = str(row.proveedorIdInterno).strip()

        # Verificar duplicado
        if pid in existing_ids:
            logger.info(f"[BULK] Omitiendo {pid} - ya existe")
            results.append(
                TenantImportResult(
                    proveedorIdInterno=pid,
                    name=row.name,
                    status="skipped",
                    message=f"proveedorIdInterno '{pid}' ya existe en Firestore",
                )
            )
            skipped += 1
            continue

        tenant_id = build_tenant_id(row.name)
        plan = row.plan
        max_lic = PLAN_LICENSES.get(plan, 3)
        sub_end = calculate_subscription_end(row.subscriptionDuration)

        # Si es trial sin duracion especificada, asignar 30 dias
        if plan == "trial" and row.subscriptionDuration is None:
            sub_end = calculate_subscription_end("30d")

        tenant_data = {
            "tenantId": tenant_id,
            "proveedorIdInterno": pid,
            "name": row.name.strip(),
            "legalName": row.legalName or row.name.strip(),
            "plan": plan,
            "maxLicenses": max_lic,
            "usedLicenses": 0,
            "isActive": True,
            "features": {
                "dashboards": ["categorization", "skus", "stocks", "purchase-orders"],
                "exports": True,
                "api": plan == "enterprise",
                "customReports": plan == "enterprise",
            },
            "tableauGroup": build_tableau_group(row.name),
            "bigQueryDataset": build_bq_dataset(row.name),
            "bigQueryFilter": build_bq_filter(pid),
            "adminEmail": str(row.adminEmail),
            "createdAt": firestore.SERVER_TIMESTAMP,
            "createdBy": user_data.get("uid", "bulk-import"),
        }

        # Campos opcionales
        if row.rfc:
            tenant_data["rfc"] = row.rfc
        if row.billingEmail:
            tenant_data["billingEmail"] = str(row.billingEmail)
        if row.subscriptionDuration:
            tenant_data["subscriptionDuration"] = row.subscriptionDuration
        if sub_end:
            tenant_data["subscriptionEnd"] = sub_end
        if plan == "trial" and sub_end:
            tenant_data["trialEndsAt"] = sub_end

        if request.dry_run:
            # Solo reportar lo que se crearia
            results.append(
                TenantImportResult(
                    proveedorIdInterno=pid,
                    name=row.name,
                    status="created",
                    tenantId=tenant_id,
                    message="(dry_run - no escrito)",
                )
            )
            created += 1
            existing_ids.add(pid)  # evitar duplicados dentro del mismo lote
            continue

        # Escribir a Firestore
        try:
            tenant_ref = db.collection("tenants").document(tenant_id)

            # Verificar que el tenantId tampoco exista
            if tenant_ref.get().exists:
                results.append(
                    TenantImportResult(
                        proveedorIdInterno=pid,
                        name=row.name,
                        status="skipped",
                        tenantId=tenant_id,
                        message=f"tenantId '{tenant_id}' ya existe (nombre duplicado)",
                    )
                )
                skipped += 1
                continue

            tenant_ref.set(tenant_data)
            existing_ids.add(pid)

            logger.info(f"[BULK] Creado: {tenant_id} ({pid})")
            results.append(
                TenantImportResult(
                    proveedorIdInterno=pid,
                    name=row.name,
                    status="created",
                    tenantId=tenant_id,
                )
            )
            created += 1

        except Exception as e:
            logger.error(f"[BULK] Error creando {pid}: {e}")
            results.append(
                TenantImportResult(
                    proveedorIdInterno=pid,
                    name=row.name,
                    status="error",
                    message=str(e),
                )
            )
            errors += 1

    logger.info(
        f"[BULK] Completado - creados:{created} omitidos:{skipped} errores:{errors}"
    )

    return BulkImportResponse(
        success=errors == 0,
        dry_run=request.dry_run,
        total=len(request.tenants),
        created=created,
        skipped=skipped,
        errors=errors,
        results=results,
    )

"""
NetoInsight — Script de migración Firestore (Tarea 2)
=====================================================
Ejecutar desde la carpeta backend/:
    python migrate_tenants.py

Acciones:
  1. Corrige emails placeholder en tenants existentes (excepto BIMBO, NESTLE, KELLOGG)
  2. Asigna plan=trial + subscriptionEnd (hoy+30d) a los que no tienen licencia/fecha
  3. Crea los 14 tenants faltantes (12 trial + 2 sin vencimiento)
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta, timezone
import sys

# ─────────────────────────────────────────────────────────────
# Inicialización Firebase
# ─────────────────────────────────────────────────────────────
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={"projectId": "netoinsight-fed03"})

db = firestore.client()

NOW = datetime.now(timezone.utc)
TRIAL_END = NOW + timedelta(days=30)

# ─────────────────────────────────────────────────────────────
# Proveedores protegidos — ya tienen invitación enviada
# ─────────────────────────────────────────────────────────────
PROTECTED = {"1000007", "1000062", "1000594"}  # BIMBO, NESTLE, KELLOGG

# ─────────────────────────────────────────────────────────────
# 1. Corrección de emails en tenants existentes
# ─────────────────────────────────────────────────────────────
EMAIL_FIXES = {
    "1000006": "margarita.montes@grupobimbo.com",
    "1000016": "sergio_velazquez@colpal.com",
    "1000017": "samantha.mendez@grupolala.com",
    "1000023": "Jennifer.CASTANEDA@danone.com",
    "1000035": "apnunez@aceitera.com.mx",
    "1000082": "n.garcia@alceda.com.mx",
    "1000093": "carlos.molina@alpura.com",
    "1000260": "Emilia.SanchezHidalgo@pepsico.com",
    "1000627": "bily.coba@grupocmg.com.mx",
    "1000636": "ymiranda@sasil.mx",
    "1000654": "carlosalfonso@target-media.com.mx",
    "1000658": "jose.de.jesus.marquez.gastelum@essity.com",
    "1000710": "abastecedoradehuevo@hotmail.com",
    "1000771": "asoriano@sym.com.mx",
    "1000884": "glopez@promexa.com.mx",
    "1000916": "hector.rodriguez@genommalab.com",
    "1000942": "rcazalez@bqpharma.mx",
    "2000171": "jose.orozco@apecsa.mx",
}

# ─────────────────────────────────────────────────────────────
# 2. Tenants existentes que pasan a trial
#    (plan='starter' sin subscriptionEnd → trial con 30 días)
#    Excluye: sin-vencimiento y protegidos
# ─────────────────────────────────────────────────────────────
SIN_VENCIMIENTO_IDS = {
    "1000016",  # COLGATE       — Sí + Ene 2027
    "1000658",  # ESSITY        — Sí + Nov 2026
    "1000916",  # GENOMA LAB    — Sí + Nov 2026
    "1000942",  # BQ PHARMA     — Sí + Nov 2026
    "1001011",  # KIMBERLY CLARK — Sí + Nov 2026 (sin correo aún, pero sin vencimiento)
}

# Existentes que van a trial (tienen correo real, no están protegidos ni son sin-vencimiento)
TRIAL_UPDATES = {
    "1000006",  # BARCEL
    "1000017",  # LALA
    "1000023",  # DANONE
    "1000035",  # ACEITERA
    "1000082",  # ALCEDA
    "1000093",  # ALPURA
    "1000260",  # PEPSICO
    "1000581",  # RAGASA         (sin correo real pero existe en Firestore)
    "1000627",  # MAYORISTA GOLFO
    "1000636",  # SASIL
    "1000654",  # TARGET MEDIA
    "1000670",  # XSANT          (sin correo real)
    "1000696",  # CAMPO FRESCO   (sin correo real)
    "1000710",  # HUEVO SURESTE
    "1000771",  # SANCHEZ MARTIN
    "1000778",  # POTOSI         (sin correo real)
    "1000818",  # VELALUZ        (sin correo real)
    "1000819",  # ALPHALAB       (sin correo real)
    "1000825",  # BENEFITS       (sin correo real)
    "1000847",  # T TAIO         (sin correo real)
    "1000884",  # MEXICANA ARROZ
    "1000936",  # NOR VER        (sin correo real)
    "1000966",  # INDW TRADING   (sin correo real)
    "1000976",  # NITRAM         (sin correo real)
    "1001010",  # SC JOHNSON     (sin correo real)
    "1001013",  # LA ANITA       (sin correo real)
    "2000171",  # EL CALVARIO
    "2000341",  # ERSA PACK      (sin correo real)
}

# ─────────────────────────────────────────────────────────────
# 3. Tenants nuevos a crear
# ─────────────────────────────────────────────────────────────
FEATURES_DEFAULT = {
    "dashboards": ["categorization", "skus", "stocks", "purchase-orders"],
    "exports": True,
    "api": False,
    "customReports": False,
    "canDownloadClosedMonth": False,
}

NEW_TENANTS_TRIAL = [
    {
        "tenantId": "tenant-cereales-pastas",
        "proveedorIdInterno": "1000013",
        "name": "CEREALES Y PASTAS",
        "legalName": "CEREALES Y PASTAS, S.A. DE C.V.",
        "adminEmail": "rgavina@goldenfoods.mx",
        "tableauGroup": "CEREALES_PASTAS_Viewers",
        "bigQueryDataset": "proveedores_cereales_pastas",
        "bigQueryFilter": "proveedor_id = '1000013'",
    },
    {
        "tenantId": "tenant-chachitos",
        "proveedorIdInterno": "1000189",
        "name": "CHACHITOS",
        "legalName": "PRODUCTOS CHACHITOS SA DE CV",
        "adminEmail": "rrivas@chachitos.com.mx",
        "tableauGroup": "CHACHITOS_Viewers",
        "bigQueryDataset": "proveedores_chachitos",
        "bigQueryFilter": "proveedor_id = '1000189'",
    },
    {
        "tenantId": "tenant-molisaba",
        "proveedorIdInterno": "1000207",
        "name": "MOLISABA",
        "legalName": "PASTAS MOLISABA S.A DE C.V",
        "adminEmail": "raymundo.sotelo@grupoharinas.mx",
        "tableauGroup": "MOLISABA_Viewers",
        "bigQueryDataset": "proveedores_molisaba",
        "bigQueryFilter": "proveedor_id = '1000207'",
    },
    {
        "tenantId": "tenant-rosaleda",
        "proveedorIdInterno": "1000281",
        "name": "LA ROSALEDA",
        "legalName": "MOLINO LA ROSALEDA S.A DE C.V",
        "adminEmail": "cxcautoservicios@larosaleda.com.mx",
        "tableauGroup": "ROSALEDA_Viewers",
        "bigQueryDataset": "proveedores_rosaleda",
        "bigQueryFilter": "proveedor_id = '1000281'",
    },
    {
        "tenantId": "tenant-la-moderna",
        "proveedorIdInterno": "1000283",
        "name": "LA MODERNA",
        "legalName": "PRODUCTOS ALIMENTICIOS LA MODERNA S.A DE C.V",
        "adminEmail": "manuel.castillo@lamoderna.com.mx",
        "tableauGroup": "LA_MODERNA_Viewers",
        "bigQueryDataset": "proveedores_la_moderna",
        "bigQueryFilter": "proveedor_id = '1000283'",
    },
    {
        "tenantId": "tenant-macma",
        "proveedorIdInterno": "1000551",
        "name": "MACMA",
        "legalName": "COMERCIALIZADORA MACMA SAPI DE CV",
        "adminEmail": "bramirez@macma.mx",
        "tableauGroup": "MACMA_Viewers",
        "bigQueryDataset": "proveedores_macma",
        "bigQueryFilter": "proveedor_id = '1000551'",
    },
    {
        "tenantId": "tenant-cuetara",
        "proveedorIdInterno": "1000570",
        "name": "CUETARA",
        "legalName": "CUETARA DISTRIBUCION SA DE CV",
        "adminEmail": "jenny.sanchez@gcuetara.com.mx",
        "tableauGroup": "CUETARA_Viewers",
        "bigQueryDataset": "proveedores_cuetara",
        "bigQueryFilter": "proveedor_id = '1000570'",
    },
    {
        "tenantId": "tenant-harina",
        "proveedorIdInterno": "1000709",
        "name": "PRODUCTOS DE HARINA",
        "legalName": "PRODUCTOS DE HARINA SA DE CV",
        "adminEmail": "eddy.sansores@galletasdonde.com",
        "tableauGroup": "HARINA_Viewers",
        "bigQueryDataset": "proveedores_harina",
        "bigQueryFilter": "proveedor_id = '1000709'",
    },
    {
        "tenantId": "tenant-chocolatera-nayarit",
        "proveedorIdInterno": "1000731",
        "name": "CHOCOLATERA NAYARIT",
        "legalName": "CHOCOLATERA NAYARIT SA DE CV",
        "adminEmail": "alan@chocolateradenayarit.com",
        "tableauGroup": "CHOCOLATERA_NAYARIT_Viewers",
        "bigQueryDataset": "proveedores_chocolatera_nayarit",
        "bigQueryFilter": "proveedor_id = '1000731'",
    },
    {
        "tenantId": "tenant-cafinco",
        "proveedorIdInterno": "1000811",
        "name": "CAFINCO",
        "legalName": "CAFINCO SA DE CV",
        "adminEmail": "aolmedo@cafinco.com",
        "tableauGroup": "CAFINCO_Viewers",
        "bigQueryDataset": "proveedores_cafinco",
        "bigQueryFilter": "proveedor_id = '1000811'",
    },
    {
        "tenantId": "tenant-minsa",
        "proveedorIdInterno": "1000830",
        "name": "MINSA",
        "legalName": "MINSA COMERCIAL SA DE CV",
        "adminEmail": "israel.gomez@minsa.com.mx",
        "tableauGroup": "MINSA_Viewers",
        "bigQueryDataset": "proveedores_minsa",
        "bigQueryFilter": "proveedor_id = '1000830'",
    },
    {
        "tenantId": "tenant-calzan",
        "proveedorIdInterno": "1000950",
        "name": "CALZAN",
        "legalName": "DISTRIBUCIONES CALZAN",
        "adminEmail": "jackievaldez@mexcorina.com",
        "tableauGroup": "CALZAN_Viewers",
        "bigQueryDataset": "proveedores_calzan",
        "bigQueryFilter": "proveedor_id = '1000950'",
    },
]

NEW_TENANTS_SIN_VENCIMIENTO = [
    {
        "tenantId": "tenant-absormex",
        "proveedorIdInterno": "70001106",
        "name": "ABSORMEX",
        "legalName": "ABSORMEX CMPC TISSUE SA DE CV",
        "adminEmail": "andres.martinez.n@softys.com",
        "tableauGroup": "ABSORMEX_Viewers",
        "bigQueryDataset": "proveedores_absormex",
        "bigQueryFilter": "proveedor_id = '70001106'",
    },
    {
        "tenantId": "tenant-operadora-grit",
        "proveedorIdInterno": "709803",
        "name": "OPERADORA GRIT",
        "legalName": "OPERADORA GRIT SOCIEDAD ANONIMA DE CAPITAL VARIABLE",
        "adminEmail": "m.sevilla@operadoragrit.com",
        "tableauGroup": "OPERADORA_GRIT_Viewers",
        "bigQueryDataset": "proveedores_operadora_grit",
        "bigQueryFilter": "proveedor_id = '709803'",
    },
]

# ─────────────────────────────────────────────────────────────
# EJECUCIÓN
# ─────────────────────────────────────────────────────────────


def run(dry_run=True):
    label = "[DRY RUN]" if dry_run else "[REAL]"
    errors = []
    print(f"\n{'='*60}")
    print(f"  MIGRACIÓN TENANTS {label}")
    print(f"  {NOW.strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{'='*60}\n")

    tenants_ref = db.collection("tenants")

    # ── PASO 1: Corregir emails ──────────────────────────────
    print("📧 PASO 1 — Corrigiendo emails placeholder...\n")
    for proveedor_id, new_email in EMAIL_FIXES.items():
        if proveedor_id in PROTECTED:
            print(f"  🔒 SKIP {proveedor_id} (protegido)")
            continue
        try:
            docs = (
                tenants_ref.where("proveedorIdInterno", "==", proveedor_id)
                .limit(1)
                .stream()
            )
            doc = next(docs, None)
            if not doc:
                print(f"  ⚠️  {proveedor_id} no encontrado en Firestore")
                continue
            current = doc.to_dict().get("adminEmail", "")
            if "admin@" in current.lower() or current in [
                "alejandro.sanchezvi@tiendasnetows.com",
                "alejandro.sanchezvi@tiendasneto.com",
            ]:
                if not dry_run:
                    tenants_ref.document(doc.id).update({"adminEmail": new_email})
                print(
                    f"  ✅ {proveedor_id} {doc.to_dict().get('name',''):20} {current} → {new_email}"
                )
            else:
                print(
                    f"  ➡️  {proveedor_id} {doc.to_dict().get('name',''):20} ya tiene email real: {current}"
                )
        except Exception as e:
            errors.append(f"email {proveedor_id}: {e}")
            print(f"  ❌ {proveedor_id}: {e}")

    # ── PASO 2: Asignar trial a existentes ───────────────────
    print(
        f"\n⏱  PASO 2 — Asignando trial a existentes (fin: {TRIAL_END.strftime('%Y-%m-%d')})...\n"
    )
    for proveedor_id in TRIAL_UPDATES:
        try:
            docs = (
                tenants_ref.where("proveedorIdInterno", "==", proveedor_id)
                .limit(1)
                .stream()
            )
            doc = next(docs, None)
            if not doc:
                print(f"  ⚠️  {proveedor_id} no encontrado")
                continue
            data = doc.to_dict()
            if data.get("plan") == "trial":
                print(f"  ➡️  {proveedor_id} {data.get('name',''):20} ya es trial")
                continue
            if not dry_run:
                tenants_ref.document(doc.id).update(
                    {
                        "plan": "trial",
                        "subscriptionEnd": TRIAL_END,
                        "subscriptionDuration": "30d",
                        "trialEndsAt": TRIAL_END,
                    }
                )
            print(
                f"  ✅ {proveedor_id} {data.get('name',''):20} → plan=trial, fin={TRIAL_END.strftime('%Y-%m-%d')}"
            )
        except Exception as e:
            errors.append(f"trial {proveedor_id}: {e}")
            print(f"  ❌ {proveedor_id}: {e}")

    # ── PASO 3: Crear tenants trial faltantes ────────────────
    print(f"\n🆕 PASO 3 — Creando {len(NEW_TENANTS_TRIAL)} tenants trial nuevos...\n")
    for t in NEW_TENANTS_TRIAL:
        try:
            existing = tenants_ref.document(t["tenantId"]).get()
            if existing.exists:
                print(f"  ➡️  {t['proveedorIdInterno']} {t['name']:25} ya existe, skip")
                continue
            doc_data = {
                **t,
                "plan": "trial",
                "subscriptionEnd": TRIAL_END,
                "subscriptionDuration": "30d",
                "trialEndsAt": TRIAL_END,
                "maxLicenses": 1,
                "usedLicenses": 0,
                "isActive": True,
                "features": FEATURES_DEFAULT,
                "createdAt": NOW,
                "createdBy": "migration-script",
            }
            if not dry_run:
                tenants_ref.document(t["tenantId"]).set(doc_data)
            print(
                f"  ✅ {t['proveedorIdInterno']} {t['name']:25} creado — trial hasta {TRIAL_END.strftime('%Y-%m-%d')}"
            )
        except Exception as e:
            errors.append(f"create trial {t['proveedorIdInterno']}: {e}")
            print(f"  ❌ {t['proveedorIdInterno']}: {e}")

    # ── PASO 4: Crear tenants sin vencimiento ────────────────
    print(
        f"\n🟢 PASO 4 — Creando {len(NEW_TENANTS_SIN_VENCIMIENTO)} tenants sin vencimiento...\n"
    )
    for t in NEW_TENANTS_SIN_VENCIMIENTO:
        try:
            existing = tenants_ref.document(t["tenantId"]).get()
            if existing.exists:
                print(f"  ➡️  {t['proveedorIdInterno']} {t['name']:25} ya existe, skip")
                continue
            doc_data = {
                **t,
                "plan": "starter",
                "maxLicenses": 1,
                "usedLicenses": 0,
                "isActive": True,
                "features": FEATURES_DEFAULT,
                "createdAt": NOW,
                "createdBy": "migration-script",
            }
            if not dry_run:
                tenants_ref.document(t["tenantId"]).set(doc_data)
            print(
                f"  ✅ {t['proveedorIdInterno']} {t['name']:25} creado — sin vencimiento"
            )
        except Exception as e:
            errors.append(f"create sv {t['proveedorIdInterno']}: {e}")
            print(f"  ❌ {t['proveedorIdInterno']}: {e}")

    print(f"\n{'='*60}")
    if errors:
        print(f"  ⚠️  {len(errors)} errores:")
        for e in errors:
            print(f"    - {e}")
    else:
        print(f"  ✅ Sin errores")
    print(
        f"  Modo: {'DRY RUN — ningún cambio aplicado' if dry_run else 'REAL — cambios aplicados'}"
    )
    print(f"{'='*60}\n")


if __name__ == "__main__":
    # Cambiar a dry_run=False cuando estés listo para aplicar
    dry_run = "--apply" not in sys.argv
    if not dry_run:
        confirm = input(
            "⚠️  Vas a modificar Firestore en PRODUCCIÓN. Escribe 'confirmar' para continuar: "
        )
        if confirm.strip().lower() != "confirmar":
            print("Cancelado.")
            sys.exit(0)
    run(dry_run=dry_run)

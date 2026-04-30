#!/usr/bin/env python3
"""
NetoInsight — Creacion masiva de tenants
=========================================
Uso:
  python create_tenants.py           # diagnostico sin crear
  python create_tenants.py --create  # crea en Firestore (pide confirmacion)
"""

import re
import sys
import argparse
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore


PROJECT_ID = "netoinsight-fed03"
CREATED_BY  = "bulk-creation-script"

DEFAULT_FEATURES = {
    "canDownloadClosedMonth": True,
    "dashboards": ["categorization", "skus", "stocks", "purchase-orders"],
    "customReports": False,
    "exports": True,
    "api": False,
}

# ── Lista de nuevos tenants ───────────────────────────────────────
# email vacío = solo crear el tenant, sin invitar todavía
NEW_TENANTS = [
    {"name": "MERCADOTECNIA EN PUNTO",         "legalName": "MERCADOTECNIA EN PUNTO S DE RL DE CV",           "sian": "1001006", "email": "edelgado@induwell.com",                  "plan": "trial"},
    {"name": "LASTUR",                          "legalName": "LASTUR SA DE CV",                                "sian": "1000993", "email": "c.pena@lastur.com.mx",                   "plan": "trial"},
    {"name": "BORNEL",                          "legalName": "BORNEL",                                         "sian": "1001031", "email": "jonathan.espinosa@alimentosefa.com.mx",  "plan": "trial"},
    {"name": "SALMI DEL SURESTE",               "legalName": "SALMI DEL SURESTE SA DE CV",                    "sian": "1001007", "email": "csanchez@salmi.com.mx",                  "plan": "trial"},
    {"name": "BEDACOM",                         "legalName": "BEDACOM SA DE CV",                               "sian": "1000853", "email": "jpablodeanda@bedacom.mx",               "plan": "trial"},
    {"name": "SANTA CLARA MERCANTIL",           "legalName": "SANTA CLARA MERCANTIL DE PACHUCA SRL DE CV",    "sian": "1001027", "email": "jonathan.izquierdop@jvalle.com.mx",      "plan": "trial"},
    {"name": "VIRUTEXILKO",                     "legalName": "VIRUTEXILKO",                                    "sian": "1001017", "email": "sergio.gonzalez@virutexilko.com.mx",     "plan": "trial"},
    {"name": "ORLANDO MARTINEZ LUNA",           "legalName": "ORLANDO MARTINEZ LUNA",                         "sian": "1000828", "email": "omlsf49@hotmail.com",                   "plan": "trial"},
    {"name": "PASTEURIZADORA MAULEC",           "legalName": "PASTEURIZADORA MAULEC SA DE CV",                "sian": "1000125", "email": "mariellem@maulec.com.mx",               "plan": "trial"},
    {"name": "LECHE 19",                        "legalName": "LECHE 19 DIECINUEVE HERMANOS SA DE CV",         "sian": "1000615", "email": "juanita.salazar@19hnos.com",            "plan": "trial"},
    {"name": "TANIA YURIDIA",                   "legalName": "TANIA YURIDIA",                                  "sian": "1001008", "email": "a@mitqc.com",                           "plan": "trial"},
    {"name": "WILLIAM DEZMO",                   "legalName": "WILLIAM DEZMO BARTOLON GALVEZ",                 "sian": "1000820", "email": "Gsp_alimentos@hotmail.com",             "plan": "trial"},
    {"name": "ALIMENTOS PECUARIOS NUTRITIVOS",  "legalName": "ALIMENTOS PECUARIOS NUTRITIVOS SA DE CV",       "sian": "1000579", "email": "jelizalde@apn.mx",                      "plan": "trial"},
    {"name": "QUALTIA ALIMENTOS",               "legalName": "QUALTIA ALIMENTOS OPERACIONES SRL DE CV",       "sian": "1000842", "email": "vfiguero@qualtia.com",                  "plan": "trial"},
    {"name": "PRODUCTOS CHATA",                 "legalName": "PRODUCTOS CHATA SA DE CV",                      "sian": "2000329", "email": "ventasmayoreosur@chata.com.mx",         "plan": "trial"},
    {"name": "ACH FOODS",                       "legalName": "ACH FOODS MEXICO SRL DE CV",                    "sian": "1000971", "email": "aguilar@achfood.com.mx",                "plan": "trial"},
    {"name": "SALINERA ROCHE",                  "legalName": "COMERCIAL SALINERA ROCHE SA DE CV",             "sian": "1000807", "email": "aavila@isysa.com.mx",                   "plan": "trial"},
    {"name": "ERNESTO IBARRA",                  "legalName": "ERNESTO IBARRA Y CIA SA DE CV",                 "sian": "1000087", "email": "inieto@escosa.com.mx",                  "plan": "trial"},
    {"name": "PINSA COMERCIAL",                 "legalName": "PINSA COMERCIAL SA DE CV",                      "sian": "1000920", "email": "jmiranda@pinsa.com",                    "plan": "trial"},
    {"name": "PESCADOS ENVASADOS SINALOA",       "legalName": "PESCADOS ENVASADOS DE SINALOA SA DE CV",       "sian": "1000890", "email": "joseluis.cristerna@pessa.com.mx",       "plan": "trial"},
    {"name": "MISSION FOODS",                   "legalName": "MISSION FOODS MEXICO S DE RL DE CV",            "sian": "1000967", "email": "miguelf783@gruma.com",                  "plan": "trial"},
    {"name": "MEGA ALIMENTOS",                  "legalName": "MEGA ALIMENTOS SAPI DE CV",                     "sian": "2000199", "email": "olivia.contreras@megaalimentos.com",    "plan": "trial"},
    # Sin email por ahora — solo crear el tenant
    {"name": "MANANTIALES ASUNCION",            "legalName": "MANANTIALES LA ASUNCION SAPI DE CV",            "sian": "1000881", "email": "",                                      "plan": "trial"},
    {"name": "NIAGARA",                         "legalName": "EMBOTELLADORA NIAGARA DE MEXICO S DE RL DE CV", "sian": "1001021", "email": "",                                      "plan": "trial"},
]


# ── Helpers ───────────────────────────────────────────────────────
def slugify(text):
    """MERCADOTECNIA EN PUNTO → mercadotecnia-en-punto"""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def to_bq_name(text):
    """MERCADOTECNIA EN PUNTO → mercadotecnia_en_punto"""
    return slugify(text).replace("-", "_")


def build_doc(t, now):
    slug       = slugify(t["name"])
    bq_slug    = to_bq_name(t["name"])
    tenant_id  = f"tenant-{slug}"
    tableau_g  = f"{t['name'].replace(' ', '_')}_Viewers"
    email_field = t["email"] if t["email"] else f"admin@{slug}.com"

    doc = {
        "tenantId":           tenant_id,
        "name":               t["name"],
        "legalName":          t["legalName"],
        "adminEmail":         email_field,
        "plan":               t["plan"],
        "proveedorIdInterno": t["sian"],
        "isActive":           True,
        "maxLicenses":        1,
        "usedLicenses":       0,
        "subscriptionDuration": "30d",
        "bigQueryDataset":    f"proveedores_{bq_slug}",
        "bigQueryFilter":     f"proveedor_id = '{t['sian']}'",
        "tableauGroup":       tableau_g,
        "features":           DEFAULT_FEATURES.copy(),
        "createdAt":          now,
        "updatedAt":          now,
        "createdBy":          CREATED_BY,
    }
    return tenant_id, doc


def color(text, code):  return f"\033[{code}m{text}\033[0m"
def green(t):  return color(t, "92")
def yellow(t): return color(t, "93")
def red(t):    return color(t, "91")
def blue(t):   return color(t, "94")
def bold(t):   return color(t, "1")


# ── Firebase ──────────────────────────────────────────────────────
def init_firebase():
    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            credentials.ApplicationDefault(), {"projectId": PROJECT_ID}
        )
    return firestore.client()


def get_existing_sians(db):
    """Devuelve set de proveedorIdInterno ya existentes en Firestore"""
    existing = set()
    for doc in db.collection("tenants").stream():
        sian = doc.to_dict().get("proveedorIdInterno", "")
        if sian:
            existing.add(str(sian))
    return existing


# ── Main ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="NetoInsight — Bulk Tenant Creator")
    parser.add_argument("--create", action="store_true", help="Crear los tenants en Firestore")
    args = parser.parse_args()

    db  = init_firebase()
    now = datetime.now(timezone.utc)

    existing_sians = get_existing_sians(db)

    to_create  = []
    to_skip    = []

    for t in NEW_TENANTS:
        if t["sian"] in existing_sians:
            to_skip.append(t)
        else:
            to_create.append(t)

    with_email    = [t for t in to_create if t["email"]]
    without_email = [t for t in to_create if not t["email"]]

    print(f"\n{bold('=' * 65)}")
    print(f"{bold('  NetoInsight — Creacion de Tenants')}")
    print(f"{bold('=' * 65)}\n")

    print(f"{green(f'NUEVOS A CREAR ({len(to_create)})')}\n")
    print(f"  {bold(f'Con email — se invitaran ({len(with_email)}):')}")
    for t in with_email:
        tid, _ = build_doc(t, now)
        print(f"    + {t['name']:<35} SIAN={t['sian']:<10} {t['email']}")

    print(f"\n  {bold(f'Sin email — solo crear ({len(without_email)}):')}")
    for t in without_email:
        tid, _ = build_doc(t, now)
        print(f"    + {t['name']:<35} SIAN={t['sian']}")

    if to_skip:
        print(f"\n{yellow(f'YA EXISTEN EN FIRESTORE — se omiten ({len(to_skip)}):')}")
        for t in to_skip:
            print(f"    • {t['name']:<35} SIAN={t['sian']}")

    print(f"\n{bold('─' * 65)}")
    print(f"  A crear:  {green(str(len(to_create)))}   Ya existen: {yellow(str(len(to_skip)))}")
    print(f"{bold('─' * 65)}\n")

    if not args.create:
        print("Para crear, ejecuta: python create_tenants.py --create\n")
        return

    if not to_create:
        print("Nada que crear.\n")
        return

    print(f"{red(bold('CREACION EN FIRESTORE — PRODUCCION'))}")
    print(f"Se crearan {bold(str(len(to_create)))} tenants nuevos.")
    confirm = input("Escribe CONFIRMAR para continuar: ").strip()
    if confirm != "CONFIRMAR":
        print("Cancelado.")
        return

    print()
    ok = 0
    fail = 0
    for t in to_create:
        tenant_id, doc = build_doc(t, now)
        try:
            db.collection("tenants").document(tenant_id).set(doc)
            tag = "" if t["email"] else " (sin email)"
            print(f"  {green('OK')} {t['name']}{tag}  →  {tenant_id}")
            ok += 1
        except Exception as e:
            print(f"  {red('ERR')} {t['name']}  →  {e}")
            fail += 1

    print(f"\n{bold('─' * 65)}")
    print(f"  Creados: {green(str(ok))}   Fallidos: {red(str(fail))}")
    print(f"{bold('─' * 65)}\n")


if __name__ == "__main__":
    main()

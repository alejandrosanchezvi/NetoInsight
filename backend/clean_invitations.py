#!/usr/bin/env python3
"""
🧹 NetoInsight — Limpieza de Invitaciones
==========================================
Identifica y elimina invitaciones basura:
  1. Duplicados por tenant → conserva solo la más reciente pendiente
  2. Invitaciones a correos de prueba (internos)

Uso:
  python clean_invitations.py          # diagnóstico, no elimina nada
  python clean_invitations.py --clean  # elimina tras confirmación

Requiere:
  gcloud auth application-default login --account alejandro.sanchezvi@tiendasnetows.com
"""

import sys
import argparse
from datetime import datetime, timezone
from collections import defaultdict

import firebase_admin
from firebase_admin import credentials, firestore

# ── CONFIG ────────────────────────────────────────────────────────
PROJECT_ID = "netoinsight-fed03"

# Correos que se consideran de prueba / internos (en minúsculas)
TEST_EMAILS = {
    "asanchezvin@gmail.com",
    "alejandro.sanchezvi@tiendasnetows.com",
}


# ── Init ──────────────────────────────────────────────────────────
def init_firebase():
    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            credentials.ApplicationDefault(), {"projectId": PROJECT_ID}
        )
    return firestore.client()


def color(text, code):
    return f"\033[{code}m{text}\033[0m"

RED    = lambda t: color(t, "31")
GREEN  = lambda t: color(t, "32")
YELLOW = lambda t: color(t, "33")
CYAN   = lambda t: color(t, "36")
GRAY   = lambda t: color(t, "90")
BOLD   = lambda t: color(t, "1")


def fmt_date(ts):
    if ts is None:
        return "—"
    if hasattr(ts, "tzinfo"):
        return ts.strftime("%Y-%m-%d %H:%M")
    return str(ts)


# ── Main ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Limpia invitaciones basura de Firestore")
    parser.add_argument("--clean", action="store_true", help="Eliminar las invitaciones basura (pide confirmación)")
    args = parser.parse_args()

    db = init_firebase()

    print(BOLD("\n🧹 NetoInsight — Limpieza de Invitaciones"))
    print("=" * 60)

    # ── 1. Leer todas las invitaciones ────────────────────────────
    print("\nLeyendo invitaciones de Firestore...")
    snaps = db.collection("invitations").stream()
    all_invs = []
    for doc in snaps:
        d = doc.to_dict()
        created = d.get("createdAt")
        if hasattr(created, "timestamp"):
            created = datetime.fromtimestamp(created.timestamp(), tz=timezone.utc)
        all_invs.append({
            "id":         doc.id,
            "tenantId":   d.get("tenantId", ""),
            "tenantName": d.get("tenantName", "—"),
            "email":      (d.get("email") or "").lower().strip(),
            "status":     d.get("status", "pending"),
            "createdAt":  created,
            "expiresAt":  d.get("expiresAt"),
        })

    print(f"Total invitaciones encontradas: {BOLD(str(len(all_invs)))}")

    # ── 2. Detectar basura ────────────────────────────────────────
    to_delete = []   # lista de IDs a eliminar
    to_keep   = []   # lista de IDs a conservar
    reasons   = {}   # id → razón

    # 2a. Correos de prueba/internos
    test_inv_ids = {
        inv["id"] for inv in all_invs
        if inv["email"] in TEST_EMAILS
    }

    # 2b. Duplicados por tenant: de las pendientes, conserva la más reciente
    by_tenant = defaultdict(list)
    for inv in all_invs:
        if inv["id"] not in test_inv_ids:          # los de prueba ya van a borrar
            by_tenant[inv["tenantId"]].append(inv)

    duplicate_ids = set()
    for tenant_id, invs in by_tenant.items():
        pending = [i for i in invs if i["status"] == "pending"]
        if len(pending) <= 1:
            continue
        # Ordenar por fecha desc — conservar el primero
        pending_sorted = sorted(
            pending,
            key=lambda x: x["createdAt"] if x["createdAt"] else datetime.min.replace(tzinfo=timezone.utc),
            reverse=True
        )
        for dup in pending_sorted[1:]:
            duplicate_ids.add(dup["id"])

    # Unir todo
    garbage_ids = test_inv_ids | duplicate_ids
    for inv in all_invs:
        if inv["id"] in garbage_ids:
            to_delete.append(inv)
            if inv["id"] in test_inv_ids:
                reasons[inv["id"]] = "correo de prueba/interno"
            else:
                reasons[inv["id"]] = "duplicado (pendiente más vieja)"
        else:
            to_keep.append(inv)

    # ── 3. Mostrar resumen ────────────────────────────────────────
    print(f"\n{'─'*60}")
    print(BOLD(f"  {'A CONSERVAR':30s} {len(to_keep):>4}"))
    print(BOLD(RED(f"  {'A ELIMINAR':30s} {len(to_delete):>4}")))
    print(f"{'─'*60}")

    if not to_delete:
        print(GREEN("\n✅ No hay invitaciones basura. Todo limpio."))
        return

    print(BOLD(RED("\n🗑  Invitaciones a ELIMINAR:")))
    print()
    for inv in sorted(to_delete, key=lambda x: (x["tenantName"], x["createdAt"] or datetime.min.replace(tzinfo=timezone.utc))):
        print(f"  {RED('✗')}  [{inv['status']:8s}]  {inv['tenantName'][:28]:30s}  {inv['email']:35s}  {fmt_date(inv['createdAt'])}  →  {YELLOW(reasons[inv['id']])}")

    print()
    print(BOLD(GREEN("✅ Invitaciones a CONSERVAR:")))
    print()
    kept_pending = [i for i in to_keep if i["status"] == "pending"]
    for inv in sorted(kept_pending, key=lambda x: x["tenantName"]):
        print(f"  {GREEN('✓')}  {inv['tenantName'][:28]:30s}  {inv['email']:35s}  {fmt_date(inv['createdAt'])}")
    other_kept = [i for i in to_keep if i["status"] != "pending"]
    if other_kept:
        print(GRAY(f"\n  + {len(other_kept)} invitaciones ya aceptadas/expiradas (no se tocan)"))

    # ── 4. Eliminar si --clean ────────────────────────────────────
    if not args.clean:
        print(f"\n{YELLOW('ℹ  Modo diagnóstico — nada fue eliminado.')}")
        print(f"   Para eliminar, ejecuta:  {BOLD('python clean_invitations.py --clean')}")
        return

    print(f"\n{BOLD(RED('⚠  CONFIRMACIÓN REQUERIDA'))}")
    print(f"   Se eliminarán {len(to_delete)} invitaciones de Firestore.")
    print(f"   Esta acción es irreversible.")
    resp = input("   Escribe CONFIRMAR para continuar: ").strip()
    if resp != "CONFIRMAR":
        print(YELLOW("\n❌ Cancelado."))
        return

    print()
    deleted = 0
    failed  = 0
    for inv in to_delete:
        try:
            db.collection("invitations").document(inv["id"]).delete()
            print(f"  {GREEN('✓')} Eliminado: {inv['tenantName']} — {inv['email']}")
            deleted += 1
        except Exception as e:
            print(f"  {RED('✗')} Error eliminando {inv['id']}: {e}")
            failed += 1

    print(f"\n{'─'*60}")
    print(f"  Eliminadas: {GREEN(str(deleted))}")
    if failed:
        print(f"  Fallidas:   {RED(str(failed))}")
    print(GREEN("\n✅ Limpieza completada."))


if __name__ == "__main__":
    main()

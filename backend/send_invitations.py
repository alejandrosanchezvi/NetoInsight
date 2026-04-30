#!/usr/bin/env python3
"""
📧 NetoInsight — Script de Diagnóstico y Envío de Invitaciones
==============================================================
Modo 1 (default): diagnóstico — muestra quién necesita invitación
Modo 2 --send:    envía las invitaciones a los proveedores listos
Modo 3 --test:    envía solo al correo de prueba especificado

Uso:
  python send_invitations.py                        # diagnóstico
  python send_invitations.py --test tu@correo.com  # prueba con un correo
  python send_invitations.py --send                 # envío real (pide confirmación)

Requiere:
  pip install firebase-admin requests
  Variable de entorno ID_TOKEN con tu Firebase ID token de prod
  (obtenlo en el portal → DevTools → Console:
   await firebase.auth().currentUser.getIdToken(true))
"""

import os
import sys
import json
import time
import secrets
import argparse
import requests
from datetime import datetime, timedelta, timezone

# ── Firebase Admin SDK ────────────────────────────────────────────
import firebase_admin
from firebase_admin import credentials, firestore

# ── CONFIG ────────────────────────────────────────────────────────
PROJECT_ID = "netoinsight-fed03"
PROD_API_URL = "https://netoinsight-api-prod-609085902384.us-central1.run.app"
FRONTEND_URL = "https://netoinsight.soyneto.com"
INVITED_BY_NAME = "Equipo NetoInsight"
INVITED_BY_EMAIL = "notificaciones@soyneto.com"
DEFAULT_ROLE = "admin"
INVITATION_DAYS = 7  # días de validez del link


# ── Init Firebase Admin ───────────────────────────────────────────
def init_firebase():
    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            credentials.ApplicationDefault(), {"projectId": PROJECT_ID}
        )
    return firestore.client()


# ── Helpers ───────────────────────────────────────────────────────
def generate_token():
    return secrets.token_urlsafe(32)


def color(text, code):
    return f"\033[{code}m{text}\033[0m"


def green(t):
    return color(t, "92")


def yellow(t):
    return color(t, "93")


def red(t):
    return color(t, "91")


def blue(t):
    return color(t, "94")


def bold(t):
    return color(t, "1")


# ── Firestore queries ─────────────────────────────────────────────
def get_all_tenants(db):
    docs = db.collection("tenants").stream()
    tenants = []
    for doc in docs:
        d = doc.to_dict()
        if d.get("proveedorIdInterno") == "NETO-INTERNAL":
            continue
        tenants.append(
            {
                "tenantId": doc.id,
                "name": d.get("name", ""),
                "adminEmail": d.get("adminEmail", ""),
                "plan": d.get("plan", "trial"),
                "isActive": d.get("isActive", True),
                "proveedorIdInterno": d.get("proveedorIdInterno", ""),
            }
        )
    return tenants


def get_active_users_by_tenant(db):
    """Returns dict: tenantId → list of active user emails"""
    docs = db.collection("users").where("isActive", "==", True).stream()
    result = {}
    for doc in docs:
        d = doc.to_dict()
        if d.get("isInternal"):
            continue
        tid = d.get("tenantId", "")
        email = d.get("email", "").lower()
        result.setdefault(tid, []).append(email)
    return result


def get_pending_invitations_by_tenant(db):
    """Returns dict: tenantId → list of {email, expiresAt} for pending invitations"""
    docs = db.collection("invitations").where("status", "==", "pending").stream()
    result = {}
    for doc in docs:
        d = doc.to_dict()
        tid = d.get("tenantId", "")
        email = d.get("email", "").lower()
        expires_at = d.get("expiresAt")
        result.setdefault(tid, []).append({"email": email, "expiresAt": expires_at})
    return result


def is_invitation_active(inv, now):
    """Returns True if the invitation has not yet expired"""
    exp = inv.get("expiresAt")
    if not exp:
        return True
    exp_aware = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
    return exp_aware > now


def cancel_existing_invitation(db, tenant_id, email):
    """Cancela invitaciones pendientes previas para el mismo email+tenant"""
    docs = (
        db.collection("invitations")
        .where("tenantId", "==", tenant_id)
        .where("email", "==", email.lower())
        .where("status", "==", "pending")
        .stream()
    )
    cancelled = 0
    for doc in docs:
        doc.reference.update(
            {"status": "cancelled", "cancelledAt": datetime.now(timezone.utc)}
        )
        cancelled += 1
    return cancelled


def create_invitation_in_firestore(
    db, tenant_id, tenant_name, email, role, token, expires_at
):
    """Crea el documento de invitación en Firestore"""
    data = {
        "email": email.lower(),
        "role": role,
        "tenantId": tenant_id,
        "tenantName": tenant_name,
        "token": token,
        "status": "pending",
        "createdAt": datetime.now(timezone.utc),
        "expiresAt": expires_at,
        "invitedBy": "script-bulk-invite",
        "invitedByEmail": INVITED_BY_EMAIL,
        "invitedByName": INVITED_BY_NAME,
        "metadata": {"createdFrom": "bulk-invite-script", "userAgent": "python-script"},
    }
    ref = db.collection("invitations").add(data)
    return ref[1].id


def send_email_via_api(id_token, email, token, tenant_name, expires_at):
    """Llama al endpoint de producción para enviar el email"""
    url = f"{PROD_API_URL}/api/invitations/send-email"
    headers = {
        "Authorization": f"Bearer {id_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": email,
        "invitation_token": token,
        "tenant_name": tenant_name,
        "invited_by_name": INVITED_BY_NAME,
        "invited_by_email": INVITED_BY_EMAIL,
        "role": DEFAULT_ROLE,
        "expires_at": expires_at.isoformat(),
        "frontend_url": FRONTEND_URL,
        "template_type": "provider",
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


# ── DIAGNÓSTICO ───────────────────────────────────────────────────
def run_diagnostics(db):
    print(f"\n{bold('=' * 60)}")
    print(f"{bold('📊 DIAGNÓSTICO — NetoInsight Invitaciones')}")
    print(f"{bold('=' * 60)}\n")

    tenants = get_all_tenants(db)
    users = get_active_users_by_tenant(db)
    pending = get_pending_invitations_by_tenant(db)

    ready_to_invite = []
    already_active = []
    no_email = []
    already_pending = []
    expired_reinvite = []
    now = datetime.now(timezone.utc)

    for t in tenants:
        tid = t["tenantId"]
        name = t["name"]
        email = t["adminEmail"].strip()
        plan = t["plan"]

        # Sin correo real
        if (
            not email
            or email.startswith("admin@")
            or email.startswith("alejandro.sanchezvi@tiendasneto")
        ):
            no_email.append(t)
            continue

        # Ya tiene usuario activo
        active_emails = users.get(tid, [])
        if email.lower() in [e.lower() for e in active_emails]:
            already_active.append(t)
            continue

        # Tiene invitación pendiente — verificar si expiró
        pending_items = pending.get(tid, [])
        matching = [i for i in pending_items if i["email"] == email.lower()]
        if matching:
            has_active_inv = any(is_invitation_active(i, now) for i in matching)
            if has_active_inv:
                already_pending.append(t)
            else:
                # Todas las invitaciones expiraron — reinvitar
                expired_reinvite.append(t)
                ready_to_invite.append(t)
            continue

        ready_to_invite.append(t)

    # ── Resumen ──────────────────────────────────────────────────
    new_invites = [t for t in ready_to_invite if t not in expired_reinvite]
    trials = [t for t in ready_to_invite if t["plan"] == "trial"]
    starters = [t for t in ready_to_invite if t["plan"] != "trial"]

    print(f"{green('✅ LISTOS PARA INVITAR')} ({len(ready_to_invite)} proveedores)\n")

    print(f"  {bold('🔄 Trial')} ({len(trials)}):")
    for t in sorted(trials, key=lambda x: x["name"]):
        tag = " [REINVITACION]" if t in expired_reinvite else ""
        print(
            f"    • {t['name']:<35} {t['adminEmail']:<45} [{t['proveedorIdInterno']}]{tag}"
        )

    print(f"\n  {bold('⭐ Starter/Pro')} ({len(starters)}):")
    for t in sorted(starters, key=lambda x: x["name"]):
        tag = " [REINVITACION]" if t in expired_reinvite else ""
        print(
            f"    • {t['name']:<35} {t['adminEmail']:<45} [{t['proveedorIdInterno']}]{tag}"
        )

    print(f"\n{yellow('⏳ YA TIENEN INVITACIÓN PENDIENTE')} ({len(already_pending)}):")
    for t in sorted(already_pending, key=lambda x: x["name"]):
        print(f"    • {t['name']:<35} {t['adminEmail']}")

    print(
        f"\n{blue('👤 YA TIENEN USUARIO ACTIVO')} ({len(already_active)}) — no se invitan:"
    )
    for t in sorted(already_active, key=lambda x: x["name"]):
        print(f"    • {t['name']:<35} {t['adminEmail']}")

    print(f"\n{red('❌ SIN CORREO REAL')} ({len(no_email)}) — no se pueden invitar:")
    for t in sorted(no_email, key=lambda x: x["name"]):
        print(f"    • {t['name']:<35} {t['adminEmail'] or '(vacío)'}")

    print(f"\n{bold('─' * 60)}")
    print(f"  Total proveedores:    {len(tenants)}")
    print(f"  Listos para invitar:  {green(str(len(ready_to_invite)))} ({len(expired_reinvite)} reinvitaciones por link expirado)")
    print(f"  Ya tienen usuario:    {blue(str(len(already_active)))}")
    print(f"  Invitación vigente:   {yellow(str(len(already_pending)))}")
    print(f"  Sin correo:           {red(str(len(no_email)))}")
    print(f"{bold('─' * 60)}\n")

    return ready_to_invite


# ── ENVÍO ─────────────────────────────────────────────────────────
def send_invitations(db, id_token, targets, dry_run=False):
    print(f"\n{bold('=' * 60)}")
    mode = "DRY-RUN" if dry_run else "ENVIANDO"
    print(f"{bold(f'📧 {mode} — {len(targets)} invitaciones')}")
    print(f"{bold('=' * 60)}\n")

    ok_count = 0
    fail_count = 0
    expires_at = datetime.now(timezone.utc) + timedelta(days=INVITATION_DAYS)

    for i, t in enumerate(targets, 1):
        name = t["name"]
        email = t["adminEmail"].strip()
        tid = t["tenantId"]
        plan = t["plan"]

        prefix = f"[{i:02d}/{len(targets):02d}] {name:<30}"

        if dry_run:
            print(f"  {yellow('○')} {prefix} → {email}  [{plan}]")
            continue

        try:
            # 1. Cancelar invitación previa si existe
            cancelled = cancel_existing_invitation(db, tid, email)
            if cancelled:
                print(f"  {yellow('↩')} {prefix} — cancelada invitación previa")

            # 2. Generar token
            token = generate_token()

            # 3. Crear en Firestore
            invitation_id = create_invitation_in_firestore(
                db, tid, name, email, DEFAULT_ROLE, token, expires_at
            )

            # 4. Enviar email vía API de prod
            result = send_email_via_api(id_token, email, token, name, expires_at)

            print(
                f"  {green('✅')} {prefix} → {email}  [{plan}]  msg:{result.get('message_id','?')[:16]}..."
            )
            ok_count += 1

        except Exception as e:
            print(f"  {red('❌')} {prefix} → {email}  ERROR: {e}")
            fail_count += 1

        # Pausa entre envíos para no saturar MailSlurp
        if i < len(targets):
            time.sleep(1.5)

    print(f"\n{bold('─' * 60)}")
    if not dry_run:
        print(f"  {green('Enviadas:')} {ok_count}   {red('Fallidas:')} {fail_count}")
    print(f"{bold('─' * 60)}\n")


# ── MAIN ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="NetoInsight — Bulk Invitation Tool")
    parser.add_argument(
        "--send", action="store_true", help="Enviar invitaciones reales"
    )
    parser.add_argument(
        "--test", metavar="EMAIL", help="Enviar solo a este correo de prueba"
    )
    parser.add_argument(
        "--dry", action="store_true", help="Mostrar qué se enviaría sin enviar"
    )
    args = parser.parse_args()

    db = init_firebase()

    # Solo diagnóstico
    if not args.send and not args.test:
        run_diagnostics(db)
        print("Para enviar, usa --send o --test tu@correo.com\n")
        return

    # Necesitamos ID token para enviar
    id_token = os.environ.get("ID_TOKEN", "").strip()
    if not id_token and (args.send or args.test):
        print(red("\n❌ Falta el ID_TOKEN de Firebase."))
        print("  Obtente en el portal de prod (DevTools → Console):")
        print("  await firebase.auth().currentUser.getIdToken(true)\n")
        print("  Luego ejecuta:")
        print("  ID_TOKEN=eyJ... python send_invitations.py --send\n")
        sys.exit(1)

    ready = run_diagnostics(db)

    # Modo prueba: enviar solo al correo indicado con el primer proveedor de la lista
    if args.test:
        test_email = args.test.strip()
        if not ready:
            print(red("No hay proveedores listos para probar."))
            return
        # Usar el primer proveedor disponible pero redirigir el email
        test_target = dict(ready[0])
        test_target["adminEmail"] = test_email
        print(
            f"\n{yellow('🧪 MODO PRUEBA')} — enviando como proveedor '{ready[0]['name']}' a {test_email}\n"
        )
        send_invitations(db, id_token, [test_target])
        return

    # Modo envío real
    if args.send:
        if args.dry:
            send_invitations(db, id_token, ready, dry_run=True)
            return

        print(f"\n{red(bold('⚠️  ENVÍO REAL A PRODUCCIÓN'))}")
        print(f"Se enviarán {bold(str(len(ready)))} invitaciones reales.")
        confirm = input("Escribe CONFIRMAR para continuar: ").strip()
        if confirm != "CONFIRMAR":
            print("Cancelado.")
            return
        send_invitations(db, id_token, ready)


if __name__ == "__main__":
    main()

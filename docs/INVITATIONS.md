# Invitaciones — Guía de Uso

---

## Script `send_invitations.py`

Ubicación: `backend/send_invitations.py`

### Requisitos

```bash
# Dependencias (ya instaladas en el venv del backend)
pip install firebase-admin requests

# Autenticación GCP (necesario para leer Firestore)
gcloud auth application-default login \
  --account alejandro.sanchezvi@tiendasnetows.com
gcloud config set project netoinsight-fed03
```

### Obtener el ID Token de Firebase

El token se necesita para llamar al backend de producción. Se obtiene desde el portal en producción:

1. Entrar al portal en `netoinsight.soyneto.com` como NETO-INTERNAL admin
2. F12 → **Network** → filtrar por `embed-url`
3. Entrar a cualquier dashboard para que haga una petición
4. Click en la petición a `netoinsight-api-prod...`
5. **Request Headers** → copiar el valor de `Authorization:` (sin `Bearer `)

> ⚠️ El token dura **1 hora**. Si expira, obtén uno nuevo y repite.

### Comandos

```bash
# 1. Diagnóstico — sin token, no envía nada
python send_invitations.py

# 2. Prueba con tu correo — usa el primer proveedor de la lista
ID_TOKEN=eyJ... python send_invitations.py --test tu@correo.com

# 3. Ver qué se enviaría sin enviar (dry-run)
ID_TOKEN=eyJ... python send_invitations.py --send --dry

# 4. Envío real — pide confirmación antes de proceder
ID_TOKEN=eyJ... python send_invitations.py --send
# Escribe CONFIRMAR cuando lo pida

# En Git Bash (Windows) exportar primero
export ID_TOKEN="eyJ..."
python send_invitations.py --send
```

### Lógica del diagnóstico

El script clasifica cada tenant en:

| Categoría | Criterio |
|---|---|
| ✅ Listo para invitar | isActive + tiene email real + no tiene usuario activo con ese email + no tiene invitación pending |
| 👤 Ya tiene usuario activo | El `adminEmail` del tenant ya tiene cuenta en colección `users` con `isActive: true` |
| ⏳ Invitación pendiente | Existe doc en `invitations` con `status: pending` para ese email+tenant |
| ❌ Sin correo real | `adminEmail` empieza con `admin@` o es un placeholder conocido |

### Qué hace al enviar

1. Cancela cualquier invitación `pending` previa para ese email+tenant
2. Genera un token URL-safe de 32 bytes
3. Crea documento en Firestore `invitations` con `status: pending`, `expiresAt: +7 días`
4. Llama a `POST /api/invitations/send-email` con `template_type: "provider"`
5. MailSlurp envía desde `notificaciones@soyneto.com` vía Amazon SES
6. Espera 1.5 segundos antes del siguiente envío

### Template que se usa

Todos los envíos masivos usan `invitation_provider_email.html` (azul Neto). El template `invitation_user_email.html` (también azul) se usa solo cuando se invita a alguien al tenant `tenant-neto` (NETO-INTERNAL) desde el portal.

---

## Flujo completo de una invitación

```
Admin envía invitación
  → invitation.service.ts crea doc en Firestore
  → Backend envía email con MailSlurp
  → Proveedor recibe email con link:
    https://netoinsight.soyneto.com/accept-invite?token=XXX

Proveedor hace click → accept-invite.ts valida token
  → Redirige a /setup-account?token=XXX

Proveedor crea cuenta
  → setup-account.ts:
    → Firebase Auth createUserWithEmailAndPassword
    → Si plan=trial: subscriptionEnd = hoy + 30 días
    → Crea doc en users/ con role, tenantId, proveedorIdInterno
    → Actualiza invitation.status = 'accepted'
    → Incrementa tenant.usedLicenses
    → Auto-login sin redirigir a /login
    → Navega a /categorization
```

---

## Reinvitar un proveedor

Si el proveedor no recibió el correo o el link expiró:

**Opción A — Desde el portal:**
Gestión de Proveedores → Tenant → Invitar usuario → mismo email → se cancela la anterior automáticamente

**Opción B — Desde el script:**
```bash
# El script detecta que tiene invitación pending, la cancela y crea nueva
ID_TOKEN=eyJ... python send_invitations.py --send
```

---

## Proveedores pendientes de invitar

Ver [`TENANTS.md`](TENANTS.md) — sección "Sin correo real".

Para agregar el correo real:
1. Firestore → `tenants` → `tenant-{nombre}` → editar `adminEmail`
2. O desde el portal → Gestión de Proveedores → Editar
3. Correr diagnóstico: `python send_invitations.py`
4. Enviar: `ID_TOKEN=eyJ... python send_invitations.py --send`

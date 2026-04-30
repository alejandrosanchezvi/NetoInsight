# Email — Configuración y Templates

---

## Infraestructura de envío

```
NetoInsight Backend (FastAPI)
  → MailSlurp SDK (Python)
    → Amazon SES
      → Destinatario
```

- **Inbox ID:** `81ab8878-8987-4a9c-a534-299ef25dbe2f`
- **From:** `notificaciones@soyneto.com`
- **Display name:** `NetoInsight`
- **Límite MailSlurp free tier:** 3,000 emails/mes

---

## Templates disponibles

| Archivo | Cuándo se usa |
|---|---|
| `invitation_provider_email.html` | Invitación a proveedor externo (cualquier plan excepto internal) |
| `invitation_user_email.html` | Invitación a usuario del equipo NETO-INTERNAL |
| `password_reset_email.html` | Recuperación de contraseña |

**Todos son azul Neto (`#0e3b83`) con acento naranja (`#f58220`).**

### Variables de los templates de invitación

| Variable | Descripción |
|---|---|
| `{{email}}` | Email del invitado |
| `{{tenantName}}` | Nombre del proveedor |
| `{{roleLabel}}` | "Administrador" o "Visualizador" |
| `{{invitedByName}}` | Nombre del admin que invitó |
| `{{invitedByEmail}}` | Email del admin |
| `{{expirationDate}}` | Fecha límite del link |
| `{{acceptUrl}}` | Link completo para aceptar |
| `{{currentYear}}` | Año actual |

### Variables del template de reset

| Variable | Descripción |
|---|---|
| `{{email}}` | Email del usuario |
| `{{resetUrl}}` | Link de Firebase para resetear |
| `{{requestDate}}` | Fecha de solicitud |
| `{{expirationDate}}` | Expiración (1 hora) |
| `{{currentYear}}` | Año actual |

---

## Selección de template

```python
# En mailslurp_service.py
if template_type == "user":
    template_file = "invitation_user_email.html"
else:
    template_file = "invitation_provider_email.html"  # default
```

```typescript
// En invitation.service.ts
const templateType = tenant.plan === 'internal' ? 'user' : 'provider';
```

---

## DNS de `soyneto.com` (Squarespace)

### Registros activos

| Tipo | Nombre | Valor |
|---|---|---|
| TXT | `@` | `v=spf1 include:amazonses.com include:slack.com include:slack-mail.com -all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:report@dmarc-mailslurp.click; ...` |
| TXT | `_amazonses` | `V6pV34P1aupMBSdoSt9prxmooD/iJ3nWoOMAO+sAhjo=` |
| CNAME | `afqgrujqc6pnd3hxk6bsyg6qkybenb3y._domainkey` | `...dkim.amazonses.com` |
| CNAME | `2jfrrng2zw27gepzumt6ez43vh2xnry4._domainkey` | `...dkim.amazonses.com` |
| CNAME | `hydq2tesxst24y5cbicl55rnnq7v2w7n._domainkey` | `...dkim.amazonses.com` |
| MX | `@` | `10 inbound-smtp.us-west-2.amazonaws.com` |
| CNAME | `netoinsight` | `netoinsight-prod.web.app` |

### Errores comunes del DNS

**DKIM mal nombrado:** Squarespace agrega `.soyneto.com` automáticamente al final del nombre. Los CNAME de DKIM deben tener el nombre **sin** el dominio al final:
- ✅ Correcto: `afqgrujqc6pnd3hxk6bsyg6qkybenb3y._domainkey`
- ❌ Mal: `afqgrujqc6pnd3hxk6bsyg6qkybenb3y._domainkey.soyneto.com`

**DMARC:** Debe estar en `_dmarc`, no en `@`.

**SPF:** Solo puede haber un registro TXT con `v=spf1` en `@`. Múltiples registros SPF causan fallo.

---

## Verificar DNS desde terminal

```bash
# SPF
nslookup -type=TXT soyneto.com 8.8.8.8

# DMARC
nslookup -type=TXT _dmarc.soyneto.com 8.8.8.8

# DKIM (verificar que no tenga .soyneto.com duplicado)
nslookup -type=CNAME afqgrujqc6pnd3hxk6bsyg6qkybenb3y._domainkey.soyneto.com 8.8.8.8
```

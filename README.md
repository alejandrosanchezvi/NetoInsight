# NetoInsight — Portal B2B de Business Intelligence

Portal multi-tenant para que los proveedores de **Tiendas Neto** visualicen sus datos de ventas, SKUs, inventario y órdenes de compra a través de dashboards embebidos de Tableau Cloud.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 17 (standalone components, TypeScript) |
| Backend | FastAPI (Python), Cloud Run |
| Auth | Firebase Auth + Firestore |
| Dashboards | Tableau Cloud, Embedding API v3, Connected Apps (JWT) |
| Email | MailSlurp → Amazon SES → `notificaciones@soyneto.com` |
| Hosting | Firebase Hosting (prod: `netoinsight.soyneto.com`) |
| DB | Firestore (`netoinsight-fed03`) |
| CI/Deploy | `npm run deploy:prod` → `ng build + firebase deploy` |

---

## URLs

| Entorno | URL |
|---|---|
| Producción frontend | https://netoinsight.soyneto.com |
| Producción backend | https://netoinsight-api-prod-609085902384.us-central1.run.app |
| Staging backend | https://netoinsight-api-staging-609085902384.us-central1.run.app |
| Firebase Console | https://console.firebase.google.com/project/netoinsight-fed03 |
| GCP Project | `netoinsight-fed03` / `espacio-digital-tiendas-neto` |

---

## Versiones

| Versión | Descripción |
|---|---|
| v1.0 | MVP — dashboards, auth, multi-tenant básico |
| v1.1 | Trials, descarga mes cerrado, emails |
| v1.2.0 | Restricción trial, métricas admin, licencias editables, reinvitación automática, DNS |
| v1.3.0 | View As proveedor, pantalla de error Tableau, control de acceso por rol, MFA removido del setup |

---

## Documentación

| Archivo | Contenido |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Estructura del proyecto, decisiones técnicas |
| [`docs/FIRESTORE.md`](docs/FIRESTORE.md) | Colecciones, campos, relaciones |
| [`docs/TENANTS.md`](docs/TENANTS.md) | Lista de proveedores y estado actual |
| [`docs/INVITATIONS.md`](docs/INVITATIONS.md) | Cómo enviar invitaciones masivas |
| [`docs/ACCESS_CONTROL.md`](docs/ACCESS_CONTROL.md) | Roles, guards, permisos por pantalla |
| [`docs/TABLEAU.md`](docs/TABLEAU.md) | Patrón proxy, filtros, descarga Excel |
| [`docs/EMAIL.md`](docs/EMAIL.md) | Templates, DNS, MailSlurp |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Historial de cambios por versión |

---

## Comandos clave

```bash
# Deploy completo a producción
cd frontend
npm run deploy:prod   # = ng build --configuration=production && firebase deploy --only hosting:production

# Deploy backend
gcloud run deploy netoinsight-api-prod \
  --source . --region us-central1 --allow-unauthenticated \
  --project netoinsight-fed03 \
  --service-account=cloud-run-backend-netoinsight@netoinsight-fed03.iam.gserviceaccount.com

# Diagnóstico de invitaciones
cd backend
python send_invitations.py

# Envío de prueba
ID_TOKEN=eyJ... python send_invitations.py --test tu@correo.com

# Envío masivo
ID_TOKEN=eyJ... python send_invitations.py --send
```

---

## Cuentas y accesos

| Recurso | Cuenta |
|---|---|
| GCP / Firebase | `alejandro.sanchezvi@tiendasnetows.com` |
| Tableau Cloud | `alejandro.sanchezvi@tiendasnetows.com` (proxy user para todos los JWT) |
| MailSlurp | cuenta asociada al proyecto |
| DNS Squarespace | cuenta `soyneto.com` |
| GitHub | repo manual — sin CI/CD automático aún |
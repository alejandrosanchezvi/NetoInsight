# Firestore — Esquema de Base de Datos

Proyecto: `netoinsight-fed03`

---

## Colección: `tenants`

Documento ID: `tenant-{nombre}` (ej: `tenant-bimbo`, `tenant-lala`)

```typescript
{
  tenantId: string,              // igual al document ID
  name: string,                  // "BIMBO"
  legalName: string,             // "BIMBO S.A. DE C.V."
  proveedorIdInterno: string,    // "1000007" — ID que filtra Tableau
                                 // "NETO-INTERNAL" para el tenant interno
  adminEmail: string,            // email del contacto principal
  billingEmail: string,
  rfc: string,

  plan: 'trial' | 'starter' | 'pro' | 'enterprise' | 'internal',
  isActive: boolean,
  maxLicenses: number,           // total de licencias contratadas
  usedLicenses: number,          // licencias en uso (usuarios activos)

  // Solo para trial
  subscriptionEnd: Timestamp,    // fecha de vencimiento
  trialEndsAt: Timestamp,        // alias de subscriptionEnd
  subscriptionDuration: '30d',

  features: {
    api: boolean,
    customReports: boolean,
    exports: boolean,
    canDownloadClosedMonth: boolean,  // descarga de Excel mes cerrado
    dashboards: string[],        // ['categorization', 'skus', 'stocks', 'purchase-orders']
  },

  tableauGroup: string,          // "BIMBO_Viewers"
  bigQueryDataset: string,
  bigQueryFilter: string,        // "proveedor_id = '1000007'"

  createdAt: Timestamp,
  createdBy: string,             // uid del admin que lo creó
  updatedAt: Timestamp,
  updatedBy: string,
}
```

**Tenant especial NETO-INTERNAL:**
- `tenantId`: `tenant-neto`
- `proveedorIdInterno`: `NETO-INTERNAL`
- `plan`: `internal`

---

## Colección: `users`

Documento ID: Firebase Auth UID

```typescript
{
  uid: string,
  email: string,
  name: string,
  role: 'admin' | 'viewer',
  isInternal: boolean,          // true solo para tenant-neto
  isActive: boolean,

  tenantId: string,             // referencia al tenant
  tenantName: string,           // desnormalizado para evitar joins
  proveedorIdInterno: string,   // copiado del tenant al crear cuenta

  invitationId: string,         // invitación que originó esta cuenta
  mfaEnabled: boolean,

  lastLogin: Timestamp,
  createdAt: Timestamp,
}
```

**Roles y permisos:**

| role | isInternal | Acceso |
|---|---|---|
| admin | true | Todo — Dashboards, Usuarios, Proveedores, Métricas |
| viewer | true | Solo dashboards |
| admin | false | Dashboards + Gestión de Usuarios de su tenant |
| viewer | false | Solo dashboards |

---

## Colección: `invitations`

```typescript
{
  email: string,               // lowercase
  role: 'admin' | 'viewer',
  tenantId: string,
  tenantName: string,
  token: string,               // token único URL-safe (32 bytes)

  status: 'pending' | 'accepted' | 'cancelled' | 'expired',

  invitedBy: string,           // uid o 'script-bulk-invite'
  invitedByName: string,
  invitedByEmail: string,

  createdAt: Timestamp,
  expiresAt: Timestamp,        // createdAt + 7 días
  acceptedAt?: Timestamp,
  cancelledAt?: Timestamp,

  metadata: {
    createdFrom: string,       // 'portal' | 'bulk-invite-script'
    userAgent: string,
  }
}
```

**Regla clave:** Solo puede existir **una** invitación `pending` por email+tenant. Al crear una nueva, la anterior se cancela automáticamente.

---

## Índices compuestos necesarios

```
invitations: (email ASC, tenantId ASC, status ASC)
invitations: (tenantId ASC, status ASC)
users: (tenantId ASC, isActive ASC)
users: (email ASC, tenantId ASC, isActive ASC)
tenants: (plan ASC, isActive ASC)
```

---

## Reglas de seguridad (pendiente implementar en producción)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isInternalAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isInternal == true &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isTenantMember(tenantId) {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tenantId == tenantId;
    }

    match /tenants/{tenantId} {
      allow read: if isInternalAdmin() || isTenantMember(tenantId);
      allow write: if isInternalAdmin();
    }

    match /users/{userId} {
      allow read: if isAuthenticated() &&
        (request.auth.uid == userId || isInternalAdmin());
      allow write: if isInternalAdmin();
    }

    match /invitations/{invitationId} {
      allow read: if isAuthenticated();
      allow write: if isInternalAdmin();
    }
  }
}
```

⚠️ **Estas reglas aún no están en producción.** Actualmente Firestore está en modo abierto protegido solo por los guards del frontend.

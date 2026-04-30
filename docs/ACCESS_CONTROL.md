# Control de Acceso — NetoInsight

---

## Tabla de permisos por pantalla

| Pantalla | NETO-INTERNAL Admin | NETO-INTERNAL Viewer | Tenant Admin | Tenant Viewer |
|---|:---:|:---:|:---:|:---:|
| Categorización | ✅ | ✅ | ✅ | ✅ |
| SKUs | ✅ | ✅ | ✅ | ✅ |
| Stocks | ✅ | ✅ | ✅ | ✅ |
| Órdenes de Compra | ✅ | ✅ | ✅ | ✅ |
| Gestión de Usuarios | ✅ | ❌ | ✅ | ❌ |
| Gestión de Proveedores | ✅ | ❌ | ❌ | ❌ |
| Métricas | ✅ | ❌ | ❌ | ❌ |

---

## Definición de roles

| Combinación | Descripción |
|---|---|
| `isInternal: true` + `role: admin` | Administrador de Neto — acceso total |
| `isInternal: true` + `role: viewer` | Visualizador interno (soporte, operaciones) — solo dashboards |
| `isInternal: false` + `role: admin` | Administrador del proveedor — dashboards + gestión de usuarios de su tenant |
| `isInternal: false` + `role: viewer` | Visualizador del proveedor — solo dashboards |

---

## Guards

### `internalAdminGuard`
Protege: `/admin/tenants`, `/admin/metrics`, `/admin/*`
```typescript
// Requiere isInternal === true AND role === 'admin'
const isInternalAdmin = currentUser?.isInternal === true
  && currentUser?.role === UserRole.ADMIN;
```

### `adminGuard`
Protege: `/users`
```typescript
// Requiere role === 'admin' (cualquier tenant)
const isAdmin = currentUser.role === UserRole.ADMIN;
```

---

## Sidebar — visibilidad de ítems

| Ítem | Flag | Visible para |
|---|---|---|
| Dashboards (4) | ninguno | todos |
| Usuarios | `adminOnly: true` | `role === 'admin'` |
| Proveedores | `internal: true` | `isInternal && role === 'admin'` |
| Métricas | `internal: true` | `isInternal && role === 'admin'` |

```typescript
shouldShowItem(item: MenuItem): boolean {
  const user = this.authService.getCurrentUser();
  if (item.internal) {
    return user?.isInternal === true && user?.role === 'admin';
  }
  if (item.adminOnly) {
    return user?.role === 'admin';
  }
  return true;
}
```

---

## Filtros de datos en Tableau

| Usuario | Filtro aplicado |
|---|---|
| NETO-INTERNAL (cualquier rol) | Sin filtro — ve todos los proveedores |
| Tenant admin/viewer | Filtro `Proveedor Id = proveedorIdInterno` |
| Trial | Filtro adicional de fecha: últimos 30 días (solo Categorización) |

---

## ⚠️ Casos especiales conocidos

**María Mijangos** (`maria.mijangos@tiendasneto.com`):
- `isInternal: true` + `role: viewer`
- Creada antes de que existiera la distinción de roles internos
- Con los guards actualizados (v1.3.0), solo puede ver dashboards
- Si sigue viendo pantallas protegidas: verificar que el deploy de v1.3.0 se haya ejecutado y que haya cerrado sesión y vuelto a entrar

**Diagnóstico de acceso incorrecto:**
1. Verificar que `admin.guard.ts` e `internal-admin.guard.ts` sean los de v1.3.0
2. Verificar que `sidebar.component.ts` sea el de v1.3.0
3. El usuario debe cerrar sesión y volver a entrar para limpiar el caché de sesión
4. Verificar en Firestore que `role` y `isInternal` sean correctos en el doc del usuario

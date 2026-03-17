# Historial de Solución de MFA Fantasma

## Problema
El usuario `alejandro.sanchezvi@tiendasneto.com` seguía recibiendo una solicitud de código MFA al iniciar sesión, a pesar de que los comandos de desactivación reportaban éxito.

## Hallazgos
1.  **Factor Fantasma**: Se identificó un factor MFA con ID `71ff5746-b262-4aa4-a0bd-4aa4b1edff76` que persistía en Firebase Auth.
2.  **Discrepancia de SDK**: El Firebase Admin SDK no lograba "ver" ni limpiar este factor mediante los métodos estándar (`update_user`), pero el REST API de Login sí lo detectaba.
3.  **Múltiples Proyectos**: Se detectó la existencia de la cuenta en dos proyectos distintos (`netoinsight-fed03` y `espacio-digital-tiendas-neto`), lo que generaba confusión sobre cuál era el origen de la solicitud de MFA.

## Solución Definitiva
Se aplicó un proceso de **Borrado y Recreación** en ambos proyectos para asegurar la limpieza total:
1.  **Respaldo**: Se preservaron los UIDs originales (`sNo1gyqDQ4Y309kW1az4Se9ljoE2` y `KCFxnVuftkNJdgHE96uMUI5Xzbw2`).
2.  **Eliminación**: Se borraron las cuentas de Firebase Auth en ambos proyectos.
3.  **Recreación**: Se recrearon las cuentas con los mismos UIDs para mantener la integridad con Firestore.
4.  **Reset de Flags**: Se forzó `mfaEnabled: false` y `mfaRequired: false` en Firestore.
5.  **Acceso**: Se configuró una contraseña temporal para permitir el re-ingreso.

## Datos de Acceso Temporal
- **Usuario**: `alejandro.sanchezvi@tiendasneto.com`
- **Password Temporal**: `Password123!`
- **Acción Requerida**: Iniciar sesión y cambiar la contraseña inmediatamente.

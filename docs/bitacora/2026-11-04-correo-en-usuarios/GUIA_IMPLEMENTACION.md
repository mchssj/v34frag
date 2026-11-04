# El correo de la cuenta en Usuarios: guía de implementación

## Estado

Hecho y probado en local el 2026-11-04 (pruebas de la API y de la web). **Pendiente:** probar y aplicar la `73` en la base del VPS, y desplegar la API y la web.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/73_correo_en_usuarios.sql` | `admin_account_status` con `email` |
| `supabase/replanteo/README.md` | Fila de la `73` |
| `web/backend/src/schemas/admin.ts` | `AdminAccountStatus.email` |
| `web/backend/src/routes/admin-players.ts` | `no-store` y descripción de la ruta |
| `web/backend/test/unit/admin-account.test.ts` | El estado trae el correo y no se guarda en caché |
| `web/frontend/src/api/schema.d.ts` | Regenerado desde la OpenAPI de la API |
| `web/frontend/src/features/admin/users/components/AccountSection.tsx` | Línea "Correo", seleccionable y sin campo editable |
| `web/frontend/src/features/admin/users/components/AccountSection.test.tsx` | Prueba del correo |
| `docs/manual/admin/usuarios-y-fichas.md` | La sección Acceso nombra el correo |

## Despliegue (pendiente)

En este orden, para que la web nunca pida un campo que la base no da (si la base va primero, la API vieja ignora el campo nuevo):

1. Base del VPS, con el túnel (`ssh -L 5433:127.0.0.1:5432 ubuntu@<VPS>`): aplicar `73_correo_en_usuarios.sql` y después correr `pruebas/prueba73.sql`, que se deshace solo.
2. API, como el último despliegue (`636e3a02`: desde la rama).
3. Web (`feat/frontend-fase-1`).

No toca los servidores de juego ni el plugin.

## Pruebas

### API

`pnpm exec vitest run --project unit test/unit/admin-account.test.ts`: 11 de 11. Typecheck sin errores.

### Web

`pnpm exec vitest run src/features/admin/users`: 12 de 12, con la prueba nueva (muestra el correo y no hay `textbox`). `pnpm typecheck` y `eslint` sin errores.

### Base

**No probada:** Docker no estaba corriendo en la PC, así que la `73` no se aplicó en la base local. El script `pruebas/prueba73.sql` comprueba que el admin recibe el mismo correo que `auth.users` y que un moderador y un usuario reciben `42501`.

## En qué se apartó del plan

- `schema.d.ts` se regeneró desde la OpenAPI de la app (sin levantar la API), y además trajo las rutas `/api/v1/manual` que ya estaban en la API de la rama y faltaban en el tipo.
- Sin `CHANGELOG_DISCORD.txt`: el cambio es solo para admins.

## Cómo revertir

1. Base: `pruebas/73_inversa.sql`.
2. Revert del commit y nuevo despliegue de la API y la web. La web vieja ignora el campo `email`, así que el orden no importa.

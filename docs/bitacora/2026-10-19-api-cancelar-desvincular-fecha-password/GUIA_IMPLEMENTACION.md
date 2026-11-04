# Cancelar el pedido de desvincular un SteamID y fecha del último cambio de contraseña: guía de implementación

## Estado

Hecho y probado el 2026-10-19, solo en local y sin desplegar: la migración `22` y las pruebas SQL, unitarias y de integración pasan. Sale en el corte, como el resto del replanteo. Falta el frontend (botón "Cancelar pedido", la fecha en el formulario de contraseña y el estado `cancelled` en la bandeja del admin). El arreglo del `500` de `/auth/me` también va en el corte con el backend.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/22_cancelar_desvincular_password.sql` | Nuevo: `cancelled` en `steam_requests.status`, `cancel_steam_unlink`, `profiles.password_changed_at`, `handle_password_change` y el trigger `on_auth_user_password_changed` en `auth.users` |
| `supabase/replanteo/README.md` | Fila de la `22` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/22_cancelar_desvincular_password.sql` | Nuevo: inversa (borra los pedidos cancelados) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/22_cancelar_desvincular_password.sql` | Nuevo: pruebas SQL (con rollback) |
| `web/backend/src/routes/claim.ts` | `DELETE /api/v1/me/steam/{steamid}/unlink`; el estado de los pedidos sale de `STEAM_REQUEST_STATES` |
| `web/backend/src/schemas/claim.ts` | `cancelled` en `STEAM_REQUEST_STATES` (respuestas y filtros) |
| `web/backend/src/schemas/auth.ts` | `password_changed_at` en `AuthUser` |
| `web/backend/src/services/account.ts` | `profileOf` lee `password_changed_at` y `toAuthUser` lo devuelve |
| `web/backend/src/routes/me.ts` | `password_changed_at` en `user` de Mi perfil |
| `web/backend/src/lib/errors.ts` | `fromAuthError`: `AuthSessionMissingError` es `401` |
| `web/backend/src/db/types.ts` | Generado con `pnpm db:types` |
| `web/backend/test/unit/claim-routes.test.ts` | Cancelar: SteamID que llega a la base, `204`, error de la base como `400`, SteamID inválido |
| `web/backend/test/unit/auth-routes.test.ts` | La sesión del cambio de contraseña trae `password_changed_at` |
| `web/backend/test/unit/errors.test.ts` | `fromAuthError` con `AuthSessionMissingError` y con un error desconocido |
| `web/backend/test/integration/claim.test.ts` | Cancelar en el flujo del jugador y del admin |
| `web/backend/test/integration/auth.test.ts` | `password_changed_at` (`null` al registrarse y después de un login, con fecha después del cambio en la sesión, `/auth/me` y Mi perfil) y `401` en `/auth/me` de la sesión cerrada |
| `docs/frontend/contrato/` | `jugadores.md` (5b), `cuenta.md`, `admin.md`, `api.md`, `README.md` y `decisiones.md` |

## Despliegue

No se desplegó. Va con el corte: la `22` se aplica después de la `21` (crea un trigger en `auth.users`, como el `on_auth_user_created` que ya existe; en la Supabase real se corre desde el SQL Editor) y el backend se publica en el VPS con el resto. No toca el plugin ni los servidores de juego (ni el servidor real ni RBK).

## Pruebas

### SQL (`pruebas/22_cancelar_desvincular_password.sql`, base local con Docker)

18 comprobaciones, todas ok: una cuenta nueva no tiene fecha; un login u otro cambio en `auth.users` no la toca, tampoco poner la misma contraseña; cambiarla guarda la fecha y no toca la de otra cuenta; el usuario la lee pero no la puede cambiar; sin pedido no hay nada para cancelar; el pedido queda `cancelled` con fecha y quién; el SteamID sigue en la ficha; cancelar dos veces falla; se puede pedir de nuevo; cancelado, el SteamID puede ser principal; no se cancela el pedido de otra cuenta ni uno rechazado; el admin no aprueba uno cancelado y lo ve en la bandeja después de los pendientes; sin sesión no se cancela.

`pruebas/correr.sh` (las 22 migraciones: aplicar, segunda aplicación, inversa con la estructura idéntica y volver a aplicar): **todo ok**. Las pruebas de la `21` siguen pasando.

### Unitarias (`pnpm test`)

18 archivos, **273 pruebas, todas pasan**. `pnpm typecheck` sin errores.

### Integración (`pnpm test:int`)

12 archivos, **87 pruebas, todas pasan** (los casos nuevos van dentro de los que ya existían):
- Cancelar: sin sesión `401`, `204`, el historial con `status=cancelled`, `unlink_pending: false`, cancelar dos veces `400`, el admin no lo aprueba y lo filtra con `status=cancelled`, y se vuelve a pedir.
- Contraseña: `password_changed_at` es `null` al registrarse y después de un login; tras el cambio trae la fecha en la sesión, en `/auth/me` y en Mi perfil.
- La otra PC, con su sesión cerrada por el cambio de contraseña, recibe `401 UNAUTHORIZED` en `/auth/me`.

## En qué se apartó del plan

- **Arreglo del `500` de `/auth/me` con una sesión cerrada** (bug reportado por el frontend el 2026-10-19, mientras se hacía este requerimiento): no estaba en el plan. Se sumó acá porque aparece justo después de cada cambio de contraseña. Es el arreglo propuesto en el reporte (`AuthSessionMissingError` → `401` en `fromAuthError`), que cubre los dos usos de `auth.getUser`; el middleware de sesión no usa `getUser` con tokens firmados con JWKS.

## Cómo revertir

1. Base local: correr `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/22_cancelar_desvincular_password.sql` (se pierden los pedidos cancelados y las fechas de cambio de contraseña) y borrar `supabase/replanteo/22_cancelar_desvincular_password.sql`.
2. Código: revertir el commit de este requerimiento.

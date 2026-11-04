# Desvincular un SteamID y elegir el principal: guía de implementación

## Estado

Hecho y probado el 2026-10-19, solo en local y sin desplegar: la migración `21` y las pruebas SQL, unitarias y de integración pasan. Sale en el corte, como el resto del replanteo. Falta el frontend (Mi perfil y la bandeja del admin).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/21_steam_desvincular.sql` | Nuevo: `steam_requests.kind` y `note`, `players.primary_steam_changed_at`, `request_steam_unlink`, `set_my_primary_steam`, `steam_make_primary`; cambian `admin_set_primary_steam`, `approve_steam_request`, `admin_remove_steam`, `link_steam_id` y la vista `admin_steam_requests` |
| `supabase/replanteo/README.md` | Fila de la `21` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/21_steam_desvincular.sql` | Nuevo: inversa (borra los pedidos `remove`) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/21_steam_desvincular.sql` | Nuevo: pruebas SQL (con rollback) |
| `web/backend/src/routes/claim.ts` | `added_at` en `steam_ids`; `POST /api/v1/me/steam/{steamid}/unlink` y `/primary`; `kind` y `note` en los pedidos (con filtro); `unlink_pending` en `GET /api/v1/me/claim-code`; descripciones del admin |
| `web/backend/src/schemas/claim.ts` | `STEAM_REQUEST_KINDS`, `UnlinkBody`, `kind` y `note` en `MySteamRequest`, `unlink_pending` en `MySteamStatus`, filtro `kind` |
| `web/backend/src/db/types.ts` | Generado con `pnpm db:types` |
| `web/backend/test/unit/claim-routes.test.ts` | `unlink_pending`, pedido sin respuesta de la base, validación del SteamID y del motivo |
| `web/backend/test/integration/claim.test.ts` | Caso nuevo con todo el flujo del jugador y del admin |
| `docs/frontend/contrato/` | `jugadores.md` (5b), `admin.md`, `api.md`, `README.md` y `decisiones.md` |

## Despliegue

No se desplegó. Va con el corte: la `21` se aplica después de la `20`, y el backend se publica en el VPS con el resto. No toca el plugin ni los servidores de juego (ni el servidor real ni RBK).

## Pruebas

### SQL (`pruebas/21_steam_desvincular.sql`, base local con Docker)

24 comprobaciones, todas ok: el jugador cambia su principal y el viejo queda como adicional; el ELO pasa a la clave nueva sin cambiar y recalcular todo da lo mismo; cada SteamID conserva su fecha al cambiar el principal (el que no tenía fecha sigue sin fecha); el límite de 24 horas; un SteamID ajeno no; el pedido con el motivo recortado; no se pide dos veces; con pedido pendiente no puede ser principal; la ficha no queda sin SteamID sumando pedidos; el jugador no aprueba; la vista del admin trae tipo y motivo; al aprobar, el SteamID y sus partidas quedan sin ficha y el ELO se recalcula; quitarlo directo aprueba el pedido; no se aprueba si el SteamID ya no es de la ficha; quitar el principal sube al adicional más viejo con su fecha; el primer SteamID de una ficha toma la fecha de ahora.

`pruebas/correr.sh` (las 21 migraciones desde la base sin replanteo: aplicar, segunda aplicación, inversa con la estructura idéntica y volver a aplicar): **todo ok**. En la `21`, una segunda aplicación aborta y la inversa deja la estructura idéntica.

### Unitarias (`pnpm test`)

18 archivos, **270 pruebas, todas pasan**. `pnpm typecheck` sin errores.

### Integración (`pnpm test:int`)

12 archivos, **87 pruebas, todas pasan**. El caso nuevo recorre: adicional aprobado, `added_at` de cada SteamID (y que se conserva al cambiar el principal), principal sin sesión (`401`), cambio de principal con el mismo ELO (y el mismo después de `elo_recompute_all`), el límite de 24 horas, el pedido con motivo y `unlink_pending`, los rechazos (dos veces, el único, uno ajeno, sin sesión), la bandeja del admin con `kind=remove`, la aprobación (el SteamID vuelve a ser perfil sin reclamar), un pedido sin body y el `DELETE` del admin que aprueba el pedido.

## En qué se apartó del plan

- **El cambio de principal no recalcula el ELO.** El plan decía que recalculaba todo, pero `elo_recompute_all` solo lo puede llamar un admin. Como el ELO de la ficha está en `player_elo` con la clave del principal y los adicionales no tienen fila propia, alcanza con pasar la fila a la clave nueva, y el resultado es el mismo (lo comprueban las pruebas SQL y de integración). El cambio del admin usa la misma función, así que tampoco recalcula todo.
- **Fecha de cada SteamID** (pedido de Daniel después del plan, el 2026-10-19): `players.steam_added_at`, `player_extra_steam_ids.added_at` admite `null`, `player_steam_all.added_at` también en el principal, `steam_attach`, `steam_detach` y `steam_make_primary` la conservan, y `added_at` en `GET /api/v1/me/claim-code`. Fue en la misma `21`, que no estaba commiteada ni aplicada fuera de la base local. Los principales que vinculó un admin en el sistema viejo quedan sin fecha (`null`).
- El límite de 24 horas se mantuvo aunque ya no hay un recálculo costoso: evita los cambios seguidos. Si Daniel prefiere sacarlo, es una línea en `set_my_primary_steam`.

## Cómo revertir

1. Base local: correr `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/21_steam_desvincular.sql` (se pierden los pedidos para desvincular) y borrar `supabase/replanteo/21_steam_desvincular.sql`.
2. Código: revertir el commit de este requerimiento.

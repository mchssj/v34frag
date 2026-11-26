# Banear una ficha sin SteamID: guía de implementación

## Estado

Desplegado: replanteo `147` en producción el 2026-11-25 (23:27 UTC); web y API en `affd6e60867e` (que incluye `edf75ed2`) desde el 2026-11-26.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/147_baneo_ficha_sin_steamid.sql` | Nuevo (ver DOCUMENTACION.md) |
| `supabase/replanteo/README.md` | Fila de la `147` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/147_baneo_ficha_sin_steamid.sql` | Inversa |
| `web/backend/src/schemas/bans.ts` | Descripción de `BanCreate.player_id` (sin "Necesita SteamID") y de `Ban.steam_id` (`null`: ficha sin SteamID) |
| `web/frontend/src/features/admin/bans/components/BanDialog.tsx` | El buscador muestra las fichas sin SteamID, con su aviso |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | "aunque todavía no tenga SteamID" |
| `docs/manual/moderador/banear-jugador.md`, `docs/manual/soporte/banear-jugador.md` | Fichas sin SteamID |

## Despliegue (hecho el 2026-11-25 y el 2026-11-26)

1. **Respaldo** `20261125T232659Z` (`sudo cmleague-respaldar`, también en R2), con una sala del matchmaking en vivo y 4 en la cola: la `147` no toca la partida ni `mm_config`.
2. **Prueba contra producción** en una transacción con `rollback` (`pruebas/prueba_147.sql`, mismo comando que en local pero con `sudo docker exec -i supabase-db psql` por SSH): los 6 casos OK.
3. **`147`** a las 23:27 UTC. Después: `bans.steam_id` sin `not null`, 29 baneos (los mismos), `anon` y `authenticated` sin permiso sobre `ban_active_target` ni `ban_support_count(uuid, text)`.
4. **Commit `edf75ed2`** en `main`, solo con estos cambios (los demás sin commit de la carpeta quedaron como estaban).
5. **Web:** worktree limpio en `edf75ed2` y `deploy/vps/desplegar.sh web` (no reinicia nada): `edf75ed2853f` a las 23:32 UTC, antes `bb718895cc67`. Subió también los legales de los replanteos 134 y 145, que estaban en `main` sin desplegar.
6. **API:** se esperó a que no hubiera salas (reinicia `cmleague-api`). Ver "Incidentes": quedó en `affd6e60867e`, que incluye este cambio.

Falta: el replanteo en `feat/frontend-fase-1` y `feat/mm-claim-en-sala`, y `pnpm gen:api` en el frontend.

## Pruebas

### Base (copia local, `supabase_db_v34frag-api`)

`pruebas/prueba_147.sql`, en una transacción que termina en `rollback` (la copia quedó igual: 19 baneos y sin `ban_active_target`):

```bash
(echo "begin;"; sed '/^begin;$/d; /^commit;$/d' supabase/replanteo/147_baneo_ficha_sin_steamid.sql; \
 cat docs/bitacora/2026-11-25-banear-ficha-sin-steamid/pruebas/prueba_147.sql) \
 | docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 -q
```

| # | Qué | Resultado |
|---|---|---|
| 1 | Un admin banea una ficha sin SteamID: el baneo queda sin SteamID, `mm_block_reason` y `mm_user_banned` lo bloquean, `ban_list` lo muestra activo | OK |
| 2 | Un segundo baneo reemplaza al primero | OK |
| 3 | `ban_steams` viene vacío (sin `null`) | OK |
| 4 | La ficha vincula un SteamID: `ban_active_for` lo encuentra y `csstv_bans_since` con un cursor de antes lo manda (con `csstv_auth` de prueba dentro de la transacción) | OK |
| 5 | El soporte: cupo 0 → 1 y "Ya está baneado" en el segundo intento | OK |
| 6 | `bans_destino` rechaza un baneo sin ficha ni SteamID | OK |

También se probó la `147` seguida de su inversa en una transacción: vuelve `steam_id not null` y desaparece `ban_active_target`.

### Web y API

`tsc --noEmit` en `web/frontend` y `web/backend` sin errores; `vitest` de baneos: 12 pruebas del frontend y 11 del backend, todas pasan. No se probó en el navegador.

## En qué se apartó del plan

- El check `bans_steam_id_check` de la 31 también se cambia: `is_steam64(null)` da `false` y no dejaba pasar el `null` (salió en la primera prueba).
- `schema.d.ts` no se edita a mano (regla del frontend): las descripciones nuevas llegan con `pnpm gen:api`.
- Los textos de `BanPanel` (punto 4 del plan) no hizo falta cambiarlos: ya dice "Ficha: vale para todos sus SteamID y los que sume después".

## Incidentes durante las pruebas

- **SSH cortado (2026-11-26, 00:07 a 00:09 UTC):** el primer intento de desplegar la API no entró por SSH (timeout en el puerto 22; la web y la API respondían). Probablemente el `limit` de ufw, por las consultas de "¿hay salas?" de un minuto más las del despliegue. Volvió solo a los dos minutos; después se espació a una consulta cada 2 minutos.
- **API pisada (2026-11-26, 01:08:45 a 01:09:28 UTC):** mientras se esperaba a que no hubiera salas, otra sesión commiteó en `main` y desplegó web y API `affd6e60867e` (beneficios VIP y preveto, replanteos 140, 141, 142 y 146). El despliegue de esta API (`edf75ed2853f`, desde un worktree en `edf75ed2`) la reemplazó por una versión sin eso. Se volvió a `affd6e60867e` en 43 segundos, apuntando `current` a esa versión y reiniciando `cmleague-api`, sin salas activas. Como `edf75ed2` es ancestro de `affd6e60`, esa versión ya trae este cambio. **Lección:** antes de desplegar desde un worktree fijo, mirar `readlink /srv/cmleague/<parte>/current` en la misma conexión y no desplegar si cambió desde que se preparó.

## Cómo revertir

1. Levantar y borrar los baneos sin SteamID (la inversa aborta si hay).
2. `psql -v ON_ERROR_STOP=1 -f docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/147_baneo_ficha_sin_steamid.sql`.
3. Revertir el commit de la web y desplegarla.

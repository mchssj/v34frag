# Banear una ficha sin SteamID: guía de implementación

## Estado

Probado en la copia local el 2026-11-25. **Sin commit ni despliegue**: falta aplicar la `147` en producción y desplegar la API y la web.

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

## Despliegue (pendiente)

1. **Base:** respaldo y la `147` por el túnel (`PG_*` del `.env`):
   ```bash
   psql -v ON_ERROR_STOP=1 -f supabase/replanteo/147_baneo_ficha_sin_steamid.sql
   ```
   No necesita las 139 a 146. No toca los servidores de juego ni el plugin: no hace falta reiniciar nada.
2. **API:** desplegar (solo cambian descripciones y el manual). Después, `pnpm gen:api` en `web/frontend` para traer las descripciones a `src/api/schema.d.ts`.
3. **Web:** desplegar.
4. **Ramas del matchmaking:** la `147` toca baneos que usa el matchmaking: commitear el replanteo también en `feat/frontend-fase-1` y `feat/mm-claim-en-sala`.

Sin la base, la web nueva muestra las fichas sin SteamID pero el baneo falla con el error de siempre: la base va primero.

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

## Cómo revertir

1. Levantar y borrar los baneos sin SteamID (la inversa aborta si hay).
2. `psql -v ON_ERROR_STOP=1 -f docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/147_baneo_ficha_sin_steamid.sql`.
3. Revertir el commit de la web y desplegarla.

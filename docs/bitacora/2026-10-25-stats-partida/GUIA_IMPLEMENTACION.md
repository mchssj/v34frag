# Estadísticas de partida estilo HLTV (primera parte): guía de implementación

## Estado

- **Backend:** implementado y probado en local el 2026-10-25, sin commit. El replanteo `29` está aplicado en la Supabase local.
- **Frontend:** pendiente. Se hace en `feat/frontend-fase-1` siguiendo la sección 4 del plan, después de fusionar el backend y correr `pnpm gen:api`.

`DOCUMENTACION.md` y `CHANGELOG_DISCORD.txt` se escriben cuando esté el frontend.

## Backend

### Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/29_stats_partida.sql` | Nuevo: `live_match_players` y `player_stats` suman `k2`–`k5`, `first_kills`, `first_deaths`, `plants` y `defuses`; vistas `match_clutches`, `player_clutches` y `match_clutch_data` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/29_stats_partida.sql` | Nueva: borra las vistas nuevas. Las columnas sumadas a las dos vistas quedan (`create or replace` no deja sacarlas sin recrear las vistas que dependen de ellas) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/29_stats_partida.sql` | Nuevas: 10 pruebas SQL con rollback |
| `supabase/replanteo/README.md` | Fila de la `29` |
| `web/backend/src/schemas/common.ts` | `Clutches` (`{ "1": n, …, "5": n }`) |
| `web/backend/src/schemas/matches.ts` | `PlayerLine` suma los campos nuevos y `clutches`; `MatchDetail`, `clutch_data` |
| `web/backend/src/schemas/live.ts` | `LivePlayerLine` suma los campos nuevos (sin `clutches`) |
| `web/backend/src/schemas/players.ts` | `PlayerStatsDetail` (la ficha) extiende `PlayerStats` con los totales y `clutches`. El perfil sin reclamar sigue con `PlayerStats` |
| `web/backend/src/services/matches.ts` | `clutchesOf`: las cinco claves aunque falten |
| `web/backend/src/routes/matches.ts`, `live.ts`, `players.ts` | Leen las columnas y vistas nuevas |
| `web/backend/src/db/types.ts` | Regenerado con `pnpm db:types` |
| `web/backend/test/integration/stats-partida.test.ts` | Nueva |
| `web/backend/test/unit/mixes-perfil.test.ts` | Prueba de `clutchesOf` |
| `docs/frontend/contrato/partidas.md` (8h nueva, 8 y 8d), `jugadores.md` (5), `README.md`, `decisiones.md` | Contrato |
| `docs/PENDIENTES.md` | La `29` en el corte, el frontend pendiente y lo que necesita el plugin, en pausa |

### Cambios respecto al plan

| Plan | Quedó | Por qué |
|---|---|---|
| `clutch_data`: tiene filas en `match_clips` o se jugó desde el 2026-10-23 | Tiene filas en `match_clips` o **su servidor ya había mandado jugadas** antes de ese mix (vista `match_clutch_data`) | Una fecha fija se equivoca con los mixes de ese día jugados antes de cargar el reporter 2.5.0 y con cada servidor nuevo. Un mix sin servidor y sin jugadas queda sin datos |
| `PlayerStats` con los campos nuevos | `PlayerStatsDetail` para la ficha; `PlayerStats` queda igual | El perfil sin reclamar (`/players/steam/{steamid}`) usa `PlayerStats` con otra fuente de datos |
| Un clutch ganado = un clip con `clutch_vs` | Un clip con `clutch_vs` **y** `round_won` | Hay clips con `clutch_vs` en rondas perdidas: jugadas destacadas (un 3k o un 4k) en clutches perdidos. No sirven para contar los perdidos, porque solo llegan si hubo jugada |

### Despliegue

No se desplegó. En el corte, la `29` va después de la `28`. Son solo vistas: no necesita datos previos ni configuración.

### Pruebas (2026-10-25)

- **SQL:** `pruebas/29_stats_partida.sql` pasa las **10**. Cubre:
  - los totales por ficha con dos SteamID;
  - los clutches ganados por partida y por ficha, sin contar el perdido ni la jugada sin clutch;
  - `clutch_data` en cuatro casos: anterior, con jugadas, posterior sin jugadas y sin servidor;
  - la foto en vivo, con 0 en lo que falta.
- **Inversa:** ida y vuelta sin errores. Además siguen pasando las pruebas de las migraciones `06`, `16`, `26`, `27` y `28`, que usan esas vistas.
- **Datos locales:** 39 clutches ganados en 8 mixes con jugadas (22 de 1v1, 10 de 1v2, 6 de 1v3 y 1 de 1v4). Por ejemplo, kyan: 76 rondas con 2k, 48 entradas ganadas y 32 plantadas.
- **Backend:** `pnpm test` pasa las **308** unitarias (22 archivos). La integración pasa completa, menos `seasons.test.ts`, que no se corrió porque borra BETA: 16 archivos y 115 pruebas, con la nueva `stats-partida.test.ts`. Esa prueba cubre:
  - el detalle del mix con clutches;
  - un mix sin datos de clutch (`clutches: null`);
  - la foto en vivo;
  - la ficha con los totales.
- `tsc --noEmit` en verde.

## Frontend

Pendiente (sección 4 del plan).

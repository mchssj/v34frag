# API para los mockups de Mixes, Perfil público y Ranking: guía de implementación

## Estado

Implementado y probado en local el 2026-10-24 (Supabase local con el replanteo 01 a 27) y commiteado en `feat/backend-api-fase-1`. **No se despliega antes del corte**: la `27` es del replanteo y la API nueva sale con la web nueva.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/27_mixes_perfil_ranking.sql` | Nuevo. `tv_port`, nick único, `admin_delete_mix` y `mix_deletions`, `elo_adjustments.source`, vistas `mix_list`, `mix_stats`, `player_elo_history`, `player_titles`, `player_ranking`, `team_results`; funciones `team_standings_at` y `players_together`; `player_matches`, `team_standings`, `team_ranking`, `game_servers_public`, `admin_server_list`, `admin_create_server`, `alias_check`, `player_elo_adjustment_list` y `admin_elo_adjustment_list` modificadas |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/27_mixes_perfil_ranking.sql` | Nuevo. Inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/27_mixes_perfil_ranking.sql` | Nuevo. 63 pruebas SQL |
| `supabase/replanteo/README.md` | Fila de la `27` |
| `web/backend/src/routes/mixes.ts` | Nuevo. `GET /api/v1/mixes` y `GET /api/v1/mixes/stats` |
| `web/backend/src/routes/ranking.ts` | Nuevo. `GET /api/v1/ranking/players` y `GET /api/v1/players/compare` |
| `web/backend/src/services/players.ts` | Nuevo. `resolvePlayer` (id o nick) y `likeExact` |
| `web/backend/src/routes/live.ts` | `tv` en los mixes en vivo; `DELETE /api/v1/admin/mixes/{id}` |
| `web/backend/src/services/live.ts` | `toTv`, `serverTvs`; `toLiveSummary` con `tv` |
| `web/backend/src/routes/players.ts` | Id o nick en todas las rutas; SteamID solo para el dueño y los admins; `event` y `label` en las partidas; `/elo-history`, `/titles`, `/medals/summary` |
| `web/backend/src/routes/seasons.ts`, `routes/elo.ts` | `/players/{id}/seasons` y `/elo-adjustments` aceptan el nick |
| `web/backend/src/routes/teams.ts`, `schemas/teams.ts` | Ranking de equipos con `win_rate`, `trend` y `form` |
| `web/backend/src/routes/matches.ts`, `schemas/matches.ts` | `demo_size` en el detalle |
| `web/backend/src/routes/admin-servers.ts`, `schemas/servers.ts` | `tv_port` en el alta, la edición y la respuesta |
| `web/backend/src/routes/servers.ts`, `services/servers.ts` | `tv_address` en `/servers/status`; `tvAddress` |
| `web/backend/src/schemas/live.ts`, `schemas/players.ts` | Esquemas nuevos (`MixItem`, `MixStats`, `DeleteMixBody`, `TvRef`, `EloPoint`, `Title`, `MedalSummary`, `RankingPlayer`, `Compare`…); `IdParam` acepta id o nick |
| `web/backend/src/app.ts` | Monta `mixes` y `ranking` (antes que `players`) |
| `web/backend/src/db/types.ts` | Regenerado (`pnpm db:types`) |
| `web/backend/test/integration/mixes-perfil-ranking.test.ts` | Nuevo. 12 pruebas |
| `web/backend/test/unit/mixes-perfil.test.ts` | Nuevo. 5 pruebas |
| `web/backend/test/integration/claim.test.ts` | Los SteamID se leen con la sesión del dueño; perfil por nick |
| `web/backend/test/unit/elo.test.ts`, `seasons-routes.test.ts`, `servers-status.test.ts`, `system.test.ts` | Simulan la búsqueda de la ficha; `tv_address`; rutas nuevas en la OpenAPI |
| `docs/frontend/contrato/` | `README.md` (novedades), `jugadores.md` (5 y 5c nueva), `partidas.md` (8d y 8e), `equipos.md` (7), `admin.md` (servidores y borrar un mix), `decisiones.md` |
| `docs/bitacora/2026-10-24-api-mixes-perfil-ranking/` | Esta bitácora y `CHANGELOG_DISCORD.txt` |

## Despliegue (pendiente: con el corte)

Va dentro del corte del replanteo ([`PENDIENTES.md`](../../PENDIENTES.md), punto 1.5), después de la `26`:

1. **Antes de aplicar la `27`, buscar nicks repetidos en producción.** La `27` aborta si los hay (sin distinguir mayúsculas ni espacios de los costados) y lista los primeros 20. Consulta para revisarlo antes:

   ```sql
   select lower(trim(nick)), array_agg(id), array_agg(user_id) from public.players group by 1 having count(*) > 1;
   ```

   Renombrar las fichas sin cuenta que choquen (las de una cuenta toman el alias, que ya es único).
2. Aplicar `supabase/replanteo/27_mixes_perfil_ranking.sql`.
3. Cargar el puerto de SourceTV de cada servidor desde Admin › Servidores (`tv_port`): **nuestro servidor real y RBK**. Es el `tv_port` de su `server.cfg`. Sin él, "Ver en TV" no aparece, pero nada se rompe.
4. Publicar el backend y el frontend nuevos (como el resto del corte).
5. Publicar el changelog (`CHANGELOG_DISCORD.txt`) cuando salga la web nueva.

No hay cambios en el plugin ni en la configuración de los servidores.

## Pruebas

### Base (Supabase local)

- `pruebas/27_mixes_perfil_ranking.sql`: **63 pruebas en verde**. Cubren:
  - Nick único: mayúsculas y espacios, renombrar, `alias_check` y `set_my_tag`.
  - `tv_port`: rango, `game_servers_public`, `admin_create_server` y `admin_server_list`.
  - `mix_list`: en vivo con ronda, TV y MVP parcial; terminado; cancelado; búsqueda por nombre del juego; acceso anónimo.
  - `mix_stats`.
  - `player_elo_history`.
  - `player_ranking`: posición global y país oculto si el perfil es privado.
  - `players_together`.
  - Borrar un mix:
    - Permisos y validaciones.
    - Revertir el último mix da lo mismo que un recálculo.
    - Mantener da el mismo ELO antes y después de un recálculo.
    - El ajuste no se ve en el perfil y sí en el admin.
    - `mix_deletions` solo para admins.
    - Un mix sin ELO se borra sin ajustes.
  - Palmarés: campeón, subcampeón y quien no estaba inscrito.
  - Partidas con el torneo de su partida (`!match`).
  - `team_standings`, `team_standings_at` y `team_ranking` (posición de hace 30 días y forma).
  - Todas las vistas nuevas leídas como `anon`.
- Ciclo de `correr.sh` para la `27`, a mano: se aplica, pasan sus pruebas, una segunda aplicación aborta, la inversa deja la estructura idéntica y se vuelve a aplicar.

### API (`web/backend`)

- `pnpm typecheck`: sin errores.
- `pnpm test`: **296 en verde**.
- `pnpm test:int`: **116 en verde**, contra la Supabase local con la `27`. Las 12 nuevas (`mixes-perfil-ranking.test.ts`) cubren:
  - El listado único con sus filtros, `mine` (401 sin sesión) y el orden.
  - `/mixes/stats`.
  - `tv` en vivo y `demo_size`.
  - `tv_port` en el admin (alta, edición y 400).
  - El perfil por nick, los SteamID según quién mira y el 404.
  - El historial de ELO, el palmarés, las medallas agrupadas y `event`/`label`.
  - El ranking de jugadores: posición global, nivel y tendencia.
  - El ranking de equipos: `win_rate`, `form` y `trend`.
  - El comparador.
  - Borrar un mix: 401, 403, confirmación, modo inválido, una partida que no es mix, mantener, revertir, sin ELO y 404.
- `pnpm test:coverage`: 412 pruebas, 94,6 % de líneas (el mínimo es 60 %).

## En qué se apartó del plan

- **Paginación con `page` y `per`**, no `limit` y `offset`: es la convención de todos los listados de la API (`lib/list.ts`). El historial de ELO trae `per=30` por defecto.
- **Función `players_together`** (no estaba en el plan): el comparador cuenta los mixes juntos y como rivales en la base. Cruzar todas las partidas de los dos jugadores en la API podía pasar el tope de 1000 filas de PostgREST.
- **`GET /servers/status` suma `tv_address`** (`host:puerto_tv`) en lugar de `tv_port`. `GET /api/v1/servers` (el selector de servidores de las partidas) no cambió.
- **El ranking de jugadores devuelve `matches` y `elo_matches`**: partidas terminadas de todo tipo y mixes. El comparador también.
- **Las sub-rutas de un jugador que no existe dan `404`** (antes, una lista vacía): es el efecto de resolver el id o el nick. Está en las novedades del contrato como "(rompe)".
- **La tendencia del ranking de equipos** compara posiciones contadas entre todos los equipos oficiales, como la posición actual (ver la documentación).

## Incidentes durante las pruebas

- **`team_ranking` daba `permission denied for table matches` sin sesión.** `team_results` hacía `select m.*` sobre `matches`, y el público no puede leer `matches.link_code`. Las pruebas SQL no lo agarraron porque leían como `postgres`. Se cambió a columnas explícitas y se sumaron pruebas de todas las vistas nuevas como `anon`.
- **`correr.sh` se corta en la `23`, antes de llegar a la `27`.** La prueba "por STEAM_0 del adicional: nicks y partidas de toda la ficha…" de `pruebas/23_whois.sql` falla. Este requerimiento no tocó la `01` a la `26` ni sus pruebas: la falla viene de antes y ya estaba anotada en `PENDIENTES.md` (7.0: la prueba espera el nick viejo de la ficha). La `27` se probó con el mismo ciclo, a mano.
- **La base local no tiene la fila de `elo_config`.** Revertir usa su piso. La prueba de integración la crea si falta y la borra al final, como `elo.test.ts`.
- **El campeón de un torneo de prueba** solo lo marca el motor con el torneo `in_progress`. La prueba de integración genera el cuadro por la API (como admin) y termina la final con el cliente de servicio.

## Cómo revertir

- **En la base:** aplicar `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/27_mixes_perfil_ranking.sql`.
  - Los mixes borrados no vuelven (quedan en `mix_deletions` hasta que corre la inversa, que la borra).
  - Los ajustes `mix_kept` quedan como ajustes comunes: siguen sosteniendo ese ELO, pero el jugador los ve en su perfil.
- **En la API:** revertir el commit de este requerimiento y `pnpm db:types`.

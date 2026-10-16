# `supabase/replanteo/`: NO aplicar en producción

Migraciones de la **fase de replanteo del modelo de datos**
(plan: [`docs/bitacora/2026-10-14-replanteo-modelo-datos/PLAN.md`](../../docs/bitacora/2026-10-14-replanteo-modelo-datos/PLAN.md)).

> **No se aplican en la Supabase de producción hasta el corte.** La web vieja (`index.html`) depende del
> esquema actual: estas migraciones la rompen. El corte tiene su propio plan y se hace junto con la web nueva,
> el backend y el plugin nuevo.

- **Dónde se usan:** solo en la Supabase local (`web/backend`). `pnpm db:reset` las carga después del esquema
  de producción (`supabase/schema/`) y de las migraciones pendientes de `supabase/migrations/`. Para
  levantar la base local **sin** ellas (por ejemplo, para el ensayo del ELO): `REPLANTEO=0 pnpm db:reset`.
- **Orden:** el prefijo numérico.
- **Formato de cada archivo:**
  - Corre en una transacción.
  - Empieza verificando que la base esté en el estado esperado. Si no lo está, aborta sin cambiar nada; por
    ejemplo, si ya se aplicó o si encuentra datos que perdería.
- **Migración inversa:** está en `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/`.
- **Pruebas:** están en `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/`.

| Archivo | Qué hace |
|---|---|
| `01_limpieza.sql` | Borra `player_claims`, `profiles.player_id`, `player_medals.color`, `matches.demo_url` y `matches.video_url`; quita las políticas duplicadas; `events.format` sin `swiss` |
| `02_privacidad.sql` | `players.privacy` solo `public` o `private`; la política de `profile_details` sin `members` |
| `03_matchmaking.sql` | Borra el matchmaking viejo: 4 tablas, 11 funciones, `game_servers.matchmaking_enabled` y `last_assigned_at`, y `matches.matchmaking_mode`. Aborta si hay matchmaking activo |
| `04_mixes_bandos.sql` | Los mixes guardan sus bandos en la partida (`side1_name`, `side2_name`, `lineup1`, `lineup2`, `side1_guests`, `side2_guests`) y se borran los equipos `mix`. `winner_side` (1, 2 o null) en todas las partidas; el ELO, las victorias, la ingesta y `link_steam_id` lo usan |
| `05_team_members.sql` | Tabla `team_members` (equipo, jugador, rol y fechas de alta y baja) en lugar de `teams.members`; adapta `pcw_make_side`, `accept_pcw`, `set_team_captain` y `validate_report` |
| `06_vistas_stats.sql` | Stats solo desde partidas: vistas `player_stats` y `player_map_stats`; borra las columnas de stats de `players`, `stats_auto`, la tabla `player_map_stats` y `recompute_player_stats` |
| `07_match_vincular.sql` | `!match`: código corto (`link_code`) en torneo y PCW, `csstv_match_lookup` para el plugin y `csstv_link_game`: el juego del servidor se vincula a la partida (`parent_match_id`, `parent_side1`) y la partida suma el mapa |
| `08_formatos_pcw.sql` | `pcw_config` (una fila): formatos de PCW habilitados, BO1, BO3 y BO5 al principio. `set_pcw_formats` (solo admin) y `create_pcw_post` rechaza un formato deshabilitado |
| `09_jugadores_equipos.sql` | Alias único (`profiles.tag`, 15 días entre cambios del usuario; `set_user_tag` del admin), `blocked_words`, plantel estilo FACEIT (`team_invites` y sus funciones; tope de 10, SteamID obligatorio, choques de torneo y de partida pendiente), bando de PCW "como equipo" (`teams.parent_team_id`), `ranking_config` y `team_standings`, vistas `player_overview`, `team_overview`, `player_matches` y `steam_unlinked`, `approve/reject_team_request` y bajas seguras |

# Repetición 2D y mapa de calor: guía de implementación

## Estado

Hecho y probado en local el 2026-11-12 (servidor con bots, base, API, Worker con `wrangler dev` y web), en `kyan/pruebas`, sin commit. **Sin desplegar**: falta todo lo de "Despliegue".

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/track.inc` | Nuevo: el `.trk` y `kill_pos` |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | 2.11.0. Incluye `track.inc` después de `qol.inc` y lo llama en `round_start`, `round_freeze_end`, `player_death`, la bomba, `OnRoundCompleted`, `OnClientDisconnect` y `OnMapEnd`. La explosión y la desactivación se anotan antes del corte por estado |
| `server/addons/sourcemod/scripting/csstv/qol.inc` | `Demo_Start` y `Demo_Stop` abren y cierran el `.trk`; `Demo_Discard` y `Demo_Cleanup` lo borran con la demo |
| `server/addons/sourcemod/scripting/csstv/json.inc` | `Track_WriteJson` al final del resultado (no en las fotos en vivo) |
| `server/cfg/sourcemod/csstv_reporter.cfg` | `csstv_track "1"` |
| `docs/bitacora/2026-11-12-repeticion-2d-y-mapa-de-calor/pruebas/granadas_prueba.sp` | Solo para las pruebas: da humo, flash, HE y kit a los bots al terminar la compra |
| `server/radar/nav_a_svg.py` | Nuevo: radar desde el `.nav` |
| `web/frontend/public/radar/` | 19 SVG y `index.json` |
| `supabase/replanteo/92_repeticion_2d.sql` | Nuevo (y una fila en `supabase/replanteo/README.md`) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/{reversas,pruebas}/92_repeticion_2d.sql` | Inversa y 20 controles |
| `cloudflare/demo-worker/src/index.js` | Sube el `.trk`, `track_mark`, `GET /track/<uid>` |
| `web/backend/src/routes/matches.ts`, `routes/players.ts`, `services/matches.ts`, `schemas/matches.ts`, `schemas/players.ts` | `track_url`, `/matches/{id}/kills`, `/players/{id}/heatmap` |
| `web/backend/src/db/types.ts` | `match_kills`, `matches.track_key`, `player_heatmap`, `track_mark` (copiados de los tipos generados con la base local, que está atrasada: regenerar todo el archivo borraba las tablas de la 85 a la 91) |
| `web/backend/test/integration/repeticion.test.ts` | Nuevo: 5 pruebas |
| `web/frontend/src/api/schema.d.ts` | Regenerado desde la OpenAPI de la API (trae también las rutas que le faltaban de antes) |
| `web/frontend/src/features/replay/` | Nuevo: lector, radar, repetición, mapa de calor y la sección de la sala, con pruebas |
| `web/frontend/src/features/mixes/pages/MixRoomPages.tsx` | `MatchReplay` debajo de la sala (mix y matchmaking) |
| `web/frontend/src/routes/demo.repeticion.tsx` | Demo sin API (`pnpm dev`) |
| `web/frontend/.gitignore` | `public/demo-replay/` (el `.trk` de bots de la demo) |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx`, `terms/privacidad.html` | Posiciones, plazos, para qué y Cloudflare, "En preparación" |
| `docs/manual/jugador/repeticion-2d.md` | Nueva |

## Despliegue (pendiente)

En este orden, sin mixes en curso para el paso del plugin:

1. **Base (Daniel):** aplicar `92_repeticion_2d.sql` en el VPS. No depende de la 89 a la 91.
2. **R2 (Daniel):** que la regla de vencimiento de 90 días también cubra el prefijo `tracks/` (hoy borra `demos/`). Sin eso, los `.trk` quedan para siempre, aunque la web deje de mostrarlos al vencer la demo.
3. **Worker:** `pnpm exec wrangler deploy` en `cloudflare/demo-worker`. No necesita secretos nuevos.
4. **Tarea de SFTP del VPS (Daniel):** subir también el `<uid>.trk` (a `tracks/AAAA/MM/<uid>.trk`, con `track_mark`) para los servidores sin key del panel. Hoy los tres son del panel de MVZG, así que no la usan.
5. **API:** desplegar `web/backend`.
6. **Plugin 2.11.0 a #1, #2 y #3 en la misma tanda**, por la API del panel, a `plugins/csstv_reporter.smx` (el anterior a `plugins/disabled/`). Agregar `csstv_track "1"` a cada `csstv_reporter.cfg` (es el valor por defecto: sin la línea, igual graba). Se carga en el próximo cambio de mapa; no recargarlo con una partida en curso.
7. **Web:** el frontend con los radares de `public/radar/`. Sacar la marca "En preparación" de `/privacidad` y de `terms/privacidad.html`.
8. Publicar `CHANGELOG_DISCORD.txt`.

## Pruebas

### Plugin (servidor local con bots, `pruebas/bots_track.sh`)

Tres mixes MR3 entre 6 bots en de_dust2 (`mp_roundtime 1.5`), con `csstv_send 0`:

| Corrida | Build | Resultado |
|---|---|---|
| 1 | Primera versión | 5 rondas, `.trk` de 132 KB (1001 líneas). 46 líneas `K` y 46 kills en `kill_pos` del resultado. Faltaban dos explosiones y el nombre del `.trk` tenía mayúsculas (la demo queda en minúsculas) |
| 2 | Nombre en minúsculas y posición de la plantada al explotar | `.trk` con el mismo nombre que la demo; 8 rondas, 249 KB. Faltaba la explosión de la ronda 3: llegaba ya en el medio tiempo |
| 3 | La explosión y la desactivación antes del corte por estado | 5 rondas (1-4), 134 KB. Las 3 bombas plantadas que explotaron o se desactivaron tienen su línea `B`, también la de la última ronda de la mitad. 38 líneas `K` y 38 kills en `kill_pos` |

Después, a pedido de Kyan, se sumaron las granadas, los cegados, el arma en mano, la plata, los golpes, el reloj, el timer del C4 y la desactivación. Corridas con `PLATA=1` (y `EXTRA=granadas_prueba.smx` para que tiren de todo):

| Corrida | Qué mostró |
|---|---|
| 4 | Granadas (`N` y `G`) y cegados (`L`). El juego manda `player_blind` antes que `flashbang_detonate`: la web une cada cegado con su flash al final de la ronda |
| 5 | Arma en mano, plata (`$`), reloj (`Z` con 105 s), golpes (`H`), timer del C4 (35). Visto en `/demo/repeticion`: el C4 con su cuenta, vida y arma de cada uno, estelas y lo que pasó en la ronda |
| 6 | Con granadas forzadas: 12 granadas, 5 cegados, humos (`S`) y una desactivación. 3597 líneas `N`: el proyectil del humo queda quieto en el piso y se seguía anotando. La entidad del humo vive unos 28,5 s |
| 7 | Sin las granadas quietas: 295 líneas `N`. Humos con `m_FadeStartTime` 17 y `m_FadeEndTime` 22 (lo que ve el jugador). Desactivación que empieza y la deja al explotar (`D` y `A`). 231 KB en 6 rondas de 6 bots |

El primer `.trk` se abrió en `/demo/repeticion`: rondas, movimiento, bomba y kills se ven bien. El de 10 jugadores en un mix real no se probó: lo estimo en 1 MB para 24 rondas.

### Base (local)

`pruebas/92_repeticion_2d.sql`: 20 controles bien (ingesta con SteamID viejo y de 64 bits, suicidio, registros malos, reenvío, plugin viejo, mapa de calor por SteamID principal y adicional, por mapa y con tope, `track_mark` con token y ruta, permisos de `anon`). Inversa aplicada y la 92 aplicada de nuevo, sin errores.

### API

`test/integration/repeticion.test.ts`: 5 pruebas bien. `tsc` sin errores. En `players-teams.test.ts` fallan 7 pruebas de la ficha y de equipos que ya fallaban antes: la base local no tiene la 87 a la 91.

### Worker (`wrangler dev --local`, contra la base local)

`/track/<uid>`: `200` con el archivo, `Content-Type` de texto y CORS; `410` con la demo vencida; `404` sin partida; `OPTIONS` `204`. **La subida del `.trk` desde el panel no se probó**: el Worker borra los archivos del servidor después de subirlos, y no hay un panel de prueba.

### Web

`vitest` de `replay`, `mixes`, `matchmaking`, `series` y `legal`: todo bien (el lector, la sección de la sala con y sin `.trk`, sin radar). `tsc` y `eslint` sin errores. Visto en `/demo/repeticion` con el `.trk` de los bots.

## En qué se apartó del plan

- **`demo_mark` no cambia:** el Worker marca el `.trk` con una función aparte, `track_mark`. Así una falla del `.trk` no toca la demo.
- **`demo_pending` no cambia:** el Worker ya lista la carpeta; busca el `.trk` por el nombre de la demo.
- **Las vistas en la sala:** la repetición y el mapa de calor van en una sección debajo de la sala (con "Repetición 2D" y "Mapa de calor" para cambiar), no en pestañas de la sala, para no tocar las dos salas (mix y matchmaking).
- **El mapa de calor del perfil** quedó en la API (`/players/{id}/heatmap`) pero no en la web: el perfil es de Esteban.
- **Partidas viejas:** la sección no se muestra (en vez de un aviso), para no sumar ruido a todas las partidas anteriores.
- **El nombre del `.trk`** va en minúsculas, como la demo.
- **Motivos de fin de ronda:** el `reason` de `round_end` en CS:S es el enum del juego más uno (lo mostró la prueba).

## Cómo revertir

- **Plugin:** volver a subir la 2.10.0 desde `plugins/disabled/` a los tres. `csstv_track` en el cfg no molesta a la 2.10.0 (ConVar que no existe).
- **Base:** `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/92_repeticion_2d.sql`.
- **Worker, API y web:** revertir el commit y desplegar. Los `.trk` que hayan quedado en R2 se borran con la regla de vencimiento o a mano (prefijo `tracks/`).

# Iniciar partidas de torneo y PCW en un servidor libre: guía de implementación

## Estado

**Implementado, con commit y en staging desde el 2026-11-02** (base, API y web). El plugin 2.9.0 no se subió a ningún servidor: el matchmaking está apagado en todos (Kyan, 2026-11-02) y falta acordar con él en cuál se prueba. El manual de usuario por rol quedó para después (Daniel, 2026-11-02).

- **Base:** replanteo `56` con su inversa. 70 comprobaciones SQL en verde en la base local, dentro de una transacción que se deshace (`pruebas/correr_local.sh`). Aplicado en staging.
- **Plugin:** reporter **2.9.0**. Compila con `spcomp` 1.8 sin advertencias. **No se probó en un servidor**: el servidor local manda a la Supabase real y, con `csstv_send 0`, el plugin no consulta.
- **API:** typecheck limpio y 419 pruebas unitarias en verde (16 nuevas en `bookings-routes.test.ts`); 420 con `feat/backend-api-fase-1`.
- **Web:** typecheck y lint limpios, y 498 pruebas en verde (13 nuevas). No se miró en el navegador.

### Commits (2026-11-02, pedidos por Daniel)

| Rama | Commit | Qué |
|---|---|---|
| `feat/mm-claim-en-sala` | `67bc65bb` | Replanteos `53` a `55` y su API (bitácora `2026-11-02-ajustes-primer-mm`) |
| `feat/mm-claim-en-sala` | `d4c407b2` | Replanteo `56` con su inversa |
| `feat/mm-claim-en-sala` | `6f22bf43` | API: `bookings.ts`, errores y pruebas |
| `feat/mm-claim-en-sala` | `421cc8a3` | Reporter 2.9.0 y `cfg/csstv/live_*.cfg` |
| `feat/frontend-fase-1` | `26fa9a71` | Web de los ajustes del primer matchmaking y de Palmarés (ya estaba en staging) |
| `feat/frontend-fase-1` | `60b16f3d` | Web de torneo y PCW |

Sin push. Los archivos sueltos que estaban en el índice de `feat/frontend-fase-1` (capturas, logs, un PDF y `.idea/`) no entraron en ningún commit y siguen ahí.

## Ramas

| Parte | Rama | Carpeta |
|---|---|---|
| Base, plugin y API | `feat/mm-claim-en-sala` (la línea del matchmaking: la `56` necesita la `48`) | worktree `E:\Css V34 Web\v34frag-mmclaim` |
| Web y bitácora | `feat/frontend-fase-1` | `E:\Css V34 Web\v34frag` |

En `feat/mm-claim-en-sala` también están sin commit los replanteos `53` a `55` y sus cambios de API (bitácora `2026-11-02-ajustes-primer-mm`, ya en staging). La `56` va encima.

**Unión con `kyan/pruebas` (2026-11-02, pedida por Daniel):** commit `7bb544f1` en `feat/mm-claim-en-sala`, con `kyan/pruebas` en `f1141227` (charla del medio tiempo rehecha, capitán que elige lado tras el cuchillo, `csstv_qol` 1.0.1 y `csstv_coach` 1.0.0). El único conflicto fue la versión del reporter: el commit de la unión es la **2.8.6** (lo de la 2.8.2 más lo de la 2.8.5 de kyan), y el 2.9.0 sin commit va encima. Después de la unión: el 2.9.0, `csstv_qol` y `csstv_coach` compilan sin advertencias, 70 pruebas SQL y 419 de la API en verde.

**Segunda unión con `kyan/pruebas` (2026-11-02, pedida por Daniel):** commit `4274e979`, con `kyan/pruebas` en `74fa6d9f` (pausa técnica `!tech` y cuenta atrás de las pausas, `csstv_qol` 1.1.0 y `csstv_pedir` 1.0.0). Sin conflictos. El commit de la unión es la **2.8.7**, para no confundirla con la 2.8.6 de kyan (que no tiene el `!claim` en la sala). El reporter, `csstv_qol`, `csstv_coach` y `csstv_pedir` compilan sin advertencias.

**`csstv_qol` y las series (resuelto):** con `csstv_qol_end_kick` prendido (hoy solo en el #1), a los 40 s de terminar una partida expulsa a todos y cambia de mapa, y en una serie echaría a los jugadores entre mapas. `live_official.cfg` y `live_pcw.cfg` lo ponen en 0 al empezar cada mapa de torneo o PCW, y `csstv_qol.cfg` lo repone en el cambio de mapa siguiente.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/56_iniciar_torneo_pcw.sql` | Nuevo (ver `DOCUMENTACION.md`) |
| `supabase/replanteo/README.md` | Fila de la `56` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/56_iniciar_torneo_pcw.sql` | Nueva: deja todo como en la `55` |
| `server/addons/sourcemod/scripting/csstv/mm.inc` | Reservas: `Mm_OnBookingPoll`, `Mm_TakeBooking`, `Mm_ApplyBooking`, `Mm_WaitNag`, `p_state` en el poll, serie entre mapas, `mapover`, cvar `csstv_series_next_delay` |
| `server/addons/sourcemod/scripting/csstv/match.inc` | Mínimo por equipo (`g_iLinkMinTeam`, `Link_MinRoster`), `Link_TeamOk` y `Link_TeamCount`; `!match` en un servidor reservado |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 2.9.0 y `Match_ExecKindCfg()` después de `live.cfg` |
| `server/cfg/csstv/live_official.cfg`, `live_pcw.cfg`, `live_mm.cfg` y `live_mix.cfg` | Nuevas (pedido de Daniel, 2026-11-02): fuego amigo en torneo y PCW, sin la charla del medio tiempo ni la expulsión al terminar; matchmaking sin fuego amigo; sin `!gg` en torneo |
| `server/addons/sourcemod/scripting/csstv/match.inc` y `mm.inc` | `Match_SyncCoach` y `Match_OnCoachCfg`: `!coach` apagado mientras el servidor tiene una sala del matchmaking |
| `web/backend/src/routes/bookings.ts` | Nuevo: 12 rutas (reserva, iniciar, listos, acciones, servidores libres, segundos del veto, marcas, sanciones) |
| `web/backend/src/app.ts` | Monta `bookings` antes de `servers` (`/servers/free` no es un `{id}`) |
| `web/backend/src/lib/errors.ts` | `V5601` → 403 `PCW_BANNED` y `V5602` → 409 `SERVER_BUSY` |
| `web/backend/test/unit/bookings-routes.test.ts` | Nuevo: 16 pruebas |
| `web/frontend/src/features/series/{types,lib,api,components}/booking*`, `ServerPanel.tsx` | Nuevos: panel del servidor, veto con reloj, "Iniciar", listos, conexión y acciones del organizador |
| `web/frontend/src/features/series/pages/SeriesRoom.tsx` | Muestra el panel arriba de "La partida" |
| `web/frontend/src/features/admin/servers/{api/flags.ts,components/UsesSection.tsx}` | Nuevos: las tres marcas |
| `web/frontend/src/features/admin/servers/components/ServersTab.tsx` | Muestra "Usos del servidor" |
| `web/frontend/src/features/admin/teams/components/PcwBansTab.tsx` | Nuevo: Sanciones de PCW |
| `web/frontend/src/features/admin/teams/pages/AdminTeamsPage.tsx` | Pestaña "Sanciones de PCW" (moderadores y admins) |
| `web/frontend/src/features/admin/events/components/{VetoTurnCard,ManageTabs}.tsx` | Segundos por turno del veto en Configuración |
| `web/frontend/src/features/teams/{components/PcwBanNotice,pages/TeamView}.tsx` | Aviso de la sanción en el equipo |
| `web/frontend/src/features/shell/notifications/lib/model.ts` | Textos de `match_server_ready`, `booking_attention`, `pcw_server_ready` y `pcw_abandoned` |
| `web/frontend/src/features/matchmaking/{types.ts,admin/ServerPasswords.tsx}` | Estado `booking` ("Reservado") en el panel del matchmaking |

## Despliegue en staging (hecho el 2026-11-02)

1. **Base** (`edaljnirzvisiaathitt`, por el session pooler con `postgres.<ref>`): antes, la `54` y la `55` estaban, la `56` no y no había salas abiertas. `psql -v ON_ERROR_STOP=1 -f supabase/replanteo/56_iniciar_torneo_pcw.sql` terminó sin errores (los `reemplazar` encontraron todos sus textos). Verificado: `match_bookings` y `pcw_bans`, las dos marcas, `events.veto_turn_seconds`, `mm_tick` con el candado y `booking_tick`, `veto_act` con `booking_after_veto`, `csstv_mm_poll` de tres parámetros (sin el de dos), `csstv_match_lookup` con las reservas, los permisos (`anon` sin `match_start`, nadie con `booking_tick`) y un `mm_tick()` que corre (`{"built": 0}`). En staging no hay partidas de torneo ni de PCW, así que todavía no hay reservas.
2. **API `3c6a8b357cd1`:** rama temporal local con `feat/mm-claim-en-sala` (`421cc8a3`) más `feat/backend-api-fase-1` (`240e2694`), como en la bitácora `2026-11-01-pagina-serie`. Los conflictos fueron fuera de la API (bitácoras, relay del HUD y plugin) y se resolvieron con nuestra versión, porque esa rama solo sirve para armar la API. 420 pruebas en verde, `deploy/vps/desplegar.sh api --sin-pruebas` y `/api/health` con la versión. Comprobado desde el VPS: `GET /matches/{id}/booking` de una partida del matchmaking da 404 ("No existe esa partida de torneo o PCW"), `GET /teams/{id}/pcw-ban` da `{"until":null}`, `GET /servers/free` sin sesión da 401 y la OpenAPI tiene las rutas nuevas. La rama temporal y su carpeta se borraron. La anterior era `8e78f7650291-local11021850`.
3. **Web `60b16f3db869`:** `deploy/vps/desplegar.sh web` desde `feat/frontend-fase-1` sin cambios sin commit en `web/frontend`: 498 pruebas, build y subida. El bundle tiene "Iniciar la partida", "Usos del servidor" y "Sanciones de PCW". La anterior era `7f7ca3e0f8f4-local11021851`.

## Plugin en el #1 (MVZG), 2026-11-02

Elegido por Daniel como servidor de prueba de torneos y PCW. Por SFTP (`SFTP_CSS_*_MVZG`; el #1 no tiene API key de panel), con la clave del host de `ssh-keyscan` y la contraseña por `SSH_ASKPASS`. Sin recargar nada: entra en el próximo cambio de mapa.

| Archivo en el #1 | Qué se subió | Respaldo |
|---|---|---|
| `addons/sourcemod/plugins/csstv_reporter.smx` | 2.9.0 **licenciado** (`server/build_licenciado.sh 96bb5060-… srv1`), 141946 bytes | `plugins/disabled/csstv_reporter_2.7.6.smx` (el de Kyan) |
| `cfg/sourcemod/csstv_reporter.cfg` | `csstv_mm "0"` → `"1"` y `csstv_claim "0"` → `"1"`. Nada más | `cfg/sourcemod/csstv_reporter.cfg.bak_antes_290` |
| `cfg/csstv/live_official.cfg`, `live_pcw.cfg`, `live_mm.cfg`, `live_mix.cfg` | Nuevas | — |

- **Verificado:** se bajaron los seis archivos y coinciden byte a byte con lo que se subió.
- **Staging:** `CMLeague #1` con `official_enabled` y `pcw_enabled` en `true`; `mm_enabled` sigue en `false` (el matchmaking sigue apagado, como lo dejó Kyan). Al subirlo, su última consulta a staging era de las 20:59 UTC con la 2.8.2.
- **Desde el próximo mapa la contraseña del #1 la maneja la web:** queda cerrado al público. El `csstv_password` ya era el de la línea del matchmaking (10875 bytes).
- **Reemplazado por el 2.9.1 el mismo día** (bitácora `2026-11-02-claim-varios-steamid`), que ya no dice "Sala del matchmaking" en una reserva. El 2.9.0 quedó en `plugins/disabled/csstv_reporter_2.9.0.smx`.
- **Para volver atrás:** renombrar los dos respaldos a su nombre original y borrar las cuatro `live_*.cfg`, en un cambio de mapa; en staging, apagar las dos marcas.

## Lo que falta desplegar

1. ~~Servidor de prueba~~: el #1 (MVZG), elegido por Daniel; **subido el 2026-11-02** (sección anterior).
2. Confirmar en el próximo mapa que `mm_server_state` del #1 muestra `plugin_version = 2.9.0`.
3. **Prueba con clientes:** una BO3 de torneo (iniciar, veto con reloj, espera, dejar con 4, 90 s entre mapas) y una PCW (listos, fila, arranque automático y un abandono).
4. **Producción:** con el corte, junto con la `48`. El plugin y las cfg van a los tres servidores en la misma tanda (#1, flow con su build licenciado `7b01c85b-…` y #3), como pide `CLAUDE.md`.

## Pruebas

### Base (`pruebas/correr_local.sh`)

```bash
bash docs/bitacora/2026-11-02-iniciar-torneo-pcw/pruebas/correr_local.sh "E:/Css V34 Web/v34frag-mmclaim"
# NOTICE:  OK: 70 comprobaciones del replanteo 56
# NOTICE:  OK: la inversa deja el matchmaking como en la 55
```

Cubren: aptitud; quién inicia y con qué servidor; el servidor ocupado en el acto (también para el matchmaking) y el índice único; el `!match` desde otro servidor; el veto con reloj y al azar (sin autor); el poll con la reserva; la conexión (plantel, afuera, streamer, organizador); `taken`, dejar con 4, espera vencida (aviso, sin cancelar) y extender hasta 20; en vivo sin falso servidor caído; fin de la serie y servidor libre; BO3 entre mapas, `mapover`, servidor caído y vuelta, liberación y reinicio en el mapa 2; PCW con listos, veto, fila y espera de 15; arranque automático; abandono en vivo (con 4 no), sin ganador, sanción de 3 y de 7 días, la lista del panel y levantar; no presentarse; el servidor que nunca la tomó (a la fila primera, sin sanción); bajarse de la fila; las marcas solo para admins.

### De punta a punta con bots (`pruebas/e2e_bots.sh`, 2026-11-02)

El servidor local (`E:\CSS DEDICATED SERVER`) con el reporter de pruebas (`CSSTV_DEBUG`, bots con SteamID falso) contra la **base local** del backend, nunca la real. El script guarda una copia de la base dentro del contenedor, aplica la 45 y de la 48 a la 56, siembra un torneo BO3 y dos PCW con bots como plantel (nombres de perfiles de `BotProfile.db`: con otro nombre `bot_add_ct` no agrega nada), y al salir apaga el servidor, restaura su plugin, su cfg y su licencia, aplica las inversas y restaura la copia.

```bash
bash docs/bitacora/2026-11-02-iniciar-torneo-pcw/pruebas/e2e_bots.sh "E:/Css V34 Web/v34frag-mmclaim"
# == Resultado: 38 comprobaciones bien, 0 fallas
```

Cubre: el servidor consulta la base; iniciar, veto con reloj (al azar, sin autor) y toma con su contraseña; `live_official.cfg` (fuego amigo, sin charla del medio tiempo, sin `!gg`); dos mapas con el mapa siguiente a los 60 s, fin de la serie, servidor libre y contraseña rotada; PCW con listos, veto, fila, los dos equipos en regla, arranque automático, `live_pcw.cfg` y liberación por un moderador; PCW con un equipo incompleto: abandono, sin ganador, sanción de 3 días al equipo y a sus 4 jugadores, y el otro sin sanción.

Las corridas anteriores encontraron dos errores reales, corregidos: la inversa de la `56` con fines de línea CRLF y el texto "Sala del matchmaking" en una reserva. Las demás fallas eran del script (nombres de bots, el orden del cambio de lado al matar a los bots, buscar el plantel por nombre). Mientras corre, el juego tiene que estar cerrado: con `CMLauncher.exe` abierto, el servidor local se traba al arrancar.

### Plugin

```bash
SC="E:/CSS DEDICATED SERVER/server/cstrike/addons/sourcemod/scripting"
cd server/addons/sourcemod/scripting
"$SC/spcomp.exe" csstv_reporter.sp -i"$SC/include" -iinclude -o<scratchpad>/csstv_reporter.smx
```

Compila sin advertencias. Falta probarlo en el #1 (paso 6 del despliegue).

### API y web

```bash
cd web/backend && pnpm typecheck && pnpm test          # 419
cd web/frontend && pnpm typecheck && pnpm lint && pnpm test   # 498
```

## En qué se apartó del plan

- **Un solo candado para todos los servidores** (`server_alloc_lock`), en lugar de uno por servidor. Da la misma garantía y es más simple: lo toman `mm_tick`, `match_start` y la fila, y dura milisegundos.
- **La sanción es al equipo oficial y a cada jugador del plantel del bando**, no solo al equipo. Un bando de PCW puede no tener equipo oficial, y sin esto se esquivaba armando un bando suelto con los mismos jugadores.
- **También se puede bajar de la fila** sin sanción (el plan decía "antes de que termine el veto"): mientras no hay servidor, nadie esperó a nadie.
- **Veto en la web:** la página de la serie no tenía dónde vetar; se sumó (botones del pool para el capitán del turno). `match_booking` trae `can_veto`.
- **Servidor que nunca tomó la reserva de una PCW:** vuelve primera a la fila y ese servidor queda no disponible 10 minutos, sin sanción (no estaba en el plan).
- **Arranque automático:** si a los 2 minutos de vencer la espera el mapa no arrancó y un equipo dejó de estar en regla, es abandono.
- **Configuración por tipo de partida** (`live_official`, `live_pcw`, `live_mm` y `live_mix`): no estaba en el plan; la pidió Daniel el 2026-11-02. Además resuelve el problema de `csstv_qol_end_kick` en las series.
- **`GET /api/v1/events/{id}/veto-turn`:** hizo falta para mostrar el valor guardado en Configuración (el detalle del torneo está en otra rama de la API).
- **La página de la serie se refresca cada 5 segundos** con la reserva abierta. La base ya manda `booking.update` por el socket del matchmaking, pero la página todavía no lo escucha.
- **Rutas en un archivo nuevo** (`bookings.ts`) y no en `matches.ts` o `admin-servers.ts`: esta rama va 8 commits atrás de `feat/backend-api-fase-1` y así no se pisan al juntarlas.
- **Falta:** la lista de "partidas listas para iniciar y en curso, con su servidor" en Administración › Torneos (sección 13 del plan). Hoy se inicia desde la página de cada serie.
- **El frontend no regeneró `schema.d.ts`:** se generaría desde la línea del matchmaking y borraría rutas que solo están en `feat/backend-api-fase-1`. Las rutas nuevas se llaman con `authFetch` y tipos a mano, como el matchmaking.

## Cómo revertir

- **Base:** `psql -v ON_ERROR_STOP=1 -f docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/56_iniciar_torneo_pcw.sql`. Borra las reservas y las sanciones de PCW: avisar antes, porque una serie en curso pierde el servidor reservado.
- **Plugin:** volver a la 2.8.2 (`plugins/disabled/csstv_reporter.smx.bak_2.8.2`, que hay que dejar al subir la 2.9.0) en el próximo cambio de mapa.
- **API y web:** revertir los commits, cuando los haya.

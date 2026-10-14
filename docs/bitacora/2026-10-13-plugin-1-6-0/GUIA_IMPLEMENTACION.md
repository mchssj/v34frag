# Plugin 1.6.0: guía de implementación

## Estado

Desplegado el 2026-10-13: migración en Supabase, web publicada y plugin 1.6.0 subido al servidor real (se carga en el próximo cambio de mapa). Probado con bots en el servidor local; Daniel probó el menú de admin con su cliente. **Pendiente:** confirmar con `sm_csstv_status` en el servidor real que dice `v1.6.0`.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 1.6.0; `State_Knife` y `PURPOSE_KNIFE`; `!live` con `knife`, sin mínimo de jugadores (`Live_Request`); `!swap`; `GoLive`; `PickTeamNames` y `g_sTeam`/`g_sTeamNick`; mensajes con nombres de equipo; `FinishMatch` usa el resumen; `OnClientPostAdminCheck` (reconexión); SourceTV fuera de `IsCountedPlayer` y `SwapTeams` |
| `server/addons/sourcemod/scripting/csstv/knife.inc` | Nuevo: ronda de cuchillo, `!stay`, `!switch`, `csstv_knife_time` |
| `server/addons/sourcemod/scripting/csstv/gg.inc` | Nuevo: `!gg`, `csstv_gg_min_diff`, `csstv_gg_missing` |
| `server/addons/sourcemod/scripting/csstv/summary.inc` | Nuevo: resumen final |
| `server/addons/sourcemod/scripting/csstv/menu.inc` | Nuevo: categoría v34frag del menú de admin |
| `server/addons/sourcemod/scripting/csstv/qol.inc` | `!team` con `ProcessTargetString` (`Team_Apply`); reconexión (`Recon_*`, `MatchInProgress`); nombres de equipo en encabezado, match point y pausas; `jointeam` coloca a quien se reconectó |
| `server/addons/sourcemod/scripting/csstv/stats.inc` | `Stats_ClientKey` (sale de `Stats_GetRec`) y `Stats_FindRec` (busca sin crear) |
| `server/addons/sourcemod/scripting/csstv/json.inc` | `team_names` y `end_reason` |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Compilado 1.6.0 (sin `CSSTV_DEBUG`) |
| `supabase/migrations/20261013140000_rendicion_y_nombres.sql` | Nuevo: `matches.end_reason` y `csstv_ingest` con nombres de equipo |
| `index.html` | "Terminada por rendición (gg)" y etiqueta "Rendición" |
| `server/cfg/sourcemod/csstv_reporter.cfg` | Cvars nuevos; comentario de `csstv_min_players` |
| `server/cfg/csstv/live.cfg` | Un `;` en un comentario cortaba la línea y la consola mostraba `Unknown command "el"` |
| `docs/GUIA_SERVIDOR.md` | Flujo, rendición, reconexión, comandos y menú |
| `docs/bitacora/2026-10-13-plugin-1-6-0/pruebas/` | `lib.sh`, `escenarios.sh` (bots) y `pruebas_rendicion.sql` |

## Despliegue (hecho el 2026-10-13)

Lo que se hizo, en orden:

- **Migración:** en el SQL Editor (Daniel). Verificada consultando `matches?select=end_reason` con la anon key.
- **Plugin:** por SFTP (`paramiko` en un entorno virtual aparte). El `csstv_reporter.smx` del servidor (62186 bytes, mismo md5 que la 1.5.0 del commit `87f375d`) se movió a `plugins/disabled/csstv_reporter_1.5.0.smx` y se subió la 1.6.0 (76521 bytes, md5 `3848f0edde3d945e4432be2f8229fb61`, verificado en el servidor). `adminmenu.smx` está cargado. El cfg y `live.cfg` del servidor no se tocaron. No se recargó el plugin.
- **Web:** el `index.html` publicado era idéntico al del último commit; se guardó una copia local y se subió el nuevo a `htdocs/index.html` por FTP (verificado descargándolo de nuevo).

Pasos de referencia. El orden no es crítico: el plugin 1.6.0 funciona contra la base sin migrar (Supabase ignora `team_names` y `end_reason`: los equipos quedan "Mix de …" y la rendición se ve como una partida normal). Igual conviene:

1. **Supabase → SQL Editor:** pegar y ejecutar `supabase/migrations/20261013140000_rendicion_y_nombres.sql` (se puede volver a ejecutar).
2. **Web:** publicar `index.html`. Sin la migración no rompe nada: `end_reason` simplemente no viene.
3. **Plugin**, por SFTP como en las versiones anteriores:
   1. Respaldar `plugins/csstv_reporter.smx` del servidor real como `plugins/disabled/csstv_reporter_1.5.0.smx`.
   2. Subir `server/addons/sourcemod/plugins/csstv_reporter.smx`. Si el servidor usa un `.smx` licenciado, compilarlo con `server/build_licenciado.sh <uuid> <nombre>`.
   3. Opcional: agregar al `cfg/sourcemod/csstv_reporter.cfg` del servidor los cvars nuevos (`csstv_knife_time`, `csstv_gg_min_diff`, `csstv_gg_missing`); sin ellos se usan los valores por defecto.
   4. Opcional: corregir el `;` del comentario de `cfg/csstv/live.cfg` del servidor.
   5. Se carga en el próximo cambio de mapa (`sm plugins reload csstv_reporter` cancela la partida en curso). Verificar con `sm_csstv_status` que diga `v1.6.0`.
4. `adminmenu.smx` tiene que estar cargado para ver la categoría v34frag (viene con SourceMod).

## Pruebas

### Plugin con bots (servidor local, `$2000$`, `csstv_send 0`, compilado con `CSSTV_DEBUG=`)

Escenarios en [`pruebas/escenarios.sh`](pruebas/escenarios.sh).

| Caso | Resultado |
|---|---|
| `!team Shawn ct` / `!team #6 ct` | Mueve a ese bot |
| `!team @t spec`, `@spec t`, `@all spec`, `@all t` | Mueve al grupo: "Un admin pasó a 2 jugadores a espectador" |
| `!team @ct ct` | "Todos ya están en CT" |
| `!team a ct` (varios nicks con "a") | No mueve a nadie: "More than one client matched the given pattern" |
| `!swap` dos veces | Intercambia CT y T |
| `!live knife mr2` | "Ronda de cuchillo: Equipo Dan (CT) vs Equipo Pat (T)"; inventario de los bots: solo `weapon_knife` |
| `!stay` antes de que haya ganador | "!stay y !switch solo sirven después de ganar la ronda de cuchillo" |
| `!switch` de un bot del equipo perdedor | "Solo puede elegir el Equipo Pat, que ganó la ronda de cuchillo" |
| `!switch` del ganador | "Pat eligió cambiar de lado: el Equipo Pat juega de CT"; LO3 y partida con los lados cambiados (`a_side` = T en la ronda 1 del JSON) |
| Cuchillo sin elección (`csstv_knife_time 10`) | "Nadie eligió a tiempo: el Equipo Nick se queda en su lado" |
| Reconexión: `kick Nick` y `bot_add_ct Nick` en plena partida | El bot entra de CT y el plugin lo pasa a T: "Nick volvió y sigue en el Equipo Nick"; kills/muertes del TAB restaurados |
| Fin normal (MR2) | Resumen completo (resultado, MVP, top 3, línea privada a cada uno); JSON con `team_names: {a: "Dan", b: "Pat"}` |
| `!gg` del equipo que va ganando | "Solo se puede rendir el equipo que pierde por 1 ronda o más (van 1 - 0)" |
| `!gg` con 1 jugador en el equipo | Votación de 1 voto y rendición inmediata |
| `!gg` 2 vs 2 con `csstv_gg_missing 0` | "necesita 2 votos… Votos: 1/2", "Ya votaste !gg", "Keith votó gg (2/2)", "Equipo Nick se rindió (gg). Equipo Derek 1 - 0 Equipo Nick. ¡Gana Equipo Derek!" |
| JSON de la rendición | `status: finished`, `end_reason: surrender`, `winner: a` |

**No probado con bots:**

- **El bloqueo de compras en el cuchillo:** `$2000$` no tiene zona de compra.
- **El vencimiento de la votación de `!gg`:** es un timer simple.
- **Los colores del resumen y el `%` del HS en un cliente real.**

### Menú de admin (Daniel, con su cliente, 2026-10-13)

"Funciona bien". Los menús no se pueden probar con bots ni desde la consola.

### Migración (PostgreSQL 18 local)

Igual que en la licencia: stub de Supabase, todas las migraciones en orden, la nueva **dos veces** y después [`pruebas/pruebas_rendicion.sql`](pruebas/pruebas_rendicion.sql). Las 6 pasan (2026-10-13):

| # | Prueba | Resultado |
|---|---|---|
| R1 | Rendición con nombres | `finished`, `end_reason = surrender`, gana el equipo A, equipos "Equipo daniloev" y "Equipo pepe" |
| R2 | ELO de la rendida | `elo_apply_match` cambia el ELO de los 4 jugadores |
| R3 | Resultado de un plugin anterior | "Mix de daniloev" / "Mix de pepe", `end_reason` null |
| R4 | Nombres vacíos, motivo desconocido, cancelada con `end_reason` | Se ignoran |
| R5 | Nick largo | Se corta a 20 caracteres |
| R6 | `end_reason = 'otro'` | Lo rechaza la restricción |

## En qué se apartó del plan

- **`!live` exige al menos 2 jugadores en los equipos.** Sin mínimo de `csstv_min_players`, pero con 0 o 1 jugador no hay partida posible.
- **Reconexión más robusta:** además del movimiento automático 1 s después de entrar, si el jugador alcanza a elegir equipo antes, el `jointeam` lo coloca en el suyo (y lo corrige si quedó del otro lado).
- **SourceTV:** se excluye de `!team`, del menú, de los nombres de equipo, de `!swap` y del conteo de jugadores. En la primera prueba `@all` lo había pasado a T.
- **`live.cfg`:** se corrigió un `;` en un comentario que generaba `Unknown command "el"` (no estaba en el plan).

## Incidentes durante las pruebas

- **`@all` movió al bot de SourceTV a T.** Se corrigió (ver arriba) y se cambió de mapa para limpiar.
- **`bot_quota 0` sacó a todos los bots** en medio de la prueba de `!gg`. La partida se canceló con `sm_cancelmatch` y su resultado se borró de la cola local. Nada se envió: `csstv_send 0` en todo momento (se puso en el `csstv_reporter.cfg` local, que se recarga en cada cambio de mapa).
- Los resultados de las partidas de prueba se borraron de `data/csstv/queue/`.

## Cómo revertir

1. **Plugin:** en el servidor real, volver a poner `plugins/disabled/csstv_reporter_1.5.0.smx` como `plugins/csstv_reporter.smx` y cambiar de mapa. Los cvars nuevos del cfg se pueden dejar.
2. **Web:** publicar el `index.html` anterior (o dejarlo: sin `end_reason` no muestra nada distinto).
3. **Supabase:** volver a ejecutar `supabase/migrations/20261012140000_motivo_abandono.sql` (restaura `csstv_ingest` anterior). La columna se puede dejar o borrar con `alter table public.matches drop column end_reason;`.
4. **Repo:** `git revert` del commit de este requerimiento.

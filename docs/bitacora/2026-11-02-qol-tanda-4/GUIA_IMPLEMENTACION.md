# QOL, cuarta tanda: guía de implementación

## Estado

Hecho y probado con bots en local el 2026-11-02. **Subido el 2026-11-02 a flow, MVZG y `aurav34`**. En MVZG el reporter es la 2.9.2 (la 2.9.1 de Daniel con esta tanda), subida el 2026-11-03. Entra en el próximo cambio de mapa, sin recargar nada. Falta la prueba con jugadores.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | 2.8.7: `csstv_state`, `!faltan` y la llamada al resumen del medio tiempo |
| `server/addons/sourcemod/scripting/csstv/qol.inc` | Pitidos, `!pause` del coach, pausa en pantalla, marcador en `hostname` y `tv_title`, mensajes a la SourceTV y sus ConVars |
| `server/addons/sourcemod/scripting/csstv/summary.inc` | `Summary_Half` (0,3 s después del fin de la ronda, y en el centro para la SourceTV) |
| `server/addons/sourcemod/scripting/csstv/rr.inc` | `!rr` de los capitanes (`Cmd_RrEntry`); permiso de admin con `csstv_rr_admin` |
| `server/addons/sourcemod/scripting/csstv_qol.sp` | 1.2.0: estado por ConVar, silencio en el clutch, `!voz`, plata para casters, 4k y ace, la C4, espectadores, nombres, `!admins`, despedida y `kill` bloqueado |
| `server/addons/sourcemod/scripting/csstv_coach.sp` | 1.1.0: primera persona, rivales solo si se ven, plata del equipo, natives `CSSTV_IsCoach` y `CSSTV_CoachSide`, `sm_coach_status` |
| `server/addons/sourcemod/scripting/csstv_pedir.sp` | 1.0.1: estado por ConVar |
| `server/addons/sourcemod/scripting/v34_retake.sp`, `v34_wingman.sp`, `v34_dm.sp` | 1.0.1: `sm_*_on` y estado del reporter por ConVar |
| `server/cfg/sourcemod/csstv_reporter.cfg`, `csstv_qol.cfg` | ConVars nuevas |

## Versiones del reporter

| Línea | Versión | Cómo se arma |
|---|---|---|
| Producción (flow y MVZG, y `disabled/` en `aurav34`) | 2.7.7 | `git worktree add --detach <carpeta> 6898c05`, `git apply ../2026-11-02-qol-tanda-3/pruebas/reporter-2.7.6.patch` y `git apply pruebas/reporter-2.7.7.patch` |
| `kyan/pruebas` | 2.8.7 | En la rama |

## Después del plan

Kyan eligió 14 ideas más de una lista de 50 (1, 8, 9, 31, 34, 36, 37, 38, 39, 40, 41, 42, 49 y 50) y entraron en esta misma tanda, que todavía no estaba subida. La 31 no necesitó código. Los avisos de fin de ronda de `csstv_qol` pasaron a salir 0,3 s después para que queden en la demo.

Después eligió 6 de una lista de 30 más (15, 16, 18, 21, 29 y 30): plata y `!pause` para el coach, `!rr` de los capitanes, MVP del medio tiempo para la SourceTV y `kill` bloqueado. La 30 (`!rtv` en vivo) ya estaba.

## Despliegue (hecho el 2026-11-02)

A pedido de Kyan, en la misma tanda. Antes de reemplazar se comprobó el tamaño de cada archivo que había (el reporter 2.7.6 y los plugins de la tercera tanda), y cada archivo subido se comparó byte a byte con el local.

| Servidor | Qué recibió | Respaldo en `plugins/disabled/` y `cfg/sourcemod/` |
|---|---|---|
| flow (`SERVER2_*`) | Reporter 2.7.7 licenciado (132336 bytes), `csstv_qol` 1.2.0, `csstv_coach` 1.1.0, `csstv_pedir` 1.0.1 y `v34_dm` 1.0.1 | `csstv_reporter_2.7.6.smx`, `csstv_qol_1.1.0.smx`, `csstv_coach_1.0.0.smx`, `csstv_pedir_1.0.0.smx`, `v34_dm_1.0.0.smx`, `csstv_reporter.cfg.bak_277` y `csstv_qol.cfg.bak_120` |
| `aurav34` (`SFTP_CSS_*`) | Reporter 2.7.7 genérico en `plugins/disabled/` (132317 bytes, sigue desactivado), los mismos `csstv_*`, `v34_retake` y `v34_wingman` 1.0.1 | Los mismos, con `v34_retake_1.0.0.smx` y `v34_wingman_1.0.0.smx` |
| MVZG (`SERVER3_*`) | `csstv_qol` 1.2.0, `csstv_coach` 1.1.0, `csstv_pedir` 1.0.1, `v34_dm` 1.0.1 y `csstv_qol.cfg`. **El reporter no** | Los de los plugins y `csstv_qol.cfg.bak_120` |

- `csstv_reporter.cfg` recibió `csstv_round_sounds`, `csstv_half_summary`, `csstv_score_title` y `csstv_pause_hud` (flow y `aurav34`). `csstv_qol.cfg` recibió las 9 ConVars nuevas en los tres. `csstv_qol_end_kick` sigue en `40` en MVZG y en `0` en los otros.

### MVZG: el reporter 2.9.x (2026-11-02)

Al revisar MVZG antes de subir apareció un reporter que no es el nuestro: 141959 bytes, de las 21:21 del 2026-11-02, con un `csstv_reporter_2.9.0.smx` de las 18:56 en `disabled/` y la 2.7.6 movida ahí. Su `csstv_reporter.cfg` tiene `csstv_mm "1"` ("reservas de torneo y PCW (2.9.0)"), `csstv_claim "1"` y `csstv_server_tag "srv1"`. La 2.9 no está en ninguna rama del repositorio, local ni de GitHub, así que no se le pudieron sumar los cambios de esta tanda:

- Se dejó su reporter y su `csstv_reporter.cfg` sin tocar. Los plugins aparte funcionan con él porque, sin `csstv_state`, leen el estado por el comando como antes. Por eso en MVZG la consola se seguía llenando, hasta la 2.9.2.
- Faltaba en MVZG lo que vive en el reporter: `csstv_state`, pitidos, resumen del medio tiempo, `!faltan`, pausa en pantalla, marcador en el nombre, mensajes a la SourceTV, `!pause` del coach y `!rr` de los capitanes.
### MVZG: 2.9.2 (2026-11-03)

- Daniel subió la 2.9.1 a `feat/mm-claim-en-sala` (`eea1821`), que ya tenía nuestra tercera tanda. A pedido de Kyan se unió esa rama con `kyan/pruebas` (commit de la unión `8693f59`). El único conflicto fue la versión, que queda **2.9.2**: la 2.9.1 más esta tanda.
- Pruebas con bots de la 2.9.2 (`qol4`, `qol4b` y `qol4c`): mismos resultados que con la 2.8.7. `qol4.sh` ya no pasa de la primera ronda porque mata a los bots con `kill`, que ahora está bloqueado en la partida. En una corrida de `qol4c` el MVP del medio tiempo no quedó en la demo: la partida se canceló a los pocos segundos y la SourceTV va atrasada. En las corridas anteriores, con el mismo código, sí quedó.
- Licenciado de MVZG (`server/build_licenciado.sh 96bb5060-a639-483a-94ef-f15135c57b1b mvzg`), 146398 bytes. Antes de subir se comprobó que el que había era la 2.9.1 (141959 bytes). Respaldo en `plugins/disabled/csstv_reporter_2.9.1.smx` y `cfg/sourcemod/csstv_reporter.cfg.bak_292`.
- `csstv_reporter.cfg` de MVZG: se le sumaron las 4 ConVars de esta tanda. `csstv_mm "1"`, `csstv_claim "1"` y lo demás de Daniel quedaron igual.
- Con eso MVZG tiene todo lo de esta tanda, también la consola limpia.

### Arreglos después de subir (2026-11-03)

Kyan probó en el servidor y encontró dos cosas:

| Problema | Causa | Arreglo | Prueba con bots | Subido |
|---|---|---|---|---|
| El coach seguía en tercera persona | En este motor no existe la cámara de congelado: primera persona es el modo **3** y el 4 es la de persecución. El plugin forzaba el 4 (ya lo decía la bitácora `2026-10-23-clips-video`) | `csstv_coach` 1.1.1: `OBS_IN_EYE 3` | `pruebas/coach_camara.sh`: modo 3 al anotarse, después de tres `spec_mode` y al morir el que miraba (pasa a otro) | flow, MVZG y `aurav34`, con respaldo `plugins/disabled/csstv_coach_1.1.0.smx` |
| En el calentamiento no desaparecen los cuerpos ni las armas | Con el reaparecer del calentamiento no hay reinicio de ronda que limpie el mapa | `csstv_qol` 1.2.1: el cuerpo (`cs_ragdoll` cuyo `m_hPlayer` es el muerto; en v34 el jugador no tiene `m_hRagdoll`) a los 2 s, y el arma tirada que nadie levantó a los `csstv_qol_warmup_cleanup` (8) s, menos la C4. Solo con el reporter en calentamiento | `pruebas/limpieza.sh`: 2 cuerpos → 0 a los 3,5 s; armas en el piso → 0 a los 10 s | flow, MVZG y `aurav34`, con respaldo `plugins/disabled/csstv_qol_1.2.0.smx` y `csstv_qol.cfg.bak_121`; `csstv_qol_warmup_cleanup "8"` en los tres |

### Entrar con un clic y deathmatch en el calentamiento (2026-11-03)

Kyan eligió dos ideas más (12 y 13 de la lista de "el mejor matchmaking").

| Qué | Dónde | Prueba |
|---|---|---|
| **Deathmatch mientras esperan:** en el calentamiento, al aparecer, un arma gratis (AK-47 para los T, M4A1 para los CT, o la de `!armas` / `!armas awp`) y chaleco con casco. Comprar no sirve: quien reaparece a mitad de la ronda ya no tiene tiempo de compra | `csstv_qol` 1.3.0 (`csstv_qol_warmup_guns "1"`) | `pruebas/dm_calentamiento.sh`, con `mp_startmoney 0` para que los bots no compren: Bert (CT) con M4A1 y Albert (T) con AK-47, los dos con chaleco 100; `!armas awp` le cambia el arma en el momento y la mantiene al reaparecer; en vivo no da nada (Cecil, solo USP). A los bots SourceMod no les muestra menús: el menú se prueba con jugadores |
| **Entrar con un clic:** el botón Conectar de la sala y "Volver a la partida" usaban `steam://`, que abre el CS:S de Steam y no el v34 de ClientMod. Ahora usan `cmleague://connect/<ip:puerto>/<contraseña>`, que atiende **CMLeague Conectar** (`hud/conectar/`): se instala una vez con `conectar.bat` (registra el protocolo para el usuario, sin administrador, y busca la carpeta con `CMLauncher.exe`). Con el juego abierto escribe `password …; connect …` en la consola; cerrado, abre el launcher y espera hasta 3 minutos la ventana del juego. Siempre deja el comando copiado | `hud/conectar/conectar.ps1` y `.bat`; la web en `web/frontend/src/features/matchmaking/` (`cmleagueConnectUrl`, `RoomOverview`, `ReconnectBanner`) y la descarga `web/frontend/public/descargas/cmleague-conectar.zip` | `conectar.ps1 -Prueba` con 7 links: los dos buenos dan el comando; con espacio, `;`, puerto imposible, un dominio o comillas, "Ese link no es de una partida de CMLeague". Las contraseñas del matchmaking son letras y números (`Mm_RotatePassword`), dentro de lo que acepta. Web: 43 pruebas del matchmaking, `tsc`, `eslint` y `prettier` en verde. **Falta probarlo en una PC con el juego:** instalar, tocar el botón con el juego abierto y con el juego cerrado |

- Para escribir en el juego, CMLeague Conectar se vuelve a abrir como administrador, igual que la cámara del HUD: Windows pide permiso en cada clic.
- El link puede venir de cualquier página. Por eso solo acepta una IP con puerto y una contraseña de letras, números, `-` y `_`: nadie puede meter otros comandos en la consola.
- **Web:** el cambio queda en `kyan/pruebas`. El frontend lo despliega quien despliega la web.
- Las pruebas con bots ahora mandan la ventana del srcds al segundo monitor (`pruebas/segundo_monitor.ps1`, pedido de Kyan).
- **Subido el 2026-11-03:** `csstv_qol` 1.3.0 (34646 bytes) a flow, MVZG y `aurav34`, comprobando antes que estaba la 1.2.1. Respaldo en `plugins/disabled/csstv_qol_1.2.1.smx` y `cfg/sourcemod/csstv_qol.cfg.bak_130`; `csstv_qol_warmup_guns "1"` en los tres.

## Pruebas con bots (`cssds`, 2026-11-02)

`pruebas/qol4.sh <carpeta con los .smx>`, con `-condebug`, el reporter de depuración, `v34_dm` y `v34_retake` cargados y `qol_prueba.smx` de la tercera tanda. Se corrió con la 2.8.7 y con la 2.7.7.

| Prueba | Antes (control con las versiones anteriores) | Ahora |
|---|---|---|
| Líneas con "estado:" en la consola en 20 s de calentamiento | 120 | 0 |
| "Uso: sm_dm" en la consola en 20 s | 84 | 0 |
| Total en toda la prueba | 690 y 460 | 0 y 0 |

| Prueba | Resultado |
|---|---|
| `sm_qol_status` | "reporter: calentamiento · otro modo: no", leído de `csstv_state` y `sm_dm_on` / `sm_retake_on` |
| `!faltan` | "Listos 0/5. Faltan: Albert, Allen, Bert, Bob, Brett", y después de dos `!ready`, "Listos 2/5. Faltan: Allen, Bob, Brett" |
| `!coach ct` | Brett pasa a espectador (equipo 1) |
| Plata | "CT $100 (eco) · T $5.900 (compra completa)" en `sm_qol_status` |
| Ronda 3 de un mr3 | "Última ronda antes del cambio de lado." |
| Medio tiempo | "MVP hasta ahora: Albert (0 kills, 0 ADR)" y "Mejor ADR: 1. Albert 0 · 2. Allen 0 · 3. Bert 0" (los bots murieron por consola, sin daño) |
| Ronda 4 | "Match point para el Equipo Albert." |
| Errores | Ninguno |

### Segunda prueba: las 14 ideas (`pruebas/qol4b.sh`)

Con `+tv_enable 1` para revisar la demo. Los bots quedan quietos y sin disparar, y `sm_t_kill` (en `pruebas/qol_prueba.sp`) avisa la muerte con atacante y mata a la víctima, porque el daño de SDKHooks no mata en este servidor. Corrida con la 2.8.7 y con la 2.7.7.

| Prueba | Resultado |
|---|---|
| Armas en el piso | 5 en el calentamiento, 0 después del LO3 (las saca el juego) |
| Marcador | "CSS v34 ClientMod Server \| 0-1" y "SourceTV \| 0-0" en vivo; al cancelar, los nombres originales |
| La C4 | "la tiene Albert", y en otra ronda "Allen murió con la C4 en la base T" |
| 4 kills | "Albert 4" |
| Nombre | `sm_rename Allen Pepe` se deshace: no hay ningún Pepe |
| `!admins` | "No hay admins conectados. Usá !calladmin si necesitás uno." |
| Despedida | Al expulsar a Elmer: "Elmer -1/1" |
| Demo | Encabezados de ronda, plata, mejor de la ronda, "hizo 4 kills", la pausa en pantalla (19 actualizaciones) y la despedida. No están el marcador de fin de ronda ni el resumen, que el reporter manda en el instante del fin |
| Errores | Ninguno |

### Tercera prueba: coach, `!rr`, `kill`, `!rtv` y el MVP (`pruebas/qol4c.sh`)

Con Brett de coach CT. Corrida con la 2.8.7 y con la 2.7.7.

| Prueba | Resultado |
|---|---|
| Plata del coach | `sm_coach_status`: "última plata total: 2400" |
| `!pause` del coach | "Brett pidió una pausa para el Equipo Bert…" (en el freezetime, "Dura 60 segundos…") |
| `kill` y `explode` | Albert sigue vivo |
| `!rtv` en vivo | "El mapa solo se puede votar en el calentamiento." |
| `!rr` de alguien que no es capitán | "!rr lo pide el capitán de tu equipo: Allen." |
| `!rr` de los dos capitanes | "Bert (Equipo Bert) pide repetir la ronda…" y, con el segundo, la ronda se repite |
| Demo | "MVP hasta ahora" (en el chat y en el centro), "Mejor ADR", "pide repetir" y "repite la ronda" |
| Errores | Ninguno |

En la primera versión, un jugador sin admin repetía la ronda directo: el permiso se preguntaba con el nombre `sm_rr`, que ya era un comando para todos. Se cambió a `csstv_rr_admin`.

### Falta probar con jugadores

1. El coach: que no vea a los rivales en el mapa ni a través de paredes, y que sí los vea cuando su compañero los tiene enfrente. Que `spec_mode` no lo saque de la primera persona.
2. El silencio en el clutch y `!voz` (con bots no se puede: el silencio es solo para humanos).
3. Que los pitidos se escuchen.
4. Espectadores sin chat general ni voz en vivo (con bots no se puede).
5. Cómo se ve la pausa en el cuadro de ayuda.
6. Que el nombre bloqueado funcione con el cambio de nombre del juego (en la prueba se usó `sm_rename`).
7. Que el coach vea su plata y pueda pausar desde el juego, y que un admin real siga usando `!rr` directo.

## Cómo revertir

- Las ConVars nuevas en 0.
- Las versiones anteriores siguen en la rama (`git show 74fa6d9:<archivo>`) y, para el reporter, en `pruebas/reporter-2.7.6.patch` de la tercera tanda.

# v34frag

Web de esports (SPA en `index.html` + Supabase) y plugin de SourceMod `csstv_reporter` para un servidor de Counter-Strike: Source v34, más un Worker de Cloudflare para las demos (`cloudflare/demo-worker`).

**Antes de empezar, lee [`docs/PENDIENTES.md`](docs/PENDIENTES.md)**: ahí está todo lo que quedó sin terminar o sin desplegar, el estado del repo (hay cambios sin commit) y el contexto de los servidores.

## Convenciones

- **Permisos:** Kyan tiene los mismos permisos que Daniel. Todo lo que en este archivo o en `docs/` dice que pide, aprueba o decide Daniel puede pedirlo, aprobarlo o decidirlo también Kyan.
- **Bitácora:** cada requerimiento va en `docs/bitacora/AAAA-MM-DD-slug/`:
  - `PLAN.md`: se escribe antes de implementar y no se edita después.
  - `DOCUMENTACION.md` y `GUIA_IMPLEMENTACION.md`: al terminar.
  - `pruebas/`: opcional.
  - Una fila nueva en `docs/bitacora/README.md`.
  - El formato está en `docs/bitacora/PLANTILLA.md`. Todo en español, con diagramas Mermaid.
- **Manual de usuario:** `docs/manual/<sección>/<tarea>.md`, uno por tarea y por rol, que la web muestra en `/help` (solo con sesión y filtrado por rol). Cada `DOCUMENTACION.md` lleva la sección "Qué cambia para cada rol" y, al terminar el requerimiento, se actualizan las páginas del manual que nombra, en el mismo commit. Estilo y formato: [`docs/manual/README.md`](docs/manual/README.md).
- **Comandos del servidor en el manual (Daniel, 2026-11-06):** todo plugin nuevo, y todo comando nuevo o cambiado de un plugin, documenta su uso en la página del manual del rol que lo usa, en el mismo commit: `jugador/comandos-en-el-servidor.md` (o `jugador/otros-modos.md` para deathmatch, retake y 2v2), `capitan/comandos-en-el-servidor.md`, `moderador/comandos-en-el-servidor.md` (grupo `Moderador`, flags `bcdfj`) o `admin/comandos-en-el-servidor.md`. El rol sale del permiso del comando: sin flag es del jugador (o del capitán, si solo le responde a él), con `b`, `c`, `d`, `f` o `j` del moderador, y con cualquier otro (`e`, `g`, `m`, `z`…) del admin. Organizador, streamer y dueño de un servidor externo no tienen comandos en el juego. Detalle: [`2026-11-06-comandos-en-el-manual`](docs/bitacora/2026-11-06-comandos-en-el-manual/).
- **Términos y privacidad (Daniel, 2026-11-03):** todo requerimiento nuevo puede cambiar lo que dicen `/terminos` y `/privacidad`, igual que el manual de usuario. Al planear, se revisa si toca datos que se guardan o publican, servicios externos, plazos, sanciones, pagos o lo que puede hacer cada rol. Si los toca, se actualizan la página de la web (`web/frontend/src/features/legal/pages/`) y su `.html` de `terms/` (dicen lo mismo), en el mismo commit. Lo planteado y no hecho lleva la marca "En preparación" (`Wip` en la web, `<span class="pending">` en los `.html`), y se le quita al implementarlo. Cada `DOCUMENTACION.md` lleva la sección "Términos y privacidad", aunque sea para decir "Sin cambios". Detalle: [`2026-11-03-legales-al-dia`](docs/bitacora/2026-11-03-legales-al-dia/).
- **Changelog para jugadores:** `CHANGELOG_DISCORD.txt` en la carpeta del requerimiento. Texto plano, primera línea `CMLeague X.Y.Z --  Changelog` (el nombre visible es CMLeague desde el 2026-10-22), con tuteo y sin detalles técnicos.
- **Commits:** Conventional Commits en español (`feat(servidor): …`, `docs(bitacora): …`). Solo cuando Daniel o Kyan lo piden.
- **Ramas:**
  - Commitear solo en la rama propia de quien pide el trabajo (las de Kyan son `kyan/*`).
  - Nunca hacer merge, rebase ni push a otra rama sin preguntar antes y tener un sí explícito.
  - Si el trabajo parece necesitar otra rama, por ejemplo `main` o `feat/*`, preguntar primero.
- **Ramas del matchmaking (Daniel, 2026-11-02):** `feat/frontend-fase-1` tiene el matchmaking completo (web, base, API, VPS y, desde el 2026-11-04, el reporter 2.9.3 y los plugins que corren en los servidores: [`2026-11-04-rama-igual-a-produccion`](docs/bitacora/2026-11-04-rama-igual-a-produccion/)) sin lo demás de kyan. Todo cambio del matchmaking en la base, la API, el VPS o el plugin se commitea **en las dos ramas**: `feat/frontend-fase-1` y `feat/mm-claim-en-sala` (worktree `v34frag-mmclaim`). La web va solo en `feat/frontend-fase-1`. No se hace merge de `feat/mm-claim-en-sala` ni de `kyan/pruebas` en el frontend: traen tienda, VIP, anticheat, retake y otras cosas que todavía no se implementan ([`2026-11-02-mm-en-rama-frontend`](docs/bitacora/2026-11-02-mm-en-rama-frontend/)).
- **Inventario de plugins y extensiones de terceros del #3 (el servidor real de ExtremeHost):** `docs/PLUGINS_EXTERNOS.md`.
- **Paquetes de JavaScript:** **pnpm** (12.8.1, con Corepack), nunca npm, en `web/backend` y `cloudflare/demo-worker`.
  - Instalar con `pnpm install --frozen-lockfile` y correr con `pnpm <script>` o `pnpm exec <bin>`.
  - Cada proyecto tiene un `pnpm-workspace.yaml` con antigüedad mínima de 7 días, `trustPolicy: no-downgrade` y la lista `allowBuilds` de paquetes autorizados a correr scripts de instalación.
  - Si hace falta instalar algo nuevo en la máquina, avisarle a Daniel o a Kyan y que lo instale uno de ellos.

## Despliegue

- **Numeración de los servidores (Daniel, 2026-11-02):**

  | # | Servidor | Acceso en el `.env` | Plugin |
  |---|---|---|---|
  | **#1** | "MVZG", nuestro. Mismo panel y misma máquina que flow (`190.104.34.3`), otro servidor. Se armó copiando el de flow. Desde el 2026-11-03 manda a producción (la base del VPS) y toma salas del matchmaking: fila `96bb5060-a639-483a-94ef-f15135c57b1b` "Server CM League #1". Tag `srv1` | `SFTP_CSS_*_MVZG` (`SFTP_CSS_SERVER_MVZG`, `_PORT_MVZG`, `_USER_MVZG`, `_PASSWORD_MVZG`). API key del panel: `SFTP_CSS_API_KEY` (desde el 2026-11-03; `https://panel-mvzg.com`, servidor `157703b5`; también ve el de flow). Kyan lo llama `SERVER3_*` en su máquina | `.smx` genérico (comprobado el 2026-11-04; Daniel lo permitió el 2026-11-02) |
  | **#2** | flow (externo). Sin matchmaking desde el 2026-11-03 (`csstv_mm "0"`, mix normal; Daniel). En producción es la fila `cedf12a8-…` "Server CM League #2", desde el 2026-11-03. La vieja `7b01c85b-…` quedó como "flow (histórico)", fuera del matchmaking, con sus partidas | `SERVER2_*` | Build licenciado (`server/licencias/server-cm-league-2/`) |
  | **#3** | "aurav34", el servidor real de siempre, en ExtremeHost (Pterodactyl). Hasta el 2026-11-02 se llamaba "#1". Desde el 2026-11-02 es el servidor de retake y 2vs2, con el reporter en `disabled/`. Tag `srv3` (antes `srv1`) | `SFTP_CSS_*` (sin sufijo) y `PTERO_PANEL_*` | `.smx` genérico |

  - En la bitácora y en los puntos viejos de `docs/PENDIENTES.md`, "#1" o "servidor real" es el de ExtremeHost (hoy #3), "#2" es RBK y "CMLeague #3" es flow (hoy #2). No se reescriben: son historia.
- **Siempre que se despliegue algo del servidor, va a todos en la misma tanda: #1, #2 (flow) y #3.** Ninguno se queda con una versión vieja del plugin.
  - Nuestros servidores (#1 y #3) reciben el `.smx` genérico, cada uno por su acceso SFTP (`SFTP_CSS_*_MVZG` y `SFTP_CSS_*`). El #1 también puede seguir con su build licenciado.
  - Para entrar por SFTP no hace falta `paramiko`: sirve el `sftp` de OpenSSH con la contraseña por `SSH_ASKPASS` (y `SSH_ASKPASS_REQUIRE=force`), los comandos por stdin (no con `-b`, que apaga la contraseña) y la clave del host verificada con `ssh-keyscan`. El `curl` de Git no negocia el cifrado con el panel del #1. El 2026-11-03 el SFTP de esa máquina (`190.104.34.3:2022`) dejó de responder un rato desde la PC de Daniel, pero sí desde el VPS: si vuelve a pasar, se puede correr desde ahí. Más tarde ese mismo día volvió a responder desde la PC. Cada servidor externo recibe su build licenciado (`server/build_licenciado.sh <license_key> <slug>`) por su propio acceso SFTP (`SERVER2_*` para flow, el #2, UUID `cedf12a8-…` desde el 2026-11-03; antes `7b01c85b-bc3e-4aa3-9ab5-3c2044157034`). flow no nos da consola, pero el SFTP funciona (verificado el 2026-10-28) y desde el 2026-11-02 tenemos la API key de su panel (`SERVER2_PANEL_API_KEY`, `https://panel-mvzg.com`, servidor `f337a7d9`; solo ve ese servidor) (ver ver [`docs/bitacora/2026-10-27-servidor-flow/`](docs/bitacora/2026-10-27-servidor-flow/) y [`2026-10-28-demos-servidores-externos`](docs/bitacora/2026-10-28-demos-servidores-externos/)). Lo que necesite la consola o la línea de arranque se le pide a flow.
  - Una tarea de despliegue al servidor no está terminada hasta que quedó subida en todos. La guía de implementación y `docs/PENDIENTES.md` tienen que nombrar cada servidor.
  - Si aparece un servidor externo nuevo, se suma a esta lista.
  - **RBK dejó de usarse el 2026-10-29** (Daniel): ya no se le despliega nada y no tiene número. Su build era `server/licencias/rbk/` y su acceso `SERVER1_*`. Las carpetas `bitacora/…-rbk-…` siguen como historia y como referencia para armar servidores nuevos.
- **Configuración obligatoria e igual en todos los servidores** (los que tenemos y los que lleguemos a tener). Decidido por Daniel el 2026-10-22. La referencia es el #3 (el servidor real de ExtremeHost): [`docs/bitacora/2026-10-22-rbk-igual-al-real/DOCUMENTACION.md`](docs/bitacora/2026-10-22-rbk-igual-al-real/DOCUMENTACION.md).
  - Stripper:Source con `addons/stripper/global_filters.cfg` (sin niebla) y `addons/stripper/maps/`.
  - Los mismos plugins y extensiones. Sin el anti-wallhack de KACR (`kacr_eyes_antiwall "0"`), con `Anti_Wallhack_Lite` y con `csstv_perf` (sostiene `fps_max 600`).
  - Los mismos `cfg/csstv/warmup.cfg`, `live.cfg` y `end.cfg`, las cfg por tipo de partida (`live_official.cfg`, `live_pcw.cfg`, `live_mm.cfg` y `live_mix.cfg`, desde el reporter 2.9.0) y el mismo `mapcycle.txt`.
  - Los mismos valores en `csstv_reporter.cfg` (prórroga MR3 con 12000, medio tiempo de 3 s) y en `server.cfg` (`sv_pure 2`, `phys_timescale 1.7`, `clientmod_smoke_type 2`, `sv_minupdaterate`/`sv_mincmdrate 100` y `sv_maxupdaterate`/`sv_maxcmdrate 101`).
  - Solo cambia lo propio de cada servidor: token, tag y licencia del reporter, `csstv_demo`, `hostname`, `tv_title`, contraseñas, admins, `csstv_calladmin_server` y `_address`, FastDL, y `csstv_hud_port` y `csstv_hud_key` (los da Administración › Servidores; desde el 2026-10-29, [`2026-10-29-hud-relay-vps`](docs/bitacora/2026-10-29-hud-relay-vps/)).
  - Todo cambio de configuración en un servidor se hace en todos en la misma tanda. Un servidor nuevo (como el #1) se arma copiando la configuración del #3 (script de referencia: `docs/bitacora/2026-10-22-rbk-igual-al-real/pruebas/rbk_igual.py`) y se compara con `comparar.py` antes de darlo por listo.

- **Acceso a los servidores: siempre primero por la API key del panel; SFTP solo cuando no se pueda por API** (Daniel, 2026-11-02). Vale para el Worker de demos (`PTERO_KEY_<panel_server_id>`) y para cualquier herramienta nueva.
  - Secretos `PTERO_KEY_*` del Worker `v34frag-demos`: `157703b5` (#1, desde el 2026-11-03) y `f337a7d9` (flow, #2). El #3 usa `PTERO_PANEL_API_KEY`. La de RBK (`edbee7d6`) se borró el 2026-11-03.
  - La API del cliente de Pterodactyl no deja editar la línea de arranque, solo sus variables.
- **SourceTV en el #1:** `tv_enable 1` y `tv_port 27065` van en su `server.cfg` (desde el 2026-11-03), porque su línea de arranque no los tiene y no se puede editar. El `tv_port` del `server.cfg` tiene que coincidir con el del arranque y con `game_servers.tv_port`.

## Cuidados

- **La base de producción está en el VPS desde el 2026-11-03 (20:50 UTC)**: Supabase con Docker (`deploy/supabase/`, comando `sudo sb`), pública en `https://db.cmleague.lat` (solo `/rest`, `/auth` y `/storage`). Postgres escucha solo en `127.0.0.1:5432`: desde la PC se entra por túnel (`ssh -L 5433:127.0.0.1:5432 ubuntu@<VPS>`), que es a donde apuntan `PG_*` del `.env`. El proyecto de la nube (`wmzfwsizashpszxlvpeb`, `NUBE_*` del `.env`) quedó sin uso y como vuelta atrás hasta el 2026-12-03: **no escribirle** ([`2026-11-03-supabase-en-vps`](docs/bitacora/2026-11-03-supabase-en-vps/)).
- Las credenciales están en el `.env` de la raíz, que no se versiona. No mostrarlas.
- El servidor local de pruebas (`E:\CSS DEDICATED SERVER\server`) **envía a la Supabase real**:
  - Poner `csstv_send 0` después de cada carga del cfg.
  - Vaciar `data/csstv/queue/` antes de reiniciar.
- **Nunca reiniciar, matar ni hacer `quit` de un servidor (#1, #2 o #3) con un mix en curso, ni dejar nada pendiente que pueda reiniciarlo durante un mix.** Un mix cortado no se recupera (Daniel, 2026-10-15). Antes de cualquier acción que reinicie:
  - Confirmar en el último `logs/L*.log` que el último evento de `csstv_reporter` es el cierre de la partida (`Resultado guardado en la cola` o `Resultado … enviado`) y no `en vivo`, cuchillo o `Grabando demo`.
  - Pedirle confirmación a Daniel justo antes, aunque ya lo haya aprobado.
  - Después, comprobar que el panel no quedó en "stopping" ni con otra acción pendiente. Si quedó, avisarle a Daniel de inmediato: el panel mata el contenedor a los 10 minutos.
- **No reiniciar el #3 con "Restart" del panel ni con la acción `restart` de su API.** `srcds_run` relanza el juego solo, el contenedor queda en "stopping" y a los 10 minutos el panel lo mata a la fuerza, aunque haya un mix en curso (pasó el 2026-10-15). Para reiniciar el juego, mandar `quit` a la consola: `srcds_run` lo vuelve a lanzar. Si el panel se traba en "stopping", usar Kill y después Start, sin nadie jugando. Por lo mismo, el panel del #3 muestra "starting" todo el tiempo.
- En ningún servidor (#1, #2 o #3) recargar el plugin con una partida en curso, porque la cancela. Los cambios se cargan en el próximo cambio de mapa.
- Los servidores de terceros (flow, el #2) llevan el build licenciado (`server/build_licenciado.sh`), nunca el `.smx` genérico.

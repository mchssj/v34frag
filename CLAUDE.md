# v34frag

Web de esports (SPA en `index.html` + Supabase) y plugin de SourceMod `csstv_reporter` para un servidor de Counter-Strike: Source v34, más un Worker de Cloudflare para las demos (`cloudflare/demo-worker`).

**Antes de empezar, lee [`docs/PENDIENTES.md`](docs/PENDIENTES.md)**: ahí está todo lo que quedó sin terminar o sin desplegar, el estado del repo (hay cambios sin commit) y el contexto de los servidores.

## Convenciones

- **Bitácora:** cada requerimiento va en `docs/bitacora/AAAA-MM-DD-slug/`:
  - `PLAN.md`: se escribe antes de implementar y no se edita después.
  - `DOCUMENTACION.md` y `GUIA_IMPLEMENTACION.md`: al terminar.
  - `pruebas/`: opcional.
  - Una fila nueva en `docs/bitacora/README.md`.
  - El formato está en `docs/bitacora/PLANTILLA.md`. Todo en español, con diagramas Mermaid.
- **Changelog para jugadores:** `CHANGELOG_DISCORD.txt` en la carpeta del requerimiento. Texto plano, primera línea `CMLeague X.Y.Z --  Changelog` (el nombre visible es CMLeague desde el 2026-10-22), con tuteo y sin detalles técnicos.
- **Commits:** Conventional Commits en español (`feat(servidor): …`, `docs(bitacora): …`). Solo cuando Daniel lo pide.
- **Inventario de plugins y extensiones de terceros del #3 (el servidor real de ExtremeHost):** `docs/PLUGINS_EXTERNOS.md`.
- **Paquetes de JavaScript:** **pnpm** (12.8.1, con Corepack), nunca npm, en `web/backend` y `cloudflare/demo-worker`.
  - Instalar con `pnpm install --frozen-lockfile` y correr con `pnpm <script>` o `pnpm exec <bin>`.
  - Cada proyecto tiene un `pnpm-workspace.yaml` con antigüedad mínima de 7 días, `trustPolicy: no-downgrade` y la lista `allowBuilds` de paquetes autorizados a correr scripts de instalación.
  - Si hace falta instalar algo nuevo en la máquina, avisarle a Daniel y que lo instale él.

## Despliegue

- **Numeración de los servidores (Daniel, 2026-11-02):**

  | # | Servidor | Acceso en el `.env` | Plugin |
  |---|---|---|---|
  | **#1** | "MVZG", nuestro. Mismo panel y misma máquina que flow (`190.104.34.3`), otro servidor. Se armó copiando el de flow. Es para probar el matchmaking: manda a la Supabase de staging. Tag `srv1` | `SFTP_CSS_*_MVZG` (`SFTP_CSS_SERVER_MVZG`, `_PORT_MVZG`, `_USER_MVZG`, `_PASSWORD_MVZG`). Kyan lo llama `SERVER3_*` en su máquina | Puede llevar el `.smx` genérico (Daniel, 2026-11-02). Hoy tiene un build licenciado (`96bb5060-…`) que subió kyan |
  | **#2** | flow (externo) | `SERVER2_*` | Build licenciado |
  | **#3** | "aurav34", el servidor real de siempre, en ExtremeHost (Pterodactyl). Hasta el 2026-11-02 se llamaba "#1". Desde el 2026-11-02 es el servidor de retake y 2vs2, con el reporter en `disabled/`. Tag `srv3` (antes `srv1`) | `SFTP_CSS_*` (sin sufijo) y `PTERO_PANEL_*` | `.smx` genérico |

  - En la bitácora y en los puntos viejos de `docs/PENDIENTES.md`, "#1" o "servidor real" es el de ExtremeHost (hoy #3), "#2" es RBK y "CMLeague #3" es flow (hoy #2). No se reescriben: son historia.
- **Siempre que se despliegue algo del servidor, va a todos en la misma tanda: #1, #2 (flow) y #3.** Ninguno se queda con una versión vieja del plugin.
  - Nuestros servidores (#1 y #3) reciben el `.smx` genérico, cada uno por su acceso SFTP (`SFTP_CSS_*_MVZG` y `SFTP_CSS_*`). El #1 también puede seguir con su build licenciado.
  - Para entrar por SFTP no hace falta `paramiko`: sirve el `sftp` de OpenSSH con la contraseña por `SSH_ASKPASS` (y `SSH_ASKPASS_REQUIRE=force`), los comandos por stdin (no con `-b`, que apaga la contraseña) y la clave del host verificada con `ssh-keyscan`. El `curl` de Git no negocia el cifrado con el panel del #1. Cada servidor externo recibe su build licenciado (`server/build_licenciado.sh <license_key> <slug>`) por su propio acceso SFTP (`SERVER2_*` para flow, el #2, UUID `7b01c85b-bc3e-4aa3-9ab5-3c2044157034`). flow no nos da consola, pero el SFTP funciona (verificado el 2026-10-28) y desde el 2026-11-02 tenemos la API key de su panel (`SERVER2_PANEL_API_KEY`, `https://panel-mvzg.com`, servidor `f337a7d9`; solo ve ese servidor) (ver ver [`docs/bitacora/2026-10-27-servidor-flow/`](docs/bitacora/2026-10-27-servidor-flow/) y [`2026-10-28-demos-servidores-externos`](docs/bitacora/2026-10-28-demos-servidores-externos/)). Lo que necesite la consola o la línea de arranque se le pide a flow.
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

## Cuidados

- Las credenciales están en el `.env` de la raíz, que no se versiona. No mostrarlas.
- El servidor local de pruebas (`E:\CSS DEDICATED SERVER\server`) **envía a la Supabase real**:
  - Poner `csstv_send 0` después de cada carga del cfg.
  - Vaciar `data/csstv/queue/` antes de reiniciar.
- En ningún servidor (#1, #2 o #3) recargar el plugin con una partida en curso, porque la cancela. Los cambios se cargan en el próximo cambio de mapa.
- Los servidores de terceros (flow, el #2) llevan el build licenciado (`server/build_licenciado.sh`), nunca el `.smx` genérico.

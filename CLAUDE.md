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
- **Inventario de plugins y extensiones de terceros del servidor real:** `docs/PLUGINS_EXTERNOS.md`.
- **Paquetes de JavaScript:** **pnpm** (12.8.1, con Corepack), nunca npm, en `web/backend` y `cloudflare/demo-worker`.
  - Instalar con `pnpm install --frozen-lockfile` y correr con `pnpm <script>` o `pnpm exec <bin>`.
  - Cada proyecto tiene un `pnpm-workspace.yaml` con antigüedad mínima de 7 días, `trustPolicy: no-downgrade` y la lista `allowBuilds` de paquetes autorizados a correr scripts de instalación.
  - Si hace falta instalar algo nuevo en la máquina, avisarle a Daniel y que lo instale él.

## Despliegue

- **Siempre que se despliegue algo del servidor a nuestro servidor real, se despliega también a los servidores externos (hoy RBK y flow) en la misma tanda.** Ninguno se queda con una versión vieja del plugin.
  - Nuestro servidor recibe el `.smx` genérico (`SFTP_CSS_*`). Cada servidor externo recibe su build licenciado (`server/build_licenciado.sh <license_key> <slug>`) por su propio acceso SFTP (`SERVER1_*` para RBK y `SERVER2_*` para flow, CMLeague #3, UUID `7b01c85b-bc3e-4aa3-9ab5-3c2044157034`). flow no nos da acceso a su panel (sin API key ni consola), pero el SFTP funciona (verificado el 2026-10-28; ver [`docs/bitacora/2026-10-27-servidor-flow/`](docs/bitacora/2026-10-27-servidor-flow/) y [`2026-10-28-demos-servidores-externos`](docs/bitacora/2026-10-28-demos-servidores-externos/)). Lo que necesite la consola o la línea de arranque se le pide a flow.
  - Una tarea de despliegue al servidor no está terminada hasta que quedó subida en todos. La guía de implementación y `docs/PENDIENTES.md` tienen que nombrar cada servidor.
  - Si aparece un servidor externo nuevo, se suma a esta lista.
- **Configuración obligatoria e igual en todos los servidores** (los que tenemos y los que lleguemos a tener). Decidido por Daniel el 2026-10-22. La referencia es nuestro servidor real: [`docs/bitacora/2026-10-22-rbk-igual-al-real/DOCUMENTACION.md`](docs/bitacora/2026-10-22-rbk-igual-al-real/DOCUMENTACION.md).
  - Stripper:Source con `addons/stripper/global_filters.cfg` (sin niebla) y `addons/stripper/maps/`.
  - Los mismos plugins y extensiones. Sin el anti-wallhack de KACR (`kacr_eyes_antiwall "0"`), con `Anti_Wallhack_Lite` y con `csstv_perf` (sostiene `fps_max 600`).
  - Los mismos `cfg/csstv/warmup.cfg`, `live.cfg` y `end.cfg`, y el mismo `mapcycle.txt`.
  - Los mismos valores en `csstv_reporter.cfg` (prórroga MR3 con 12000, medio tiempo de 3 s) y en `server.cfg` (`sv_pure 2`, `phys_timescale 1.7`, `clientmod_smoke_type 2`, `sv_minupdaterate`/`sv_mincmdrate 100` y `sv_maxupdaterate`/`sv_maxcmdrate 101`).
  - Solo cambia lo propio de cada servidor: token, tag y licencia del reporter, `csstv_demo`, `hostname`, `tv_title`, contraseñas, admins, `csstv_calladmin_server` y `_address`, FastDL, y `csstv_hud_port` y `csstv_hud_key` (los da Administración › Servidores; desde el 2026-10-29, [`2026-10-29-hud-relay-vps`](docs/bitacora/2026-10-29-hud-relay-vps/)).
  - Todo cambio de configuración en un servidor se hace en todos en la misma tanda. Un servidor nuevo se arma copiando la configuración del real (script de referencia: `docs/bitacora/2026-10-22-rbk-igual-al-real/pruebas/rbk_igual.py`) y se compara con `comparar.py` antes de darlo por listo.

## Cuidados

- Las credenciales están en el `.env` de la raíz, que no se versiona. No mostrarlas.
- El servidor local de pruebas (`E:\CSS DEDICATED SERVER\server`) **envía a la Supabase real**:
  - Poner `csstv_send 0` después de cada carga del cfg.
  - Vaciar `data/csstv/queue/` antes de reiniciar.
- En el servidor real no recargar el plugin con una partida en curso, porque la cancela. Los cambios se cargan en el próximo cambio de mapa.
- Los servidores de terceros (RBK) llevan el build licenciado (`server/build_licenciado.sh`), nunca el `.smx` genérico.

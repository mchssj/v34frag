# Relay del HUD en el VPS, administrado desde la web: guía de implementación

## Estado

2026-10-29: base, API, relay 2.0.0 y archivos del VPS commiteados (`ca36b9d`, `d3ca9e9`, `dce0825` y `91498a4`, en `feat/frontend-fase-1`). **Desplegado en el VPS contra staging** y **flow mandando al relay** (excepción autorizada por Daniel: solo flow, para probar). Falta la confirmación de la prueba con flow (ver "Prueba con flow"), el frontend, y el `.cfg` del real y de RBK.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/36_hud_relay.sql` y `README.md` | Nuevo: HUD de cada servidor, `hud_streamers`, `hud_relays`, `hud_sessions`, funciones, vistas y avisos |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/36_hud_relay.sql` y `pruebas/36_hud_relay.sql` | Nuevos: inversa y 46 pruebas |
| `web/backend/src/routes/hud.ts`, `schemas/hud.ts`, `services/hud.ts` | Nuevos: rutas, esquemas y armado de la respuesta |
| `web/backend/src/routes/admin-servers.ts`, `schemas/servers.ts` | `hud` en cada servidor |
| `web/backend/src/routes/me.ts`, `schemas/profile.ts`, `routes/admin-players.ts`, `schemas/admin.ts` | `streamer` en Mi perfil y en Administración › Usuarios |
| `web/backend/src/env.ts`, `src/app.ts`, `src/db/types.ts` | `HUD_BASE_URL`, rutas y tipos regenerados |
| `web/backend/test/unit/hud-routes.test.ts`, `test/integration/hud.test.ts`, `test/unit/me-routes.test.ts` | Pruebas |
| `hud/relay/src/hub.ts`, `channel.ts`, `remote.ts` | Nuevos: modo VPS, canal por servidor y configuración de la base |
| `hud/relay/src/server.ts`, `control.ts`, `config.ts`, `main.ts`, `assets.ts` | Rutas con token, control por streamer, modo VPS, `/healthz` y las páginas al lado del bundle |
| `hud/relay/public/*` | Rutas relativas y selector de servidor en `/control` |
| `hud/relay/scripts/build-node.mjs`, `simular.ts`, `package.json`, `.gitignore`, `README.md` | Build para el VPS, clave en el simulador y documentación |
| `hud/relay/test/vps.test.ts` | Nuevo: 16 pruebas |
| `deploy/vps/cmleague-hud.service`, `hud.json.example`, `Caddyfile`, `preparar.sh`, `desplegar.sh`, `api.env.example`, `README.md` | Relay en el VPS |
| `docs/frontend/contrato/admin.md`, `cuenta.md`, `notificaciones.md`, `README.md` | Contrato |
| `CLAUDE.md` | `csstv_hud_port` y `csstv_hud_key` pasan a ser propios de cada servidor |

## Despliegue (2026-10-29, contra staging)

1. **Staging al día** (con respaldo previo del esquema con `pg_dump`). Tenía las migraciones hasta `20261024180000` y el replanteo `01` a `30`, con las versiones viejas del `26` y del `28`. Se aplicaron, en orden: las migraciones `20261028120000_vip`, `20261028180000_clips_vip_reprocesar` y `20261028200000_demos_servidores_externos`; el `26` actual (vuelve a poner `steam_owner` en `match_clip_list`, que la migración de clips le saca); el aviso `clip_ready` del `28` actual (`create or replace` de `tg_notify_match_clips` y su trigger); los replanteos `31` a `36`; y `notify pgrst, 'reload schema'`. Resultado: la estructura (`estructura.sql`) es idéntica a la de la base local, salvo el `http` de los avatares de `local-overrides.sql` (solo local).
2. **Token del relay** en staging (`hud_relays`, nombre `vps`), generado en la PC; en el VPS solo está en `hud.json`.
3. **VPS** (lo corrió Daniel; el modo automático de Claude Code no deja escribir en servidores remotos): `Caddyfile`, unidades `cmleague-hud` y `cmleague-notify`, `ufw allow 27500:27519/udp`, `hud.json`, las fuentes de `C:\CSSv34_ClientMod\cstrike\resource\` y `HUD_BASE_URL` en `api.env`. Antes se comprobó que los archivos del VPS eran los del repo anterior. Después: `desplegar.sh api` y `desplegar.sh hud` (`91498a41bca2`) y `systemctl enable --now cmleague-hud cmleague-notify.timer`.
4. **Comprobado:** `https://hud.cmleague.lat/healthz` con certificado válido y `loaded: true`; sin token o con uno falso, 404; `Referrer-Policy: no-referrer`; la API en `91498a41bca2`; `cmleague-notify` corrió a las 17:30 sin error.
5. **flow en staging, solo para el HUD:** `190.104.34.3:27015`, SourceTV en `27064`, puerto del relay `27501`, HUD activo y un `token_hash` aleatorio (el reporter no puede usarlo). El relay abrió el 27501 en la siguiente consulta. La cuenta de ensayo (`kyantares`) tiene la marca de streamer; su link quedó en el scratchpad de la sesión.
6. **flow** (`SERVER2_*`, por SFTP con `flow_hud.py apply`, lo corrió Daniel): no tenía `csstv_hud.smx` (solo la extensión Socket y el `.cfg`), así que se subió el 1.1.0 del repo (14794 bytes) y el `.cfg` quedó con `csstv_hud "1"`, `hud.cmleague.lat`, `27501` y su clave. Vale desde el próximo cambio de mapa.

## Prueba con flow

Pendiente: flow tiene que cambiar de mapa (carga el plugin) y tener jugadores en T o CT (el plugin no manda nada con el servidor vacío).

## Pruebas

- **Base:** 46 pruebas SQL; una segunda aplicación aborta; la inversa deja las vistas con los mismos permisos y opciones. Las 28 de la `35` siguen en verde.
- **API:** 391 unitarias y 36 de integración en verde (las 4 del HUD recorren todo: configurar, dar la marca, generar el link, consultar como el relay y quitar la marca).
- **Relay:** 32 pruebas. Prueba de humo del modo VPS contra la Supabase local con el simulador (el streamer recibe el estado con el retraso, los tokens malos dan 404, y la base recibe la sesión, el último paquete y el relay visto), del modo local, del bundle de Node y de `relay.exe`.
- **Servidor de juego local:** no se pudo: no tiene la extensión Socket para Windows. Daniel eligió probar con flow en el VPS.

## En qué se apartó del plan

- **SourceTV:** no se agregó `tv_address`. Ya existía `tv_port` (replanteo `27`) y el host de `connect_address`: es lo que exige el HUD y lo que muestra el panel.
- **`hud_seen_at`** y el apagado automático del HUD al perder la SourceTV: no estaban en el plan.
- **Caddy:** `hud.cmleague.lat` no usa el bloque `comun` (la compresión retiene los eventos y su `Referrer-Policy` no es `no-referrer`), y su log no guarda la URL (lleva el token).
- **`/healthz`** en el relay, para `desplegar.sh hud`.
- **Prueba de punta a punta** con flow en el VPS en lugar del servidor local.

## Incidentes durante las pruebas

**2026-10-29, flow se congeló con el HUD prendido y 9 bots.** Con los logs que pasó kyan (`L20261029.log` y `csstv_perf_20261029.log`, hora del servidor UTC−3):

- 15:13–15:33: el HUD mandando y un jugador; 3000/3000 ticks, sin ticks tarde.
- 15:33:49: `bot_quota 9`. De 15:34 a 15:38 el servidor procesó 200–800 de ~3000 ticks (ticks de hasta 1,2 s).
- 15:38: cambio de mapa y otra vez `bot_quota 9`. De 15:39 a 15:41, con 9 bots y el HUD (1,6 paquetes/s), 2999/3000 ticks.
- No hubo reinicio: el log de `csstv_perf` sigue sin cortes hasta las 15:50.

Conclusión: **el HUD no fue**. El congelamiento empezó 11 s después de agregar los bots y se curó con el cambio de mapa: es lo que hace CS:S al generar en el momento el `.nav` de un mapa custom que no lo tiene (`de_dust2_ob`). Falta confirmar con kyan si existe `cstrike/maps/de_dust2_ob.nav`; si no, generarlo una vez con el servidor vacío (`nav_generate`). Mientras tanto se puso `csstv_hud 0` por consola en flow.

## Cómo apagar el HUD de un servidor (por ejemplo, si laguea)

| Qué | Cómo | Efecto en el servidor de juego |
|---|---|---|
| Al instante | En la consola del servidor (o en el juego como admin: `sm_rcon csstv_hud 0`): `csstv_hud 0` | Deja de armar y mandar paquetes en el acto. **Vuelve a `1` en el próximo cambio de mapa**, porque el plugin ejecuta `csstv_hud.cfg` en cada mapa |
| Que quede apagado | En `cfg/sourcemod/csstv_hud.cfg`: `csstv_hud "0"`. En flow, desde la raíz del repo: `python -I docs/bitacora/2026-10-29-hud-relay-vps/pruebas/flow_hud.py off` (con el `paramiko` de cualquier entorno virtual) | Desde el próximo cambio de mapa. Junto con lo anterior, queda apagado ya y para siempre |
| Sacar el plugin | `sm plugins unload csstv_hud` (no cancela partidas: es un plugin aparte) y borrar `addons/sourcemod/plugins/csstv_hud.smx` | Si no se borra el `.smx`, vuelve a cargar en el próximo mapa |
| Desde la web | Administración › Servidores y ELO › el servidor › HUD para streamers › Apagado › Guardar HUD | **No alivia al servidor**: el relay deja de atenderlo (en 30 s), pero el plugin sigue mandando. Sirve para cortar el HUD a los streamers |

En flow no tenemos consola: lo inmediato lo hace alguien de flow o un admin dentro del juego.

## Cómo revertir

- flow: `flow_hud.py off` (vuelve a `csstv_hud "0"`); el plugin puede quedar.
- VPS: `sudo systemctl disable --now cmleague-hud`; el `Caddyfile` anterior quedó en `/etc/caddy/Caddyfile.antes-hud`.
- Base: `reversas/36_hud_relay.sql`.
- Código: revertir los commits.

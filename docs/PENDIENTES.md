# Pendientes

Todo lo que se planteó o se empezó y todavía no está terminado o desplegado. Actualizado el **2026-10-24**.

Si retomas el proyecto en una sesión nueva, empieza por acá. El detalle de cada punto está en su carpeta de [`bitacora/`](bitacora/); el índice con todos los requerimientos es [`bitacora/README.md`](bitacora/README.md).

## Orden de trabajo (decidido por Daniel el 2026-10-15)

**Primero todo lo de la web** (base del replanteo, backend, frontend nuevo y plan del VPS). **Los plugins quedan para el final.**

Lo que está pendiente del lado del plugin, congelado hasta entonces:
- **Plugin 2.0.0 (`!match` y `!status`):** hecho y probado con bots. **Subido el 2026-10-17 dentro de la 2.1.0** (punto 1.7); `!match` funciona recién con el corte.
  - Faltan las pruebas manuales con jugadores reales ([`PRUEBAS_MANUALES.md`](bitacora/2026-10-15-match-y-status/PRUEBAS_MANUALES.md)), que además conviene hacer con la web nueva avanzada.
  - Falta el despliegue en el servidor real y en RBK (punto 1.5).
- **Excepción:** `csstv_allchat` (chat para vivos y muertos) se hizo y se subió el 2026-10-16, a pedido de Daniel, como plugin aparte (punto 1.0).
- **Excepción:** mixes en vivo y mixes interrumpidos (plugin **2.1.0**), pedido por Daniel el 2026-10-17 para el plugin y la web vieja. Hecho, probado en local y **desplegado el 2026-10-17** en la base, la web, el servidor real y RBK (punto 1.7).
- **Excepción:** `!sell` (`csstv_sell` 1.0.0), pedido del PO, empezado por Daniel el 2026-10-19 como plugin aparte. Hecho, probado con bots y **subido a los dos servidores el 2026-10-19**; falta el menú con un jugador (punto 1.8).
- **Excepción:** `!whois` (reporter **2.3.0**), pedido por Daniel el 2026-10-19: nicks que usó un jugador en las partidas y su perfil en la web, para admins y moderadores. Implementado sin probar y **desplegado el 2026-10-20** en la base, el servidor real y RBK (punto 1.10). El menú cuando hay varias coincidencias (reporter **2.3.1**) se implementó sin probar y se **desplegó el 2026-10-20** en la base y los dos servidores (punto 1.11).
- **Excepción:** `!calladmin` con Discord y rol de moderador (`csstv_calladmin` 1.0.0), pedido por Daniel el 2026-10-19 como plugin aparte. Aprobado, hecho, probado con bots y **subido a los dos servidores el 2026-10-19**, todavía sin moderadores (punto 1.9). El webhook y el ID del rol `@MOD` están en el `.env` (`DISCORD_CALLADMIN_WEBHOOK`, `DISCORD_MOD_ROLE_ID`).
- **Excepción:** consejos de comandos en el chat cada 3 minutos y el Discord al terminar la partida (reporter **2.4.0**), pedido por Daniel el 2026-10-20. Aprobado, hecho, probado con bots y **desplegado el 2026-10-20** en los dos servidores (punto 1.12).
- **Excepción:** clips automáticos (reporter **2.5.0**), pedido por Daniel el 2026-10-23 para que los clips se vayan juntando antes de la web nueva. Aprobado, hecho, probado con bots y **desplegado el 2026-10-23** en la base y los dos servidores (punto 1.16).
- **No se toca el plugin** salvo que un cambio en la base lo rompa. Si un requerimiento web necesita algo del plugin, se anota acá en lugar de hacerlo.

## Decisiones anotadas para planes futuros

- **Torneos** (cuando se planee la creación de torneos):
  - El creador del torneo define cuántos jugadores del plantel puede inscribir cada equipo, con un máximo de 10. El plantel de un equipo admite hasta 10.
  - El creador también decide el formato (BO1, BO3, BO5) de las partidas.
  - **Ranking de equipos:** cada partida de torneo ganada suma puntos (30 al principio, configurable). Decidir si vale más según la fase (grupos, playoffs, semifinal, final).
  - Hoy la regla de la `07` pide 5 jugadores en el plantel para inscribirse.
  - **Un jugador no puede estar inscrito en un mismo torneo con dos equipos** (un jugador sí puede estar en varios equipos). Desde la `10` se compara contra los jugadores inscritos (`tournament_registration_players`).
  - Hecho en la `10` (2026-10-15): inscritos por equipo, plantillas con BO por fase y puntos únicos por partida ganada.
  - Daniel, 2026-10-15.
- ~~**PCW "como equipo"**~~: hecho en la `10` (2026-10-15).
- **[`docs/frontend/contrato/`](frontend/contrato/README.md)** (antes `contract.md`, partido por módulos el 2026-10-19): contrato único para el frontend con todas las decisiones de diseño (escrito el 2026-10-15, pedido de Daniel). **Mantenerlo al día:** cada entrega del backend que cambie algo para el frontend actualiza el archivo de su módulo, las novedades del índice y `decisiones.md`.

## Estado del repositorio

| Qué | Estado |
|---|---|
| Plugin 1.8.0, ELO por participación, Accelerator, bitácoras de RBK y de esos tres requerimientos, `CLAUDE.md` y este archivo | **Commiteado en `main`** el 2026-10-14 (4 commits, sin push) |
| Backend API: `web/backend/`, `supabase/schema/`, bitácora `2026-10-14-backend-base-auth-perfil/` y lo que va con ella | En la rama `feat/backend-api-fase-1`, sin merge a `main` |
| Bitácora `2026-10-14-web-pages-worker/` (plan sin aprobar) | Sin commit |
| Mixes en vivo (2026-10-17): migración `20261017120000`, plugin 2.1.0, `index.html`, ajustes de las `04`, `06` y `10` del replanteo y su bitácora | Sin commit |
| `!sell`: `csstv_sell.sp`, su `.smx` y la bitácora `2026-10-18-plugin-sell/` (2026-10-19) | Commiteado el 2026-10-19 en la rama `feat/backend-api-fase-1` (sin push) |
| `!calladmin` y moderadores: `csstv_calladmin.sp`, su `.smx`, `cfg/sourcemod/csstv_calladmin.cfg`, la bitácora `2026-10-19-calladmin-moderadores/` y la guía de comandos en PDF (2026-10-19) | Commiteado el 2026-10-19 en la rama `feat/backend-api-fase-1` (sin push) |
| Cancelar el pedido de desvincular, fecha del cambio de contraseña y `401` de `/auth/me` (2026-10-19): replanteo `22` con su inversa y sus pruebas, `web/backend` (rutas, esquemas, errores, tipos y pruebas), contrato del frontend y la bitácora `2026-10-19-api-cancelar-desvincular-fecha-password/` | Commiteado el 2026-10-19 en la rama `feat/backend-api-fase-1` (sin push) |
| Desvincular un SteamID y elegir el principal (2026-10-19): replanteo `21` con su inversa y sus pruebas, `web/backend` (rutas, esquemas, tipos y pruebas), contrato del frontend y la bitácora `2026-10-19-api-steam-desvincular-principal/` | Commiteado el 2026-10-19 en la rama `feat/backend-api-fase-1` (sin push) |
| `!whois` (2026-10-19): migración `20261019180000_whois.sql`, replanteo `23` con su inversa y sus pruebas, `csstv/whois.inc`, `csstv_claim` en `claim.inc`, reporter 2.3.0 (`.sp` y `.smx`), `csstv_reporter.cfg` y la bitácora `2026-10-19-plugin-whois/` | Commiteado el 2026-10-20 en la rama `feat/backend-api-fase-1` (sin push) |
| Menú de `!whois` (2026-10-20): migración `20261020120000_whois_menu.sql`, replanteo `23` reescrito con su inversa y sus pruebas, `csstv/whois.inc`, reporter 2.3.1 (`.sp` y `.smx`) y la bitácora `2026-10-20-whois-menu/`; además el registro del despliegue de la 2.3.0 en este archivo y en `2026-10-19-plugin-whois/GUIA_IMPLEMENTACION.md` | Commiteado el 2026-10-20 en la rama `feat/backend-api-fase-1` (sin push) |
| Consejos en el chat y Discord (2026-10-20): `csstv/tips.inc`, `csstv/summary.inc`, reporter 2.4.0 (`.sp` y `.smx`), `csstv_reporter.cfg` y la bitácora `2026-10-20-consejos-y-discord/` | Commiteado el 2026-10-20 en la rama `feat/backend-api-fase-1` (sin push) |
| Ajustes manuales de ELO y sin recalcular (2026-10-21): replanteo `25` con su inversa y sus pruebas, `web/backend` (rutas y esquemas del ELO, tipos y pruebas), contrato del frontend y la bitácora `2026-10-21-ajustes-elo-admin/` | Commiteado el 2026-10-21 en la rama `feat/backend-api-fase-1` (sin push) |
| Temporadas (2026-10-21): replanteo `24` con su inversa y sus pruebas, `web/backend` (rutas, esquemas, tipos, script del cron y pruebas), contrato del frontend (`temporadas.md` y los demás módulos), el cron en el plan del VPS y la bitácora `2026-10-20-temporadas/` | Commiteado el 2026-10-21 en la rama `feat/backend-api-fase-1` (sin push) |
| Anti-wallhack y humo (2026-10-22): bitácora `2026-10-22-anti-wallhack-y-humo/`, `PENDIENTES.md` y `PLUGINS_EXTERNOS.md` | Commiteado el 2026-10-22 en la rama `feat/backend-api-fase-1` (sin push) |
| Nombre CMLeague (2026-10-22): fuentes y `.smx` de reporter 2.4.1, sell 1.0.1, calladmin 1.0.1 y allchat 1.0.2, cfgs de `server/cfg/sourcemod/`, `CLAUDE.md` y la bitácora `2026-10-22-nombre-cmleague/` | Commiteado el 2026-10-22 en la rama `feat/backend-api-fase-1` (sin push) |
| RBK igual al real (2026-10-22): `server/cfg/sourcemod/csstv_reporter.cfg` y la bitácora `2026-10-22-rbk-igual-al-real/`, y la regla de configuración obligatoria en `CLAUDE.md` | Commiteado el 2026-10-22 en la rama `feat/backend-api-fase-1` (sin push) |
| Clips automáticos (2026-10-23): migración `20261023120000`, replanteo `26` con su inversa y sus pruebas, `csstv/clips.inc` y los cambios del reporter 2.5.0 (`.sp` y `.smx`), `csstv_reporter.cfg`, `web/backend` (rutas, esquemas, tipos y pruebas), contrato del frontend y la bitácora `2026-10-22-clips-automaticos/` | Commiteado el 2026-10-23 en la rama `feat/backend-api-fase-1` (sin push) |
| Video de los clips (2026-10-23): `render/` (C1 y C2: lector de demos, render, `procesar.py`, R2, Drive, tarea y config de ejemplo), la migración `20261023180000_clips_video.sql`, la `26` y su inversa con el video, `cloudflare/clips-worker/`, `web/backend` (`video` en los clips, `CLIPS_BASE_URL`, tipos y pruebas), el contrato del frontend, `privacidad.html`, las bitácoras `2026-10-23-clips-video/` y `2026-10-23-clips-render-automatico/` y sus filas en `bitacora/README.md` | Commiteado el 2026-10-23 en la rama `feat/backend-api-fase-1` (sin push) |
| ~~`package.json` vacío en la raíz~~ | Borrado el 2026-10-24, a pedido de Daniel |
| `docs/GUIA_BACKEND_LOCAL.md` y el cambio de `web/backend/README.md` que la enlaza | Commiteado y subido el 2026-10-24 en `feat/backend-api-fase-1` (`241e6c7`) y mergeado en `feat/frontend-fase-1` |
| ~~`.idea/`, `message.txt`, `fb.jpg`, `sg.jpg` e `image.png`~~ | Borrados el 2026-10-24, a pedido de Daniel (queda `v34FRAGNATION_reglamento.pdf` sin commit) |
| API para los mockups de Mixes, Perfil público y Ranking (2026-10-24): replanteo `27` con su inversa y sus pruebas, `web/backend` (rutas `mixes.ts` y `ranking.ts`, perfil por nick, SteamID ocultos, borrar un mix, SourceTV, esquemas, tipos y pruebas), contrato del frontend y la bitácora `2026-10-24-api-mixes-perfil-ranking/` | Commiteado el 2026-10-24 en la rama `feat/backend-api-fase-1` (sin push) |

Mensajes de commit en formato Conventional Commits (`feat(servidor): …`, `docs(bitacora): …`), en español, como los anteriores.

## 1. Desplegar lo que ya está hecho

Ordenado por urgencia.

### 1.0 Chat para vivos y muertos (`csstv_allchat` 1.0.1): verificar en los dos servidores

- **Subido el 2026-10-16** al servidor real y a RBK (mismo `.smx`, sin licencia). Versión 1.0.1 (md5 `7ee903912264b7425e7d91517606e20a`): el chat de equipo lo lee solo el propio equipo, no los espectadores. La 1.0.0 quedó en `plugins/disabled/`. En RBK además se agregó `sm_deadtalk 2` al `live.cfg` (copia en `live.cfg.bak_20261016`).
- **Se carga en el próximo cambio de mapa.** Después, en cada servidor: `sm plugins list` muestra "CSSTV All Chat (1.0.1)", el log de errores no tiene `already one in progress` ni `Could not send a usermessage`, y con jugadores reales un vivo lee el chat de un muerto.
- **Si algo falla:** `csstv_allchat 0` en la consola lo apaga al instante.
- Publicar el changelog: `bitacora/2026-10-16-chat-vivos-muertos/CHANGELOG_DISCORD.txt`.
- **Bitácora:** [`2026-10-16-chat-vivos-muertos`](bitacora/2026-10-16-chat-vivos-muertos/)

### 1.1 Deploy del Worker con la ruta `/crash` (Accelerator) — urgente

- **Qué falta:** `cd cloudflare/demo-worker && pnpm install --frozen-lockfile && pnpm exec wrangler deploy` (desde el 2026-10-14 el proyecto usa pnpm). El secreto `CRASH_KEY` ya está cargado.
- **Por qué es urgente:** Accelerator ya está instalado en el servidor real y se activa en el próximo reinicio. Sin la ruta desplegada, cada volcado se pierde: Accelerator lo borra aunque falle la subida.
- **Comprobar:** `curl -X POST https://v34frag-demos.agusb06-ab.workers.dev/crash` tiene que responder 403. Hoy responde 404.
- **Después:** `sm exts list` en la consola del panel tiene que mostrar Accelerator 2.5.0. En el próximo crash, leer el volcado (pasos en la `DOCUMENTACION.md` de la bitácora).
- **Bitácora:** [`2026-10-14-crash-servidor-accelerator`](bitacora/2026-10-14-crash-servidor-accelerator/)
- El auto mode de Claude Code bloqueó el deploy: o lo corre Daniel (`! cd cloudflare/demo-worker && pnpm exec wrangler deploy`) o da el permiso.

### 1.2 ELO proporcional a las rondas jugadas — desplegado

- Desplegado el 2026-10-14: migración en Supabase e `index.html` publicado (la casilla "Recalcular todos los mixes" ahora viene desmarcada).
- Falta: revisar en el navegador Admin → Servidores → ELO (campos 35 y 90) y publicar el changelog en Discord.
- **Bitácora:** [`2026-10-14-elo-participacion-y-sourcetv`](bitacora/2026-10-14-elo-participacion-y-sourcetv/)

### 1.3 Plugin 1.8.0 (inicio por `!ready` con ronda de cuchillo)

- **RBK: subido el 2026-10-14** (build licenciado, 1.7.0 en `plugins/disabled/`). Se carga en el próximo cambio de mapa.
- **Servidor real: subido el 2026-10-14** (84034 bytes, md5 `750b78fc3ccdead24a0882a1b62a3379`; la 1.7.0 quedó en `plugins/disabled/csstv_reporter_1.7.0.smx`).
- Se carga en el próximo cambio de mapa en cada servidor. No recargar el plugin con una partida en curso, porque la cancela. Falta verificar con `sm_csstv_status` (o los logs) que diga `v1.8.0`.
- **Bitácora:** [`2026-10-14-ready-con-cuchillo`](bitacora/2026-10-14-ready-con-cuchillo/). El changelog para Discord está en esa carpeta.

### 1.4 RBK: SourceMod 1.10, Accelerator y ClientMod — hecho

- RBK reinició el 2026-10-14 a las 20:09: corre SourceMod 1.10.0.6490, Accelerator cargó y el plugin 1.8.0 licenciado validó su licencia.
- ClientMod no cargaba porque a RBK le faltaba `gamedata/clientmod.txt`. Se copió (junto con `clientmod_pickup.txt`) y después de los reinicios de las 20:14 y 20:17 cargan `clientmod.smx`, `CM_PickupWeapon.smx`, `IGN.smx` y `clientmod_deathnotice.smx`. **Resuelto.**
- Opcional: reemplazar los plugins base de 1.8 por los de 1.10.
- **Detalle y reversión:** [guía de RBK](bitacora/2026-10-13-servidor-rbk/GUIA_IMPLEMENTACION.md)

### 1.5 Corte del replanteo: migraciones 01 a 21 y plugin 2.0.0 (`!match` y `!status`) con 2.1.0 (mixes en vivo) y 2.2.0 (`!claim`)

Nada de esto se despliega antes del corte: la web vieja sigue usando la base de producción.

- **Base:** `supabase/replanteo/01` a `21`, en orden, con respaldo previo. La `16` necesita la migración de mixes en vivo (`20261017120000`), ya aplicada en producción. La `09` aborta si hay alias repetidos sin distinguir mayúsculas, la `10` si hay roles desconocidos y la `12` si hay nombres de servidor repetidos o IPs permitidas inválidas, y la `14` si hay Workers de demos con el mismo nombre (en la copia del 2026-10-14 no hay ninguno de esos casos).
- **La `15` necesita la migración de ajustes de ELO** (`supabase/migrations/20261015210000_elo_ajustes.sql`, punto 1.6) aplicada antes: si no está, aborta.
- **La `23` (`!whois`) necesita las migraciones de producción `20261019180000_whois.sql` y `20261020120000_whois_menu.sql`** (puntos 1.10 y 1.11) aplicadas antes. En el corte, `csstv_claim "1"` en los dos servidores.
- **La `25` (ajustes de ELO desde el admin)** va después de la `24`.
- **La `27` (mixes, perfil y ranking de la web nueva)** va después de la `26`. **Aborta si hay nicks repetidos** en `players` (sin distinguir mayúsculas): revisarlo antes con la consulta de su guía y renombrar las fichas sin cuenta que choquen. Después del corte, cargar el puerto de SourceTV (`tv_port`) del **servidor real y de RBK** en Admin › Servidores, para "Ver en TV". Pasos en [`2026-10-24-api-mixes-perfil-ranking`](bitacora/2026-10-24-api-mixes-perfil-ranking/GUIA_IMPLEMENTACION.md).
- **La `24` (temporadas)** va después de la `23`. Después del corte, abrir la temporada 1 desde el admin; el cierre automático necesita el VPS (punto 6).
- **Plugin 2.2.0 con `!claim`** (bitácora `2026-10-16-claim-steamid`, que lo llama 2.1.0: el número pasó a los mixes en vivo, punto 1.7): **hecho y probado con bots el 2026-10-18**, sin desplegar. Sale en esta misma tanda: genérico al servidor real y licenciado a RBK. Pasos en [`2026-10-18-plugin-claim`](bitacora/2026-10-18-plugin-claim/GUIA_IMPLEMENTACION.md).
- ~~**`sm_status`**~~: revisado el 2026-10-17 con `smx_grep.py` sobre todos los plugins de los dos servidores: ninguno lo registra.
- **Plugin 2.0.0:** ya está subido dentro de la 2.1.0 (punto 1.7), en el servidor real y en RBK. En el corte solo falta subir la 2.2.0 (`!claim`, ya hecha), por los mismos accesos y con el mismo cuidado (genérico al servidor real, licenciado a RBK).
- **Verificar después del corte:** `!match ZZZZZ` responde "No hay ninguna partida con ese código".
- **Changelog** para Discord: `bitacora/2026-10-15-match-y-status/CHANGELOG_DISCORD.txt` y `bitacora/2026-10-18-plugin-claim/CHANGELOG_DISCORD.txt`.
- **Bitácoras:** [`2026-10-14-replanteo-modelo-datos`](bitacora/2026-10-14-replanteo-modelo-datos/) y [`2026-10-15-match-y-status`](bitacora/2026-10-15-match-y-status/) (pasos exactos en su `GUIA_IMPLEMENTACION.md`).

### 1.6 Ajuste de ELO por el mix caído del 2026-10-15 — hecho

- **Aplicado en producción** (lo corrió Daniel en el SQL Editor): la migración `20261015210000_elo_ajustes.sql` y el ajuste `bitacora/2026-10-15-ajustes-elo/ajuste_2026-10-15_mix_caido.sql`. Verificado el 2026-10-16 con lecturas por la API pública: la tabla `elo_adjustments` existe y tiene los 4 ajustes de +20 (rbk, kyansuke, flow y honzzq), del 2026-10-15 a las 21:04 (hora de Colombia).
- **Por qué el mix no quedó en la base:** esa noche el servidor se cayó por el plugin "DeadChat" que se estaba probando (logs de errores del 2026-10-15, 21:39 a 21:43), así que el mix nunca terminó ni mandó resultado. Ver [`2026-10-16-chat-vivos-muertos`](bitacora/2026-10-16-chat-vivos-muertos/DOCUMENTACION.md).
- Es requisito de la migración `15` del replanteo (corte): ya está cumplido.
- **Bitácora:** [`2026-10-15-ajustes-elo`](bitacora/2026-10-15-ajustes-elo/)

### 1.7 Mixes en vivo y mixes interrumpidos (plugin 2.1.0): verificar en los dos servidores

- **Qué es:** la lista de mixes de la web vieja muestra los mixes en curso (una foto por ronda). Si el servidor se cae, el mix queda "interrumpido" con la última ronda, y un admin aprueba el ELO desde Admin → Servidores (mínimo 35 % de las rondas, sin empate).
- **Desplegado el 2026-10-17:**
  - Migración `20261017120000` (la corrió Daniel).
  - `index.html` publicado.
  - **Servidor real:** `.smx` genérico 2.1.0 (md5 `857e040f…`).
  - **RBK:** build licenciado 2.1.0 (md5 `928d8a19…`).
  - En los dos, la 1.8.0 quedó en `plugins/disabled/csstv_reporter_1.8.0.smx`.
- **2.1.1 subida el 2026-10-17** a los dos servidores (servidor real genérico md5 `d96245b1…`, RBK licenciado md5 `f3f684f8…`; la 2.1.0 en `plugins/disabled/csstv_reporter_2.1.0.smx`). Arregla que un reinicio desde el panel en medio de un mix lo dejaba "cancelado por cambio de mapa": ahora queda interrumpido.
- **La 2.1.0 incluye la 2.0.0** (`!match` y `!status`): Daniel eligió subirla así. `!match` responde con error hasta el corte del replanteo (le falta `csstv_match_lookup`). Ningún plugin de los servidores registra `sm_status` (chequeo hecho el 2026-10-17).
- **Se carga en el próximo cambio de mapa.** Después, en cada servidor:
  - `sm_csstv_status` muestra `v2.1.1` y "Fotos en vivo: activadas".
  - En el primer mix, la sección "En vivo" de la web se actualiza en cada ronda.
- **Si algo falla:** `csstv_live 0` en la consola apaga las fotos al instante.
- **Falta también:**
  - Publicar el `CHANGELOG_DISCORD.txt` de la bitácora.
  - Actualizar `supabase/schema/` con `volcar.sh 20261017120000` (necesita las `PG_*` del `.env` corregidas).
- **Corte:** las `04`, `06` y `10` del replanteo ya adaptan `elo_crash_apply` y `end_reason`.
- **Web nueva:** API hecha el 2026-10-17, solo en local (replanteo `16` y endpoints `/api/v1/mixes/live*` y `/api/v1/admin/mixes/*`, más `review` en partidas). Ver [`2026-10-17-api-mixes-en-vivo`](bitacora/2026-10-17-api-mixes-en-vivo/DOCUMENTACION.md) y la sección 8d del contrato.
- **Bitácora:** [`2026-10-17-mixes-en-vivo`](bitacora/2026-10-17-mixes-en-vivo/) (despliegue y reversión en su `GUIA_IMPLEMENTACION.md`).

### 1.8 `!sell` (`csstv_sell` 1.0.0): verificar en los dos servidores

- **Hecho y probado con bots el 2026-10-19** (11 casos). Los bots no obedecen `buy`, así que **faltan las compras reales** (menú de compra, `autobuy`, `rebuy`), **el menú** y la pausa táctica.
- **Subido el 2026-10-19** (a pedido de Daniel, sin la prueba con un jugador), el mismo `.smx` (sin licencia, md5 `b0131aaa2a2bb8d31081384fcf952ccb`) en los dos:
  - **Servidor real** (`SFTP_CSS_*`).
  - **RBK** (`SERVER1_*`).
  - Se carga en el próximo cambio de mapa. Verificar con `sm plugins list` y una venta real en cada uno.
- **Si algo falla:** `csstv_sell 0` en la consola lo apaga al instante.
- Publicar el changelog: `bitacora/2026-10-18-plugin-sell/CHANGELOG_DISCORD.txt`.
- **Bitácora:** [`2026-10-18-plugin-sell`](bitacora/2026-10-18-plugin-sell/)

### 1.9 `!calladmin` y rol de moderador (`csstv_calladmin` 1.0.0): verificar y sumar moderadores

- **Hecho y probado con bots el 2026-10-19** (15 casos, 3 reportes de prueba al canal real). Faltan los menús y los colores con un jugador.
- **Subido el 2026-10-19** (mismo `.smx` sin licencia, md5 `bcbf3360b2d751bc264a35939a8f7988`, cfg con el webhook, grupo `Moderador` y override de `sm_cancelmatch`; copias `*.bak_20261019` de la config de admins):
  - **Servidor real** (`SFTP_CSS_*`): `csstv_calladmin_server "v34frag #1"`.
  - **RBK** (`SERVER1_*`): `csstv_calladmin_server "v34frag #2"`.
  - Se carga en el próximo cambio de mapa. Verificación en la `GUIA_IMPLEMENTACION.md` (paso 8).
- **Moderadores** (en `configs/admins_simple.ini` de **los dos servidores**, `"STEAM_0:X:Y" "@Moderador"`; se aplica con `sm_reloadadmins` o en el cambio de mapa):
  - **Juanma** (2026-10-19): `STEAM_0:0:1500257138` y `STEAM_0:0:1113757173`. En el servidor real reemplaza su entrada anterior `"bce"` (pierde `e`, desbanear). Copias `admins_simple.ini.bak_20261019`.
  - **traica** (2026-10-19): `STEAM_0:0:829553320`. Agregado en el **servidor real** (`SFTP_CSS_*`) y en **RBK** (`SERVER1_*`), verificado bajando el archivo de nuevo. Copias `admins_simple.ini.bak_20261019_traica`. No se corrió `sm_reloadadmins`: se aplica en el próximo cambio de mapa.
- **Si algo falla:** `csstv_calladmin_enabled 0` corta `!calladmin` y `csstv_calladmin_modmap 0` corta el `!map` del moderador.
- Publicar el changelog: `bitacora/2026-10-19-calladmin-moderadores/CHANGELOG_DISCORD.txt`.
- **Bitácora:** [`2026-10-19-calladmin-moderadores`](bitacora/2026-10-19-calladmin-moderadores/)

### 1.10 `!whois` (reporter 2.3.0): verificar en los dos servidores

- **Implementado el 2026-10-19 sin probar** (Daniel pidió solo implementar). El reporter compila; las pruebas SQL de la `23` están escritas pero no se corrieron.
- **La prueba SQL de la `23` falla** (corrida el 2026-10-21 con `correr.sh`, al probar las temporadas): "por STEAM_0 del adicional: nicks y partidas de toda la ficha (privada igual), ficha y alias". `correr.sh` se corta ahí y no llega a las migraciones siguientes. Falta revisar si el error está en la `23` o en la prueba.
- **Desplegado el 2026-10-20** (pedido de Daniel, sin las pruebas):
  - **Base de producción:** Daniel corrió `20261019180000_whois.sql` en el SQL Editor.
  - **Servidor real** (`SFTP_CSS_*`): `.smx` genérico, md5 `dbb117f1bb383a1dfc7b5a9619109a1b`.
  - **RBK** (`SERVER1_*`): build licenciado, md5 `cb5ff8854b685700c4deee60a52b4e26`.
  - En los dos: la 2.1.1 quedó en `plugins/disabled/csstv_reporter_2.1.1.smx` y se agregó `csstv_claim "0"` al `cfg/sourcemod/csstv_reporter.cfg` (verificado bajándolo de nuevo). En RBK se borró `disabled/csstv_reporter_1.7.0.smx` (regla de Daniel: 3 versiones anteriores como mucho).
  - No se recargó nada: se carga en el próximo cambio de mapa.
- **Falta verificar** en cada servidor después del cambio de mapa: `sm plugins list` (2.3.0), `csstv_claim` en `0`, un `/whois` de un moderador y que `!claim` responda "todavía no está disponible". En RBK, por SFTP: `addons/sourcemod/logs/` sin errores de `csstv_whois`.
- **Pruebas:** base local (`pnpm db:reset` y `correr.sh`) y servidor local con bots en `CSSTV_DEBUG`. Casos en la [`GUIA_IMPLEMENTACION.md`](bitacora/2026-10-19-plugin-whois/GUIA_IMPLEMENTACION.md).
- **Pasos del despliegue (ya hechos el 2026-10-20):**
  1. **Base de producción:** correr `supabase/migrations/20261019180000_whois.sql` en el SQL Editor. Solo agrega `csstv_whois` y `csstv_steam0`; la web vieja no cambia.
  2. **Plugin 2.3.0 en los dos servidores en la misma tanda:** **servidor real** (`SFTP_CSS_*`, `.smx` genérico) y **RBK** (`SERVER1_*`, build licenciado). Se carga en el próximo cambio de mapa.
  3. **cfg de los dos:** `csstv_claim "0"` (la 2.3.0 trae `!claim`, que no funciona hasta el corte).
- **En el corte:** la `23` va después de la `22`; `csstv_claim "1"`.
- Publicar el changelog: `bitacora/2026-10-19-plugin-whois/CHANGELOG_DISCORD.txt`.
- **Bitácora:** [`2026-10-19-plugin-whois`](bitacora/2026-10-19-plugin-whois/)

### 1.11 Menú de `!whois` (reporter 2.3.1): verificar en los dos servidores

- **Implementado el 2026-10-20 sin probar.** Compila; las pruebas SQL de la `23` (27 comprobaciones) están escritas pero no se corrieron.
- **Desplegado el 2026-10-20** (pedido de Daniel, sin las pruebas):
  - **Base de producción:** Daniel corrió `20261020120000_whois_menu.sql` en el SQL Editor.
  - **Servidor real** (`SFTP_CSS_*`): `.smx` genérico, md5 `774b79c3f9d6a0cfa6869c4c57255613`.
  - **RBK** (`SERVER1_*`): build licenciado, md5 `98dcb36a7db93dc651d15667e6570dd4`.
  - En los dos, la 2.3.0 quedó en `plugins/disabled/csstv_reporter_2.3.0.smx` y en `disabled/` quedan la 2.1.0, la 2.1.1 y la 2.3.0 (en RBK se borró la 1.8.0). El cfg no cambió. No se recargó nada: se carga en el próximo cambio de mapa.
- **Falta verificar** después del cambio de mapa: `sm plugins list` (2.3.1), un `/whois` con varias coincidencias que abra el menú, uno con nombre exacto y uno desde la consola. En RBK, por SFTP: `addons/sourcemod/logs/` sin errores de `csstv_whois`. Esto reemplaza la verificación pendiente del punto 1.10.
- **Pasos del despliegue (ya hechos):**
  1. **Base de producción:** correr `supabase/migrations/20261020120000_whois_menu.sql` en el SQL Editor. La 2.3.0 que está en los servidores sigue funcionando con ella.
  2. **Plugin 2.3.1 en los dos servidores en la misma tanda:** **servidor real** (`SFTP_CSS_*`, `.smx` genérico) y **RBK** (`SERVER1_*`, build licenciado). La 2.3.0 a `plugins/disabled/`, como mucho 3 versiones anteriores (en RBK se borra la 1.8.0). El cfg no cambia.
- Pasos y casos de prueba en la [`GUIA_IMPLEMENTACION.md`](bitacora/2026-10-20-whois-menu/GUIA_IMPLEMENTACION.md). Changelog: `bitacora/2026-10-20-whois-menu/CHANGELOG_DISCORD.txt`.

### 1.12 Consejos en el chat y Discord al terminar la partida (reporter 2.4.0): verificar en los dos servidores

- **Hecho y probado con bots el 2026-10-20** en el servidor local, con tiempos cortos. Falta ver los colores con un jugador real.
- **Desplegado el 2026-10-20** (pedido de Daniel):
  - **Servidor real** (`SFTP_CSS_*`): `.smx` genérico, md5 `0c4b2bb43df76d7574942c0a251c3525`.
  - **RBK** (`SERVER1_*`): build licenciado, md5 `3bbaeaee9a049ce0c7d092ab49b42500`.
  - En los dos, la 2.3.1 quedó en `plugins/disabled/csstv_reporter_2.3.1.smx` y se borró la 2.1.0. En `disabled/` quedan la 2.1.1, la 2.3.0 y la 2.3.1.
  - Se agregó `csstv_tips_interval "180"` al cfg.
  - No se recargó nada: se carga en el próximo cambio de mapa.
- **Falta verificar** en cada servidor:
  - `sm plugins list` muestra 2.4.0.
  - Sale un consejo cada 3 minutos.
  - Al final del primer mix sale `dsc.gg/v34frag`.
  - En RBK, por SFTP: `addons/sourcemod/logs/` sin errores del reporter.
  - Esto reemplaza las verificaciones pendientes de los puntos 1.10 y 1.11, que se pueden hacer en el mismo cambio de mapa.
- **Si molesta:** `csstv_tips_interval 0` apaga los consejos al instante.
- Changelog: `bitacora/2026-10-20-consejos-y-discord/CHANGELOG_DISCORD.txt`. Detalle en la [`GUIA_IMPLEMENTACION.md`](bitacora/2026-10-20-consejos-y-discord/GUIA_IMPLEMENTACION.md).

### 1.13 Nombre CMLeague (reporter 2.4.1, sell 1.0.1, calladmin 1.0.1, allchat 1.0.2): verificar en los dos servidores

- **Qué es:** todo lo que ven los jugadores dice CMLeague en lugar de v34frag: nombre del servidor, SourceTV, prefijo del chat, avisos de `!calladmin` y autor de los plugins. El link de Discord sigue siendo `dsc.gg/v34frag` (decisión de Daniel). La infraestructura (Worker de demos, API, Supabase) conserva sus nombres.
- **Desplegado el 2026-10-22** en el servidor real (reporter genérico) y en RBK (reporter licenciado), con los cfgs (`hostname`, `tv_title`, `csstv_chat_tag`, `csstv_calladmin_server`). Se carga en el próximo cambio de mapa. Probado con bots.
- **Verificar:**
  - el nombre en la lista de servidores;
  - `[CMLeague]` en el chat;
  - `sm plugins list` con las versiones nuevas;
  - en RBK, por SFTP, los logs sin errores y `license.txt` actualizado.
- **Falta:**
  - publicar `bitacora/2026-10-22-nombre-cmleague/CHANGELOG_DISCORD.txt`;
  - si se quiere, cambiar el nombre de los archivos de las demos (`v34frag_…dem`) con el próximo deploy del Worker (punto 1.1).
- **Bitácora:** [`2026-10-22-nombre-cmleague`](bitacora/2026-10-22-nombre-cmleague/)

### 1.14 RBK igual al servidor real (con Stripper) y prórroga y medio tiempo nuevos: falta reiniciar RBK

- **Qué es:**
  - RBK queda igual a nuestro servidor. Le faltaba Stripper:Source, que les saca la niebla a los mapas, y tenía otros valores de partida y otros plugins.
  - En los dos servidores: `csstv_ot_startmoney "12000"` y `csstv_halftime_delay "5.0"` (bajado a `"3.0"` el 2026-10-24, punto 1.18).
- **Subido el 2026-10-22.**
  - Servidor real: se carga en el próximo cambio de mapa.
  - **RBK: falta que Daniel lo reinicie desde el panel.** Metamod y las extensiones solo cargan al arrancar.
- **Después del reinicio**, verificar por SFTP:
  - logs de errores sin nada nuevo;
  - `license.txt` actualizado;
  - `csstv_perf` con `fps_max 150 → 600`.

  Y en el juego, que no haya niebla.
- **Accelerator** quedó retirado en los dos servidores (`addons/sourcemod/accelerator_retirado/`): en el real ya estaba así sin estar anotado.
- Changelog: `bitacora/2026-10-22-rbk-igual-al-real/CHANGELOG_DISCORD.txt`.
- **Bitácora:** [`2026-10-22-rbk-igual-al-real`](bitacora/2026-10-22-rbk-igual-al-real/)

### 1.15 HUD de observer (`csstv_hud` 1.0.0): subido solo al servidor real, sin probar

- **Excepción pedida por Daniel el 2026-10-22:** sin pruebas en el servidor local y **solo al servidor real**. Desde el 2026-10-23 RBK también lo tiene (1.1.0), con `csstv_hud "0"`.
- **Subido el 2026-10-22** al servidor real (`SFTP_CSS_*`), verificado bajándolo de nuevo:
  - `addons/sourcemod/plugins/csstv_hud.smx` (14738 bytes, md5 `72645cac9e61aa5ad768586eee72d06d`).
  - `cfg/sourcemod/csstv_hud.cfg` con `csstv_hud "1"`, la clave (`HUD_RELAY_KEY` del `.env`) y **el host y el puerto vacíos**: no manda nada hasta cargarlos.
  - Usa la extensión Socket 3.0.1 que ya estaba (`socket.ext.so`, el mismo binario que en RBK).
- Se carga en el próximo cambio de mapa. Es un plugin aparte: cargarlo con `sm plugins load csstv_hud` no cancela partidas.
- **Para probar:** `csstv_hud_host` y `csstv_hud_port` con la dirección de playit.gg del streamer (en la consola y en el cfg) y `csstv_hud_status`.
- **Relay y HUD (`hud/relay/` 1.0.0): hechos el 2026-10-22**, probados solo en local con la partida simulada (`pnpm simular`): 16 pruebas, tipos y `relay.exe` armado y probado. Falta probarlos con el servidor real y playit. Guía del streamer en [`hud/relay/README.md`](../hud/relay/README.md).
  - `relay.exe` no se versiona: se arma con `pnpm build:exe` y se le pasa al streamer junto con la clave (`HUD_RELAY_KEY`).
  - **En qué se apartó del plan:** en la [guía de implementación](bitacora/2026-10-22-hud-observer/GUIA_IMPLEMENTACION.md) (documentación y guía escritas el 2026-10-23).
  - **Falta ver con la SourceTV real:** cómo ocultar las barras de espectador de CS:S debajo del HUD.
- **Íconos en el feed (`csstv_hud` 1.1.0 y relay 1.1.0): hechos el 2026-10-23.** El feed usa los íconos de ClientMod y sus agregados (asistencia, flash, wallbang, ciego, humo y no scope).
  - **`csstv_hud.smx` 1.1.0 subido el 2026-10-23 al servidor real y a RBK** (md5 `cce849f760bbef2b5d038a992c96c4bf`), verificado bajándolo de nuevo. Se carga en el próximo cambio de mapa. **RBK ya tiene el plugin**, con `csstv_hud "0"` y sin host ni clave.
  - Daniel lo probó en una transmisión el 2026-10-23: funciona bien.
  - **Relay 1.2.0 (2026-10-23):** el feed baja a `top: 122px` para quedar debajo de la barra negra del espectador del juego, y las tarjetas de los jugadores también usan íconos (arma, granadas, chaleco, C4 y el kit, que sale de `cs.ttf`). Falta pasarle al streamer el `relay.exe` 1.2.0.
  - Bitácora: [`2026-10-23-hud-iconos-feed`](bitacora/2026-10-23-hud-iconos-feed/).
- **Decidido el 2026-10-23 (Daniel):** la transmisión combina el HUD del juego con el nuestro. Así se sigue viendo el nombre del jugador mirado, en la barra de abajo del espectador. El deathnotice del juego se apaga.
- **Descartado por ahora (Daniel, 2026-10-23):** que el HUD siga solo al jugador que mira el observer (binds con `spec_player` y el log de la consola) y ocultar la barra superior del espectador (`hidepanel specgui` o un `spectator.res` en `cstrike_custom/`). Están analizados en la conversación del 2026-10-23 y no se tocan por ahora.
- **Si algo falla:** `csstv_hud 0` lo apaga al instante.
- **Bitácora:** [`2026-10-22-hud-observer`](bitacora/2026-10-22-hud-observer/)

### 1.16 Clips automáticos (reporter 2.5.0): verificar en los dos servidores

- **Qué es:** el servidor anota las jugadas destacadas de cada ronda (ace, 4k, 3k y clutches ganados) con los ticks de la demo de cada kill, y la base las clasifica, ordena y aplica los topes (2 por jugador y 10 por partida, configurables por el admin). Todavía no hay video.
- **Desplegado el 2026-10-23:** la migración `20261023120000_clips.sql` en la base (la aplicó Daniel), el reporter 2.5.0 genérico en el servidor real y el licenciado en RBK, y `csstv_clips "1"` en el cfg de los dos. Se carga en el próximo cambio de mapa. Probado con bots contra la Supabase local.
- **Verificar en cada servidor**, después del cambio de mapa:
  - `sm plugins list` con la 2.5.0;
  - registros en `match_clips` y `tickrate` en el primer mix real;
  - en RBK, por SFTP, los logs sin errores.
- **Falta:**
  - el backend (`GET /api/v1/matches/{id}/clips` y `/admin/clips/config`) y el replanteo `26` salen con el corte;
  - la galería en el frontend nuevo (contrato, sección 8g) y publicar `CHANGELOG_DISCORD.txt` cuando esté;
  - **fase C (video):** la **prueba de concepto (C1) está hecha** en la PC de Daniel (2026-10-23, [`2026-10-23-clips-video`](bitacora/2026-10-23-clips-video/)): lector de demos validado, render automático a 720p y 1080p, subida a R2. Falta probarla en el portátil. La **grabación automática (C2)** está aprobada e implementada ([`2026-10-23-clips-render-automatico`](bitacora/2026-10-23-clips-render-automatico/)); falta la prueba con el juego y desplegar. Ver el punto 1.17.
- **Bitácora:** [`2026-10-22-clips-automaticos`](bitacora/2026-10-22-clips-automaticos/)

### 1.17 Video de los clips (fase C): grabación automática implementada, falta probar con el juego y desplegar

- **C1, prueba de concepto (hecha el 2026-10-23, sin commit):** `render/` (`leer_demo.py`, `render_clip.py`, `r2.py`, `config.example.json`). Graba una jugada de una demo con una copia del cliente ClientMod (`D:\CMLeague_Render\ClientMod`) y FFmpeg, sin intervención salvo un aviso de UAC. Corre como administrador y maneja el juego escribiendo en su consola (todo lo demás falla: ver la documentación). 12,2 s de video: 5,1 MB y 82 s a 720p; 8,7 MB y 119 s a 1080p, en la PC de Daniel.
  - Los primeros cuadros sin el arma y los nombres con comillas se resolvieron en C2 (medio segundo de más que se descarta; las comillas quedan `skipped`). La prueba en el portátil pasa al paso 6 de C2.
- **C2, grabación automática (aprobada e implementada el 2026-10-23; base, Worker y Drive en producción; falta el portátil):**
  - **Qué hace:** tarea programada cada 10 min (`render/procesar.py`) que toma las jugadas visibles sin video, baja la demo, graba una partida por sesión, sube cada video a R2 (15 días) y a Google Drive (siempre), lo ata a su fila de `match_clips` y borra lo local.
  - **Piezas:**
    - la migración `20261023180000_clips_video.sql`, con la `26` y su inversa actualizadas;
    - el Worker `cloudflare/clips-worker`;
    - `video` en `GET /api/v1/matches/{id}/clips` (contrato 8g);
    - `render/drive.py` y `instalar_tarea.ps1`.
  - **Probado en local:** la base (62 pruebas), el desfase contra la demo de tuscan, `procesar.py` de punta a punta con la grabación simulada y subidas reales a R2, el Worker con `wrangler dev` (17) y el backend (291 unitarias y 104 de integración).
  - **Falta, en orden** (pasos en la [guía](bitacora/2026-10-23-clips-render-automatico/GUIA_IMPLEMENTACION.md)):
    1. ~~la prueba con el juego de verdad~~ (hecha el 2026-10-23 en la PC de Daniel: 4 videos bien al tercer intento; ver los incidentes de la guía);
    2. ~~desplegar el Worker y cargar `CLIPS_BASE_URL`~~ (hecho el 2026-10-23: `https://cmleague-clips.cmleague.workers.dev`, verificado con un video de prueba);
    3. ~~el proyecto de Google Cloud y `drive_login.py`~~ (hecho el 2026-10-23: app "En producción", token en el `.env`, `drive.py prueba` OK; falta `"drive": true` en `config.json`);
    4. ~~la migración en producción y el token de render~~ (hecho el 2026-10-23: `RENDER_*` en el `.env`, verificado con un token inventado (401) y `match_clip_list` público);
    5. el portátil (Daniel instaló un ClientMod limpio): copiar los mapas de la liga, `render/`, Python de python.org, FFmpeg, un `.env` reducido (`RENDER_*`, `CF_*_CLIPS`, `GOOGLE_*`) y `config.json` con sus rutas; abrir el juego una vez a mano; medir una jugada a 1080p;
    6. `instalar_tarea.ps1` en el portátil (no en la PC: `render/config.json` de la PC ya está en 1080p con Drive, para pruebas).
  - **Después:** el primer mix real con la 2.5.0 (clips detectados por el plugin, clutches reales, el desfase real con `tv_delay`) y su video por el Worker y en Drive.
- **Cuentas:** los videos de los clips van al R2 de la **cuenta de Cloudflare de Daniel** (variables `CF_*_CLIPS` en el `.env`, conexión probada); las demos se quedan en la cuenta de kyan. YouTube se descartó.
- **Bitácora:** [`2026-10-23-clips-video`](bitacora/2026-10-23-clips-video/) y [`2026-10-23-clips-render-automatico`](bitacora/2026-10-23-clips-render-automatico/)

### 1.18 Medio tiempo de 3 segundos: verificar en un mix real

- **Aplicado el 2026-10-24** en el servidor real (`SFTP_CSS_*`) y en RBK (`SERVER1_*`): `csstv_halftime_delay "3.0"` (antes `"5.0"`, con el que el marcador volvía a 0 en el medio tiempo). Verificado releyendo el cfg de cada uno.
- Entra en el próximo cambio de mapa; no se recargó el plugin.
- **Falta:** ver en el próximo mix de cada servidor que el cambio de lados conserva el marcador, y publicar `bitacora/2026-10-24-medio-tiempo-3s/CHANGELOG_DISCORD.txt`.
- **Bitácora:** [`2026-10-24-medio-tiempo-3s`](bitacora/2026-10-24-medio-tiempo-3s/)

## 2. Investigaciones abiertas

### 2.0 Tirones y sonido en el servidor real (#1)

- **Quejas (2026-10-18):** cuesta escuchar pasos y puertas, y los jugadores "aparecen y desaparecen".
- **Hallazgos:**
  - Arranca con `-tickrate 101 +fps_max 101`: `fps_max` igual al tickrate.
  - En `server.cfg` las tasas mínimas (101) están por encima de las máximas (100).
  - El servidor está fijado a un solo núcleo.
  - ~~Ningún plugin bloquea sonidos~~: corregido el 2026-10-22. `Anti_Wallhack_Lite.smx` (subido el 2026-10-20) intercepta sonidos, y KACR tenía su anti-wallhack prendido desde el 12/10.
- **Hecho:** `csstv_perf` (plugin de medición) subido **solo al servidor real** el 2026-10-18. Se carga en el próximo cambio de mapa y escribe `logs/csstv_perf_AAAAMMDD.log`.
- **Primer mix medido (2026-10-18, 10 jugadores):** la red y el CPU están bien (0 % de pérdida, choke saliente ~0, ningún tick perdido). El 30 % de los ticks sale a destiempo porque el `fps_max` real es **150**: lo fuerza `extreme_host.smx`, el plugin del hosting, en cada mapa. Detalle en la guía de la bitácora.
- **Siguiente, de a uno y con visto bueno:**
  1. ~~Datos de al menos un mix~~: hecho.
  2. ~~`fps_max 600`~~: hecho con `csstv_perf` 1.1.0. Medido el 2026-10-19 en dos mixes: los ticks que llegan tarde de verdad bajaron de 0,75 % a 0,12 %. El "30 % a destiempo" del primer análisis era el redondeo del reloj (7,8 ms), no algo real. Lo que queda son jugadores puntuales (jordipolla con choke entrante de 24 a 55 % todo el mix: sus FPS). Detalle en la guía.
  3. Tasas coherentes (66/101): baja prioridad, las tasas no muestran problema.
  4. **Anti-wallhack apagados y humo más denso: aplicado el 2026-10-22 en los dos servidores**, se carga en el próximo cambio de mapa.
     - Los logs del 18 al 22/10 siguen limpios: 99,97 % de ticks y 0 % de pérdida. La causa más probable de que los jugadores "aparezcan y desaparezcan" son los anti-wallhack, que ocultan a los rivales (`SetTransmit`).
     - Cambios: `kacr_eyes_antiwall "0"` en el real y en RBK, `Anti_Wallhack_Lite.smx` a `disabled/` (solo en el real) y `clientmod_smoke_type 2` en el real y en RBK.
     - **Falta:** verificar en la consola después del cambio de mapa, preguntar a los jugadores después de uno o dos mixes, publicar el `CHANGELOG_DISCORD.txt` y preguntar quién subió `Anti_Wallhack_Lite.smx` y por qué.
     - **Prueba A/B (2026-10-22, pedido de Daniel):**
       - El humo `2` quedó aprobado.
       - En el **servidor real** los dos anti-wallhack se volvieron a prender (`kacr_eyes_antiwall "1"` y `Anti_Wallhack_Lite.smx` de vuelta en `plugins/`); en **RBK** siguen apagados.
       - Después se volvió a apagar el de KACR en el servidor real (`kacr_eyes_antiwall "0"` en los dos servidores). **Hoy solo queda prendido `Anti_Wallhack_Lite.smx` en el servidor real**, y se prueba ese plugin solo.
       - **Resultado:** Daniel confirmó que así funciona bien. El 2026-10-22 se subió `Anti_Wallhack_Lite.smx` también a RBK, así que los dos servidores quedan iguales: sin el anti-wallhack de KACR, con `Anti_Wallhack_Lite` y con el humo en `2`.
       - Falta publicar el `CHANGELOG_DISCORD.txt`.
     - Si siguen las quejas en los dos servidores: `se_clockcorrection_ticks 2` (ClientMod) solo, en los dos.
     - Bitácora: [`2026-10-22-anti-wallhack-y-humo`](bitacora/2026-10-22-anti-wallhack-y-humo/).
- **Bitácora:** [`2026-10-18-diagnostico-red-servidor`](bitacora/2026-10-18-diagnostico-red-servidor/)

### 2.1 Crashes del servidor real

El servidor real se cae seguido (unas 12 veces entre el 12 y el 14 de octubre). Los momentos no tienen relación entre sí: con `bot_add`, con el servidor vacío, a mitad de un mix y en bucle al arrancar. El crash del 14/10 a las 16:41 coincidió con el inicio de una pausa (`!pause`), pero lo más probable es que sea casualidad. No quedó ningún rastro de dónde muere.

- **Siguiente paso:** el deploy del punto 1.1 y esperar el próximo crash.
- **Hipótesis sin confirmar:**
  - Un ataque con exploits de srcds viejos. Mecha subió `SendFileExploitFixV3.3.smx` el 14/10 a las 16:52, y KACR registró conexiones en spam y cvars corruptas.
  - Algún plugin externo agregado el 13/10: ClientMod, CSS:DM (extensiones subidas sin plugin) y otros.
  - Bots en mapas sin `.nav`.
- **Si molesta en los mixes:** `csstv_pause_mode 0` en el cfg del servidor apaga `!pause` sin recompilar.
- **Detalle:** [`2026-10-14-crash-servidor-accelerator/DOCUMENTACION.md`](bitacora/2026-10-14-crash-servidor-accelerator/DOCUMENTACION.md) e inventario en [`PLUGINS_EXTERNOS.md`](PLUGINS_EXTERNOS.md).

### 2.2 SourceTV solo en primera persona — en pausa

Daniel quiere que el director automático de la SourceTV siga mostrando las kills, pero siempre en primera persona, sin planos en tercera persona ni cámaras fijas.

- **Por qué no es simple:** el motor v34 no tiene una cvar para esto. Las únicas son `tv_allow_static_shots`, `tv_allow_camera_man` y `tv_delay`, verificadas en los binarios. Las tomas se mandan con `BroadcastEvent`, así que `HookEvent` no las ve.
- **Idea analizada:** un parche en memoria desde el plugin, con gamedata y `StoreToAddress`:
  - En `CHLTVDirector::StartChaseCameraShot`, forzar `bInEye = 1`.
  - Hacer que `CHLTVDirector::StartFixedCameraShot` vuelva apenas entra.
  - Sumar `tv_allow_static_shots 0`.
- **Para seguir:** desensamblar `server_i486.so` (Linux, con símbolos) y `server.dll` (local).
- Daniel dijo "no lo analicemos todavía".
- **Detalle:** la sección 3 de la primera versión del plan se resumió al principio de [`2026-10-14-elo-participacion-y-sourcetv/PLAN.md`](bitacora/2026-10-14-elo-participacion-y-sourcetv/PLAN.md).

**Descartado:** sacar la voz de la retransmisión de la SourceTV y dejarla en la demo. La demo se graba con lo mismo que se transmite, y `tv_relayvoice 0` apaga las dos cosas. Daniel decidió dejarlo como está.

## 3. Planes sin aprobar

| Plan | Qué propone | Qué falta |
|---|---|---|
| [`2026-10-14-web-pages-worker`](bitacora/2026-10-14-web-pages-worker/PLAN.md) | Plan general: API REST (Hono + OpenAPI) por la que pase todo lo que hoy hace el navegador contra Supabase, motor de torneos en el backend, frontend nuevo y despliegue con GitHub Actions | **Parcialmente superado:** el backend avanza con su propio plan (sección 6) y el hosting pasó de Cloudflare Pages y Workers a un VPS de Hostinger. La parte de despliegue hay que replanearla para el VPS |
| [`2026-10-16-despliegue-vps`](bitacora/2026-10-16-despliegue-vps/PLAN.md) | Despliegue de la web nueva en el VPS de Hostinger: servidor, Caddy, servicio de la API, pipeline, DNS, SMTP de Auth, ensayo en staging y orden del corte | Aprobación de Daniel y los requisitos de su sección 9 (dominio, VPS, Resend, Supabase de staging, permisos en GitHub). Daniel pidió no implementarlo todavía |

## 4. Verificaciones que nunca se hicieron

No bloquean nada, pero quedaron anotadas como pendientes.

| Qué | Dónde |
|---|---|
| Prueba con jugadores reales de la QoL 1.2.0: TAB después del medio tiempo, sin menú de modelos al cambiar de lado, tildes en el chat de ClientMod, daño igual al de la consola, contador del freezetime en pausa, `!hp`, reproducir la demo | [`2026-10-11-qol-servidor/GUIA_IMPLEMENTACION.md`](bitacora/2026-10-11-qol-servidor/GUIA_IMPLEMENTACION.md), sección "Pendiente" |
| Revisión en el navegador de la web del ELO: columnas, perfil, insignias, tema claro y oscuro | [`2026-10-11-elo-jugadores/GUIA_IMPLEMENTACION.md`](bitacora/2026-10-11-elo-jugadores/GUIA_IMPLEMENTACION.md) |
| Web del ELO configurable, demos y ELO por participación: nunca se probaron en el navegador (solo sintaxis) | Guías de cada una |
| **`!match` y `!status` con jugadores reales** (17 casos: stand-ins que entran solos, cambio de mapa real en una serie, faka con `!switch`, suplentes, `!status` en pausa, la web nueva mostrando el código…). Las prueba Daniel, mejor cuando la web nueva esté más avanzada | [`2026-10-15-match-y-status/PRUEBAS_MANUALES.md`](bitacora/2026-10-15-match-y-status/PRUEBAS_MANUALES.md) |
| `sm_csstv_status` en el servidor real para confirmar 1.5.0, 1.6.0 y 1.7.0 | **Resuelto indirectamente el 2026-10-14:** el servidor tiene la 1.7.0 (83946 bytes) y los logs muestran mixes con ronda de cuchillo y licencia válida |
| RBK: confirmar que cargó la 1.7.0 licenciada | **Resuelto el 2026-10-14:** `data/csstv/license.txt` se actualizó a las 18:33 (licencia validada) |

## 5. Cosas sueltas del servidor real

- `configs/adminmenu_cfgs.txt` tiene una sección sin cerrar (línea 33) y `basecommands` lo reporta en cada mapa.
- `CM_PickupWeapon.smx` no puede escribir su cfg por permisos.
- En `extensions/` hay archivos de CSS:DM (13/10, 22:50) sin ningún plugin que los use. Habría que preguntar quién los subió y si se pueden borrar.
- `start.sh` en la raíz no es lo que usa el panel: el arranque real lo define Pterodactyl (puerto 27062 en la consola). Ver la nota de `+tv_enable 1` en la bitácora `2026-10-11-qol-servidor`.

## 6. Backend API (`web/backend`)

Primera fase (base, Auth y Mi perfil; Node 24 + Hono + TypeScript) **terminada el 2026-10-14**: 161 pruebas y cobertura del 96 % (mínimo exigido: 60 %), probada en local contra una Supabase en Docker con el esquema real. Nada desplegado.

- **Bitácora:** [`2026-10-14-backend-base-auth-perfil`](bitacora/2026-10-14-backend-base-auth-perfil/). Cómo trabajar en el backend: [`web/backend/README.md`](../web/backend/README.md).
- **`.env` de la raíz:** la línea 30 se llama `PG_PASSWORD` pero tiene el usuario. Tiene que ser `PG_USER=postgres.<ref del proyecto>` (el valor está en Supabase → Connect → Session pooler) (usuario del *Session pooler*). Hasta que se corrija, `supabase/schema/volcar.sh` necesita `PGUSER` y `PGPASSWORD` a mano.
- **Hosting decidido:** VPS KVM 1 de Hostinger con dominio propio. Cloudflare se queda solo con el Worker de demos y R2. El despliegue (build, servicio de Node, Caddy con HTTPS, DNS, pipeline y SMTP para Supabase Auth) tiene plan propio, sin aprobar: [`2026-10-16-despliegue-vps`](bitacora/2026-10-16-despliegue-vps/PLAN.md).
- **Después de esta fase**, en este orden (decidido por Daniel):
  1. ~~**Fase de "replantear" módulos**~~: **terminada el 2026-10-15**, solo en local (migraciones 01 a 08 en `supabase/replanteo/`, más la `09` de jugadores y equipos; se aplican en el corte). Ver [`2026-10-14-replanteo-modelo-datos`](bitacora/2026-10-14-replanteo-modelo-datos/DOCUMENTACION.md).
  2. ~~**Endpoints de dominio**~~: **terminados el 2026-10-16**, solo en local. Cada uno con su plan:
     - ~~Jugadores, equipos, plantel, ranking y su admin~~: **hechos el 2026-10-15**, solo en local (migración `09` y endpoints). Ver [`2026-10-15-api-jugadores-equipos`](bitacora/2026-10-15-api-jugadores-equipos/DOCUMENTACION.md).
     - ~~Partidas, torneos y PCW~~: **hechos el 2026-10-15**, solo en local (migración `10` y endpoints). Ver [`2026-10-15-api-partidas-torneos-pcw`](bitacora/2026-10-15-api-partidas-torneos-pcw/DOCUMENTACION.md).
     - ~~Listados con paginación, filtros y orden en el servidor~~ (requisito obligatorio de Daniel): **hechos el 2026-10-15**, migración `11`. Ver [`2026-10-15-get-paginacion-filtros`](bitacora/2026-10-15-get-paginacion-filtros/DOCUMENTACION.md). Todo endpoint nuevo de lista tiene que seguir la convención de `docs/frontend/contrato/api.md` (sección 1, "Listados").
     - ~~Admin de servidores (tokens, licencias, panel)~~: **hecho el 2026-10-16**, solo en local (migración `12` y endpoints `/api/v1/admin/servers`). Ver [`2026-10-16-api-admin-servidores`](bitacora/2026-10-16-api-admin-servidores/DOCUMENTACION.md).
     - ~~Configuración del ELO y recálculo~~: **hechos el 2026-10-16**, solo en local (migración `13`, la simulación, y endpoints `/api/v1/elo/config` y `/api/v1/admin/elo/*`). Recalcular pide doble confirmación (`confirm: "estoy seguro"`). Ver [`2026-10-16-api-elo-config`](bitacora/2026-10-16-api-elo-config/DOCUMENTACION.md).
     - ~~Perfiles sin reclamar, `!claim` y varios SteamID por ficha~~ (base y backend): **hechos el 2026-10-16**, solo en local (migración `15` y endpoints). El **plugin 2.2.0** con `!claim` quedó hecho el 2026-10-18 ([`2026-10-18-plugin-claim`](bitacora/2026-10-18-plugin-claim/)) y sale en el corte. Falta el frontend. Ver [`2026-10-16-claim-steamid`](bitacora/2026-10-16-claim-steamid/DOCUMENTACION.md).
     - ~~Demos desde el admin~~: **hechas el 2026-10-16**, solo en local (migración `14` y endpoints `/api/v1/admin/demos*` y `/api/v1/admin/demo-workers`): resumen, listado, reintentar una demo perdida y tokens del Worker de demos (el token nuevo pide doble confirmación). Ver [`2026-10-16-api-demos-admin`](bitacora/2026-10-16-api-demos-admin/DOCUMENTACION.md).
     - ~~Preferencias de la cuenta (`preferences.theme_fx`)~~: **hechas el 2026-10-18**, solo en local (migración `18` y `GET`/`PATCH /api/v1/me/profile`), a pedido del frontend. Ver [`2026-10-18-preferencias-perfil`](bitacora/2026-10-18-preferencias-perfil/DOCUMENTACION.md).
     - ~~Plantilla "Grupos de doble eliminación + playoffs" (`groups_double`) y sorteo~~: **hechos el 2026-10-18**, solo en local (migración `17` y `POST /api/v1/events/{id}/draw`). Ver [`2026-10-18-torneo-grupos-doble`](bitacora/2026-10-18-torneo-grupos-doble/DOCUMENTACION.md).
     - ~~Estado de los servidores, cambio de contraseña y mis partidas~~: **hechos el 2026-10-19**, solo en local (migración `19` y `GET /api/v1/servers/status`, `POST /api/v1/me/password`, `GET /api/v1/me/matches`, filtro `server` en `GET /api/v1/matches`). El contrato del frontend pasó a `docs/frontend/contrato/` (un archivo por módulo). Falta consultar RBK con A2S cuando se cargue su `connect_address`. Ver [`2026-10-19-api-servidores-password-historial`](bitacora/2026-10-19-api-servidores-password-historial/DOCUMENTACION.md).
     - ~~Ping, modo, región y partidas en vivo en el estado de los servidores~~: **hechos el 2026-10-19**, solo en local (migración `20` y campos nuevos en `GET /api/v1/servers/status` y en el admin de servidores). Probados en local (pruebas SQL, unitarias y de integración). Después del corte, cargar modo y región del servidor real y de RBK. Ver [`2026-10-19-api-servidores-ping-modo-region`](bitacora/2026-10-19-api-servidores-ping-modo-region/DOCUMENTACION.md).
     - ~~Desvincular un SteamID (con aprobación del admin) y elegir el principal desde Mi perfil~~: **hechos el 2026-10-19**, solo en local (migración `21`, `POST /api/v1/me/steam/{steamid}/unlink` y `/primary`). Probados en local (pruebas SQL, unitarias y de integración). Falta el frontend. Ver [`2026-10-19-api-steam-desvincular-principal`](bitacora/2026-10-19-api-steam-desvincular-principal/DOCUMENTACION.md).
     - ~~Cancelar el pedido de desvincular un SteamID y fecha del último cambio de contraseña~~: **hechos el 2026-10-19**, solo en local (migración `22`, `DELETE /api/v1/me/steam/{steamid}/unlink` y `password_changed_at` en el usuario). En la misma tanda, `/auth/me` con una sesión cerrada pasó a responder `401` en vez de `500` (bug reportado por el frontend). Probados en local (pruebas SQL, unitarias y de integración). Falta el frontend. Ver [`2026-10-19-api-cancelar-desvincular-fecha-password`](bitacora/2026-10-19-api-cancelar-desvincular-fecha-password/DOCUMENTACION.md).
     - ~~Temporadas (medallas al top y reinicio del nivel 10)~~: **hechas el 2026-10-21**, solo en local (migración `24`, endpoints `/api/v1/seasons*`, `/api/v1/players/{id}/seasons` y `/api/v1/admin/seasons*`, y el script del cron `pnpm season:tick`). Probadas en local (pruebas SQL, unitarias y de integración). En el corte: aplicar la `24` y abrir la primera temporada **con inicio antes del primer mix**, para que cuenten todos los mixes (BETA, el nombre puede cambiar; decidido por Daniel el 2026-10-24). No se puede con el botón del admin (`season_start` la abre en `now()`): se hace con el SQL de [`2026-10-24-frontend-ranking/pruebas/temporada_beta_local.sql`](bitacora/2026-10-24-frontend-ranking/pruebas/temporada_beta_local.sql), ya probado en local. **El cierre automático necesita el VPS** (timer de systemd y `season.env` con la clave de servicio, en el plan del VPS); hasta entonces se cierra con el botón. Falta el frontend. Publicar `CHANGELOG_DISCORD.txt` cuando la web nueva esté en línea. Ver [`2026-10-20-temporadas`](bitacora/2026-10-20-temporadas/DOCUMENTACION.md).
     - ~~Ajustes manuales de ELO desde el admin y sin "Recalcular ELO"~~: **hechos el 2026-10-21**, solo en local (migración `25`, `/api/v1/admin/elo/adjustments` y `GET /api/v1/players/{id}/elo-adjustments`; se borraron `POST /api/v1/admin/elo/recompute` y `/simulate`). Probados en local (pruebas SQL, unitarias y de integración). La web vieja conserva su botón hasta el corte (pedido de Daniel). Falta el frontend. Ver [`2026-10-21-ajustes-elo-admin`](bitacora/2026-10-21-ajustes-elo-admin/DOCUMENTACION.md).
     - **"Olvidé mi contraseña"** (pendiente): necesita el envío de correos (Resend, plan del VPS). Cuando esté, `POST /auth/recover` con el enlace al frontend y la pantalla para poner la nueva.
     - ~~Mixes en vivo e interrumpidos~~: **hechos el 2026-10-17**, solo en local (migración `16` y endpoints `/api/v1/mixes/live*`, `/api/v1/admin/mixes/*` y `review` en partidas). Aprobar el ELO pide doble confirmación y vincula el juego si se jugaba con `!match`. Ver [`2026-10-17-api-mixes-en-vivo`](bitacora/2026-10-17-api-mixes-en-vivo/DOCUMENTACION.md).
- **Maestra de mapas** (pendiente, pedido por Daniel el 2026-10-24, sin plan): el admin gestiona la lista de mapas como una maestra (alta, edición y baja), y esa lista alimenta el select "Todos los mapas" del listado de mixes (y cualquier otro filtro por mapa).
  - **Backend:** tabla y endpoints de la maestra (`GET` público, CRUD en `/api/v1/admin/…`), con la foto de cada mapa que sube el admin (fondo del marcador de la sala del mix, plan `2026-10-24-frontend-mixes`), y en `GET /api/v1/admin/servers` los mapas de la maestra que le faltan a cada servidor.
  - **Plugin:** para saber qué mapas tiene cada servidor, el reporter tiene que informarlos (por ejemplo, los `.bsp` de `maps/` al validar la licencia o al cargar un mapa). Hoy no lo hace. Va en el orden de la sección "Orden de trabajo" (los plugins al final), así que hasta entonces la advertencia no tiene datos.
  - **Frontend:** pantalla de la maestra en Administración, advertencia en la lista de servidores ("Le faltan N mapas", con el detalle) y el select de mapas del listado de mixes desde la maestra.
- **Pedidos del frontend de Mixes** (2026-10-24, bitácora [`2026-10-24-frontend-mixes`](bitacora/2026-10-24-frontend-mixes/GUIA_IMPLEMENTACION.md)):
  - `match_id` en el `404` de `GET /api/v1/mixes/live/{uid}` (o un endpoint que lo resuelva), para pasar de la sala en vivo a la sala final.
  - `level` (y `elo`) en `PlayerLine` y `LivePlayerLine`, para la insignia de nivel de cada jugador en la sala.
  - `review` en `MixItem`, para el chip "ELO pendiente" de un interrumpido en el listado.
- **Pedidos del frontend de Ranking** (2026-10-24, bitácora [`2026-10-24-frontend-ranking`](bitacora/2026-10-24-frontend-ranking/GUIA_IMPLEMENTACION.md)):
  - **Bug:** en `GET /api/v1/seasons/{id}/standings` con el orden por defecto, los jugadores sin puesto salen por ELO **de menor a mayor**. `routes/seasons.ts:200` ordena `rank` con `['rank', 'elo']` y el `asc` se aplica a los dos; el contrato dice "al final, por ELO" (de mayor a menor). Lo mismo en la vista previa del cierre (línea 275).
  - (Opcional) `teams`, `rating`, `kd` y el filtro `level` en esa respuesta, para que la tabla de una temporada tenga las columnas del Histórico.
- **Dependencias de desarrollo con avisos de seguridad** (`npm audit`: `sharp` y `miniflare` vía wrangler, y `source-map-js`): no corren en producción. Se corrigen al pasar wrangler a 4.151 o superior, en `web/backend` y en `cloudflare/demo-worker`.
- **Matchmaking viejo:** lo desarrollaba mchssj (rama `origin/feat/matchmaking-5v5`) y estaba inestable. Se borra en el corte (`03_matchmaking.sql`); si se rehace, es desde cero.

## 7. Deuda técnica

### 7.0 Prueba del replanteo `23` desactualizada

`docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/23_whois.sql` espera `player_nick = 'Ficha23'`, pero desde la `09` el nick de una ficha vinculada a un usuario es su alias (`Alias23`). Por eso `correr.sh` se corta en la `23` y no llega a probar de la `24` en adelante. Hay que cambiar el valor esperado (encontrado el 2026-10-23; no se tocó, porque es de otro requerimiento). La `27` (2026-10-24) se probó con el mismo ciclo de `correr.sh`, a mano.

### 7.2 Ensayo del corte con la copia de producción del 2026-10-25 (02:02 UTC)

Cargada en la base local, con los replanteos 01 a 27 encima. Aparecieron dos datos que frenan el corte y hay que resolver en producción antes de aplicarlo (en la copia local se renombraron para seguir):

- **Alias repetido `musul`** (frena la `09`): dos cuentas. La original es del 2026-10-08 y tiene ficha (`18973074-…`). La otra es del 2026-10-20, sin ficha (`18b6b088-…`), y parece un registro duplicado. En local quedó como `musul_2`. Falta que Daniel decida qué hacer con ella.
- **Nick repetido `geusz`** (frena la `27`): dos fichas sin cuenta, cada una con su SteamID. Una tiene 2 partidas y 2 equipos (`9321d9c9-…`); la otra, 4 partidas y ningún equipo (`401abdde-…`). En local, la segunda quedó como `geusz_2`. Falta decidir si se fusionan (¿misma persona con dos Steam?) o se renombra una.
- **`cargar_datos.sh` choca con `clip_config`:** la migración de clips crea la fila `id = 1` y la copia también la trae. Para cargar, se vaciaron las tablas de `public` antes de `public.sql`. Hay que sumarlo al script.

### 7.1 Voz en partida (reemplaza "`sm_deadtalk 0` obligatorio")

Daniel definió el 2026-10-16 (opción B): **en el calentamiento se escuchan todos; en la partida, solo el propio equipo, vivos y muertos.** Lo hacen los cfg de fase (`sv_alltalk 1` en `warmup.cfg` y `end.cfg`; `sv_alltalk 0` y `sm_deadtalk 2` en `live.cfg`), ya puestos en los dos servidores. Ver [`2026-10-16-chat-vivos-muertos`](bitacora/2026-10-16-chat-vivos-muertos/DOCUMENTACION.md).

## Contexto útil para una sesión nueva

- **Convenciones:**
  - Cada requerimiento va en `docs/bitacora/AAAA-MM-DD-slug/` con `PLAN.md` (no se edita después), `DOCUMENTACION.md`, `GUIA_IMPLEMENTACION.md` y `pruebas/` opcional, más una fila en el índice. Formato en [`bitacora/PLANTILLA.md`](bitacora/PLANTILLA.md).
  - Todo en español, con diagramas Mermaid.
  - Changelog para jugadores: `CHANGELOG_DISCORD.txt` en la carpeta del requerimiento. Texto plano, primera línea `v34frag X.Y.Z --  Changelog` (dos espacios después de `--`), con tuteo y sin detalles técnicos.
- **Credenciales:** todas en el `.env` de la raíz, que no se versiona. `SFTP_CSS_*` es el servidor real, `SERVER1_*` es RBK, `FTP_WEB_*` es la web, `PTERO_PANEL_*` es la API del panel, y además `DEMO_WORKER_TOKEN` y `ACCELERATOR_CRASH_KEY`. Para SFTP se usó `paramiko` en un entorno virtual aparte.
- **Servidor local de pruebas:**
  - Está en `E:\CSS DEDICATED SERVER\server`: SourceMod 1.10, Accelerator, puerto 27016, RCON con la clave de `cstrike\cfg\server.cfg`.
  - Las pruebas se hacen con bots en `$2000$` y equipos desparejos (3 contra 1), con la build de depuración (`spcomp csstv_reporter.sp CSSTV_DEBUG=`) y `csstv_debug_fakecmd <userid> <comando>`.
  - **Envía a la Supabase real:** poner `csstv_send 0` después de cada carga del cfg y vaciar `data/csstv/queue/` antes de reiniciar.
  - Scripts en `docs/bitacora/2026-10-13-plugin-1-6-0/pruebas/lib.sh`.
  - **Con la Supabase local corriendo** (Docker), srcds toma la interfaz de Docker (`172.24.0.1`): RCON va por esa dirección.
  - **Bots:**
    - `bot_add_ct <nombre>` solo acepta nombres de `BotProfile.db`. Para otros nombres se usa `sm_rename`; con `CSSTV_DEBUG`, el SteamID falso sale del nombre actual.
    - Un `jointeam` de un bot que procesa el motor **tira el servidor**, aun sin nuestro plugin. Para moverlos se usa `!team` / `sm_team`.
- **Servidor real:** ExtremeHost (Pterodactyl, Linux), SourceMod 1.10. No tenemos RCON: se verifica con la consola del panel o con logs por SFTP. Los servidores de terceros (RBK) llevan build licenciado, nunca el `.smx` genérico. **Regla:** todo despliegue al servidor real se hace también a los externos (RBK) en la misma tanda (ver `CLAUDE.md`).
- **Pruebas de SQL:** PostgreSQL 18 local (`initdb` + `pg_ctl` en un puerto libre), `docs/bitacora/2026-10-11-elo-jugadores/pruebas/stub_supabase.sql`, todas las migraciones en orden y después los `pruebas_*.sql`.

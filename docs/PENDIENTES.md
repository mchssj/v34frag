# Pendientes

Todo lo que se planteó o se empezó y todavía no está terminado o desplegado. Actualizado el **2026-10-17**.

Si retomas el proyecto en una sesión nueva, empieza por acá. El detalle de cada punto está en su carpeta de [`bitacora/`](bitacora/); el índice con todos los requerimientos es [`bitacora/README.md`](bitacora/README.md).

## Orden de trabajo (decidido por Daniel el 2026-10-15)

**Primero todo lo de la web** (base del replanteo, backend, frontend nuevo y plan del VPS). **Los plugins quedan para el final.**

Lo que está pendiente del lado del plugin, congelado hasta entonces:
- **Plugin 2.0.0 (`!match` y `!status`):** hecho y probado con bots. **Subido el 2026-10-17 dentro de la 2.1.0** (punto 1.7); `!match` funciona recién con el corte.
  - Faltan las pruebas manuales con jugadores reales ([`PRUEBAS_MANUALES.md`](bitacora/2026-10-15-match-y-status/PRUEBAS_MANUALES.md)), que además conviene hacer con la web nueva avanzada.
  - Falta el despliegue en el servidor real y en RBK (punto 1.5).
- **Excepción:** `csstv_allchat` (chat para vivos y muertos) se hizo y se subió el 2026-10-16, a pedido de Daniel, como plugin aparte (punto 1.0).
- **Excepción:** mixes en vivo y mixes interrumpidos (plugin **2.1.0**), pedido por Daniel el 2026-10-17 para el plugin y la web vieja. Hecho, probado en local y **desplegado el 2026-10-17** en la base, la web, el servidor real y RBK (punto 1.7).
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
- **[`docs/frontend/contract.md`](frontend/contract.md):** contrato único para el frontend con todas las decisiones de diseño (escrito el 2026-10-15, pedido de Daniel). **Mantenerlo al día:** cada entrega del backend que cambie algo para el frontend actualiza su sección y la marca de estado (disponible, en implementación, pendiente).

## Estado del repositorio

| Qué | Estado |
|---|---|
| Plugin 1.8.0, ELO por participación, Accelerator, bitácoras de RBK y de esos tres requerimientos, `CLAUDE.md` y este archivo | **Commiteado en `main`** el 2026-10-14 (4 commits, sin push) |
| Backend API: `web/backend/`, `supabase/schema/`, bitácora `2026-10-14-backend-base-auth-perfil/` y lo que va con ella | En la rama `feat/backend-api-fase-1`, sin merge a `main` |
| Bitácora `2026-10-14-web-pages-worker/` (plan sin aprobar) | Sin commit |
| Mixes en vivo (2026-10-17): migración `20261017120000`, plugin 2.1.0, `index.html`, ajustes de las `04`, `06` y `10` del replanteo y su bitácora | Sin commit |
| `.idea/` y `message.txt` | Sin commit. No son de ningún requerimiento: preguntarle a Daniel antes de commitearlos |

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

### 1.5 Corte del replanteo: migraciones 01 a 17 y plugin 2.0.0 (`!match` y `!status`) con 2.1.0 (mixes en vivo) y 2.2.0 (`!claim`)

Nada de esto se despliega antes del corte: la web vieja sigue usando la base de producción.

- **Base:** `supabase/replanteo/01` a `17`, en orden, con respaldo previo. La `16` necesita la migración de mixes en vivo (`20261017120000`), ya aplicada en producción. La `09` aborta si hay alias repetidos sin distinguir mayúsculas, la `10` si hay roles desconocidos y la `12` si hay nombres de servidor repetidos o IPs permitidas inválidas, y la `14` si hay Workers de demos con el mismo nombre (en la copia del 2026-10-14 no hay ninguno de esos casos).
- **La `15` necesita la migración de ajustes de ELO** (`supabase/migrations/20261015210000_elo_ajustes.sql`, punto 1.6) aplicada antes: si no está, aborta.
- **Plugin 2.2.0 con `!claim`** (bitácora `2026-10-16-claim-steamid`, que lo llama 2.1.0: el número pasó a los mixes en vivo, punto 1.7): todavía no está hecho. Se programa con los plugins, al final, y sale en esta misma tanda.
- ~~**`sm_status`**~~: revisado el 2026-10-17 con `smx_grep.py` sobre todos los plugins de los dos servidores: ninguno lo registra.
- **Plugin 2.0.0:** ya está subido dentro de la 2.1.0 (punto 1.7), en el servidor real y en RBK. En el corte solo falta la 2.2.0 (`!claim`), por los mismos accesos y con el mismo cuidado (genérico al servidor real, licenciado a RBK).
- **Verificar después del corte:** `!match ZZZZZ` responde "No hay ninguna partida con ese código".
- **Changelog** para Discord: `bitacora/2026-10-15-match-y-status/CHANGELOG_DISCORD.txt`.
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

## 2. Investigaciones abiertas

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
     - ~~Listados con paginación, filtros y orden en el servidor~~ (requisito obligatorio de Daniel): **hechos el 2026-10-15**, migración `11`. Ver [`2026-10-15-get-paginacion-filtros`](bitacora/2026-10-15-get-paginacion-filtros/DOCUMENTACION.md). Todo endpoint nuevo de lista tiene que seguir la convención de `docs/frontend/contract.md`.
     - ~~Admin de servidores (tokens, licencias, panel)~~: **hecho el 2026-10-16**, solo en local (migración `12` y endpoints `/api/v1/admin/servers`). Ver [`2026-10-16-api-admin-servidores`](bitacora/2026-10-16-api-admin-servidores/DOCUMENTACION.md).
     - ~~Configuración del ELO y recálculo~~: **hechos el 2026-10-16**, solo en local (migración `13`, la simulación, y endpoints `/api/v1/elo/config` y `/api/v1/admin/elo/*`). Recalcular pide doble confirmación (`confirm: "estoy seguro"`). Ver [`2026-10-16-api-elo-config`](bitacora/2026-10-16-api-elo-config/DOCUMENTACION.md).
     - ~~Perfiles sin reclamar, `!claim` y varios SteamID por ficha~~ (base y backend): **hechos el 2026-10-16**, solo en local (migración `15` y endpoints). Falta el **plugin 2.2.0** con `!claim` (va en el corte, en la misma tanda que la 2.0.0) y el frontend. Ver [`2026-10-16-claim-steamid`](bitacora/2026-10-16-claim-steamid/DOCUMENTACION.md).
     - ~~Demos desde el admin~~: **hechas el 2026-10-16**, solo en local (migración `14` y endpoints `/api/v1/admin/demos*` y `/api/v1/admin/demo-workers`): resumen, listado, reintentar una demo perdida y tokens del Worker de demos (el token nuevo pide doble confirmación). Ver [`2026-10-16-api-demos-admin`](bitacora/2026-10-16-api-demos-admin/DOCUMENTACION.md).
     - ~~Plantilla "Grupos de doble eliminación + playoffs" (`groups_double`) y sorteo~~: **hechos el 2026-10-18**, solo en local (migración `17` y `POST /api/v1/events/{id}/draw`). Ver [`2026-10-18-torneo-grupos-doble`](bitacora/2026-10-18-torneo-grupos-doble/DOCUMENTACION.md).
     - ~~Mixes en vivo e interrumpidos~~: **hechos el 2026-10-17**, solo en local (migración `16` y endpoints `/api/v1/mixes/live*`, `/api/v1/admin/mixes/*` y `review` en partidas). Aprobar el ELO pide doble confirmación y vincula el juego si se jugaba con `!match`. Ver [`2026-10-17-api-mixes-en-vivo`](bitacora/2026-10-17-api-mixes-en-vivo/DOCUMENTACION.md).
- **Dependencias de desarrollo con avisos de seguridad** (`npm audit`: `sharp` y `miniflare` vía wrangler, y `source-map-js`): no corren en producción. Se corrigen al pasar wrangler a 4.151 o superior, en `web/backend` y en `cloudflare/demo-worker`.
- **Matchmaking viejo:** lo desarrollaba mchssj (rama `origin/feat/matchmaking-5v5`) y estaba inestable. Se borra en el corte (`03_matchmaking.sql`); si se rehace, es desde cero.

## 7. Deuda técnica

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

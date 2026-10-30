# Pendientes

Todo lo que se planteó o se empezó y todavía no está terminado o desplegado. Actualizado el **2026-10-30**.

Si retomas el proyecto en una sesión nueva, empieza por acá. Lo que le toca a cada uno de los prototipos VIP y las misiones del 2026-10-29 está juntado en [`RESUMEN_PROTOTIPOS_VIP.md`](RESUMEN_PROTOTIPOS_VIP.md). El detalle de cada punto está en su carpeta de [`bitacora/`](bitacora/); el índice con todos los requerimientos es [`bitacora/README.md`](bitacora/README.md).

## Estado del repositorio

| Qué | Estado |
|---|---|
| Plugin 1.8.0, ELO por participación, Accelerator, bitácoras de RBK y de esos tres requerimientos, `CLAUDE.md` y este archivo | **Commiteado en `main`** el 2026-10-14 (4 commits, sin push) |
| Backend API: `web/backend/`, `supabase/schema/`, bitácora `2026-10-14-backend-base-auth-perfil/` y lo que va con ella | En la rama `feat/backend-api-fase-1`, sin merge a `main` |
| Bitácora `2026-10-14-web-pages-worker/` (plan sin aprobar) | Sin commit |
| `.idea/` y `message.txt` | Sin commit. No son de ningún requerimiento: preguntarle a Daniel antes de commitearlos |

Mensajes de commit en formato Conventional Commits (`feat(servidor): …`, `docs(bitacora): …`), en español, como los anteriores.

## 1. Desplegar lo que ya está hecho

Ordenado por urgencia.

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

### 1.5 Widget para streamers (OBS)

- **Qué falta:**
  1. Correr `supabase/migrations/20261029120000_widget_streamers.sql` en el SQL Editor.
  2. Subir **juntos** `index.html`, `niveles.js` y `widget.html` a la web. `index.html` sin `niveles.js` rompe los niveles y el perfil.
  3. Probarlo en OBS.
- No toca el plugin, así que no hay nada que subir al servidor real ni a RBK.
- **Al hacer el corte al backend nuevo:** portar `widget_player` al replanteo usando `elo_key()` (varios SteamID por ficha) y excluir `mix_deletions`.
- Sin commit, en `kyan/pruebas`.
- **Bitácora:** [`2026-10-29-widget-streamers`](bitacora/2026-10-29-widget-streamers/). Pasos en la guía; changelog para Discord en la carpeta.

### 1.6 Tienda de cosméticos en la web

- **Qué falta:**
  1. Correr `supabase/migrations/20261028120000_vip.sql` (VIP del backend; si ya se corrió, es re-ejecutable) y después `supabase/migrations/20261029180000_tienda.sql` en el SQL Editor. **No se probaron en ningún Postgres**: conviene correrlas antes en un proyecto de prueba o en la base local del backend.
  2. Publicar **juntos** `index.html` y la carpeta `assets/perfil/`.
  3. Probar comprar, equipar, la portada y Admin → Tienda (puntos, regalos y VIP).
- No toca el plugin, así que no hay nada que subir al servidor real ni a RBK.
- **Al hacer el corte:** el replanteo `34_tienda.sql` parte de esta migración, con `elo_key()`, `mix_deletions` y los avisos con `notify()`.
- **Bitácora:** [`2026-10-29-tienda-web`](bitacora/2026-10-29-tienda-web/). Pasos en la guía; changelog para Discord en la carpeta.

### 1.7 Fondo de miniperfil y progresión VIP (sin commit)

- **Qué es:**
  - **Fondos:** 24 fondos animados, del tipo nuevo `background`.
  - **Matchmaking:** el lobby y la sala muestran marco, efecto de nombre e insignia VIP.
  - **VIP:** ser VIP da solo el Marco Oro VIP. Lo demás se compra con monedas VIP, que se ganan en mixes jugados siendo VIP y son configurables. Si se vence el VIP, el saldo y lo comprado quedan congelados.
- **Dónde se ve:** solo en los demos del frontend nuevo, en `/demo/tienda` y `/demo/matchmaking` (`kyan/ejemplo-matchmaking`).
- **Qué falta:**
  1. Probar y correr `20261029200000_fondo_miniperfil.sql` y `20261029210000_vip_progresion.sql`, después de las dos de 1.6. **No se probaron en ningún Postgres.**
  2. **No correr `20261029210000_vip_progresion.sql` con la tienda de `index.html` publicada:** esa tienda todavía trata lo VIP como gratis.
  3. Rutas de la API para monedas VIP y cosméticos del matchmaking (`MmCosmetics`).
- No toca el plugin, así que no hay nada que subir al servidor real ni a RBK.
- **Bitácora:** [`2026-10-29-fondo-miniperfil`](bitacora/2026-10-29-fondo-miniperfil/) y [`2026-10-29-vip-progresion`](bitacora/2026-10-29-vip-progresion/).

### 1.8 Prototipos VIP: exportar stats y buscador avanzado

- **Qué es:** dos prototipos de Kyan en el frontend nuevo (`kyan/ejemplo-matchmaking`), con datos en memoria:
  - `/demo/exportar`: tarjeta de stats en PNG o PDF.
  - `/demo/buscador`: filtros avanzados de jugadores y partidas.
- **Qué falta:**
  - **Daniel:**
    - La ruta de stats por período.
    - Los filtros nuevos en `ranking/players` y `mixes`, con chequeo de VIP.
    - Que `levelBounds` acepte cualquier rango de niveles.
  - **Esteban:** llevar los dos prototipos al perfil, a `/players` y al listado de mixes.
- **Niveles:** usan los mismos pisos que el backend. `features/search/levels.test.ts` avisa si se desincronizan.
- No toca el plugin, así que no hay nada que subir al servidor real ni a RBK.
- **Bitácora:** [`2026-10-29-exportar-stats`](bitacora/2026-10-29-exportar-stats/) y [`2026-10-29-buscador-avanzado`](bitacora/2026-10-29-buscador-avanzado/).

### 1.9 Prototipos VIP: ELO, recálculo, comparador y widget para la bio

- **Qué es:** cuatro prototipos de Kyan en el frontend nuevo (`kyan/ejemplo-matchmaking`), con datos en memoria:
  - `/demo/elo`: el desglose de la fórmula de ELO.
  - `/demo/recalculo`: la vista previa del cierre de temporada.
  - `/demo/comparador`: hasta 5 jugadores.
  - `/demo/bio`: panel de Twitch, firma y tarjeta del link.
- **Cuidado:** `features/elo/formula.ts` y `features/season/preview.ts` copian las reglas de `elo_apply_match` y de `24_temporadas.sql`. Si cambian en la base, hay que cambiarlas ahí. Los tests ayudan a darse cuenta.
- **Qué falta:**
  - **Daniel:**
    - El desglose por mix.
    - Tu fila de `season_live_standings` con los vecinos.
    - `players/compare` con 5 jugadores.
    - Para el widget de la bio: la imagen dinámica `card.png`, Open Graph en el perfil y la página del iframe.
    - El chequeo de VIP en todo eso.
  - **Esteban:** llevar los cuatro al perfil y al ranking.
- No toca el plugin, así que no hay nada que subir al servidor real ni a RBK.
- **Bitácora:** [`2026-10-29-desglose-elo`](bitacora/2026-10-29-desglose-elo/), [`2026-10-29-proximo-recalculo`](bitacora/2026-10-29-proximo-recalculo/), [`2026-10-29-comparador-5`](bitacora/2026-10-29-comparador-5/) y [`2026-10-29-widget-bio`](bitacora/2026-10-29-widget-bio/).

### 1.10 Prototipos VIP: favoritas, créditos y stats de torneo

- **Qué es:** tres prototipos más en el frontend nuevo (`kyan/ejemplo-matchmaking`), con lo que quedaba de la lista VIP fuera del perfil:
  - `/demo/favoritas`
  - `/demo/creditos`
  - `/demo/torneo-stats`
- **Quedaron afuera, a propósito:**
  - Firma o banner, galería, pestañas extra y el regalo de bienvenida, porque **son del perfil y los está haciendo Esteban**.
  - Los puntos VIP canjeables, porque ya están en la progresión VIP (1.7).
  - El ícono y borde VIP en el ranking, el verificado y el Top VIP del mes: se hizo un prototipo (`/demo/ranking-vip`) y Kyan lo descartó el 2026-10-29.
- **Qué falta:**
  - **Daniel:**
    - Las rutas que pide cada bitácora, con el chequeo de VIP.
    - Los clutches de las stats del torneo llegan con el plugin nuevo (schema 2); las entradas ya están.
  - **Esteban:** llevarlos a la web.
  - Confirmar los roles de "Hecho por" en los créditos.
- No toca el plugin, así que no hay nada que subir al servidor real ni a RBK.
- **Bitácora:** [`2026-10-29-partidas-favoritas`](bitacora/2026-10-29-partidas-favoritas/), [`2026-10-29-creditos`](bitacora/2026-10-29-creditos/) y [`2026-10-29-stats-torneo`](bitacora/2026-10-29-stats-torneo/).

### 1.11 Misiones semanales y Primeros pasos (prototipo)

- **Qué es:** `/demo/misiones` del frontend nuevo (`kyan/ejemplo-matchmaking`). Tiene un popout en la barra de arriba (pestañas "Esta semana" y "Primeros pasos"), una página y la vista de admin.
- **Semanales:** de juego y comunidad.
  - Cada semana salen 6 para todos y 3 VIP, al azar.
  - Una que salió no vuelve hasta dentro de 2 semanas, y en una semana no se repite la misma stat.
- **Primeros pasos:** las de la web (votar o subir clips, entrar a la web, comparar, tienda…). Se hacen una sola vez desde que te registrás.
- **Datos:** usan los mismos datos del servidor que las medallas. 12 de las 55 semanales esperan:
  - 9, el plugin nuevo (schema 2, ver `MEDALLAS_DATOS_REPORTER.md`).
  - 3, otros sistemas (grupos del matchmaking y referidos).
- **Qué falta:**
  - **Daniel:**
    - Las tablas `missions`, `mission_weeks` y `mission_progress` (con `week` en null para Primeros pasos).
    - Sumar el progreso con cada mix y cada evento.
    - El cron del lunes 06:00 y las rutas, con chequeo de VIP.
  - **Esteban:** el popout, la página y el admin.
- No toca el plugin, así que no hay nada que subir al servidor real ni a RBK. El plugin nuevo, cuando se haga, sí va a los dos servidores.
- **Bitácora:** [`2026-10-29-misiones-semanales`](bitacora/2026-10-29-misiones-semanales/).

### 1.12 Página Hacete VIP y configs de los jugadores (prototipos)

- **Qué es:**
  - `/demo/vip`: los planes (precios de ejemplo), la tabla de beneficios con y sin VIP, el estado de tu VIP y qué pasa con cada beneficio cuando se vence. Los candados de todos los demos VIP llevan ahí.
  - `/demo/configs`: la pestaña Config del perfil. Cualquiera sube su carpeta `cfg` (`.rar`, `.zip` o la carpeta) y solo los VIP ven el contenido y descargan.
- **La revisión de las configs:**
  - Solo se aceptan `.cfg`, `.vdf`, `.scr`, `.rc` y `.txt`. Un comprimido con un `.exe` se rechaza entero.
  - Las contraseñas (`rcon_password`…) se sacan antes de publicar.
  - Los scripts dejan la config en revisión, y así no se puede descargar.
- **Qué falta:**
  - **Kyan:**
    - Los precios, si Premium y VIP son dos niveles, los días de gracia y lo propuesto de la tabla de vencimiento.
    - Qué scripts están prohibidos.
  - **Daniel:**
    - El medio de pago, la tabla de suscripciones, la función única "¿es VIP?" y el alta manual.
    - Para las configs: storage, revisión en el servidor (que abra los `.rar`), rutas y cola de moderación.
  - **Esteban:** la página `/vip`, "Mi suscripción" en la cuenta y la pestaña Config del perfil.
- No toca el plugin, así que no hay nada que subir al servidor real ni a RBK.
- **Bitácora:** [`2026-10-29-hacete-vip`](bitacora/2026-10-29-hacete-vip/) y [`2026-10-29-configs-jugadores`](bitacora/2026-10-29-configs-jugadores/).

### 1.13 Plugin de retake (`v34_retake`, sin licencia)

- **Estado:** subido el 2026-10-30 a `aurav34` (`45.235.98.57:27062`, `SFTP_CSS_*`), que queda como servidor solo de retake, con `sm_retake_autostart "1"`. Solo tiene spawns de `de_dust2_ob`. **No está en RBK ni en `FLOW_SERVER`**: fue una decisión de Kyan. Sin commit.
- **Qué falta:**
  - Cargar spawns de otros mapas: sin eso la votación de la ronda 25 no tiene opciones.
  - Confirmar con jugadores: `!guns` guardado, `!top` y `!rank`, menú de modelos, barra de desactivar, votación con votos reales, VIP y AFK.
  - Revisar el sorteo de AWP con un solo anotado, que en la prueba dio 50 % en vez de 30 % (22 sorteos).
  - Decidir si `csstv_reporter` se saca de `aurav34`. Hoy `rtv` escrito en el chat todavía lo atiende.
  - Revisar los otros `csstv_*` de ese servidor y la convivencia con el reporter 1.8.0.
  - Borrar `cfg/server.cfg.bak_pw` si no hace falta: tiene la contraseña vieja.
- **Pruebas:** los plugins del servidor se prueban en `C:\Users\Agus\Downloads\cssds`, el ambiente de Agus, antes de ir a producción.
- **VIP, se hace al finalizar:** hoy el plugin reconoce a un VIP por el flag `o` de SourceMod, que se carga a mano en `admins_simple.ini`. Falta sincronizar esa lista con el VIP de la web, que todavía es un prototipo (ver 1.7 y 1.12).
- **Bitácora:** [`2026-10-30-plugin-retake`](bitacora/2026-10-30-plugin-retake/). Changelog para Discord en la carpeta.

### 1.15 Plugin 2v2 (`v34_wingman`)

- **Estado:** probado con bots en `cssds` y subido el 2026-10-30, inactivo, a `aurav34` y a RBK. En `aurav34` se prende con `sm_2v2 1`; el retake se tiene que apagar antes y, por su autostart, vuelve en cada cambio de mapa. **RBK no tiene `de_dust2_ob`**, y Kyan dijo que probablemente dejen de pagar ese servidor. No está en `FLOW_SERVER`.
- **Qué falta:**
  - Subir `de_dust2_ob` a RBK o cargar los puntos de otro mapa.
  - Cargar sitio, 2 spawns y zonas de `de_inferno` (sitio A). `de_dust2_ob` ya está cargado (3 zonas) y en el repo.
  - Probar con jugadores: antes que nada la compra fuera de la zona, porque los bots no compran por comando y en `de_dust2_ob` el spawn cae dentro de la zona. También el bloqueo de zonas, la cámara en primera persona, la voz por equipo y `!admin`.
- **Bitácora:** [`2026-10-30-plugin-2v2`](bitacora/2026-10-30-plugin-2v2/). Changelog para Discord en la carpeta.

### 1.14 Spam de grafitis

- `decalfrequency` pasó de `0.1` a `60` en `aurav34` y RBK el 2026-10-30, con respaldo en `cfg/server.cfg.bak_decal`.
- **Falta `FLOW_SERVER` (`panel-mvzg.com`):** el `.env` no tiene `SERVER2_PANEL_API_KEY` y el SFTP cerró la conexión. Poner `decalfrequency 60` en su `server.cfg`.

### 1.16 Anticheat v34FRAGNATION

- **Estado:** auditoría de la etapa 0 entregada el 2026-10-30. Nada implementado ni desplegado, ni en el servidor real ni en RBK.
- **Decidido por Kyan:** FRAG es independiente del EAC de ClientMod, y las pruebas de campo van al final.
- **Captura:** funciona en pantalla completa exclusiva sin hooks, probada en una PC.
- **Qué falta:** las 6 decisiones abiertas de la guía y, al final, las pruebas de campo: tirones, Alt+Tab, modos ventana y sin bordes, otras PC.
- **Bitácora:** [`2026-10-30-anticheat-etapa-0-auditoria`](bitacora/2026-10-30-anticheat-etapa-0-auditoria/) y [`2026-10-30-anticheat-captura`](bitacora/2026-10-30-anticheat-captura/).

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
| [`2026-10-11-reclamo-perfil-servidor`](bitacora/2026-10-11-reclamo-perfil-servidor/PLAN.md) | Perfil automático al terminar el primer mix y `!claim <código>` en el juego para vincular el perfil con la cuenta web (código de un solo uso generado en la web) | Aprobación de Daniel. Nada implementado |
| [`2026-10-14-web-pages-worker`](bitacora/2026-10-14-web-pages-worker/PLAN.md) | Plan general: API REST (Hono + OpenAPI) por la que pase todo lo que hoy hace el navegador contra Supabase, motor de torneos en el backend, frontend nuevo y despliegue con GitHub Actions | **Parcialmente superado:** el backend avanza con su propio plan (sección 6) y el hosting pasó de Cloudflare Pages y Workers a un VPS de Hostinger. La parte de despliegue hay que replanearla para el VPS |

## 4. Verificaciones que nunca se hicieron

No bloquean nada, pero quedaron anotadas como pendientes.

| Qué | Dónde |
|---|---|
| Prueba con jugadores reales de la QoL 1.2.0: TAB después del medio tiempo, sin menú de modelos al cambiar de lado, tildes en el chat de ClientMod, daño igual al de la consola, contador del freezetime en pausa, `!hp`, reproducir la demo | [`2026-10-11-qol-servidor/GUIA_IMPLEMENTACION.md`](bitacora/2026-10-11-qol-servidor/GUIA_IMPLEMENTACION.md), sección "Pendiente" |
| Revisión en el navegador de la web del ELO: columnas, perfil, insignias, tema claro y oscuro | [`2026-10-11-elo-jugadores/GUIA_IMPLEMENTACION.md`](bitacora/2026-10-11-elo-jugadores/GUIA_IMPLEMENTACION.md) |
| Web del ELO configurable, demos y ELO por participación: nunca se probaron en el navegador (solo sintaxis) | Guías de cada una |
| `sm_csstv_status` en el servidor real para confirmar 1.5.0, 1.6.0 y 1.7.0 | **Resuelto indirectamente el 2026-10-14:** el servidor tiene la 1.7.0 (83946 bytes) y los logs muestran mixes con ronda de cuchillo y licencia válida |
| RBK: confirmar que cargó la 1.7.0 licenciada | **Resuelto el 2026-10-14:** `data/csstv/license.txt` se actualizó a las 18:33 (licencia validada) |

## 5. Cosas sueltas del servidor real

- `configs/adminmenu_cfgs.txt` tiene una sección sin cerrar (línea 33) y `basecommands` lo reporta en cada mapa.
- `CM_PickupWeapon.smx` no puede escribir su cfg por permisos.
- En `extensions/` hay archivos de CSS:DM (13/10, 22:50) sin ningún plugin que los use. Habría que preguntar quién los subió y si se pueden borrar.
- `start.sh` en la raíz no es lo que usa el panel: el arranque real lo define Pterodactyl (el puerto 27062 era el de ExtremeHost; en MVZG es 27016). Ver la nota de `+tv_enable 1` en la bitácora `2026-10-11-qol-servidor`.

## 6. Backend API (`web/backend`)

Primera fase (base, Auth y Mi perfil; Node 24 + Hono + TypeScript) **terminada el 2026-10-14**: 161 pruebas y cobertura del 96 % (mínimo exigido: 60 %), probada en local contra una Supabase en Docker con el esquema real. Nada desplegado.

- **Bitácora:** [`2026-10-14-backend-base-auth-perfil`](bitacora/2026-10-14-backend-base-auth-perfil/). Cómo trabajar en el backend: [`web/backend/README.md`](../web/backend/README.md).
- **`.env` de la raíz:** la línea 30 se llama `PG_PASSWORD` pero tiene el usuario. Tiene que ser `PG_USER=postgres.<ref del proyecto>` (el valor está en Supabase → Connect → Session pooler) (usuario del *Session pooler*). Hasta que se corrija, `supabase/schema/volcar.sh` necesita `PGUSER` y `PGPASSWORD` a mano.
- **Hosting decidido:** VPS KVM 1 de Hostinger con dominio propio. Cloudflare se queda solo con el Worker de demos y R2. El despliegue (build, servicio de Node, Caddy con HTTPS, DNS, pipeline y SMTP para Supabase Auth) necesita su propio plan.
- **Después de esta fase**, en este orden (decidido por Daniel):
  1. **Fase de "replantear" módulos:** revisar el modelo de datos y sacar lo que ya no se usa. Candidatos: `player_claims`, `profiles.player_id`, `match_chat.tag`, `player_medals.color`, políticas RLS duplicadas y las tablas `matchmaking_*`.
  2. **Endpoints de dominio** (jugadores, equipos, partidas, torneos, admin), cada uno con su plan.
- **Dependencias de desarrollo con avisos de seguridad** (`npm audit`: `sharp` y `miniflare` vía wrangler, y `source-map-js`): no corren en producción. Se corrigen al pasar wrangler a 4.151 o superior, en `web/backend` y en `cloudflare/demo-worker`.
- **Pregunta abierta:** las 4 tablas `matchmaking_*` y sus 11 funciones están en producción pero no tienen migración en el repo ni uso en la web o el plugin. Hay que saber quién las creó y si se usan.

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
- **Servidor real:** MVZG desde octubre de 2026, antes ExtremeHost (Pterodactyl, Linux), SourceMod 1.10. IP 190.104.34.3, puerto 27016. El TCP del puerto del juego está bloqueado en el nodo por un DDoS al RCON: ver [`DDOS_SERVIDOR.md`](DDOS_SERVIDOR.md) y pedirle lo mismo a cualquier host nuevo. No tenemos RCON: se verifica con la consola del panel o con logs por SFTP. Los servidores de terceros (RBK) llevan build licenciado, nunca el `.smx` genérico. **Regla:** todo despliegue al servidor real se hace también a los externos (RBK) en la misma tanda (ver `CLAUDE.md`).
- **Pruebas de SQL:** PostgreSQL 18 local (`initdb` + `pg_ctl` en un puerto libre), `docs/bitacora/2026-10-11-elo-jugadores/pruebas/stub_supabase.sql`, todas las migraciones en orden y después los `pruebas_*.sql`.

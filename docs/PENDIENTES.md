# Pendientes

Todo lo que se planteó o se empezó y todavía no está terminado o desplegado. Actualizado el **2026-11-05**.

> **RBK dejó de usarse el 2026-10-29** (Daniel). Los puntos que dicen "en RBK" quedan como historia; lo que estaba pendiente en RBK se cancela y los despliegues van solo al real y a flow.

> **Numeración nueva desde el 2026-11-02** (Daniel): **#1** es el servidor "MVZG" (`SFTP_CSS_*_MVZG`, en el mismo panel que flow), **#2** es flow (`SERVER2_*`) y **#3** es el servidor real de siempre en ExtremeHost (`SFTP_CSS_*`). Los puntos anteriores a esa fecha llaman "#1" o "servidor real" al de ExtremeHost (hoy #3), "#2" a RBK y "CMLeague #3" a flow (hoy #2). Desde ahora, todo despliegue va a los tres en la misma tanda (ver `CLAUDE.md`). Lo que falta en el #1 nuevo está en el punto 1.44.

## Términos y condiciones y política de privacidad (borradores, sin publicar)

- **Estado:** `terms/terminos.html` escrito y `terms/privacidad.html` reescrita el 2026-11-03, pedidos por Kyan. Cubren toda la plataforma, también lo que no está implementado, con la ley argentina (CCyC, Ley 24.240 y Ley 25.326). No tocan los servidores (ni `aurav34`, flow ni MVZG).
- **Falta:**
  - Aprobación de Daniel o Kyan y revisión de un abogado.
  - Datos completados el 2026-11-03 (Kyan): provincia de Buenos Aires, `cmleaguev34@gmail.com`, `https://dsc.gg/v34frag`, 13 años y los precios del VIP. Regiones (Kyan, 2026-11-03): Supabase en el oeste de Estados Unidos (Oregón) y el VPS de OVH en Beauharnois (Canadá). Es la **provincia** de Buenos Aires, no la Ciudad Autónoma (Kyan, 2026-11-03). Ya no queda ningún dato marcado en los textos.
  - Inscribir la base en el Registro Nacional de Bases de Datos de la AAIP.
  - Las dos páginas están en `terms/`. Google tiene cargada `https://csstv.gamer.gd/privacidad.html` para «CMLeague clips»: al publicar, subir la nueva también ahí o cambiar la URL en la consola de Google.
  - Ponerle un plazo a `player_ips`, que hoy no tiene.
  - Publicar las dos juntas y enlazarlas desde la web vieja. En el frontend nuevo ya están las rutas `/terminos` y `/privacidad`, con links en el pie y en el registro ([`2026-11-03-frontend-legales`](bitacora/2026-11-03-frontend-legales/)). Falta avisarle a Esteban y, si se quiere, una casilla de aceptación obligatoria en el registro. Los textos están en dos copias (`.html` y `features/legal/`): se cambian juntas.
  - **Cobro del VIP:** cobrar sin estar inscripto en ARCA (ex AFIP) es un tema impositivo aparte de estos textos.
- **Revisados contra la plataforma el 2026-11-03** (Daniel): lo planteado y no hecho quedó con "En preparación", y se corrigieron los resultados de torneos, las PCW y el aviso de la cola en Discord. Sin commit. Desde ahora, cada requerimiento revisa estos textos y el manual ([`2026-11-03-legales-al-dia`](bitacora/2026-11-03-legales-al-dia/)).
- **Bitácora:** [`2026-11-03-terminos-y-condiciones`](bitacora/2026-11-03-terminos-y-condiciones/) y [`2026-11-03-politica-privacidad`](bitacora/2026-11-03-politica-privacidad/).

Si retomas el proyecto en una sesión nueva, empieza por acá. El detalle de cada punto está en su carpeta de [`bitacora/`](bitacora/); el índice con todos los requerimientos es [`bitacora/README.md`](bitacora/README.md).

## Clips destacados en el perfil y rechazar un clip (2026-11-05): desplegado el 2026-11-06

- **Hecho:** replanteo `76`, Mi perfil › Clips (automático o elegidos; 3, 10 con VIP), la pestaña Clips de la ficha, y en Administración › Clips: **Rechazar clip**, el filtro Rechazados con **Recuperar** y los topes en Reglas ([`2026-11-04-clips-destacados-perfil`](bitacora/2026-11-04-clips-destacados-perfil/)). Probado en la base local (31 comprobaciones y la inversa), la API (543 pruebas) y la web (621 pruebas). La `76` quedó aplicada en la base local. Diseño: https://claude.ai/artifact/JtGZqvaTqnKzmSRxy7bgjA
- **Commiteado** en `feat/frontend-fase-1` el 2026-11-05 (no va en `feat/mm-claim-en-sala`: no es del matchmaking), sin los reemplazos.
- **Desplegado el 2026-11-06 (13:04-13:20 UTC)** desde `main` (`73d0e92e`), sin salas ni mixes en curso (la cola vacía; el #1 sin jugadores): la `76` en la base del VPS (antes, `probar_76.sh` contra producción: 31 comprobaciones y la inversa), la API y la web `73d0e92edcb8`.
- **Falta:** mirarlo con datos reales en el navegador y publicar el `CHANGELOG_DISCORD.txt` (2.9.17) y los términos.

## Reemplazos en el matchmaking (2026-11-05): desplegado el 2026-11-06, con el interruptor apagado

- **Hecho:** replanteo `75`, rutas `/api/v1/mm/replace/{token}`, aviso en Discord desde el worker del matchmaking, página `/mm/reemplazo/<token>`, bloque **Reemplazos** en Administración › Matchmaking y reporter **2.10.0** con `!callreplace` ([`2026-11-04-mm-reemplazos`](bitacora/2026-11-04-mm-reemplazos/)). Probado en la base local (44 comprobaciones, la inversa y los dos clics a la vez), la API (531 pruebas), la web (614 pruebas) y el plugin con bots en el servidor local (26 de 26, `e2e_bots_75.sh`). La `75` quedó aplicada en la base local.
- **Falta:**
  1. Con jugadores de verdad, en el primer mix con **Reemplazos** encendido: el menú y el voto de `!callreplace`, el bloqueo de `jointeam` y el `!gg` con un abandono cubierto (con bots no se puede).
  2. Encender **Reemplazos** en Administración › Matchmaking cuando el #1 haya cambiado de mapa (carga la 2.10.0), y probarlo en un mix.
  3. Publicar el `CHANGELOG_DISCORD.txt` (2.9.16) y los términos actualizados.
- **Commiteado** en `feat/frontend-fase-1` (`7c889be5`) y, sin la web ni el plugin, en `feat/mm-claim-en-sala` (`5592b98a`; esa rama sigue en el reporter 2.9.1).
- **Desplegado el 2026-11-06 (13:04-13:20 UTC)** desde `main` (`73d0e92e`), sin salas ni mixes en curso (la cola vacía; el #1 sin jugadores): la `75` en la base del VPS (antes, `probar_75.sh` contra producción con `cmleague-mm` parado: 44 comprobaciones y la inversa), las variables de Discord y `FRONTEND_URL` en `/etc/cmleague/season.env` (respaldo `season.env.bak-20261106`), la API con el worker y la web `73d0e92edcb8`, y el reporter 2.10.0 por la API de cada panel, comparado byte a byte: #1 genérico, #2 flow licenciado y #3 genérico en `disabled/`. La 2.9.3 quedó en `plugins/disabled/csstv_reporter_2.9.3.smx` en los tres (`pruebas/subir_2_10_0.py`). Entra en el próximo cambio de mapa.

## Supabase en el VPS (2026-11-03): hecho; faltan pruebas y el relay del HUD

- **Desde el 2026-11-03 a las 20:50 UTC, la base de producción está en el VPS** (`deploy/supabase/`, `https://db.cmleague.lat`).
  - La web estuvo caída 2 min 41 s.
  - La copia es idéntica a la nube, fila a fila.
  - Ya la usan la API, el socket, los timers, el relay del HUD, flow (#2), el #3 y el Worker de demos.
  - La nube (`wmzfwsizashpszxlvpeb`) queda sin uso, como vuelta atrás hasta el 2026-12-03: no escribirle.
  - Detalle en [`2026-11-03-supabase-en-vps`](bitacora/2026-11-03-supabase-en-vps/).
- **#1 MVZG en producción** (21:10 UTC):
  - Fila nueva `96bb5060` "Server CM League #1", con el id de su build licenciado; la vieja `7b01c85b` quedó como "flow (histórico)".
  - Su cfg ya tiene la URL, la clave y el token de producción.
  - **Con matchmaking** (`csstv_mm "1"`, `mm_enabled = true`). Toma salas cuando cargue el cfg.
  - Reiniciado: consulta la base nueva cada 5 s (2.9.2).
- **Falta:**
  - ~~**R2:** comprobar el respaldo automático del 2026-11-04~~: llegó a `cmleague-respaldos` a las 09:01 UTC, según el log del VPS. El bucket está en la cuenta de agusb06.
  - **Publicar la privacidad actualizada** en el próximo despliegue de la web (no hace falta para la base).
  - **Sin relación con el corte:**
    - Dar de alta a los streamers en producción (Administración): hay 0.
- **Matchmaking en el #1, primeros intentos (2026-11-03, los dos cancelados):**
  - **`de_nuke_old_blue` no está en el #1** y sí en el pool del 5v5: la sala se cancela con "El servidor no tiene el mapa". Subir el mapa o sacarlo del pool.
  - **Sala de `de_inferno`:** el último jugador entró a las 22:45:47, 11 s antes del plazo de conexión (5 min), porque varios tuvieron que hacer `!claim` dentro del servidor. `mm_tick` la canceló a las 22:46:00 con los 10 conectados. Revisar si el plazo debe seguir contando con todos adentro, y que el `!claim` se pueda hacer antes de entrar a la cola.
- **Primer mix completo en la base nueva (2026-11-03):** guardado y con su demo en R2, tras corregir el `panel_server_id` de flow. ~~El #1 no tiene `panel_server_id`: sus demos no se suben.~~ Arreglado el 2026-11-03: ver "Demos del #1" en el punto 1.44.
- **Ajustar Kong sin partidas en curso** (usa ~240 MB; Daniel lo deja para después).
- **flow (#2):** `csstv_claim "1"` en su cfg desde el 2026-11-03; se carga en el próximo cambio de mapa.
- **flow (#2) sin matchmaking desde el 2026-11-03 (21:25 UTC, Daniel):** `csstv_mm "0"` en su cfg y por consola, y `mm_enabled = false`. Se juega mix normal. Esa tarde tuvo `csstv_mm "1"` un rato.

## Medallas configurables (2026-11-04): listo para desplegar, falta todo el despliegue

- **Hecho y probado en local** (Daniel, 2026-11-05, "sigue el plan"); el 2026-11-06 pasó a la rama `feat/medallas` (sale de `main`, worktree `v34frag-medallas`), solo con las medallas: replanteo **`79`** (era la `78`, que ya es del matchmaking), API, motor `pnpm medals:tick`, `<Medal>` con los SVG de Kyan, Administración › Medallas y la pestaña Logros. Ensayado sobre una copia de producción del 2026-11-06 ([guía](bitacora/2026-11-04-medallas-configurables/GUIA_IMPLEMENTACION.md)).
- **Reglas del 2026-11-06 (Daniel):** el progreso de las bloqueadas solo lo ve el dueño de la ficha (y el admin); las stats de la BETA no cuentan (todo desde la temporada 2; Fundador y Pionero salen de la BETA, pero llegan al abrirse la temporada 2); el podio y el top de la BETA sí se dan al cerrarla; sin el aviso "Cuenta desde el 2026-10-29".
- **Urgente: la BETA de producción cierra el 2026-11-09 a las 09:00 UTC** (en la base; los documentos decían 2026-12-03). El despliegue tiene que estar antes.
- **Falta:**
  1. Desplegar (pasos en la guía): respaldo, `probar_79.sh` contra producción, la `79` y las definiciones, API, `cmleague-medals.timer` y web.
  2. Avisar en Discord antes del cierre de la BETA (unos 130 avisos de Fundador y Pionero al abrirse la temporada 2) y publicar el `CHANGELOG_DISCORD.txt`.
  3. Más adelante: `@fontsource/montserrat` (lo instala Daniel; hasta entonces, Arial).
  4. Con Kyan: diseño del Top 20 (hoy, el círculo del Top 10 en bronce), si en tamaño chico va la versión plana (pregunta 4) y que `brillo_solo_marco` sea la versión final; revisar las respuestas de Daniel a las preguntas del plan (abierta: la 8, "más mejorado").
  5. `badges/`, las misiones semanales y las insignias VIP siguen sin commit en `v34frag-main` (`feat-missions-badges`): no salen con las medallas.

## La sala en el link de reemplazo, el detalle como sala y el ELO del abandono (2026-11-06): desplegado

- **Hecho y probado en local:** replanteo `78`, la ruta `/api/v1/mm/games/{id}/room`, la sala en el link de reemplazo y en el detalle de la partida, y los topes del ELO del abandono en Administración › Matchmaking ([`2026-11-06-reemplazo-sala-y-abandono`](bitacora/2026-11-06-reemplazo-sala-y-abandono/)). Base: 12 comprobaciones y la inversa; API: 547 pruebas; web: 631. Diseño: https://claude.ai/artifact/Ndp1drqtYpRVGVcohLewjU
- **Desplegado el 2026-11-06 (14:56-15:02 UTC)** desde `main` (`8670768b`), sin salas, cola ni mixes en vivo, después del respaldo `20261106T145627Z` (también en R2): la `78` en la base del VPS (antes, `probar_78.sh` contra producción con `cmleague-mm` parado: 12 comprobaciones y la inversa), y la API y la web `8670768b56ef`. Topes: 10 a 15 si ganan, 15 a 20 si pierden.
- **Falta:** mirarlo en el navegador (el link con un reemplazo abierto, la sala del reemplazo y el detalle de una partida) y publicar el `CHANGELOG_DISCORD.txt` (2.9.19) y los términos.

## Irse en la última ronda no es abandono (2026-11-06): desplegado

- **Hecho y probado en local** (Daniel, 2026-11-06): replanteo `77`. En el matchmaking, quien sigue desconectado al terminar pero le faltó como mucho la última ronda ya no queda como abandono: sin sanción y con ELO normal. Manual y términos actualizados ([`2026-11-06-abandono-ultima-ronda`](bitacora/2026-11-06-abandono-ultima-ronda/)). Commiteado en `main` y en `feat/frontend-fase-1`; la base, también en `feat/mm-claim-en-sala`.
- **Desplegado el 2026-11-06 (14:56-15:02 UTC)** desde `main` (`8670768b`), sin salas, cola ni mixes en vivo, después del respaldo `20261106T145627Z` (también en R2): la `77` en la base del VPS (antes, `probar_77.sh` contra producción: 5 de 5 y la inversa) y la web `8670768b56ef`, en la misma tanda que la `78`.
- **Falta:** publicar el changelog.
- Los dos casos del 2026-11-04 (mew y musul) quedan como están (Daniel).

## Recuperar la contraseña y acciones de cuenta (desplegado el 2026-11-04): falta unificar la rama de la API

- **En producción:** recuperar la contraseña, las acciones de cuenta en Administración › Usuarios y la confirmación del correo encendida (`sudo sb confirmar-correo [on|off]`). Probado de punta a punta con cuentas temporales ([`2026-11-03-admin-cuentas-usuarios`](bitacora/2026-11-03-admin-cuentas-usuarios/), [`2026-11-03-recuperar-contrasena`](bitacora/2026-11-03-recuperar-contrasena/)).
- **Falta:**
  - ~~Unificar la rama de la API~~: hecho el 2026-11-04. La API `15a357169528` sale de `feat/frontend-fase-1`, con el manual y sin el anticheat ([`2026-11-04-rama-igual-a-produccion`](bitacora/2026-11-04-rama-igual-a-produccion/GUIA_IMPLEMENTACION.md)). No hace falta volver a usar `deploy/api-produccion`.
  - Publicar `terms/privacidad.html` y el `CHANGELOG_DISCORD.txt` de los dos requerimientos.
  - En la documentación de recuperar la contraseña: "Qué cambia para cada rol" y "Términos y privacidad".

## La rama del frontend igual a producción (2026-11-04): hecho

- **Hecho:** `feat/frontend-fase-1` tiene el manual en la API, el reporter 2.9.3 y los plugins que corren en los servidores, con sus binarios exactos ([`2026-11-04-rama-igual-a-produccion`](bitacora/2026-11-04-rama-igual-a-produccion/)). API `15a357169528` desplegada desde la rama y merge en `main`. A los servidores no se les subió nada.
- **Revisado el 2026-11-04:** reporter 2.9.3 en el #1 (genérico, no licenciado) y en el #2 (licenciado); en el #3 está en `disabled/`. Los puntos viejos que dicen 2.7.3 o 2.9.2 quedan como historia.
- **Falta:**
  1. Abrir `/help` con una sesión iniciada.
  2. `feat/mm-claim-en-sala` sigue con el reporter 2.9.1: el cambio a la 2.9.3 no es del matchmaking y no se llevó ahí.
- **Excepción decidida por Daniel (2026-11-04):** el `live.cfg` del #3 queda con `mp_friendlyfire 1` y `mp_flashlight 1`. El #1 y el #2 tienen `0`, y el repo copia a esos dos.
- **Accelerator en el #3:** se retiró el 2026-10-15 ([guía](bitacora/2026-10-14-crash-servidor-accelerator/GUIA_IMPLEMENTACION.md)), pero el 2026-11-04 sus archivos están otra vez en `extensions/` y `gamedata/` (visto por SFTP), con una copia en `accelerator_retirado/`. Falta confirmar con `sm exts list` que cargue. Ese día la API del panel del #3 daba `DaemonConnectionException` y el SFTP funcionaba.

## Corte a la base de producción (2026-11-03): base hecha, falta el VPS

- **Hecho el 2026-11-03 (Kyan, con Claude):** producción tiene los replanteos `01` a `69`, con respaldo previo (`C:\Users\Agus\Documents\respaldos_cmleague\prod_antes_corte_20261103.dump`) y el ELO idéntico antes y después. Antes del `04` hubo que sacar el CR de 71 funciones que se habían cargado desde Windows. Detalle en [`2026-11-03-corte-produccion/GUIA_IMPLEMENTACION.md`](bitacora/2026-11-03-corte-produccion/GUIA_IMPLEMENTACION.md) (el `PLAN.md` está en `feat/frontend-fase-1`).
- **La web vieja ya no funciona** con esta base. Daniel ya pasó el VPS a producción: desde las 17:3x UTC la API llama a la base de producción.
- **Después del corte, el 2026-11-03:**
  - Limpieza en producción: 34 fichas sin SteamID, sin partidas y sin cuenta, y 10 equipos sin jugadores ([`2026-11-03-limpieza-fichas-equipos`](bitacora/2026-11-03-limpieza-fichas-equipos/)).
  - Replanteo `70`, aplicado en staging y en producción: disolver y moderar equipos fallaba con "Algo salió mal" porque el `56` y el `58` le habían sacado la categoría a `team_staff_action` ([`2026-11-03-aviso-staff-equipos`](bitacora/2026-11-03-aviso-staff-equipos/)). Falta probarlo desde la web.
- **Falta:**
  - Comprobar con Daniel que los tres `.env` del VPS (`api`, `season` y `demos`) y `MM_LISTEN_URL` apunten a producción.
  - Configuración copiada de staging.
  - Temporada BETA.
  - Auth de producción.
  - Servidores: **#1 MVZG** a producción; **#2 flow** y **#3 `aurav34`** con el reporter nuevo.
  - Verificar la ingesta de flow, el Worker de demos y el render de clips.
- **Staging está más abierto que producción:** `anon` y `authenticated` pueden ejecutar 12 funciones internas (19 permisos) (`csstv_ingest`, `csstv_auth`, `create_server_token`, `rotate_server_token`…). En producción solo las ejecuta `service_role`. Hay que cerrarlas en staging.

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
- **Excepción:** contraseña del servidor con `!pw`, `!npw` y `!rpw` para admins y moderadores (`csstv_password` 1.0.0), pedido por Daniel el 2026-10-25 como plugin aparte. Aprobado, hecho, probado con bots y **subido a los dos servidores el 2026-10-25** (punto 1.19).
- **Excepción:** silenciador automático en la M4A1 y la USP con menú `!as` (`csstv_silencer` 1.0.0), pedido por Kyan el 2026-11-02 como plugin aparte. Probado en local y **subido el 2026-11-02 a los tres servidores** (#1 MVZG, #2 flow y #3 `aurav34`; md5 `81c2ef6d…`; verificado por SFTP en el #1 y el #3 el 2026-11-02, flow no se revisó). RBK ya no se usa. Traído a `feat/frontend-fase-1` el 2026-11-02 ([`2026-11-02-plugin-silenciador`](bitacora/2026-11-02-plugin-silenciador/)).
- **Excepción:** aviso de arranque, pausa automática por desconexión y charla del medio tiempo (reporter **2.7.3**, y 2.8.1 en `kyan/pruebas`, sobre la línea con matchmaking), pedido por Kyan el 2026-11-02. Probado con bots y **subido el 2026-11-02 al #1 (MVZG) y a flow (#2), licenciados, y a `disabled/` en el #3 (`aurav34`, genérico md5 `6f3c543c…`)**. La 2.7.3 se trajo a `feat/frontend-fase-1` el 2026-11-02 (sin el matchmaking del plugin, decisión de Daniel). **Falta la prueba con jugadores** ([`2026-11-02-aviso-y-pausa-automatica`](bitacora/2026-11-02-aviso-y-pausa-automatica/)).
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
- **Pedidos del frontend al backend sin resolver** (Esteban, 2026-10-30), en la "Segunda tanda" de [`contrato-backend-equipo-torneos.md`](../contrato-backend-equipo-torneos.md). Mientras tanto, el frontend los muestra deshabilitados con "Próximamente":
  - **E9:** cancelar la solicitud de equipo nuevo;
  - **E10:** disolver un equipo;
  - **E11:** nombre y sigla editables por el líder;
  - **E12:** biografía editable por el jugador (`PATCH /me/profile` con `bio`). Hoy solo la cambia un admin.
  - **E13:** `logo_url` en el historial de equipos y los títulos de un jugador. Hoy el frontend pide el detalle de cada equipo para mostrar el logo.
  - **E14 a E18** (tercera tanda, Partidas unificadas): varios estados en `status`, `mine=true`, contadores por tipo, `mvp` en los mixes y búsqueda por nick en `GET /matches`.
  - ~~**E21 y E22**~~ (cuarta tanda, Llave por formato): **resueltos el 2026-11-01** en la API (`series_players` y `next_win`/`next_lose`) y activados en la Llave. Ver [`2026-11-01-api-llave-serie`](bitacora/2026-11-01-api-llave-serie/).

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
| Notificaciones, primera etapa (2026-10-25): replanteo `28` con su inversa y sus pruebas, `web/backend` (`routes/notifications.ts`, `schemas/notifications.ts`, preferencias en `/me/profile`, tipos y pruebas), contrato del frontend (`notificaciones.md`) y la bitácora `2026-10-25-notificaciones/` | Sin commit (2026-10-25), en la rama `feat/backend-api-fase-1` |
| Estadísticas de partida estilo HLTV, backend (2026-10-25): replanteo `29` con su inversa y sus pruebas, `web/backend` (campos nuevos en `PlayerLine`, `LivePlayerLine` y `PlayerStatsDetail`, `clutchesOf`, tipos y pruebas), contrato del frontend (`partidas.md` 8h) y la bitácora `2026-10-25-stats-partida/` | Sin commit (2026-10-25), en la rama `feat/backend-api-fase-1`. Falta el frontend |
| Catálogo de mapas con pool propio por torneo y por PCW, y columnas del Histórico en el ranking de una temporada (2026-10-25): replanteo `30` con su inversa y sus pruebas, `web/backend` (`pcw-play.ts`, `events.ts`, `matches.ts`, `seasons.ts`, `ranking.ts`, `lib/db.ts`, `lib/uploads.ts`, esquemas, tipos y pruebas), `web/frontend/src/api/schema.d.ts`, contrato del frontend y las bitácoras `2026-10-25-maestra-mapas/`, `2026-10-25-pool-mapas-torneos-pcw/` y `2026-10-25-ranking-temporada-columnas/` | Sin commit (2026-10-25), en la rama `feat/frontend-fase-1`. Falta el frontend |
| ELO por ficha al sumar o quitar un SteamID (2026-10-28): replanteo `34` con su inversa y sus pruebas, descripciones en `web/backend` (`claim.ts`, `admin-players.ts`) y la prueba de integración del cambio de principal, contrato `admin.md`, textos de Administración › Jugadores y `schema.d.ts` en `web/frontend`, y la bitácora `2026-10-28-elo-por-ficha/` | Sin commit |

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

> **Desactualizado (2026-11-03):** el corte ahora es con los replanteos `01` a `69` y lo describe [`2026-11-03-corte-produccion`](bitacora/2026-11-03-corte-produccion/PLAN.md). Lo de abajo queda como historia y como lista de chequeos sueltos.
>
> **Temporada BETA creada en producción el 2026-11-03** (Daniel, paso 2.5 del PLAN): número 1, desde el 2026-10-13 00:00 UTC (antes del primer mix, así cuentan los 95), fin el 2026-12-03 06:00 de Argentina, parámetros de `season_config`. Script: [`pruebas/temporada_beta.sql`](bitacora/2026-11-03-corte-produccion/pruebas/temporada_beta.sql).

Nada de esto se despliega antes del corte: la web vieja sigue usando la base de producción.

**Plugins que esperan la web nueva** (salen o se prenden en el corte, en el servidor real y en flow en la misma tanda):

| Plugin | Estado | Qué falta en el corte |
|---|---|---|
| `!match` (en el reporter desde la 2.1.0) | Subido a los dos servidores; responde con error hasta que exista `csstv_match_lookup` (replanteo `07`) | Nada que subir. Verificar `!match ZZZZZ` y hacer las pruebas manuales con jugadores (punto 4) |
| `!claim` (en el reporter desde la 2.3.0) | Subido a los dos servidores, apagado con `csstv_claim "0"` | `csstv_claim "1"` en el cfg de los dos (punto 1.10) |
| `csstv_bans` (plugin nuevo, por hacer) | Base y API hechas en local (replanteo `31`); el plugin no existe todavía | Hacerlo y probarlo con bots antes del corte; importar los `banned_user.cfg` del real y de RBK; subir el genérico al real y el licenciado a RBK. Sincroniza cada 3 minutos, al empezar cada mapa y con `!syncbans` (punto 6, "Baneos gestionados desde la web") |

- **Base:** `supabase/replanteo/01` a `21`, en orden, con respaldo previo. La `16` necesita la migración de mixes en vivo (`20261017120000`), ya aplicada en producción. La `09` aborta si hay alias repetidos sin distinguir mayúsculas, la `10` si hay roles desconocidos y la `12` si hay nombres de servidor repetidos o IPs permitidas inválidas, y la `14` si hay Workers de demos con el mismo nombre (en la copia del 2026-10-14 no hay ninguno de esos casos).
- **La `15` necesita la migración de ajustes de ELO** (`supabase/migrations/20261015210000_elo_ajustes.sql`, punto 1.6) aplicada antes: si no está, aborta.
- **La `23` (`!whois`) necesita las migraciones de producción `20261019180000_whois.sql` y `20261020120000_whois_menu.sql`** (puntos 1.10 y 1.11) aplicadas antes. En el corte, `csstv_claim "1"` en los dos servidores.
- **La `25` (ajustes de ELO desde el admin)** va después de la `24`.
- **La `38` (IPs de una ficha para el admin)** va después de la `37` y necesita la migración de producción `20261029180000_ips_jugadores.sql` (punto 1.30).
- **La `37` (reinicio total de una temporada)** va después de la `36`. La API que lee `reset_all` necesita la `37` aplicada (punto 1.29).
- **Verificar antes y después del corte que `elo_config` tenga su fila (`id = 1`):** `select * from elo_config;` tiene que devolver una fila. Sin ella, `start_elo` llega en `null` y fallan los ajustes de ELO desde el admin (`500 INTERNAL`, `23502` en `player_elo.elo`) y el ELO al terminar cada mix. Producción la tiene desde la migración `20261011230000_elo_config.sql`. Pero una base armada con `supabase/schema/public.sql` (solo esquema) más las migraciones posteriores a `BASE` queda sin ella: le pasó a staging el 2026-10-29. Si falta: `insert into public.elo_config(id) values (1) on conflict (id) do nothing;` (valores por defecto: base 30, bonus 5 y 10, mínimo 100, inicial 1000, participación de 35 a 90 %). Las otras tablas de configuración (`claim_config`, `clip_config`, `pcw_config`, `ranking_config`, `season_config` y `team_config`) sí tenían su fila en staging, pero conviene revisarlas igual. Detalle en [`2026-10-28-despliegue-vps-ovh`](bitacora/2026-10-28-despliegue-vps-ovh/GUIA_IMPLEMENTACION.md).
- **La `27` (mixes, perfil y ranking de la web nueva)** va después de la `26`. **Aborta si hay nicks repetidos** en `players` (sin distinguir mayúsculas): revisarlo antes con la consulta de su guía y renombrar las fichas sin cuenta que choquen. Después del corte, cargar el puerto de SourceTV (`tv_port`) del **servidor real y de RBK** en Admin › Servidores, para "Ver en TV". Pasos en [`2026-10-24-api-mixes-perfil-ranking`](bitacora/2026-10-24-api-mixes-perfil-ranking/GUIA_IMPLEMENTACION.md).
- **La `24` (temporadas)** va después de la `23`. Después del corte, abrir la primera temporada (BETA) con inicio antes del primer mix, con el SQL de [`2026-10-24-frontend-ranking`](bitacora/2026-10-24-frontend-ranking/pruebas/temporada_beta_local.sql) (no desde el admin, que la abre en `now()`); el cierre automático necesita el VPS (punto 6).
- **La `28` (notificaciones)** va después de la `27` (aborta si falta `mix_deletions`). Pasos en [`2026-10-25-notificaciones`](bitacora/2026-10-25-notificaciones/GUIA_IMPLEMENTACION.md).
- **La `29` (estadísticas de partida)** va después de la `28`: solo vistas, no necesita datos previos. Pasos en [`2026-10-25-stats-partida`](bitacora/2026-10-25-stats-partida/GUIA_IMPLEMENTACION.md).
- **La `30` (catálogo de mapas y ranking de temporada)** va después de la `29`. Los mapas activos de hoy quedan en Mixes y en el pool por defecto (el veto no cambia).
  - Después del corte, en Admin › Mapas: marcar los que no van a Mixes, dar de alta los que solo se juegan en algunos torneos (`mixes` y `veto_default` en `false`) y subir las fotos.
  - Pasos en [`2026-10-25-pool-mapas-torneos-pcw`](bitacora/2026-10-25-pool-mapas-torneos-pcw/GUIA_IMPLEMENTACION.md).
- **Plugin 2.2.0 con `!claim`** (bitácora `2026-10-16-claim-steamid`, que lo llama 2.1.0: el número pasó a los mixes en vivo, punto 1.7): **hecho y probado con bots el 2026-10-18**, sin desplegar. Sale en esta misma tanda: genérico al servidor real y licenciado a RBK. Pasos en [`2026-10-18-plugin-claim`](bitacora/2026-10-18-plugin-claim/GUIA_IMPLEMENTACION.md).
- ~~**`sm_status`**~~: revisado el 2026-10-17 con `smx_grep.py` sobre todos los plugins de los dos servidores: ninguno lo registra.
- **Plugin 2.0.0:** ya está subido dentro de la 2.1.0 (punto 1.7), en el servidor real y en RBK. `!claim` (la 2.2.0) también está subido, dentro de la 2.3.0 (punto 1.10): en el corte solo falta prenderlo con `csstv_claim "1"`.
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
  - **cype-thor** (2026-11-06, ficha `shoxmeister`): `STEAM_0:0:697913072`, sacada de un log del servidor (`L20261029.log`). Agregado en **#1**, **#2 (flow)** y **#3** por la API del panel, verificado bajando el archivo de nuevo. Copias `admins_simple.ini.bak_20261106`. No se corrió `sm_reloadadmins`: se aplica en el próximo cambio de mapa. Falta ver en la base si su ficha tiene otros SteamID.
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

### 1.14 RBK igual al servidor real (con Stripper) y prórroga y medio tiempo nuevos: cancelado (RBK dado de baja el 2026-10-29)

- **Qué es:**
  - RBK queda igual a nuestro servidor. Le faltaba Stripper:Source, que les saca la niebla a los mapas, y tenía otros valores de partida y otros plugins.
  - En los dos servidores: `csstv_ot_startmoney "12000"` y `csstv_halftime_delay "5.0"` (bajado a `"3.0"` el 2026-10-24, punto 1.18).
- **Subido el 2026-10-22.**
  - Servidor real: se carga en el próximo cambio de mapa.
  - ~~RBK: falta que Daniel lo reinicie desde el panel~~: cancelado, RBK dejó de usarse el 2026-10-29.
- **Después del reinicio**, verificar por SFTP:
  - logs de errores sin nada nuevo;
  - `license.txt` actualizado;
  - `csstv_perf` con `fps_max 150 → 600`.

  Y en el juego, que no haya niebla.
- **Accelerator** quedó retirado en los dos servidores (`addons/sourcemod/accelerator_retirado/`): en el real ya estaba así sin estar anotado.
- Changelog: `bitacora/2026-10-22-rbk-igual-al-real/CHANGELOG_DISCORD.txt`.
- **Bitácora:** [`2026-10-22-rbk-igual-al-real`](bitacora/2026-10-22-rbk-igual-al-real/)

### 1.15 HUD de observer (`csstv_hud` 1.0.0): subido solo al servidor real, sin probar

- **2026-10-29: el relay pasa al VPS** (relay 2.0.0, plan [`2026-10-29-hud-relay-vps`](bitacora/2026-10-29-hud-relay-vps/GUIA_IMPLEMENTACION.md)): un relay para todos los servidores, administrado desde la web. Desplegado en el VPS contra staging (`hud.cmleague.lat`). **flow** ya tiene `csstv_hud` 1.1.0 (no lo tenía) apuntando al relay, en el puerto `27501`, como prueba autorizada por Daniel. Falta:
  - ~~confirmar la prueba con flow~~: **funcionó el 2026-10-29** (paquetes con la clave correcta, el HUD y el panel con datos, y la sesión en staging). Queda **prendido en flow** por decisión de Daniel (por consola está en `csstv_hud 0` desde el congelamiento del 2026-10-29, que fue por los bots y no por el HUD: ver la guía, "Incidentes"; volver a `csstv_hud 1`). Falta que kyan confirme si existe `maps/de_dust2_ob.nav` y, si no, generarlo. Cómo apagarlo si laguea: `GUIA_IMPLEMENTACION.md`, "Cómo apagar el HUD de un servidor";
  - ~~el frontend~~: hecho el 2026-10-29 ([`2026-10-29-frontend-hud`](bitacora/2026-10-29-frontend-hud/GUIA_IMPLEMENTACION.md)); falta desplegarlo con `desplegar.sh web`;
  - en el corte: la `36` en producción, el relay leyendo producción (`hud.json`) y el `.cfg` del HUD en **el real y flow** en la misma tanda, con el puerto y la clave de cada uno. El real necesita volver a tener `csstv_hud.smx` (avisarle a kyan).
- **2026-10-30: HUD versión 2** (relay 2.1.0, plan [`2026-10-30-hud-version-2`](bitacora/2026-10-30-hud-version-2/GUIA_IMPLEMENTACION.md)): el diseño del torneo de CS2 (marcador con siglas, vivos y clutch, tarjetas con foto y número de tecla, la vida que oscurece la tarjeta y la flash y el humo con franja y borde). Solo cambia lo que dibuja OBS; el plugin no. **Desplegado en el VPS el 2026-10-30** (build `ea72879c8f86-local10301427`, con cambios sin commit). Falta verlo con la SourceTV real en OBS y, después del commit, volver a desplegar para que el build lleve el nombre del commit.
- **2026-10-30: serie de mapas en el HUD** (relay 2.2.0, plan [`2026-10-30-hud-serie-mapas`](bitacora/2026-10-30-hud-serie-mapas/GUIA_IMPLEMENTACION.md)): en `/control`, BO1/BO3/BO5 y por mapa el pick y el ganador; el HUD muestra `CMLEAGUE | BO3 | Jugando en … | Pick de …` y las rayitas de mapas ganados. Probado en local y **desplegado en el VPS el 2026-10-30** (build `7b6540df4295-local10301756`, con cambios sin commit). Falta verlo en OBS y, después del commit, volver a desplegar. No toca el plugin.

- **2026-10-25:** ya no está en el servidor real (lo sacó kyan, según Daniel). Sigue en RBK con `csstv_hud "0"`.

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
- **Grabar con el CS:S v34 normal (2026-11-04, commiteado en `feat/frontend-fase-1`):** `"client": "v34"` en `render/config.json` abre `hl2.exe` directo, sin el launcher de ClientMod (Daniel sospecha que el launcher es lo que hace fallar los clips). Instalado en el portátil en `C:\Program Files (x86)\CSS v34 eXpandedCS`. **Falta:** llevar `render/` al portátil, configurarlo (paso 3b de `render/CONFIGURAR_PORTATIL.md`) y grabar una jugada. No se pudo probar en la PC (no hay un v34 normal). Bitácora [`2026-11-04-render-sin-launcher`](bitacora/2026-11-04-render-sin-launcher/).
- **Cuentas:** los videos de los clips van al R2 de la **cuenta de Cloudflare de Daniel** (variables `CF_*_CLIPS` en el `.env`, conexión probada); las demos se quedan en la cuenta de kyan. YouTube se descartó.
- **Bitácora:** [`2026-10-23-clips-video`](bitacora/2026-10-23-clips-video/) y [`2026-10-23-clips-render-automatico`](bitacora/2026-10-23-clips-render-automatico/)

### 1.18 Medio tiempo de 3 segundos: verificar en un mix real

- **Aplicado el 2026-10-24** en el servidor real (`SFTP_CSS_*`) y en RBK (`SERVER1_*`): `csstv_halftime_delay "3.0"` (antes `"5.0"`, con el que el marcador volvía a 0 en el medio tiempo). Verificado releyendo el cfg de cada uno.
- Entra en el próximo cambio de mapa; no se recargó el plugin.
- **Falta:** ver en el próximo mix de cada servidor que el cambio de lados conserva el marcador, y publicar `bitacora/2026-10-24-medio-tiempo-3s/CHANGELOG_DISCORD.txt`.
- **Bitácora:** [`2026-10-24-medio-tiempo-3s`](bitacora/2026-10-24-medio-tiempo-3s/)

### 1.19 Contraseña del servidor (`csstv_password` 1.0.0): verificar en los dos servidores

- **Subido el 2026-10-25** al servidor real (`SFTP_CSS_*`) y a RBK (`SERVER1_*`): `addons/sourcemod/plugins/csstv_password.smx` (md5 `b5329c68684f643457b2e3dd503620cd`, el mismo en los dos, sin licencia) y `cfg/sourcemod/csstv_password.cfg`. Verificado bajándolos de nuevo. Se carga en el próximo cambio de mapa; no se recargó nada.
- `!pw <contraseña>`, `!npw` y `!rpw` con flag `b` (moderadores y admins). Solo quien la puso ve el valor. Se mantiene entre mapas; con un reinicio vuelve la del `server.cfg`.
- **Ojo en el servidor real:** su `server.cfg` tiene una contraseña de siempre. Después de un `!npw`, el servidor queda **abierto** hasta el próximo reinicio o hasta un `!pw`.
- **Falta verificar** en cada servidor después del cambio de mapa: `sm plugins list` (`CSSTV Password (1.0.0)`), un `!rpw` y conectarse con otro cliente con y sin la contraseña, y un `!npw`. Publicar `bitacora/2026-10-25-plugin-password/CHANGELOG_DISCORD.txt`.
- **Si algo falla:** `csstv_pw_enabled 0` (en la consola y en el cfg) o mover el `.smx` a `plugins/disabled/`.
- **Encontrado al desplegar:** en el servidor real **no está `csstv_hud.smx`** (ni en `plugins/` ni en `disabled/`), aunque el punto 1.15 dice que se subió la 1.1.0. Su cfg sí está, modificado el 2026-10-24 desde el panel. En RBK sí está. Según Daniel (2026-10-25), lo sacó kyan.
- **`!calladmin` con la contraseña actual (`csstv_calladmin` 1.1.0): subido el 2026-10-25 al servidor real y a RBK** (md5 `68272891142181ede191604b122e9827`; la 1.0.1 quedó en `plugins/disabled/` y el cfg viejo en `csstv_calladmin.cfg.bak_20261025`). El connect del reporte lleva el `sv_password` de ese momento, y `csstv_calladmin_address` quedó solo con IP:puerto. **Falta verificar** después del cambio de mapa: `sm plugins list` (`CSSTV CallAdmin (1.1.0)`) y un `!calladmin` de prueba después de un `!rpw`. Bitácora: [`2026-10-25-calladmin-password-actual`](bitacora/2026-10-25-calladmin-password-actual/).
- **Bitácora:** [`2026-10-25-plugin-password`](bitacora/2026-10-25-plugin-password/)

### 1.20 Fichas que perdieron el vínculo con su cuenta: se arreglan en el corte

- **10 fichas** con el reclamo aprobado y sin cuenta en producción: juanma, Lukas, vodka, notions, instt, rbk, odreaz, daniloev, always y aksev. Causa probable: el panel de admin viejo vaciaba `players.user_id` al editar una ficha con el buscador de cuentas filtrado.
- **Hecho el 2026-10-25 (local):** la migración `15` las vincula en el corte y la base local ya está corregida.
- **La web vieja no se toca** (Daniel, 2026-10-25): hasta el corte su panel puede desvincular más fichas al editarlas; la `15` también las levanta si el reclamo sigue aprobado. Opcional, con OK de Daniel: vincular las 10 en producción antes del corte.
- **Bitácora:** [`2026-10-25-vinculos-perdidos`](bitacora/2026-10-25-vinculos-perdidos/)

### 1.21 Tasas de red coherentes: verificar en los dos servidores

- **Aplicado el 2026-10-27** en el `cfg/server.cfg` del servidor real (`SFTP_CSS_*`) y de RBK (`SERVER1_*`): `sv_minupdaterate 100`, `sv_maxupdaterate 101`, `sv_mincmdrate 100` y `sv_maxcmdrate 101` (antes 101 / 100 / 101 / 100). Verificado releyendo el archivo de cada uno.
- Entra en el próximo cambio de mapa; no se recargó nada.
- **Falta:** después del cambio de mapa, ver en la consola de cada servidor que las cuatro cvars dan 100, 101, 100 y 101.
- **Bitácora:** [`2026-10-27-tasas-coherentes`](bitacora/2026-10-27-tasas-coherentes/)

### 1.22 Servidor de flow (CMLeague #3, hoy #2): pasarle el paquete

- **Armado el 2026-10-27** en `flow/` (raíz del repo, fuera de git): SourceMod 1.10, Metamod, Stripper, los plugins del #1 más los que solo tiene RBK, los cfgs de partida, `LEEME.txt` y el reporter 2.5.0 **licenciado** (UUID `7b01c85b-bc3e-4aa3-9ab5-3c2044157034`, md5 `0697263ae530ab2cf4ae2a3e7ce92281`). Sin Accelerator, sin los plugins de Extreme Host y sin mapas.
- **Instalado por flow** (verificado por SFTP el 2026-10-28: `csstv_reporter.smx` de 116417 bytes, el licenciado). Falta verificar que `game_servers.last_seen_at` de flow se actualice.
- **Acceso a flow por SFTP** (`SERVER2_*` del `.env`, verificado el 2026-10-28), sin panel ni consola: cada despliegue del plugin a los servidores incluye subirle a flow su build licenciado por SFTP. Lo que necesite la consola o la línea de arranque se le pide a flow.
- **Encontrado al armarlo:** el #1 ya no tiene `Anti_Wallhack_Lite`, `soft_detector` (con su extensión), `SendFileExploitFixV3.3`, `clientmod_emulator`, `convar_detector`, `spectatorswitch` ni `csstv_hud` (no están en `disabled/` y no hay registro). RBK sí. `CLAUDE.md` pide `Anti_Wallhack_Lite` en todos: falta averiguar quién los sacó y volver a dejar el #1 igual.
- **Bitácora:** [`2026-10-27-servidor-flow`](bitacora/2026-10-27-servidor-flow/)

### 1.23 VIP: migración aplicada en producción; falta cargar los VIP

- **Qué es:** saber en la base quién es VIP y hasta cuándo (sin fecha de fin = lifetime), antes del corte. Migración `supabase/migrations/20261028120000_vip.sql` (en `feat/backend-api-fase-1`, sin commit): tabla `vip_memberships`, `is_vip()`, `admin_vip_grant` y `admin_vip_revoke` (solo admins; Kyan es admin) y las vistas `vip_status` y `vip_public`. No toca nada de la web vieja.
- **Probada en local (2026-10-28):** 45 pruebas sobre el esquema de producción ([`pruebas/vip_produccion.sql`](bitacora/2026-10-28-vip-fase-0/pruebas/vip_produccion.sql)), re-ejecutable; con el replanteo encima, 49 pruebas de la `32`.
- **Aplicada en producción el 2026-10-28** (la corrió Daniel en el SQL Editor).
- **API hecha en local (2026-10-28)**, sin commit: `GET /api/v1/admin/vips`, `GET` y `POST /api/v1/admin/users/{id}/vip`, `POST /api/v1/admin/users/{id}/vip/revoke` y `vip` en `/me/profile`, la ficha, `GET /players`, el ranking, el comparador y `GET /admin/users`. Sale con la web nueva.
- **Falta:**
  1. ~~Aplicarla en producción~~ (hecho el 2026-10-28).
  2. Comprobar: `select count(*) from vip_memberships;` da 0 y `select is_vip('<uuid de una cuenta>');` da `false`.
  3. Cargar los VIP de Kyan, todos lifetime, con [`pruebas/carga_inicial_vip.sql`](bitacora/2026-10-28-vip-fase-0/pruebas/carga_inicial_vip.sql) en el SQL Editor (ahí no hay sesión de admin, así que `admin_vip_grant` rechaza; el script hace un `insert` con `source = 'import'`). Busca por el nick de la ficha, como los links de la web vieja:
     - **Actualizado el 2026-10-29:** los cuatro van en la misma lista con su fecha de compra (`starts_at` a la medianoche de Colombia de ese día) y lo que pagaron en la nota. Una ficha sin cuenta se salta con un aviso `PENDIENTE` en lugar de abortar, y a quien ya se cargó solo le corrige la fecha: se corre el mismo archivo entero cada vez. Probado en local con rollback (dos corridas).
     - **Ahora:** `romanxz` (romanzera) y `shoxmeister` (cypee-thor).
     - **Cuando creen su cuenta y vinculen su SteamID:** `instt` (uriel) y `sandeerz`. El VIP es de la cuenta: sin cuenta no se puede dar.
  4. Volcar el esquema con `supabase/schema/volcar.sh 20261028120000`, para que la base local parta de producción con la tabla.
- **En el corte:** el replanteo `32` suma los avisos (`vip_granted` y `vip_revoked`). Después del corte no volver a correr la migración: les saca los avisos a dar y quitar.
- **Bitácora:** [`2026-10-28-vip-fase-0`](bitacora/2026-10-28-vip-fase-0/)

### 1.24 Clips VIP y reprocesar: aplicar la migración en producción

- **Qué es:** los VIP no cuentan en el top de 5 clips del mix y suman sus 3 mejores jugadas aparte (VIP que tenían cuando se jugó el mix). Un admin puede mandar a grabar de nuevo un clip con errores: sale en Discord recién con su "Bien".
- **Hecho en local (2026-10-28)**, sin commit: migración `supabase/migrations/20261028180000_clips_vip_reprocesar.sql`, la `26` y la `28` del replanteo, la API y `render/procesar.py`.
- **Falta:**
  1. Comprobar `select per_match, per_player from clip_config;` en producción (`per_match` tiene que ser 5).
  2. Aplicar la migración en el SQL Editor.
  3. Bajar `render/procesar.py` al portátil (nombre " (reproceso N)" en Drive).
  4. Publicar el changelog: `bitacora/2026-10-28-clips-vip-y-reprocesar/CHANGELOG_DISCORD.txt`.
- **Reprocesar antes de la web nueva:** desde el SQL Editor, con las consultas de la guía. La web vieja no lo tiene.
- **Bitácora:** [`2026-10-28-clips-vip-y-reprocesar`](bitacora/2026-10-28-clips-vip-y-reprocesar/)

### 1.25 Demos de RBK a R2: cancelado (RBK dado de baja el 2026-10-29)

- **Desplegado el 2026-10-26:**
  - Worker `v34frag-demos` versión `1475d128`, con el secreto `PTERO_KEY_edbee7d6` (la key del panel de RBK, `SERVER1_PANEL_API_KEY` en el `.env`).
  - En producción, `game_servers.panel_server_id = 'edbee7d6'` para RBK.
  - En RBK (`SERVER1_*`), `csstv_demo "1"`, con la copia `csstv_reporter.cfg.bak_20261026`. Se aplica en el próximo cambio de mapa.
- RBK ya tenía `+tv_enable 1 +tv_port 27063` en el arranque del panel. Nuestro servidor no cambia.
- **Cancelado el 2026-10-29** (RBK dejó de usarse). **Limpiado el 2026-11-03:** se borró el secreto `PTERO_KEY_edbee7d6` del Worker, su key de `cloudflare/demo-worker/scripts/dev-vars.py` y las variables `SERVER1_*` del `.env`. Lo que faltaba era, con el primer mix de RBK: ver `Grabando demo` en su log, `demo_status = 'uploaded'` y la descarga desde la partida. Con el siguiente del real, que su demo suba como siempre. Publicar `bitacora/2026-10-26-demos-rbk/CHANGELOG_DISCORD.txt`.
- **Si algo falla:** `csstv_demo "0"` en RBK. Pasos completos en la [guía](bitacora/2026-10-26-demos-rbk/GUIA_IMPLEMENTACION.md).

### 1.26 Equipo y Torneos en la API (replanteo `33`): falta el frontend

- **Hecho el 2026-10-28 (local) y commiteado en `feat/backend-api-fase-1` (sin push):** replanteo `33`, API y pruebas (45 SQL, 353 unitarias y 150 de integración). Bitácora: [`2026-10-28-equipo-torneos-api`](bitacora/2026-10-28-equipo-torneos-api/).
- **Contrato para el frontend:** [`contrato-frontend-equipo-torneos.md`](../contrato-frontend-equipo-torneos.md). Rompe la inscripción a torneos (`{ active, subs }`) y saca `players_min`/`players_max`.
- **Falta:**
  - ~~Cargar los replanteos `31`, `32` y `33` en staging y redesplegar la API del VPS~~: **hecho el 2026-10-29** (staging tiene del `01` al `36` y las migraciones hasta `20261028200000`; API `91498a41bca2`). Ver [`2026-10-29-hud-relay-vps`](bitacora/2026-10-29-hud-relay-vps/GUIA_IMPLEMENTACION.md).
  - Que el frontend adopte la inscripción nueva y los campos nuevos.
  - Publicar `bitacora/2026-10-28-equipo-torneos-api/CHANGELOG_DISCORD.txt` cuando llegue a producción (poner la versión).
- No toca el plugin: nada que subir al servidor real, a RBK ni a flow.
- **Problemas del entorno vistos al probar:**
  - En `v34frag-backend` los `.sql` del checkout tenían CRLF y el replanteo `04` fallaba al cargar; se pasaron a LF en la copia de trabajo (sin cambios en Git).
  - `pruebas/correr.sh` se corta en la prueba `por STEAM_0 del adicional…` de `pruebas/23_whois.sql`, que falla por su cuenta. Sin investigar.

### 1.27 Demos y clips de los servidores externos (flow por SFTP): falta desplegar

- **Qué es:** el Worker de demos prueba primero la API del panel de cada servidor; si no tiene key o el panel no deja entrar, la demo pasa a una tarea de SFTP en el VPS que la sube a R2. Así flow, que no tiene API key, tiene demos y clips con video.
- **Hecho el 2026-10-28 y commiteado** (`6b770cc` en `feat/backend-api-fase-1`, mezclado en `feat/frontend-fase-1` con `411bca8`): migración `20261028200000_demos_servidores_externos.sql`, el Worker y la tarea (`src/jobs/demos-sftp.ts`). Sin commit: `deploy/vps/` (unidades `cmleague-demos.*`, `demos.env.example`, `demos-sftp.json.example`), `build.mjs`, `build-check.mjs`, `desplegar.sh` y `preparar.sh`.
- **Falta, en este orden:**
  1. Aplicar la migración en el SQL Editor y cargar `panel_server_id = 'f337a7d9'` y `panel_url` de flow (RBK ya tiene `edbee7d6`).
  2. Desplegar el Worker desde un árbol que tenga `6b770cc` (no hace falta secreto nuevo).
  3. VPS: `demos.env` y `demos-sftp.json` en `/etc/cmleague/`, desplegar la API (sube `demos-sftp.mjs`) y `systemctl enable --now cmleague-demos.timer`.
  4. flow: **`csstv_demo "1"` ya está subido por SFTP (2026-10-28, respaldo en `csstv_reporter.cfg.bak`)** y se toma en el próximo cambio de mapa. Falta SourceTV: pedirle a flow `+tv_enable 1 +tv_port <puerto>` en su arranque y cargar ese `tv_port` en Admin › Servidores. Mientras los pasos 1 a 3 no estén hechos, las demos se acumulan en `csstv_demos/` de flow (`csstv_demo_keep "50"`).
  5. Ver el primer mix de flow llegar a R2 y sus clips grabarse.
- **Estado al 2026-10-29 02:10 UTC:** la migración, el Worker y el timer del VPS ya están andando. SourceTV de flow graba (`flow-20261028T222354-0bbb.dem`, 50,7 MB, partida `cfd14dcb-…`, `pending` con `demo_via = sftp`). **Bloqueo:** el host de flow (`panel-mvzg.com`, `190.104.34.3`) no contesta en ningún puerto a la IP del VPS (`148.113.148.184`), aunque desde la PC de Daniel conecta. Error de la tarea: `SFTP: Timed out while waiting for handshake`. Hay que pedirle a flow que habilite esa IP en su firewall (al menos el puerto 2022). Los servidores de ExtremeHost (#1 y RBK) sí responden desde el VPS.
- **Mientras tanto, a mano:** la demo de esa partida la bajó Daniel desde el panel de flow y la subió a R2 (`demos/2026/10/flow-20261028T222354-0bbb.dem`, 50.707.873 bytes, igual que en flow). Después se marcó con `demo_mark('uploaded')` (`uploaded` a las 03:01 UTC; sus 15 clips quedaron en la cola del bot). Antes de eso, el VPS ya le había gastado los intentos (`demo_attempts` 7), pero `demo_mark` acepta `uploaded` también sobre `missing`. La demo sigue en `csstv_demos/` de flow porque no se borró a mano. Hacia las 02:35 UTC flow tampoco respondía desde la PC de Daniel (puertos 2022, 443 y 8080): falta preguntarle si bloqueó esa IP.
- **Resuelto el 2026-10-29:** flow habilitó la IP del VPS. Desde entonces el VPS subió solo las demos de tuscan (41,6 MB), mirage (9,0 MB) y mirage (55,8 MB). El SFTP de flow baja a unos 52-60 KB/s: una demo de 50 MB tarda unos 15 minutos. Con `TimeoutStartSec=900`, systemd cortaba la corrida a mitad de una demo, así que se subió a `3600` en `deploy/vps/cmleague-demos.service` y en el VPS (05:00 UTC, sin commit). Falta preguntarle a flow si su SFTP tiene un límite de velocidad.
- **Bitácora:** [`2026-10-28-demos-servidores-externos`](bitacora/2026-10-28-demos-servidores-externos/)

### 1.28 Días como VIP: aplicar la migración en producción

- **Qué es:** `active_since` y `days_active` en la vista `vip_status`: cuántos días lleva cada cuenta como VIP sin cortes (lifetime incluido), en fechas de Colombia. Migración `supabase/migrations/20261029120000_vip_dias.sql`, sin commit. Solo redefine la vista: no toca `admin_vip_grant` ni `admin_vip_revoke`, así que se puede correr también después del corte.
- **Probada en local (2026-10-29):** 7 pruebas ([`pruebas/vip_dias.sql`](bitacora/2026-10-29-vip-dias/pruebas/vip_dias.sql)) y las 45 de la fase 0 siguen en verde.
- **Falta:**
  1. Aplicarla en producción (SQL Editor). No va a los servidores (real, RBK y flow): no toca el plugin.
  2. ~~Fechas reales de la carga inicial~~: hecho el 2026-10-29. Daniel pasó las fechas de compra (uriel, cypee-thor y roman el 2026-10-26; sandeerz el 2026-10-27) y [`carga_inicial_vip.sql`](bitacora/2026-10-28-vip-fase-0/pruebas/carga_inicial_vip.sql) ahora carga cada uno desde ese día (o le corrige la fecha si ya estaba cargado). Ver el punto 1.23.
  3. Exponer `days_active` en la API (`/admin/vips`, `/admin/users/{id}/vip`, `/me/profile`) y en el frontend, cuando Daniel lo pida.
- **Bitácora:** [`2026-10-29-vip-dias`](bitacora/2026-10-29-vip-dias/)

### 1.29 Reinicio total de una temporada (replanteo `37`): desplegado en staging, falta el corte

- **Qué es:** opción "Reiniciar también a los que están debajo del piso" en Administración › Temporadas (activa y próxima). Con ella, al cerrar la temporada los de debajo del piso también se acercan al piso con el mismo porcentaje; con 0 %, todos quedan en el piso (reinicio total). Columna `reset_all` en `season_config` y `seasons`.
- **Hecho el 2026-10-29 y commiteado en `feat/frontend-fase-1` (`e529dce`):** replanteo `37` con su inversa y 23 pruebas SQL, API (`reset_all` en temporadas, configuración, `PATCH` y vista previa), contrato y frontend (un checkbox en la tarjeta del reinicio). En el backend, 392 pruebas unitarias y las 9 de integración de temporadas; en el frontend, 342.
- **Falta:**
  1. ~~Cargar la `37` en staging y redesplegar la API y el frontend del VPS~~: **hecho el 2026-10-29** (staging tiene del `01` al `37`; API y web `e529dceeb4ab`). Sin la `37`, esta API falla en temporadas (lee `reset_all`).
  2. En el corte, la `37` va después de la `36` (punto 1.5).
  3. Probarlo en el navegador contra staging: marcar la opción, guardar y ver la vista previa del cierre.
- No toca el plugin: nada que subir al servidor real, a RBK ni a flow.
- **Bitácora:** [`2026-10-29-temporada-reinicio-total`](bitacora/2026-10-29-temporada-reinicio-total/)

### 1.30 IPs de los jugadores (reporter 2.6.0): desplegado, falta verificar

- **Qué es:** el reporter guarda la IP de cada entrada al servidor (con el SteamID validado) y cuenta los intentos de conexión por IP (también los que no validan el SteamID), en lotes cada 60 segundos. Solo los admins las ven, en Administración › Jugadores, con las otras fichas que usaron la misma IP.
- **Hecho y commiteado el 2026-10-29 (`85f7fc2`):** migración de producción `supabase/migrations/20261029180000_ips_jugadores.sql` (20 pruebas), replanteo `38` (6 pruebas, con su inversa), reporter 2.6.0 (probado en el servidor local contra la Supabase local), API (3 de integración) y frontend.
- **Desplegado el 2026-10-29:** la migración en producción y en staging, la `38` en staging, la API y la web `85f7fc23653b` en el VPS, y el reporter 2.6.0 con `csstv_ips "1"` en **el real, RBK y flow** (genérico al real y licenciado a RBK y flow). El plugin se carga en el próximo cambio de mapa de cada servidor.
- **Falta:**
  1. En el corte, la `38` va después de la `37` (punto 1.5).
  2. Verificar con el primer jugador que entre: sin `IPs: no se pudieron registrar` en el log y filas en `player_ips`.
  3. Publicar `bitacora/2026-10-29-ips-jugadores/CHANGELOG_DISCORD.txt`.
  4. **Reporter 2.6.1** (pico y copia a disco de los intentos): desplegado el 2026-10-29. La migración `20261029200000_ips_intentos_hora.sql` está en producción y en staging, y el plugin en **el real, RBK y flow**. Falta verificar en cada uno, después de su cambio de mapa, que el log diga 2.6.1 y que no aparezca `IPs: no se pudieron registrar`.
- **Bitácora:** [`2026-10-29-ips-jugadores`](bitacora/2026-10-29-ips-jugadores/)

### 1.31 Datos para las medallas (reporter 2.7.0): desplegado, falta verificar

- **Qué es:** el reporter cuenta kills y HS por arma, clutchs (1v1 a 1v5 e intentos), rondas sobrevividas, ganadas de CT y de T, pistolas, ecos, bombas explotadas y el equipamiento de cada ronda. La base de producción lo guarda en `match_round_log` y `match_player_extra` para que la web nueva tenga datos desde antes del corte. La web vieja no cambia.
- **Hecho el 2026-10-29:** migración `supabase/migrations/20261029210000_medallas_datos.sql`, **aplicada en producción, staging y local** (17 pruebas en las tres). Reporter 2.7.0 probado con bots en el servidor local.
- **Desplegado el 2026-10-29** en **el real y flow** (genérico md5 `1f74ced7`, flow licenciado `f02def68`; la 2.6.1 en `plugins/disabled/`). RBK no, porque dejó de usarse. Se carga en el próximo cambio de mapa.
- **Falta:**
  1. Verificar el primer mix de cada servidor (consulta en la guía) y publicar el changelog.
  2. Lo que sigue de las medallas está en `INVESTIGACION.md`: el motor que las otorga, el modelo (clave y nivel) y las preguntas abiertas (MVP, clutch desde 1v1, umbrales de eco, cuándo se calculan).
- **Bitácora:** [`2026-10-29-medallas-datos`](bitacora/2026-10-29-medallas-datos/)

### 1.32 Clips con la cámara en otro jugador y el menú al final: falta el portátil y el reproceso

- **Qué pasaba:** los dos 3k de "New™ always" en de_cbble (mix de flow del 2026-10-29) salieron desde los ojos de Vodka, y el de la última ronda terminaba con el menú del juego.
- **Hecho el 2026-10-29 (sin commit):** `render/leer_demo.py` (el largo de `svc_UpdateStringTable` es de 16 bits: con 20 no veía a los que se reconectan), `render/render_clip.py` y `render/procesar.py` (los tramos no pasan del final de la demo). Probado con la demo; sin probar en el juego.
- **Falta:**
  1. Llevar `render/` al portátil (con la tarea desactivada).
  2. Después, y no antes, reprocesar los dos clips con `bitacora/2026-10-29-clips-pov-y-final-demo/pruebas/reprocesar_cbble.sql`, revisarlos en Drive y aprobarlos.
     - El primer reproceso (2026-10-30) dejó bien la cámara, pero el 3k de la ronda 29 no mostraba la última kill.
     - Con el render que llega al último tick y congela el cuadro: aprobar el de la ronda 18 y reprocesar otra vez el de la 29 (final del mismo `.sql`).
  3. ~~Plugin: que la demo siga grabando después del final~~: hecho en la 2.7.0 (punto 1.33). Los dos clips se aprobaron así: el de la ronda 29 queda sin la última kill.
- **Bitácora:** [`2026-10-29-clips-pov-y-final-demo`](bitacora/2026-10-29-clips-pov-y-final-demo/)

### 1.33 La demo sigue grabando 5 s después del final del mix (reporter 2.7.1): desplegado, falta verificar

- **Qué es:** `FinishMatch` corta la demo 5 s después (`Demo_StopLater`), para que la última kill del mix se vea en los clips.
- **Desplegado el 2026-10-30 como 2.7.1** en **el real y flow** (genérico md5 `9418edaa`, flow licenciado `087ffe0b`; la 2.7.0 en `plugins/disabled/`). La 2.7.0 se había desplegado con builds anteriores a este cambio: Daniel lo notó en su clutch de la última ronda del mix de tuscan en flow (2026-10-30). Se carga en el próximo cambio de mapa.
- **Falta:**
  1. Verificar el primer mix de cada servidor: el log dice 2.7.1 y la demo llega unos 5 s después del final.
  2. Publicar el changelog.
  3. El clip de ese mix (`569f24cc`, daniloev, ronda 29) necesita el render nuevo del punto 1.32 y un reproceso: su demo ya quedó cortada.
- **Bitácora:** [`2026-10-29-demo-segundos-finales`](bitacora/2026-10-29-demo-segundos-finales/)

### 1.34 Clips de nuke que fallaron por una kill justo después del salto: falta el portátil y el reproceso

- **Qué pasaba:** los 6 clips de nuke_old_blue_ep (`flow-20261029T210433-5ce4`, 2026-10-30) quedaron `failed` con "la demo pasó de largo el tick 70272 (3 veces)". El control miraba la primera kill de cualquiera después del salto, y había una 1,5 s después.
- **Hecho el 2026-10-30 (sin commit):** `render/render_clip.py` mira la primera kill desde 2,5 s después del salto (`SEEK_SLACK_SECONDS`). Probado con la demo; sin probar en el juego.
- **Falta:**
  1. Llevar `render/` al portátil.
  2. Con la confirmación de Daniel, devolver los clips a la cola con `bitacora/2026-10-30-render-kill-cerca-del-salto/pruebas/reprocesar_nuke.sql` y revisar que queden `done`.
- **Bitácora:** [`2026-10-30-render-kill-cerca-del-salto`](bitacora/2026-10-30-render-kill-cerca-del-salto/)

### 1.35 Clips de dust2 que fallaron por una línea de consola larga: falta el portátil y el reproceso

- **Qué pasaba:** los 5 clips del mix de dust2_ob de GO TO KNOW contra New™ (`flow-20261029T234042-496d`) fallaron dos veces con "no apareció 'CML_PASO_14'": la consola corta la línea en unos 255 caracteres y ese paso medía 259 (la cámara llega a «New™ CH1LI» desde un jugador de nombre largo).
- **Hecho el 2026-10-30 (sin commit):** `render/render_clip.py` parte en varias líneas los pasos de más de 250 caracteres (`console_lines`). Probado con la demo; sin probar en el juego.
- **Falta:**
  1. Llevar `render/` al portátil.
  2. Con la confirmación de Daniel, devolver los clips a la cola con `bitacora/2026-10-30-render-linea-consola-larga/pruebas/reprocesar_dust2.sql` y revisar que queden `done`.
- **Bitácora:** [`2026-10-30-render-linea-consola-larga`](bitacora/2026-10-30-render-linea-consola-larga/)

### 1.36 Colores del chat: reporte de daño y plata del equipo (reporter 2.7.2): desplegado, falta verificar

- **Qué es:** la paleta del artifact "Colores del chat de CMLeague" (aprobada por Daniel el 2026-10-30). El reporte de daño sale en español, una línea por jugador con dado, recibido y vivo o muerto. La plata del equipo sale sin total, una línea por compañero, con el color según lo que le alcanza. Etiqueta nueva `{#gris}`.
- **Hecho el 2026-10-30 (sin commit):** `qol.inc`, `stats.inc` y la versión 2.7.2. Compila sin avisos; `plugins/csstv_reporter.smx` ya es la 2.7.2.
- **Falta:**
  1. ~~Probar con bots~~: **hecho el 2026-10-30** (el texto sale bien; ver la guía).
  2. ~~Desplegar~~: **hecho el 2026-10-30** en **el real** (`.smx` genérico, md5 `5d2136e7`) y **flow** (build licenciado, md5 `ba676761`). La 2.7.1 quedó en `plugins/disabled/` de los dos. Falta ver en el primer mix de cada uno que el log diga 2.7.2 y que los colores se vean bien, con ClientMod y sin él, y publicar el `CHANGELOG_DISCORD.txt`.
  3. Pasarle el artifact a kyan para que ajuste los colores del retake.
- **Bitácora:** [`2026-10-30-colores-chat`](bitacora/2026-10-30-colores-chat/)

### 1.37 Pendientes de la API para el frontend (replanteo `39`): commit del 2026-11-01, sin desplegar

- **Qué es:** lo que pidió el frontend en `pendientes-backend-cmleague.md` (E9 a E18 y E20): filtros, contadores y MVP en `GET /matches`, cancelar la solicitud de equipo con su fecha y el motivo del rechazo, disolver un equipo, nombre y sigla editables por el capitán, biografía del jugador, logos en el historial y los títulos, y cierre y total de jugadores en las temporadas.
- **Hecho el 2026-10-30 en local y commiteado el 2026-11-01** (en `feat/backend-api-fase-1`): replanteo `39` con su inversa y sus pruebas SQL, API, tipos, pruebas unitarias y de integración, y el contrato del frontend.
- **Falta:**
  1. Llevarlo a `feat/frontend-fase-1` (merge del backend, 2026-11-01).
  2. Cargar la `39` en staging y redesplegar la API del VPS. Sin la `39`, esta API falla en `/matches`, equipos, temporadas y Mi perfil (lee columnas nuevas).
  3. En el corte, la `39` va después de la `38` (punto 1.5).
  4. El frontend activa lo suyo y regenera `src/api/schema.d.ts`.
  5. E19 (búsqueda global ⌘K) queda para más adelante.
- No toca el plugin: nada que subir al servidor real ni a flow.
- **Bitácora:** [`2026-10-30-api-pendientes-frontend`](bitacora/2026-10-30-api-pendientes-frontend/)

### 1.38 Rating de la serie y enlaces de la llave (E21 y E22): commit del 2026-11-01, sin desplegar

- **Qué es:** lo que pidió la Llave por formato del frontend: `next_win`, `next_win_slot`, `next_lose` y `next_lose_slot` en `GET /events/{id}/matches`, y `series_players` (stats de la serie con el rating ponderado por rondas) en `GET /matches/{id}` de torneo y PCW.
- **Hecho el 2026-11-01** en `feat/backend-api-fase-1` (sin migración) y llevado a `feat/frontend-fase-1` con merge. El frontend ya los usa: rating de la serie en el detalle resumido, y origen y destino de cada lado en la Llave.
- **Falta:** redesplegar la API del VPS junto con lo del punto 1.37. No toca la base ni el plugin.
- **Bitácora:** [`2026-11-01-api-llave-serie`](bitacora/2026-11-01-api-llave-serie/)

### 1.39 Crear un equipo al instante (replanteo `40`): commit del 2026-11-01, sin desplegar

- **Qué es:** cualquier usuario con SteamID crea su equipo sin aprobación (`POST /api/v1/teams`). Tope de equipos por capitán configurable (`max_led`, 1 por defecto), aptitud por modo en la ficha (`eligible_modes`) y el ranking de equipos solo con los que tienen 5 jugadores o suplentes. Se borran la aprobación, el rechazo y la cancelación de solicitudes.
- **Hecho el 2026-11-01** en `feat/backend-api-fase-1` y llevado a `feat/frontend-fase-1` con merge.
- **Falta:**
  1. Cargar la `40` en staging después de la `39` y redesplegar la API. Al cargarla, las solicitudes pendientes se resuelven solas (se crea el equipo o se rechazan con el motivo).
  2. En el corte, la `40` va después de la `39`.
- No toca el plugin: nada que subir al servidor real ni a flow.
- **Bitácora:** [`2026-11-01-equipo-al-instante`](bitacora/2026-11-01-equipo-al-instante/)

### 1.40 Gestión de torneos (replanteo `41`): commit del 2026-11-01, sin desplegar

- **Qué es:** Administración › Torneos. Moderadores que operan todos los torneos (sin cancelar ni borrar), siembra por ranking (torneos y PCW) con la etapa de entrada del suizo según la siembra, y cada mapa de una serie con un mix vinculado a mano o el resultado a mano ("Sin detalle de la partida").
- **Hecho el 2026-11-01** en `feat/backend-api-fase-1` y llevado a `feat/frontend-fase-1` con merge.
- **Falta:**
  1. Cargar la `41` y la `42` (fin real del torneo) en staging después de la `40` y redesplegar la API.
  2. En el corte, la `41` y la `42` van después de la `40`.
- No toca el plugin.
- **Bitácora:** [`2026-11-01-admin-torneos`](bitacora/2026-11-01-admin-torneos/)

### 1.41 Moderar equipos (replanteo `43`): commit del 2026-11-01, sin desplegar

- **Qué es:** Administración › Equipos con "Moderar equipos" (moderadores y admins: lista, historial, renombrar, quitar logo y miembros; admin además líder, sumar, rol, disolver) y "Configuración equipo" (admin). Motivo opcional y aviso obligatorio al líder (`team_staff_action`).
- **Hecho el 2026-11-01** en `feat/backend-api-fase-1` y llevado a `feat/frontend-fase-1` con merge.
- **Falta:**
  1. Cargar la `43` en staging después de la `42` y redesplegar la API.
  2. En el corte, la `43` va después de la `42`.
- No toca el plugin.
- **Bitácora:** [`2026-11-01-moderar-equipos`](bitacora/2026-11-01-moderar-equipos/)

### 1.42 Retraso del HUD por streamer y por servidor (relay 2.3.0): desplegado, falta verlo con flow

- **Qué es:** en `/control`, cada streamer elige para cada servidor SourceTV (`tv_delay`), en vivo o un retraso fijo de 1 a 300 s. El relay arma una vía por retraso; el servidor de CS manda lo mismo de siempre.
- **Solución urgente del 2026-11-01, sacada el 2026-11-02:** `"delay"` volvió a `null` en `/etc/cmleague/hud.json` (respaldos `hud.json.bak_20261101` y `hud.json.bak_20261101_delay0`).
- **Hecho el 2026-11-01:** relay 2.3.0, 47 pruebas en verde, prueba de humo con `pnpm simular` y desplegado en el VPS (`e0aa0ccc791d`).
- **Falta:**
  1. Verlo en `/control` con flow.
- No toca el plugin ni los servidores de juego.
- **Bitácora:** [`2026-11-01-hud-retraso-por-servidor`](bitacora/2026-11-01-hud-retraso-por-servidor/)

### 1.43 Frontend del matchmaking (`/play`): web desplegada en staging, con commit

- **Qué es:** `/play`, `/admin/matchmaking` y el aviso de reconexión, traídos de `kyan/pruebas` con el diseño de la web y sin los cosméticos de la tienda.
- **Hecho el 2026-11-01:** web `e0aa0ccc791d-local11020314` en el VPS (`cmleague.lat`), desde `feat/frontend-fase-1` con los cambios sin commit. La API de staging (`4079c8a22757`) ya tenía las rutas `/mm`, el WebSocket y el worker `cmleague-mm`.
- **Falta:**
  1. ~~Commit del frontend~~: **hecho el 2026-11-02** en `feat/frontend-fase-1`, con push (pedido por Daniel).
  2. Abrir la cola en Administración › Matchmaking (`mm_config.open` está en `false`) y decidir si se apaga `require_anticheat`.
  3. Un servidor que tome las salas. **Decidido por Daniel el 2026-11-01: por ahora no se toca el plugin de ningún servidor.** El plugin consulta la base de su `csstv_api_url`, y nuestro servidor real apunta a producción, que no tiene el matchmaking.
  4. ~~Redesplegar la API de staging con `6c56bd84`~~: **hecho el 2026-11-02**. API `c7a329085628`: `kyan/pruebas` más `feat/backend-api-fase-1`, armada en una rama temporal local para no sacar el matchmaking. Web `6d228f93b4dc-local11020706` desde la carpeta de siempre (con `/play`). Ver la guía de [`2026-11-01-pagina-serie`](bitacora/2026-11-01-pagina-serie/GUIA_IMPLEMENTACION.md).
- **Incidente del 2026-11-01:** el panel de Administración › Matchmaking daba 500 por tres errores de la `48`. Corregidos en staging y en `kyan/pruebas` (`a6ca687c`). Ver la guía de la bitácora.
- **Bitácora:** [`2026-11-01-frontend-matchmaking`](bitacora/2026-11-01-frontend-matchmaking/)

### 1.44 Servidor #1 nuevo (`SFTP_CSS_*_MVZG`): dejarlo igual al #3

- **Qué es:** el servidor "MVZG", nuestro, que Daniel sumó a la documentación el 2026-11-02. Pasa a ser el **#1**; flow es el **#2** y el servidor real de ExtremeHost ("aurav34"), el **#3**. Su acceso SFTP está en el `.env` como `SFTP_CSS_SERVER_MVZG`, `SFTP_CSS_SERVER_PORT_MVZG`, `SFTP_CSS_USER_MVZG` y `SFTP_CSS_PASSWORD_MVZG`. Desde el 2026-11-03 tiene API key del panel: `SFTP_CSS_API_KEY` (servidor `157703b5`). Está en **el mismo panel y la misma máquina que flow** (`190.104.34.3`), como otro servidor. Lo armó kyan el 2026-10-27 copiando el de flow: hasta el 2026-11-02 tenía el token y el tag de flow (`csstv_reporter.cfg.bak`) y sus dos demos se llaman `flow-…`.
- **Revisado por SFTP el 2026-11-02** (solo lectura), comparado contra el #3:
  - **Ya está bien:** `hostname "CMLeague #1"`, `tv_title`, `csstv_server_tag "MVZG"` con token propio, `csstv_calladmin_server "CMLeague #1"` y `_address "190.104.34.3:27022"`, HUD prendido contra `hud.cmleague.lat:27501` con clave, FastDL propio, `csstv_demo "1"`, Stripper igual (con `global_filters.cfg` y `maps/`), `mapcycle.txt` igual, `warmup.cfg` y `end.cfg` iguales, el resto de `server.cfg` y de `csstv_reporter.cfg` igual (MR3 12000, medio tiempo 3 s, `sv_pure`, `phys_timescale`, humo, tasas), `kacr_eyes_antiwall "0"`, `csstv_perf` y los mismos admins.
  - **Reporter:** la **2.7.3 licenciada** (`96bb5060-…`, 126814 bytes) que subió kyan el 2026-11-02 (bitácora `2026-11-02-aviso-y-pausa-automatica` en `kyan/pruebas`). Daniel dice que puede llevar el genérico; no hace falta cambiarlo mientras el licenciado funcione con su token.
- **Decisiones de Daniel (2026-11-02) sobre las diferencias:**
  1. **El #1 es para probar el matchmaking:** por eso manda a staging (`csstv_api_url` = `STAGING_SUPABASE_URL`, `edaljnirzvisiaathitt`). El #3 apunta a producción (`wmzfwsizashpszxlvpeb`). Queda así.
  2. **`live.cfg` del #1 con `mp_friendlyfire 0` y `mp_flashlight 0`** (el #3 y el repo tienen `1`): queda así por ahora.
  3. **`Anti_Wallhack_Lite` en `disabled/` en el #1:** se sacó para ver si arreglaba el error del sonido. Todavía no se sabe si lo arregló. Excepción temporal a `CLAUDE.md`.
  4. **El #3 es el servidor de retake y 2vs2** (`v34_retake`, `v34_wingman`); por eso no tiene los mismos plugins que el #1. **Falta versionar esos plugins en esta rama:** los fuentes (`v34_retake.sp`, `v34_wingman.sp`, `v34_dm.sp`, sus `.inc`, `configs/retake/`) y la bitácora `2026-10-30-plugin-retake` están en `origin/kyan/pruebas`; hay que traerlos.
  5. `sv_allowupload 0` en el #1 y `1` en el #3: está bien.
  6. **Demos del #1:** seguramente no tiene cargados los datos de SFTP en Administración, porque es para el matchmaking. Sin cambios.
- **Hecho el 2026-11-02:** `csstv_server_tag "MVZG"` → `"srv1"` en el `csstv_reporter.cfg` del #1, para que las partidas y las demos nuevas se llamen `srv1-…` (las dos `flow-…` que hay son de antes). Respaldo `csstv_reporter.cfg.bak_tag`, verificado bajándolo de nuevo. Se aplica en el próximo cambio de mapa; no se recargó nada. El tag solo da el prefijo del `match_uid` (el servidor se identifica por el token).
- **Hecho el 2026-11-02:** en el #3, `csstv_server_tag "srv1"` → `"srv3"` (pedido por Daniel), con el respaldo `csstv_reporter.cfg.bak_tag` y verificado bajándolo de nuevo. El reporter del #3 está en `disabled/`, así que se usa recién cuando se vuelva a activar. Las partidas y demos viejas del #3 siguen como `srv1-…`.
- **Demos del #1 (2026-11-03, Daniel): hecho, falta verlo con una partida.**
  - **Problema:** las partidas del #1 en producción quedaban con `demo_status = none`. El log decía `Demo no grabado: tv_enable está en 0`: el `server.cfg` tenía los demás `tv_*` pero no `tv_enable`, y la línea de arranque tampoco (venía de la copia de flow).
  - **`server.cfg` del #1, subido por SFTP y verificado bajándolo de nuevo:** `tv_enable 1` agregado, y `tv_port 27064` → `27065`. El arranque del panel y `game_servers.tv_port` usan 27065, y el `server.cfg` (que corre después) lo pisaba. Respaldo: `cstrike/cfg/server.cfg.bak_20261103`. No se reinició ni se recargó nada: se toma en el próximo cambio de mapa. El arranque hace `+exec server.cfg` antes de `+map`, así que también vale tras un reinicio.
  - **La línea de arranque no se toca:** la API del cliente solo deja editar variables, y la única libre (`Boot_Custom_Command`, máximo 20 caracteres) ya la usa `tv_password`.
  - **API key del panel del #1:** Daniel la creó el 2026-11-03 y está en el `.env` como `SFTP_CSS_API_KEY`. Probada: entra a `https://panel-mvzg.com`, ve el #1 (`157703b5`) y también flow (`f337a7d9`), y `files/list` de `/cstrike/csstv_demos` da 200.
  - **Producción:** `game_servers.panel_url = 'https://panel-mvzg.com'` para `96bb5060` (ya tenía `panel_server_id = '157703b5'`). Secreto `PTERO_KEY_157703b5` cargado en el Worker `v34frag-demos` (`wrangler secret put`, por stdin). Con eso, las demos del #1 bajan por la API del panel: no hace falta sumarlo a `demos-sftp.json` del VPS.
  - **Falta:**
    1. En la próxima partida del #1, ver `Grabando demo` en su log y la partida con `demo_status = uploaded`.
    2. ~~Sumar `PTERO_KEY_157703b5` a `cloudflare/demo-worker/scripts/dev-vars.py` (con `SFTP_CSS_API_KEY`) para `wrangler dev`.~~ Hecho el 2026-11-03.
  - **Limpieza del `.env` (2026-11-03, Daniel):** se borraron `SERVER1_*` (RBK), `ENSAYO_*` (ensayo del corte) y `FLOW_CSSTV_SERVER_TOKEN` (token de la fila histórica `7b01c85b`). Staging (`STAGING_*`) se deja porque se sigue usando. Las `NUBE_*` y `SUPABASE_ACCESS_TOKEN_PROD` se pueden borrar después del 2026-12-03, cuando venza la vuelta atrás a la nube.
  - **Visto de paso en los logs del #1 (sin tocar):** `addons/sourcemod/configs/adminmenu_cfgs.txt` tiene un error de sintaxis en la línea 33, y `CM_PickupWeapon` no puede escribir su cfg (permisos).

### 1.45 API key del panel de flow en el Worker de demos: cargada, falta ver la primera demo (y pronto la del #1)

- **Qué es:** desde el 2026-11-02 tenemos la API key del panel de flow (`SERVER2_PANEL_API_KEY` en el `.env`). Con ella, el Worker baja las demos de flow por la API del panel en vez de por SFTP desde el VPS, que va a 52-60 KB/s (punto 1.27).
- **Probada el 2026-11-02, solo lectura:** `GET https://panel-mvzg.com/api/client` da HTTP 200 y ve **solo** el servidor `f337a7d9` (flow, propietario), no el #1. `files/list` de `/cstrike/csstv_demos` también da 200: lista `flow-20261028T222354-0bbb.dem`, que ya está en R2 desde el 2026-10-29 y no se borró a mano.
- **No hace falta código ni migración:** el Worker ya usa `PTERO_KEY_<panel_server_id>` (`cloudflare/demo-worker/src/index.js`, `panelFor`), y flow ya tiene `panel_server_id = 'f337a7d9'` y `panel_url` en `game_servers` (punto 1.27). Si la API falla, la demo sigue yendo por SFTP.
- **Hecho:** `cloudflare/demo-worker/scripts/dev-vars.py` arma `PTERO_KEY_f337a7d9` con `SERVER2_PANEL_API_KEY` para `wrangler dev`.
- **Criterio (Daniel, 2026-11-02):** el estándar es trabajar siempre con la API key del panel; el SFTP queda solo para cuando no se pueda por API.
- **Hecho el 2026-11-02:** secreto `PTERO_KEY_f337a7d9` cargado en el Worker `v34frag-demos` de producción (`wrangler secret put`, por stdin). `wrangler secret list` lo muestra junto a `ADMIN_KEY`, `CRASH_KEY`, `DEMO_WORKER_TOKEN`, `PTERO_KEY_edbee7d6` y `PTERO_PANEL_API_KEY`. No se corrió `/run` a mano: lo toma el próximo cron.
- **Falta:**
  1. Ver que la próxima demo de flow llegue a R2 por la API, sin `demo_via = sftp`.
  2. ~~**Cuando llegue la key del #1**~~ (hecho el 2026-11-03: ver "Demos del #1" en el punto 1.44) (en el mismo panel, `panel-mvzg.com`; su `panel_server_id` es `157703b5`, el sufijo del usuario de SFTP): guardarla en el `.env` (por ejemplo, `SFTP_CSS_PANEL_API_KEY_MVZG`), probarla igual y sumarla a `dev-vars.py` como `PTERO_KEY_157703b5`. Ojo: el #1 manda a la Supabase de **staging** (punto 1.44) y el Worker de producción no ve sus partidas. Para tener sus demos haría falta un Worker apuntando a staging, o esperar a que el #1 pase a producción.

### 1.46 Matchmaking sin SteamID vinculado (replanteos `49` a `52`, plugin 2.8.2): en staging y en el #1

- **Qué es:** se puede entrar a la cola sin SteamID y se vincula con `!claim` en el servidor de la primera sala. Mientras tanto queda de espectador. Decidido por Daniel el 2026-11-02 (opción A), en lugar de esperar 5 partidas sin vincular.
- **Dónde:** base y plugin en la rama nueva `feat/mm-claim-en-sala` (worktree `E:\Css V34 Web\v34frag-mmclaim`, sale de `origin/kyan/pruebas`). Web en `feat/frontend-fase-1`.
- **Falta:**
  1. Probar el plugin con un servidor y dos clientes, uno sin vincular.
  2. ~~Commit de las dos ramas~~: hecho el 2026-11-02.
  3. ~~Aplicar la `49` en staging (`edaljnirzvisiaathitt`) y desplegar la web de staging~~: hecho el 2026-11-02 (web `b7a10ff39137`).
  4. **#1: subido el 2026-11-02** (pedido por Daniel, solo ahí): 2.8.2 licenciada `96bb5060-…`, `csstv_password` de la línea del matchmaking y en el cfg `csstv_claim "1"` y `csstv_mm "1"`. Respaldos `.bak_2.7.3`, `.bak_pre_mm` y `.bak_mm`. Entra en el próximo cambio de mapa: **confirmar que `mm_server_state` muestre `plugin_version = 2.8.2`**. Desde entonces la contraseña del #1 la maneja la web. #2 (flow, licenciado `7b01c85b-…`) y #3 (`aurav34`, genérico) reciben la 2.8.2 cuando se abra el matchmaking, en la misma tanda.
  5. ~~Decidir `min_mixes`~~: en 0 (Daniel, 2026-11-02), replanteo `50`, aplicado en staging.
  6. ~~Decidir `min_account_days`~~: en 0 (Daniel, 2026-11-02), replanteo `51`, aplicado en staging.
  7. **Replanteo `52` (2026-11-02, aplicado en staging):** las cuentas nuevas no tienen ficha y la `49` sola no las dejaba entrar a la cola. Ahora `mm_join` les crea una, y el `!claim` la une con la ficha vieja del jugador si la tiene, con su historial y su ELO. **Va en el corte junto con la `48`**, porque producción tiene miles de fichas viejas sin cuenta.
- **Bitácora:** [`2026-11-02-mm-claim-en-sala`](bitacora/2026-11-02-mm-claim-en-sala/)

### 1.47 Ajustes después del primer matchmaking (replanteos `53` a `55`): en staging, con commit

- **Qué es:** la serie del matchmaking fuera de Partidas, la flecha de volver, el detalle del mix con el MVP y los clips, la imagen fija del MVP (Administración › Matchmaking › General) la respuesta inmediata en Aceptar y en el veto, y la foto de cada jugador en Jugar (`55`).
- **Dónde:** base y API en `feat/mm-claim-en-sala`; web en `feat/frontend-fase-1`.
- **Hecho el 2026-11-02:** `53` a `55` en staging, API `8e78f7650291-local11021850` (rama temporal: `feat/mm-claim-en-sala` más `feat/backend-api-fase-1`, ya borrada) y web `7f7ca3e0f8f4-local11021851`, que también lleva lo de Palmarés y PCW.
- **Falta:** subir la imagen del MVP y mirarlo en el navegador. ~~El commit~~: hecho el 2026-11-02 (`67bc65bb` en `feat/mm-claim-en-sala` y `26fa9a71` en `feat/frontend-fase-1`, junto con Palmarés). Con el corte, junto con la `48`.
- **Segunda etapa del rendimiento (pendiente):** que el aviso del socket traiga el cambio en sí (quién aceptó, qué mapa), para no pedir el estado completo.
- **Bitácora:** [`2026-11-02-ajustes-primer-mm`](bitacora/2026-11-02-ajustes-primer-mm/)

## 2. Investigaciones abiertas


### 1.48 Iniciar partidas de torneo y PCW (replanteo `56`, plugin 2.9.0): con commit y en staging, sin plugin en ningún servidor

- **Qué es:** el organizador inicia una partida de torneo en un servidor libre y apto (Administración › Servidores › Usos del servidor); en una PCW, los dos equipos se marcan listos y entran a la fila. La reserva dura toda la serie, el veto tiene reloj (30 s, al azar si vence), la espera es la del organizador (máximo 20 min) o 15 y 5 min en PCW, y una PCW abandonada sanciona 3 o 7 días. El servidor queda ocupado en el acto, también para el matchmaking.
- **Dónde:** base, plugin y API en `feat/mm-claim-en-sala` (worktree `E:\Css V34 Web\v34frag-mmclaim`); web en `feat/frontend-fase-1`.
- **Falta:**
  1. ~~Commit de las dos ramas~~: **hecho el 2026-11-02** (`d4c407b2`, `6f22bf43` y `421cc8a3` en `feat/mm-claim-en-sala`; `60b16f3d` en `feat/frontend-fase-1`). Sin push.
  2. ~~Staging~~: **hecho el 2026-11-02**: `56` aplicada, API `3c6a8b357cd1` y web `60b16f3db869`.
  3. Elegir con Kyan el servidor de prueba (el matchmaking está apagado en todos), prender ahí Torneos y PCW y subirle el reporter 2.9.0, `csstv_mm "1"` y las cfg `live_*.cfg`.
  4. Probar con clientes en el #1: una BO3 de torneo y una PCW con abandono.
  5. La lista de partidas listas para iniciar y en curso en Administración › Torneos (no se hizo).
  6. Que la página de la serie escuche `booking.update` por el socket (hoy se refresca cada 5 s).
  7. Producción con el corte, junto con la `48`; el plugin a los tres servidores en la misma tanda (#1, flow licenciado `7b01c85b-…` y #3).
  8. El manual de usuario por rol: en curso, ver 1.49 (sus páginas de capitán y organizador cubren lo de este punto).
- **Bitácora:** [`2026-11-02-iniciar-torneo-pcw`](bitacora/2026-11-02-iniciar-torneo-pcw/)

### 1.50 Aviso de la cola en Discord (replanteo `57`): en staging y probado en #avisos

- **Qué es:** "Avisar en Discord" en la barra de "Buscando": publica en #avisos "@player Hay gente en la queue, ¡mándate!". Uno cada 15 min para todos; moderadores y admins, siempre.
- **Hecho el 2026-11-02:** commit, `57` en staging, el webhook y el rol en `/etc/cmleague/api.env` (respaldo `.bak_antes_discord`), API `51b2127f7777` y web `21dc2fb36f7e`.
- **Probado en #avisos el 2026-11-02** (con el visto bueno de Daniel).
- ~~**Falta:** regenerar el webhook~~: regenerado en Discord ("Avisos") y cargado el 2026-11-03 en el `.env` y en `/etc/cmleague/api.env` (respaldo `api.env.bak_antes_webhook_avisos_202611031915`), con `cmleague-api` reiniciada (`/api/health` bien, producción). El nuevo también se pegó en el chat. Producción ya tiene la `57` (corte).
- **Bitácora:** [`2026-11-02-aviso-cola-discord`](bitacora/2026-11-02-aviso-cola-discord/)

### 1.51 `!claim` en la primera partida y varios SteamID (replanteo `58`, reporter 2.9.1): en staging y el 2.9.1 en el #1

- **Qué es:** un SteamID nuevo se suma al instante a la ficha con `!claim` (opción A de Daniel), con aviso a los admins; el plantel del matchmaking usa todos los SteamID; los textos ya no dicen "entra al servidor".
- **Hecho el 2026-11-02:** commit, `58` en staging y la web `21dc2fb36f7e`.
- **Hecho el 2026-11-02:** el 2.9.1 licenciado en el #1 (entra en el próximo cambio de mapa; el 2.9.0 en `disabled/`).
- **Falta:** probarlo con alguien que entre desde otra PC. Producción con el corte, junto con la `48`.
- **Bitácora:** [`2026-11-02-claim-varios-steamid`](bitacora/2026-11-02-claim-varios-steamid/)

### 1.52 Matchmaking con avisos que traen el dato y estado liviano (replanteo `59`): con commit y en staging

- **Qué es:** `queue.changed` actualiza el contador sin pedir nada, "Partida encontrada" se abre con el aviso, el estado se parte en liviano (`/mm/state/live`) y perfil (`/mm/profile`), y cada aviso pide solo lo suyo. Sin cambios en el plugin (nada que subir al #1, #2 ni #3).
- **Hecho el 2026-11-02:** `59` con inversa y 11 pruebas SQL; API (440 pruebas) y web (524 pruebas).
- **Hecho el 2026-11-02:** commit, `59` en staging, API `4225068507f9` y web `f11f1952fd60`.
- **Falta:** medir con jugadores (logs de la API) y comparar con la tabla del plan. Producción con el corte.
- **Bitácora:** [`2026-11-02-mm-avisos-livianos`](bitacora/2026-11-02-mm-avisos-livianos/)

### 1.53 El flujo de la sala del matchmaking (replanteo `60`): con commit y en staging

- **Qué es:** aceptar sin la carrera con el tick (sancionaba a quien aceptó en el último instante), 3 s de pausa antes de otra sala para quien vuelve a la cola, aviso de cancelación con el motivo, Jugar como principal con la pestaña "Tu última partida", y la pantalla al día cuando otro actúa durante una acción propia. Sin cambios en la API ni en el plugin.
- **Hecho el 2026-11-02:** `60` con inversa y 17 pruebas SQL; web (530 pruebas).
- **Hecho el 2026-11-02:** commit, `60` en staging y la web `8049dc993a51`.
- **Falta:** probarlo con jugadores; actualizar `docs/manual/jugador/buscar-partida.md` cuando se suba el manual. Producción con el corte.
- **Bitácora:** [`2026-11-02-mm-flujo-sala`](bitacora/2026-11-02-mm-flujo-sala/)

### 1.54 El matchmaking de staging en la rama del frontend: con commit y push

- **Qué es:** `feat/frontend-fase-1` ya tiene la base (replanteos `45` a `62`; los `45` a `47` del anticheat solo porque el `48` los exige), la API (`mm`, `bookings`, socket y worker), el VPS (`cmleague-mm`) y el reporter 2.9.1 de `feat/mm-claim-en-sala`, sin lo demás de kyan. Desde ahora, todo cambio del matchmaking fuera de la web se commitea en las dos ramas (regla en `CLAUDE.md`).
- **Hecho el 2026-11-02:** commit `55ad155e` (rama `merge/mm-en-frontend`, worktree `v34frag-mmfront`) y fast-forward de `feat/frontend-fase-1`. API: typecheck, 437 pruebas y build bien. Reporter 2.9.1 y `csstv_password` 1.1.0 compilan sin avisos.
- **Hecho el 2026-11-03:** push de `feat/frontend-fase-1` y de `feat/mm-claim-en-sala` (las dos al día con `origin`).
- **Falta:** borrar el worktree `v34frag-mmfront` y la rama `merge/mm-en-frontend`. El `.smx` del repo en esta rama sigue siendo el 2.7.3.
- **Bitácora:** [`2026-11-02-mm-en-rama-frontend`](bitacora/2026-11-02-mm-en-rama-frontend/)

### 1.49 Manual de usuario por rol: con commit y en staging (2026-11-03); faltan las capturas

- **Qué es:** la sección Ayuda (`/help`) con el manual (`docs/manual/`), solo con sesión y filtrado por rol en la API (`/api/v1/manual`). Desde ahora cada `DOCUMENTACION.md` lleva "Qué cambia para cada rol" y se actualiza la página del manual al terminar (`docs/bitacora/PLANTILLA.md`).
- **Dónde:** manual, web y bitácora en `feat/frontend-fase-1`; API en `feat/mm-claim-en-sala` (worktree `E:\Css V34 Web\v34frag-mmclaim`).
- **Hecho:** la regla, la API, la web y los textos de las 7 secciones (37 páginas, 3 ocultas por PCW; 2026-11-03), sin capturas. La API se probó en local contra staging con tokens reales.
- **Falta:**
  1. Que Daniel revise las páginas. Los tres puntos "Para revisar" de la guía (reportes solo para admin, "Reprocesar" y el nombre del equipo) los resolvió el punto 1.56.
  2. Las capturas, desde staging (`daniloev`, `kyan` y `adminprueba`, credenciales `STAGING_TEST_*`).
  3. Los links "¿Cómo funciona?" en Jugar, la página de una serie y Administración › Torneos.
  4. ~~Commit y despliegue en staging~~: hecho el 2026-11-03 (`ebaecd9c`, `c4b004a4`, API `0d5732881cbe` y web `e53200f83840`).
- **Valores reales (2026-11-03):** los números configurables del manual van con marcadores (`{{mm.aceptar}}`) que la API reemplaza con `manual_valores()`, replanteo `65`, **aplicado en staging**. Sale con la API del manual ([`2026-11-03-manual-valores-reales`](bitacora/2026-11-03-manual-valores-reales/)).
- **Bitácora:** [`2026-11-02-manual-usuario`](bitacora/2026-11-02-manual-usuario/)

### 1.55 Imagen del inicio de sesión configurable (replanteo `67`): con commit y en staging (2026-11-03)

- **Qué es:** el panel derecho de Iniciar sesión, Registro y Bienvenida muestra la imagen que sube un admin en Administración › Usuarios › Inicio de sesión (4:5, 1600 × 2000, bucket `photos/site/`). Sin imagen, queda gris (Daniel, 2026-11-03).
- **Dónde:** base, API y web en `feat/frontend-fase-1`.
- **Hecho el 2026-11-03:** replanteo `67` con inversa y 10 pruebas SQL (corridas en local con `pg_safeupdate`), API (466 pruebas) y web (553 pruebas).
- **Falta:**
  1. ~~Correr las pruebas SQL~~: hecho el 2026-11-03.
  2. ~~Commit~~: hecho el 2026-11-03 en `feat/frontend-fase-1`. La base y la API también en `feat/mm-claim-en-sala` (`95942673`, 2026-11-03).
  3. ~~Staging: la `67`, la API y la web~~: hecho el 2026-11-03. Falta subir una imagen y mirarla en 1440, 1920 y un teléfono.
  4. La página del manual de Admin (`docs/manual/admin/imagen-inicio-sesion.md`), con el resto de la sección Admin (punto 1.49).
  5. Producción con el corte.
- **Bitácora:** [`2026-11-03-imagen-login`](bitacora/2026-11-03-imagen-login/)

### 1.56 Reportes solo para el admin, lista de clips y nombre del equipo (replanteo `68`): con commit y en staging (2026-11-03)

- **Qué es:** los reportes del matchmaking los resuelve solo un admin (web, API y base); pestaña **Clips** en Administración › Clips para reprocesar varios a la vez; el capitán cambia el nombre y la sigla desde **Editar equipo** cada `team_config.rename_days` días (30 por defecto, configurable en Configuración equipo). Pedido por Daniel el 2026-11-03.
- **Dónde:** base en las dos ramas; API en `feat/mm-claim-en-sala`; web, manual y bitácora en `feat/frontend-fase-1`.
- **Hecho el 2026-11-03:** replanteo `68` con inversa y 5 pruebas SQL (pasaron en staging, deshechas), API (481 pruebas unitarias), web (557 pruebas) y las 6 páginas del manual.
- **Falta:**
  1. ~~Pruebas SQL y `68` en staging~~: el `68` ya estaba aplicado (lo hizo la sesión anterior sin anotarlo) y las pruebas pasaron el 2026-11-03.
  2. ~~Commit~~: `034d280a` en `feat/mm-claim-en-sala` y `e53200f8` en `feat/frontend-fase-1` (base y API en las dos), sin push.
  3. ~~Staging~~: API `0d5732881cbe` y web `e53200f83840`, el 2026-11-03. Falta mirarlo en el navegador (la web de staging pide la contraseña de Caddy).
  4. Producción con el corte. No toca a los servidores de juego.
- **Bitácora:** [`2026-11-03-reportes-clips-nombre-equipo`](bitacora/2026-11-03-reportes-clips-nombre-equipo/)

### 1.57 La foto de cada integrante en el plantel (replanteo `69`): en staging, sin commit

- **Qué es:** `team_members_view` usa la foto de la cuenta si la ficha no tiene (como `player_overview`). Roles de equipo y el plantel mostraban la inicial (Daniel, 2026-11-03).
- **Falta:** commit (la `69` en las dos ramas) y producción con el corte. `vip_status` tiene el mismo problema (lista de VIP de Administración), sin tocar.
- **Bitácora:** [`2026-11-03-foto-en-plantel`](bitacora/2026-11-03-foto-en-plantel/)

### 1.58 Amigos al instante y la misma foto de perfil (replanteo `71`): desplegado (2026-11-03)

- **Qué es:** sumar o sacar a un amigo avisa `friend.changed` por el socket, y la otra persona lo ve sin recargar. En la foto, gana la última que se subió (Daniel, 2026-11-03): al subir la suya, el jugador deja de ver la de su ficha. Antes, el menú de la cuenta mostraba la foto nueva y el resto de la web la de la ficha.
- **Dónde:** base en `feat/frontend-fase-1` y en `feat/mm-claim-en-sala` (es del matchmaking); web en `feat/frontend-fase-1`.
- **Hecho el 2026-11-03:** replanteo `71` (era el `70`: el `70` es el de Kyan) con inversa y 11 pruebas SQL (en local con `pg_safeupdate` y en staging, deshechas), web (560 pruebas), commit en las dos ramas y la base aplicada en staging.
- **Falta:**
  1. ~~Staging~~: aplicada y con el respaldo renombrado a `replanteo71_fotos_ficha` (2026-11-03).
  2. ~~Producción~~: aplicada el 2026-11-03 (kyan y saiko pasaron a la foto de su cuenta; las de ficha, en el respaldo).
  3. ~~Web~~: `507a9d528e2b` en el VPS el 2026-11-03. La API no cambió.
  4. Probar con dos cuentas: B suma a A y A lo ve al instante; cambiar la foto y verla igual en el menú de la cuenta, la ficha, el ranking y Jugar.
- **Bitácora:** [`2026-11-03-amigos-y-foto-perfil`](bitacora/2026-11-03-amigos-y-foto-perfil/)

### 1.59 Equipos del matchmaking más parejos con el rating (replanteo `73`): en `main`, sin desplegar

- **Qué es:** con `mm_config.balance_rating` encendido, los equipos se reparten con un ELO de armado: ELO + ajuste por el rating 5v5 reciente, con tope (±100 por defecto). Apagado (como viene), igual que antes. La ventana de la cola, el capitán, el veto y el ELO que se gana o pierde siguen con el ELO.
- **Hecho el 2026-11-04 en `main`:** replanteo `73` con inversa, prueba en staging (`pruebas/probar_73.sh`, con rollback), el bloque del admin, el manual y los términos (sección 8). La API no cambió.
- **Falta:**
  1. Aplicar el `73` en producción **sin un mix en curso** (el `alter table mm_config` bloquea un instante al worker del matchmaking).
  2. Desplegar la web desde `main`.
  3. Encender el interruptor, revisar las primeras salas (consulta en la guía) y publicar el changelog.
- **Bitácora:** [`2026-11-04-mm-equipos-con-rating`](bitacora/2026-11-04-mm-equipos-con-rating/)

### 2.0 Tirones y sonido en el servidor real (hoy #3)

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
  3. ~~Tasas coherentes~~: aplicadas el 2026-10-27 en el real y en RBK con los mínimos en 100 y los máximos en 101 (punto 1.21).
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
| [`2026-11-04-medallas-configurables`](bitacora/2026-11-04-medallas-configurables/PLAN.md) | Medallas configurables: plantillas base de `badges/nuevas` + definiciones (objetivo, métrica y diseño) desde Administración › Medallas, motor con `medals:tick` y sin emoji en ninguna parte | Aprobación y las 13 preguntas de la sección 14. Pedirle a Kyan el Top 20 y `generar_medallas_perfil.py`. **La fase 1 tiene que estar antes del cierre de la BETA (2026-12-03 06:00 de Argentina)**, o esas medallas se otorgan con emoji |
| [`2026-10-14-web-pages-worker`](bitacora/2026-10-14-web-pages-worker/PLAN.md) | Plan general: API REST (Hono + OpenAPI) por la que pase todo lo que hoy hace el navegador contra Supabase, motor de torneos en el backend, frontend nuevo y despliegue con GitHub Actions | **Parcialmente superado:** el backend avanza con su propio plan (sección 6) y el hosting pasó de Cloudflare Pages y Workers a un VPS (OVH desde el 2026-10-25). La parte de despliegue hay que replanearla para el VPS |
| [`2026-10-16-despliegue-vps`](bitacora/2026-10-16-despliegue-vps/PLAN.md) | Despliegue de la web nueva en el VPS (OVH VPS-1 en Hillsboro, Ubuntu 26.04, desde el 2026-10-25; el plan dice Hostinger y los cambios están en su guía): servidor, Caddy, servicio de la API, pipeline, DNS, SMTP de Auth, ensayo en staging y orden del corte | Aprobación de Daniel y los requisitos de su sección 9 (dominio, VPS, Resend, Supabase de staging, permisos en GitHub). Daniel pidió no implementarlo todavía |

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
- **Hosting decidido:** VPS **OVH VPS-1 en Hillsboro, Oregón** (2 vCPU, 4 GB, 40 GB NVMe), con dominio propio y **Ubuntu 26.04 LTS** (24.04 si OVH todavía no tiene la imagen). Reemplaza al KVM 1 de Hostinger (cambio de Daniel del 2026-10-25): está al lado de la Supabase de producción (`us-west-2`), tiene backup diario y sale más barato. Se contrata en `us.ovhcloud.com` (cuenta aparte de la de ovhcloud.com) y en un VPS de datacenter, no de Local Zone. Cloudflare se queda solo con el Worker de demos y R2. El despliegue (build, servicio de Node, Caddy con HTTPS, DNS, pipeline y SMTP para Supabase Auth) tiene plan propio, sin aprobar: [`2026-10-16-despliegue-vps`](bitacora/2026-10-16-despliegue-vps/PLAN.md).
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
- **Baneos gestionados desde la web** (plan aprobado el 2026-10-26): **base y API hechas el 2026-10-26**, solo en local (replanteo `31`, rama `feat/backend-api-fase-1`). Tabla `bans` (lista única para todos los servidores, incluido RBK), rol `moderator` (permanente solo admin; el moderador cambia o levanta cualquiera que no sea permanente), funciones del plugin (`csstv_ban_check`, `csstv_bans_since`, `csstv_ban_add`, `csstv_ban_lift`) y `/api/v1/bans`, `/api/v1/players/{id}/bans` y `/api/v1/admin/bans*`. Ver [`2026-10-25-baneos-web`](bitacora/2026-10-25-baneos-web/DOCUMENTACION.md). Falta, en este orden:
  - el frontend: página pública "Baneos", Administración › Baneos, el botón "Banear", el aviso en la ficha y `moderator` en los roles de Administración;
  - el plugin `csstv_bans` (congelado hasta el final, o como excepción si Daniel la pide): consulta al conectarse, sincronización cada 3 minutos y al empezar cada mapa (no cada 30 s, para no cargar el #1; Daniel, 2026-10-26) y `!syncbans` para moderadores y admins. También la importación de los `banned_user.cfg` del real y de RBK;
  - el despliegue con la web nueva (Daniel, 2026-10-26): el plugin, en el servidor real y en flow (build licenciado) en la misma tanda. Está en la lista de plugins que esperan la web nueva (punto 1.5).
- ~~**Maestra de mapas**~~ (pedido por Daniel el 2026-10-24): **backend hecho el 2026-10-25**, solo en local (replanteo `30`). Es el catálogo `map_pool`:
  - un mapa disponible o retirado (no se borra);
  - `mixes`: el select de Mixes;
  - `veto_default`: el pool por defecto del veto;
  - la foto de hasta 2 MB.

  Además, cada torneo tiene su pool, que elige el organizador, y cada PCW el suyo, que elige quien publica. Ver [`2026-10-25-pool-mapas-torneos-pcw`](bitacora/2026-10-25-pool-mapas-torneos-pcw/DOCUMENTACION.md), que reemplazó el diseño de [`2026-10-25-maestra-mapas`](bitacora/2026-10-25-maestra-mapas/GUIA_IMPLEMENTACION.md).
  - **Falta el frontend:**
    - el catálogo en Administración (marcas y foto; el `PUT` ya no borra y tiene que mandar todos los mapas);
    - el select de Mixes desde `GET /maps?mixes=true` y la foto del marcador buscando el mapa del mix entre las `versions`. Cambia el `queryFn` de `features/maps/queries.ts` y `mapImage`;
    - el selector del pool al crear o editar un torneo y al publicar una PCW.
  - **Plugin, en pausa por el orden de trabajo:** para la advertencia "a este servidor le faltan N mapas" en `GET /api/v1/admin/servers`, el reporter tiene que informar los `.bsp` de `maps/` (por ejemplo, al validar la licencia o al cargar un mapa). Hoy no lo hace.
- ~~**Pedidos del frontend de Mixes**~~ (2026-10-24, bitácora [`2026-10-24-frontend-mixes`](bitacora/2026-10-24-frontend-mixes/GUIA_IMPLEMENTACION.md)): **hechos el 2026-10-25** (`677425d`), solo en local y sin migración: `match_id` en el `404` de `GET /api/v1/mixes/live/{uid}`, `level` y `elo` en `PlayerLine` y `LivePlayerLine`, y `review` en `MixItem`. Ver [`2026-10-25-api-pedidos-mixes`](bitacora/2026-10-25-api-pedidos-mixes/DOCUMENTACION.md). Falta usarlos en el frontend.
- **Pedidos del frontend de Ranking** (2026-10-24, bitácora [`2026-10-24-frontend-ranking`](bitacora/2026-10-24-frontend-ranking/GUIA_IMPLEMENTACION.md)):
  - ~~Orden de los sin puesto en `GET /api/v1/seasons/{id}/standings` y en la vista previa del cierre~~: **corregido el 2026-10-24** (`5f786eb`, rama `feat/backend-api-fase-1`, con push): `runList` acepta `elo:desc`.
  - ~~(Opcional) `teams`, `rating`, `kd` y el filtro `level` en esa respuesta~~: **hecho el 2026-10-25**, solo en local (replanteo `30`): rating y K/D de los mixes de la temporada (guardados en la foto del cierre), equipos actuales, filtros `level` y `team` y orden por `rating` y `kd`. Ver [`2026-10-25-ranking-temporada-columnas`](bitacora/2026-10-25-ranking-temporada-columnas/DOCUMENTACION.md). Falta mostrar las columnas en la tabla de la temporada del frontend.
- **Pedidos del frontend de Perfil público** (2026-10-24, bitácora [`2026-10-24-frontend-perfil-publico`](bitacora/2026-10-24-frontend-perfil-publico/GUIA_IMPLEMENTACION.md)):
  - ~~`is_captain` en `GET /api/v1/players/{id}/teams`~~: **hecho el 2026-10-24** (`5f786eb`, con push). Sin migración: la vista ya lo tenía.
- **Notificaciones, segunda etapa: hecha en local el 2026-10-29, sin desplegar** (bitácora [`2026-10-29-notificaciones-programadas`](bitacora/2026-10-29-notificaciones-programadas/GUIA_IMPLEMENTACION.md)): replanteo `35` con `notify_due()` y el timer `cmleague-notify` (partida de torneo o PCW en 1 hora, PCW vencida sin rival, temporada por terminar 24 horas antes, partida de torneo sin resultado a las 3 horas y VIP que vence en 3 días). En el VPS ya corre contra staging desde el 2026-10-29 (`cmleague-notify.timer`, con la `35` en staging). Falta: aplicar la `35` en producción en el corte (después de la `28`); y en el frontend, los textos de los seis tipos y mostrarle `match_no_result` al organizador. La primera etapa (replanteo `28`) está hecha en local, sin desplegar.
- **Estadísticas de partida: frontend** (2026-10-25, bitácora [`2026-10-25-stats-partida`](bitacora/2026-10-25-stats-partida/PLAN.md), sección 4): el backend (replanteo `29`) está hecho en local; faltan las pestañas en la sala del mix y la tarjeta "Estilo de juego" del perfil público.
- **Estadísticas de partida: lo que necesita el plugin, en pausa** (decidido por Daniel el 2026-10-25): precisión, KAST, RWS, rondas sobrevividas, trades, clutches perdidos, kills por minuto, MVP por ronda y Swing. No se planifica por el riesgo de lag en el servidor; si se retoma, medir antes con `csstv_perf`.
- **Dependencias de desarrollo con avisos de seguridad** (`npm audit`: `sharp` y `miniflare` vía wrangler, y `source-map-js`): no corren en producción. Se corrigen al pasar wrangler a 4.151 o superior, en `web/backend` y en `cloudflare/demo-worker`.
- **Matchmaking viejo:** lo desarrollaba mchssj (rama `origin/feat/matchmaking-5v5`) y estaba inestable. Se borra en el corte (`03_matchmaking.sql`); si se rehace, es desde cero.

## 7. Deuda técnica

### 7.0 Prueba del replanteo `23` desactualizada

`docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/23_whois.sql` espera `player_nick = 'Ficha23'`, pero desde la `09` el nick de una ficha vinculada a un usuario es su alias (`Alias23`). Por eso `correr.sh` se corta en la `23` y no llega a probar de la `24` en adelante. Hay que cambiar el valor esperado (encontrado el 2026-10-23; no se tocó, porque es de otro requerimiento). La `27` (2026-10-24) se probó con el mismo ciclo de `correr.sh`, a mano.

Además, `pruebas/24_temporadas.sql` falla en "la fecha de fin tiene que ser futura" sobre la base local de hoy, con o sin la `37` (visto el 2026-10-29; sin investigar). La `37` se probó con su propio ciclo a mano: aplicar, prueba, segunda aplicación que aborta, inversa con la estructura idéntica y volver a aplicar. Las pruebas de la `30`, `34` y `35` pasan con la `37` aplicada.

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
- **Credenciales:** todas en el `.env` de la raíz, que no se versiona. `SFTP_CSS_*_MVZG` es el #1 (nuevo, desde el 2026-11-02), `SERVER2_*` es flow (#2), `SFTP_CSS_*` sin sufijo es el servidor real de ExtremeHost (#3) (`SERVER1_*` era RBK, dado de baja el 2026-10-29), `FTP_WEB_*` es la web, `PTERO_PANEL_*` es la API del panel, y además `DEMO_WORKER_TOKEN` y `ACCELERATOR_CRASH_KEY`. Para SFTP se usó `paramiko` en un entorno virtual aparte.
- **Servidor local de pruebas:**
  - Está en `E:\CSS DEDICATED SERVER\server`: SourceMod 1.10, Accelerator, puerto 27016, RCON con la clave de `cstrike\cfg\server.cfg`.
  - Las pruebas se hacen con bots en `$2000$` y equipos desparejos (3 contra 1), con la build de depuración (`spcomp csstv_reporter.sp CSSTV_DEBUG=`) y `csstv_debug_fakecmd <userid> <comando>`.
  - **Envía a la Supabase real:** poner `csstv_send 0` después de cada carga del cfg y vaciar `data/csstv/queue/` antes de reiniciar.
  - Scripts en `docs/bitacora/2026-10-13-plugin-1-6-0/pruebas/lib.sh`.
  - **Con la Supabase local corriendo** (Docker), srcds toma la interfaz de Docker (`172.24.0.1`): RCON va por esa dirección.
  - **Bots:**
    - `bot_add_ct <nombre>` solo acepta nombres de `BotProfile.db`. Para otros nombres se usa `sm_rename`; con `CSSTV_DEBUG`, el SteamID falso sale del nombre actual.
    - Un `jointeam` de un bot que procesa el motor **tira el servidor**, aun sin nuestro plugin. Para moverlos se usa `!team` / `sm_team`.
- **Servidores (numeración del 2026-11-02):**
  - **#1:** "MVZG", nuestro, en el mismo panel y la misma máquina que flow, acceso `SFTP_CSS_*_MVZG`. Revisado el 2026-11-02 (punto 1.44).
  - **#2:** flow, externo, build licenciado, acceso `SERVER2_*` sin panel ni consola.
  - **#3:** el servidor real de siempre ("servidor real" o "#1" en todo lo anterior al 2026-11-02). ExtremeHost (Pterodactyl, Linux), SourceMod 1.10. No tenemos RCON: se verifica con la consola del panel o con logs por SFTP.
  - Los servidores de terceros (flow) llevan build licenciado, nunca el `.smx` genérico. **Regla:** todo despliegue va al #1, al #2 y al #3 en la misma tanda (ver `CLAUDE.md`).
- **Pruebas de SQL:** PostgreSQL 18 local (`initdb` + `pg_ctl` en un puerto libre), `docs/bitacora/2026-10-11-elo-jugadores/pruebas/stub_supabase.sql`, todas las migraciones en orden y después los `pruebas_*.sql`.

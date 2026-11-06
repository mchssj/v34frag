# Reemplazos en el matchmaking: guía de implementación

## Estado

Hecho y probado en local el 2026-11-05: la base (con la copia de producción, en una transacción con rollback, y los dos clics a la vez con dos sesiones), la API, el worker, la web y el plugin 2.10.0 **con bots en el servidor local** (26 de 26). **Sin commit y sin desplegar.**

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/75_mm_reemplazos.sql` | Nuevo: configuración, columnas, `mm_replacements`, funciones y cambios en `mm_tick`, `csstv_mm_report`, `csstv_mm_poll`, `mm_elo_delta`, `mm_player_card`, `mm_set_config` y `manual_valores` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/75_mm_reemplazos.sql` | Nueva: inversa |
| `supabase/replanteo/README.md` | Fila de la `75` |
| `pruebas/prueba_75.sql`, `probar_75.sh`, `concurrencia_75.sh` | Pruebas de la base |
| `pruebas/e2e_bots_75.sh` | Prueba de punta a punta con bots (servidor local contra la base local) |
| `web/backend/src/jobs/mm-replace.ts` | Nuevo: texto del aviso y publicación/edición por webhook |
| `web/backend/scripts/mm-worker.mts` | Publica los avisos después de cada `mm_tick` |
| `web/backend/src/routes/mm.ts` | `GET` y `POST /api/v1/mm/replace/{token}` |
| `web/backend/src/lib/ratelimit.ts`, `wrangler.toml` | Regla `replace` y binding `RL_REPLACE` (1007 y 1008 en preview) |
| `web/backend/src/lib/manual.ts` | Marcadores `mm.reemplazo_link`, `mm.reemplazo_voto` y `mm.reemplazo_rondas` |
| `web/backend/test/unit/mm-replace.test.ts` | Nuevo: 13 pruebas |
| `deploy/vps/season.env.example` | Las variables de Discord y `FRONTEND_URL` para el worker |
| `server/addons/sourcemod/scripting/csstv/mm.inc` | Bloque "Reemplazos": `!callreplace`, voto, `Mm_LiveRoster`, `Mm_LiveSide` |
| `server/addons/sourcemod/scripting/csstv/qol.inc` | `Recon_WantedSide`, `Recon_Place` y `Cmd_JoinTeam` con `Mm_LiveSide` |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 2.10.0 |
| `web/frontend/src/features/matchmaking/ReplacePage.tsx` (+ prueba), `routes/_app/mm.reemplazo.$token.tsx`, `routeTree.gen.ts` | Página del link |
| `web/frontend/src/features/matchmaking/admin/GeneralForm.tsx` (+ prueba en `AdminMatchmaking.test.tsx`), `types.ts`, `demo.ts`, `source.ts`, `room/RoomOverview.tsx` | Administración, fuente de datos y sala |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `lib/meta.ts`, `terms/terminos.html` | Términos, secciones 7 y 8 |
| `docs/manual/jugador/buscar-partida.md`, `jugador/jugar-en-el-servidor.md`, `admin/matchmaking.md` | Manual |
| `docs/bitacora/2026-11-04-mm-reemplazos/PLAN.md` | Las decisiones de Daniel del 2026-11-05, antes de implementar |

## Ramas

- `feat/frontend-fase-1`: todo. Antes se hizo merge de `main` (`9bcb65bc`), que traía la `73` (equipos con rating), porque los reemplazos tocan las mismas funciones.
- `feat/mm-claim-en-sala`: la base, la API, el worker, el VPS y el plugin, **no la web** (convención de ramas del matchmaking). Ya tiene la `73` (`0f6bf7cf`, solo la base). Falta llevar este requerimiento cuando se commitee.

## Despliegue (pendiente)

Sin un mix en curso. Con `replace_enabled` apagado hasta probar un mix.

1. **Base del VPS:** `75_mm_reemplazos.sql` (después de la `73` y la `74`, que ya están), desde el archivo commiteado (LF). Cargado desde Windows con CRLF (`core.autocrlf`), el `\r` queda dentro de las funciones nuevas: si hace falta, `tr -d '\r'`. Antes, `probar_75.sh` contra la base por el túnel.
2. **Worker:** sumar a `/etc/cmleague/season.env` `DISCORD_QUEUE_WEBHOOK_URL` y `DISCORD_QUEUE_ROLE_ID` (los mismos de `api.env`) y `FRONTEND_URL=https://cmleague.lat`. Desplegar la API (el worker va en el mismo paquete) y reiniciar `cmleague-mm` y `cmleague-api`.
3. **Web:** desplegar el frontend.
4. **Plugin 2.10.0, en los tres servidores en la misma tanda:** el `.smx` genérico en el #1 (`SFTP_CSS_*_MVZG`) y en el #3 (`SFTP_CSS_*`; ahí está en `disabled/`), y el build licenciado en el #2, flow (`server/build_licenciado.sh <id> server-cm-league-2`, por `SERVER2_*`). Se carga en el próximo cambio de mapa: no recargar con una partida en curso.
5. Probar un mix con `replace_enabled` encendido y, si anda, dejarlo así.

Un plugin 2.9.x con la base nueva sigue andando: no lee `replace=` ni `away=`, y el plantel en vivo no se actualiza (el reemplazo entraría sin lado asignado). Por eso el interruptor queda apagado hasta tener la 2.10.0 en el servidor que toma salas (#1).

## Pruebas

### Base (Supabase local con la copia de producción del 2026-11-05)

- `probar_75.sh docker`: el replanteo, **44 comprobaciones** y la inversa, en una transacción con rollback. La inversa deja las siete funciones exactamente como estaban (md5 de `pg_get_functiondef`) y no quedan ni la tabla ni las columnas. Cubre: el poll en vivo; el abandono a los 3 minutos abre el pedido; pending y mark (el token deja de estar en claro); la info del link para un candidato, uno de la sala y el que abandonó; tomarlo (sale de la cola), el segundo que llega tarde (`V3901`), tomarlo dos veces el mismo; el plantel sin el reemplazado; la llegada por `back` cubre el abandono; dos abandonos más en el mismo equipo (uno abierto a la vez, derrota automática); `!callreplace` (abandono en el acto, con sanción; uno conectado no); el que tomó y no entró (sale, sanción y otro pedido); el vencimiento; las rondas mínimas (13-10); apagado; la partida termina; la configuración desde Administración; el manual y los permisos.
- `concurrencia_75.sh`: dos sesiones toman el mismo link a la vez y cada una espera 2 s antes de confirmar: **uno lo toma y el otro recibe "Ya lo tomó otro jugador"**, con un solo reemplazo en la sala. Crea datos commiteados y los borra al terminar, y deja `mm_config` como estaba.
- La `75` quedó aplicada en la base local para desarrollar la API y la web.

### API y worker

- `pnpm test`: 39 archivos, **531 pruebas** (13 nuevas en `mm-replace.test.ts`: el texto de cada estado, el `_` de los mapas escapado, publicar con `wait=true`, editar sin mencionar, el fallo de Discord, sin webhook, el cerrado sin publicar, y las rutas: info, tomar, 409, token inválido y sin sesión). `pnpm typecheck` y `pnpm build` sin errores.

### Web

- `pnpm test`: 100 archivos, **614 pruebas** (5 nuevas de `ReplacePage` y una de Administración). `tsc -b`, `eslint` y Prettier en los archivos tocados, sin errores.
- No se regeneró `schema.d.ts`: las rutas del matchmaking se llaman sin el cliente tipado (`MmJson`).

### Plugin (con bots, 2026-11-05)

- Compila con `spcomp` 1.8 sin errores ni avisos, normal y con `CSSTV_DEBUG`.
- `e2e_bots_75.sh`: el servidor local (`E:\CSS DEDICATED SERVER`) con el 2.10.0 de pruebas, apuntando a la **base local** (nunca a la real). Guarda la base antes y la restaura al salir, y deja como estaban la cfg, el plugin, la licencia y la cola del servidor. Siembra una sala 5v5 asignada al servidor con 10 bots (SteamID falso por nombre) y una cuenta más para el reemplazo (el bot Albert). **26 de 26** en la cuarta corrida:
  - El servidor toma la sala, conecta a los 10 y la pone en vivo; el poll en vivo trae `replace=1,1`.
  - Moe se va y `sm_callreplace_as Arnold <SteamID de Moe>` (los bots votan Sí): Moe abandona en el acto, se abre el pedido (`vote`), el chat lo anuncia, `abandons=1,0` y `replace=0,1`. Un segundo voto del mismo equipo ni se abre (espera) y no hay otro pedido.
  - Albert toma el link; el plantel del equipo 1 lo tiene y no tiene a Moe. Entra del lado contrario al de su equipo y el plugin lo pasa al de Arnold ("Albert entró de reemplazo en team_Arnold"); la base lo marca conectado, el abandono queda cubierto (`abandons=0,0`) y no hay derrota automática.
  - Moe vuelve y queda de espectador.
  - Quade se va y no vuelve: a los 2 minutos (`reconnect_minutes` en 2 para la prueba) abandona y se abre un pedido `auto`.
  - Se cancela la partida: la sala se cancela y el pedido abierto vence (sin token en claro).
- **No probado con bots:** el menú y el voto con jugadores de verdad (un bot no toca menús; en la build de pruebas los bots votan Sí solos), el bloqueo de `jointeam` (los bots no pasan por ese comando) y el `!gg` con un abandono cubierto. Quedan para el primer mix real con **Reemplazos** encendido.
- Comandos solo de la build de pruebas (`CSSTV_DEBUG`, no van en el `.smx` de los servidores): `sm_callreplace_as <bot> <nick o SteamID>` y `sm_mm_sides`.

## En qué se apartó del plan

- **Decisiones de Daniel (2026-11-05):** vota solo el equipo del que falta (no los dos), el reemplazo gana y pierde ELO normal (no hay `replace_protect_loss`) y el aviso usa el mismo webhook y rol que el de la cola.
- **El aviso lo publica el worker del matchmaking**, no la API: el abandono lo confirma `mm_tick`, sin un pedido de nadie. Por eso el worker necesita las variables de Discord.
- **El token se genera en la base** y se guarda en claro hasta que se publica (o vence); el plan decía guardar solo el hash, pero entonces el worker no podría armar el link.
- **"Cubierto" es cuando el reemplazo entró al servidor**, no cuando tomó el link: si lo toma y no entra, el abandono sigue contando.
- **El voto llega como evento de `csstv_mm_report` (`callreplace`)** y no como una función nueva `mm_replace_vote_passed`: ya tiene la clave del servidor y la búsqueda del jugador por SteamID.
- **El que tomó el link y no entró se sanciona** como quien no se conecta a su partida (el plan solo decía que se publicaba de nuevo).
- **Sumado:** `replace_vote=` en el poll (el plugin necesita el porcentaje, la duración y la espera), `away=` para el menú, el bloqueo de `jointeam` para los de afuera de la sala en vivo y los marcadores del manual.
- **Sin `requested_by`:** el plugin no manda quién pidió el voto.

## Incidentes durante las pruebas

- **Prueba con bots, 1.ª corrida (12 bien, 11 mal):** el script mandaba `sm_callreplace_as Arnold STEAM_0:1:…` sin comillas y la consola de Source corta los argumentos en los `:`. Se puso el SteamID entre comillas.
- **2.ª y 3.ª corridas:** dos detalles del plugin. El chat decía "volvió y sigue en…" en vez de "entró de reemplazo" (el plugin lo decidía según si el jugador tenía estadísticas en la partida, y al reemplazo se le crean al entrar): ahora recuerda quién entró al plantel con la partida en vivo (`g_sMmJoined`). Y un segundo `!callreplace` del mismo equipo pasaba en el servidor (la base lo rechazaba, pero el chat lo anunciaba): la espera del equipo corre desde que se pide el voto.
- **Sumado al probar:** un bot que vuelve entra directo a un lado, sin `jointeam`. Por eso, con la sala en vivo, cada segundo se pasa a espectador a quien no es de la sala (`Mm_LiveEnforce`). Solo si tiene un SteamID válido: si Steam todavía no lo validó, no se lo toca (podría ser uno de la sala).

- En `mm_replace_sweep`, el alias `x` de una subconsulta chocaba con la variable `x` de la función ("column reference is ambiguous"). Se renombró el alias.
- El texto del aviso borraba el `_` del mapa (`de_dust2` → `dedust2`) al limpiar el markdown. Ahora se escapa.

## Cómo revertir

- **Base:** `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/75_mm_reemplazos.sql` (se pierde quién reemplazó a quién).
- **Rápido, sin tocar la base:** apagar **Reemplazos** en Administración › Matchmaking.
- **Plugin:** volver al reporter 2.9.3 en los tres servidores (en el próximo cambio de mapa).
- **API, worker y web:** revert del commit y desplegar.

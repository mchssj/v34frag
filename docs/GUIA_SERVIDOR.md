# Guía de configuración: CSSTV Match Reporter

El plugin `csstv_reporter` maneja los mixes del servidor CS:S v34 (ready, LO3, medio tiempo, prórroga y fin) y, al terminar cada partida, envía el marcador y las estadísticas de cada jugador a la web. La web crea la partida en **Mixes** y actualiza los perfiles de los jugadores vinculados por SteamID.

```
Servidor CS:S v34                          Supabase                         Web
csstv_reporter.smx ──► cola local ──► ingest_server_chunk() ──► matches / stats / players ──► Mixes y perfiles
                         │
                         └──► csstv_uploader.py (alternativa si System2 no funciona)
```

## Contenido del repositorio

| Ruta | Qué es |
|---|---|
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Plugin compilado con SourceMod 1.8 |
| `server/addons/sourcemod/scripting/` | Código fuente (`csstv_reporter.sp` y `csstv/*.inc`) |
| `server/cfg/sourcemod/csstv_reporter.cfg` | Configuración del plugin |
| `server/cfg/csstv/warmup.cfg`, `live.cfg`, `end.cfg` | Configs que el plugin ejecuta en cada etapa |
| `server/uploader/` | Script alternativo de subida (Python 3) |
| `server/addons/sourcemod/extensions/accelerator.*`, `gamedata/accelerator.games.txt` | Accelerator 2.5.0 (crash handler, externo): ver [bitácora](bitacora/2026-10-14-crash-servidor-accelerator/). Inventario de todo lo externo en [PLUGINS_EXTERNOS.md](PLUGINS_EXTERNOS.md) |
| `supabase/migrations/20261011120000_csstv_match_reporter.sql` | Cambios en la base de datos |

## Requisitos

- Servidor CS:S v34 con **MetaMod:Source** y **SourceMod 1.8** funcionando (`sm version` responde).
- Acceso por FTP o SSH a la carpeta `cstrike/` del servidor.
- Una cuenta **admin** en la web.
- Para el envío directo: extensión **System2 v3.3.2**. Si no carga en v34, se usa el script de Python (paso 7).

---

## Paso 1. Aplicar la migración en Supabase

1. Entrá a https://supabase.com/dashboard/project/wmzfwsizashpszxlvpeb/sql/new
2. Pegá el contenido completo de `supabase/migrations/20261011120000_csstv_match_reporter.sql`.
3. Tocá **Run**. Tiene que terminar sin errores; los avisos `NOTICE` son normales.

La migración se puede volver a ejecutar sin problema. Crea la tabla `game_servers`, agrega `players.steam_id`, amplía `match_player_stats` y crea las funciones `ingest_server_chunk`, `ingest_server_match`, `link_steam_id`, `create_server_token` y `rotate_server_token`.

## Paso 2. Publicar la web actualizada

Subí el `index.html` nuevo al hosting. Agrega la sección **Mixes**, el scoreboard en el detalle de cada mix, las stats automáticas en el perfil y, para admins, **Admin → Servidores** y la lista **SteamID sin vincular** en Admin → Jugadores.

## Paso 3. Crear el servidor en la web y obtener el token

1. Entrá a la web con tu cuenta admin.
2. Abrí **Admin → Servidores**, escribí un nombre (por ejemplo "Servidor Mix #1") y tocá **Crear y generar token**.
3. Se muestran tres líneas listas para pegar:

   ```
   csstv_api_url "https://wmzfwsizashpszxlvpeb.supabase.co/rest/v1/rpc/ingest_server_chunk"
   csstv_api_key "eyJ..."
   csstv_server_token "csstv_..."
   ```

4. **Copialas ahora.** El token no se vuelve a mostrar. Si lo perdés, usá **Nuevo token** (el anterior deja de funcionar).

## Paso 4. Instalar System2

1. Descargá `system2.zip` de https://github.com/dordnung/System2/releases/tag/v3.3.2
2. Copiá su contenido sobre `cstrike/addons/sourcemod/`:
   - `extensions/system2.ext.so` (Linux) o `extensions/system2.ext.dll` (Windows)
   - `data/system2/ca-bundle.crt` (necesario para HTTPS)
3. Reiniciá el servidor y comprobá en la consola:

   ```
   sm exts list
   ```

   Tiene que aparecer **System2** sin error. Si no aparece o da error, seguí igual: el plugin funciona y deja los resultados en cola para el script del paso 7.

## Paso 5. Instalar el plugin

Copiá al servidor, respetando las carpetas:

| Desde el repositorio | Al servidor |
|---|---|
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | `cstrike/addons/sourcemod/plugins/` |
| `server/cfg/sourcemod/csstv_reporter.cfg` | `cstrike/cfg/sourcemod/` |
| `server/cfg/csstv/` (carpeta completa) | `cstrike/cfg/csstv/` |

Editá `cstrike/cfg/sourcemod/csstv_reporter.cfg` y pegá las tres líneas del paso 3 en lugar de `PEGAR_ANON_KEY` y `PEGAR_TOKEN`.

Ajustá `cfg/csstv/live.cfg` con tu config de mix habitual. **No cambies `mp_maxrounds`, `mp_winlimit` ni `mp_timelimit`**: el plugin los deja en 0 porque es el que decide cuándo termina la partida.

## Paso 6. Verificar

Reiniciá el servidor (o cambiá de mapa) y ejecutá en la consola:

```
sm plugins list            // debe figurar "CSSTV Match Reporter"
sm_csstv_status            // estado, modo de envío y archivos en cola
```

`sm_csstv_status` debe mostrar `Envío: System2`. Si muestra otra cosa:

| Mensaje | Qué hacer |
|---|---|
| `falta configurar csstv_api_url, csstv_api_key o csstv_server_token` | Revisá `csstv_reporter.cfg` y cambiá de mapa. |
| `System2 no disponible` | La extensión no cargó: usá el paso 7. |
| `desactivado (csstv_send 0…)` | Está configurado para usar el script de Python. |

### Partida de prueba con bots

Sirve para probar todo el circuito en pocos minutos. **Formato estándar de las pruebas:** mapa `$2000$` (es chico y las rondas se definen rápido) y equipos desparejos, con 3 bots de un lado y 1 del otro, para que un equipo gane casi siempre y no haya empates ni prórrogas largas.

Escribí en la consola del servidor (con el mapa `$2000$` ya cargado):

```
csstv_send 0
csstv_include_bots 1
csstv_min_players 2
csstv_abandon_players 0
csstv_maxrounds 4
csstv_overtime 0
csstv_lo3 0
csstv_end_delay 2
csstv_halftime_delay 1
csstv_abandon_seconds 5
csstv_pause_time 10
mp_freezetime 1
bot_kick
bot_join_after_player 0
mp_autoteambalance 0
mp_limitteams 0
bot_add_t
bot_add_t
bot_add_t
bot_add_ct
sm_live force
```

- **`csstv_send 0`:** el resultado queda en `data/csstv/queue/` y no se envía. Sacalo solo si querés probar el envío; el servidor local está conectado a la misma Supabase que la web.
- **Cambio de mapa:** vuelve a cargar `csstv_reporter.cfg` (con `csstv_send 1`) y manda lo que haya en la cola. Antes de cambiar de mapa, vaciá `data/csstv/queue/`. Mejor todavía, arrancá el servidor directamente en `$2000$` (ver abajo) y volvé a escribir las cvars.
- **Tiempos cortos:** en las pruebas ninguna espera pasa de 10 segundos (fin de partida, medio tiempo, abandono, pausas).
- **`csstv_abandon_players 0`:** con solo 4 bots, la cancelación automática por abandono (mínimo 4 jugadores) cortaría la prueba. Para probar justamente el abandono, ponela en 4.
- **Primera vez en un mapa con bots:** si el mapa no tiene `.nav`, el juego lo genera al agregar bots y recarga el mapa (con `$2000$` terminó en otro mapa). `$2000$.nav` ya está generado en el servidor de Daniel.
- **Partida corta sin tocar cvars:** `sm_live force mr2` (gana el primero en llegar a 3).

Después volvé a los valores normales:

```
csstv_include_bots 0
csstv_min_players 8
csstv_abandon_players 4
csstv_maxrounds 30
csstv_overtime 1
csstv_lo3 1
csstv_end_delay 15
csstv_halftime_delay 3
csstv_abandon_seconds 180
csstv_pause_time 60
bot_kick
mp_autoteambalance 1
mp_limitteams 2
```

## Paso 7 (alternativa). Script de subida sin System2

Si System2 no carga en v34, el plugin igual guarda cada resultado en `addons/sourcemod/data/csstv/queue/`. El script `csstv_uploader.py` los sube desde la misma máquina con Python 3.6 o superior.

1. En `csstv_reporter.cfg` poné `csstv_send "0"`.
2. Copiá `server/uploader/` a la máquina del servidor (por ejemplo `/home/srcds/csstv_uploader/`).
3. Copiá `csstv_uploader.ini.example` como `csstv_uploader.ini` y completá:
   - `api_base`: `https://wmzfwsizashpszxlvpeb.supabase.co` (sin `/rest/v1`)
   - `api_key`: la misma anon key
   - `server_token`: el token del paso 3
   - `data_dir`: ruta completa a `cstrike/addons/sourcemod/data/csstv`
4. Probalo una vez: `python3 csstv_uploader.py --config csstv_uploader.ini --once`

Para dejarlo siempre activo en **Linux** (systemd), creá `/etc/systemd/system/csstv-uploader.service`:

```ini
[Unit]
Description=CSSTV uploader
After=network-online.target

[Service]
User=srcds
WorkingDirectory=/home/srcds/csstv_uploader
ExecStart=/usr/bin/python3 csstv_uploader.py --config csstv_uploader.ini
Restart=always

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl enable --now csstv-uploader
journalctl -u csstv-uploader -f
```

En **Windows**, creá una tarea en el Programador de tareas que ejecute cada minuto:
`python csstv_uploader.py --config csstv_uploader.ini --once`

No uses el script y System2 a la vez sobre la misma cola.

---

## Uso diario

### Flujo de una partida

1. **Calentamiento.** Al cargar el mapa se ejecuta `cfg/csstv/warmup.cfg`. Cada 30 segundos el chat recuerda quién falta.
2. **Inicio.** Cuando todos los jugadores de CT y T escriben `!ready` (y hay al menos `csstv_min_players`), empieza solo, con ronda de cuchillo (desde la 1.8.0; `csstv_ready_knife 0` la saca). Un admin puede empezarla con `!live` (desde la 1.6.0, con los jugadores como estén, sin mínimo); con `!live mr3` (de `mr1` a `mr30`) la partida es más corta.
3. **Ronda de cuchillo (desde la 1.6.0).** Con `!live knife` (se combina: `!live knife mr4`) y, desde la 1.8.0, en el inicio por `!ready` (`csstv_ready_knife 1`, por defecto). Se juega una ronda solo con cuchillo, sin compras ni C4; el equipo que gana escribe `!stay` (se queda) o `!switch` (cambia de lado). Vale el primero que lo escribe; si nadie elige en `csstv_knife_time` segundos (60), se queda. No cuenta para estadísticas, marcador ni demo. `!live` solo **nunca** tiene cuchillo.
4. **LO3.** Se ejecuta `cfg/csstv/live.cfg` y tres reinicios. Desde la 1.6.0 cada equipo se llama **Equipo <nick>**, con el nick de un jugador al azar de ese lado (fijo toda la partida; también en la web). Internamente el equipo A es el que empezó de CT.
5. **Medio tiempo** (ronda 15). El plugin cambia de lado a todos (cada uno con el modelo equivalente del otro lado), reinicia la ronda y mantiene el marcador en el scoreboard.
6. **Fin.** Gana el primero en llegar a 16 (o a N+1 con `!live mrN`). Con empate se juega prórroga MR12 (configurable, y nunca más larga que el reglamentario), con dinero `csstv_ot_startmoney`, hasta que haya ganador.
7. **Resumen y envío.** Desde la 1.6.0 el chat muestra el resultado, el MVP (más kills; desempata el daño), el top 3 y, a cada jugador, sus números:
   ```
   [v34frag] Fin de la partida: Equipo daniloev 16 - 12 Equipo pepe. ¡Gana Equipo daniloev!
   [v34frag] MVP: daniloev (27 kills, 98 ADR)
   [v34frag] 1. daniloev  27/14/5  ADR 98  HS 52%
   [v34frag] Tu partida: 18/16/4 · ADR 82 · HS 44% · 3 primeras kills      ← solo vos
   ```
   El resultado se guarda en la cola y se envía. En el chat aparece "Resultado enviado a CSSTV". A los `csstv_end_delay` segundos (15) vuelve al calentamiento.

**Rendición (`!gg`, desde la 1.6.0).** El equipo que pierde por `csstv_gg_min_diff` rondas o más (8) puede rendirse: hace falta el voto de todos menos `csstv_gg_missing` jugadores del equipo (1, es decir 4 de 5) en 30 segundos. La partida termina en el momento como **terminada**: gana el que iba adelante, cuenta para el ELO y las stats como cualquier otra, y en la web lleva la etiqueta "Rendición". Con `csstv_gg_min_diff 0`, `!gg` queda desactivado.

**Reconexión (desde la 1.6.0).** Si alguien se cae durante la partida y vuelve a entrar, el plugin lo pone directamente en su equipo (lo reconoce por SteamID; respeta los cambios de lado). Si un admin lo había pasado a espectador, no.

**Partidas canceladas** (desde la 1.3.0). Una partida se cancela con `!cancelmatch`, al cambiar de mapa a mitad de partida, o sola por **abandono**: si en CT+T quedan menos de `csstv_abandon_players` jugadores (4) durante `csstv_abandon_seconds` seguidos (180), avisando antes en el chat. Si se jugó al menos una ronda, se envía como **cancelada** (motivo `admin`, `map_change` o `abandoned`), con su marcador parcial y su demo; no cuenta para el ELO ni para las stats del perfil. Sin rondas jugadas se descarta y la demo se borra.

### Durante la partida

Al empezar cada ronda, en el freezetime, el chat muestra (cada parte se apaga con su cvar):

```
[v34frag] Ronda 13/30 · Equipo daniloev (CT) 7 - 5 Equipo pepe (T)     ← todos (csstv_round_header)
[v34frag] Damage Given to "s1mple" - 100 in 3 hits                     ← solo vos, en verde (csstv_damage_report)
[v34frag] Damage Taken from "s1mple" - 27 in 1 hit                     ← solo vos, en rojo
[v34frag] Plata del equipo: $21.350                                     ← solo tu equipo, en verde (csstv_team_money)
[v34frag] s1mple $7.200 · fallen $5.900 · fer $4.100 · taco $3.350 · cold $800
```

- El TAB mantiene el marcador de rondas y las **kills y muertes de cada jugador** después del medio tiempo, en la prórroga y cuando alguien se reconecta (con SteamID válido).
- El encabezado avisa la **última ronda antes del cambio de lado** y el **match point**.
- **Colores** (`csstv_chat_colors`): quien usa ClientMod ve colores RGB (dinero y daño dado en verde, daño recibido en rojo, ronda y marcador en amarillo, CT celeste y T dorado). Con `1` (por defecto) se detecta con la API de ClientMod (`clientmod.smx`); quien no usa ClientMod ve solo el verde básico, para no recibir caracteres raros. `2` fuerza RGB para todos (útil en un servidor sin `clientmod.smx`, como el de prueba).
- **Prefijo** (`csstv_chat_tag`): `[v34frag]` por defecto. `cfg/csstv/warmup.cfg` tiene su propio `say "[CSSTV] …"`, que se cambia a mano.
- El daño cuenta solo a los rivales, con el daño real (sin pasar la vida que le quedaba) y la cantidad de golpes entre paréntesis.
- Al morir, el chat te dice quién te mató, con qué arma y cuánta vida y chaleco le quedan (`csstv_hp_on_death`). `!hp` lo repite.
- **Contador de vivos** (desde la 1.4.0, `csstv_alive_hud`): `CT 5 vs 4 T` fijo arriba al centro durante toda la partida, actualizado al instante en cada muerte. Con `2` se muestra en el centro de la pantalla, por si algún cliente no ve el de arriba.
- **Equipos bloqueados** (desde la 1.4.0, `csstv_lock_teams`): durante la partida, quien está en CT o T no puede cambiar de equipo (`M`); un admin lo mueve con `!team`. Elegir modelo estando vivo (por ejemplo, el menú que aparece en el medio tiempo) ya no deja muerto al jugador: el modelo se usa la próxima vez que aparezca.
- **Puntos de la bomba** (desde la 1.4.0, `csstv_bomb_frags`): el juego suma 3 puntos en el TAB a quien desactiva la bomba y a quien la plantó si explota; el plugin los descuenta para que el TAB muestre solo kills.
- **Créditos:** cada `csstv_credits_interval` segundos (720 = 12 minutos) el chat muestra `Plugin made by kyan & daniloev`.

### Pausa táctica

`!pause` pide una pausa para tu equipo. Si se pide en plena ronda, empieza en el freezetime de la siguiente. Mientras dura, la ronda no arranca, el reloj de la ronda no corre, el chat funciona y se puede comprar.

| `csstv_pause_mode` | Cómo termina |
|---|---|
| `0` | Pausas desactivadas |
| `1` | Sola, a los `csstv_pause_time` segundos |
| `2` | Cuando los dos equipos escriben `!unpause` |
| `3` | Lo que pase primero: el tiempo o `!unpause` de los dos equipos |

Cada equipo tiene `csstv_pause_max` pausas por partida. El equipo que pidió una pausa puede cancelarla con `!unpause` antes de que empiece. Un admin puede usar `!forcepause` (no cuenta para el límite y dura hasta `!forceunpause` o `!unpause` de los dos equipos) y `!forceunpause`. Al terminar una pausa, la ronda arranca a los 3 segundos.

Técnicamente, la pausa alarga el freezetime de la ronda (`m_fRoundStartTime`). No usa la pausa del motor (`pause`): en v34 no se puede activar desde el servidor y, pedida a través de un bot, tumba el servidor.

### Demos

Con `csstv_demo 1`, la SourceTV graba cada mix desde el "¡EN VIVO!" hasta el final en `cstrike/csstv_demos/<match_uid>.dem`. En Windows el motor guarda el nombre en minúsculas (`srv1-20261011t125908-2fff.dem`); en el servidor real (Linux) lo respeta. Un Worker de Cloudflare sube cada demo a R2 (ver [`docs/bitacora/2026-10-12-demos-r2-worker`](bitacora/2026-10-12-demos-r2-worker/)). Se conservan los últimos `csstv_demo_keep` y se borran los más viejos.

La SourceTV tiene que estar activa **desde que carga el mapa**. Agregá `+tv_enable 1` a la línea de arranque del servidor, antes de `+map`. Ponerlo en `server.cfg` no alcanza para el primer mapa. Si no está activa, el plugin lo anota en el log y sigue sin grabar.

Tamaño medido en el servidor de prueba: unos 4 KB por segundo con 6 bots (2,6 MB por un mix corto de 7 rondas). Con 10 jugadores y 30 rondas será bastante más; conviene medirlo con el primer mix real.

### Comandos

| Comando | Quién | Qué hace |
|---|---|---|
| `!ready` / `!unready` | Jugadores | Marcarse listo o no listo |
| `!score` | Todos | Marcador y ronda actual |
| `!hp` | Jugadores | Quién te mató en esta ronda y cuánta vida le queda |
| `!pause` / `!unpause` | Jugadores | Pedir una pausa táctica / seguir (o cancelar la que pediste) |
| `!gg` | Jugadores | Votar la rendición de tu equipo (si pierde por `csstv_gg_min_diff` rondas o más) |
| `!stay` / `!switch` | Jugadores | Después de ganar la ronda de cuchillo: quedarse o cambiar de lado |
| `!rtv` (o `rtv`) / `!unrtv` | Jugadores | En el calentamiento: pedir cambiar de mapa / quitar el pedido y el voto |
| `!vote <mapa>` / `!nominate <mapa>` | Jugadores | En el calentamiento: votar un mapa (acepta parte del nombre; sin mapa abre el menú) |
| `!mapas` / `!maps` | Jugadores | Menú con los mapas que se pueden votar y sus votos |
| `!status` | Todos | Cómo está configurada la partida: estado, formato, inicio, pausas, `!gg`, vínculo con la web y demo (desde la 2.0.0) |
| `!match <código>` | Inscritos de los dos equipos, o admin | En el calentamiento: vincular el mix a una partida de torneo o PCW de la web. Uno propone y alguien del otro equipo confirma con el mismo código; un admin vincula solo (desde la 2.0.0) |
| `!match` | Inscritos de los dos equipos, o admin | Desvincular. Si la partida ya empezó, al terminar se guarda como mix común (desde la 2.0.0) |
| `!forcepause` / `!forceunpause` | Admin | Pausa de admin / terminar cualquier pausa ya |
| `!live` | Admin | Empieza con los jugadores como están (sin mínimo de jugadores; `force` se acepta pero ya no hace falta) |
| `!live mrN` | Admin | Partida corta: gana el primero en llegar a N+1 |
| `!live knife` | Admin | Ronda de cuchillo antes del LO3; el ganador elige lado. Se combina: `!live knife mr4` |
| `!cancelmatch` | Admin | Cancela la partida; con al menos una ronda jugada la guarda como cancelada, con su demo |
| `!rr` | Admin | Repite la ronda actual: marcador, estadísticas, kills/muertes del TAB, plata y equipamiento vuelven a como estaban al empezarla. Usado después del fin de una ronda, repite esa ronda. No funciona en el LO3, el medio tiempo ni el cambio a prórroga |
| `!team <jugador> <ct\|t\|spec>` | Admin | Cambia de equipo a un jugador (nick, parte del nick o `#userid`) o a un grupo: `@all`, `@ct`, `@t`, `@spec`, `@alive`, `@dead`, `@humans`, `@bots` (ej.: `!team @all spec`). Si está vivo muere y aparece en la próxima ronda; la muerte del cambio no queda en el TAB. Un nick que coincide con varios jugadores no mueve a nadie |
| `!swap` | Admin | En el calentamiento: pasa los CT a T y los T a CT |
| `sm_csstv_status` | Consola / rcon | Estado, modo de envío, cola y último error |
| `sm_csstv_flush` | Consola / rcon | Reintenta ahora los envíos pendientes |
| `sm_csstv_retryfailed` | Consola / rcon | Devuelve a la cola los envíos rechazados |

**Menú de admin (desde la 1.6.0).** `sm_admin` (por ejemplo, con `bind h sm_admin`) tiene una categoría **v34frag** con las mismas acciones: iniciar partida (con o sin cuchillo y el formato), cancelar partida y repetir ronda (con confirmación), pausa de admin y quitar pausa, cambiar de equipo (todos / CT / T / espectadores / cada jugador → CT, T o espectador), intercambiar equipos y estado del plugin. Cada opción usa el permiso de su comando y se ve deshabilitada cuando no aplica. Las respuestas aparecen en el chat de quien usó el menú.

Para usar `!live`, `!cancelmatch`, `!rr`, `!team`, `!swap`, `!forcepause` y `!forceunpause`, el usuario tiene que ser admin de SourceMod con el flag `b` (generic). Se agrega en `addons/sourcemod/configs/admins_simple.ini`:

```
"STEAM_0:1:12345678"  "b"
```

### Vincular a un torneo o PCW (`!match`, desde la 2.0.0)

Cada partida de torneo y PCW de la web tiene un **código de 5 caracteres**, que ven solo los integrantes de los dos equipos (y los admins). Con ese código, el mix del servidor cuenta como un mapa de esa partida:

1. **Proponer.** En el calentamiento, un jugador **inscrito** en uno de los dos equipos (en su plantel de la web, con el SteamID vinculado) escribe `!match <código>`. El vínculo queda pendiente.
2. **Confirmar.** Un inscrito **del otro equipo** escribe el mismo `!match <código>`. Un admin puede vincular solo, sin confirmación.
3. **Armado.** El plugin pone a cada inscrito en el lado de su equipo y al resto en espectador. Los inscritos no pueden pasarse al rival; cada lado tiene tope de 5. Los stand-ins (jugadores que no están en el plantel) entran solos al lado de su equipo: hasta **2 por lado en una PCW** (con al menos 3 inscritos) y **ninguno en un torneo** (5 inscritos).
4. **Inicio.** `!ready` no arranca hasta que cada lado cumple su regla, y el chat dice qué falta. Solo cuentan los jugadores del plantel que están en ese lado: los suplentes que no juegan no importan. `!live` (admin) arranca igual, con un aviso. Un vínculo pendiente que nadie confirmó se descarta al empezar.
5. **Resultado.** El juego se guarda como siempre (mix con stats, demo y ELO) y además suma el mapa a la partida de la web. Si el juego no cumple las reglas (por ejemplo, un stand-in en un torneo), queda como mix común y la partida de la web no cambia.
6. **Series.** En un BO3 o BO5 el vínculo sigue en el mapa siguiente, con el marcador de la serie al día. Cuando la serie termina, el plugin desvincula solo.

`!match` sin código desvincula. Lo puede hacer un inscrito de cualquiera de los dos equipos o un admin, también durante la partida (entonces se guarda como mix común). `!status` muestra el vínculo y el código.

La consulta usa `csstv_match_lookup` de Supabase con el mismo token y la misma URL base que los envíos (`csstv_api_url`), por System2.

### Votación de mapa (desde la 1.7.0)

Solo en el calentamiento. Cuentan todos los jugadores humanos conectados, también los espectadores, y hace falta `csstv_rtv_ratio` de ellos (0.6: 6 de 10, 3 de 5).

- `!vote <mapa>`: si un mapa junta los votos necesarios, se cambia directo a los 5 segundos. Votar un mapa también cuenta como `!rtv`.
- `!rtv`: cuando `!rtv` + `!vote` juntan los votos necesarios, se abre un menú de 20 segundos para todos con los mapas más votados, mapas al azar hasta `csstv_rtv_options` (5) y "No cambiar de mapa". Gana la opción con más votos; en un empate, la que está más arriba.
- Si gana "No cambiar" (o nadie vota), los votos se borran y no se puede volver a votar por `csstv_rtv_cooldown` segundos (120). Tampoco se puede en los primeros `csstv_rtv_wait` segundos del mapa (30).
- Al empezar una partida se borran los votos y se corta la votación en curso. Mientras el mapa está por cambiar no se puede empezar una partida.
- `!vote` es también el comando de votación de admin de `basevotes.smx` (`sm_vote <pregunta>`): un admin con ese permiso lo sigue usando así cuando el argumento no es un mapa de la lista. `!votemap` de admin no cambia.

**Lista de mapas.** El plugin usa la sección `csstv` de `addons/sourcemod/configs/maplists.cfg` y, si no existe, el `mapcycle.txt` del servidor (sin el mapa actual ni los que no están en `maps/`). Para usar una lista distinta de la rotación:

```
"csstv"
{
	"file"		"addons/sourcemod/configs/csstv_maps.txt"
}
```

En el servidor real (2026-10-13) el `mapcycle.txt` tiene `$2000$`, `de_cache`, `de_cbble`, `de_dust2_ob`, `de_inferno`, `de_inferno_classic`, `de_mirage_rc1`, `de_nuke_old_blue_ep`, `de_season` y `de_tuscan`. `de_dust2` está en `maps/` pero no en la lista, así que no se puede votar (`!vote dust2` vota `de_dust2_ob`).

### Vincular jugadores con su perfil

Cada jugador se identifica por su **SteamID**. La primera vez que alguien juega, sus stats quedan guardadas sin perfil. Para asociarlas:

- **Admin → Jugadores → SteamID sin vincular**: elegí el jugador y tocá **Vincular**, o **Crear jugador** si todavía no existe. Si el nick coincide con un jugador existente, ya viene seleccionado.
- O en la ficha del jugador, completá el campo **SteamID** (acepta `STEAM_0:X:Y`, SteamID64 o el link del perfil).

Al vincular, todos los mixes anteriores de ese SteamID pasan al perfil y las stats se recalculan.

**Stats automáticas.** Rating, K/D, HS %, ADR, mapas, victorias y derrotas se calculan con los mixes del servidor. Si para algún jugador querés conservar valores cargados a mano, desmarcá **Stats automáticas** en su ficha. El rating es **HLTV Rating 1.0**.

Para borrar un mix de prueba, abrilo en la web con la cuenta admin y usá **Borrar este mix**.

---

## Dónde quedan los archivos en el servidor

```
addons/sourcemod/data/csstv/
├── queue/    pendientes de envío
├── sent/     enviados (respaldo; se pueden borrar)
└── failed/   rechazados por la web (token inválido o datos inválidos)

csstv_demos/   demos de SourceTV (en cstrike/, no en addons/)
```

Los errores se registran en `addons/sourcemod/logs/errors_*.log` y los eventos normales en `addons/sourcemod/logs/L*.log`.

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| El chat dice "Enviando…" pero nunca "enviado" | Sin conexión o Supabase no responde | `sm_csstv_status` muestra el error. Se reintenta solo (hasta cada 15 min) o con `sm_csstv_flush`. |
| Archivos en `failed/` con HTTP 401 | Token mal copiado o revocado | Generá un token nuevo en la web, actualizá `csstv_reporter.cfg`, cambiá de mapa y ejecutá `sm_csstv_retryfailed`. |
| HTTP 404 en el envío | La migración no está aplicada o la URL está mal | Aplicá el paso 1. La URL debe terminar en `/rest/v1/rpc/ingest_server_chunk`. |
| Error de SSL / certificado | Falta `data/system2/ca-bundle.crt` | Copialo desde el zip de System2. |
| El mapa termina solo a las 30 rondas | Alguna config pone `mp_maxrounds` o `mp_timelimit` | Sacalos de `server.cfg`, `live.cfg` y la config de mix. |
| La partida no empieza con `!ready` | Faltan jugadores o alguien no está listo | `!score` muestra cuántos están listos; un admin puede usar `!live`. |
| Un jugador aparece siempre "(sin perfil)" | SteamID no vinculado o SteamID inválido | Vinculalo en Admin → Jugadores. Si su SteamID figura como `NOSTEAM:…`, el servidor no le asigna un SteamID válido y no se puede vincular. |
| Después del medio tiempo nadie reaparece y la ronda no termina | Plugin 1.0.0: el cambio de lado dejaba a los jugadores sin modelo (los bots no eligen) | Actualizá a la 1.1.0, que les asigna el modelo equivalente. |
| No se graban demos | La SourceTV no estaba activa al cargar el mapa | Agregá `+tv_enable 1` a la línea de arranque. `status` debe mostrar una línea `sourcetv:`. |
| Stats del mismo jugador en registros distintos | El emulador del servidor le cambia el SteamID | Revisá la configuración del emulador no-Steam (RevEmu/ClientMod) para que el SteamID sea estable. |

## API de ClientMod

El plugin usa la API de ClientMod (`clientmod.smx`, de [clientmod.ru](https://clientmod.ru)) para saber qué jugadores usan ClientMod y mandarles colores RGB en el chat. Es **opcional**: sin ella, `csstv_reporter` funciona igual y todos ven los colores básicos.

### Qué tiene que haber en el servidor

| Archivo | Para qué | Servidor real |
|---|---|---|
| `addons/sourcemod/plugins/clientmod.smx` | La API (versión 1.7.1) | ✔ (instalado el 2026-10-11) |
| `addons/sourcemod/gamedata/clientmod.txt` | Direcciones del motor que usa la API | ✔ |
| Extensiones `game.cstrike`, `sdktools`, `sdkhooks` | Dependencias de la API | ✔ (vienen con SourceMod) |
| `addons/sourcemod/plugins/clientmod_deathnotice.smx` | Opcional: avisos de muerte de ClientMod | ✔ |

La API no usa archivo de configuración propio: sus cvars se ponen en `cfg/server.cfg` (o en un `.cfg` que se ejecute al cargar el mapa).

### Cómo detecta a los jugadores

Al conectarse, cada cliente ClientMod manda su versión en dos datos de usuario (`_client_version` y `~clientmod`). La API los lee y clasifica al jugador:

| Tipo | `CM_GetClientModAuth` | Colores en el chat de `csstv_reporter` |
|---|---|---|
| Cliente original de v34 | 1 | Básicos |
| ClientMod actualizado | 2 | RGB |
| ClientMod desactualizado (menor que `clientmod_client_version_min`) | 3 | RGB |

### Verificar que está funcionando

Después de reiniciar el servidor, en la consola del panel:

```
sm plugins list           // debe aparecer "ClientMod API" (1.7.1) y "CSSTV Match Reporter" (1.2.0)
clientmod_version         // 1.7.1
csstv_chat_colors         // 1 (automático)
```

Al entrar un jugador, con `clientmod_logging 1` (por defecto) el log de SourceMod registra `"<jugador>" auth with ClientMod …` u `Original client`.

Prueba en el juego: con ClientMod, el "Damage Taken" debe verse **rojo**. Si se ve en color normal, la API no está cargada (revisar `sm plugins list` y `sm plugins info clientmod`).

### Cvars útiles de la API

| Cvar | Default | Uso |
|---|---|---|
| `clientmod_private` | 0 | 0 entra cualquiera · 1 solo ClientMod actualizado · 2 ClientMod actualizado o desactualizado · -1 todos menos ClientMod desactualizado |
| `clientmod_client_version_min` | `3.0.1.1837` | Versión mínima para considerar "actualizado" |
| `clientmod_team_t` / `clientmod_team_ct` | vacío | Nombre de los equipos en el TAB y en los logs (por ejemplo `Equipo A` / `Equipo B`) |
| `se_scoreboard` | 0 | `2`: la plata de cada jugador se ve en el TAB, solo para sus compañeros (complementa el mensaje de plata) |
| `clientmod_logging` | 1 | Registrar el tipo de cliente de cada jugador |

`clientmod_private 1` haría que todos vean los colores RGB, pero deja afuera a quien no usa ClientMod: es una decisión del servidor, no del plugin.

## Servidores de prueba locales

Para probar cambios del plugin antes de subirlos al servidor real.

| Persona | Ruta | Estado |
|---|---|---|
| Daniel | `E:\CSS DEDICATED SERVER\server` (en su PC) | Listo: CS:S v34 con MetaMod, SourceMod y `spcomp.exe`. Ya tiene `csstv_reporter.smx` instalado. |
| Agus | — | Pendiente de configurar. Por ahora las pruebas se hacen en el servidor de Daniel. |

En el servidor de Daniel:

- **Arrancar:** `start_server.bat`. Abre `de_dust2` en el puerto 27016, con 20 jugadores, tickrate 66 y `-insecure`. El servidor escucha en la IP de Radmin VPN (`26.228.23.45:27016`), también para RCON.
- **Arrancar para pruebas:** `srcds.exe -console -game cstrike -port 27016 +maxplayers 20 +tv_enable 1 +map $2000$ -tickrate 66 -insecure`, y después las cvars de [Partida de prueba con bots](#partida-de-prueba-con-bots).
- **Plugin:** `cstrike\addons\sourcemod\plugins\csstv_reporter.smx`.
- **Compilador:** `cstrike\addons\sourcemod\scripting\spcomp.exe`.
- **Partida rápida:** seguí [Partida de prueba con bots](#partida-de-prueba-con-bots).

## Recompilar el plugin

Solo hace falta si se modifica el código. Se necesita el compilador de SourceMod 1.8 (`addons/sourcemod/scripting/spcomp`) y el include de System2 (`scripting/include/system2.inc` y la carpeta `system2/` del mismo zip).

```
spcomp csstv_reporter.sp -i<sourcemod>/scripting/include -i<system2>/scripting/include -o../plugins/csstv_reporter.smx
```

## Detalles técnicos

- **Envío en partes.** System2 limita el cuerpo de cada petición a 2048 bytes. El plugin codifica el resultado en base64 y lo manda en partes de 1400 caracteres a `ingest_server_chunk`. La base reconstruye el JSON cuando llega la última parte. El script de Python manda el JSON completo a `ingest_server_match`.
- **Duplicados.** Cada partida tiene un `match_uid` único; si se envía dos veces, la web devuelve la misma partida.
- **Seguridad.** El token se guarda en la base solo como hash SHA-256. Se puede revocar o cambiar desde Admin → Servidores sin tocar nada más.
- **Daño y asistencias.** El daño de cada golpe se limita a la vida que le quedaba a la víctima (para el ADR). Una asistencia es para el compañero que más daño le hizo a la víctima, si supera `csstv_assist_damage`.
- **Mixes en la web.** Cada mix crea dos equipos temporales (`kind = 'mix'`) que no aparecen en Equipos ni en el Ranking. En los mixes, el marcador guarda rondas (16-12), no mapas.

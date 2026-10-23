# Clips automáticos por partida: guía de implementación

## Estado

**Desplegado el 2026-10-23** en la Supabase real (migración, la aplicó Daniel), en el **servidor real** (reporter 2.5.0 genérico) y en **RBK** (2.5.0 licenciado), con `csstv_clips "1"` en el cfg de los dos. Se carga en el próximo cambio de mapa de cada servidor: no se recargó nada. Probado en local con bots y la Supabase local. El backend y el replanteo `26` salen con el corte. Falta verificar el primer mix real en cada servidor y que el frontend haga la galería.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261023120000_clips.sql` | Nueva: `matches.tickrate`, `match_clips`, `clip_config`, `clip_set_config`, `clip_type`, `match_clip_list`, `csstv_clips_save` y `csstv_after_ingest` con la llamada a los clips |
| `supabase/replanteo/26_clips.sql` y `supabase/replanteo/README.md` | Nueva: la vista con `steam_owner()` y el tope por ficha. Fila en el README |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/26_clips.sql` y `pruebas/26_clips.sql` | Inversa y pruebas de la `26` |
| `server/addons/sourcemod/scripting/csstv/clips.inc` | Nuevo: detección, tope de 60 y escritura en el JSON |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | 2.5.0: include, `Clips_Init`, ganchos en la muerte, el fin de ronda (antes de `FinishMatch` y de la foto en vivo), el inicio de ronda, la desconexión, `ResetMatch` y el inicio del vivo |
| `server/addons/sourcemod/scripting/csstv/json.inc` | `tickrate` y `clips` al final del JSON |
| `server/addons/sourcemod/scripting/csstv/rr.inc` | La foto de `!rr` guarda la cantidad de registros y la restaura |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | 2.5.0 genérico, 116 363 bytes, md5 `494f6c54d5c3ffd916e3cb795767398d`. `spcomp` 1.8 del servidor local, sin errores ni avisos |
| `server/licencias/rbk/csstv_reporter.smx` (no se versiona) | 2.5.0 licenciado de RBK, 116 417 bytes, md5 `5d8a537907ce8c64b67062152b0f70c8` |
| `server/cfg/sourcemod/csstv_reporter.cfg` | `csstv_clips "1"` |
| `web/backend/src/routes/clips.ts`, `src/schemas/clips.ts` y `src/app.ts` | Nuevos endpoints, montados después de `matches` |
| `web/backend/src/db/types.ts` | Regenerado: solo suma lo de los clips y `matches.tickrate` |
| `web/backend/test/unit/clips-routes.test.ts` y `test/integration/clips.test.ts` | 6 y 5 pruebas |
| `docs/frontend/contrato/` (`partidas.md`, `admin.md`, `README.md`, `decisiones.md`) | Sección 8g, "Clips (admin)", novedades y 6 decisiones |

## Despliegue (hecho el 2026-10-23)

1. **Migración:** Daniel la aplicó en el SQL Editor. Verificado con lecturas públicas: `clip_config` con los valores de fábrica, `match_clip_list` responde y `matches.tickrate` existe.
2. **Builds:**
   ```bash
   cd server/addons/sourcemod/scripting && "$SPCOMP_DIR/spcomp.exe" csstv_reporter.sp -i"$SPCOMP_DIR/include" -o"../plugins/csstv_reporter.smx"
   server/build_licenciado.sh be0fd76c-6bdc-477e-a843-6efc309b5ca9 rbk
   ```
3. **Servidores:** [`pruebas/desplegar_clips.py`](pruebas/desplegar_clips.py), con `paramiko` en un entorno virtual aparte (en el scratchpad de la sesión). Primero `inspect`: comprobó que los dos tuvieran la 2.4.1 (md5 `3a539a8e…` en el real y `9762bc2b…` en RBK, los del 2026-10-22). Después `apply`:

   | | Servidor real (`SFTP_CSS_*`) | RBK (`SERVER1_*`) |
   |---|---|---|
   | Plugin | 2.5.0 genérico, md5 verificado al volver a bajarlo | 2.5.0 licenciado, md5 verificado |
   | Anterior | `plugins/disabled/csstv_reporter_2.4.1.smx` | Igual |
   | `disabled/` | Se borró la 2.3.0; quedan 2.3.1, 2.4.0 y 2.4.1 | Igual |
   | `cfg/sourcemod/csstv_reporter.cfg` | `csstv_clips "1"` (con su comentario) después de `csstv_live`, verificado al volver a bajarlo | Igual |

   Los cfgs originales quedaron solo en local (`respaldo_clips_2026-10-23/` del scratchpad), porque tienen el token.
4. **No se recargó el plugin** en ningún servidor: se carga en el próximo cambio de mapa.
5. **Backend y replanteo `26`:** salen con el corte, como el resto de `web/backend`.

**Falta verificar en cada servidor**, después del cambio de mapa:
- `sm plugins list` con la 2.5.0.
- En el primer mix real, registros en `match_clips` y `tickrate` en la partida (`select tickrate, (select count(*) from match_clips c where c.match_id = m.id) from matches m order by played_at desc limit 5`).
- En RBK, por SFTP, `addons/sourcemod/logs/` sin errores de `csstv_reporter`.

## Pruebas

### Base de datos (Supabase local)

- [`pruebas/pruebas_db.sql`](pruebas/pruebas_db.sql), sobre el esquema de producción (`REPLANTEO=0 pnpm db:reset`): **40 pruebas, todas OK**. Cubren la clasificación, ticks y tickrate, el formato STEAM_0 a SteamID64, el reenvío sin duplicados, el resultado sin clips (plugin viejo), 11 registros inválidos descartados sin tirar la ingesta, los topes y el desempate, el cambio de escala y sus validaciones, la caída cerrada por el admin, la caída mandada por el plugin, el borrado en cascada y los permisos de `anon`. También pasan sobre la base con todo el replanteo.
- La migración se puede volver a correr. Con el replanteo completo encima, la `16` sigue encontrando su fragmento en `csstv_after_ingest`.
- Replanteo `26`, con los pasos de `correr.sh` hechos a mano: 9 pruebas OK, una segunda aplicación aborta, la inversa deja la estructura idéntica y se vuelve a aplicar.

### Plugin (servidor local con bots 5v5 y la Supabase local)

Build de depuración 2.5.0 con el cfg apuntado a la base local (servidor `tok-servidor-local`). El log del servidor llegó por `logaddress` a un receptor UDP, y [`pruebas/control_log.py`](pruebas/control_log.py) recalculó con él las kills y los clutches de cada ronda para compararlos con `match_clips`.

| Caso | Resultado |
|---|---|
| Mix MR6 (12 rondas, 6-6) | **5 de 5 registros iguales al log**, ticks en orden. Incluye un 1v4 ganado sin kills (la bomba explotó con el último T vivo) |
| Prórroga (MR1 con dos prórrogas de 2 rondas, 4-2) | **8 de 8**, con clips en las 4 rondas de prórroga. Incluye un 1v5 ganado sin kills, un 1v2 con 2 kills y clutches perdidos con 3 y 4 kills (se guardan por las kills) |
| `!rr` justo después de una ronda con un 1v1 | El clip de la ronda anulada no está en la foto siguiente ni en el resultado |
| Caída (`taskkill` de `srcds` con un ace en la foto) | Llegó como `cancelled` / `crash`, con su fila en `match_crashes`. El ace, con los mismos ticks, se muestra en el listado |
| `csstv_clips 0` | Sin la clave `clips` y con `tickrate` 66. Ningún clip |
| Buffer lleno (build de prueba con `JSON_MAX` 3600) | JSON válido sin clips, partida guardada y aviso "los 6 clips no entran en el resultado" en el log de errores |
| Foto en vivo | Trae `tickrate` y `clips` (4,5 KB con 5 clips) |
| Tamaño | Unos 2,9 KB sin clips para 10 jugadores, y unos 200 bytes por clip (el buffer es de 64 KB) |
| Ticks contra el `.dem` | La cabecera da 58 417 ticks en 885,1 s (66 por segundo, igual que el plugin). El inicio coincide con unos 2,5 s de diferencia, con una medición aproximada: el log tiene resolución de 1 s y el primer mix corrió con `host_timescale 4` |

**No se probó:**
- Un jugador que se desconecta en medio de la ronda.
- El reemplazo de registros cuando se llega al tope de 60.

**Limpieza:**
- El servidor local quedó apagado, con el cfg, el `.smx` y `license.txt` restaurados (el md5 coincide con el respaldo).
- Se borraron los 6 resultados de prueba de `sent/` y sus 6 demos. `queue/` y `live/` quedaron vacías.
- La base local quedó otra vez con el replanteo.

### Backend

- `pnpm typecheck` sin errores.
- `pnpm test`: **290** pruebas unitarias, todas OK (6 nuevas: validación del listado y de la configuración, armado de cada clip y lo que se le pide a la base).
- `pnpm test:int`: **103** pruebas de integración, todas OK (5 nuevas). Cubren el orden y el tope por ficha con un SteamID adicional, el bot, el SteamID sin ficha, los filtros, la paginación, el orden por ronda, `404`, los permisos y el cambio de escala al instante.

## En qué se apartó del plan

- **El tope por jugador cuenta por ficha** (replanteo `26`). El plan solo pedía encontrar la ficha con `steam_owner()`. Con varios SteamID por ficha, un jugador podía llegar a 4 clips en una partida.
- **La vista devuelve enteros normales** (`round`, `round_seconds`, `clutch_vs`, `tickrate`) en lugar de `smallint`. Así es más simple para los tipos del backend.
- **El tick base se toma en `csstv_reporter.sp`**, junto a `Demo_Start()` y en el mismo cuadro, y no dentro de `qol.inc`. Así también hay base sin demo.
- **Margen del buffer de 128 bytes.** Deja lugar para el texto que agrega `Live_Recover` al pasar una foto a cancelada por caída.
- **`demo_seconds` en la API:** un campo derivado (primer tick / tickrate) para que la web muestre el momento de la demo sin hacer cuentas.
- **El clutch exige que el equipo haya tenido compañeros vivos en la ronda.** Así un jugador que empieza la ronda solo no cuenta como clutch.

## Incidentes durante las pruebas

- **El control contra el log**, en sus primeras versiones:
  - No encontraba el inicio de la partida: el log llega en Latin-1 y el chat de SourceMod no viaja por `logaddress`.
  - No conocía el equipo de un jugador que no había aparecido antes del `sm_live`.
  - Contaba la ronda de calentamiento posterior.

  Los tres eran errores del control. El plugin acertó en todos los casos.
- **El log en archivo del servidor quedaba vacío** mientras corría, así que se usó `logaddress` con un receptor UDP.
- **`host_timescale 4` no aceleró las rondas** de forma visible, y distorsionó la medición de los ticks contra la hora del log.
- **La suite `correr.sh` del replanteo se corta en la `23`** (`!whois`). La prueba espera `player_nick = 'Ficha23'`, pero desde la `09` el nick de una ficha vinculada a un usuario es su alias (`Alias23`). No tiene relación con los clips. La `26` se probó a mano con los mismos pasos. Anotado en `docs/PENDIENTES.md`.

## Cómo revertir

1. **Plugin, en cada servidor:** volver a la 2.4.1 desde `plugins/disabled/csstv_reporter_2.4.1.smx` (en RBK es la licenciada) y sacar `csstv_clips` del cfg. Se carga en el próximo cambio de mapa. Para apagar sin cambiar el plugin: `csstv_clips "0"` en el cfg.
2. **Replanteo:** `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/26_clips.sql`.
3. **Base:** volver a crear `csstv_after_ingest` como en `20261017120000_mixes_en_vivo.sql` y después `drop view match_clip_list; drop function csstv_clips_save(uuid, jsonb), clip_set_config(jsonb, integer, integer, integer, integer, integer), clip_type(integer, smallint, boolean, jsonb); drop table match_clips, clip_config; alter table matches drop column tickrate;`. Se pierden los clips guardados.
4. **Backend:** revertir el commit (sale con el corte).

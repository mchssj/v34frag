# Mixes en vivo y mixes interrumpidos: guía de implementación

## Estado

Hecho y **probado en local** el 2026-10-17: servidor dedicado local con bots y la Supabase local.

**Desplegado el 2026-10-17** (pedido de Daniel): la migración en la base de producción, `index.html` en la web y el plugin 2.1.0 en el servidor real y en RBK. El plugin se carga en el próximo cambio de mapa de cada servidor; falta verificarlo ahí. Sin commit.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261017120000_mixes_en_vivo.sql` | Nuevo: `live_matches`, `match_crashes`, `crash` en `cancel_reason` y `end_reason`, `ingest_server_chunk` e `ingest_server_match` redefinidas, `csstv_live_upsert`, `csstv_after_ingest`, `live_match_close`, `elo_crash_apply`, `elo_crash_discard` y `crash_min_rounds` |
| `server/addons/sourcemod/scripting/csstv/live.inc` | Nuevo: foto por ronda, envío, recuperación al cargar, `csstv_live` y línea de estado |
| `server/addons/sourcemod/scripting/csstv/json.inc` | `Json_BuildPayload(..., liveSeq)`: `"status":"live"` y `"live_seq"` |
| `server/addons/sourcemod/scripting/csstv/http.inc` | La cola manda la foto cuando no hay resultados; respuesta y errores de las fotos |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | 2.1.0: `Live_Init`, foto en `OnRoundCompleted`, `Live_Discard` en `FinishMatch` y `CancelMatch`, `Live_Reset` en `ResetMatch`, línea de `sm_csstv_status` |
| `server/cfg/sourcemod/csstv_reporter.cfg` | `csstv_live "1"` |
| `index.html` | Sección "En vivo" en Mixes (refresco cada 20 s), etiquetas "Interrumpida" y "ELO pendiente", texto del estado en el detalle, y "Mixes interrumpidos" en Admin → Servidores |
| `supabase/replanteo/04_mixes_bandos.sql` | `elo_crash_apply` pasa a `winner_side` (si existe la función) |
| `supabase/replanteo/06_vistas_stats.sql` | `elo_crash_apply` sin `recompute_player_stats` (si existe la función). Sin esto la 06 aborta |
| `supabase/replanteo/10_partidas_torneos.sql` | `matches_end_reason_check` con `crash` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/04`, `06` y `10` | Las inversas de esos tres cambios |
| `docs/GUIA_SERVIDOR.md` | Carpeta `live/` y párrafo de los mixes en vivo |
| `docs/bitacora/2026-10-17-mixes-en-vivo/pruebas/` | `pruebas_db.sql` (44 casos), `pruebas_db_replanteo.sql` (esquema del corte) y `lib.sh` (bots) |

## Despliegue (hecho el 2026-10-17)

Daniel eligió subir la 2.1.0 tal cual (con `!match` y `!status`, que no funcionan del todo hasta el corte) y correr él la migración.

**Lo que se hizo, en este orden:**

1. **Base:** Daniel corrió la migración en el SQL Editor. Verificación por la API pública:
   - `live_matches` y `match_crashes` responden 200.
   - `crash_min_rounds(24)` da 9.
   - `elo_crash_apply` como anon da "permission denied".
   - `ingest_server_chunk` con un token falso da `PT401`.
2. **Web:** `index.html` subido por FTP (`FTP_WEB_*`, `htdocs/`) y vuelto a bajar: idéntico, md5 `d3e15578…`.
   - Antes se comprobó que el publicado era idéntico al de `HEAD` (no había cambios hechos por fuera).
   - Respaldo del anterior en la carpeta temporal de la sesión; es el `index.html` de `HEAD`.
   - `config.js` no se tocó.
3. **Chequeo de `sm_status`:** ninguno de los plugins de los dos servidores lo registra (con `smx_grep.py`).
4. **Plugin 2.1.0:**
   - Compilado con el `spcomp` 1.8 del servidor local, sin `CSSTV_DEBUG`.
   - Antes de tocar nada, el script comprobó que cada servidor tuviera la 1.8.0 esperada.

   | Servidor | Acceso | Build | md5 subido | Respaldo |
   |---|---|---|---|---|
   | Servidor real | `SFTP_CSS_*` | genérico, 98522 bytes | `857e040f29267b442e170e8a9cf75f66` | `plugins/disabled/csstv_reporter_1.8.0.smx` (md5 `750b78fc…`) |
   | RBK | `SERVER1_*` | licenciado (`build_licenciado.sh be0fd76c-… rbk`), 98578 bytes | `928d8a19f2c562113b7f3e3bd4bf7981` | `plugins/disabled/csstv_reporter_1.8.0.smx` (md5 `2830de86…`) |

   No se recargó nada: cada servidor carga la 2.1.0 en su próximo cambio de mapa.

**Falta:**
- **En cada servidor**, después del cambio de mapa:
  - `sm_csstv_status` muestra `v2.1.0` y "Fotos en vivo: activadas".
  - En el primer mix, la sección "En vivo" de la web se actualiza.
- **Publicar** `CHANGELOG_DISCORD.txt`.
- **Esquema:** actualizar `supabase/schema/` con `volcar.sh 20261017120000`. Necesita las `PG_*` corregidas del `.env`.

**Pasos de referencia, con el orden original:**

1. **Base de producción:** `supabase/migrations/20261017120000_mixes_en_vivo.sql` en el SQL Editor. Es re-ejecutable. Necesita `20261015210000_elo_ajustes.sql`, que ya está aplicada. Después, actualizar `supabase/schema/` con `volcar.sh 20261017120000`.
2. **Web:** publicar `index.html`. Tiene que ir **después** de la migración: sin las tablas, la web muestra "Error cargando live_matches".
3. **Plugin 2.1.0:**
   - Compilar sin `CSSTV_DEBUG` con el `spcomp` 1.8.
   - **Nuestro servidor:** el `.smx` genérico por `SFTP_CSS_*`, dejando la versión anterior en `plugins/disabled/`.
   - **RBK:** su build licenciado (`server/build_licenciado.sh <license_key> rbk`) por `SERVER1_*`.
   - Las dos subidas van en la misma tanda.
   - No recargar el plugin con un mix en curso: se carga en el próximo cambio de mapa. Con la 2.1.0 una recarga ya no pierde el mix, pero lo corta.
   - **Ojo:** la 2.1.0 incluye la 2.0.0 (`!match` y `!status`). Si se despliega antes del corte, `!match` no funciona con la base vieja (le falta `csstv_match_lookup`, de la `07`). Hay que decidir si se sube antes del corte o junto con él.
4. **Verificar:**
   - `sm_csstv_status` muestra `v2.1.0` y "Fotos en vivo: activadas".
   - Durante el primer mix, la sección "En vivo" de la web se actualiza en cada ronda.
5. **Changelog:** `CHANGELOG_DISCORD.txt` de esta carpeta.

## Pruebas

### Base de datos (Supabase local, esquema de producción sin el replanteo)

`pruebas/pruebas_db.sql`, 44 casos, todos bien:
- **Fotos:** se guardan y se actualizan; una vieja no pisa a una nueva; se rechazan los uid sin `_v<seq>` o con otro seq; no quedan partes; una foto tardía no revive el mix.
- **Resultado final:** borra la foto y aplica el ELO.
- **Caída por el plugin y por el uploader:** queda cancelada con `crash`, en revisión y sin ELO; un reenvío no duplica.
- **35 %:** el mínimo da 9, 11 y 3 para MR24, MR30 y MR3. Se rechazan 8 de 24 rondas y el empate. Con 9 de 24 se aplica: terminado por caída, gana el que iba adelante y suma.
- **Revisión:** no se aplica dos veces; descartar funciona y no se puede repetir.
- **Cerrar como caída:** no deja con un mix vivo; con 11 minutos sin fotos cierra; el plugin después no duplica.
- **Recálculo completo:** da lo mismo e incluye el aprobado.
- **Cancelada por admin:** sigue igual.
- **Permisos:** anon solo lee; un usuario común no puede aplicar, descartar ni cerrar.

`pruebas/pruebas_db_replanteo.sql` (esquema del corte, replanteo 01 a 15): foto, caída con los bandos en la partida, y aprobación con `winner_side = 1` y el ELO para el bando correcto. Bien.

**Replanteo:** con la migración nueva cargada, `pruebas/correr.sh` de la bitácora del replanteo dio "Todo ok": las 15 migraciones, su segunda aplicación y sus inversas con la estructura idéntica. Las 73 pruebas de integración del backend (`pnpm test:int`) pasan.

### Plugin (servidor local con bots y la Supabase local)

- **Preparación:**
  - Build de depuración 2.1.0 en el servidor local, con el cfg apuntado a la Supabase local (URL `http://127.0.0.1:54321`, anon key local y token `tok-servidor-local`).
  - Base local con `REPLANTEO=0 pnpm db:reset`.
  - Mixes MR5 (`sm_live force mr5`) en `$2000$` con 3 bots contra 1 (`lib.sh`, función `setup`).

| Caso | Resultado |
|---|---|
| Mix normal | 5 fotos (seq 1 a 5, de 0-1 a 0-5); el final quedó `finished` 0-6 con ELO para los 4; la fila en vivo se borró; `live/` vacío; sin partes sueltas |
| Caída (`taskkill /F` de `srcds` con 4-0 y seq 4) | La foto quedó en `live/` y la web la seguía mostrando en vivo. Al volver a arrancar: "Partida … interrumpida…", el resultado llegó como `cancelled` / `crash` 4-0 con `match_crashes` (10 rondas, `plugin`) y la fila en vivo se borró |
| Recarga del plugin con un mix en curso (0-2) | Quedó interrumpido igual (antes se perdía) |
| Servidor que no vuelve (0-3, fila envejecida 11 minutos en la base) | La web lo muestra atenuado ("hace 11 min") y el admin ve "Cerrar como caída". Al cerrarlo queda interrumpido (`admin`). Al volver a arrancar el servidor, el plugin mandó su foto como caída y la base devolvió la misma partida (sin duplicado) |
| `!rr` después de la ronda 2 (0-2 → 0-1) | La foto siguiente (seq 3) se aceptó con 0-2 |
| `sm_cancelmatch` con 0-2 | `cancelled` / `admin`, sin fila de interrumpido; la foto se borró |
| `csstv_live 0` | Con 0-2 no hubo fotos ni archivos en `live/`; `sm_csstv_status` dice "apagadas" |

### Web (copia local de `index.html` contra la Supabase local, Chrome headless)

No había Claude in Chrome en la sesión. Se sacaron capturas con Chrome headless de una copia en una carpeta temporal, con un `config.js` local y la sesión de un admin local inyectada:

- **Mixes:** la sección "En vivo" con el mix en curso. En la lista, los interrumpidos con "Interrumpida" y "ELO pendiente", y el colgado atenuado.
- **Admin → Servidores → Mixes interrumpidos:**
  - El 0-2 muestra "no llega al 35 %: faltan 2 rondas".
  - El 4-0 tiene "Aplicar ELO".
  - El colgado tiene "Cerrar como caída".
- **Acciones:** se probaron con las mismas llamadas RPC que hace la web, autenticado como el admin local:
  - Aplicar el 0-2 da el error del 35 %.
  - Aplicar el 4-0 lo deja terminado con ELO.
  - El 0-2 se descartó y el colgado se cerró.

**No se probó en el navegador:**
- Los clics en los botones, porque abren `confirm()`.
- El detalle "Ver" de las estadísticas parciales.
- El refresco cada 20 segundos.
- El estilo del botón deshabilitado, que se cambió después de las capturas.

La sintaxis del JavaScript se revisó con `node --check`.

Al terminar:
- Se restauraron en el servidor local el cfg, el `.smx` 1.7.0 (83946 bytes, md5 `5ca8c752…`) y `license.txt`, y se borraron los resultados de prueba de `sent/`.
- El servidor local quedó apagado.
- La base local quedó otra vez con el replanteo.

## En qué se apartó del plan

- **Replanteo:** el plan dejaba la adaptación para el corte. Hubo que hacerla ahora porque la `06` aborta si alguna función usa `recompute_player_stats`, así que sin el cambio no se podía cargar la base local del backend. Además, después de la `04` el aprobado habría contado como empate (los mixes ya no tienen `team1` y `team2`), y la `10` redefinía `matches_end_reason_check` sin `crash`. Se hizo con el mismo mecanismo de reemplazos del replanteo, condicionado a que exista `elo_crash_apply`, y con sus inversas.
- **`csstv_after_ingest`:** el plan hablaba de `csstv_mark_crash`. Quedó un solo paso posterior a `csstv_ingest`, que además borra la foto en vivo.
- **Columna "Rondas":** muestra las rondas jugadas de las del mix ("3 de 10") y no "Ronda N", que confundía.

## 2.1.1: reinicio desde el panel (2026-10-17)

**Problema:** Daniel reinició el servidor real desde el panel en medio de un mix de prueba (0-2). Quedó "cancelada por cambio de mapa" y no apareció para revisar el ELO. Pasa porque un apagado ordenado (`quit`) termina el mapa, y la 2.1.0 cancelaba el mix por cambio de mapa en `OnMapEnd` y borraba la foto.

**Arreglo:**
- En `CancelMatch("map_change")`, si hay foto, el resultado se guarda como `live/<uid>.mapchange` y la foto se conserva (`Live_DeferMapChange`).
- `OnMapStart` lo pasa a la cola (`Live_FlushMapChange`).
- Si el proceso se cierra antes, `Live_Recover` borra el `.mapchange` y recupera la foto como caída.

**Probado en local** (servidor dedicado, base local con el esquema del corte):

| Caso | Resultado |
|---|---|
| `changelevel` con 0-2 | `cancelled` / `map_change`, sin fila de interrumpido, `live/` vacío |
| `quit` por RCON con 0-3 (lo mismo que el panel) | Al apagarse quedaron la foto y el `.mapchange`. Al volver: "interrumpida (caída o reinicio…)", `cancelled` / `crash` 0-3 con `match_crashes` (10 rondas, `plugin`); `live/` y la cola vacíos |

**Builds 2.1.1:**
- Genérico: md5 `d96245b1b41d68966402f1f594af9e93`.
- RBK licenciado: md5 `f3f684f83741a845e0a7cee50674a932`.

Sin depuración.

**Subida el 2026-10-17**, a los dos servidores en la misma tanda:
- Servidor real por `SFTP_CSS_*`; RBK por `SERVER1_*`.
- El script comprobó antes que cada uno tuviera la 2.1.0 subida ese día, y la movió a `plugins/disabled/csstv_reporter_2.1.0.smx`.
- Los md5 de lo subido coinciden con los builds.
- No se recargó nada: se carga en el próximo cambio de mapa.
- La 1.8.0 sigue en `plugins/disabled/csstv_reporter_1.8.0.smx`.

## Cómo revertir

Está desplegado desde el 2026-10-17. Para volver atrás:
- **Base:**

  ```sql
  begin;
  -- Los interrumpidos aprobados vuelven a cancelados (y hay que recalcular el ELO: elo_recompute_all()).
  update matches set status = 'cancelled', end_reason = null, winner = null, cancel_reason = 'admin'
   where end_reason = 'crash';
  update matches set cancel_reason = 'admin' where cancel_reason = 'crash';
  drop function if exists public.elo_crash_apply(uuid), public.elo_crash_discard(uuid), public.live_match_close(text),
    public.csstv_after_ingest(uuid, jsonb, text), public.csstv_live_upsert(uuid, text, jsonb), public.crash_min_rounds(integer);
  drop table if exists public.match_crashes, public.live_matches;
  alter table public.matches drop constraint matches_cancel_reason_check;
  alter table public.matches add constraint matches_cancel_reason_check
    check (cancel_reason is null or cancel_reason in ('admin', 'map_change', 'abandoned'));
  alter table public.matches drop constraint matches_end_reason_check;
  alter table public.matches add constraint matches_end_reason_check check (end_reason is null or end_reason = 'surrender');
  commit;
  ```

  Después, volver a crear `ingest_server_chunk` e `ingest_server_match` como en `supabase/schema/public.sql`.
- **Web:** publicar el `index.html` anterior.
- **Plugin:** en los dos servidores, volver a poner `plugins/disabled/csstv_reporter_2.1.0.smx` (sin el arreglo del reinicio) o `plugins/disabled/csstv_reporter_1.8.0.smx` (sin mixes en vivo) como `plugins/csstv_reporter.smx`. Se carga en el próximo cambio de mapa. El de RBK es su build licenciado; no mezclarlos. Sin bajar el plugin, `csstv_live 0` apaga las fotos al instante.

# Grabación automática de los clips (fase C2): guía de implementación

## Estado

Implementado y probado en local el 2026-10-23: la base (Supabase local), el Worker (`wrangler dev`), el backend y `procesar.py` de punta a punta con la grabación simulada y subidas reales a R2. **Nada desplegado.** Falta, en este orden:

1. La prueba con el juego de verdad.
2. Desplegar el Worker de clips.
3. Google Drive.
4. La migración en producción y el token.
5. La tarea programada.
6. El portátil.

Sin commit.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261023180000_clips_video.sql` | Nueva: columnas del video en `match_clips`, `clip_video_trash`, `render_workers`, el trigger `match_clips_video_guard`, `render_auth`, `create_render_worker_token`, `csstv_clips_save` (actualiza en vez de recrear), las funciones del render, `match_clip_list` con el video y los permisos |
| `supabase/replanteo/26_clips.sql` y `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/26_clips.sql` | La vista suma las columnas del video (si no, la `26` no se puede aplicar sobre la migración nueva) |
| `render/procesar.py` | Nuevo: lo que corre la tarea |
| `render/render_clip.py` | `record_session` (varias jugadas por sesión, saltos hacia atrás, medio segundo de más al principio) y `encode`. La elevación sirve para otro script. El modo de una jugada queda para pruebas |
| `render/leer_demo.py` | Nombre y SteamID de cada kill en ese momento, historial de nombres por SteamID (`name_at`), `victim_steamid` |
| `render/r2.py` | `head` (verificar el tamaño), tiempo de espera de 300 s |
| `render/drive.py`, `render/drive_login.py` | Nuevos: Google Drive |
| `render/instalar_tarea.ps1` | Nuevo: la tarea programada |
| `render/config.example.json`, `render/.gitignore` | Claves nuevas (1080p, `lead_seconds`, `demo_worker_url`, `r2_days`, `max_matches_per_run`, `drive`); `ultimo_procesar.log` |
| `cloudflare/clips-worker/` | Nuevo: Worker de clips (`src/index.js`, `wrangler.toml`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) |
| `web/backend/src/env.ts` | `CLIPS_BASE_URL` (opcional) |
| `web/backend/src/schemas/clips.ts`, `src/routes/clips.ts` | `video` en cada clip |
| `web/backend/src/db/types.ts` | Regenerado: solo suma lo del video |
| `web/backend/wrangler.toml`, `.dev.vars.example` | `CLIPS_BASE_URL`, comentada hasta desplegar el Worker |
| `web/backend/test/unit/clips-routes.test.ts`, `test/integration/clips.test.ts` | Un caso nuevo en cada una |
| `docs/frontend/contrato/partidas.md` (8g), `README.md`, `decisiones.md` | El video, la novedad y tres decisiones |
| `docs/bitacora/2026-10-23-clips-render-automatico/` | Plan (aprobado), esta guía, la documentación, el changelog y `pruebas/` |

## Lo que falta (en orden)

### 1. Prueba con el juego de verdad (PC de Daniel)

`record_session` cambió: ahora graba varias jugadas por partida, en pasadas que solo saltan hacia adelante, y descarta el primer medio segundo. Con la grabación simulada todo pasó. Los dos primeros intentos con el juego fallaron (ver "Incidentes") y se corrigieron. Falta repetirlo.

En una terminal **como administrador** (PowerShell o `cmd`), desde la raíz del repo, con la base local levantada y sin usar la PC mientras graba (unos 8 minutos):

```
python -I docs/bitacora/2026-10-23-clips-render-automatico/pruebas/probar_procesar.py "D:\CMLeague_Render\ClientMod\cstrike\cmleague\demos\v34frag_2026-10-22_tuscan_19-16.dem" --juego
```

La carpeta temporal es `prueba_c2` dentro de la temporal de Windows (la prueba la muestra al empezar), y el registro de la corrida queda en `trabajo\procesar.log` dentro de ella.

Graba cuatro jugadas en tres pasadas (el juego se abre tres veces):
- el 4k de musul y el 3k de Xaby de la ronda 10, que se intercalan: cada pasada solo tiene tramos separados por 15 s o más;
- el 4k de Lukas, en dos tramos;
- un clutch armado en la ronda 5.

Los `.mp4` quedan en `D:\CMLeague_Render\videos\prueba_c2\`. Hay que mirar en cada uno:
- que arranque con el arma en la mano (sin el cuarto de segundo sin arma de C1);
- que siga al jugador correcto;
- que la primera kill aparezca a los 3 s.

### 2. Worker de clips (cuenta de Daniel) — desplegado el 2026-10-23

Daniel lo desplegó con `wrangler deploy` y registró el subdominio `cmleague.workers.dev` de la cuenta: quedó en **`https://cmleague-clips.cmleague.workers.dev`** (versión `1a8f01f8-ebc4-4271-97e5-53c69a83e73b`), con el bucket enlazado como `env.CLIPS`. Verificado subiendo un video de prueba al bucket con `r2.py`: `GET` 200 con el contenido idéntico, `video/mp4` y caché de un año; `Range` 206 con los bytes correctos; `HEAD` 200; ruta inválida 404; después de borrarlo, 404. Los primeros pedidos fallaron unos 40 s con error de TLS mientras Cloudflare emitía el certificado del subdominio nuevo. `CLIPS_BASE_URL` quedó en `web/backend/wrangler.toml` (producción y preview) y en `.dev.vars`; sale con el corte, como el resto del backend.

Pasos, para rehacerlo:


```
cd cloudflare/clips-worker
pnpm install --frozen-lockfile
CLOUDFLARE_API_TOKEN=<CF_API_TOKEN_CLIPS del .env> pnpm exec wrangler deploy
```

Wrangler muestra la URL (`https://cmleague-clips.<subdominio>.workers.dev`). Con ella:

- **Backend:** descomentar `CLIPS_BASE_URL` en `web/backend/wrangler.toml` (producción y preview) y en `.dev.vars`.
- **Comprobar:** `curl -I https://cmleague-clips.<subdominio>.workers.dev/clip/x` tiene que dar 404 (texto plano).

Si el token no tiene permiso para Workers, hay que sumarle "Workers Scripts: Edit" en el panel de Cloudflare.

### 3. Google Drive (cuenta de Daniel) — hecho el 2026-10-23

Proyecto de Google Cloud y cliente OAuth "de escritorio" creados, la app quedó "En producción" (página principal `https://csstv.gamer.gd/` y política `https://csstv.gamer.gd/privacidad.html`, sin logo ni condiciones del servicio, que no son obligatorios). `drive_login.py` dejó `GOOGLE_REFRESH_TOKEN` en el `.env`. `python drive.py prueba`: subida (16 000 bytes, mismo tamaño en Drive), permiso "cualquiera con el enlace" (lector), reproductor embebido 200 y borrado 204 (después, 404). Falta `"drive": true` en `render/config.json` de cada máquina de render.

Pasos, para otra máquina o si hay que rehacerlo:


1. En <https://console.cloud.google.com/>, crear un proyecto (por ejemplo, "CMLeague clips").
2. "APIs y servicios" → "Biblioteca" → **Google Drive API** → Habilitar.
3. "Pantalla de consentimiento de OAuth":
   - tipo "Externo", nombre de la app y tu correo;
   - permiso `.../auth/drive.file`;
   - **publicar la app ("En producción")**: en "Prueba", el token vence a los 7 días. `drive.file` no necesita la verificación de Google.
   - para publicar, Google pide en "Desarrollo de la marca" una página principal y una política de privacidad. La página principal es la web vieja, y la política es `privacidad.html` (en la raíz del repo, subida por FTP a `htdocs/privacidad.html` el 2026-10-23, md5 `39554460…`). El dominio de la web va en "Dominios autorizados". Sin logo: si se sube uno, Google exige verificar la app.
4. "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth" → tipo **"App de escritorio"**.
5. En el `.env` de la máquina: `GOOGLE_CLIENT_ID=…` y `GOOGLE_CLIENT_SECRET=…`.
6. `cd render && python drive_login.py`: se abre el navegador, aceptas y el token queda en el `.env`.
7. `python drive.py prueba`: sube, comparte, abre el reproductor embebido y borra.
8. `"drive": true` en `render/config.json`.

### 4. Migración en producción y token

1. Supabase → SQL Editor → pegar `supabase/migrations/20261023180000_clips_video.sql` → Run.
2. Correr el `insert` comentado al final del archivo: muestra el token una sola vez.
3. En el `.env` de la máquina de render:

   ```
   RENDER_SUPABASE_URL=https://wmzfwsizashpszxlvpeb.supabase.co
   RENDER_SUPABASE_KEY=<la clave pública de config.js>
   RENDER_WORKER_TOKEN=<el token>
   ```

4. Verificar con lecturas públicas: `match_clip_list` responde con `video_status`, y `clip_render_claim` con un token inventado da 401.

### 5. Tarea programada

En PowerShell **como administrador**, desde `render/`:

```
.\instalar_tarea.ps1
```

Antes, `config.json` tiene que tener `demo_worker_url`, `r2_days`, `max_matches_per_run` y `drive` (ver `config.example.json`). Después, en el primer mix real:
- `work_dir\procesar.log` muestra el desfase y cada jugada;
- `match_clips` tiene `video_status = 'done'`;
- la URL del Worker reproduce el video.

### 6. Portátil

Copiar el cliente (`robocopy`, como en C1), `render/`, Python, FFmpeg y el `.env` (con su propio token de render: un nombre por máquina). Ajustar `config.json`, `drive_login.py` (o copiar el token), medir 1080p e instalar la tarea. Desinstalar la de la PC (`.\instalar_tarea.ps1 -Desinstalar`).

**Con un ClientMod recién instalado** (Daniel instaló uno limpio en el portátil, 2026-10-23):

- **Mapas:** la demo solo se reproduce si el mapa está en el cliente. Una instalación limpia no trae los de la liga (`de_tuscan`, `de_season`, `de_cpl_mirage`, `de_cpl_strike`…), que el juego normal baja por FastDL al entrar al servidor. Copiar `cstrike/maps/` y el contenido que bajan esos mapas (`cstrike/materials/`, `models/`, `sound/`) desde `D:\CMLeague_Render\ClientMod`, o copiar esa carpeta entera en lugar de usar la instalación limpia (es la que se probó). Sin el mapa, la sesión espera la carga 10 minutos y la jugada falla.
- **Abrir el juego una vez a mano** con el launcher, para que cree su configuración y la clave del registro (`HKCU\Software\CSSv34_ClientMod`, que el script respalda y restaura) y para aceptar lo que pida la primera vez (actualizaciones o avisos).
- **La consola** la activa el propio script (`con_enable 1` y la tecla de al lado del 1, en el cfg de arranque), así que no depende de la configuración del portátil.
- **El botón PLAY del launcher** se busca en la misma posición que en la PC (ventana de 890x500). Si el launcher del portátil es de otra versión, la prueba de una jugada lo muestra (el juego no abre).

## Pruebas

### Base de datos (Supabase local)

- [`pruebas/pruebas_db.sql`](pruebas/pruebas_db.sql), sobre el esquema de producción (`REPLANTEO=0 pnpm db:reset`): **62 pruebas, todas OK**. Cubren:
  - el token (desconocido, desactivado, `last_seen_at`);
  - la cola: partida más vieja, solo visibles, orden por tick, demo sin subir, canceladas;
  - las validaciones de `done` (clave de otra jugada o de otra partida, tamaño, duración, id de Drive) y `done` repetido;
  - los fallos (tres intentos, `skipped`, `gone`) y las `processing` vencidas;
  - guardar otra vez con el mismo id, cambio de nombre, cambio de ticks y ticks que cambian mientras se graba;
  - el archivo (solo con Drive, una vez), el borrado en cascada a la papelera y la papelera;
  - los permisos de `anon`.
- **Las 40 pruebas de los clips** (`../2026-10-22-clips-automaticos/pruebas/pruebas_db.sql`) siguen pasando con la nueva `csstv_clips_save`.
- **Con el replanteo completo** (`pnpm db:reset`): las 62, las 40 y las 9 de la `26`, todas OK.
- **Ciclo de la `26`:** una segunda aplicación aborta; la inversa deja la vista igual a la de la migración (`pg_get_viewdef` idéntico); se vuelve a aplicar y la estructura queda igual.
- **La migración se puede volver a correr.**

### La jugada en la demo

[`pruebas/probar_desfase.py`](pruebas/probar_desfase.py), con la demo de tuscan (sin el juego). Arma 17 multikills y un clutch sin kills como los mandaría el plugin, con desfases de 237, −180, 3030 y 9000 ticks (hasta 90 s) y un tick de ruido. Todo OK en los cuatro:
- el desfase sale exacto, también solo con el clutch;
- los ticks son los exactos del `.dem` y el nombre, el de la demo;
- los tramos del 4k de Lukas y los del clutch son los esperados;
- la conversión de SteamID64 a `STEAM_X:Y:Z` funciona;
- el jugador ausente y la partida sin desfase quedan `skipped`.

### `procesar.py` de punta a punta (grabación simulada)

[`pruebas/probar_procesar.py`](pruebas/probar_procesar.py), contra la Supabase local y el R2 real de clips. Cambia solo `record_session` por cuadros de prueba de FFmpeg del largo exacto de cada tramo, a 320x180. Una partida con las 17 multikills de tuscan, un clutch y un jugador que no está en la demo: **todo OK**.

- **Desfase:** 237, el armado.
- **Jugadas:** 18 con video y 1 `skipped`.
- **Archivos locales:** la demo y los `.mp4` se borraron.
- **R2:** los 18 videos están con el tamaño anotado. El 4k de Lukas dura 12,18 s (los dos tramos).
- **Archivo de los 15 días:** borró de R2 solo el que tenía Drive y lo marcó.
- **Partida borrada:** la papelera dejó R2 sin ningún video de prueba.
- **Tiempo:** 188 s, casi todo de FFmpeg y la subida.

### Worker de clips

[`pruebas/probar_worker.sh`](pruebas/probar_worker.sh) con `wrangler dev` (R2 simulado). **17 pruebas OK:**
- `GET` entero y su contenido, las cabeceras, `HEAD`;
- `Range` `a-b`, `a-` y `-n` (206 y `Content-Range`), fuera del video e inválido (416), `If-None-Match` (304);
- la jugada que no existe, la ruta fuera de `clips/` y la clave sin sufijo (404);
- `PUT` y `DELETE` (405).

### Backend

- `pnpm typecheck` sin errores.
- `pnpm test`: **291** pruebas unitarias OK. La nueva cubre los seis estados del video, `url` con y sin `CLIPS_BASE_URL` y `embed_url`.
- `pnpm test:int`: **104** de integración OK. La nueva cubre: sin demo, `unavailable`; con demo, `pending`; `done` con R2 y Drive; a los 15 días, solo Drive.

### R2 y Drive

- `python r2.py prueba` (con `HEAD`): OK.
- **Drive:** `python drive.py prueba` OK el 2026-10-23 (ver paso 3).

## En qué se apartó del plan

- **Sin replanteo `27`.** La migración agrega columnas a `match_clip_list`, y la `26` (que se aplica después, en local y en el corte) las habría quitado. PostgreSQL no deja sacar columnas con `create or replace view`, así que se actualizaron la `26` y su inversa con las columnas nuevas. La `26` todavía no está en producción.
- **La clave en R2 lleva un sufijo:** `clips/<partida>/<jugada>-<AAAAMMDDhhmmss>.mp4`, no `<jugada>.mp4`. Si una jugada se vuelve a grabar, la clave vieja va a la papelera, y con la misma clave la papelera habría borrado el video nuevo. El Worker sirve `/clip/<partida>/<jugada>-<sufijo>.mp4`.
- **La papelera la llena un trigger,** no `csstv_clips_save`. Así también cubre el borrado en cascada de una partida y el cambio de ticks.
- **Si cambian los ticks de una jugada con video,** el video se descarta y la jugada vuelve a la cola. El plan no lo contemplaba.
- **El problema de las jugadas recreadas era menor de lo que decía el plan:** la ingesta no reprocesa un resultado repetido (`ingest_server_chunk` devuelve la partida existente), así que `csstv_clips_save` corre una vez por partida. Se cambió igual. Las pruebas la llaman directo.
- **Estado `unavailable` en la API** para las jugadas de partidas sin demo: si no, se verían "en cola" para siempre. La base no lo guarda: sale de `demo_status`.
- **`embed_url` viene siempre que el video está en Drive,** no solo después de los 15 días. El frontend usa `url` si viene.
- **El id de Drive es opcional en `clip_render_done`,** para poder grabar antes de configurar Drive. El archivo de los 15 días solo borra de R2 los que están en Drive.
- **El desfase usa también el inicio de los clutches** (contra las muertes), además de las kills y el fin de ronda. Con un solo clutch sin kills, el fin de ronda no alcanzaba: en 3 minutos entran varios. La ventana es de 3 minutos, por si `tv_delay` es grande.
- **Los nombres con `;` también quedan `skipped`,** además de los que tienen comillas: cortarían el comando de la consola.
- **Sin saltos hacia atrás:** el plan suponía que un salto hacia atrás solo tardaba más (reinicia la demo). La prueba con el juego mostró que después del reinicio el juego deja de obedecer la consola. Las jugadas que se pisan van en otra pasada.
- **Medio segundo de más al principio de cada tramo** (`lead_seconds`), que FFmpeg descarta, para el pendiente de C1 de los primeros cuadros sin el arma. Sin probar con el juego.
- **La tarea usa `pythonw`** para que no se abra una consola cada 10 minutos.

## Incidentes durante las pruebas

- **Primera prueba con el juego (2026-10-23, Daniel): no salió ningún video.**
  - Lo que pasó:
    - el 4k de musul y el 3k de Xaby de la ronda 10 se intercalan, y cada salto hacia atrás reinicia la demo;
    - después del reinicio, la demo ya no quedaba en pausa: llegaba al tick y seguía, así que el `startmovie` arrancó en la ronda siguiente;
    - esa ronda empezaba con la pausa de los jugadores (`!pause` del plugin, que alarga el freezetime);
    - desde ahí, el `endmovie` y el `demo_gototick` siguiente no hicieron efecto, aunque las marcas `echo` del mismo paso sí salieron. Se grabaron más de 13 000 cuadros y la sesión falló a los 11 minutos con "0 de 330 cuadros".
  - No se sabe por qué el juego dejó de obedecer: la demo no tiene `svc_SetPause`, así que el motor no estaba pausado.
  - **Corrección:**
    - ya no hay saltos hacia atrás: las jugadas que se pisan van en otra pasada, con el juego recién abierto;
    - si la demo se pasó de largo antes de grabar, la sesión falla;
    - después del `endmovie` se comprueba que los cuadros dejen de aparecer (con reintento).
  - **Limpieza:** se borraron los cuadros, la carpeta `%TEMP%` que quedó dentro del repo (el comando de la guía estaba escrito para `cmd`) y la partida de prueba de la base local. El registro y el `clientmod.ini` de ClientMod quedaron restaurados.
- **Segunda prueba con el juego (2026-10-23, Daniel): tampoco salió ningún video, pero falló enseguida y sin grabar basura.**
  - El control nuevo cortó a los 2 minutos: "4deb7cd6 tramo 2: la demo pasó de largo el tick 87265".
  - El log mostró la causa de fondo, que también estaba en la primera prueba. Después de cada tramo, la demo sigue corriendo a toda velocidad hasta que llega el `demo_pause` (escribir el paso en la consola tarda un instante): entre 5 y 10 s de demo. Por eso, un salto "hacia adelante" a un tramo que empieza 5,6 s después del anterior era, para el juego, hacia atrás, y reiniciaba la demo. No hacía falta que las jugadas se pisaran.
  - Ese tramo, además, grabó la ronda 2. El control no lo vio porque entre los dos tramos no había ninguna kill que esperar.
  - **Corrección:**
    - los tramos de una misma pasada tienen que estar separados por 15 s (`gap_seconds`);
    - si un salto igual reinicia la demo (`Playing demo from` en el log), se espera la carga, se pausa y se vuelve a saltar desde el principio, como al abrir el juego; si se reinicia dos veces, la sesión falla.
  - La carpeta temporal de la prueba volvió a quedar dentro del repo. Ahora es opcional y la prueba rechaza una ruta con `%`.

- **Dos fallos de las pruebas, no del código:**
  - el orden de la cola esperaba el ace antes que el clutch, pero el clutch de la prueba empieza en el tick 7000;
  - una subconsulta en la misma expresión que `clip_render_claim` veía la foto anterior al `claim`.
- **`anon` podía leer `clip_video_trash`.** Supabase da permisos por defecto en las tablas nuevas; RLS sin políticas igual devolvía 0 filas. Se sumó `revoke all … from anon, authenticated`.
- **El Worker devolvía 206 sin `Range` y `Content-Range` con `NaN`** en `wrangler dev`. El `obj.range` que devuelve R2 en local no es el que se esperaba. Ahora el Worker lee la cabecera `Range`, le pide a R2 el tramo exacto y arma `Content-Range` con el tamaño del objeto.
- **`wrangler dev` quedaba corriendo** después de la prueba: en Windows, `kill` no cierra el árbol de procesos. La prueba los cierra por su línea de comando.
- **El despliegue del Worker no se hizo:** el modo automático de Claude Code no lo permitió (despliegue a producción). Queda para Daniel (paso 2).

## Cómo revertir

1. **Tarea:** `.\instalar_tarea.ps1 -Desinstalar`.
2. **Worker:** `pnpm exec wrangler delete` en `cloudflare/clips-worker` (con el token de la cuenta de Daniel). Borrar los videos del bucket desde el panel si hace falta.
3. **Backend:** revertir el commit. `video` es un campo nuevo: el frontend que no lo usa no se entera.
4. **Base**, en el SQL Editor:
   1. volver a crear `csstv_clips_save` y `match_clip_list` como en `20261023120000_clips.sql`;
   2. después:

   ```sql
   drop trigger match_clips_video_guard on match_clips;
   drop function match_clips_video_guard(), render_auth(text), create_render_worker_token(text),
     clip_render_claim(text), clip_render_done(text, uuid, text, bigint, numeric, text),
     clip_render_fail(text, uuid, text, boolean), clip_archive_due(text, integer, integer),
     clip_archive_mark(text, uuid), clip_trash_list(text, integer), clip_trash_done(text, bigint);
   drop table clip_video_trash, render_workers;
   alter table match_clips drop constraint match_clips_video_status_check, drop constraint match_clips_video_done_check,
     drop column video_status, drop column video_key, drop column video_bytes, drop column video_seconds,
     drop column video_drive_id, drop column video_attempts, drop column video_error, drop column video_claimed_at,
     drop column video_rendered_at, drop column video_r2_deleted_at;
   ```

   Antes de dropear las columnas, `match_clip_list` tiene que estar recreada sin ellas (paso 1). Las de la `26` y su inversa también vuelven a la versión sin video.
5. **Archivos:** los videos de R2 y de Drive quedan donde estén. Borrarlos a mano si hace falta (carpeta "CMLeague clips" en Drive, prefijo `clips/` en el bucket).

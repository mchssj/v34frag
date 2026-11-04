# Supabase en el VPS: guía de implementación

## Estado

**Desplegado el 2026-11-03: la base de producción está en el VPS desde las 20:50 UTC.**
- La web estuvo caída 2 min 41 s (20:47:30 a 20:50:11 UTC).
- La copia final es idéntica a la nube: 124 tablas fila a fila, 4.435 filas y 62 archivos.
- La API, el socket, el relay del HUD, los timers, flow (#2), el #3 y el Worker de demos ya usan `db.cmleague.lat`.
- **#1 MVZG** (21:10 UTC), con lo que decidió Daniel:
  - **En la base:**
    - fila nueva `96bb5060-a639-483a-94ef-f15135c57b1b` "Server CM League #1", el mismo id que su build licenciado 2.9.2, así que el plugin no se tocó;
    - `190.104.34.3:27022`, `competitive`, matchmaking, oficiales y PCW prendidos, y un token nuevo (solo su hash va a la base);
    - la vieja `7b01c85b` ("Server CM League #1", con las 34 partidas, las conexiones y el panel de flow) pasó a "flow (histórico)", fuera del matchmaking pero activa: el Worker de demos puede usar su `panel_server_id`.
  - **En su `csstv_reporter.cfg`:** la URL, la clave opaca de producción y el token, verificado byte a byte. Desde la PC de Daniel el SFTP no respondía, así que se subió desde el VPS.
  - **Toma efecto al cambiar de mapa o reiniciar el servidor:** no tenemos su consola.
  - El cfg anterior, con el token de staging, está en el scratchpad de la sesión (`cfg/srv1.cfg`).
- **Matchmaking** (Daniel, 21:25 UTC):
  - **#1 con matchmaking** (`csstv_mm "1"`, `mm_enabled = true`).
  - **flow (#2) sin matchmaking:** `csstv_mm "0"` en su cfg y por la consola del panel, y `mm_enabled = false`. Se juega mix normal, sin salas de la web.
  - Por un error de a cuál tocar, el #1 estuvo unos minutos con `0`, sin efecto: no había cargado el cfg.
- **Daniel inició sesión con su cuenta** sin problema.
- **Comprobado a las 21:30 UTC:** el #1 consulta la base nueva cada 5 s (2.9.2); subir, leer y borrar un archivo de prueba en Storage funciona; el Worker de demos llama a `demo_pending` con 200; Resend acepta el login y un correo de `no-reply@cmleague.lat` a su dirección de prueba.
- **flow:** `csstv_claim "1"` en su cfg a las 21:34:52 UTC, con mix en curso. Se carga en el próximo cambio de mapa.
- **Mix en vivo (21:50 UTC):** flow manda sus fotos de ronda a la base nueva (`ingest_server_chunk` con 200, `live_matches` en 4-0). El render ya consulta la base nueva (`clip_render_claim` con 200).
- **postgres-meta apagado** (Daniel, 21:51 UTC): solo lo usa Studio. Ya no está en `sb arrancar`.
- **Medido durante el mix, con `csstv_mm_poll` y un token falso:** solo Postgres 0,1 ms; PostgREST 2,0 ms; Kong más PostgREST 3,4 ms; por Caddy, con una conexión TLS nueva cada vez, 23,9 ms.
- **HUD en producción (22:07 UTC):** token del relay en `hud_relays`, sin cambiar `hud.json`. Fila de flow: `190.104.34.3:27015`, SourceTV `27064`, puerto `27501` y su clave de staging, la misma de su cfg. #1: puerto `27502`, clave nueva y su `csstv_hud.cfg`, que carga en el próximo cambio de mapa. Hasta entonces, el #1 sigue mandando al `27501` con la clave de flow.
- **Primer mix completo en la base nueva (flow, 22:28 UTC, 14-16):** la partida quedó guardada, pero la demo no subía: la fila de flow tenía `panel_server_id = flow-server` y sin `panel_url`, y el Worker recibía 404. Se corrigió a `f337a7d9` y `https://panel-mvzg.com`, y en la pasada de las 22:50 subió (`demos/2026/11/flow-20261103T184428-ce8f.dem`).
- **Kong:** con tráfico real llegó a 242 de sus 256 MB. Se subió a 512 MB en caliente (`docker update`), sin reiniciar, y en `cmleague.yml`. Con tráfico, los seis contenedores usan ~835 MB, no los ~460 MB del ensayo.
- **Falta:**
  - **Demos del #1:** su fila no tiene `panel_server_id`, así que el Worker no le sube demos.
  - **Plantillas de correo** en español (`deploy/auth/plantillas/`): sin cargar en GoTrue.
  - **R2:** configurado en `/etc/cmleague/respaldo.env`. El 403 era un error de la prueba: se usó la cuenta de clips, y el bucket está en la de agusb06. El primer respaldo real a R2 es el automático de las 09:00 UTC.
  - **Web:** la privacidad actualizada queda para el próximo despliegue. No hace falta para la base nueva.
  - **Sin relación con el corte:**
    - Streamers del HUD: hay 0 en producción y hay que darlos de alta desde Administración.
    - Rotar el webhook de la cola de Discord, que salió en un log de esta sesión.

## Archivos

| Archivo | Cambio |
|---|---|
| `deploy/supabase/README.md` | Nuevo: qué corre, comandos, instalar, migrar, respaldar, restaurar y volver a la nube |
| `deploy/supabase/cmleague.yml` | Nuevo: ajustes sobre el compose oficial (puertos en `127.0.0.1`, memoria, sin servicios que no se usan, `roles.sql` propio) |
| `deploy/supabase/roles.sql` | Nuevo: contraseñas de los roles internos, sin `supabase_functions_admin` |
| `deploy/supabase/supabase.env.example` | Nuevo: variables de Supabase, sin valores |
| `deploy/supabase/preparar-env.sh` | Nuevo: arma `/etc/cmleague/supabase.env` desde la PC |
| `deploy/supabase/instalar.sh` | Nuevo: Docker, compose oficial en el commit `cdba349d`, `sb`, respaldo y arranque |
| `deploy/supabase/migrar.sh` y `migrar-vps.sh` | Nuevos: copia de producción al VPS con comparación fila a fila |
| `deploy/supabase/copiar_storage.py` | Nuevo: copia de los archivos de Storage |
| `deploy/supabase/respaldar.sh`, `cmleague-respaldo.service` y `.timer`, `respaldo.env.example` | Nuevos: respaldo diario |
| `deploy/vps/Caddyfile` | Bloque `db.cmleague.lat` (solo `/rest/v1`, `/auth/v1` y `/storage/v1`) |
| `cloudflare/demo-worker/wrangler.toml` | `SUPABASE_URL = "https://db.cmleague.lat"` |
| `CLAUDE.md` | Dónde está la base de producción |
| `terms/privacidad.html` y `web/frontend/src/features/legal/pages/PrivacyPage.tsx` | La base, las cuentas y los archivos en el VPS de OVH; Supabase guarda la copia hasta el 2026-12-03 |
| `.env` de la raíz (sin versionar) | `SUPABASE_VPS_*`, `PG_*` al túnel, `PRODUCTION_SUPABASE_URL`, `RENDER_SUPABASE_URL` y los de la nube como `NUBE_*` |

## Despliegue

### Hecho el 2026-11-03: Supabase y el ensayo en el VPS

1. `deploy/supabase/preparar-env.sh` → `/etc/cmleague/supabase.env` (root, 600).
2. `instalar.sh` en el VPS:
   - instala `docker.io` 29.1.3 y `docker-compose-v2` 2.40.3, de Ubuntu;
   - deja el compose oficial en `/srv/supabase/oficial` y el comando `sb`;
   - activa `cmleague-respaldo.timer` y levanta los seis contenedores.
3. `deploy/supabase/migrar.sh --desde-cero`: la copia de producción de las 20:28 UTC.
4. `sudo cmleague-respaldar` y la prueba de restauración.

Lo que ya estaba en el VPS no cambió: `cmleague-api`, `cmleague-mm`, `cmleague-hud`, Caddy, `ufw` y los `.env`.

### Hecho el 2026-11-03 (20:44 a 20:57 UTC): el corte

1. **Caddy:** el `Caddyfile` con `db.cmleague.lat` (el anterior quedó como `/etc/caddy/Caddyfile.antes-db`). El primer `reload` falló sin cortar nada: `caddy validate`, corrido como root, había creado `/var/log/caddy/db.log` de root. Con `chown caddy:caddy` recargó y Caddy sacó el certificado.
2. **20:47:30:** se pararon `cmleague-api`, `cmleague-mm`, `cmleague-hud` y los timers `season`, `notify` y `demos`. No había salas abiertas, y había 2 en la cola.
3. **`deploy/supabase/migrar.sh --desde-cero`** (2 min 16 s), con 124 tablas idénticas y 62 archivos.
4. **`.env` del VPS**, cada uno con su anterior como `.nube`:
   - `SUPABASE_URL` a `https://db.cmleague.lat` en `api.env`, `season.env`, `demos.env` y `hud.json`. No es `127.0.0.1`, porque la API arma con esa URL las direcciones públicas de las fotos y el `csstv_api_url` que muestra el admin.
   - `MM_LISTEN_URL` a `postgresql://mm_listener:…@127.0.0.1:5432/postgres`.
5. **20:50:11:** servicios y timers arriba, y `/api/health?deep=1` respondió `supabase: ok`. El socket escucha (`listen "mm"`).
6. **Servidores:**
   - **#2 flow:** `csstv_api_url` en su `csstv_reporter.cfg` y por la consola, por la API del panel. A las 20:51 ya consultaba la base nueva (`csstv_license` y `csstv_mm_poll`).
   - **#3 aurav34:** el cfg, por la API del panel de ExtremeHost (su reporter está en `disabled/`).
   - **#1 MVZG:** no se cambió (ver Estado).
7. **Worker de demos:** `SUPABASE_URL` en `wrangler.toml` y `pnpm exec wrangler deploy`, versión `7acd5442-3434-47e9-a0b4-a8cae4abd427`. El código desplegado era el mismo de todas las ramas; lo último publicado había sido un cambio de secreto.
8. **`.env` de la raíz:**
   - `PG_*` al túnel (`localhost:5433`, `postgres`, `SUPABASE_VPS_POSTGRES_PASSWORD`);
   - `RENDER_SUPABASE_URL` y `PRODUCTION_SUPABASE_URL` a `db.cmleague.lat`;
   - los valores de la nube como `NUBE_*`.
9. **Privacidad:** sin "En preparación". Supabase sale de la tabla de proveedores, OVH guarda la base, y se aclara que en Supabase queda la copia hasta el 2026-12-03, como mucho.
10. **Tráfico real después del corte:** `/api/v1/matches`, `players`, `events` y `servers/status` con 200, un registro con 409 (correo ya usado), dos inicios de sesión con contraseña equivocada (`invalid_credentials`) y **ningún 5xx**.
    - Las sesiones de la nube (ES256) dan 403 en `/auth/v1/user`, y la API responde 401, con lo que la web las renueva sola.
    - El socket las rechaza con `4001` hasta que la web renueva la sesión en su próxima llamada a la API.

## Pruebas

### Ensayo de la migración (VPS, 2026-11-03, contra producción en modo lectura)

| Comprobación | Resultado |
|---|---|
| Esquema de `public` | 96 tablas y 493 funciones |
| Extras de `auth` y `storage` | 2 triggers en `auth.users` y 17 políticas en `storage.objects` |
| Datos | 124 tablas (`public`, `auth` y `storage.buckets`/`objects`) **idénticas fila a fila** (md5 por fila), 4.429 filas |
| Archivos | 62 de 62 copiados (17,9 MB), con el tamaño comprobado |
| URLs guardadas | 47 filas cambiadas a `db.cmleague.lat`: `map_pool`, `mm_sounds`, `profile_details`, `replanteo71_fotos_ficha`, `players`, `mm_config`. Ninguna función tiene la URL vieja |
| Totales | 62 cuentas, 62 archivos, 95 partidas, base de 21 MB |
| Tiempo | ~3 minutos |

### Funcionamiento (Kong local, 2026-11-03)

| Prueba | Resultado |
|---|---|
| `csstv_mm_poll` con un token falso | 200 en 12 ms: `ok=0`, "Token de servidor inválido o revocado" (en la nube: 2 a 12 s y algún 500) |
| Foto pública de Storage | 200 en 17 ms |
| Alta de una cuenta de prueba (API de admin), login y `/auth/v1/user` | ok. La cuenta se borró al terminar |
| `mm_my_live` con esa sesión | 200 en 8 a 25 ms |
| Clave opaca y legacy en `/auth/v1`, `/rest/v1` y `/storage/v1` | Las dos funcionan. La raíz `/rest/v1/` solo con la secreta, como en la nube |
| Puertos | Solo `127.0.0.1:8000` y `127.0.0.1:5432`. Nada nuevo en `ufw` |
| Memoria | ~460 MB los seis contenedores, con 2,3 GB disponibles en el VPS |

### Respaldo

- **Qué generó:** `base.dump` (1,9 MB) y `storage.tar.gz` (18 MB), con las sumas SHA-256 verificadas.
- **Restauración:** en una base aparte (`prueba_respaldo`, borrada después), con 0 errores y la misma cantidad de filas en `auth.users`, `matches`, `players` y `storage.objects`. La suma del ELO también coincide: `player_elo` 108.005 y `mm_lobby_players` 10.402.
- **Sin probar:** la subida a R2, porque todavía no hay bucket.

## En qué se apartó del plan

- **Claves:**
  - Producción usa claves **opacas** (`sb_publishable_…`, `sb_secret_…`) en la API y el `.env`, y las legacy en el Worker y el render. En el VPS valen las dos: Kong cambia la opaca por la legacy (`ANON_KEY_ASYMMETRIC` y `SERVICE_ROLE_KEY_ASYMMETRIC` son las legacy) y PostgREST la valida con el JWT secret.
  - El plan decía que las sesiones abiertas seguirían valiendo. **No:** producción firma las sesiones con ES256 y esa clave privada no se exporta. Después del corte, la web renueva cada sesión con su refresh token (`authFetch` reintenta tras un 401), así que nadie tiene que volver a iniciar sesión.
- **Docker de los paquetes de Ubuntu** (`docker.io`, `docker-compose-v2`), no del repositorio de Docker. Se actualiza con `unattended-upgrades`.
- **`roles.sql` propio:** el oficial cambia la contraseña de `supabase_functions_admin`, que crea `webhooks.sql`. Sin ese script, la base quedaba a medio crear.
- **La comparación ignora `last_seen_at` y `last_poll_at`:** los servidores y el Worker los siguen escribiendo en la nube durante la migración.
- **Respaldos:**
  - Quedan 7 en el VPS además de los de R2.
  - Los de R2 los borra la regla de ciclo de vida del bucket, no el script.
  - El bucket lo crea Daniel, porque los tokens del `.env` no pueden crear buckets.
- **Límite de `postgres-meta`:** 192 MB en lugar de 128 (usaba 104 MB en reposo).

## Incidentes durante las pruebas

- **Primer arranque:** con el `roles.sql` oficial, la base quedó sin `graphql_public` y Storage no podía entrar. Se borró la base, que estaba vacía, y se usó el `roles.sql` propio.
- **`pkill -f instalar.sh` se mató a sí mismo**, porque su propia línea de comandos lo nombraba, y la limpieza no corrió. Se hizo con un script por stdin.
- **SSH bloqueado ~1 minuto:** el `limit` de `ufw` cortó la séptima conexión en 30 s. `migrar.sh` pasó a usar una sola conexión (los scripts y las credenciales van por stdin).
- **`docker exec -i` (dentro de `sb psql`) se comía el resto de un script mandado por stdin.** Se le pone `</dev/null`.

## Cómo revertir

- **Para volver a la nube**: ver "Después del corte", más abajo. **Antes del corte** (ya no aplica), para sacar todo del VPS:
  1. `sudo systemctl disable --now cmleague-respaldo.timer`
  2. `sudo sb down -v`
  3. `sudo rm -rf /srv/supabase /etc/cmleague/supabase.env /usr/local/bin/sb /usr/local/bin/cmleague-respaldar /etc/systemd/system/cmleague-respaldo.*`
  4. Opcional: `apt purge docker.io docker-compose-v2`.

  Nada más depende de esto.
- **Después del corte:** volver a los `.nube` de los `.env` del VPS, a la URL vieja en los servidores y en los Workers, y llevar a la nube lo que se escribió en el VPS mientras tanto (ver "Volver a la nube" en `deploy/supabase/README.md`).

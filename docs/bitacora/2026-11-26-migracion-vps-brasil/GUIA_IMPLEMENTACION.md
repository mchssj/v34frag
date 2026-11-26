# Migración del VPS a São Paulo: guía de implementación

## Estado

Desplegado el 2026-11-26: el VPS de São Paulo atiende todo desde las 16:35 UTC. El viejo (OVH, Beauharnois) quedó apagado y entero para volver atrás. Después del corte, web y API `9f41fd836a16` (`/privacidad` al día y `HUD_UDP_HOST`) y la restauración de respaldos arreglada. Falta lo de "Pendientes" al final.

## Archivos

| Archivo | Cambio |
|---|---|
| `deploy/vps/preparar.sh` | `--ssh-sin-cambios` (no toca `sshd`), `--en-espera` (instala las unidades sin prender ninguna), instala `cmleague-medals` con los demás y no suma `/swapfile` si ya hay 2 GB o más de swap |
| `deploy/supabase/instalar.sh` | `--en-espera`: el respaldo diario queda sin prender |
| `deploy/vps/desplegar.sh` | `api`: si `cmleague-api` está apagado, solo sube la versión (como el HUD) |
| `CLAUDE.md` | El VPS nuevo, el `/etc/hosts`, `resan`, el HUD por `relay.cmleague.lat` y dónde están los logs de los servidores |
| `docs/PENDIENTES.md` | La migración y el problema de "Restaurar un respaldo" |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx`, `lib/meta.ts`, `terms/privacidad.html`, `terms/terminos.html` | Proveedor y lugar del VPS (Halver, São Paulo) y la fecha de actualización |
| `web/backend/src/env.ts`, `services/hud.ts`, `routes/admin-servers.ts`, `test/unit/hud-routes.test.ts`, `deploy/vps/api.env.example`, `.dev.vars.example` | `HUD_UDP_HOST`: el host del UDP del HUD en el cfg de Administración › Servidores (`relay.cmleague.lat`) |
| `deploy/supabase/permisos.sql`, `restaurar.sh`, `respaldar.sh`, `instalar.sh`, `README.md` | Cada respaldo guarda los permisos exactos; `cmleague-restaurar` restaura con ellos |
| `.env` (no se versiona) | `VPS_HOST` es el VPS nuevo; el viejo queda en `VPS_HOST_VIEJO` y `VPS_IPV6_VIEJO` |

Commits: `c71cef9c` (scripts), `ae92d3d0` (plan), `ab8b219c` (`HUD_UDP_HOST`), `4a8fa19d` (restaurar con permisos), `9f41fd83` (legales) y el de esta documentación.

## Despliegue (hecho el 2026-11-26)

### Fase 1: preparación (sin tocar producción)

1. `ubuntu` con la llave de Daniel y sudo sin contraseña (`/etc/sudoers.d/90-ubuntu`). `root` sigue con contraseña.
2. `sudo bash preparar.sh --ssh-sin-cambios --en-espera` y reinicio (kernel nuevo).
3. `resan`: `passwd -l resan` (Daniel: no se borra).
4. Copiados del viejo, por tubería y sin pasar valores por la consola, con el mismo sha256: los 8 archivos activos de `/etc/cmleague/` (`api.env`, `season.env`, `demos.env`, `demos-sftp.json`, `hud.json`, `vigia.env`, `respaldo.env`, `supabase.env`), `/etc/caddy/acceso-web.caddy` y las fuentes del HUD.
5. `sudo bash instalar.sh --en-espera`: mismas imágenes y mismo commit del compose (`cdba349d`).
6. Versiones de producción copiadas del viejo (952 archivos idénticos): API `affd6e60867e`, web `6982d3ec6ac5`, HUD `e0aa0ccc791d`.

### Fase 2: ensayo

- **Base:** `pg_dump` en caliente del viejo (16:17 UTC) restaurado con el método del README, más la clave de pgsodium y Storage. 193 tablas con las mismas filas y 338 archivos. Hubo que crear `mm_listener` y copiar los permisos (ver "Incidentes").
- **API:** la versión de producción en una unidad temporal (`systemd-run --unit=cmleague-api-ensayo`, `127.0.0.1:8788`, `SUPABASE_URL=http://127.0.0.1:8000`, sin `MM_LISTEN_URL` ni el webhook de la cola). Matches, ranking y mixes dieron la misma respuesta byte a byte que producción, el avatar más reciente el mismo archivo, y con un usuario temporal (creado y borrado en la copia) login, `/auth/me`, perfil, notificaciones y estado del matchmaking en 200.

### Fase 3: corte

1. Sin mixes: 0 jugadores en #1, #2 y #3, y el último evento del reporter, de la madrugada (`addons/sourcemod/logs/L20261126.log` por la API del panel). El matchmaking estaba apagado.
2. VPS nuevo, sin cortar nada: certificados de Caddy copiados del viejo (`/var/lib/caddy/.local/share/caddy`, válidos hasta enero de 2027), `Caddyfile` con los dominios y `solo-cloudflare.sh` en `/srv/cmleague/`.
3. VPS viejo (16:34 UTC): `systemctl disable --now` de API, worker, HUD y los 6 timers; respaldo final `20261126T163405Z` (en R2); `sb down`.
4. Copia física (con los dos Supabase apagados): `volumes/db/data`, `volumes/storage`, `/var/lib/cmleague-hud` y el volumen `supabase_db-config` (clave de pgsodium). Comparación de todos los archivos (2145 de la base): idéntica.
5. VPS nuevo (16:35 UTC): `127.0.0.1 db.cmleague.lat` en `/etc/hosts`, `sb arrancar`, `systemctl enable --now` de API, worker, HUD y los 6 timers.
6. Cloudflare (Daniel): A de `cmleague.lat`, `api`, `db` y `hud` a la IP nueva, con proxy (`hud` pasó de "DNS only" a Proxied), `relay` nuevo en "DNS only", y borrados los AAAA (apuntaban al IPv6 del viejo). `www` lo sigue solo.
7. Caddy del viejo apagado para comprobar: los cinco dominios responden desde el nuevo.
8. `solo-cloudflare.sh on` en el nuevo.
9. `csstv_hud_host "relay.cmleague.lat"` en `cfg/sourcemod/csstv_hud.cfg` de **#1, #2 y #3** por la API del panel (copia de antes guardada; se verificó byte a byte). Entra en el próximo cambio de mapa. Solo el #1 tiene puerto (`27502`): el #2 y el #3 no mandan HUD.
10. `.env`: `VPS_HOST` al VPS nuevo.

## Pruebas

- Después del corte: `https://cmleague.lat` 200, `www` 301, `https://api.cmleague.lat/api/health` ok (`affd6e60867e`), `db` 401 sin clave (como siempre), `https://hud.cmleague.lat/healthz` ok. Sin errores en el log de la API.
- Memoria: 4,5 GB disponibles (en el viejo quedaban ~2 GB y Storage usaba 209 de 256 MB).

## En qué se apartó del plan

- **Versiones:** se copiaron las de producción del viejo en vez de compilar `main` en un worktree (son idénticas; lo nuevo de `main`, dos páginas del manual, sale con el próximo `desplegar.sh api`).
- **Ensayo de la base:** con un `pg_dump` en caliente de ese momento (pedido de Daniel) en vez del respaldo de la noche. La copia física en caliente (`pg_basebackup`) no se pudo: el `pg_hba.conf` no deja conexiones de replicación y no se tocó producción.
- **Clave de pgsodium:** el plan no la tenía; vive en el volumen `supabase_db-config`, fuera de `volumes/`. Se copió en el ensayo y en el corte.
- **Certificados:** se copiaron del viejo en vez de pedirlos: con el proxy de Cloudflare adelante, pedirlos podía fallar.
- **`/etc/hosts`:** no estaba en el plan. La API y los timers le hablan a la base local; sin esto, entre el arranque y el cambio de DNS habrían ido al viejo apagado.
- **`www`:** no tiene registro A (lo sigue a `cmleague.lat`).

## Incidentes durante las pruebas

- **"Restaurar un respaldo" deja permisos de más** (`deploy/supabase/README.md`): después de `pg_restore --clean` sobre un Supabase nuevo, 539 funciones y 132 tablas o vistas de `public` quedaron con permisos para `anon` y `authenticated` (por ejemplo `ac_device_of` y `ac_hash`), porque nacen con los permisos por defecto de Supabase y el volcado no trae los `revoke`. Faltaban también `mm_listener` y los permisos de `graphql` y `graphql_public`. En el ensayo se copiaron los permisos exactos del viejo (`aclexplode` de cada objeto) y quedaron iguales. El corte no se afectó (copia física). Pendiente arreglar el procedimiento.
- **La API no arranca con `DISCORD_QUEUE_WEBHOOK_URL` vacía** (`CONFIG_INVALID`): para quitarla se borra la línea.
- **El `limit` de ufw cortó el SSH** al abrir más de 6 conexiones en 30 s; cada reintento renovaba el bloqueo. Se esperó un minuto.
- **El `.env` quedó vacío unos segundos** por un script que abrió el archivo antes de armar el contenido. Se restauró de la copia hecha justo antes (idéntico) y se rehízo con un archivo temporal.

## Cómo revertir

Mientras el viejo siga entero:

1. En el nuevo: `sudo systemctl disable --now cmleague-api cmleague-mm cmleague-hud` y los 6 timers, y `sudo sb down`.
2. Si el nuevo recibió escrituras que se quieren conservar: copiar `volumes/db/data`, `volumes/storage`, `/var/lib/cmleague-hud` y `supabase_db-config` del nuevo al viejo, con los dos apagados.
3. En el viejo: `sudo sb arrancar`, `sudo systemctl start caddy` y `systemctl enable --now` de lo mismo.
4. Cloudflare: los A a la IP vieja (y el AAAA del viejo si se quiere IPv6), `relay` a la IP vieja.
5. `csstv_hud_host` de #1, #2 y #3: sigue sirviendo `relay.cmleague.lat` apuntado al viejo. En el viejo, abrir el UDP del HUD para MVZG (`solo-cloudflare.sh on` ya lo tiene).
6. `.env`: `VPS_HOST` al valor de `VPS_HOST_VIEJO`.

### Después del corte (2026-11-26)

1. `HUD_UDP_HOST=relay.cmleague.lat` en `/etc/cmleague/api.env` del VPS.
2. `cmleague-respaldar` y `cmleague-restaurar` nuevos y `/srv/supabase/permisos.sql` instalados a mano en el VPS (sin correr `instalar.sh`, que reinicia los contenedores). Respaldo de prueba `20261126T165345Z` con `permisos.sql` (1105 sentencias), en R2 y con `SHA256SUMS` bien.
3. Web y API `9f41fd836a16` con `desplegar.sh` desde un worktree limpio en `9f41fd83` (sin lo que sigue sin commit en `main`). La web incluye `/privacidad` y `/terminos` al día; la API, las dos páginas del manual que faltaban (`admin/usuarios-y-fichas.md` y `jugador/buscar-partida.md`).

### Prueba de la restauración (en el VPS viejo, 2026-11-26)

- Se guardaron `db/data`, `storage` y `supabase_db-config` del viejo y su huella (sha256 de todos los archivos).
- `restaurar.sh` con el respaldo final `20261126T163405Z` y un `permisos.sql` sacado de producción: `pg_restore` con 0 errores y **0 diferencias de permisos** con producción (funciones, tablas, columnas, esquemas, permisos por defecto y roles). La primera vuelta dejó una: `mm_listener` lo tiene que crear `postgres`, como en `migrar-vps.sh`, para que `postgres` quede como miembro; se corrigió y se repitió.
- Se devolvieron los datos guardados: la huella quedó igual a la de antes (`f711d96d85d293b1`) y Supabase apagado.

## Pendientes

1. Comprobar que el HUD del #1 llegue al relay después del próximo cambio de mapa.
2. **Dar de baja el VPS de OVH** cuando se decida que no hace falta volver atrás. Hasta entonces guarda una copia de la base: `/privacidad` ya lo dice (al darlo de baja, sacar esa frase).
3. Quitar la contraseña de `root` y dejar solo llaves (Daniel lo decide más adelante).
4. Los límites de memoria de `cmleague.yml` y el `MemoryMax` de la API, con la RAM nueva.
5. `pnpm gen:api` en el frontend no hace falta (`HUD_UDP_HOST` no cambia la OpenAPI).

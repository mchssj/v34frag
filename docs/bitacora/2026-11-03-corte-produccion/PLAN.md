# Plan: corte a la base de producción

> Planeación original. Estado: **propuesta**, con las decisiones de Daniel del 2026-11-03. Pendiente de aprobación y de fecha.

Hasta hoy la plataforma nueva (`cmleague.lat`, la API y los servicios del VPS) funciona contra la **Supabase de staging**, y la web vieja (`index.html` en `csstv.gamer.gd`) y los servidores de juego contra la de **producción**. El corte deja todo contra producción: se le aplican los replanteos, el VPS pasa a producción, el #1 también y la web vieja se apaga.

Reemplaza la checklist del punto 1.5 de `docs/PENDIENTES.md` (replanteos `01` a `21`) y la sección 7 de [`2026-10-16-despliegue-vps`](../2026-10-16-despliegue-vps/PLAN.md) y [`2026-10-28-despliegue-vps-ovh`](../2026-10-28-despliegue-vps-ovh/PLAN.md), que quedaron viejas.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Base | Producción queda **igual que staging**: las migraciones de `supabase/migrations/` que ya tiene y los replanteos `01` a `69`, con el anticheat (`45` a `47`) | Daniel (2026-11-03): lo que se aplicó en staging se aplica en producción. Es lo que se probó |
| Anticheat | Las tablas entran, pero no es obligatorio en ningún servidor: sin filas en `ac_server_policy`, como en staging | Daniel: "en la web simplemente dejaremos deshabilitado que sea obligatorio el ac" |
| Migraciones que solo están en `feat/mm-claim-en-sala` (tienda, widget de streamers, fondo del miniperfil, progresión del VIP) | No entran | No están en staging ni en producción |
| Nicks repetidos | Se renombra una ficha de cada par antes del corte: "thorfinn" y "geusz" (las dos fichas de cada par son sin cuenta) | El replanteo `27` aborta con nicks repetidos sin distinguir mayúsculas |
| `mm_listener` | Se crea en producción **antes** de los replanteos | El `63` le da permisos solo si el rol ya existe. Sin él, el matchmaking queda sin socket (polling) |
| #1 (MVZG) | Pasa a producción. Su fila de staging (`CMLeague #1`) se copia a producción con el mismo `token_hash`, así el #1 solo cambia `csstv_api_url` | Daniel (2026-11-03). Sin token nuevo no hay que tocar el cfg dos veces |
| #2 (flow) | Sigue en producción; recibe el reporter que corresponde (build licenciado) en la misma tanda | Regla de `CLAUDE.md`: todos los servidores con la misma versión |
| #3 (ExtremeHost) | Queda como hoy: retake y 2vs2, con el reporter en `disabled/`. Se le sube el `.smx` genérico nuevo ahí, para que no quede una versión vieja | `CLAUDE.md` (2026-11-02) |
| Web vieja | **Se apaga** en el corte (`csstv.gamer.gd` deja de servir `index.html`). La baja Kyan a mano | Daniel (2026-11-03). Se rompe con el replanteo `01` |
| Términos y privacidad | Se publican como están, con sus marcas "En preparación" | Daniel (2026-11-03). Se ajustan después de la revisión legal |
| Registro | Como staging: confirmar el correo con un link (SMTP de Resend). Hoy producción confirma sola | Daniel (2026-11-03). Las 59 cuentas que ya existen no cambian |
| Configuración que solo existe en staging | Se **copia de staging a producción** con un script, después de los replanteos, con sus archivos | Daniel (2026-11-03). Se prueba en el ensayo |
| API | La misma que está en staging: el merge temporal de `feat/mm-claim-en-sala` con `feat/backend-api-fase-1` (`v34frag-deploy`), con el manual de `feat/frontend-fase-1` | Es lo probado. Unificar las ramas queda para después |
| Ensayo | Primero en la base local con una copia de producción (Docker), con los mismos pasos y scripts que el corte | Producción tiene pocos datos (59 cuentas, 150 fichas, 95 partidas): el ensayo es rápido y encuentra lo que aborta |

## 1. El flujo completo

```mermaid
sequenceDiagram
  participant D as Daniel y Claude
  participant L as Base local (copia)
  participant P as Supabase producción
  participant St as Supabase staging
  participant V as VPS
  participant S as Servidores #1, #2 y #3
  Note over D,L: Ensayo (días antes)
  D->>L: copia de producción + rol + replanteos 01 a 69
  D->>L: copia de la configuración de staging y pruebas
  Note over D,S: Corte (horario sin partidas)
  D->>P: respaldo (pg_dump) y foto del ELO
  D->>S: web vieja apagada; reporters en pausa (sin partidas)
  D->>P: nicks, rol mm_listener, replanteos 01 a 69
  St->>P: configuración (mm, sonidos, imágenes, mapas, clips, equipos, servidores)
  D->>P: Auth: SMTP, URL del sitio, confirmar correo
  D->>V: api.env, season.env y demos.env a producción; sin contraseña de Caddy
  D->>S: reporter nuevo en los tres; el #1 apunta a producción
  D->>V: pruebas de humo, registro, mix y matchmaking
```

## 2. Base de datos

### 2.1 Estado de producción (2026-11-03, solo lectura)

- Postgres 17. Tiene las migraciones de `supabase/migrations/` hasta `20261029210000_medallas_datos.sql` (VIP, clips, IPs, medallas, demos externos). `supabase_migrations.schema_migrations` anota solo 9: el resto se aplicó con `psql`.
- Ningún replanteo: no existen `team_members`, `mm_queue` ni `site_config`.
- `elo_config` tiene su fila. Buckets: `photos`, `avatars` y `proofs`. Los demás (`ac-evidence`, `sounds`) los crean el `45` y el `48`.
- Las sesiones se firman con ES256 (JWKS publicada), como en staging: la API las valida igual. Se confirma con un login en el ensayo de humo.

### 2.2 Antes de los replanteos

1. Renombrar las fichas repetidas (una de cada par), con `update players set nick = … where id = …` sobre la ficha que no se usa.
2. `create role mm_listener login password '<MM_LISTENER_PASSWORD>' noinherit;` (la contraseña ya está en el `.env`, creada el 2026-11-03).
3. Comprobar que no haya partidas en curso ni nada que haga abortar el `01`, el `03`, el `04`, el `09`, el `10`, el `12` o el `14` (cada uno lo revisa solo, sin cambiar nada).

### 2.3 Replanteos

`01` a `69` en orden con `psql -v ON_ERROR_STOP=1`, uno por archivo (cada uno es una transacción y aborta solo si encuentra algo inesperado). Si uno aborta: se corrige el dato y se sigue desde ese; los anteriores ya quedaron.

Después: `notify pgrst, 'reload schema'` y las comprobaciones de la guía (las funciones del matchmaking con permisos para `mm_listener`, `manual_valores()`, `site_auth_image()` para `anon`).

### 2.4 Configuración copiada de staging

Script nuevo (`pruebas/copiar_config.sh`), de staging a producción, solo estas tablas y sus archivos:

| Qué | Tablas | Archivos |
|---|---|---|
| Matchmaking | `mm_config`, `mm_mode_settings`, `mm_mode_maps`, `mm_sounds` | Bucket `sounds`; la imagen del MVP en `photos` |
| Sitio | `site_config` (imagen del login) | `photos/site/` |
| Mapas | `map_pool` (fotos y marcas) | Las fotos en `photos` |
| Clips y equipos | `clip_config`, `team_config`, `ranking_config`, `pcw_config`, `claim_config` | — |
| Servidores | Emparejados a mano, porque los nombres no coinciden: `flow` (staging) → `Server CM League #3` (producción) y `aurav34` → `Sv v34frag #REAL`. De cada uno: `tv_port`, `hud_port`, `hud_key`, `hud_enabled`, `connect_address`, `mm_enabled`, `official_enabled`, `pcw_enabled`, y el nombre de staging. Así flow no cambia su cfg del HUD. `CMLeague #1` se copia entero, con su `token_hash`. `RBK SERVER -> SV V34frag #2` y `Test Local` quedan como están (sus partidas los nombran) | — |

No se copian cuentas, fichas, partidas, equipos ni nada de los datos de prueba de staging. Las URLs de los archivos se reescriben al dominio de producción.

### 2.5 Después

- Primera temporada (BETA) con el SQL de [`2026-10-24-frontend-ranking`](../2026-10-24-frontend-ranking/pruebas/temporada_beta_local.sql), con inicio antes del primer mix.
- Roles: moderadores y organizadores, desde Administración › Usuarios.
- Revisar en Administración › Servidores que el #1, flow y el #3 tengan sus datos, y los Workers de demos.

## 3. Supabase Auth de producción

- Hace falta un **token de acceso de la cuenta de Supabase de producción** (el `SUPABASE_ACCESS_TOKEN` del `.env` solo ve staging y vence a los 30 días).
- `node deploy/auth/configurar-auth.mjs <URL de producción> --aplicar`: SMTP de Resend, URL del sitio `https://cmleague.lat`, redirecciones y plantillas, como en staging.
- Confirmar el correo: `mailer_autoconfirm` en `false`.

## 4. VPS

| Archivo | Cambio |
|---|---|
| `/etc/cmleague/api.env` | `SUPABASE_URL` y `SUPABASE_ANON_KEY` de producción; `MM_LISTEN_URL` con `mm_listener` de producción |
| `/etc/cmleague/season.env` | `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` de producción (los usan `cmleague-season`, `-notify` y `-mm`) |
| `/etc/cmleague/demos.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` y el token del Worker de demos de producción |
| `/etc/caddy/acceso-web.caddy` | Se saca el `basic_auth` de `cmleague.lat` |

Se reinician `cmleague-api`, `-mm`, `-season`, `-notify`, `-demos` y `-hud` (el relay del HUD lee los servidores desde la API). Los archivos viejos quedan con sufijo `.staging` para volver atrás. Se suma el monitor de `https://cmleague.lat` (durante el ensayo daba 401).

La API y la web no se vuelven a compilar: son las mismas que están en staging.

## 5. Servidores de juego (los tres en la misma tanda)

| # | Cambio |
|---|---|
| **#1** (MVZG) | `csstv_api_url` de producción (el token sigue, ver 2.4), por SFTP (`SFTP_CSS_*_MVZG`). Puede quedar con su build licenciado o pasar al genérico |
| **#2** (flow) | El build licenciado de la versión actual del reporter (`server/build_licenciado.sh`), por su SFTP (`SERVER2_*`). Sus cfg siguen igual |
| **#3** (ExtremeHost) | El `.smx` genérico nuevo en `plugins/disabled/`. Nada más |

Sin recargar el plugin con una partida en curso: entra en el próximo cambio de mapa. `csstv_claim "1"` donde corresponda.

## 6. Otros que usan la base de producción

Siguen con la misma URL, pero los replanteos cambian funciones que usan. Se prueban en el ensayo:

- El Worker de demos (`cloudflare/demo-worker`).
- El render de clips del portátil (`render/procesar.py`, con `RENDER_*`).
- El aviso de clips en Discord.
- La ingesta de los reporters (`csstv_ingest` y lo que cambió el `04`).

## 7. Web vieja y otros detalles

- `csstv.gamer.gd`: Kyan deja de servir `index.html` (lo borra del hosting, con copia local), en el paso 3 del corte.
- Google: la consola de «CMLeague clips» apunta a `https://csstv.gamer.gd/privacidad.html`. Se cambia a `https://cmleague.lat/privacidad`.
- Changelog para Discord con el cambio de web.

## 8. Ensayo (antes de fijar la fecha)

En la base local con Docker, con los scripts que ya existen en [`2026-10-14-replanteo-modelo-datos/pruebas/`](../2026-10-14-replanteo-modelo-datos/pruebas/):

1. `copiar_datos.sh` (copia de producción, fuera del repo) y `cargar_datos.sh` (la carga sobre el esquema de producción).
2. Los pasos 2.2 y 2.3 igual que en el corte, anotando cuánto tarda cada uno y cuál aborta.
3. `copiar_config.sh` desde staging hacia la base local.
4. La API local contra esa base y las pruebas de humo: login con una cuenta real, perfil, ranking, mixes, equipos, manual, el matchmaking con dos cuentas.
5. `foto_elo.sql` antes y después: el ELO de cada ficha no cambia.

## 9. Requisitos antes de empezar

- Token de la cuenta de Supabase de producción (el de staging no la ve: comprobado el 2026-11-03).
- ~~Contraseña nueva para `mm_listener`~~: `MM_LISTENER_PASSWORD` en el `.env` (2026-11-03).
- Kyan disponible en el paso 3 para bajar `csstv.gamer.gd`.
- Una fecha y un horario sin partidas, con aviso previo en Discord.

## 10. Orden del corte

1. Aviso en Discord. Sin partidas en ningún servidor.
2. Respaldo: `pg_dump` completo de producción (fuera del repo) y `foto_elo.sql`.
3. Web vieja apagada.
4. Base: nicks, `mm_listener`, replanteos `01` a `69`, comprobaciones.
5. Configuración copiada de staging y temporada BETA.
6. Auth de producción.
7. VPS: los `.env`, reinicios y sin contraseña de Caddy.
8. Servidores: #1, #2 y #3.
9. Pruebas: humo de la API, registro con un correo real, login de una cuenta vieja, un mix (resultado, ELO, demo, clip, `!match`, `!claim`) y una partida del matchmaking.
10. Changelog y Google.

## 11. Volver atrás

- **Hasta el paso 3:** no se tocó nada.
- **Después:** restaurar el respaldo en producción, volver los `.env` del VPS a `.staging` con la contraseña de Caddy, el cfg del #1 a staging y subir de nuevo `index.html` a `csstv.gamer.gd`. Las partidas jugadas después del corte se perderían: por eso el paso 9 se hace enseguida.

## Anexo: primer ensayo local (2026-11-03)

> Notas del ensayo; el detalle va en la guía al terminar.

- La estructura que arma el repo (`supabase/schema/` + migraciones) es **idéntica** a la de producción (`pg_dump --schema-only`), salvo la regla local de `avatar_url_propio`.
- **El `09` abortó:** dos cuentas con el alias "musul". `pruebas/antes_de_los_replanteos.sql` renombra la segunda a `musul_2` (falta que Daniel lo confirme), junto con `geusz_2` y `Thorfinn_2`.
- **CRLF:** en Windows los `.sql` salen con CRLF (`core.autocrlf`). Aplicados así, el `52` y el `60` no encuentran el texto que reemplazan. En el corte se aplican sin CR, como hace `pruebas/ensayo_local.sh`.
- Con eso, `01` a `69` entraron completos en **32 s**.
- **Falta del ensayo:** `foto_elo.sql` antes y después, `copiar_config.sh` (por escribir), la API local contra la copia y las pruebas de humo, y los otros que usan la base (Worker de demos, render de clips, ingesta).

# Licencia por servidor: guía de implementación

## Estado

Desplegado el 2026-10-13: migración en Supabase, web publicada y plugin 1.5.0 subido al servidor real (se carga en el próximo cambio de mapa). **Pendiente**: confirmar con `sm_csstv_status` en el servidor real que dice `v1.5.0` y `Licencia: válida`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261013120000_licencia_servidores.sql` | Nuevo. Columnas de licencia en `game_servers`, `csstv_request_ip`, `csstv_check_token`, `csstv_license` y `csstv_auth` con vencimiento e IP. |
| `server/addons/sourcemod/scripting/csstv/license.inc` | Nuevo. Validación, caché `license.txt`, gracia de 72 h, `sm_csstv_license`. |
| `server/addons/sourcemod/scripting/csstv/license_id.inc` | Nuevo. `CSSTV_LICENSE_ID` vacío. |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | 1.5.0. Incluye la licencia; chequeos en `sm_live`, `!ready`, inicio por listos y recordatorio; línea "Licencia:" en `sm_csstv_status`. |
| `server/addons/sourcemod/scripting/csstv/http.inc` | La cola no se envía sin licencia. |
| `server/addons/sourcemod/scripting/csstv/qol.inc` | `sm_team` requiere licencia. |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Compilado 1.5.0 (SourcePawn 1.8.0.5963, el `spcomp` del servidor local). |
| `server/build_licenciado.sh` | Nuevo. Compila un `.smx` atado al UUID de un servidor. |
| `.gitignore` | `server/licencias/` (los builds para terceros). |
| `index.html` | Admin > Servidores: línea de licencia y botones **Vencimiento** e **IP**. |

## Despliegue (hecho el 2026-10-13)

Lo que se hizo, en orden:

- **Migración:** en el SQL Editor (Daniel).
- **Token real:** script SFTP con `paramiko` (entorno virtual aparte) que lee `cstrike/cfg/sourcemod/csstv_reporter.cfg` del servidor real sin mostrar el token y llama a `csstv_license`: `{"ok": true, "name": "Sv v34frag #REAL", "server_id": "d54dddf1-702d-4271-ab9c-8dc7941b1aa4", "expires_at": null}`.
- **Plugin:** el `csstv_reporter.smx` del servidor (57873 bytes, igual a la 1.4.0 del repo) se movió a `plugins/disabled/csstv_reporter_1.4.0.smx` y se subió la 1.5.0 (62186 bytes). El cfg no se tocó. No se recargó el plugin.
- **Web:** el `index.html` publicado era idéntico al del commit `50126cd`; se respaldó y se subió el nuevo a `htdocs/index.html` por FTP (verificado descargándolo de nuevo).

Pasos de referencia (para repetirlo o para otro servidor). El orden importa: **el plugin 1.5.0 sin la migración bloquea los mixes** (se probó: `csstv_license` da 404 y el plugin queda "NO VÁLIDA"). La migración, en cambio, no afecta al plugin 1.4.0.

1. ~~**Supabase → SQL Editor**~~ hecho el 2026-10-13.
2. **Verificar con el token del servidor real** (desde una terminal; el token está en `cfg/sourcemod/csstv_reporter.cfg` del servidor real, no se pega en el chat):
   ```bash
   curl -s -X POST "$URL/rest/v1/rpc/csstv_license" \
     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
     -d "{\"p_token\":\"$TOKEN\",\"p_version\":\"curl\"}"
   # esperado: {"ok": true, "server_id": "…", "name": "…", "expires_at": null}
   ```
3. **Web:** publicar `index.html` (después de la migración: antes, la lista de servidores da error porque pide columnas que no existen).
4. **Plugin en el servidor real** (SFTP, como en la 1.4.0):
   1. Respaldar `plugins/csstv_reporter.smx` → `plugins/disabled/csstv_reporter_1.4.0.smx`.
   2. Subir el `csstv_reporter.smx` 1.5.0. El cfg no cambia.
   3. Se carga en el próximo cambio de mapa. **No** usar `sm plugins reload` con un mix en curso (lo cancela).
   4. Verificar con `sm_csstv_status`: `v1.5.0` y `Licencia: válida · <nombre> · no vence`. En la web, el servidor muestra `plugin 1.5.0` y su última IP.

## Pruebas

### Migración (PostgreSQL 18 local)

Con el esquema mínimo de [`../2026-10-11-elo-jugadores/pruebas/stub_supabase.sql`](../2026-10-11-elo-jugadores/pruebas/stub_supabase.sql), todas las migraciones en orden, la nueva **dos veces** (para comprobar que se puede volver a ejecutar) y después [`pruebas/pruebas_licencia.sql`](pruebas/pruebas_licencia.sql):

```bash
initdb -D licdata -U postgres -A trust -E UTF8
pg_ctl -D licdata -o "-p 55432" start
psql -p 55432 -U postgres -c "create database t"
psql -p 55432 -U postgres -d t -v ON_ERROR_STOP=1 -f docs/bitacora/2026-10-11-elo-jugadores/pruebas/stub_supabase.sql
for f in supabase/migrations/*.sql; do psql -p 55432 -U postgres -d t -v ON_ERROR_STOP=1 -f "$f"; done
psql -p 55432 -U postgres -d t -v ON_ERROR_STOP=1 -f supabase/migrations/20261013120000_licencia_servidores.sql
psql -p 55432 -U postgres -d t -f docs/bitacora/2026-10-13-licencia-servidores/pruebas/pruebas_licencia.sql
pg_ctl -D licdata stop && rm -rf licdata
```

Resultado (2026-10-13): las 25 comprobaciones pasan.

| # | Prueba | Resultado |
|---|---|---|
| L1 | Servidor existente con columnas vacías | `ok: true`; guarda `last_ip`, versión y `last_seen_at`; `csstv_auth` igual que antes |
| L2 | Token inexistente | `reason: token`; `csstv_auth` → `PT401` |
| L3 | Servidor revocado | `reason: token` |
| L4 | Vencido / vigente | `reason: expired` y la ingesta rechazada / `ok` con `expires_at` |
| L5 | IP permitida | Otra IP → `reason: ip` (y no pisa `last_ip`); IP correcta → ok; `cf-connecting-ip` tiene prioridad; sin cabeceras e IP fija → rechazado |
| L6 | Ingesta con licencia vigente | `ingest_server_chunk` acepta la parte 1/2 |
| L7 | Permisos | `anon` solo puede llamar `csstv_license` (y funciona como `anon`) |

### Plugin (servidor local, `$2000$`, contra la Supabase real **sin** la migración)

Antes de arrancar se apartó de la cola `srv1-20261012T221938-3bc9.json` (pendiente desde el 2026-10-12) para que no se enviara; quedó en `data/csstv/queue_apartado/` del servidor local; se devuelve a `queue/` cuando terminen las pruebas.

| Prueba | Resultado |
|---|---|
| Arranque sin `license.txt` | `Licencia: NO VÁLIDA: no se pudo validar (HTTP 404)`; en `errors_*.log` el detalle `PGRST202` |
| `sm_live force` sin licencia | Rechazado: "Este servidor no tiene una licencia válida de CSSTV (…)" |
| `license.txt` de hace 1 hora + 404 | Gracia: "se usa la validación de hace 60 min"; mixes habilitados |
| `license.txt` de hace 4 días + 404 | Bloqueado |
| `license.txt` con fecha futura | Ignorado: bloqueado |
| `server/build_licenciado.sh` con un UUID de prueba | Compila; el `license_id.inc` del repo queda vacío |

### Plugin con la migración aplicada (2026-10-13)

`curl` a `csstv_license` con el token del servidor local: `{"ok": true, "name": "Test Local", "server_id": "8f5bd30a-…", "expires_at": null}`. Con un token falso: `{"ok": false, "reason": "token"}`.

| Prueba | Resultado |
|---|---|
| Arranque con el token del servidor local | `Licencia: válida · Test Local · no vence`; `license.txt` con la hora de la validación |
| `csstv_server_token csstv_falso` + `sm_csstv_license` | `NO VÁLIDA: token inválido o revocado`; `sm_live force` rechazado; `license.txt` en 0 |
| Volver a cargar el cfg + `sm_csstv_license` | Válida otra vez |
| `sm_live force` con bots (2 T vs 1 CT, `csstv_send 0`) | La partida arranca (en vivo, con demo); `sm_cancelmatch` sin rondas no guarda nada |
| `.smx` compilado para el UUID `11111111-…` | `NO VÁLIDA: este plugin fue compilado para otro servidor` |
| `.smx` compilado para el UUID del servidor local | Válida |

Al terminar, el servidor local quedó con el `.smx` 1.5.0 del repo. El resultado apartado (`srv1-20261012T221938-3bc9.json`) **no se devolvió a la cola**: es una prueba con bots (Norm, Andy, Jon, Ian + daniloev, 4-0) marcada como terminada, y se habría subido a la Supabase real moviendo el ELO.

**No probado en el plugin** (sí en SQL): vencimiento e IP permitida, porque requieren editar `game_servers` como admin desde la web.

## En qué se apartó del plan

Ninguno por ahora.

## Cómo revertir

1. **Plugin:** volver a subir `plugins/disabled/csstv_reporter_1.4.0.smx` como `plugins/csstv_reporter.smx` (o el de `git show 50126cd:server/addons/sourcemod/plugins/csstv_reporter.smx`). Se carga en el próximo cambio de mapa.
2. **Web:** revertir el cambio de `index.html`.
3. **Supabase** (opcional; con el plugin 1.4.0 y las columnas vacías no molesta). Para dejar `csstv_auth` como antes:
   ```sql
   create or replace function public.csstv_auth(p_token text)
   returns uuid language plpgsql security definer set search_path = public as $$
   declare sid uuid;
   begin
     select id into sid from game_servers
      where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') and active;
     if sid is null then
       raise exception 'Token de servidor inválido o revocado' using errcode = 'PT401';
     end if;
     update game_servers set last_seen_at = now() where id = sid;
     return sid;
   end $$;
   revoke all on function public.csstv_auth(text) from public, anon, authenticated;
   drop function if exists public.csstv_license(text, text);
   drop function if exists public.csstv_check_token(text);
   drop function if exists public.csstv_request_ip();
   alter table public.game_servers drop column if exists license_expires_at, drop column if exists allowed_ip,
     drop column if exists last_ip, drop column if exists plugin_version;
   notify pgrst, 'reload schema';
   ```

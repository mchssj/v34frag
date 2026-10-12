# Demos en Cloudflare R2 y partidas canceladas: guía de implementación

## Estado

| Paso | Estado |
|---|---|
| Migraciones `20261012120000` y `20261012140000` | Aplicadas en Supabase (2026-10-12) |
| `game_servers.panel_server_id` y token del Worker | Hechos (2026-10-12) |
| Plugin 1.3.0 | Subido al servidor real (2026-10-12); se activa en el próximo cambio de mapa |
| Worker | Publicado con sus secretos y la regla de 90 días en R2 (2026-10-12) |
| Borrado de demos en el servidor (`DELETE_AFTER_UPLOAD`) | Apagado hasta ver un mix real |
| Web (etiqueta "Cancelada", botón "Descargar demo") | Pendiente |

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261012120000_demos_y_canceladas.sql` | `cancelled`, columnas de demo, `panel_server_id`, `demo_workers`, `csstv_ingest` nueva, `demo_pending`, `demo_mark`, `demo_expire`, `create_demo_worker_token`. |
| `supabase/migrations/20261012140000_motivo_abandono.sql` | Motivo `abandoned`. |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | 1.3.0: `CancelMatch`, `QueueResult`, abandono (`Timer_AbandonCheck`), `!live mrN`, prórroga acotada, cvars `csstv_abandon_*` y `csstv_end_delay`. |
| `server/addons/sourcemod/scripting/csstv/json.inc` | `status`, `cancel_reason`, `cancelled_by`, `demo`; `max_rounds` real. |
| `server/addons/sourcemod/scripting/csstv/qol.inc` | `Demo_Discard`, `g_bDemoRecorded`; mínimo de `csstv_pause_time` en 5. |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Compilado 1.3.0 (release). |
| `cloudflare/demo-worker/` | Worker, `wrangler.toml`, `scripts/dev-vars.py`. |
| `docs/GUIA_SERVIDOR.md` | Canceladas, `!live mrN`, formato estándar de pruebas con bots. |
| `docs/MODELO_DATOS.md` | Columnas, tabla y funciones nuevas. |

## Despliegue (hecho el 2026-10-12)

1. **Supabase → SQL Editor:** `20261012120000_demos_y_canceladas.sql`, después `20261012140000_motivo_abandono.sql`. Si el editor avisa de RLS en `demo_workers`, elegir "Run and enable RLS" (la migración ya la activa).
2. **SQL Editor:** `update game_servers set panel_server_id = '55f80fed' where name = '…';` y el `insert` del token del Worker (final de la primera migración). El token va a `.env` como `DEMO_WORKER_TOKEN`; nunca al chat.
3. **Worker** (desde `cloudflare/demo-worker`):
   ```
   npm install
   npx wrangler login
   npx wrangler deploy
   python scripts/dev-vars.py          # arma .dev.vars desde el .env
   npx wrangler secret put PTERO_PANEL_API_KEY   # y DEMO_WORKER_TOKEN, ADMIN_KEY
   npx wrangler r2 bucket lifecycle add csstv-demos demos-90-dias demos/ --expire-days 90
   ```
4. **Plugin:** subir `csstv_reporter.smx` (respaldo de la 1.2.0 en `plugins/disabled/csstv_reporter_1.2.0.smx`) y agregar a `csstv_reporter.cfg` `csstv_abandon_players "4"`, `csstv_abandon_seconds "180"` y `csstv_end_delay "15"`. Se carga en el próximo cambio de mapa.
5. **Después del primer mix real con demo subida:** `DELETE_AFTER_UPLOAD = "true"` en `wrangler.toml` y `npx wrangler deploy`.

## Pruebas

### Supabase (PostgreSQL 18 local, `pruebas/pruebas_demos.sql`)

T1 a T13 pasan, con las migraciones aplicadas dos veces: formato viejo sin cambios, `pending` con demo, canceladas sin ganador ni ELO ni stats de perfil, motivos, idempotencia, `elo_recompute_all` ignora canceladas, tokens (malo, de servidor, del SQL Editor), 6 reintentos → `missing`, rutas inválidas rechazadas, vencimiento a 90 días, crear tokens exige admin y motivo `abandoned`.

### Plugin (servidor local, bots)

| Escenario | Resultado |
|---|---|
| `!cancelmatch` con rondas | `cancelled` / `admin` / demo conservada |
| `!cancelmatch` sin rondas | No se guarda; demo borrada |
| Cambio de mapa a mitad | `cancelled` / `map_change` |
| Partida completa | `finished`, `demo: true` |
| `!live mr99` | Rechazado |
| `!live force mr2` en `$2000$`, 3 bots contra 1 | Terminó sola 0-3 en ~1,5 minutos |
| `!live force mr1` | 1-1 → prórrogas MR1 → 5-3 |
| Abandono (`csstv_abandon_seconds 5`) | Aviso y `cancelled` / `abandoned` con demo, en 28 s |

Scripts: `pruebas/escenario_canceladas.sh` y `pruebas/escenario_abandono.sh`.

### Worker

| Prueba | Resultado |
|---|---|
| Etapa 1 (`wrangler dev --remote`): Worker → nodo en el puerto 8080 → R2 | 2 422 114 bytes, cabecera `HL2DEMO`, 4 s |
| Subida con una partida `pending` | `uploaded`, 457 052 bytes; una segunda corrida no la repite |
| Descarga | 200 con nombre `v34frag_2026-10-12_2000_0-0_cancelada.dem`; inexistente 404 |
| Publicado | `/run` sin clave 403; con clave, 0 pendientes |

## En qué se apartó del plan

- **Abandono y `!live mrN`:** no estaban en el plan. Se agregaron porque la partida de prueba de Agus quedó "en vivo" para siempre (no llegó a MR15 y se fueron), con SourceTV grabando un servidor vacío.
- **Motivo `abandoned`:** migración aparte (`20261012140000`).
- **Tiempos de prueba:** `csstv_end_delay` nuevo y mínimos más bajos para `csstv_abandon_seconds` (5) y `csstv_pause_time` (5), para que ninguna espera de prueba pase de 10 s.
- **Token del Worker:** `create_demo_worker_token` exige admin con sesión; desde el SQL Editor se usa un `insert`. Una primera versión dejaba crear tokens a cualquier usuario con sesión (`current_user` dentro de `security definer` es siempre el dueño); lo encontró la prueba T11.
- **Cuenta de Cloudflare:** el bucket y el Worker quedaron en la cuenta de Agus, que es donde se creó el bucket.

## Incidentes durante las pruebas

- **Envíos por error a la Supabase real:** el servidor local usa la misma Supabase que la web, y cada cambio de mapa recarga `csstv_send 1`. Se enviaron 8 partidas de bots; se borraron con SQL. Los scripts ahora repiten `csstv_send 0` y la guía lo advierte.
- **`$2000$` sin `.nav`:** al agregar bots el juego generó el `.nav` y recargó en `de_dust`. Ya está generado en el servidor local.
- **Demo subida a medias:** la partida de prueba se creó a mano mientras el servidor seguía grabando. En el flujo normal no pasa, porque el plugin marca `pending` después de `tv_stoprecord`.

## Cómo revertir

- **Plugin:** volver a `plugins/disabled/csstv_reporter_1.2.0.smx` y cambiar de mapa. Las columnas nuevas quedan sin usar.
- **Worker:** `npx wrangler delete` en `cloudflare/demo-worker`. Las demos en R2 se pueden borrar con `npx wrangler r2 object delete`.
- **Supabase:** las columnas son opcionales; `csstv_ingest` acepta el formato viejo. Para volver atrás del todo, reaplicar `csstv_ingest` de `20261011120000` y borrar las columnas `demo_*`, `cancel_*`, `panel_server_id` y la tabla `demo_workers`.

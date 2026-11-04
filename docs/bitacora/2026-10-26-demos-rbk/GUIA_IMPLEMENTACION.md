# Demos de RBK a Cloudflare R2: guía de implementación

## Estado

**Desplegado el 2026-10-26**: el Worker, la base de producción y el cfg de RBK. Falta la prueba de punta a punta con el primer mix de RBK (prueba 3).

## Archivos

| Archivo | Cambio |
|---|---|
| `cloudflare/demo-worker/src/index.js` | `panelKey()`: `PTERO_KEY_<panel_server_id>` o, si no está, `PTERO_PANEL_API_KEY` |
| `cloudflare/demo-worker/scripts/dev-vars.py` | `PTERO_KEY_edbee7d6` desde `SERVER1_PANEL_API_KEY` del `.env` |
| `cloudflare/demo-worker/wrangler.toml` | El comentario de secretos |
| `docs/bitacora/2026-10-26-demos-rbk/` | Esta bitácora |
| `docs/bitacora/2026-10-13-servidor-rbk/DOCUMENTACION.md` | Corrección: RBK sí arranca con `+tv_enable 1` |
| `docs/bitacora/README.md`, `docs/PENDIENTES.md` | Fila y punto 1.21 |

## Despliegue (hecho el 2026-10-26)

1. **Worker:**
   - Antes se comparó con las otras ramas: `src/index.js` es igual en las tres; `wrangler.toml` solo difiere en un comentario con `main`.
   - Secretos que ya había: `ADMIN_KEY`, `CRASH_KEY`, `DEMO_WORKER_TOKEN` y `PTERO_PANEL_API_KEY`.
   - `pnpm exec wrangler secret put PTERO_KEY_edbee7d6`, con el valor de `SERVER1_PANEL_API_KEY` por stdin.
   - `pnpm exec wrangler deploy`: versión `1475d128-1e9e-4441-bd72-835a62543130`, con los dos crons.
   - Después del deploy, la última demo subida del servidor real (`v34frag_2026-10-26_tuscan_9-3_cancelada.dem`, 26 MB) se sigue descargando: HTTP 200.
2. **Base de producción** (con las credenciales `PG_*`, en una transacción):

   ```sql
   update game_servers set panel_server_id = 'edbee7d6'
    where name = 'RBK SERVER -> SV V34frag #2' and panel_server_id is null;  -- UPDATE 1
   ```

3. **RBK** (`SERVER1_*`, por SFTP):
   - `cfg/sourcemod/csstv_reporter.cfg`: `csstv_demo "0"` pasa a `"1"`, con el comentario actualizado. Es la única línea que cambia.
   - Copia previa: `csstv_reporter.cfg.bak_20261026`. Los dos archivos se volvieron a bajar y se compararon.
   - No se reinició ni se recargó nada: el cfg se ejecuta en el próximo cambio de mapa, y desde ahí los mixes graban. El reporter crea `csstv_demos/` si no existe.
   - El servidor real no se tocó: ya graba demos.

## Pruebas

| # | Qué | Resultado |
|---|---|---|
| 1 | La key de RBK: `files/list` de `/cstrike` y descarga firmada de `steam.inf` | HTTP 200 y 55 bytes ✅. Contra nuestro servidor (`55f80fed`) da 404, así que no lo ve ✅ |
| 2 | `panelKey` | `55f80fed` → la nuestra; `edbee7d6` → la de RBK; sin el secreto de RBK → la nuestra ✅ |
| 3 | De punta a punta: primer mix de RBK | **Pendiente.** Ver abajo |
| 4 | Nuestro servidor sigue igual | La demo del último mix del real se descarga después del deploy ✅. Falta ver la subida del próximo mix del real |

**Para la prueba 3**, después del primer mix de RBK:

1. En su log de SourceMod tiene que aparecer `Grabando demo csstv_demos/rbk-....dem`. Si no aparece, SourceTV no está corriendo: se ve con `status` en la consola, buscando el bot "SourceTV".
2. A los 10 minutos como mucho, `demo_status = 'uploaded'` en `matches` y la demo se descarga desde `/demo/<uid>`.
3. El archivo ya no está en `csstv_demos/` de RBK.
4. Si queda en `pending`: `/run?key=<ADMIN_KEY>` del Worker muestra el error de esa partida.

## En qué se apartó del plan

- La prueba 2 se hizo con un script de Node sobre la función, sin `wrangler dev --remote`: la cola estaba vacía y no había nada que correr.
- `panelKey` no se exporta. Un Worker con exportaciones que no son el handler ni clases puede fallar en `deploy`.

## Cómo revertir

1. RBK: volver a poner `csstv_reporter.cfg.bak_20261026` como `csstv_reporter.cfg` (o `csstv_demo "0"`). Se aplica en el próximo cambio de mapa.
2. Base: `update game_servers set panel_server_id = null where panel_server_id = 'edbee7d6';`. Si quedaron partidas de RBK en `pending`, pasarlas a `none`.
3. Worker: `pnpm exec wrangler secret delete PTERO_KEY_edbee7d6`. El código puede quedar: sin el secreto usa la key de siempre.

# Los dos buckets de R2 no pasan de 10 GB: guía de implementación

## Estado

Implementado en local el 2026-11-10, sin commit y **sin desplegar**. Las pruebas de la elección pasan (7 de 7) y los dos Workers compilan (`wrangler deploy --dry-run`). La `106` no se probó en una base: la local no estaba levantada (Docker apagado).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/106_r2_tope.sql` | Nuevo: `demo_evict`, `clip_r2_evict_due` y `clip_r2_evicted` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/106_r2_tope.sql` | Nuevo: la inversa |
| `cloudflare/demo-worker/src/index.js` | `trimBucket`, `listAll`, `pickOldest`, el cron `TRIM_CRON` en `scheduled` y la ruta `/trim` |
| `cloudflare/demo-worker/wrangler.toml` | Cron `47 5,17 * * *` y variables `TRIM_CRON`, `R2_MAX_BYTES` y `R2_TARGET_BYTES` |
| `cloudflare/clips-worker/src/index.js` | `scheduled`, `trimBucket`, `pickInOrder`, `supabase` y la ruta `/trim` |
| `cloudflare/clips-worker/wrangler.toml` | Cron `53 5,17 * * *`, `R2_MAX_BYTES`, `R2_TARGET_BYTES`, `SUPABASE_URL` y `SUPABASE_ANON_KEY`; secretos nuevos `RENDER_TOKEN` y `ADMIN_KEY` |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx` y `terms/privacidad.html` | Plazo de las demos: "Hasta 90 días (antes, las más viejas, si se llena el espacio)" |
| `web/frontend/src/features/legal/pages/TermsPage.tsx` y `terms/terminos.html` | Las demos se borran a los 90 días o antes si se llena el espacio |
| `web/frontend/src/features/legal/lib/meta.ts` y los dos `.html` | Fecha: 10 de noviembre de 2026 |
| `docs/manual/jugador/clips-y-demos.md`, `servidor-externo/demos-y-clips.md`, `admin/elo-y-mixes.md` y `admin/clips.md` | El vencimiento antes de tiempo |
| `docs/bitacora/2026-11-10-r2-tope-10gb/` | Plan, documentación, esta guía, changelog y pruebas |

## Despliegue (pendiente)

1. **Base:** aplicar `supabase/replanteo/106_r2_tope.sql` en producción (por el túnel, `PG_*` del `.env`). Antes, `prueba_106.sql` en la local.
2. **Token de render para el Worker de clips:** crear uno propio llamado `clips-worker` (un admin con `create_render_worker_token('clips-worker')`, o el `insert` en `render_workers` con el hash, como los demás).
3. **Worker de demos** (`cloudflare/demo-worker`):
   ```sh
   pnpm exec wrangler deploy
   ```
   Ya tiene `ADMIN_KEY` y `DEMO_WORKER_TOKEN`.
4. **Worker de clips** (`cloudflare/clips-worker`), con `CLOUDFLARE_API_TOKEN=<CF_API_TOKEN_CLIPS del .env>`:
   ```sh
   pnpm exec wrangler secret put RENDER_TOKEN
   pnpm exec wrangler secret put ADMIN_KEY
   pnpm exec wrangler deploy
   ```
5. **Probar sin borrar:** `GET /trim?key=<ADMIN_KEY>&dry=1` en los dos. Debe dar `total` y `deleted: 0`.

No toca los servidores de juego (#1, #2 y #3): nada que subir ni reiniciar.

## Pruebas

### Elección de qué se borra

`node --test docs/bitacora/2026-11-10-r2-tope-10gb/pruebas/eleccion.test.mjs` (desde la raíz): 7 de 7. Prueba que no se borra nada por debajo del objetivo, que se eligen los más viejos sin importar el orden del listado, que para justo al llegar a 9,5 GB, que si no alcanza devuelve todos los candidatos, que no cambia la lista de entrada, que en clips respeta el orden de la base (destacados al final) y que un clip que ya no está en R2 entra con tamaño 0.

### Workers

`pnpm exec wrangler deploy --dry-run` en los dos: compilan (demos 12,8 KiB, clips 6,1 KiB).

### Base

`pruebas/prueba_106.sql`: **sin correr**, la base local no estaba levantada.

### Tamaño de hoy

`wrangler r2 bucket info csstv-demos` el 2026-11-10: **6,15 GB** en 172 objetos. El recorte todavía no borraría nada. El de clips no se pudo leer: `CF_API_TOKEN_CLIPS` no tiene permiso de lectura de R2 por la API (error 10000); se ve con `/trim?dry=1` después de desplegar.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

1. Sacar los crons del recorte (`47 5,17 * * *` en demos y `[triggers]` en clips) y volver a desplegar los dos Workers, o desplegar la versión anterior (`wrangler rollback`).
2. Aplicar `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/106_r2_tope.sql`.
3. Lo que ya se borró de R2 no vuelve: las demos quedan vencidas y los clips, solo en Drive.

# Los dos buckets de R2 no pasan de 10 GB: guía de implementación

## Estado

**Desplegado el 2026-11-10** (commit `0a5797e6` en `main`): la `106` en producción y los dos Workers (demos `5cde39f9`, clips `a96507ec`). Ese mismo día se corrió el recorte de clips a mano: el bucket pasó de 16,1 GB a 9,50 GB.

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

## Despliegue (hecho el 2026-11-10)

1. **Base:** la `106` y `prueba_106.sql` en producción dentro de una transacción que se deshace (las dos pruebas dieron ok con datos reales), y después la `106` de verdad, con `notify pgrst, 'reload schema'`. Por stdin a `sudo docker exec -i supabase-db psql -U postgres` en el VPS.
2. **Token de render para el Worker de clips:** `render_workers` `clips-worker`, con el `insert` del hash. El token y la `ADMIN_KEY` de `/trim` quedaron en el `.env` (`CLIPS_WORKER_RENDER_TOKEN` y `CLIPS_WORKER_ADMIN_KEY`).
3. **Worker de demos** (`cloudflare/demo-worker`):
   ```sh
   pnpm exec wrangler deploy
   ```
   Ya tiene `ADMIN_KEY` y `DEMO_WORKER_TOKEN`.
4. **Worker de clips** (`cloudflare/clips-worker`), con la sesión OAuth de wrangler (ve las dos cuentas; `CF_API_TOKEN_CLIPS` no tiene acceso al Worker):
   ```sh
   pnpm exec wrangler secret put RENDER_TOKEN
   pnpm exec wrangler secret put ADMIN_KEY
   pnpm exec wrangler deploy
   ```
5. **Probar sin borrar:** `GET /trim?key=<ADMIN_KEY>&dry=1` en los dos. La `ADMIN_KEY` de demos es la de `cloudflare/demo-worker/.dev.vars`.
6. **Recorte a mano en clips** (pedido por Daniel): `GET /trim?key=<ADMIN_KEY>`.

No toca los servidores de juego (#1, #2 y #3): nada que subir ni reiniciar.

## Pruebas

### Elección de qué se borra

`node --test docs/bitacora/2026-11-10-r2-tope-10gb/pruebas/eleccion.test.mjs` (desde la raíz): 7 de 7. Prueba que no se borra nada por debajo del objetivo, que se eligen los más viejos sin importar el orden del listado, que para justo al llegar a 9,5 GB, que si no alcanza devuelve todos los candidatos, que no cambia la lista de entrada, que en clips respeta el orden de la base (destacados al final) y que un clip que ya no está en R2 entra con tamaño 0.

### Workers

`pnpm exec wrangler deploy --dry-run` en los dos: compilan (demos 12,8 KiB, clips 6,1 KiB).

### Base

`pruebas/prueba_106.sql` en producción, junto con la `106`, dentro de una transacción que se deshace: `demo_evict ok` y `clips ok`. La local no estaba levantada.

### Tamaño de hoy

`wrangler r2 bucket info csstv-demos` el 2026-11-10: **6,15 GB** en 172 objetos. El recorte todavía no borraría nada. El de clips no se pudo leer con `CF_API_TOKEN_CLIPS` (error 10000).

### En producción (2026-11-10)

| Bucket | `dry=1` | Recorte real |
|---|---|---|
| Demos | 6,15 GB en 172 objetos: nada que borrar | No hizo falta |
| Clips | 16,1 GB en 625 objetos: borraría 269 (6,6 GB), del 2026-10-28 al 2026-11-01 | `deleted: 269`, `marked: 269`, quedó en 9,50 GB y 356 objetos |

En la base, los 269 tienen `video_drive_id` y `video_r2_deleted_at`. 165 son destacados: solo había 104 no destacados en Drive, así que siguieron los destacados, como estaba planeado. Se siguen viendo desde Drive.

## En qué se apartó del plan

Ninguno.

## Incidentes durante las pruebas

- `wrangler deploy` del Worker de clips con `CF_API_TOKEN_CLIPS` falló con "No access to the specified service". Se desplegó con la sesión OAuth de wrangler, que ve las dos cuentas. Se corrigió la nota del `wrangler.toml`.

## Cómo revertir

1. Sacar los crons del recorte (`47 5,17 * * *` en demos y `[triggers]` en clips) y volver a desplegar los dos Workers, o desplegar la versión anterior (`wrangler rollback`).
2. Aplicar `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/106_r2_tope.sql`.
3. Lo que ya se borró de R2 no vuelve: las demos quedan vencidas y los clips, solo en Drive.

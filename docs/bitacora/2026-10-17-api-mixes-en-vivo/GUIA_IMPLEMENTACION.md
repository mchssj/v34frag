# Mixes en vivo e interrumpidos en la API nueva: guía de implementación

## Estado

Hecho y probado en local el 2026-10-17, en la rama `feat/backend-api-fase-1`. **Sin desplegar:** la migración `16` y la API salen en el corte.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/16_mixes_en_vivo.sql` | Nuevo: `match_crashes.link_code` y `link_side_a`, cambios en `csstv_after_ingest` y `elo_crash_apply`, vistas `live_match_list` y `live_match_players`, y `match_list` con tres columnas más |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/16_mixes_en_vivo.sql` | Nuevo: la inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/16_mixes_en_vivo.sql` | Nuevo: 20 comprobaciones |
| `supabase/replanteo/README.md` | Fila de la `16` |
| `web/backend/src/db/types.ts` | Regenerado (`pnpm db:types`) |
| `web/backend/src/schemas/live.ts` | Nuevo |
| `web/backend/src/schemas/matches.ts` | `ReviewStatus`, `MixReview`, `cancel_reason` y `review` en el resumen (antes `cancel_reason` estaba solo en el detalle), filtro `review`, `review_detail` y `live` |
| `web/backend/src/services/live.ts` | Nuevo |
| `web/backend/src/services/matches.ts` | Columnas nuevas de `match_list`, `crashMinRounds` y `mixReview` |
| `web/backend/src/routes/live.ts` | Nuevo: 2 rutas públicas y 3 de admin |
| `web/backend/src/routes/matches.ts` | Filtro `review`; `review_detail` y `live` en el detalle |
| `web/backend/src/app.ts` | Monta `live` |
| `web/backend/test/integration/live.test.ts` | Nuevo: 6 pruebas |
| `web/backend/test/unit/live-services.test.ts` | Nuevo: 8 pruebas |
| `docs/frontend/contract.md` | Novedades, sección 8d, "Mixes interrumpidos (admin)", registro de decisiones; `!claim` pasa a la 2.2.0 |
| `docs/PENDIENTES.md`, `docs/bitacora/README.md` | Estado |

## Despliegue

Nada todavía. En el corte:
1. La `16` va después de la `15`. Necesita `20261017120000_mixes_en_vivo.sql`, que ya está en producción.
2. La API sale con el resto del backend.

## Pruebas

### Base (Supabase local)

**`pruebas/16_mixes_en_vivo.sql`**, 20 comprobaciones, todas bien:
- **Foto vinculada a una PCW BO1:** marcador, nombres de los bandos como la ingesta, partida vinculada, `player_ids`, búsqueda, 6 jugadores con ficha y rating, y `stale` a los 10 minutos.
- **Caída:** guarda el código y el lado; `match_list` la muestra pendiente.
- **Aprobar con `!match`:** terminado, vinculado a la PCW, que termina 1-0, y con ELO.
- **Aprobar sin `!match`:** no vincula.
- **Revisión en `match_list`:** `discarded`; una partida común no tiene revisión.
- **Anon:** lee las dos vistas, pero no ve `matches.link_code` ni escribe en las vistas.

**`correr.sh`** (las 16 migraciones con sus inversas y su segunda aplicación): "Todo ok".

### API

- **`live.test.ts`**, 6 pruebas contra la Supabase local, con fotos y caídas mandadas por `ingest_server_chunk` como el plugin:
  - Listado con filtros y `sort` inválido.
  - Detalle con rondas, jugadores, `ETag`/`304` y `404`.
  - Mapa en juego de la PCW con el marcador dado vuelta.
  - Cerrar como interrumpido: 403, 400 si sigue vivo, 200 y 404.
  - Aplicar el ELO: 403, 400 sin confirmación, 204 con vinculación a la PCW, 404 la segunda vez, filtro `review`.
  - Empate (400 `BUSINESS_RULE`), descartar y aplicar un descartado.
- **`live-services.test.ts`**, 8 pruebas unitarias del mínimo de rondas, `mixReview`, el resumen, el marcador dado vuelta y las rondas de la foto.
- **Suite completa:**
  - `pnpm typecheck` sin errores.
  - 247 pruebas unitarias y 79 de integración pasan.
  - Cobertura total del 93,7 %.

## En qué se apartó del plan

- **`cancel_reason` en el resumen:** antes estaba solo en el detalle. Ahora va en los dos; el detalle lo hereda del resumen.
- **Error de "ya revisado" al aplicar dos veces un aprobado:** da `404` ("no está interrumpido"), porque el aprobado ya está terminado. Uno descartado da `400` ("ya se revisó").
- **Detalle de partida, `live`:** el plan hablaba de "el juego en curso vinculado". Solo se vinculan partidas abiertas; una PCW ya terminada no muestra `live`.

## Cómo revertir

- **Antes del corte:** descartar los cambios o revertir el commit.
- **Base, después del corte:** aplicar `reversas/16_mixes_en_vivo.sql`. Se pierde el código de `!match` de los interrumpidos pendientes.

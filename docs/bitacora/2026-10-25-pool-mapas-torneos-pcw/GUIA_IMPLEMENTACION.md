# Catálogo de mapas con pool propio por torneo y por PCW: guía de implementación

## Estado

Implementado y probado en local el 2026-10-25, sin commit ni despliegue. Sale con el corte (replanteo `30`).

Falta el frontend:
- el catálogo en Administración (marcas y foto);
- el select de Mixes y la foto del marcador;
- el selector del pool al crear un torneo y al publicar una PCW.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/30_mapas_temporadas.sql` (bloques 1 a 3) | `map_pool` suma `image_url`, `mixes` y `veto_default`; `events.map_pool` y `pcw_posts.map_pool` con sus triggers; `event_max_bo` y `map_pool_check`; `create_pcw_post` con `p_map_pool`; `pcw_post_list` con el pool; `match_map_pool` en `veto_act` y en los dos avisos del veto |
| `supabase/replanteo/README.md` | Fila de la `30` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/30_mapas_temporadas.sql` | Inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/30_mapas_temporadas.sql` | Pruebas SQL (bloques 1 a 3) |
| `web/backend/src/routes/pcw-play.ts` | Catálogo con marcas, foto y filtros; `PUT` sin borrar; rutas de la foto; `map_pool` al publicar y en los anuncios |
| `web/backend/src/schemas/pcw.ts` | `MapItem`, `MapQuery`, `MapPoolItem`, `MapPoolBody`, `MapNameParam`, `MapImageUpload`, `MapPoolNames`, `PcwPostBody` y `PcwPost` |
| `web/backend/src/routes/events.ts` y `schemas/events.ts` | `map_pool` en el alta, la edición y el detalle |
| `web/backend/src/routes/matches.ts` | `veto.pool` desde `match_map_pool` |
| `web/backend/src/lib/uploads.ts` | `MAP_IMAGE_MAX_BYTES` (2 MB) |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/test/unit/pcw-routes.test.ts` | Catálogo: filtros, `PUT` sin borrar y con marcas, y validación de la foto |
| `web/backend/test/integration/tournaments.test.ts` | Usa su propio catálogo (los 8 mapas del replanteo `10`) y deja el que había. Suma torneo con pool propio, PCW con pool, `PUT` sin borrar y la foto real en el bucket |
| `web/frontend/src/api/schema.d.ts` | Regenerado |
| `docs/frontend/contrato/admin.md`, `partidas.md`, `torneos.md`, `api.md` y `README.md` | Contrato |

## Despliegue (pendiente, en el corte)

1. Aplicar `supabase/replanteo/30_mapas_temporadas.sql` después de la `29`.
   - Los mapas activos de hoy quedan en Mixes y en el pool por defecto.
   - Después, el admin marca los que no van a Mixes y da de alta los que solo se juegan en algunos torneos (por ejemplo `de_russka`), con `mixes` y `veto_default` en `false`.
2. Desplegar el backend con la web nueva.
3. Cargar las fotos de los mapas desde el admin.

## Pruebas

### Base de datos

Se probó en la Supabase local con los pasos de `pruebas/correr.sh`, sin el reset de la base. Hay 22 comprobaciones de los bloques 1 a 3, todas en verde:
- **Migración y catálogo:**
  - la migración de las marcas;
  - un retirado no queda en el pool por defecto;
  - `event_max_bo`, también dentro de `playoffs`.
- **Validaciones del pool:**
  - el mínimo, los repetidos, los retirados y los inexistentes;
  - subir el BO por encima del pool;
  - un mapa retirado que ya estaba en el pool se conserva, y uno nuevo retirado no entra;
  - la PCW con menos mapas que su BO;
  - la firma nueva de `create_pcw_post`.
- **`match_map_pool`:** torneo con pool, torneo sin pool y PCW con pool.
- **Veto con el pool del torneo:**
  - rechaza un mapa del pool por defecto que no está en el del torneo;
  - la secuencia sale de los 3 mapas del torneo: BO3, dos bans y termina;
  - los avisos de turno usan esa secuencia;
  - el pool no cambia después del primer veto.

Además, una segunda aplicación aborta y la inversa deja la estructura idéntica, con las funciones restauradas al mismo hash.

### Backend

- **Unitarias:** 313 en verde.
- **Integración:** 127 en verde (todas), con las de torneos y PCW que ya existían.
- **Typecheck:** en verde.
- **Frontend:** `tsc -b` y sus 263 pruebas en verde con los tipos nuevos.

## En qué se apartó del plan

- **Pool por defecto:** el `PUT` pide al menos **2 mapas** en el pool por defecto, no 1 como decía el plan. Es la regla de antes (2 activos), porque el pool por defecto es el que antes era el pool del veto.
- **Máximo del catálogo:** el `PUT` acepta hasta 40 mapas (antes 20), porque ahora el catálogo tiene todos los mapas y no solo los del veto. Cada pool sigue con un máximo de 20.
- **Mensajes de error:** en el `PUT`, faltar un mapa da `400` con el mensaje "Un mapa no se borra: se retira con "active": false. Faltan: …".

## Limitación conocida

En una PCW, el aviso del primer turno del veto se arma al crear la partida (`accept_pcw`), antes de que el anuncio quede vinculado (`pcw_posts.match_id`). En ese momento el aviso usa el pool por defecto.

La primera acción es `ban` en todos los casos menos uno: una PCW BO1 con un pool de 1 solo mapa, que no tiene veto y aun así recibiría el aviso. El veto en sí (`veto_act`) sí usa el pool del anuncio.

## Incidentes durante las pruebas

- **Choque de rutas:** la primera versión (tabla `maps`, plan de la [maestra](../2026-10-25-maestra-mapas/PLAN.md)) usaba las mismas rutas que el pool del veto. Fallaron 2 pruebas de integración de torneos, y de ahí salió este plan.
- **Catálogo local cambiado:** la base local tenía un catálogo distinto del sembrado: 12 nombres sin `de_` (`cache`, `dust2`, …). Ahora la prueba de torneos pone los 8 mapas del replanteo `10` y al terminar deja los que había.
- **`gen:api` contra otro servidor:** `localhost:8787` respondía con otro servidor que no era el backend de esta sesión, con una versión vieja de la API. Wrangler escuchaba en `127.0.0.1:8787`, así que los tipos se generaron contra esa dirección.

## Cómo revertir

- **Base:** aplicar la inversa `reversas/30_mapas_temporadas.sql`, que revierte también el bloque de temporadas. Las fotos que hayan quedado en `photos/maps/` se borran a mano.
- **Código:** revertir el commit del backend.

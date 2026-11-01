# Maestra de mapas (backend): guía de implementación

## Estado

Hecha el 2026-10-25 dentro de [`2026-10-25-pool-mapas-torneos-pcw`](../2026-10-25-pool-mapas-torneos-pcw/GUIA_IMPLEMENTACION.md), en local y sin commit. Ese requerimiento reemplazó el diseño de este plan.

Falta:
- el frontend;
- la advertencia "a este servidor le faltan N mapas", que necesita que el plugin informe sus mapas y queda para la etapa de los plugins.

## Archivos

Los de [`2026-10-25-pool-mapas-torneos-pcw`](../2026-10-25-pool-mapas-torneos-pcw/GUIA_IMPLEMENTACION.md). De este plan no quedó ningún archivo propio:
- `src/routes/maps.ts`, `src/schemas/maps.ts` y sus pruebas se borraron;
- la tabla `maps` nunca salió del replanteo local.

## Despliegue

El del catálogo, en el corte (replanteo `30`).

## Pruebas

Las del catálogo. La primera versión, la tabla `maps`, llegó a pasar sus 11 pruebas SQL, 9 unitarias y 4 de integración antes de descartarse.

## En qué se apartó del plan

- **Ya existía una maestra:** el pool del veto (`map_pool`, `GET /api/v1/maps` y `PUT /api/v1/admin/maps`, replanteo `10`). El plan no la tuvo en cuenta, y sus rutas chocaban con las nuevas. Daniel decidió el 2026-10-25:
  - ampliar `map_pool` en lugar de crear `maps`;
  - separar los mapas de Mixes de los disponibles;
  - sumar el pool propio por torneo y por PCW.

  Todo eso quedó en un plan nuevo, [`2026-10-25-pool-mapas-torneos-pcw`](../2026-10-25-pool-mapas-torneos-pcw/PLAN.md).
- **Lo que sigue valiendo de este plan:**
  - la foto de hasta 2 MB en el bucket `photos`, ahora en `maps/{name}/`;
  - un mapa no se borra, se retira;
  - la advertencia por servidor queda para los plugins.
- **Rutas:** los mapas se identifican por `name` (la clave de `map_pool`), no por un `id` uuid. Las rutas de la foto son `/api/v1/admin/maps/{name}/image`.
- **Nombre repetido:** al dar de alta un nombre repetido, la respuesta usa el código `CONFLICT` que ya existía, no `MAP_EXISTS`. En el catálogo, igual, el alta va por el `PUT`.

## Cómo revertir

El del catálogo.

# Partidas y Mixes en un solo listado: guía de implementación

## Estado

Implementado y probado en local el 2026-10-30, en la rama `feat/frontend-fase-1`, sin commit y sin desplegar.

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/features/matches/` (nuevo) | `MatchesList.tsx`, `search.ts`, `queries.ts` y sus pruebas |
| `src/features/mixes/MixesList.tsx` (+test) | Borrados: el listado pasó a Partidas |
| `src/features/mixes/search.ts` | Queda solo `roomSearchSchema`; sus pruebas pasaron a `features/matches/search.test.ts` |
| `src/features/mixes/queries.ts` | `liveMixesOptions` en lugar de `mixesListOptions` |
| `src/features/mixes/parts.tsx` | `DemoStatus`: sin demo, solo "—" |
| `src/features/mixes/MixRoom.tsx`, `MixRoomPages.tsx`, `DeleteMixDialog.tsx`, `src/features/player/PlayerProfile.tsx` | Los links a `/mixes` van a `/matches?kind=mix` |
| `src/features/shell/nav.ts` (+test), `AppSidebar.tsx`, `CommandMenu.tsx` | Sin Mixes en el menú; la sala marca Partidas; breadcrumbs; sin "Resultados" en ⌘K. `activeNavKey` ya no recibe los datos de la vista |
| `src/routes/_app/matches.index.tsx`, `mixes.index.tsx`, `matches.results.tsx` | La página y los redirect |
| `e2e/matches.spec.ts` (reemplaza a `mixes.spec.ts`) | Listado, filtro de mapa, links viejos y sala en vivo terminada |

## Despliegue

No se desplegó.

## Pruebas

- **Typecheck y lint:** limpios.
- **Unitarias:** 365 en verde. Las 17 de Partidas cubren:
  - KPIs, el bloque En vivo y las filas de los tres tipos;
  - los parámetros de la API y el mapa sin `de_`;
  - los chips, los toggles deshabilitados y la navegación de las filas;
  - el debounce de la búsqueda, el select de mapas, los vacíos y la paginación.
- **e2e:** 74 de 75 en verde. La que falla es la del ranking de jugadores, porque la base local no tiene temporada abierta; ya estaba pendiente.
- **Visual:** capturas en claro y oscuro (1440 px) y en el teléfono (375 px). El bloque En vivo se simuló porque la base local no tiene mixes en juego.

## En qué se apartó del plan

- **"Solo donde jugué" y "Ocultar canceladas":** el plan los daba por resueltos con la API actual (`player` y `status=finished`). Esteban prefirió pedirlos al backend (E15 y E14), así que quedaron deshabilitados con "Próximamente".
- **Activar lo que espera al backend:** no es automático. Cuando llegue cada pedido hay que regenerar los tipos de la API y prender lo suyo, porque los parámetros nuevos todavía no existen en `schema.d.ts`.
- **Datos de prueba:** las partidas de torneo sembradas no tienen fecha (`played_at` vacío) y algunas tienen el mapa "?". Se ven con "—".

## Cómo revertir

Todavía no hay commit: descartar los cambios de los archivos de la tabla, borrar `src/features/matches/` y `e2e/matches.spec.ts`, y recuperar `MixesList.tsx`, su prueba y `e2e/mixes.spec.ts` con `git checkout`.

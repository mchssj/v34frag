# Cerrar sesión visible y tabs del perfil público: guía de implementación

## Estado

Implementado y probado en local el 2026-10-30, en la rama `feat/frontend-fase-1`, sin commit y sin desplegar.

## Opciones elegidas en el artifact

Artifact: https://claude.ai/artifact/EmneWs9px6xQa2B1ttv38S

| Sección | Elección de Esteban |
|---|---|
| Cerrar sesión | A: menú de cuenta en el pie del sidebar, con confirmación; más ⌘K |
| Menú de tabs | Los tres: contadores, fijo al bajar y degradado en el teléfono |
| Mapas | Catálogo completo, los no jugados en cero |
| Partidas | Alto de 8 filas y los dos estados vacíos |
| Equipos | Corregido: actuales como tarjetas y anteriores en lista, porque se puede estar en varios equipos a la vez y una línea de tiempo no sirve |
| Temporadas | Tarjetas por temporada; corregido: chip "Mejor temporada" sólido |
| Bio y palmarés | Corregido: sin "Escrito por el jugador"; la vitrina muestra Torneos y Medallas, cada bloque solo si tiene algo |

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/features/shell/AccountMenu.tsx` | Nuevo: menú de cuenta y `LogoutDialog` |
| `src/features/shell/AppSidebar.tsx` | El pie usa `AccountMenu` |
| `src/features/shell/CommandMenu.tsx` | "Cerrar sesión" y el orden de los grupos |
| `src/features/shell/nav.ts` | La ficha propia marca el pie como activo |
| `src/features/player/tabs.tsx` | Fila de pestañas y las seis pestañas rehechas |
| `src/features/player/labels.ts` (+test) | `mapCards`, `stintLength`, `bestSeasonId`, `fmtMonthShort` |
| `src/features/maps/queries.ts` | `mapEntryOf` |
| `src/components/brand/EmptyState.tsx` | Nuevo |
| `src/components/brand/ListPagination.tsx` | Vuelve al inicio de la lista al cambiar de página |
| `src/routes/_app/*.tsx` y `src/features/events/EventView.tsx` | `resetScroll: false` en los cambios de búsqueda |
| `src/features/player/PlayerProfile.test.tsx` | Equipos, Temporadas y Bio con el diseño nuevo |
| `e2e/helpers.ts`, `shell.spec.ts`, `player.spec.ts`, `ranking.spec.ts` | Cerrar sesión por el menú; pruebas nuevas |

## Despliegue

No se desplegó.

## Pruebas

- **Typecheck y lint:** limpios.
- **Unitarias:** 364 en verde. Cubren la mezcla de mapas, la duración en un equipo y la mejor temporada.
- **e2e:** 71 de 72 en verde. La que falla es la del ranking de jugadores, porque la base local no tiene temporada abierta; ya estaba pendiente. Las nuevas:
  - el menú de cuenta: ver perfil público, el pie activo, el tema sin cerrar el menú, Cuenta y cancelar cerrar sesión;
  - ⌘K: "cerrar" + Enter abre la confirmación;
  - el scroll se mantiene al cambiar de pestaña, y al filtrar en el ranking;
  - pasar de página vuelve al inicio de la lista;
  - los contadores, los mapas sin partidas en cero, el vacío con filtros y "Quitar filtros", y la vitrina con solo medallas.
- **Visual:** capturas en claro y oscuro, a 1440 y 375 px, de cada pestaña con los datos de juanma y con equipos, temporadas y títulos simulados.

## En qué se apartó del plan

- **Biografía:** la API no deja que el jugador la edite (solo el admin, `PATCH /admin/players/{id}`), así que "Escribir biografía" quedó deshabilitado con "Próximamente". Se pidió al backend (E12 en `contrato-backend-equipo-torneos.md`).
- **Temporadas:** la API no trae la fecha de cierre ni cuántos jugadores tuvo la temporada. La tarjeta dice "Puesto final" en lugar de "#3 de 214".
- **Mapas:** cada versión jugada mantiene su tarjeta con el nombre jugado, como antes, en lugar del nombre del catálogo. Si no, dos versiones del mismo mapa se verían como dos "de_inferno".
- **⌘K:** `cmdk` 1.1.1 no reordena los grupos (busca el grupo por su id y el atributo tiene el título). Al escribir "cerrar", quedaba primero "Comparar jugadores" y Enter iba ahí. Ahora el orden de los grupos se decide en el componente con el mismo puntaje, y una palabra que empieza con lo escrito gana a una coincidencia salteada.
- **Datos:** juanma jugó `nuke_old_blue_ep`, que no está entre las versiones de `de_nuke_old_blue` en el catálogo. Se ve como mapa aparte, y `nuke_old_blue` aparece en cero. Se arregla sumando la versión en Administración › Mapas.

## Cómo revertir

Todavía no hay commit: alcanza con descartar los cambios de los archivos de la tabla y borrar `AccountMenu.tsx` y `EmptyState.tsx`.

## Cambios posteriores

- **Logo de los equipos en Equipos y en el Palmarés (2026-10-30):** `GET /players/{id}/teams` y `/titles` no traen `logo_url`, así que el escudo mostraba la sigla aunque el equipo tuviera logo.
  - **Arreglo transitorio:** `useTeamLogos` (`features/teams/queries.ts`) completa el logo con el detalle de cada equipo (`GET /teams/{id}`), la misma consulta y caché que su página. Es una consulta más por equipo, y deja de hacerse sola cuando la API mande el campo.
  - **Pedido al backend:** E13 en `contrato-backend-equipo-torneos.md`.
  - **Pruebas:** una unitaria (el logo reemplaza a la sigla) y una e2e con un equipo real con logo.
- **Nombre de la pestaña (2026-10-30):** "Bio y palmarés" pasó a "Bio y torneos", a pedido de Esteban. La vitrina de adentro sigue titulada "Palmarés".

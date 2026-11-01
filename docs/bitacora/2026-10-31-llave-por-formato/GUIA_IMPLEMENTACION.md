# Llave por formato y detalle resumido: guía de implementación

## Estado

Implementado y probado en local el 2026-10-31, en la rama `feat/frontend-fase-1` (después del merge de `refactor/frontend-estructura`). Commit del 2026-11-01 (`feat(frontend): …llave por formato…`), sin push y sin desplegar.

## Antes de empezar: merge del refactor

`refactor/frontend-estructura` (Esteban, 51 commits del frontend) salía del mismo commit que `feat/frontend-fase-1` (`68909fcf`). Nuestra rama tenía un solo commit propio (`cc1ccb84`, solo `render/`). Daniel eligió traerlo con merge (2026-10-31):

1. `git stash push --include-untracked` (los cambios sin commit de la rama).
2. `git merge origin/refactor/frontend-estructura`: commit `9b89549b`, sin conflictos en el código.
3. `git stash pop`: el único conflicto fue `docs/bitacora/README.md` (las dos ramas sumaban filas al final) y se resolvió dejando todas. Se restauró el mismo conjunto de archivos en preparación (55) y se borró el stash.
4. `pnpm install --frozen-lockfile` en `web/frontend` (suma `@tanstack/react-table` 9.3.1). El `vite` que estaba corriendo desde antes no veía el paquete nuevo y Daniel lo reinició.

El merge no se subió al remoto.

## Archivos

Todos dentro de `web/frontend/`, salvo los de la documentación.

| Archivo | Cambio |
|---|---|
| `src/features/events/lib/bracket.ts` (nuevo, + `bracket.test.ts`) | `phasesOf`, `defaultPhase`, `emptyPhaseText`, `originOf`, `destinationsOf`, `swissGrid`, `swissOptions`, `groupsOf`, `crossOf`, `scoreFrom` y `wonBy` |
| `src/features/events/lib/model.ts` (+ test) | `buildBracket` reconoce `group_upper` y `group_lower`; las secciones traen `stage` y `grp`; `STAGE_TITLE` exportado |
| `src/features/events/components/BracketTab.tsx` | Reescrito: chips de fase con `Segmented`, contexto, `PhaseView`; el lienzo pasa de 460 px fijos a entre 260 px y el 75 % del alto de la pantalla |
| `src/features/events/components/bracket/` (nuevo) | `context.ts`, `Connectors.tsx`, `MatchCard.tsx`, `MatchPopover.tsx`, `BracketTree.tsx`, `GroupsPhase.tsx`, `SwissPhase.tsx` y `GroupsDoublePhase.tsx` |
| `src/features/events/pages/EventView.tsx` | Recibe `phase` y `onPhase` y se los pasa a la Llave |
| `src/routes/_app/events.$id.tsx` | `?phase=` en la búsqueda (texto de hasta 20 caracteres) |
| `e2e/event-fixtures.ts` | Fechas completas de los grupos de "Copa Invierno 2025"; dos torneos que solo existen en el detalle ("Suizo de Primavera" y "Copa Doble 2026"); posiciones de los grupos de doble eliminación; simulación de `GET /matches/{id}` |
| `e2e/events.spec.ts` | "llave en curso" pasa a abrir el detalle; tres pruebas nuevas (grupos, suizo y grupos de doble eliminación) |
| `contrato-backend-equipo-torneos.md` | Cuarta tanda: E21 y E22 |
| `docs/PENDIENTES.md` | E21 y E22 en los pedidos al backend |

## Despliegue

No se desplegó.

## Pruebas

- **Typecheck y lint:** limpios.
- **Unitarias:** 397 en verde, 66 archivos. Las nuevas de `bracket.test.ts` cubren:
  - las fases de cada plantilla y la fase por defecto;
  - el origen en la llave y el 3.er puesto, y que gana `side.name`;
  - los destinos en doble eliminación y en grupos de doble eliminación;
  - el suizo de 16 a 3 completo, el mismo en curso con rondas proyectadas y BO de la configuración, y el de 8 a 2;
  - los grupos y los cruces.
- **e2e de torneos:** 11 de 11. "llave en curso" cubre el camino del equipo, el zoom, el origen de la final, el detalle (contexto, mapa y alineación), Esc y "Ver en vivo". Las nuevas cubren:
  - grupos: abre en Playoffs, el chip queda en la URL y sobrevive a la recarga, se ven las fechas y desde Cruces se abre el detalle de una celda;
  - suizo: los récords, las franjas, las 9 partidas por armar, VIVO y el detalle;
  - grupos de doble eliminación: upper y lower, `→ PO`, `↓ L1`, `✕ 3.º` y `✕ 4.º`, plegar un grupo y los playoffs vacíos.
- **e2e completas (antes de esta tarea, después del merge):** 68 de 75. Las 7 que fallan no tocan torneos y dependen de los datos de la base local. Por ejemplo, `player.spec` busca a `juanma` y `matches.spec` mixes en `de_cache`, y la base no tiene ninguno de los dos. También fallan la del ranking (sin temporada abierta), las de logos y la de "Pedir entrar", y una intermitente de `team.spec` ("Response has been disposed"). El código del frontend probado era exactamente el del refactor. En `refactor/frontend-estructura`, Esteban había anotado 74 de 75 contra su base.
- **Visual:** capturas de las cinco vistas en claro y oscuro (1440 px), del detalle abierto y de la hoja en el teléfono (390 px), con una prueba temporal de Playwright que después se borró. A partir de ellas se corrigió lo siguiente:
  - se quitaron las notas del suizo ("gana: clasifica"), que quedaban cortadas;
  - "Upper · ronda 1" pasó a "Ronda 1" dentro de las tarjetas de grupo;
  - se dejó lugar para la X en la hoja del teléfono.
- **Suizo terminado para mirarlo a mano** (2026-11-01): `pruebas/suizo_finalizado_local.sql` crea en la base **local** 16 equipos "… (suizo)" y un suizo de 16 a 3 victorias con playoffs de 8, y lo juega entero con el motor de la base. Se puede volver a correr (borra lo que creó antes). Nunca en la Supabase real.

## En qué se apartó del plan

- **Grupos de doble eliminación:** el plan (y la tabla del artifact) decía que hoy ya se dibujaban como secciones sueltas. En realidad, la API devuelve `group_upper` y `group_lower`, que la Llave anterior no reconocía, así que no aparecían. La prueba unitaria vieja usaba `upper` con `grp` y se corrigió.
- **E22:** el plan pedía un texto con el origen de cada lado. Al leer la base apareció que cada partida ya guarda `next_win`/`next_lose` con su lugar, así que se pidió exponer esos campos, que también resuelven los destinos. El texto en `side.name` se sigue aceptando si llega.
- **Números de los pedidos:** el plan los llama E19 y E20, pero esos números ya estaban usados en `pendientes-backend-cmleague.md` del backend (E19, búsqueda global ⌘K; E20, totales de las temporadas). Se renumeraron como **E21** (rating de la serie) y **E22** (`next_win`/`next_lose`) el 2026-11-01.
- **Chips:** en `single` y `double` no se muestran, porque tienen una sola fase. El plan los mostraba siempre.
- **Notas del suizo:** el artifact las tenía ("gana: clasifica", "decisiva"). Se quitaron por espacio y para seguir el ejemplo de Daniel, que no las tiene.
- **Mapa de ventaja:** se muestra en el detalle (`advantage_side`), no como chip en la tarjeta de la gran final, porque `EventMatch` no trae ese dato.

## Cómo revertir

Todo está en un solo commit de `feat/frontend-fase-1` (el de `feat(frontend)` de la Llave por formato, 2026-11-01). Se deshace con `git revert <commit>`, que también quita la cuarta tanda del contrato, la fila del README de la bitácora y la línea de E21 y E22 en `docs/PENDIENTES.md`. El merge del refactor (`9b89549b`) es independiente.

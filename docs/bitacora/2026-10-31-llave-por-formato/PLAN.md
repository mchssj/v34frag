# Plan: la Llave dibuja cada fase de cada formato y abre el detalle resumido

> Planeación original. Estado: **aprobado por Daniel (2026-10-31)** sobre el [artifact "Llave por formato"](https://claude.ai/artifact/KVNcaxAUK9BPQWREvY5Huj) (versión 3, con el suizo solo con escudos).

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Alcance | Cada fase de cada plantilla (`single`, `double`, `groups`, `swiss`, `groups_double`) se ve en la pestaña Llave | Hoy la fase de grupos y el suizo no aparecen: solo están en Posiciones como tablas |
| Clic en una partida | Abre un detalle resumido (popover) junto a la tarjeta, en el celular como hoja desde abajo; desde ahí, "Ver partida" | Pedido de Daniel, como en `formatosuizo2.png`. El diseño del popover queda como en el artifact |
| Fases | Un chip por fase arriba del lienzo, con punto de estado; abre en la fase en curso y la guarda en la URL (`?tab=bracket&phase=…`) | Opción propuesta y no objetada (Daniel, 2026-10-31) |
| Colores | Verde para el ganador y rojo para el perdedor (`--win` y `--destructive`) | Daniel, 2026-10-31 |
| Grupos (`groups`) | Tarjeta por grupo: tabla corta y partidas por fecha; selector "Fechas / Cruces", **por defecto en Fechas** | Daniel, 2026-10-31 |
| Suizo | Grilla por récord como `formatosuizo1.png`: un recuadro por récord con fondo verde o rojo suave, **solo los escudos** en cada partida, flechas verdes y rojas, franjas de clasificados y eliminados, rondas futuras punteadas | Daniel pidió la versión 3 del artifact: sin siglas ni marcador fuera del popover |
| Grupos de doble eliminación | Tarjeta por grupo con upper y lower juntos y marcas de destino (`→ PO`, `↓ L1`, `✕ 3.º`) | Como `grupos1.png` y `grupos2.png` |
| De dónde sale cada lado por definir | Lo manda el backend (pedido **E20**); mientras tanto el frontend lo deduce en las llaves de eliminación y, si no puede, muestra "Por definir" | Daniel, 2026-10-31: "me parece bien que lo envíe el backend" |
| Rating de la serie en el popover | Pedido **E19**; sin él, las alineaciones van sin rating | Hoy `MatchDetail.players` solo viene en los mixes |
| Siembra | Del listado de inscritos (`seed`), sin pedido al backend | Ya está en `GET /events/{id}/registrations` |
| Estructura | Sobre la estructura de `refactor/frontend-estructura` (traída con merge el 2026-10-31) y sus piezas comunes (`Segmented`, `Badge`, `Card`, `Popover`, `Sheet`) | Evita volver a hacer a mano lo que el refactor ya pasó a shadcn |

## 1. El flujo completo

```mermaid
flowchart LR
  A[GET /events/id/matches] --> B[phasesOf: fases de la plantilla]
  R[GET /events/id/registrations] --> S[siembra por equipo]
  T[GET /events/id/standings] --> G
  B --> C{tipo de fase}
  C -->|llave| D[BracketTree: columnas, conectores, campeón]
  C -->|grupos| G[GroupsPhase: tabla + fechas o cruces]
  C -->|suizo| W[SwissPhase: grilla por récord]
  C -->|grupos doble| H[GroupsDoublePhase: upper y lower por grupo]
  D & G & W & H -->|clic| P[MatchPopover]
  P --> M[GET /matches/id: mapas y rosters]
  P -->|Ver partida| N[/match/id]
```

La pestaña arma la lista de fases a partir de las partidas y la plantilla, muestra la elegida (o la que está en curso) y cada tarjeta abre el mismo popover, que pide el detalle de la partida solo al abrirse.

## 2. Fases por plantilla

| Plantilla | Fases (chips) | Etapas (`stage`) |
|---|---|---|
| `single` | Playoffs | `ko`, `third` |
| `double` | Llave | `upper`, `lower`, `grand` |
| `groups` | Fase de grupos · Playoffs | `group` · `ko`, `third` |
| `swiss` | Fase suiza 1…n · Playoffs | `swiss` por `phase` · `ko`, `third` |
| `groups_double` | Grupos · Playoffs | `upper`/`lower` con `grp` · `ko`, `third` |

- Estado de cada chip: en vivo si tiene una partida `live`; terminada si todas están `finished`; si no, por jugar. Playoffs aparece aunque todavía no tenga partidas, con el aviso "Se arma cuando termina…".
- Fase por defecto: la primera con una partida en vivo; si no, la primera con partidas por jugar; si no, la última.
- `?phase=` en la ruta `events/$id` (texto: `playoffs`, `groups`, `swiss-1`…; si no existe, se ignora).

## 3. Lógica nueva en `features/events/lib/`

Funciones puras con sus pruebas en Vitest (en `bracket.ts` y `bracket.test.ts`, para no seguir agrandando `model.ts`):

- `phasesOf(matches, template, config)` y `defaultPhase(phases)`.
- `buildBracket` se mantiene para las llaves y suma por lado: destino (`↓ L2` si el perdedor aparece después en el lower, `✕` si no juega más, `→` al pasar a la gran final o a playoffs) y origen por definir (`side.name` si viene del backend; si no, "Ganador de <label>" deducido por ronda y posición).
- `swissGrid(matches, wins, size)`: el récord de cada partida se calcula repitiendo las rondas terminadas en orden; agrupa por ronda y récord; proyecta los recuadros de las rondas que todavía no existen (los equipos de cada récord se reparten por mitades) y los muestra como partidas por armar; arma las franjas de clasificados (`w = wins`) y eliminados (`l = wins`) con los equipos ya definidos.
- `groupPhase(matches, standings)`: fechas por grupo y la tabla de cruces (con ida y vuelta si `double_rr`).

## 4. Componentes en `features/events/components/`

- `BracketTab.tsx`: barra con los chips de fase, zoom, "Ajustar" y el lienzo con arrastre (se mantienen). La altura pasa de 460 px fijos a ajustarse al contenido con un tope.
- `bracket/BracketTree.tsx`: columnas, conectores en SVG entre rondas (se iluminan con el camino del equipo), campeón y 3.er puesto.
- `bracket/MatchCard.tsx`: franja verde o roja por lado, siembra, hora si está por jugar, VIVO, borde punteado sin equipos, marca de destino. Pasa de `Link` a `button` que abre el popover.
- `bracket/GroupsPhase.tsx`, `bracket/SwissPhase.tsx` y `bracket/GroupsDoublePhase.tsx`.
- `bracket/MatchPopover.tsx`: `Popover` de shadcn (en el celular, `Sheet` desde abajo con `useIsMobile`). Pide `matchDetailOptions(id)` al abrirse; muestra equipos con siembra, marcador, fase, BO, estado y servidor, mapas (`maps_detail`), alineaciones (`roster1` y `roster2`), de dónde sale cada lado si falta, y "Ver partida" o "Ver en vivo".
- El camino del equipo bajo el cursor funciona en todas las fases. El arrastre de más de 3 px sigue anulando el clic.

## 5. Pedidos al backend (contrato)

Cuarta tanda en `contrato-backend-equipo-torneos.md`:

- **E19. Rating de cada jugador en la serie:** `series_players` en `MatchDetail` de torneo y PCW (alias, lado y rating ponderado por rondas de los juegos vinculados). El frontend suma la columna de rating cuando llegue.
- **E20. De dónde sale cada lado por definir:** en `EventMatch.side1/side2`, un texto (`source`, o `name` documentado) como "Ganador de Semifinal 1", "Perdedor de la final del upper" o "1.º Grupo A". El frontend deja de deducirlo cuando llegue.

Se anotan también en `docs/PENDIENTES.md`.

## 6. Pruebas

- Vitest: `phasesOf`, `defaultPhase`, destinos y orígenes, `swissGrid` (16 equipos a 3 victorias y 8 a 2, fase en curso con rondas proyectadas) y `groupPhase`.
- Playwright (`e2e/events.spec.ts` y sus fixtures): se adapta "llave en curso" (el clic abre el popover y "Ver partida" navega) y se suman casos de grupos (Fechas/Cruces), suizo (recuadros, franjas, popover) y grupos de doble eliminación.
- Revisión visual en el navegador de cada plantilla en claro y oscuro.

## 7. Requisitos antes de empezar

- Merge de `refactor/frontend-estructura` en `feat/frontend-fase-1` (hecho el 2026-10-31, commit `9b89549b`) y `pnpm install --frozen-lockfile`.
- API local levantada en `:8787` para las e2e.

## 8. Orden de implementación

1. `lib/bracket.ts` con sus pruebas (fases, destinos, orígenes, suizo, grupos).
2. `MatchCard` y `MatchPopover`, y el cambio de `Link` a popover en la llave actual.
3. Chips de fase y `?phase=` en la ruta.
4. `GroupsPhase`, `SwissPhase` y `GroupsDoublePhase`.
5. Conectores y camino del equipo en todas las fases; altura del lienzo.
6. Fixtures y e2e; revisión visual.
7. E19 y E20 en el contrato y en `PENDIENTES.md`; `DOCUMENTACION.md`, `GUIA_IMPLEMENTACION.md` y la fila del README.

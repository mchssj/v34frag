# Plan: Torneos (listado y detalle)

> Planeación original. Estado: **en implementación** desde el 2026-10-25. Las decisiones de abajo son las que tomó Claude por defecto; Esteban puede cambiarlas al revisar.

Handoff: `CSSTV/desings/handoff_torneos/`:
- `README.md`;
- `Pedidos al backend.md`;
- `referencia-visual/Tournaments.dc.html`, que se abre dentro de `CSSTV.dc.html` → Torneos.

Dos vistas:
- **Listado** (`/events`);
- **Detalle** (`/events/{id}`), con las pestañas Resumen, Llave, Posiciones y Partidas.

Reemplazan los placeholders `routes/_app/events.index.tsx` y `events.$id.tsx`.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Endpoints | Los reales, `GET /events…`, no los `/tournaments` del pedido del handoff | El backend ya tiene torneos con otro nombre y más datos de los que pide el handoff |
| Lo que el backend no tiene | Banner: el patrón rayado del prototipo, sin el texto "Banner del torneo". Cierre de inscripciones: no se muestra | No hay `banner_url` ni `registration_closes_at`. El texto del slot es una indicación para el diseñador, no para el jugador |
| BO y etapa en las tarjetas del listado | Se piden el detalle de cada torneo y, solo para los que están en curso, sus partidas. Comparten la clave de caché con el detalle | `EventSummary` no trae `config` ni la etapa actual. **Es un rodeo:** se pide al backend que el listado los traiga (pedido 1) y entonces se quitan esos pedidos |
| Etapa actual y partida en vivo | Se deducen de las partidas: la primera en vivo y, si no hay, la próxima. El nombre es su `label` ("Semifinal") | No hay `current_stage` ni `live_match`, pero `label` ya viene del backend |
| Barra de progreso "En curso" | Partidas terminadas sobre el total, sin contar los libres | Es un dato real. El prototipo usa un número fijo |
| Llave | Genérica para las cinco plantillas: una sección por etapa de llave (`ko`, `third`, `upper`, `lower`, `grand`, y en `groups_double` cada grupo con su upper y lower), con columnas por `round` y filas por `pos`. Los títulos de columna salen de `label`. La columna "Campeón" va después de la final | El backend da la posición de cada partida; la del prototipo solo sirve para eliminación directa |
| Fase de grupos y suizo | No van en Llave (son todos contra todos o cruces por récord): van en Posiciones y en Partidas | No son llaves |
| Llave sin fixture | Mensaje "La llave se arma cuando se cierran las inscripciones." en un recuadro punteado, sin esqueleto de "Por definir" | Hasta generar no hay partidas; inventar el esqueleto obligaría a adivinar la forma en cada plantilla |
| Posiciones, grupos | Una tabla por grupo con #, Equipo, PJ, G, P, Rondas y Pts. **Sin la columna E** | En el sistema no hay empates (victoria 3, derrota 0); una columna siempre en 0 no informa |
| Posiciones, otras plantillas | Suizo: tabla por fase con récord, Buchholz y estado. Grupos de doble eliminación: puesto, G, P, rondas y estado. "Clasifica" con `state = qualified` o, en grupos, `place ≤ advance` | Lo que trae `GET /standings` |
| Empate pendiente | Chip "Empate" en las filas con `tied` y un aviso arriba de la tabla | `tie_pending` y `tied` |
| Reglas | El texto `rules` del torneo, un ítem por línea. Sin texto: las reglas fijas del prototipo, con el vocabulario de Equipo ("roster") | El organizador carga las reglas; las del prototipo son las de la liga |
| Sorteo | "Sorteado por {alias} el {fecha}" en Información | Lo pide el contrato |
| CTA "visitante" | No se implementa | `/events` está dentro del layout con sesión |
| Inscribir | Diálogo con el roster del equipo: los Activos marcados, los Suplentes para sumar, el coach y los que no tienen SteamID deshabilitados. Entre `players_min` y `players_max`. `PUT /events/{id}/registrations/{teamId}` | Lo pide el handoff y lo valida el backend |
| Líder de varios equipos | El diálogo empieza eligiendo el equipo | Lo pide el handoff |
| Ya inscripto | "Cancelar inscripción" (outline, con confirmación) y "Cambiar inscritos", que abre el mismo diálogo. Nota: "puedes cancelar hasta que se arme el fixture" | El backend deja cambiar hasta generar el fixture; no hay fecha de cierre |
| En curso sin partida en vivo | "Ver partidas" (outline), que abre la pestaña Partidas, con la nota "Próxima: {etapa}" | No hay nada en vivo que mostrar |
| Cancelado | Chip "Cancelado", sin CTA. En el listado, en "Todos", al final | El backend tiene el estado `cancelled` |
| Rutas | `/events?status=registration|in_progress|finished` y `/events/{id}?tab=bracket|standings|matches` (Resumen sin `tab`). El zoom y el resaltado son estado local | URLs en inglés; se pueden enlazar y funciona Atrás |
| Vocabulario | "roster" y "líder", como pide el handoff | Alineado con Equipo |

## 1. El flujo completo

```mermaid
flowchart TD
  L["/events"] -->|GET /events| C[Tarjetas]
  C -->|detalle y partidas por tarjeta| C
  C --> D["/events/{id}"]
  D -->|GET /events/{id}| H[Cabecera y CTA]
  D -->|GET /registrations| R[Resumen: inscritos]
  D -->|GET /matches| K[Llave y Partidas]
  D -->|GET /standings| P[Posiciones]
  H -->|líder| I[Diálogo de inscripción]
  I -->|GET /teams/id/members| I
  I -->|PUT o DELETE /registrations/teamId| R
```

## 2. Qué hay en el backend y qué no

| Parte del handoff | Backend | Cómo queda |
|---|---|---|
| Listado, filtro por estado | `GET /events?status=` | Real |
| Formato, fechas, premio, inscritos, campeón | `EventSummary` | Real |
| BO y BO de la final en la tarjeta | Solo en el detalle (`config`) | Real, con un pedido por tarjeta (rodeo, pedido 1) |
| Etapa actual en la tarjeta | — | Deducida de las partidas (pedido 1) |
| Banner | — | Patrón rayado (pedido 2) |
| "Cupo · cierra en…" | — | Solo "Cupo" (pedido 3) |
| Cabecera, Información | `EventDetail` (`config`, `players_min`, `players_max`, `draw`) | Real |
| Reglas | `rules` | Real, con las del prototipo si viene vacío |
| Equipos inscriptos con siembra | `GET /events/{id}/registrations` | Real |
| Llave | `GET /events/{id}/matches` (`stage`, `phase`, `grp`, `round`, `pos`, `label`) | Real |
| Posiciones | `GET /events/{id}/standings` | Real |
| Partidas | `GET /events/{id}/matches?sort=starts_at` | Real |
| Partida en vivo del CTA | — | Deducida (`status = live`); sin "Mapa n de n" (pedido 4) |
| Inscribir, cambiar inscritos, cancelar | `PUT`/`DELETE /events/{id}/registrations/{teamId}` | Real |
| Mis inscripciones | — | Deducida: inscritos del torneo cruzados con mis equipos de `GET /me/profile` |

## 3. Estructura (`web/frontend/src/features/events/`)

- `queries.ts`: listado, detalle (clave `["event", id]`, la que ya usa el breadcrumb), inscritos, partidas, posiciones, y las mutaciones de inscribir y cancelar con sus invalidaciones.
- `model.ts` (lógica pura, con pruebas):
  - etiquetas de plantilla y estado, y el chip de cada estado;
  - el BO y el BO de la final según la plantilla (`config`);
  - fechas ("05 jul – 02 ago") y premio;
  - etapa actual, partida en vivo y progreso, a partir de las partidas;
  - armado de la llave: secciones, columnas y filas;
  - tablas de posiciones por grupo o fase, y quién clasifica;
  - CTA según el estado y mis equipos;
  - reglas (texto o las fijas).
- Componentes:
  - `EventList` (filtro y tarjetas) y `EventCard`;
  - `EventHeader` (banner, chip, nombre, CTA) y `EventTabs`;
  - `SummaryTab`, `BracketTab` (zoom, arrastre y resaltado), `StandingsTab`, `MatchesTab`;
  - `RegisterDialog`.
- `routes/_app/events.index.tsx` y `events.$id.tsx` con `validateSearch` (zod).
- `features/shell/queries.ts`: el breadcrumb usa la consulta de detalle de `events/queries.ts`.

## 4. Pruebas

- **Unitarias:** `model.ts` (plantillas y BO, llave con varias etapas, posiciones, CTA, etapa actual).
- **e2e:** la base local no tiene torneos, así que se simulan las rutas de torneos con `page.route` (`e2e/event-fixtures.ts`), como en Equipo:
  - listado con los tres estados, filtro y orden;
  - detalle en inscripciones con el líder: inscribir eligiendo jugadores (comprueba el `PUT`), cancelar (comprueba el `DELETE`), y el jugador sin liderazgo con el CTA deshabilitado;
  - llave en curso: partida en vivo, resaltado al pasar el cursor, zoom y clic hacia la partida;
  - posiciones con grupos y sin grupos;
  - partidas con sus estados.
- **Contra la API real:** se crea en la base local (nunca en producción) un torneo de prueba, se generan el fixture y algunos resultados, y se comprueba que las formas reales coinciden con las simuladas.
- **Visual:** capturas en claro y oscuro, y sin desborde de 320 a 1440px.

## 5. Pedidos al backend

1. En `GET /events`: el BO y el BO de la final (o `config`) y la etapa actual.
2. `banner_url` (y subirlo desde el panel del organizador).
3. Fecha de cierre de inscripciones.
4. Partida en vivo del torneo con el mapa que se está jugando ("Mapa 2 de 3").

## 6. Requisitos antes de empezar

- La API local (`csapi5`) y la base de Docker levantadas.
- La cuenta compartida de las e2e.

## 7. Orden de implementación

1. `queries.ts` y `model.ts` con sus pruebas.
2. Listado.
3. Detalle: cabecera, pestañas y Resumen.
4. Llave.
5. Posiciones y Partidas.
6. Diálogo de inscripción.
7. e2e, torneo de prueba en la base local y capturas.
8. `DOCUMENTACION.md`, `GUIA_IMPLEMENTACION.md`, la fila del `README.md` y `web/frontend/CLAUDE.md`.

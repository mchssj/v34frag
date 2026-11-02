# Gestión de torneos: guía de implementación

## Estado

- **Backend:** implementado y probado en local el 2026-11-01, con commit en `feat/backend-api-fase-1` (sin push).
- **Frontend:** implementado y probado en local el 2026-11-01, con commit en `feat/frontend-fase-1` (sin push), después del merge del backend.

Sin desplegar.

## Archivos (backend)

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/41_admin_torneos.sql` | Nuevo |
| `supabase/replanteo/README.md` | Fila de la `41` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/41_admin_torneos.sql` | Nueva: inversa (los mixes vinculados y los resultados se quedan) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/41_admin_torneos.sql` | Nuevas: 39 pruebas SQL, con rollback |
| `web/backend/src/routes/events.ts`, `schemas/events.ts` | `POST /events/{id}/seeds/ranking`, `SeedsResult`, `viewer.can_own` |
| `web/backend/src/routes/matches.ts`, `schemas/matches.ts` | `GET /matches/{id}/games/candidates`, `PUT /matches/{id}/maps`, `GameCandidate`, `SeriesMap`, `SeriesMapsBody` |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/src/routes/pcw-play.ts` | `GET /servers` también para los moderadores (para asignar el servidor de una partida) |
| `web/backend/test/integration/admin-torneos.test.ts` | Nuevo: moderador (siembra por ranking, etapas, sin cancelar ni borrar, reiniciar) y mapas de una serie |
| `docs/frontend/contrato/` | `torneos.md`, `partidas.md` y la novedad en `README.md` |
| `supabase/replanteo/42_torneo_fin_real.sql` (+ inversa y 3 pruebas) | Ajuste del 2026-11-01: `event_list.finished_at` y el trigger `matches_played_at` |
| `web/backend/src/routes/events.ts`, `schemas/events.ts` | `EventSummary.finished_at`; `ends_on` descrito como tentativo |

## Archivos (frontend)

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/admin/events/lib/model.ts` (+ prueba) | Lógica pura: "Qué falta", presets y conteos del suizo, bloques de la siembra, cruces (llave, suizo, serpentina), mover en la lista y validar los mapas de una serie |
| `web/frontend/src/features/admin/events/api/queries.ts` | Lista, crear y editar, generar, volver a la siembra, cancelar, borrar, siembra (ranking, sorteo, a mano), quitar inscripciones, horario y servidor, candidatos, mapas de la serie y W.O. |
| `web/frontend/src/features/admin/events/pages/AdminEventsPage.tsx` | Lista con estado, búsqueda y "Qué falta"; el organizador ve solo los suyos; el moderador no ve "Crear torneo" |
| `web/frontend/src/features/admin/events/pages/AdminEventPages.tsx` | Crear torneo y gestionar uno (pestañas en `?tab=`) |
| `web/frontend/src/features/admin/events/components/EventForm.tsx` | Formulario de crear y editar: datos, plantilla, configuración con los presets del suizo, resumen de cómo se juega y pool de mapas |
| `web/frontend/src/features/admin/events/components/SeedingTab.tsx` | Siembra: por ranking, sorteo, arrastrar, ▲ ▼ y Alt + flechas, bloques de etapas y vista previa de los cruces |
| `web/frontend/src/features/admin/events/components/ManageTabs.tsx` | Resumen (pasos, avisos, generar, volver a la siembra, empates), Inscripciones y Configuración (cancelar y borrar solo con `can_own`) |
| `web/frontend/src/features/admin/events/components/MatchesTab.tsx`, `MatchSheet.tsx` | Partidas con horario y estado; el panel de una partida: horario y servidor, cada mapa con mix vinculado o resultado a mano, W.O. y anular |
| `web/frontend/src/routes/_app/admin.events.index.tsx`, `admin.events.new.tsx`, `admin.events.$id.tsx` | Rutas (reemplazan a `admin.events.tsx`, que era un marcador) |
| `web/frontend/src/auth/permissions.ts` (+ prueba) | El moderador entra a Torneos |
| `web/frontend/src/features/events/components/bracket/MatchPopover.tsx` | "sin detalle" en los mapas cargados a mano y el aviso "Sin detalle de la partida" si ninguno tiene mix |
| `web/frontend/src/routeTree.gen.ts` | Regenerado |

## Despliegue (pendiente)

1. Staging: la `41` **cargada en staging el 2026-11-01** (con la 39 a la 44; las pruebas SQL de la 40 a la 44 pasaron allá también). La API del VPS se redesplegó el mismo día (`714ec78ae865`).
2. Corte: la `41` va después de la `40`.
3. No toca el plugin.

## Pruebas (backend)

Contra la Supabase local, el 2026-11-01:

- SQL de la `41`: 39 de 39. La inversa se probó ida y vuelta.
- `pnpm typecheck`: sin errores.
- `pnpm test`: 396 unitarias.
- `pnpm test:int`: 174 de integración (2 nuevas).

## Pruebas (frontend)

- `pnpm exec tsc -b` y `pnpm lint`: sin errores.
- `pnpm test`: las 8 de `lib/model.test.ts` (nuevas) y el resto de la suite.
- **Recorrido real** con una prueba temporal de Playwright (después se borró), con una cuenta admin en la base local y capturas a 1440 px:
  1. La lista.
  2. Crear con el preset "Major expandido · 32" (32 equipos, 106 partidas).
  3. En un suizo de 2 etapas de 8 con 12 inscritos ("Suizo admin (inscripciones)", armado por SQL en la base local): sembrar por ranking, subir el 9 con ▲ (pasa a la etapa 2 y quedan las marcas "a mano") y guardar.
  4. Generar el fixture.
  5. Cargar a mano un 16-10 en una partida BO1 ("la llave avanza").
  6. Comprobar que "Volver a la siembra" se rechaza porque ya se jugó una partida.

## En qué se apartó del plan

- **Rutas:** `GET /matches/{id}/games/candidates` (el plan decía `/games/candidates` sin detallar) y `PUT /matches/{id}/maps`.
- **Sin puntos:** un equipo sin partidas cuenta 0 puntos (no "al final"): con eso, el ELO ordena a todos los que tienen 0, también a los que jugaron y perdieron.
- **Vincular un mix:** no exige que todos los jugadores sean del plantel (como `!match`); alcanza con que haya jugado un inscrito, porque lo decide una persona. El bando se deduce por mayoría y se puede invertir con `side1`.
- **Página de la partida:** la de torneo y PCW todavía es un marcador (solo los mixes tienen sala). Por eso "Sin detalle de la partida" se muestra en el detalle resumido de la Llave, que es donde hoy se ven los mapas y las alineaciones de una partida de torneo.
- **Siembra en la lista:** las filas muestran los activos inscritos, no los puntos ni el ELO (la API de inscripciones no los trae); el orden por ranking lo hace la base.
- **Servidores:** `GET /servers` era solo para organizadores y admins; se sumaron los moderadores, que también asignan el servidor de una partida.
- **Cancelar:** como la API cancela con un `UPDATE` que permite la política de gestión, el bloqueo al moderador es un trigger (`events_owner_only`), no la política.

## Ajuste: fin tentativo y fin real (2026-11-01)

Daniel pidió que "Termina" sea una fecha tentativa: el torneo puede terminar antes o después.

- **Antes:** `ends_on` ya era opcional y nada dependía de ella (el torneo termina cuando se juega la final), salvo la fecha que se mostraba del campeón ("Campeón · hace X días"), que salía de `ends_on`.
- **Ahora:**
  - `event_list.finished_at` (replanteo `42`) es la fecha de la última partida terminada. La API la devuelve en `EventSummary.finished_at` y el frontend la usa para el campeón; si falta, usa `ends_on`.
  - En el formulario, el campo se llama "Termina (aproximado)".
  - El único control sigue siendo que no sea anterior a "Empieza", y solo en el formulario: la API no lo valida.
- **Partidas sin fecha:** un resultado a mano o un W.O. no ponían `played_at`, así que esos torneos no tenían fecha de fin. El trigger `matches_played_at` les pone la del momento en que se carga el resultado (solo torneo y PCW; los mixes la traen del servidor). Las partidas viejas sin fecha siguen sin ella.

## Ajuste: cupo del suizo y aviso de equipos (2026-11-01)

Daniel aprobó dos cambios, solo del frontend:

- **Cupo automático, solo en el suizo:** es el único formato que pide un número exacto de equipos. Al elegirlo o cambiar sus etapas o equipos por etapa, "Cupo de equipos" se completa con lo que pide (24, 32, 16 u 8) y se puede cambiar a mano. Un torneo nuevo arranca con 24 (el suizo por defecto). Al pasar a otro formato, el cupo que había puesto el suizo se borra; uno escrito a mano queda. Los otros formatos aceptan un rango (eliminación: desde 2; grupos: al menos 2 por grupo; grupos con doble eliminación: de 4 a 8 por grupo), así que no completan nada.
- **Aviso en el Resumen:** si los inscritos no entran en lo que pide el formato, por ejemplo "El suizo necesita 24 equipos y hay 21: faltan 3." o "Con 2 grupos hacen falta entre 8 y 16 equipos y hay 17: sobran 1.". Bloquea "Generar fixture", igual que haría la base al generar.
- **Archivos:** `web/frontend/src/features/admin/events/lib/model.ts` (`swissCupo`, `teamsNeeded`, `teamsIssue`, con pruebas en `model.test.ts`), `components/EventForm.tsx` y `components/ManageTabs.tsx`.
- **Pruebas:** typecheck, lint y 414 unitarias.

## Cómo revertir

1. Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/41_admin_torneos.sql`.
2. Código: `git revert` de los commits del backend y del frontend.

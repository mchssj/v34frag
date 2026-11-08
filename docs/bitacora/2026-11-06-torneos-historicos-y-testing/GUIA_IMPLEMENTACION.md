# Torneos históricos, aprobación de organizadores y fase de testing: guía de implementación

## Estado

Implementado y probado en local el 2026-11-06 (base, API y web, con un recorrido en el navegador por rol). Commit `b79c62b6` en `main` y su copia `072bf468` en `feat/frontend-fase-1` (2026-11-07). **Desplegado el 2026-11-07 (17:16-17:21 UTC)** desde `main`: la `80` en la base del VPS, API y web `b79c62b67d88`. Falta publicar el `CHANGELOG_DISCORD.txt`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/80_torneos_historicos_testing.sql` | Nuevo. Columnas, visibilidad, aprobación, histórico, ranking y avisos (detalle en la cabecera) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/80_torneos_historicos_testing.sql` | Nueva. La inversa; aborta si hay históricos, torneos en testing o pendientes |
| `supabase/replanteo/README.md` | Fila de la `80` |
| `pruebas/prueba_80.sql` y `pruebas/probar_80.sh` | 23 bloques de pruebas SQL y la comparación de la estructura con la inversa |
| `web/backend/src/routes/events.ts` | Campos y filtros nuevos, `review`, `resubmit`, `historic-teams`, `similar-teams`, `PATCH /historic-teams/{id}`, `GET /admin/pending-games` |
| `web/backend/src/routes/matches.ts` | Candidatos paginados con filtros, `played_at` en mapas y W.O., `approved` en `maps_detail`, `POST /matches/{id}/games/{gameId}/review`, sin stats de un mix por aprobar para quien no gestiona |
| `web/backend/src/routes/teams.ts` | Un equipo histórico no tiene página; su logo lo cambia quien gestiona su torneo |
| `web/backend/src/schemas/events.ts`, `matches.ts`, `players.ts` | Esquemas nuevos (`ReviewBody`, `HistoricTeamBody`, `SimilarTeam`, `GameCandidateList`, `GameReviewBody`, `TeamRef.historic`…) |
| `web/backend/src/services/matches.ts` | `historicTeams` y `markHistoricSides` |
| `web/backend/src/db/types.ts` | Regenerado con la `80` |
| `web/backend/test/integration/historicos-testing.test.ts` | Nuevo: aprobación, testing, histórico y mixes por aprobar con anónimo, jugador, organizador dueño, otro organizador y moderador |
| `web/backend/test/integration/local.ts` y las pruebas de torneos | `approveEvent`: las pruebas que no prueban la aprobación aprueban el torneo del organizador |
| `docs/frontend/contrato/torneos.md`, `partidas.md`, `notificaciones.md` | Contrato de lo nuevo |
| `web/frontend/src/api/schema.d.ts` | Regenerado |
| `web/frontend/src/auth/permissions.ts` | `canCreateEvent`, `canCreateHistoricEvent`, `canReviewEvents`; los moderadores reciben la categoría Administración |
| `web/frontend/src/features/admin/events/api/queries.ts` | Filtros, candidatos con filtros, mixes por aprobar, parecidos y las mutaciones nuevas |
| `web/frontend/src/features/admin/events/pages/AdminEventsPage.tsx`, `AdminEventPages.tsx`, `routes/_app/admin.events.new.tsx` | Lista, crear (`?historic=true`) y cabecera de gestión |
| `web/frontend/src/features/admin/events/components/EventForm.tsx` | Tipo de torneo, testing y aviso de aprobación |
| `web/frontend/src/features/admin/events/components/ReviewPanel.tsx` | Nuevo: aprobar, rechazar, reenviar, mixes por aprobar y sacar de testing |
| `web/frontend/src/features/admin/events/components/HistoricRegistrations.tsx` | Nuevo: inscripciones de un histórico |
| `web/frontend/src/features/admin/events/components/ManageTabs.tsx` | Inscripciones del histórico, sin veto ni exigencia de activos, testing en Configuración |
| `web/frontend/src/features/admin/events/components/MatchSheet.tsx` y `lib/model.ts` | Fecha por mapa y W.O., mix por aprobar, buscador con filtros y páginas, si la serie suma al ranking |
| `web/frontend/src/features/events/components/EventMarks.tsx` | Nuevo: las etiquetas |
| `web/frontend/src/features/events/pages/EventView.tsx`, `EventList.tsx`, `components/SummaryTab.tsx`, `StandingsTab.tsx`, `api/queries.ts`, `lib/model.ts` | Público: etiquetas, franjas, sin inscripción ni reglas por defecto en un histórico, equipos históricos sin link, `404` sin reintentos |
| `web/frontend/src/features/shell/notifications/lib/model.ts` y `model.test.ts` | Los cuatro avisos nuevos y su prueba |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `PrivacyPage.tsx`, `terms/terminos.html`, `terms/privacidad.html` | Aprobación de la liga y registro de torneos históricos |
| `docs/manual/organizador/subir-torneo-historico.md`, `moderador/aprobar-torneos-y-mixes.md`, `moderador/torneo-en-testing.md` | Nuevas |
| `docs/manual/organizador/crear-torneo.md`, `resultados-y-llave.md` | Aprobación, tipo de torneo y fecha del mapa a mano |

`web/frontend/package.json`, `pnpm-lock.yaml` (`@fontsource/montserrat`) y `AdminClipsPage.tsx` aparecen modificados en la copia de trabajo pero no son de este requerimiento: no van en su commit.

## Despliegue (hecho el 2026-11-07, salvo el paso 4)

Cómo quedó: sin mixes en vivo (la única partida `live` seguía siendo la `0d42d09a…` del #1, colgada desde el 2026-11-06), sin salas abiertas y sin nadie en la cola; respaldo `20261107T171646Z` (también en R2); `cmleague-mm` parado; `probar_80.sh` contra producción, todas las pruebas ok y la inversa igual a antes; la `80` desde el archivo commiteado y `notify pgrst, 'reload schema'`; la API `b79c62b67d88` (548 pruebas, `/api/health` con el commit) y `cmleague-mm` prendido de nuevo; la web `b79c62b67d88` (649 pruebas). Producción no tenía ningún torneo, así que no hubo nada que aprobar ni que ocultar.

No toca el matchmaking ni el plugin: va solo en `main` (y su copia en `feat/frontend-fase-1`), no en `feat/mm-claim-en-sala`. Sin un mix en curso.

1. **Commit** en `main` cuando Daniel lo pida, sin los archivos ajenos de arriba.
2. **Base del VPS:** antes, `probar_80.sh` contra producción por el túnel (todo en una transacción con rollback). Después, la `80` desde el archivo commiteado (LF). Necesita la `78`; va después de la `79` de medallas (las dos ya están en producción). El 2026-11-06 se comprobó en producción, solo leyendo, que los 19 reemplazos de texto de la `80` encuentran lo que buscan y que `live_match_list` y `event_list` tienen la forma esperada.
3. **API y web juntas**, desde `main`. La web nueva con la API vieja falla en los filtros y en los candidatos paginados; la API nueva con la web vieja funciona, pero el organizador no ve por qué su torneo no se publica.
4. Publicar el `CHANGELOG_DISCORD.txt` (2.9.22) y los términos.

## Pruebas

### Base (Supabase local de pruebas)

- `probar_80.sh docker`: **todas las pruebas del replanteo 80** (23 bloques) y la inversa deja la estructura igual que antes, en una transacción con rollback. Cubre la visibilidad con cinco roles (anónimo, jugador, organizador dueño, otro organizador, moderador), testing fuera del ranking, que el organizador no apruebe ni cambie testing, rechazo con motivo, reenvío, aprobación y su anuncio, que el capitán no inscriba en un histórico, el histórico armado por el organizador (equipos históricos, mixes viejos, fecha a mano y campeón), que otro organizador no corrija un equipo histórico, histórico pendiente sin avisos ni ranking, rechazo de un mix y aprobación del torneo, ranking del histórico, título en el perfil, el histórico del moderador y sacar de testing.

### API

- `pnpm test`: 40 archivos, **548 pruebas**. `tsc --noEmit` y el build (manual: 46 páginas) sin errores.
- `pnpm test:int` con la `80` aplicada: **175 de 186**. Pasan todas las de torneos (`historicos-testing`, `tournaments`, `admin-torneos`, `llave-serie`, `groups-double`). Las 11 que fallan no son de este requerimiento: subir imágenes a Storage responde `403` en esta base local (también el banner de un torneo y la foto de perfil, que no se tocaron), `notify_due` ya tenía permiso para `authenticated` en esta base (la `80` la cambia con `create or replace`, que conserva los permisos), y `claim`, `hud`, `ips` y `seasons` tienen fallas propias del entorno (una por tiempo de espera de la base).

### Web

- `pnpm test`: 105 archivos, **636 pruebas** (una nueva: los textos de los cuatro avisos). `tsc -b`, `eslint` y `prettier` sin errores.
- **En el navegador** (Playwright contra la API y la web de esta copia en los puertos 8797 y 5183, con usuarios de prueba admin, moderador, organizador y jugador sembrados en la base local):
  - Admin: la lista con etiquetas, filtros y aviso de pendientes; el histórico pendiente con **Aprobar** y **Rechazar**; las inscripciones del histórico; el aviso de nombres parecidos (muestra el histórico ya cargado en otro torneo con **Inscribir este** y el ya inscrito); el diálogo de jugadores; el formulario de histórico; el panel de una partida con **Mix por aprobar**, y **Aprobar mix** desde la web deja el mix aprobado en la API.
  - Organizador: su lista (pendiente y rechazado), el panel de rechazo con **Volver a enviar**, el panel de una partida (fecha del mapa a mano y del W.O., el buscador de mixes con filtros) y la página pública de su torneo pendiente con las franjas. No ve el torneo en testing.
  - Moderador: crear solo histórico, con la casilla de testing.
  - Jugador: no ve ninguno de los tres torneos sembrados; la página de uno oculto dice que no existe.

## En qué se apartó del plan

- **Replanteo `80`, no `79`.** Mientras se implementaba, las medallas configurables salieron a producción como `79_medallas_configurables.sql`. Se renumeró a `80` (archivo, inversa, `probar_80.sh`, `prueba_80.sql` y las menciones en el código y la bitácora); el `PLAN.md` sigue diciendo `79` porque no se edita. No comparten funciones, tablas, vistas ni políticas, y las pruebas corrieron con las dos aplicadas en la base local. La vista previa de la llave pasa de `80` a `81`.

- **Administración › Equipos sin el filtro "Históricos".** El plan lo ponía para corregir nombre y logo. Esa pantalla lista `admin_team_list`, pensada para equipos con plantel (líder, miembros, disolver), y sumarle los históricos pedía cambiar la vista y sus acciones. Los equipos históricos se corrigen desde **Editar** en las inscripciones de cualquier histórico donde estén (admin, moderador o quien gestiona ese torneo), con el mismo efecto.
- **Fecha del W.O.:** el plan decía `played_at` en el W.O.; la API lo toma en `POST /matches/{id}/result` (`played_at` junto a `walkover`), y la web lo muestra solo en un histórico.
- **El rechazado no se aprueba directo:** el staff no tiene **Aprobar** en un torneo rechazado; espera a que el organizador lo vuelva a enviar (`event_review` responde `409` si no está pendiente).
- **Extras en la web pública:** un histórico no muestra las reglas por defecto de la liga (veto, `!match`, tolerancia) si no cargó las suyas, y el detalle de un torneo no reintenta un `404`: un torneo oculto es un `404` a propósito.

## Incidentes durante las pruebas

- En la sesión anterior se cortó el trabajo a la mitad de la web (límite de uso). `ReviewPanel.tsx` cambió en disco por fuera de esa sesión; se revisó y está bien.
- La API (8787) y la web (5173) que corrían en la máquina eran de otras copias (`v34frag-medallas` y `v34frag-main`), así que para probar se levantaron las de esta copia en 8797 y 5183, sin tocar las otras.
- La primera versión del panel de la partida ponía la fecha en la misma fila que el mapa y el marcador: en el ancho del panel el selector de mapa quedaba aplastado. La fecha pasó a su propia fila y los filtros del buscador a dos columnas.

## Cómo revertir

1. **Web y API:** volver al commit anterior y desplegar (la API vieja ignora las columnas nuevas).
2. **Base:** la inversa `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/80_torneos_historicos_testing.sql`. Aborta si hay torneos históricos, en testing o pendientes: antes hay que borrarlos o aprobarlos y sacarlos de testing (`probar_80.sh` muestra el orden de limpieza).

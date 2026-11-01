# Endpoints de partidas, torneos y PCW (API de dominio, segunda entrega): guía de implementación

## Estado

Hecho y probado en local el 2026-10-15: migración `10` y backend. **Sin commit y sin desplegar.** La `10` se aplica en el corte del replanteo y los endpoints salen con el backend. El plugin no cambia.

**Aprobación del plan (2026-10-15).** Antes de aprobarlo, Daniel definió:
- **Formatos:** las plantillas (eliminación directa, doble eliminación, grupos + playoffs y suizo + playoffs al estilo del Major de CS2) y el BO por fase con sus valores por defecto.
- **Gran final:** sin reset y con "mapa de ventaja" opcional.
- **Pool de mapas:** los 8 mapas, con Inferno en dos versiones.
- **Empates:** overtime obligatorio.
- **Resultados:** llegan solo por `!match`. A mano los cargan el organizador o el admin; las PCW sin `!match` no cuentan.
- **Organizadores, puntos y chat:** organizadores que gestionan sus torneos, puntos únicos y chat de participantes.

Aprobó además las ocho propuestas del plan.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/10_partidas_torneos.sql` | Nuevo: organizadores, plantillas, motor, inscripción con jugadores, `!match` con inscritos y mapa de ventaja, código oculto, servidores, pool de mapas, veto, chat, PCW como equipo, vencimiento y resultado del admin; quita `result_reports` y las columnas viejas de `events` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/10_partidas_torneos.sql` | Nuevo: inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/10_partidas_torneos.sql` | Nuevo: pruebas del motor y de las reglas |
| `web/backend/src/routes/matches.ts`, `events.ts`, `pcw-play.ts` | Nuevos: endpoints |
| `web/backend/src/schemas/matches.ts`, `events.ts` | Nuevos; `schemas/pcw.ts` suma anuncios, aceptación y pool de mapas |
| `web/backend/src/services/matches.ts`, `services/stages.ts`, `lib/etag.ts` | Nuevos |
| `web/backend/src/schemas/auth.ts`, `services/account.ts`, `routes/me.ts` | Rol `organizer` |
| `web/backend/src/env.ts`, `wrangler.toml`, `.dev.vars.example` | `DEMO_BASE_URL` |
| `web/backend/src/app.ts` | Registra las rutas nuevas |
| `web/backend/src/db/types.ts` | Tipos regenerados con la `10` |
| `web/backend/test/integration/tournaments.test.ts` | Nuevo: 6 pruebas contra la Supabase local |
| `web/backend/test/unit/tournament-services.test.ts` | Nuevo: nombres de fase y veto |
| `web/backend/test/integration/players-teams.test.ts` | La prueba de torneos de la entrega anterior pasa a `tournaments.test.ts` (ahora se compara contra los inscritos) |
| `supabase/replanteo/README.md`, `docs/MODELO_DATOS.md`, `docs/bitacora/2026-10-14-replanteo-modelo-datos/DOCUMENTACION.md` | Fila de la `10` |
| `docs/frontend/contract.md` | Partidas, torneos, PCW, rol de organizador y registro de decisiones |
| `docs/bitacora/2026-10-15-match-y-status/CHANGELOG_DISCORD.txt` | Líneas para los jugadores |
| `docs/PENDIENTES.md` | El corte pasa a ser 01 a 10; endpoints de dominio al día |

## Despliegue (pendiente: va en el corte)

1. **Base:** aplicar `supabase/replanteo/10_partidas_torneos.sql` después de la `09`. Aborta si hay roles desconocidos en `profiles.role` (en la copia del 2026-10-14 solo hay `user` y `admin`).
2. **Backend:** sale con el primer despliegue en el VPS. Variable nueva: `DEMO_BASE_URL` (en `wrangler.toml` ya está la del Worker de demos).
3. **Web nueva:** según `docs/frontend/contract.md`.

## Pruebas

### Base (Supabase local)

- **`correr.sh`** pasa con 01 a 10: aplicar, probar, abortar al reaplicar, inversa idéntica y reaplicar.
- **`pruebas/10_partidas_torneos.sql`** prueba, con 32 equipos de 6 jugadores:
  - **Configuración:** valores por defecto de cada plantilla y rechazo de BO2 y de tamaños inválidos.
  - **Permisos:** un usuario común no crea torneos; el admin nombra organizadores; un organizador no toca torneos ajenos ni el estado.
  - **Inscripción:**
    - Cantidad de jugadores y capitán.
    - El jugador compartido entre dos equipos no se inscribe con los dos.
    - Quien sale del equipo deja de estar inscrito.
    - La siembra sigue el orden de inscripción.
    - No se genera con un equipo bajo el mínimo.
  - **Eliminación directa** con 5 equipos: 3 byes, BO por ronda (1, 3, 5), 3.er puesto y campeón. La final se corrige; la semifinal no, porque ya se jugó la final. No se aceptan mapas empatados ni series sin definir.
  - **Doble eliminación con mapa de ventaja:** la gran final nace 1-0 en BO5 y se gana con 2 mapas; el finalista llega por el lower.
  - **Grupos:** 8 equipos en 2 grupos, reparto en serpentina, playoffs armados solos sin cruces del mismo grupo, puntos y diferencia de rondas, y bloqueo de correcciones de grupos con los playoffs armados.
  - **Empate de grupo** en todos los criterios: `tie_pending` y resolución del organizador. Con 1 clasificado sale campeón directo.
  - **Suizo de 2 fases de 8** (2 victorias, 4 directos en la fase 2):
    - Siembra de la ronda 1, mismo récord en la ronda 2 y BO3 en las decisivas.
    - 4 clasificados por fase y playoffs de 4.
    - Campeón y ningún rival repetido.
  - **Suizo de 16** (3 victorias): 33 partidas en 5 rondas, playoffs de 8 y torneo terminado.
  - **Reiniciar, W.O.** (campeón, fuera del ranking), no reiniciar ni borrar con partidas jugadas, y cancelar.
  - **`!match` real** (`csstv_ingest` → `csstv_link_game`):
    - El lookup manda solo los 5 inscritos y `min_roster=5`.
    - Un no inscrito deja el juego como mix.
    - Una serie BO3 por el servidor termina y el torneo avanza solo hasta el campeón.
  - **Código oculto** para `anon` y para un extraño; el admin lo ve. Hora y servidor.
  - **Veto:** secuencias, turno, mapa fuera del pool, mapa repetido, versión obligatoria de Inferno, sin inserción directa, reinicio solo del organizador.
  - **Chat:** un extraño no escribe en un torneo; el participante sí, y se ve su alias.
  - **PCW:** "como equipo" solo del capitán, vencimiento a las 48 h, resultado solo del admin y `result_reports` quitada.
- **Ensayo del ELO** con la copia de producción y 01 a 10: idéntico (32 SteamIDs, 135 filas de mixes, stats de 32 jugadores). La copia no tiene torneos. Después se hizo `pnpm db:reset`.

### Backend

- `pnpm typecheck`: sin errores.
- `pnpm test`: 178 pruebas unitarias.
- `pnpm test:int`: 51 pruebas contra la Supabase local. Las de esta entrega cubren:
  - Torneo de punta a punta: organizador, inscripción, siembra, `ETag`/`304`, avance por un resultado "del servidor", resultado a mano con empate rechazado, campeón, no reiniciar ni borrar.
  - Choque de inscritos.
  - Veto completo con la versión de Inferno y el decisivo.
  - Chat y código solo de participantes.
  - Servidores, hora y W.O.
  - Detalle de un mix con MVP y `demo_url`.
  - PCW como equipo, aceptar, mis PCW, resultado del admin y suma al ranking, cancelar.
  - Pool de mapas y roles.
- **Cobertura:** 95,7 % de líneas en total (mínimo 60 %).

## En qué se apartó del plan

El plan se actualizó con las respuestas de Daniel antes de aprobarlo: plantillas, motor completo en la base, BO por fase, mapa de ventaja e Inferno. Después de aprobado:
- **Servidores para el organizador:** `game_servers` solo la lee el admin, así que se sumaron la vista `game_servers_public` (id, nombre y dirección de los activos) y `GET /api/v1/servers`.
- **Liga:** grupos con 1 grupo y 1 clasificado terminan con ese equipo campeón (no hacen falta playoffs).
- **PCW vencidas:** al cancelarse se borran el anuncio y los bandos, igual que con `cancel_pcw_match`.
- **Chat de los mixes:** sigue abierto a cualquiera con sesión. La decisión de Daniel era para torneos y PCW.
- **Endpoints que el plan no listaba:**
  - `POST /api/v1/events/{id}/cancel` (cancelar es distinto de editar).
  - `GET /api/v1/maps` (para el formulario del veto y el admin).
  - `pcw_set_result`, que el plan nombraba.
- **W.O.:** `walkover` es el id del equipo que **gana** (el que se presentó). El plan decía "el equipo que no se presentó".
- **Siembra:** si dos equipos se inscriben al mismo tiempo, desempata el nombre. Así el fixture es siempre el mismo.

## Incidentes durante las pruebas

- **El motor no corría desde una ingesta en la misma transacción.** En las pruebas, todo corre en una sola transacción y la marca del motor (`v34.engine`) quedaba puesta. En producción cada ingesta es su propia transacción; las pruebas la limpian antes de cada juego simulado.
- **Grupos distintos en cada corrida.** Equipos inscritos en la misma sentencia tenían el mismo `created_at`. Se agregó el nombre como último desempate.
- **Dos errores de la migración que encontraron las pruebas:**
  - `revoke all … from anon` en `map_pool` también quitaba la lectura.
  - PostgREST no encontraba la relación de `teams` consigo misma por el nombre de la clave; se usa `parent_team_id(...)`.
- **Publicar una PCW sin hora fallaba:** supabase-js omite los parámetros `undefined` y la función los exige. Se manda `null`.

## Cómo revertir

- **En local:** aplicar `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/10_partidas_torneos.sql`.
  - La estructura queda idéntica a la de la `09`.
  - Los torneos creados con plantillas pierden la configuración, que se convierte a `format`/`best_of` de forma aproximada.
  - Los W.O. quedan sin `end_reason`.
  - Los organizadores vuelven a `user`.
- **Backend:** revertir el commit de esta entrega.
- **En producción:** no aplica todavía, porque nada se desplegó.

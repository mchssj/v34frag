# Equipo y Torneos con la API nueva: guía de implementación

## Estado

Implementado y probado en local el 2026-10-29, en la rama `feat/frontend-fase-1`, sin commit y sin desplegar. Con esto, Equipo y Torneos quedan **terminados**, salvo el control para que el líder edite `looking_for`, que espera diseño.

## Antes de empezar: el entorno local

- **Pull de la rama:** GitHub Desktop quedó a mitad de un merge de 24 commits de Daniel, con el trabajo sin commit guardado en un stash. Se terminó el merge (conflicto solo en el índice de la bitácora) y se recuperó el stash (conflictos en el índice, `web/frontend/CLAUDE.md` y `mixes/room.test.ts`). Respaldo en la rama `backup/frontend-pre-pull-2026-10-29`.
- **Base local:** antes, respaldo en `~/.v34frag/local-antes-equipo-torneos-api-2026-10-29.dump`. Después se aplicó lo nuevo, en orden y sin errores:
  - las migraciones `20261028120000_vip`, `20261028180000_clips_vip_reprocesar` y `20261028200000_demos_servidores_externos`;
  - el replanteo `26` (cambió);
  - del replanteo `28`, solo el trigger de clips reprocesados: el archivo se protege para no volver a correr;
  - los replanteos `31` a `34`.
  
  Se salteó el cambio del replanteo `15`: es una corrección de datos de producción (fichas que perdieron su cuenta).
- **API local:** `csapi5` exportada otra vez desde `HEAD`, con el mismo `.dev.vars` (Supabase local). `pnpm gen:api` dejó `schema.d.ts` igual al que subió Daniel.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/api/errors.ts` (+ test) | `ROSTER_FULL`, `NOT_A_MEMBER`, `COACH_NOT_ALLOWED`, `REGISTRATION_CLOSED`, `PLAYER_NOT_LINKED` |
| `src/lib/image.ts` | `cropImage` genérico; `cropAvatar` lo usa sin cambios y se suma `cropLogo` |
| `src/features/profile/AvatarCropDialog.tsx` | Forma, título y botón configurables (Mi perfil sigue igual) |
| `src/features/events/queries.ts` | `LiveMatch`; inscripción con `{ active, subs }` |
| `src/features/events/model.ts` (+ test) | `boText` y `progressRatio` desde la API, `modeText`, `closesText`, `closesAt`, `registrationClosed`, `liveText`; el botón según el rol con `live_match`, `current_stage` y el cierre; se van `boOf` y `progressOf`; primera regla fija general |
| `src/features/events/EventList.tsx` | Sin pedidos por tarjeta; modo, banner y "cierra en…" |
| `src/features/events/EventView.tsx` | `GET /me/teams`, banner, modo, "Inscripciones cerradas", notas nuevas |
| `src/features/events/RegisterDialog.tsx` | Activos y suplentes por fila |
| `src/features/events/SummaryTab.tsx`, `ui.tsx` | Modo, cierre; `EventBanner` con imagen |
| `src/features/teams/queries.ts` | Consultas y mutaciones nuevas; búsqueda con `looking_for`; solicitud con logo |
| `src/features/teams/model.ts` (+ test) | Sin topes por estado; `rolesMap`, `RESULT_LABEL`, `resultText`; se va `myRoleIn` |
| `src/features/teams/TeamLogo.tsx` | Nuevo: elegir y recortar el logo; cámara del líder |
| `src/features/teams/ui.tsx`, `Roster.tsx`, `InviteDrawer.tsx`, `sections.tsx`, `TeamView.tsx`, `CreateTeam.tsx`, `FindTeam.tsx`, `NoTeam.tsx`, `TeamSwitcher.tsx` | Lo de la documentación |
| `src/routes/_app/myteam.tsx` | `GET /me/teams` |
| `e2e/team*.ts`, `e2e/event*.ts` | Datos simulados con las formas nuevas y pruebas nuevas |

## Despliegue

No se desplegó.

## Pruebas

- **Typecheck y lint:** limpios.
- **Unitarias:** 361 en verde.
- **e2e:** 63 de 64 en verde. La que falla es `ranking.spec.ts` (de Daniel): necesita la temporada BETA abierta y la base local no tiene temporadas. No tiene que ver con este cambio.
  - **Torneos:**
    - las tarjetas sin pedidos extra (la prueba comprueba que no se pide ningún `/events/{id}`);
    - inscribir con 2 activos y 1 suplente, comprobando `PUT { active: [p-yo, p-kova], subs: [p-torm] }`;
    - con el cupo de activos lleno, el botón deshabilitado;
    - "Cambiar inscritos" parte de lo inscripto;
    - inscripciones cerradas;
    - "Semifinal · Mapa 2 de 3 · de_dust2".
  - **Equipo:**
    - "desde ene 2025", KPI 3, mapa de puestos (AWPer kova, Entry Tormenta, sin el coach, nacho en "Otros puestos") e historial;
    - cambiar el estado con `PATCH { role: "player" }`;
    - el mensaje de un pedido;
    - invitar como suplente con mensaje;
    - el filtro "Buscan suplente" contra la API real (`looking_for=sub`);
    - el logo en Crear equipo: archivo, recorte, vista previa y solicitud en `multipart/form-data`, contra la API real.
- **Contra la API local, con los torneos de prueba:**
  - **Listado:** trae `game_mode`, `players_per_team`, `subs_max`, BO, `current_stage` y `progress`.
  - **Inscripción:**
    - `PUT { active: 5, subs: [] }` responde `204`;
    - con 3 activos en 5v5 responde `400` con el mensaje "Cada equipo inscribe 5 jugadores activos (modo 5v5)";
    - los inscritos traen `role`.
  - **Historial y detalle del equipo:** el historial trae los resultados y el detalle `founded_at`, `events_played` y `max_members`.
- **Visual:** Mi equipo, el menú ⋯, invitar, el listado, la partida en vivo y el diálogo de inscripción, en oscuro y claro a 1440px y en 390px.

## En qué se apartó del plan

- **Vitrina:** quedaba "torneos jugados próximamente" en su subtítulo; ahora dice "{n} torneos jugados" con `events_played`.
- **Textos:**
  - "5 activos + sin suplentes" pasó a "5 activos, sin suplentes";
  - la primera regla fija ("5 titulares y hasta 2 suplentes") ya no valía con los modos de juego y quedó general.
- **Lista del historial:** lleva nombre accesible ("Torneos en los que participó"), porque el mismo torneo aparece también en la Vitrina.

## Pendiente

- **Editar `looking_for`:** el backend lo tiene (`PATCH /teams/{id}`), pero no hay diseño del control para el líder. Pedirlo a Claude Design.
- **Subir el banner:** va en el panel del organizador (`/admin/events`), que todavía es un placeholder.

## Cómo revertir

Todavía no hay commit: alcanza con descartar los cambios de los archivos de la tabla y borrar `src/features/teams/TeamLogo.tsx`.

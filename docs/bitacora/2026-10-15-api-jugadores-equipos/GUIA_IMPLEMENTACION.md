# Endpoints de jugadores y equipos (API de dominio, primera entrega): guía de implementación

## Estado

Hecho y probado en local el 2026-10-15: migración `09` y backend. **Sin commit y sin desplegar.** La `09` se aplica en el corte del replanteo y los endpoints salen con el backend. El plugin no cambia.

Daniel aprobó el plan el 2026-10-15, después de responder las preguntas abiertas: varios equipos por jugador, SteamID obligatorio, alias cada 15 días y sincronizar a los 6 jugadores. Además agregó dos reglas: una PCW no se puede jugar con un jugador compartido, y una PCW suma al ranking cuando se juega "como equipo".

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/09_jugadores_equipos.sql` | Nuevo: alias, palabras bloqueadas, `team_invites` y sus funciones, reglas del plantel y de torneos, `parent_team_id`, ranking, vistas, solicitudes de equipo nuevo, `admin_users` y bajas seguras |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/09_jugadores_equipos.sql` | Nuevo: inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/09_jugadores_equipos.sql` | Nuevo: pruebas de la migración |
| `web/backend/src/lib/auth.ts` | `optionalUser`, `currentUser` e `isAdmin` (`requireAdmin` lo usa) |
| `web/backend/src/lib/db.ts` | Nuevo: `must`, `mustHave`, paginado, `searchTerm` y `levelOf` |
| `web/backend/src/lib/errors.ts` | `42501` y `23505` conservan el mensaje de un `raise` propio |
| `web/backend/src/routes/players.ts`, `teams.ts`, `roster.ts`, `account.ts`, `admin-players.ts`, `admin-teams.ts` | Nuevos: los endpoints |
| `web/backend/src/schemas/players.ts`, `teams.ts`, `admin.ts` | Nuevos: esquemas de entrada y salida |
| `web/backend/src/routes/me.ts`, `src/schemas/profile.ts` | `GET /me/profile` devuelve `teams` (lista) y cuenta las partidas del jugador |
| `web/backend/src/routes/auth.ts`, `src/schemas/auth.ts` | El registro valida el alias antes de crear la cuenta |
| `web/backend/src/app.ts` | Registra las rutas nuevas |
| `web/backend/src/db/types.ts` | Tipos regenerados con la `09` |
| `web/backend/test/unit/db.test.ts` | Nuevo: nivel, búsqueda y paginado |
| `web/backend/test/unit/errors.test.ts`, `auth-routes.test.ts`, `me-routes.test.ts` | Ajustadas a los cambios de errores, registro y perfil |
| `web/backend/test/integration/players-teams.test.ts` | Nuevo: 14 pruebas contra la Supabase local |
| `web/backend/test/integration/me.test.ts`, `auth.test.ts`, `auth-middleware.test.ts` | `teams` en el perfil y alias con sufijo (ahora son únicos y las pruebas se repiten) |
| `docs/frontend/contract.md` | Nuevo: contrato único para el frontend |
| `docs/frontend/2026-10-14-decisiones-para-frontend.md` | Marcado como reemplazado por `contract.md` |
| `supabase/replanteo/README.md`, `docs/MODELO_DATOS.md`, `docs/bitacora/2026-10-14-replanteo-modelo-datos/DOCUMENTACION.md` | Fila de la `09` |
| `docs/bitacora/2026-10-15-match-y-status/CHANGELOG_DISCORD.txt` | Líneas para los jugadores (se publica con el corte) |
| `docs/PENDIENTES.md` | El corte pasa a ser 01 a 09; pendientes de PCW y torneos |

## Despliegue (pendiente: va en el corte)

1. **Base:** aplicar `supabase/replanteo/09_jugadores_equipos.sql` después de la `08`, con el resto del replanteo. Aborta si hay alias repetidos sin distinguir mayúsculas; en la copia del 2026-10-14 no hay.
2. **Backend:** sale con el primer despliegue del backend en el VPS. No necesita variables nuevas.
3. **Web nueva:** usa los endpoints según `docs/frontend/contract.md`.

## Pruebas

### Base (Supabase local)

- **`correr.sh`** pasa con 01 a 09. Por cada migración: se aplica, corre su prueba, una segunda aplicación aborta, la inversa deja la estructura idéntica y se vuelve a aplicar.
- **`pruebas/09_jugadores_equipos.sql`**, dentro de un rollback, prueba:
  - **Normalización:** "P3p1t0" queda como "pepito" y "Ñandú Ácido" como "nanduacido".
  - **Palabras bloqueadas:** solo el admin las escribe y quedan normalizadas.
  - **Alias en el registro:** si está tomado o bloqueado, queda el genérico.
  - **`alias_check`:** cada uno de sus resultados.
  - **`set_my_tag`:** unicidad, bloqueo y espera de 15 días (también con 1 día restante). Cambiar solo mayúsculas no cuenta.
  - **`set_user_tag`:** con `force` y sin él.
  - **Nick:** sigue al alias. El admin no puede pisarlo en un jugador vinculado.
  - **Solicitud de equipo:** sin SteamID no se puede; una con palabra bloqueada se rechaza; la aprobación crea el equipo.
  - **Invitaciones y pedidos:** permisos, duplicados, aceptar, salir, volver a pedir, capitán que no puede salir ni ser sacado, sacar y vencimiento.
  - **Tope de 10 y SteamID:** también para el admin.
  - **Torneo:** choque al inscribirse, se destraba sacando al jugador y bloquea la entrada a un equipo inscrito.
  - **Partida pendiente:** choque con el plantel del rival.
  - **Bando de PCW "como equipo":** validación del roster.
  - **Ranking:** torneo y PCW con los puntos configurables.
  - **Vistas y funciones:** `player_overview`, `team_overview`, `player_matches`, `steam_unlinked`, `admin_users`, `admin_name_blocked` y `blocked_names_hits`.
  - **Bajas seguras.**
- **Ensayo del ELO** con la copia de producción y 01 a 09: idéntico (32 SteamIDs, 135 filas de mixes, stats de 32 jugadores). Después se hizo `pnpm db:reset`.
- **Conteos con la copia de producción** (solo números):
  - 12 equipos oficiales, ninguno con más de 10 activos.
  - 62 miembros activos, 36 de ellos sin SteamID, que se quedan.
  - Ningún jugador en más de un equipo oficial.
  - 6 capitanes sin jugador con SteamID.
  - 1 solicitud de equipo pendiente.
  - Después de la `09`, ningún vinculado con nick distinto del alias.
  - No hay partidas de torneo ni PCW, así que el ranking arranca vacío.

### Backend

- `pnpm typecheck`: sin errores.
- `pnpm test`: 162 pruebas unitarias.
- `pnpm test:int`: 45 pruebas contra la Supabase local, que pasan dos veces seguidas. Cubren:
  - **Alias:** registro con un alias tomado, flujo completo con disponibilidad, bloqueo, espera y moderación con `force`.
  - **Solicitud de equipo:** del usuario a la aprobación del admin.
  - **Invitaciones y pedidos:** de punta a punta, con rechazar y cancelar.
  - **Capitanía:** salir, sacar y ceder.
  - **Varios equipos y torneos:** un jugador en dos equipos y el choque al inscribirlos en el mismo torneo.
  - **Tope de 10 y SteamID.**
  - **Ranking:** con y sin PCW, y la configuración.
  - **Listados:** búsqueda sin tildes y privacidad de la ficha.
  - **Partidas de un jugador.**
  - **Admin de jugadores:** alta, edición, medallas, SteamID sin vincular, baja segura y vincular una cuenta.
  - **Palabras bloqueadas** con `force`, **reclamos** (deprecados) y **foto**.
- **Cobertura:** 87 % de líneas en total (mínimo 60 %).

## En qué se apartó del plan

- **Bando de PCW "como equipo"** (`teams.parent_team_id`):
  - **Por qué:** al implementar apareció que una PCW se juega con un bando armado para esa PCW, no con un equipo oficial, así que "Contar también PCW" no tenía a quién sumarle.
  - **Decisión de Daniel:** el bando elige uno de sus equipos oficiales y la PCW ganada suma a ese equipo.
  - **Hecho ahora:** la columna, su validación y el ranking.
  - **Para la entrega de PCW:** elegir el equipo al publicar o aceptar.
- **PCW con un jugador compartido:** la regla que pidió Daniel ya existía en `accept_pcw`. La `09` agrega el choque con el plantel del rival de una partida pendiente, que cubre también los cambios del admin.
- **Invitar y ceder la capitanía:** se hace por `player_id` (o por alias), no por `user_id`. El frontend trabaja con ids de jugador, y la invitación pide además que el jugador tenga cuenta.
- **Objetos de la base que el plan no nombraba:**
  - Vistas `team_overview`, `player_matches` y `steam_unlinked`.
  - Funciones `admin_users`, `admin_name_blocked`, `blocked_names_hits` y `search_norm`.
  - **Por qué:** `profiles` solo deja leer el propio, y la búsqueda sin tildes y los listados tienen que paginarse en el servidor.
- **Palabras bloqueadas:** los triggers frenan solo a los usuarios. Al admin lo frena el backend, que ofrece `force`, y las cargas de mantenimiento no se frenan.
- **Vencimiento de invitaciones:** se marca cuando se llama a una función, sin un proceso programado. La API filtra además por fecha.
- **`GET /me/profile`:** además de pasar de `team` a `teams`, `matches_played` ahora cuenta las partidas del jugador (de `player_matches`) y no las partidas de torneo de su equipo. Con varios equipos, ese número no tenía un equipo único.
- **Registro:** el alias se valida antes de crear la cuenta. El genérico de respaldo pasó de `user_` más los primeros 6 caracteres del id a `user_` más los últimos 8 en hexadecimal, porque el primero chocaba entre cuentas.

## Incidentes durante las pruebas

- **Una invitación vencida no quedaba marcada como vencida.** Al responderla, la función fallaba y deshacía también la marca. Se dejó así, y la API y la prueba lo tienen en cuenta.
- **Los triggers de palabras bloqueadas frenaban una carga hecha como `postgres`.** Se limitaron a sesiones con usuario que no es admin.
- **Alias fijos en las pruebas de integración** (`Perfil1`, `Viejo`, `Yo`…): con el alias único chocaban al repetir las pruebas. Ahora llevan un sufijo.

## Cómo revertir

- **En local:** aplicar `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/09_jugadores_equipos.sql`, que deja la estructura idéntica a la de antes. Los nicks sincronizados con el alias quedan como están.
- **Backend:** revertir el commit de esta entrega.
- **En producción:** no aplica todavía, porque nada se desplegó.

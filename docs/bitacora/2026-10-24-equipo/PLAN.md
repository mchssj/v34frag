# Plan: Equipo (Mi equipo, vista pública y Buscar equipo)

> Planeación original. Estado: **aprobado** el 2026-10-24 (decisiones de Esteban abajo).

Handoff: `CSSTV/desings/handoff_equipo/`:
- `README.md`;
- `Pedidos al backend.md`;
- `referencia-visual/MyTeam.dc.html`, que se abre dentro de `CSSTV.dc.html`.

Una sola vista de equipo con dos modos: **Mi equipo** (`/myteam`, gestión) y **Equipo público** (`/teams/{id}`, solo lectura). Desde "Sin equipo" se llega a **Crear equipo** y **Buscar equipo**.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Lo que el backend no tiene | **Visible con "Próximamente"** (deshabilitado, con tooltip) | Respuesta de Esteban; igual que en Vinculación. Se activa cuando llegue el endpoint |
| Historial de torneos | "Torneos jugados" y "Torneos en los que participó" **visibles con "Próximamente"** | Respuesta de Esteban. La API no da en qué torneos jugó un equipo ni su resultado |
| Títulos y Vitrina | **Reales**: torneos terminados con `champion.id` igual al equipo | La API ya lo trae en `GET /events` |
| Rutas | `/myteam?team={id}` (equipo elegido) y `?view=create|find` (Crear y Buscar, para que funcione el botón Atrás); `/teams/{id}` (público) | URLs en inglés; se pueden enlazar |
| "Mis equipos" | `GET /me/profile` → `teams` (`is_captain`, `is_member`); el estado en cada uno sale del plantel | No hay `GET /me/teams` |
| Estado en el roster | `RosterEntry.role` `player`/`sub`/`coach` = Activo/Suplente/Coach, **solo lectura** | Cambiarlo no tiene endpoint para el capitán |
| Jugador estrella | El de mejor rating del roster (`GET /players?team=&sort=rating`) y su ficha para ADR y HS | Existe |
| Sigla vacía | El escudo muestra las iniciales del nombre | Hay equipos sin sigla en los datos reales |

## 1. Qué hay en el backend y qué no

| Parte del handoff | Backend | Cómo queda |
|---|---|---|
| Mis equipos, cabecera, líder, conteo | `GET /me/profile`, `/teams/{id}`, `/teams/{id}/members` | Real |
| KPIs ranking, puntos, % victorias | `GET /ranking/teams`, `record.official` | Real |
| KPI títulos y Vitrina | `GET /events?status=finished` (`champion`) | Real |
| KPI torneos jugados, "Torneos en los que participó" | — | **Próximamente** |
| Roles de equipo (mapa y asignación) | — | Mapa con los cinco roles "Sin asignar", **Próximamente** |
| Jugador estrella | `GET /players?team=&sort=rating`, `GET /players/{id}` | Real |
| Forma reciente | `GET /matches?team=` | Real |
| Roster agrupado por estado | `RosterEntry.role` | Real, solo lectura |
| Menú ⋯ → cambiar estado | — (solo admin) | **Próximamente** |
| Menú ⋯ → ceder liderazgo | `POST /teams/{id}/captain` | Real; deshabilitado sin SteamID (`has_steam`) |
| Menú ⋯ → expulsar | `DELETE /teams/{id}/members/{playerId}` | Real |
| Salir del equipo | `POST /teams/{id}/leave` | Real; deshabilitado para el líder |
| Invitar jugador (drawer) | `GET /players?q=`, `POST /teams/{id}/invites` | Real; el campo "Estado en el roster" queda **Próximamente** |
| Pedidos para entrar | `GET /teams/{id}/pending?kind=request`, `POST /join-requests/{id}/accept|reject` | Real |
| Invitaciones recibidas (sin equipo) | `GET /me/team-invites?kind=invite`, `POST /team-invites/{id}/accept|reject` | Real |
| Crear equipo (nombre y sigla) | `GET`/`PUT /me/team-request` | Real, con pantalla de solicitud pendiente |
| Logo del equipo | — | "Subir imagen" **Próximamente**; el escudo muestra la sigla |
| Buscar equipo: lista, búsqueda, ranking, conteo | `GET /teams?q=`, `/ranking/teams` | Real |
| Buscar: chips "Buscan activo/suplente/coach" y pills | — | **Próximamente** |
| Pedir entrar / cancelar | `POST /teams/{id}/join-requests`, `DELETE /join-requests/{id}`, `GET /me/team-invites?kind=request` | Real |

## 2. Estructura (`web/frontend/src/features/teams/`)

- `queries.ts`: consultas y mutaciones de la tabla de arriba, con claves compartidas e invalidaciones (al aceptar, expulsar, ceder, etc.).
- `model.ts` (lógica pura): agrupar el roster, etiquetas de estado, sigla o iniciales, KPIs (% de victorias), títulos de un equipo, estado del botón "Pedir entrar" (pedir / enviado / completo / miembro / sin sesión), rol del usuario en cada equipo.
- Componentes:
  - `TeamView` (los dos modos);
  - `TeamSwitcher` (segmentado hasta 3, desplegable desde 4);
  - `TeamCrest`, `TeamHeader`, `TeamKpis`, `TeamRoles`, `StarPlayer`, `RecentForm`;
  - `Roster` (menú ⋯ y confirmaciones), `JoinRequests`, `Showcase`, `TournamentHistory`;
  - `InviteDrawer`;
  - `NoTeam` (con invitaciones), `CreateTeam`, `FindTeam`.
- Rutas: `routes/_app/myteam.tsx` y `routes/_app/teams.$id.tsx`, que reemplazan los placeholders.
- Las piezas "Próximamente" reusan un `SoonButton` común (tooltip sobre un botón deshabilitado).

## 3. Pruebas

- **Unitarias:** `model.ts`.
- **De componente** (MSW):
  - el roster con el menú ⋯ (ceder y expulsar con confirmación, estados deshabilitados);
  - el selector de equipos (3 y 5);
  - Buscar (pedir, enviado y cancelar);
  - Crear (validación y pantalla pendiente).
- **e2e:**
  - vista pública de un equipo real de la base local y Buscar equipo contra la API real;
  - Mi equipo de capitán con la API simulada por `page.route`: armar un capitán real necesita que un admin apruebe el equipo y que haya SteamID vinculado.
- **Verificación:** typecheck, lint, `pnpm test`, `pnpm test:e2e`, capturas contra el prototipo en claro y oscuro, desborde de 320 a 1440px.

## 4. Pedidos al backend

Los del handoff que faltan:
- estado en el roster editable por el capitán, con topes de 5 activos y 1 coach;
- invitar con estado;
- roles de equipo;
- logo;
- `looking_for`;
- historial de torneos del equipo con su resultado;
- `founded_at` ("desde {fecha}");
- `GET /me/teams` con `my_role` (hoy se deduce del plantel).

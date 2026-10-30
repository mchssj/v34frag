# Equipo (Mi equipo, vista pública y Buscar equipo): guía de implementación

## Estado

**Terminado el 2026-10-29** con la API nueva: lo que estaba en "Próximamente" se activó en [`2026-10-29-equipo-torneos-api-frontend`](../2026-10-29-equipo-torneos-api-frontend/GUIA_IMPLEMENTACION.md). Solo queda el control para que el líder edite `looking_for`, que espera diseño. Lo que sigue es el estado al 2026-10-25.

**En curso, no terminado** (2026-10-25). Lo que ya tiene backend está implementado y probado en local en la rama `feat/frontend-fase-1`, sin commit y sin desplegar. **Queda abierto hasta que el backend entregue lo que hoy se ve con "Próximamente"** (decisión de Esteban). Cuando llegue, se conecta y se cierra el requerimiento.

| Parte en "Próximamente" | Depende de (pedido al backend) |
|---|---|
| Roles de equipo (mapa y asignación) | `GET`/`PUT /teams/{id}/roles` (pedido 2) |
| Cambiar el estado en el roster (menú ⋯ Activo / Suplente / Coach) | `PATCH /teams/{id}/members/{playerId}` con topes 5/1 (pedido 1) |
| "Estado en el roster" al invitar | `InviteBody.role` (pedido 1) |
| "Subir imagen" (logo del equipo) | Logo en la solicitud y `logo_url` (pedido 3) |
| Filtros "Buscan activo / suplente / coach" y qué busca cada equipo | `looking_for` (pedido 4) |
| KPI "Torneos jugados" y "Torneos en los que participó" | Historial de torneos del equipo (pedido 5) |

Mejoras que también esperan al backend, pero no están marcadas en la pantalla: `founded_at` (pedido 6), `GET /me/teams` (pedido 7) y más datos en invitaciones y pedidos (pedido 8).

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/features/teams/queries.ts` | Nuevo: 11 consultas y 10 mutaciones, con invalidaciones del equipo, mis invitaciones y Mi perfil |
| `src/features/teams/model.ts` + `.test.ts` | Nuevo: lógica pura (10 pruebas) |
| `src/features/teams/TeamView.tsx` | Nuevo: la vista en sus dos modos, la cabecera, las acciones y "Salir" |
| `src/features/teams/sections.tsx` | Nuevo: KPIs, roles de equipo, jugador estrella, forma reciente, pedidos para entrar, vitrina e historial |
| `src/features/teams/Roster.tsx` | Nuevo: roster agrupado, menú ⋯ y confirmaciones |
| `src/features/teams/InviteDrawer.tsx` | Nuevo: panel "Invitar jugador" |
| `src/features/teams/TeamSwitcher.tsx` | Nuevo: "Mis equipos" |
| `src/features/teams/NoTeam.tsx`, `CreateTeam.tsx`, `FindTeam.tsx` | Nuevos |
| `src/features/teams/ui.tsx` | Nuevo: escudo, panel, eyebrow, `Soon` ("Próximamente") y avatar con la inicial de respaldo |
| `src/routes/_app/myteam.tsx`, `teams.$id.tsx` | Reemplazan los placeholders; `/myteam` valida `?team` y `?view` |
| `src/features/shell/queries.ts` | El breadcrumb usa `teamDetailOptions` (misma clave, sin pedidos dobles) |
| `src/routes/__root.tsx` | Las devtools no se montan con el navegador automatizado (`navigator.webdriver`) |
| `e2e/team.spec.ts`, `e2e/team-fixtures.ts` | Nuevos: 6 pruebas y los datos simulados de equipos |
| `CLAUDE.md` | `teams/` en la estructura |

## Despliegue

No se desplegó.

## Pruebas

- **Unitarias:** 196 en verde (10 nuevas de `model.ts`).
- **e2e:** 50 en verde, 6 nuevas.
  - **Contra la API real, con la cuenta compartida, sin equipo ni SteamID:**
    - Sin equipo → Buscar: la lista real, la búsqueda sin resultados y "Pedir entrar" con el mensaje del backend sobre el SteamID;
    - Crear: la vista previa del escudo, la sigla en mayúsculas, "Subir imagen" deshabilitado y el mismo mensaje del backend;
    - vista pública de un equipo real, sin herramientas de gestión.
  - **Capitán, con las rutas de equipos simuladas** (`page.route`):
    - selector y rol, KPIs y roster agrupado;
    - menú ⋯ con los estados deshabilitados y "Ceder" deshabilitado sin SteamID;
    - expulsar, ceder, aceptar un pedido, "Salir" deshabilitado para el líder y cambiar de equipo, comprobando cada llamada a la API;
    - invitar a un jugador real de la base local;
    - el desplegable con 5 equipos.
- **Visual:**
  - el prototipo se sirvió por HTTP y se capturaron todos sus estados (2 y 5 equipos, sin equipo, crear, buscar, menú ⋯, invitar);
  - la app se capturó en oscuro y claro con datos reales y simulados.
- **Desborde horizontal:** ninguno en 320, 390, 768, 1024 ni 1440px (Sin equipo, Buscar, Crear, vista pública y capitán).

## En qué se apartó del plan

- **Pruebas de componente → e2e con la API simulada:** el plan pedía pruebas de componente con MSW para el roster, el selector, Buscar y Crear. Se cubrieron con e2e que simulan solo las rutas de equipos (sesión, perfil y jugadores reales), que prueban lo mismo en un navegador real. La lógica tiene sus pruebas unitarias.
- **Devtools en las e2e:** el botón flotante de TanStack Router tapaba "Enviar invitación" en el panel lateral, y Playwright esperaba un clic que nunca llegaba. Las devtools son para personas, así que no se montan cuando el navegador está automatizado. No se forzaron clics.
- **Ajustes de teléfono** (vistos en capturas a 320px):
  - el escudo de la cabecera baja a 64px y el nombre puede ocupar dos líneas;
  - el chip de estado del roster toma su ancho natural;
  - bajo 400px, el distintivo "Líder" muestra solo la corona y el texto queda para lectores de pantalla;
  - los pedidos tienen un ancho mínimo de texto, así que los botones bajan;
  - "Sin asignar" no se parte.
- **Fotos que no cargan:** los avatares usan el `Avatar` de shadcn, que muestra la inicial si la imagen falla. Pasaba con fotos de la copia de producción.
- **"Desde {fecha}":** sin `founded_at`, se usa el ingreso más antiguo del plantel. Si no hay fechas, solo dice "MI EQUIPO".
- **Invitaciones recibidas:** la API no trae quién invitó, el mensaje ni el estado propuesto, así que la tarjeta muestra el equipo, el vencimiento y las acciones.
- **Pedidos para entrar:** la API no trae el nivel ni el puesto del jugador, así que se muestran el nick, hace cuánto y el vencimiento.

## Cambios posteriores

- **"Sin equipo" y "Crear equipo" (2026-10-25, pedido de Esteban):**
  - se suma la cuadrícula de fondo del diseño (`GridBackdrop` en `ui.tsx`, que se desvanece hacia los bordes);
  - la tarjeta ocupa todo el alto disponible;
  - sin invitaciones, el contenido queda centrado en vertical.

  Para que una vista pueda llenar el alto, el contenedor del contenido del shell (`routes/_app.tsx`) pasó a columna flex. Las demás vistas siguen con su alto natural. Verificado a 1920×963 en claro y oscuro, sin scroll sobrante; las e2e de equipo, shell y perfil, en verde.

## Pedidos al backend

1. **Estado en el roster editable por el capitán:** `PATCH /teams/{id}/members/{playerId}` con `{ role }`, con topes de 5 activos y 1 coach. También invitar con estado (`InviteBody.role`).
2. **Roles de equipo:** `GET`/`PUT /teams/{id}/roles` (IGL, Entry, AWPer, Lurker, Support).
3. **Logo del equipo:** multipart en `PUT /me/team-request`, `logo_url` en el equipo y `PUT /teams/{id}/logo`.
4. **`looking_for`:** qué busca cada equipo, filtro en `GET /teams` y edición del líder. Falta el diseño del control en Mi equipo.
5. **Historial de torneos del equipo con su resultado:** para "Torneos jugados" y "Torneos en los que participó".
6. **`founded_at`** en el equipo.
7. **`GET /me/teams` con `my_role`:** hoy se deduce del plantel de cada equipo (un pedido por equipo).
8. **En invitaciones y pedidos:** quién invitó, el mensaje, el nivel y el puesto del jugador.

## Cómo revertir

Todavía no hay commit: alcanza con descartar `src/features/teams/`, `e2e/team*.ts` y los cambios de los demás archivos de la tabla, y restaurar los placeholders de `myteam.tsx` y `teams.$id.tsx`.

# Layout autenticado (app shell): guía de implementación

## Estado

Implementado y probado en local (2026-10-18) en la rama `feat/frontend-fase-1`. Sin commit y sin desplegar.

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/routes/_app.tsx` | Reescrito: shell con `SidebarProvider`, topbar, NowBar, búsqueda y atajo ⌘K |
| `src/routes/_app/*.tsx` | Nuevas: 17 vistas placeholder, `profile.tsx` con "Cerrar sesión" y `admin.tsx` (guarda) con sus 5 secciones. Se borraron `_admin.tsx` y `_admin/admin.tsx` |
| `src/routes/_app/home.tsx` | Sin ancho máximo propio (lo pone el shell) |
| `src/routes/__root.tsx` | `TooltipProvider`; toasts abajo a la derecha y 2,6 s |
| `src/auth/permissions.ts` | Nuevo: reglas por rol de cuenta |
| `src/auth/guards.ts` | `requireAdminSection` (redirige) reemplaza a `requireRole` y la página 403 |
| `src/features/shell/*` | Nuevo: navegación, sidebar, topbar, NowBar, búsqueda, notificaciones, consultas y placeholder |
| `src/components/ui/sidebar.tsx`, `sheet.tsx`, `tooltip.tsx`, `skeleton.tsx`, `popover.tsx`, `command.tsx`, `breadcrumb.tsx`, `input-group.tsx`, `textarea.tsx` | Nuevos (`shadcn add`), con los textos en español. En `sidebar`, se exporta `SIDEBAR_COOKIE_NAME`. En `command`, el título se movió dentro del diálogo |
| `src/components/ui/sonner.tsx` | Ícono de éxito en `win` |
| `src/hooks/use-mobile.ts` | Reescrito sobre `useMediaQuery` |
| `package.json`, `pnpm-lock.yaml` | `cmdk` (lo pide `command`) |
| `e2e/shell.spec.ts` | Nuevo: 7 pruebas |
| `e2e/auth.spec.ts`, `e2e/helpers.ts` | Cerrar sesión desde Mi perfil; un usuario común en `/admin/players` vuelve al inicio |
| `CLAUDE.md` | Estructura y el pendiente de los roles |

## Despliegue

No se desplegó.

## Pruebas

### Unitarias (Vitest)

130 en verde. Las nuevas cubren:
- el ítem activo y los breadcrumbs para todas las reglas del handoff;
- la guarda de Administración: admin, organizador (vuelve a `/admin/events`), usuario (vuelve a `/home`) y `/admin` sin sección;
- las notificaciones: tabs, visibilidad de capitán, marcar leídas, resolver y tiempo relativo.

### De punta a punta (Playwright)

36 en verde. Las nuevas cubren:
- el ítem activo y los breadcrumbs al navegar, también en una ficha de jugador;
- el sidebar se colapsa y recuerda el estado al recargar;
- ⌘K muestra "Sin resultados" y navega a Palmarés con el teclado;
- el tema cambia desde la topbar;
- en las notificaciones, aceptar una invitación muestra el chip y el toast, y después no queda nada sin leer;
- en el teléfono, el panel se abre y se cierra al navegar;
- un usuario común no ve Administración y `/admin/players` lo manda al inicio;
- cerrar sesión desde Mi perfil, en las pruebas de auth.

**Sin e2e del organizador:** la base local no tiene una cuenta con ese rol. Su regla está cubierta por las pruebas unitarias de la guarda.

### Visual

Capturas contra `CSSTV.dc.html#/home` en 1440 px, claro y oscuro, con el sidebar abierto y colapsado, más el teléfono con el panel abierto, las notificaciones y la búsqueda:
- se ajustaron el margen del sidebar (16 px como el diseño) y la separación entre ítems;
- en el teléfono se agregó el margen que el panel de shadcn no trae.

### Otros chequeos

- **Desborde horizontal:** ninguno en 320, 360, 390, 639, 640, 768, 999, 1000 ni 1260 px, en ninguna vista (un nick largo en 320 px se corta).
- **Build de producción:** confirmado que no incluye las notificaciones de ejemplo.

## En qué se apartó del plan y del handoff

- **URLs en inglés** (pedido de Esteban): `/admin/events`, `/admin/players`, `/admin/teams`, `/admin/servers`, `/admin/users`, `/ranking/teams` y `/hall-of-fame`, en lugar de `cadm`, `padm`, `tadm`, `sadm`, `uadm`, `/ranking/equipos` y `/palmares`.
- **Sin página 403:** el handoff pide redirigir (organizador a Torneos, usuario al inicio).
- **"TU PRÓXIMA" no se construyó:** no hay endpoint de próxima partida del usuario. Armarla sin datos sería código sin uso. La NowBar muestra solo "EN VIVO".
- **Badge de Torneos (Administración):** sin fuente clara para "pendientes de revisar", queda oculto.
- **Atajo de búsqueda:** se muestra ⌘K en Mac y Ctrl K en el resto. Funcionan los dos.
- **Pie de la búsqueda:** sin el tip "escribe ">" para acciones", porque no hay acciones; anunciarlo sería engañoso.
- **Breadcrumb de un mix:** "Mix · {mapa}", porque la API no tiene número de mix.
- **Rol sin equipo:** el pie muestra "Jugador" (el handoff no lo define).
- **Notificaciones:** el ícono sale del tipo, no de un campo `icon`. El diálogo de invitación no tenía diseño: muestra equipo, quién invita, mensaje y Aceptar / Rechazar.
- **Toasts:** el cambio de posición (abajo a la derecha) vale para toda la plataforma, para que todos se vean igual.
- **shadcn:**
  - `use-mobile` hacía `setState` dentro de un efecto (lo marca el React Compiler) y se reescribió sobre `useMediaQuery`;
  - el `CommandDialog` dejaba el título fuera del diálogo, así que el diálogo no tenía nombre accesible; se movió adentro;
  - los tooltips necesitan `TooltipProvider` en la raíz.
- **Accesibilidad:** el link del pie se anuncia como "Mi perfil, {alias}".

## Ampliación (2026-10-18)

- **Sidebar colapsado:** en `components/ui/sidebar.tsx`, el riel de la variante `inset` mide 48 px en total y el contenido ya no suma 8 px al colapsar. Antes quedaba a 72 px del borde y ahora a 48, como el diseño. Verificado con captura.
- **`date-fns` 4.4.0** (nueva dependencia, MIT). Reemplaza el código propio de fechas:
  - `CompetitionSection` (`parseISO`, `format`, `differenceInCalendarDays`, `formatDistanceStrict`); se borró `parseDay`;
  - `ClaimStep` (`formatDistanceStrict`); se borró el plural a mano;
  - `timeAgo` de las notificaciones (`formatDistanceStrict`, `isSameDay`) y su mock (`subMinutes`).

  Ahora el texto dice "hace 5 minutos" en lugar de "hace 5 min", porque es la forma del locale `es` de la librería. Los temporizadores de segundos siguen igual.
- **`sileo`:** descartado; se sigue con `sonner` (ver la sección "Ampliación" del plan).
- **Peticiones duplicadas (2026-10-19):** se midieron las peticiones al cargar el Home en desarrollo y en el build de producción.
  - **Duplicación real:** `matches?status=live&per=1` se pedía dos veces, porque el badge del sidebar y la NowBar usaban la misma consulta con claves distintas. Ahora comparten `liveMatchesOptions` (`src/features/public/queries.ts`) y cada uno toma su parte con `select`; la pill de la landing también. En producción quedan 5 peticiones, sin repetidas.
  - **Solo en desarrollo:** el resto de las peticiones dobles salen de `StrictMode`, que monta, desmonta y vuelve a montar los componentes. TanStack Query cancela la primera petición, porque pasamos la `signal` (aparece como `ERR_ABORTED` / 0 kB), y la repite. No pasa en producción y no se cambia: la `signal` es la que cancela las peticiones viejas al navegar.
- **Verificación:** 130 pruebas unitarias y 36 e2e en verde.

## Pendientes

- **Definir los roles de la plataforma con el equipo** (pedido de Esteban): qué roles existen, qué puede hacer cada uno en cada pantalla, cómo se asignan y cómo los refleja el frontend. Detalle en la sección 7 del `PLAN.md`. Hasta entonces, las reglas viven en `src/auth/permissions.ts`.
- **Pedidos al backend:**
  1. `GET /search?q=` (jugadores, equipos y torneos);
  2. notificaciones (listado, marcar leídas, contadores);
  3. próxima partida del usuario (para "TU PRÓXIMA");
  4. contador de pendientes de revisar para Administración → Torneos;
  5. opcional: el nivel del jugador en `/me/profile`.
- **Vistas:** cada placeholder se reemplaza con su handoff.
- **Efectos de tema en la topbar:** queda el cambio directo, y `useThemeFx` está listo si se decide usarlo también en la app.

## Cómo revertir

Todavía no hay commit: alcanza con descartar los cambios de los archivos de arriba.

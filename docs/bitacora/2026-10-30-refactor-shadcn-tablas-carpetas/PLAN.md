# Plan: shadcn donde se pueda, tablas con TanStack Table y módulos ordenados por carpetas

> Planeación original. Estado: **aprobado** por Esteban el 2026-10-30.

## Contexto

Mientras el backend trabaja en los pedidos E9 a E20, Esteban pidió un refactor del frontend (`web/frontend/src`) con tres tareas:

1. **Usar shadcn siempre que se pueda.** Revisar cada componente hecho a mano que repite algo que shadcn ya tiene, para no duplicar código ni procesos.
2. **Tablas grandes con TanStack Table.** Las listas con muchos datos y filtros no deben ser tablas armadas a mano en cada módulo. Las tablas chicas de pocos datos quedan como están.
3. **Carpetas por módulo:** `api/`, `components/`, `types/` y `pages/` (cuando hay sub vistas), en vez de todo suelto en la raíz del módulo.

Decisiones de Esteban:
- todos los módulos, por fases, con un commit por módulo;
- los helpers en `lib/`;
- las 12 listas grandes pasan a TanStack Table;
- **el aspecto queda igual que hoy**: es un refactor sin cambios visuales, y las variantes de shadcn se ajustan para que se vea igual.

## Lo que encontraron las tres revisiones

**shadcn**
- `card`, `field` y `separator` están instalados, pero ningún módulo los usa. Hay 44 tarjetas hechas a mano y 5 wrappers propios de tarjeta (`admin/ui` Card, `events/ui` Card, `teams/ui` Panel, `profile/ui` SectionCard, `player/tabs` card).
- No están instalados `badge`, `toggle-group`, `tabs`, `empty`, `progress`, `kbd`, `alert-dialog` ni `pagination`.
- Hechos a mano:
  - más de 30 pills y chips, 11 componentes de chip y 9 mapas de tonos repetidos;
  - unos 11 grupos de botones con `aria-pressed`, en dos estilos (segmentado con fondo muted y pills redondas) más 17 radiogroups;
  - 4 barras de pestañas, 4 variantes de estado vacío y 8 barras de progreso de un valor;
  - 4 separadores verticales, 2 `kbd` y 2 spinners con `animate-spin`;
  - 7 wrappers de campo (Field, AuthField, PointsField…).
- Repetidos entre módulos:
  - `Chips` y `FilterChips`; `KindBadge` y `KIND_LABEL` (3 veces);
  - 6 tiles de KPI o estadística;
  - `Loaded`, `ListState` y `QueryError` (15 botones "Reintentar");
  - 2 `EmptyState`, 2 `ConfirmDialog` y 2 wrappers de avatar (`PlayerAvatar` e `Initial`);
  - la inicial del alias, calculada en 8 lugares.

**Tablas**
- `@tanstack/react-table` no está instalado y nada lo usa.
- Las 12 listas grandes paginan desde el servidor:
  - Ranking: histórico, temporada y equipos;
  - Partidas (`matches/MatchesList`) y las partidas del perfil (`player/tabs`);
  - Admin: Baneos, Fichas, Cuentas, SteamID sin vincular, Demos, historial de ajustes de ELO y vista previa de temporada.
- Lo repetido es lo que rodea a la tabla:
  - la clase de cabecera, copiada 6 veces;
  - las filas de carga con un `colSpan` fijo;
  - la cadena de error, vacío y "Quitar filtros";
  - la fila clicable con `role="link"`, copiada 3 veces;
  - la paginación: `ListPagination`, más `Paging` y el `Pager` de admin;
  - los encabezados ordenables `SortHead` y `StatHead`.
- El estado vive en la URL (zod `validateSearch`) en Ranking, Partidas, el perfil y Baneos. El resto de admin lo guarda en `useState`.

**Carpetas**
- Ningún módulo sigue una convención de carpetas, y no hay barrels.
- El alias `@/` funciona en `tsconfig` y Vite; adentro de cada módulo los imports son relativos (`./queries` aparece 84 veces).
- Muchos imports cruzan módulos: `profile/queries`, `profile/schemas`, `public/queries`, `ranking/SearchBox`, `ranking/parts`, `teams/ui`, `maps/queries`, `mixes/*`, `auth/ui`…
- Hay un `vi.mock("@/features/onboarding/queries")` en `LoginForm.test` que se corrige a mano.

## Fase 0: preparación

- **Daniel sube todo lo suyo** antes de empezar. Se baja con pull, y se trabaja en la rama `refactor/frontend-estructura`, que sale de `feat/frontend-fase-1`.
- **Capturas de referencia** antes de tocar nada, para comparar después: en claro y oscuro, a 1440 y 375 px, las pantallas principales (Partidas, Ranking ×3, perfil público con sus pestañas, Mi equipo, Torneos, Mi perfil y cada sección de admin). Se sacan con un spec temporal de Playwright, como en las revisiones anteriores.
- **Bitácora:** `docs/bitacora/2026-10-30-refactor-shadcn-tablas-carpetas/PLAN.md`.

## Fase 1: carpetas (solo mover, sin cambiar lógica)

Convención para cada `src/features/<módulo>/`:

| Carpeta | Qué va |
|---|---|
| `api/` | `queries.ts`: queryOptions, claves y mutaciones |
| `types/` | `index.ts`: los alias `Schemas[...]` y los tipos propios del módulo (los que hoy están dentro de `queries.ts`) |
| `components/` | Las piezas que usan las páginas |
| `pages/` | Lo que renderiza una ruta: una por vista o sub vista |
| `lib/` | Helpers puros (labels, model, stats, search de la URL) y hooks que no son componentes |

- **Pruebas:** quedan al lado de su archivo. Las que prueban varios archivos se parten al mover: `admin/rules.test.ts` y `ranking/Ranking.test.tsx`.
- **Helpers pegados en componentes:** se sacan a `lib/` en el mismo movimiento. Ejemplos: `banSearchSchema`, las constantes de pestañas de admin, los helpers de las pestañas de servidores, `rerank`, y los helpers que viven en `public/queries`, `maps/queries` y `onboarding/queries`.
- **Lo que usan varios módulos** pasa a `src/components/`: `ranking/SearchBox`, `ranking/parts` (avatar y chips), `teams/ui` (`TeamCrest`) y `auth/ui`.
- **Archivos gigantes:** se parten en varios archivos dentro de `components/`:
  - `player/tabs.tsx` (1.399 líneas): un archivo por pestaña;
  - `matches/MatchesList.tsx` (687): en `components/`;
  - `teams/sections.tsx` (608): en `components/`.
- **Orden:**
  1. los módulos que más importan otros: `profile`, `public`, `ranking`, `teams`, `auth`, `maps`;
  2. después `mixes`, `matches`, `player`, `events`, `onboarding`, `shell`, `landing` y `theme-fx`;
  3. al final `admin/*`, una sub carpeta por commit.

  Después de cada módulo: `pnpm typecheck`, que detecta todas las rutas rotas, y las pruebas de ese módulo.
- **Documentación:** la convención se anota en `web/frontend/CLAUDE.md`.

## Fase 2: shadcn en lugar de lo hecho a mano

Se instalan con el CLI de shadcn (vía `pnpm dlx`, respetando la antigüedad mínima del `pnpm-workspace.yaml`): `badge`, `toggle-group`, `tabs`, `empty`, `progress`, `kbd` y `alert-dialog`. Cada uno se ajusta para conservar el aspecto actual.

| Categoría | Cambio | Cómo se mantiene el aspecto |
|---|---|---|
| Chips y estados | `Badge` con variantes de tono (win, warn, danger, vip, live, strong, muted) y de forma (pill o cuadrada de 4 px). Reemplaza los 11 componentes de chip y los 9 mapas de tonos | La CVA del Badge toma las clases de hoy |
| Grupos de botones | `ToggleGroup` con dos variantes: `segmented` (fondo muted) y `pills`. Reemplaza `Chips`, `FilterChips`, `LevelFilter`, los segmentados de `EventList`, `PlayerProfile` y `SeasonBar` (el desplegable de temporadas anteriores queda aparte), `ThemeSwitch`, `profile/ui` `Segmented` y `TeamSwitcher` | Variantes con las clases actuales |
| Opciones tipo tarjeta | `RadioGroup` (ya instalado) con contenido propio en `BanDialog`, `PrivacySection` y `MapPoolPicker`; `Checkbox` en `Recruit` y `MapPoolPicker` | El ítem conserva su tarjeta |
| Pestañas | `Tabs` (`variant="line"`): `AdminTabs`, las del perfil público (siguen fijas al bajar y con contador), `NotificationsMenu` y `StatsTabs`. Las de Torneos siguen siendo links | Se ajustan las clases del trigger |
| Tarjetas | `Card` en los 5 wrappers y las 44 tarjetas sueltas; un `StatTile` común sobre `Card` para los 6 tiles de KPI | Radios y rellenos por `className` o con una variante de tamaño |
| Vacíos | El `EmptyState` de `components/brand` se arma sobre `Empty`; los vacíos punteados (admin, `EmptyBox` de torneos) son `Empty` con borde punteado | Igual que hoy |
| Carga y error | Un `QueryState` común (carga, error con "Reintentar" y vacío) en lugar de `Loaded`, `ListState` y la lógica de `QueryError` | — |
| Progreso | `Progress` en las 8 barras de un valor. Las de victoria y derrota, las de Comparar, los pasos y las de gráfico quedan como están | Altura y color por clase |
| Otros | `Separator` en 4 lugares, `Kbd` en 2, `Spinner` en 2, `Field` en los 7 wrappers de campo y `AlertDialog` en los 3 diálogos de confirmación (se unifican los dos `ConfirmDialog`) | — |
| Repetidos | Un solo `PlayerAvatar` (con la inicial calculada en un lugar), un solo `KindBadge` y `KIND_LABEL`, y un solo `Fact` | — |

Quedan como están: `ScrollArea`, porque los desplazamientos nativos funcionan y el de la llave es un lienzo que se arrastra, e `Item`, porque cada fila tiene un diseño propio y el beneficio es bajo.

## Fase 3: TanStack Table

- **Instalación:** `@tanstack/react-table`, en una versión de al menos 7 días.
- **`src/components/data-table/`:**
  - `DataTable`: recibe las columnas (`ColumnDef`), los datos, el total y el estado de la consulta, y dibuja la Table de shadcn con la cabecera de clase única, las filas de carga según la cantidad de columnas, el error, el vacío con su acción, la fila clicable (`getRowHref` u `onRowClick`, accesible con Enter) y la fila seleccionada de admin.
  - `useUrlTable`: conecta `pagination` y `sorting` con la búsqueda de la URL (`manualPagination`, `manualSorting`, `rowCount`). Conserva los valores por defecto fuera de la URL y vuelve a la página 1 cuando cambia un filtro.
  - `SortHeader`: reemplaza `SortHead` y `StatHead`, con el ciclo de hoy (descendente, ascendente, por defecto).
  - `DataTablePagination`: `ListPagination` armado con las piezas de `Pagination` de shadcn (se instala `pagination`). El `Pager` de admin pasa a ser un modo de este componente.
  - `DataTableToolbar`: el bloque de búsqueda, filtros y cantidad.
- **Las 12 listas:** se migran una por commit. Las de admin que hoy guardan el estado en `useState` lo siguen haciendo, a través del mismo `DataTable`, sin cambiar de comportamiento.
- **Quedan a mano:** la tabla de un mix (`MixRoom`, unos 5 jugadores por bando), las posiciones de un torneo, el catálogo de mapas (borrador editable con reordenado) y las listas chicas.

## Bitácora y commits

- **Commits:** uno por módulo o por lista, en español con Conventional Commits (`refactor(frontend): …`).
- **Al terminar:** `DOCUMENTACION.md`, `GUIA_IMPLEMENTACION.md` (con la convención, los componentes comunes y cómo se arma una tabla nueva) y la fila en el `README.md`.

## Verificación

En cada fase:
- typecheck y lint limpios;
- todas las unitarias en verde, movidas con sus archivos;
- toda la suite e2e en verde (salvo la del ranking, que espera una temporada abierta);
- capturas comparadas con las de la Fase 0, sin diferencias visuales.

Pruebas nuevas:
- `useUrlTable`: página, orden, valores por defecto fuera de la URL y vuelta a la página 1 al filtrar;
- `DataTable`: carga, error con "Reintentar", vacío y fila clicable con el teclado;
- las variantes de `Badge` y `ToggleGroup`.

Las e2e existentes de Ranking, Partidas, el perfil y admin cubren el comportamiento de las 12 listas.

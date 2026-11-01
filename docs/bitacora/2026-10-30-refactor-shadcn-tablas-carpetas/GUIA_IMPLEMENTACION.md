# shadcn, tablas con TanStack Table y carpetas por módulo: guía de implementación

## Estado

Implementado y probado en local (2026-10-31) en la rama `refactor/frontend-estructura`, en 49 commits (48 de código y este de documentación). No hay nada que desplegar en los servidores: es solo frontend y sin cambios visuales.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/*/` | Cada módulo, ordenado en `api/`, `types/`, `components/`, `pages/` y `lib/`. Los archivos grandes se partieron: `player/tabs.tsx` en `player/components/tabs/`, más `matches/MatchesList.tsx` y `teams/sections.tsx` |
| `web/frontend/src/components/ui/` | Nuevos de shadcn: `badge`, `toggle-group`, `tabs`, `empty`, `progress`, `kbd`, `alert-dialog` y `pagination`. Ajustados: `badge`, `toggle`, `card`, `progress` y `field` |
| `web/frontend/src/components/brand/` | Nuevos: `FilterChips`, `Segmented`, `StatTile`, `QueryState`, `ConfirmDialog`, `PlayerAvatar`, `KindBadge`, `TeamCrest`, `Soon`, `ErrorAlert` y `AuthField`. `EmptyState` pasó a `Empty`. `ListPagination` pasó a `data-table/DataTablePagination` |
| `web/frontend/src/components/data-table/` | Nuevo: `useServerTable`, `url`, `DataTable`, `SortHeader`, `DataTablePagination` y sus pruebas |
| `web/frontend/src/features/admin/components/ui.tsx` | `AdminTable`. Se quitan `Card`, `Pager` y `headCell`. `Chip` y `AdminTabs` pasan a `Badge` y `Tabs` |
| `web/frontend/src/features/ranking/test/` | Datos, servidor de MSW y router simulado de las pruebas del ranking. `Ranking.test.tsx` se partió en `PlayersRanking.test.tsx`, `TeamsRanking.test.tsx` y `Compare.test.tsx` |
| `web/frontend/e2e/*.spec.ts` | Los filtros se buscan como `radio` (antes eran botones con `aria-pressed`). Los diálogos de confirmación se buscan como `alertdialog` |
| `web/frontend/package.json`, `pnpm-lock.yaml` | `@tanstack/react-table` 9.3.1 |
| `web/frontend/CLAUDE.md` | La convención de carpetas, los componentes comunes y cómo se arma una tabla |

## Despliegue

No aplica: no toca la base, el plugin ni el Worker. La web sale en el próximo despliegue del frontend.

## Pruebas

### Comparación de capturas

Antes de empezar se sacaron capturas de referencia con un spec temporal de Playwright: 26 pantallas de usuario y 8 de admin, en claro y oscuro, a 1440 y 375 px. Después de cada paso se compararon contra esas capturas, contando los píxeles que cambian.

Al final, todas las diferencias son el alias de la cuenta de prueba, que se crea en cada corrida, y las fechas relativas ("hace 15 días"). Hay una excepción: en las partidas del perfil, una columna se corre menos de un píxel.

Las capturas detectaron 8 diferencias durante el trabajo, que se corrigieron antes de cada commit (ver "Incidentes").

Las tablas de Demos, SteamID sin vincular y el historial de ajustes no estaban en las capturas de referencia. Se abrieron como admin después de migrarlas, y cargan sin errores y con el mismo diseño. La vista previa de temporada no se pudo ver con datos, porque en local no hay temporada abierta.

### Unitarias y e2e

- **Typecheck y lint:** limpios.
- **Unitarias:** 384 en verde, en 65 archivos. Hay pruebas nuevas para `DataTable`: el ciclo de orden, la fila clicable con Enter, la paginación con el total, el vacío y el error. También para `ConfirmDialog` (la frase y el motivo) y para `crestText`.
- **e2e:** 74 de 75. La que falla es la del ranking, que espera una temporada abierta y ya fallaba antes del refactor.

## En qué se apartó del plan

- **Commits:** el ranking (3 listas), Partidas y las partidas del perfil salieron en un solo commit, y las 7 de Administración en otro, en lugar de uno por lista. Ese primer commit también suma `components/data-table` y saca `ListPagination`, que esas cinco listas usaban.
- **`useUrlTable` → `useServerTable` + `url.ts`:** el hook no sabe de dónde vienen la página y el orden. Las listas con estado en la URL usan `urlPaging` y `urlSorting`; las de Administración le pasan su `useState`.
- **`DataTableToolbar` no se hizo:** la barra de búsqueda y filtros de cada lista es distinta (búsqueda más chips, interruptor de PCW, selects de Baneos), y un componente común no ahorraba código.
- **`Fact` no se unificó:** los tres son diseños distintos (una lista `dl` en Baneos, la cifra grande de Temporadas y la fila con ícono de la bio).
- **`Spinner`:** el de la demo pendiente en un mix queda como está. Es un ícono decorativo distinto y el `Spinner` de shadcn le sumaría `role="status"`.
- **Diálogos de confirmación:** pasan a `AlertDialog`, como decía el plan. Con eso hay dos cambios visibles:
  - ya no tienen la ✕ de cerrar (se cierran con "Cancelar" o Escape) ni se cierran al hacer clic afuera;
  - el roster y cerrar sesión toman el estilo del de admin (título en `font-medium` en lugar de `font-semibold`).
- **`Card`:** se le sumó la prop `radius`, porque el `cn` no fusiona `rounded-tile` ni `rounded-hero` con los radios de Tailwind.

## Incidentes durante las pruebas

Todos se vieron en la comparación de capturas y se corrigieron antes del commit:

| Qué pasó | Arreglo |
|---|---|
| El atajo "Ctrl K" de la barra quedó vacío por un reemplazo con perl | Commit `3a96adb` |
| El `Kbd` de shadcn usa `font-medium` | `font-normal` |
| El `Separator` vertical se pegaba arriba | `data-vertical:self-center` (con el mismo prefijo que la clase de shadcn, si no pierde por especificidad) |
| `TabsList` y `TabsContent` imponían alto y `text-sm` | `group-data-horizontal/tabs:h-auto` y `text-[length:inherit]` |
| La variante `line` sacaba el subrayado del perfil | La sombra con el mismo prefijo |
| `Toggle` con `min-w-8` ensanchaba el rango del ELO | `min-w-0` |
| Las preferencias perdían el salto de línea | `className="flex-wrap"` |
| El horizontal de `Field` alinea arriba con `FieldContent` (puntos del ranking de equipos) | `has-[>[data-slot=field-content]]:items-center` |

## Cómo revertir

Es solo frontend. Para volver atrás:

- todo: se descarta la rama `refactor/frontend-estructura`;
- una parte: se revierte el commit de ese paso con `git revert`. Los pasos de la Fase 3 dependen de `30aeee0`.

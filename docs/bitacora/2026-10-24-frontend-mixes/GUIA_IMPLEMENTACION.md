# Mixes en el frontend: guía de implementación

## Estado

Implementado y probado en local el 2026-10-24, sin commit ni despliegue: pruebas unitarias, de componentes y de punta a punta en verde. Falta la maestra de mapas en el backend, y ver con datos reales la sala en vivo, la vista de admin y la foto del mapa.

## Archivos

| Archivo | Cambio |
|---|---|
| Rama `feat/frontend-fase-1` | Fusión de `feat/backend-api-fase-1` (`cd7eb75`): trae `/mixes`, `/mixes/stats`, `tv`, `demo_size` y `DELETE /admin/mixes/{id}` |
| `web/frontend/src/api/schema.d.ts` | Regenerado con `pnpm gen:api` |
| `src/routeTree.gen.ts` | Regenerado por el plugin del router |
| `src/features/public/queries.test.ts` | Suma `tv_address` al servidor de prueba (campo nuevo del estado de los servidores) |
| `src/components/ui/table.tsx`, `toggle.tsx`, `radio-group.tsx` | Nuevos, con `shadcn add` |
| `src/components/brand/LevelBadge.tsx` | Prop `size` (20, 22 y 26 px) |
| `src/auth/permissions.ts` | `canDeleteMix` |
| `src/features/maps/queries.ts` (+ prueba) | Maestra de mapas: tipo, `mapsOptions` (vacía por ahora), `activeMapNames` y `mapImage` |
| `src/features/mixes/` | `queries.ts`, `labels.ts`, `search.ts`, `room.ts`, `parts.tsx`, `MapBackdrop.tsx`, `MixesList.tsx`, `MixRoom.tsx`, `MixRoomPages.tsx`, `DeleteMixDialog.tsx` y sus pruebas |
| `src/routes/_app/mixes.tsx` → `mixes.index.tsx` | El listado (antes un "Hello"). Pasó a `index` para que `/mixes/live/$uid` no quede anidada |
| `src/routes/_app/mixes.live.$uid.tsx` | Nueva: sala en vivo |
| `src/routes/_app/match.$id.tsx` | Sala del mix; las demás partidas siguen con el placeholder |
| `src/features/shell/nav.ts` (+ prueba) | Migas "Mixes › En vivo" |
| `e2e/mixes.spec.ts` | Nueva prueba de punta a punta |
| `docs/PENDIENTES.md` | Pedidos al backend de este requerimiento |
| `docs/bitacora/2026-10-24-frontend-mixes/CHANGELOG_DISCORD.txt` | Changelog para jugadores (la sala del mix; el listado ya está en el de `2026-10-24-api-mixes-perfil-ranking`). Publicar cuando salga la web nueva |

## Despliegue

No se desplegó. Sale con la web nueva, junto con la maestra de mapas (decisión de Daniel del 2026-10-24).

## Pruebas

### Unitarias y de componentes (Vitest, 2026-10-24)

`pnpm test`: 31 archivos y 224 pruebas en verde (eran 186). `pnpm typecheck`, `pnpm lint` y `pnpm build` también en verde. Las nuevas cubren:

- **Textos y cálculos:** demo, motivo de cancelación, nick, HS %, ADR (con 0 kills y 0 rondas), signo, MB y SourceTV.
- **Estado de la URL:** valores válidos, inválidos y los parámetros que van a la API.
- **Paginación:** la lista de números de página.
- **Modelo de la sala:** terminado, cancelado, empate y en vivo.
- **Maestra de mapas:** activos y foto por nombre.
- **`MapBackdrop`:** con foto, sin foto y foto que no carga.
- **Listado (con MSW):**
  - filas en vivo con y sin TV, `stale`, terminada y cancelada;
  - "Ver en TV" no navega;
  - los toggles, los filtros que van a la API, el buscador con debounce y la paginación;
  - sin select cuando la maestra está vacía.
- **Sala (con MSW):**
  - terminada: Δ ELO, MVP, invitado y la fila propia;
  - cancelada por caída;
  - en vivo, el `404` y el `304` con `If-None-Match`.
- **Borrado:** "estoy seguro", la elección del ELO, el toast y un error de la API.

### En el navegador (2026-10-24)

Contra la API local (`pnpm dev:node`) y la Supabase en Docker, que tiene datos de prueba: 45 mixes terminados y 5 cancelados, ninguno en vivo.

- **Capturas:** con Playwright y el Chromium 1194 ya instalado, del listado y de la sala de un mix terminado, en 1440 y 390 px, claro y oscuro.
- **Resultado:** sin errores en la consola.
- **Lo que corregí con las capturas:**
  - la fecha vacía (se usa la de fin si falta la de inicio);
  - "1 jugadores";
  - el orden de nombre y cuadro de los bandos en el celular;
  - los KPIs, que en el celular pasan a dos columnas.

### Punta a punta (Playwright, 2026-10-24)

Después de que Daniel instaló el Chromium que pide Playwright 1.64 (`chromium-headless-shell` 1248), con la API local y `VITE_API_URL=http://localhost:8787`:

- **`e2e/mixes.spec.ts`:** 2 pruebas en verde.
  - Listado: KPIs, "Ocultar canceladas" en la URL, paginación, abrir un mix terminado y "Volver".
  - Un mix en vivo que no existe muestra "Este mix terminó.".
- **La suite completa:** 46 pruebas en verde. La fusión del backend y los cambios no rompieron otras vistas.

### Lo que no se probó

- **Sin datos para probarlas en el navegador:**
  - la sala en vivo (no hay mixes en vivo en la base local);
  - el botón de borrar (la cuenta de prueba no es admin);
  - la foto del mapa (la maestra no existe).

  Las tres están cubiertas por las pruebas de componentes.
- **`.env.local`:** no existe en `web/frontend`, así que `pnpm dev` arranca con la página en blanco. Las capturas y Playwright se corrieron con `VITE_API_URL=http://localhost:8787` en el entorno, sin crear el archivo.

## En qué se apartó del plan

- **`badge`:** no se agregó, porque no hizo falta.
- **Motivo de cancelación:** la API manda códigos (`crash`, `map_change`, `abandoned`, `admin`). Esos cuatro se traducen; cualquier otro valor sale tal cual (texto libre, como decidió Daniel).
- **"ELO pendiente" en el listado:** `MixItem` no trae `review`, así que en el listado no se puede mostrar. En la sala sí está (aviso "Un admin tiene que decidir…"). Queda como pedido al backend.
- **Select de mapas:** sin maestra se oculta, en lugar de mostrar solo "Todos los mapas".
- **KPIs en el celular:** dos columnas en lugar de una (el prototipo usa `auto-fit` de 180 px, que en 390 px las apila de a una).
- **`mixes.tsx` pasó a `mixes.index.tsx`:** sin ese cambio, `/mixes/live/$uid` quedaba anidada dentro del listado.
- **"Volver":** lleva a `/mixes` en lugar de volver atrás en el historial.
- **Fecha de la fila:** si falta `started_at`, se usa `ended_at`.
- **Tipo de la sala:** `room.ts` usa un tipo estructural (`MatchInput`) porque el `MatchDetail` generado no se puede asignar tal cual a la respuesta de openapi-fetch (`team` sale como `TeamRef & Record<string, never>`).

## Cómo revertir

Descartar los cambios de `web/frontend` de este requerimiento (o revertir su commit cuando exista). La fusión del backend (`cd7eb75`) es independiente: se revierte con `git revert -m 1 cd7eb75` solo si hace falta sacar también la API nueva de esta rama.

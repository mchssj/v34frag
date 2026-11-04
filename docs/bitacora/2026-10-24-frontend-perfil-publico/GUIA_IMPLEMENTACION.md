# Perfil público en el frontend: guía de implementación

## Estado

- **Backend:** implementado, probado, commiteado y con push el 2026-10-24 (`5f786eb` en `feat/backend-api-fase-1`).
- **Frontend:** implementado y probado en local el 2026-10-24, sin commit. El backend ya está fusionado en `feat/frontend-fase-1` (`80df759`).

## Archivos

| Archivo | Cambio |
|---|---|
| `web/backend/src/lib/list.ts` (+ `test/unit/list.test.ts`) | Columnas con dirección fija (`col:desc`) |
| `web/backend/src/routes/seasons.ts` (+ `test/unit/seasons-routes.test.ts`) | `rank` → `['rank', 'elo:desc']` en `standings` y en la vista previa. La prueba fijaba el orden viejo (`elo.asc`) y se actualizó |
| `web/backend/src/routes/players.ts`, `src/schemas/players.ts` (+ `test/integration/players-teams.test.ts`) | `is_captain` en el historial de equipos |
| `docs/frontend/contrato/README.md`, `jugadores.md`, `temporadas.md` | Los dos cambios en el contrato |
| `web/frontend/src/api/schema.d.ts` | Regenerado con `pnpm gen:api` |
| `web/frontend/src/routes/_app/player.$nick.tsx` | El perfil (antes `Placeholder`), con `validateSearch` |
| `web/frontend/src/features/player/` (nuevo) | `search.ts`, `queries.ts`, `labels.ts`, `PlayerProfile.tsx`, `EloChart.tsx`, `tabs.tsx` y sus pruebas |
| `web/frontend/src/features/profile/schemas.ts` | Exporta `STEAM_LINK` y `FACEIT_LINK` |
| `web/frontend/e2e/player.spec.ts` | Nueva prueba de punta a punta |
| `web/frontend/CLAUDE.md` | `player/` en la estructura |
| `docs/PENDIENTES.md` | Los pedidos al backend de Ranking y Perfil, marcados como hechos |
| `docs/bitacora/2026-10-24-frontend-perfil-publico/CHANGELOG_DISCORD.txt` | Changelog para jugadores. Publicar cuando salga la web nueva |

## Cómo se hizo el backend

La rama `feat/backend-api-fase-1` no tiene el frontend, y Vite estaba corriendo en esta copia. Por eso el backend se hizo en un worktree aparte (`git worktree add ../v34frag-backend feat/backend-api-fase-1`), con `pnpm install --frozen-lockfile`, commit y push. Después se fusionó en `feat/frontend-fase-1` y se borró el worktree.

- **El push** también subió `887cedb` (medio tiempo de 3 s), que ya estaba commiteado en esa rama pero no se había pusheado.
- **La API local** (`pnpm dev:node`) se cayó al recargar con el merge y hubo que levantarla de nuevo.

## Cambios respecto al plan

| Plan | Quedó | Por qué |
|---|---|---|
| Filtro de resultado "Todas" | "Cualquier resultado", separado del filtro de tipo con una línea | En la captura se veían dos chips "Todas" seguidos |
| Ficha sin cuenta: aviso de `!claim` con "Generar código" | **Sin aviso** (corregido el 2026-10-25, después de la entrega) | Daniel: el `!claim` se hace desde la cuenta (Mi perfil → Vincular con el servidor, contrato 5b), sin entrar a ninguna ficha. La prueba de componentes ahora verifica que no aparezca |
| Componentes `PlayerHeader`, `LevelCard`, `StatTiles` y `tabs/*` en archivos separados | `PlayerProfile.tsx` (cabecera, nivel, gráfico y tiles) y `tabs.tsx` (las seis pestañas) | Menos archivos chicos, como en Mixes y Ranking |
| Estados vacíos | Se sumaron "Todavía no jugó partidas en el servidor.", "Todavía no jugó mapas…", "Todavía no estuvo en ningún equipo oficial.", "Todavía no escribió su biografía." y "Todavía sin títulos." | El handoff solo traía el de medallas |

## Despliegue

No se desplegó. El frontend sale con la web nueva. El backend sale con el corte del replanteo (no necesita migración nueva).

## Pruebas

### Backend (2026-10-24)

- `pnpm test` (unitarias): 21 archivos y 297 pruebas en verde.
- `vitest --project integration test/integration/players-teams.test.ts`: 14 en verde, incluido `is_captain` del líder y de un ex miembro.
- **No se corrió `seasons.test.ts`:** borra todas las temporadas de la base (línea 40), así que habría borrado BETA. El orden se probó con la unitaria de `runList`, la de `seasons-routes` y contra BETA en la API local: después del 6.º vienen musul (1182), romanxz (1103), bant1 (1101)…

### Frontend, unitarias y de componentes (Vitest, 2026-10-24)

`pnpm test`: 35 archivos y 263 pruebas en verde (eran 242). `pnpm typecheck`, `pnpm lint` y `pnpm build` también en verde. Las nuevas cubren:

- **`labels.ts`:** nivel y escalera, Steam (link sí, SteamID no), FACEIT (nick o link), marcador desde su lado, títulos por tipo, resultado, rol con "líder", período, historial de la web vieja, ajustes, barras de los tiles y la URL.
- **Componentes, con MSW:**
  - perfil público completo (sin SteamID, FACEIT, máximo de la temporada, "Faltan…", partidas, logros, ajustes y gráfico);
  - privado visto por otro jugador;
  - privado visto por el dueño (aviso y "Editar perfil");
  - ficha sin cuenta;
  - nick inexistente;
  - equipos con líder y "Antes de CM League";
  - temporadas vacías;
  - bio con palmarés;
  - filtros y clic en una partida.

### Punta a punta (Playwright, 2026-10-24)

`pnpm exec playwright test player ranking mixes`: 8 en verde contra la API local con la copia de producción.

- El primero del ranking abre su perfil, cambia el gráfico a 10, recorre las pestañas, filtra por Mix y abre una partida.
- Un nick que no existe lleva al Ranking.

### Capturas (2026-10-24)

Con Playwright, fuera del repo (tienen datos de la copia de producción):

- kyan: resumen en 1440 claro y 390 oscuro; mapas, partidas, equipos y bio.
- Un perfil privado, una ficha sin cuenta y un nick que no existe.

Se revisaron contra la vista previa aprobada. kyan tiene un SteamID en el campo de Steam y el botón no aparece, como se decidió.

## Falta

- Ver la pestaña Temporadas con datos: aparecen recién cuando cierre BETA.
- Ver Mapas con fotos (depende de la maestra de mapas del backend).

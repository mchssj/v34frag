# Ranking en el frontend: guía de implementación

## Estado

Implementado y probado en local el 2026-10-24, sin commit ni despliegue. Las pruebas unitarias, de componentes y de punta a punta están en verde. La temporada BETA está creada en la Supabase local. Queda para el backend un bug de orden en la tabla de una temporada (abajo).

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/routes/_app/ranking.index.tsx`, `ranking.teams.tsx`, `players.compare.tsx` | Reemplazan los `Placeholder`, con `validateSearch` |
| `src/features/ranking/` (nuevo) | `search.ts`, `queries.ts`, `labels.ts`, `parts.tsx`, `SearchBox.tsx`, `SeasonBar.tsx`, `PlayersRanking.tsx`, `TeamsRanking.tsx`, `Compare.tsx` y sus pruebas |
| `src/components/brand/ListPagination.tsx` (nuevo) | La paginación de Mixes, sacada a un componente común con `pageList` |
| `src/features/mixes/MixesList.tsx`, `search.test.ts` | Usan `ListPagination` (sin cambio visible) |
| `src/components/brand/LevelBadge.tsx` | Tamaños 24 (ranking) y 30 px (comparador) |
| `src/components/ui/switch.tsx` | Nuevo, con `shadcn add switch` |
| `e2e/ranking.spec.ts` | Nueva prueba de punta a punta |
| `docs/PENDIENTES.md` | Pedidos al backend y la primera temporada como paso del corte |
| `docs/bitacora/2026-10-24-frontend-ranking/pruebas/temporada_beta_local.sql` | BETA en local (corrido el 2026-10-24) |
| `docs/bitacora/2026-10-24-frontend-ranking/CHANGELOG_DISCORD.txt` | Changelog para jugadores. Publicar cuando salga la web nueva |

No hizo falta fusionar el backend ni correr `pnpm gen:api`: los endpoints y sus tipos ya estaban en la rama.

## Cambios respecto al plan

| Plan | Quedó | Por qué |
|---|---|---|
| País con su nombre en español (`Intl.DisplayNames`) | Se muestra tal cual llega | La API ya manda el nombre ("Argentina"), no el código |
| Migas "Ranking / BETA" | Siguen "Ranking" y "Ranking › Equipos" | La temporada ya se ve en la franja; las migas no la necesitan |
| `RankingHeader`, `RankingPodium`, `PlayerRankingTable`, etc. en archivos separados | Agrupados en `parts.tsx`, `PlayersRanking.tsx`, `TeamsRanking.tsx` y `Compare.tsx` | Menos archivos chicos, como en Mixes |
| Podio de equipos "{G}G · {P}P · {%} victorias" | Igual, y "Sin partidas" en lugar del porcentaje cuando no jugó | Con `win_rate: null` decía "— victorias" |

## Despliegue

No se desplegó. Sale con la web nueva. En el corte:

1. Aplicar el replanteo `24` (temporadas), como ya decía `docs/PENDIENTES.md`.
2. **Abrir la primera temporada con inicio antes del primer mix**, con el SQL de `pruebas/temporada_beta_local.sql`. Revisar antes la fecha de inicio (el primer mix de producción), la de fin y el nombre (BETA u otro). No usar el botón del admin: `season_start` abre la temporada en `now()`.
3. Al publicar los changelogs, sacar del de `2026-10-20-temporadas` la línea "Lo que jugaste antes de la primera temporada te cuenta para el ELO, pero no para las medallas": con BETA no hay nada antes de la primera temporada.

## Pedidos al backend

Anotados en `docs/PENDIENTES.md` (sección 6):

- **Bug de orden:** en `GET /seasons/{id}/standings` con el orden por defecto, los sin puesto salen por ELO de menor a mayor (`routes/seasons.ts:200`, `['rank', 'elo']` con `asc` en los dos). Se ve en la tabla de BETA: después del 6.º viene 888, 891, 896… El frontend no lo puede corregir porque la página la arma el servidor.
- **(Opcional)** `teams`, `rating`, `kd` y el filtro `level` en esa respuesta.

## Pruebas

### Unitarias y de componentes (Vitest, 2026-10-24)

`pnpm test`: 33 archivos y 242 pruebas en verde (eran 224). `pnpm typecheck` y `pnpm lint` también en verde. Las nuevas cubren:

- **`labels.ts`:** rol y país con nulls, `—` para nulls, sigla o iniciales, tendencia (`null`, `0`, ±n), cuenta regresiva (incluida la vencida), barras y ganador del comparador.
- **`search.ts`:** valores inválidos, parámetros del Histórico, de la temporada (sin `rating`) y de equipos.
- **Componentes, con MSW:**
  - temporada activa por defecto: franja, medalla, fila sin puesto con "12/20", la fila propia y el ELO "al cerrar";
  - sin temporada activa (`404`) abre el Histórico, con "+1", rol y país, y el sparkline;
  - el podio se pide sin filtros y no cambia al filtrar;
  - clic en una fila abre el perfil;
  - equipos: "TU EQUIPO" en los dos equipos del usuario, la leyenda con PCW y los tooltips de tendencia;
  - comparador: sin B, con A y B (filas, gráfico, juntos y rivales) y el `404`.

### Punta a punta (Playwright, 2026-10-24)

`pnpm exec playwright test mixes ranking`: 6 pruebas en verde contra la API local, con la copia de producción y BETA.

- `/ranking` abre BETA, "Solo con puesto", pasa a Histórico, filtra por nivel (el podio no cambia), ordena por K/D y abre un perfil.
- `/ranking/teams` con y sin PCW.
- El comparador con tres jugadores reales, incluida la búsqueda del combobox.
- Mixes sigue pasando con la paginación común.

### Capturas (2026-10-24)

Con Playwright, de las cuatro vistas (temporada, Histórico, equipos con PCW y comparador) en 1440 y 390 px, claro y oscuro. Quedaron fuera del repo (tienen nicks de la copia de producción). Se revisaron contra la vista previa aprobada:

- **Bien:** franja, podio, tablas, chips de nivel, sparklines, comparador y gráfico.
- **En 390 px:** las tablas se desplazan de lado dentro de su tarjeta, como en Mixes.
- **Datos locales:** los equipos de la base local no tienen partidas de torneo, así que todos empatan en 0 y la tendencia y la forma salen "–". La forma y la tendencia con datos se probaron con MSW.

## Falta

- Que el backend corrija el orden de los sin puesto.
- Ver Equipos con partidas de torneo reales (forma, tendencia y podio con puntos).
- Ver una temporada cerrada (no hay ninguna en local).

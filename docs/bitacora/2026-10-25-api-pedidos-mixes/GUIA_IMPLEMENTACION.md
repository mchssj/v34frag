# Pedidos del frontend de Mixes a la API: guía de implementación

## Estado

Implementado y probado en local el 2026-10-25, en la rama `feat/backend-api-fase-1`, sin commit. Sin migración: sale con el corte, junto con el resto de la API.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/backend/src/routes/live.ts` | `404` con `details.match_id` (busca `matches.external_id`); `elo` y `level` en cada jugador; la consulta de fichas suma `steam_id` |
| `web/backend/src/routes/matches.ts` | `elo` y `level` en cada jugador del detalle; la consulta de fichas suma `steam_id` |
| `web/backend/src/routes/mixes.ts` | `review` en cada fila, leído de `match_list` para los `match_id` de la página; `toMixItem` recibe la revisión |
| `web/backend/src/services/live.ts` | `eloBySteam` (una consulta a `player_elo`) y `eloLevel` |
| `web/backend/src/schemas/matches.ts` | `elo` y `level` en `PlayerLine`; `ReviewStatus` se reexporta desde `common.ts` |
| `web/backend/src/schemas/live.ts` | `elo` y `level` en `LivePlayerLine`; `review` en `MixItem` |
| `web/backend/src/schemas/common.ts` | `ReviewStatus` (antes en `matches.ts`; `matches.ts` importa de `live.ts`, así que importarlo al revés armaba un ciclo) |
| `web/backend/test/unit/mixes-perfil.test.ts` | `review` en `toMixItem` y `eloLevel` (con ficha, bajo, bot, sin SteamID) |
| `web/backend/test/integration/live.test.ts` | `404` con y sin `match_id`, `review` en `/mixes` (pendiente y descartado), `elo` y `level` de cada jugador contra `player_elo` |
| `docs/frontend/contrato/partidas.md`, `README.md`, `decisiones.md` | Los tres cambios y sus decisiones |
| `docs/bitacora/README.md` | Fila del requerimiento |

## Despliegue

No se desplegó. Sale con el corte de la web nueva (no necesita migración).

## Pruebas

### Unitarias (2026-10-25)

`pnpm test`: 22 archivos y 310 pruebas en verde (eran 308). `pnpm typecheck` en verde. El backend no tiene script de lint.

### Integración, contra la Supabase local (2026-10-25)

- `live.test.ts`: 6 en verde, con los casos nuevos:
  - un mix cerrado como caída da `404` con `details.match_id` igual al de la partida creada;
  - un uid que nunca existió da `404` sin `details`;
  - `/mixes` trae `review: "pending"` en el interrumpido y `"discarded"` después de descartarlo;
  - después de aplicar el ELO, el `elo` de cada jugador del detalle es el de `player_elo` y `level` es `levelOf(elo)`.
- También en verde, porque tocan partidas y mixes: `mixes-perfil-ranking`, `stats-partida`, `claim`, `pcw` y `tournaments` (33 pruebas).
- **No se corrió `seasons.test.ts`:** borra todas las temporadas, BETA incluida.

### Contra la copia de producción (API local, 2026-10-25)

- `/mixes?per=100`: 79 mixes, todos con `review` (en `null`: en la copia no hay interrumpidos sin revisar).
- Detalle de 40 mixes: 183 líneas, todas con ELO (3 invitados sin ficha, con el ELO de su SteamID) y ningún nivel distinto de `levelOf`.
- Un uid inexistente en `/mixes/live/{uid}`: `404` sin `details`.
- Los 52 mixes reales que mandó el plugin tienen `external_id`. Los 27 mixes sin `external_id` son restos de pruebas de integración, todos de hoy: servidores "Srv …" o partidas sin servidor.

## Cambios respecto al plan

| Plan | Quedó | Por qué |
|---|---|---|
| `ReviewStatus` se importa de `schemas/matches.ts` | Pasó a `schemas/common.ts` y `matches.ts` lo reexporta | `matches.ts` ya importa de `live.ts`: importarlo al revés armaba un ciclo |
| `docs/PENDIENTES.md`: los tres pedidos marcados como hechos | Se marcan al fusionar en `feat/frontend-fase-1` | Esa sección ("Pedidos del frontend de Mixes") solo existe en la rama del frontend. Marcarla acá generaría un conflicto |

## Incidentes durante las pruebas

- **La API vieja seguía en el puerto:** al detener la API de la copia del frontend, el proceso de `tsx` (PID 34500) quedó vivo con el puerto 8787. La API nueva no pudo levantar (`EADDRINUSE`) y la primera verificación respondió sin los campos nuevos. Se cerró ese proceso y se levantó la API desde el worktree.

## Cómo revertir

Revertir el commit de este requerimiento en `feat/backend-api-fase-1`. No hay nada que deshacer en la base.

# Desglose de la fórmula de ELO (prototipo VIP)

Prototipo de Kyan para que lo terminen Daniel (backend) y Esteban (frontend). Está en el frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), en `/demo/elo`, solo con `pnpm dev`.

## Qué hace

A la izquierda están los últimos 10 mixes, con el cambio de ELO de cada uno. Al tocar uno, a la derecha aparece su **ticket** con los 7 pasos del cálculo:

| Paso | Qué muestra |
|---|---|
| 1. Probabilidad | `p = Φ((fuerza tuya − fuerza rival) / incertidumbre)` y si eran favoritos |
| 2. Base | `round(2 × 30 × (resultado − p))` |
| 3. Bonus por rating | `round((rating − 1) × 10)`, con tope de ±5 (avisa si se cortó) |
| 4. Peso por rondas | 0 si jugaste menos del 35 %, 1 desde el 90 %, si no `rondas / total` |
| 5. Cambio | `round((base + bonus) × peso)` |
| 6. Mínimo ±1 | Si el ganador quedaba en 0 o menos, o el perdedor en 0 o más |
| 7. ELO mínimo | Si quedaba por debajo de 100 |

Los 10 mixes de ejemplo están armados para que cada uno muestre una regla: equipos parejos, ganar o perder como favorito o no, el tope del bonus, jugar una parte del mix, menos del 35 % y el mínimo +1.

- **Simulador:** debajo hay uno con resultado, probabilidad, rating y rondas, que arma el mismo ticket en vivo.
- **Sin VIP:** se ve la lista con los cambios, pero el ticket queda borroso con un cartel y no hay simulador.

## La fórmula

`features/elo/formula.ts` es una copia en TypeScript de `elo_apply_match` (`supabase/migrations/20261014120000_elo_participacion.sql`). Usa los mismos redondeos que Postgres:

- **La base y el cambio** se calculan con `double precision`, así que los .5 se redondean al par (`pgRoundEven`).
- **El bonus** se calcula con `numeric`, así que los .5 se alejan del cero (`pgRound`).

`formula.test.ts` controla la tabla de pesos de la documentación de participación, el tope del bonus, el mínimo +1, el piso y los redondeos. **Si cambia `elo_apply_match`, hay que cambiar este archivo.**

| Archivo (en `web/frontend/src/`) | Qué tiene |
|---|---|
| `features/elo/formula.ts` | `breakdown()`, `eloWeight()`, `ncdf()` y los redondeos |
| `features/elo/formula.test.ts` | 7 tests |
| `features/elo/demo.ts` | Los 10 mixes de ejemplo |
| `features/elo/EloBreakdown.tsx` | Lista, ticket y simulador |
| `routes/demo.elo.tsx` | La ruta con la barra Demo |

## Lo que falta para la versión real

- **Daniel:** una ruta con el desglose de cada mix del jugador.
  - `match_player_elo` ya tiene `elo_before`, `elo_after`, `elo_delta` y `win_prob`.
  - Faltan el `rating` y las `rounds` del jugador, el total de rondas del mix y el peso.
  - Lo más simple es que la ruta devuelva directamente los pasos (`base`, `bonus`, `weight`), calculados con el `elo_config` que había en ese momento.
- **Esteban:** el ticket en el perfil o en la sala del mix.
- La fuerza de los equipos (μ) no se muestra: es un número interno de TrueSkill y confundiría. Solo se muestra la probabilidad que sale de esa fuerza.

## Pruebas (2026-10-29)

- Los 7 tests de `formula.test.ts` pasan.
- En el navegador se revisaron los tickets de los 10 mixes. El de equipos parejos con rating 1,18 da `+30 +2 × 1 = +32`. El del 26 % de las rondas da 0. El del muy favorito con rating 0,55 queda en +1 por la regla del mínimo.
- No se comparó contra mixes reales de la base, porque el prototipo no tiene API.

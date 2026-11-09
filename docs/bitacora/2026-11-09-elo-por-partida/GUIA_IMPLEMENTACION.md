# El ELO se gana en la partida que jugaste: guía de implementación

## Cambios respecto del plan

- La probabilidad se guarda redondeada a 4 decimales y el cálculo usa ese mismo valor; el factor del tope, a 4 decimales; el multiplicador, a 2. Así `elo_recompute_player` da exactamente lo mismo que `elo_apply_match`.
- `elo_set_config` mantiene los parámetros del bonus (la fórmula vieja los usa para recalcular la BETA) y suma seis opcionales.
- La vista previa suma "Partidazo" (rating 1,80), "Favorito" y "No favorito" (±200 de ELO).
- La pestaña muestra el bonus viejo en un grupo aparte, "Mixes anteriores a la Temporada 2".
- No se probó en el navegador: hace falta aplicar la `98` y la `100` en la base local (ver "Falta").
- La prueba de integración `test/integration/elo.test.ts` no se corrió: borra temporadas y recalcula el ELO de la base local.

## Pruebas

### Base (local, con rollback; la base local no tiene la `98` y la prueba la aplica antes)

| # | Prueba | Resultado |
|---|---|---|
| 1 | 248 filas con la fórmula nueva coinciden con una cuenta aparte (abandonos incluidos) | ok |
| 1b | `elo_mult` y `elo_scale` guardados | ok |
| 2 | Ningún equipo pasa de 30 (6 equipos escalados) | ok |
| 3 | Mínimo de 10 en los terminados con peso completo | ok |
| 4 | Los mixes anteriores a `formula_from` no cambian | ok |
| 5 | `elo_recompute_player` coincide con `elo_recompute_all` en 5 jugadores | ok |
| 6 | Un ajuste manual de +100 (`mm_balance_override_set`) no cambia el ELO de nadie | ok |
| 7 | `mm_elo_stake` entre 10 y 30 en 60 salas | ok |
| 8 | `elo_set_config` con y sin los parámetros nuevos, y la validación | ok |
| 8b | Con la fórmula en todo el historial: 1117 filas, 20 de mixes interrumpidos con mínimo 1 | ok |
| 8c | 5 abandonos con la cuenta de `mm_elo_delta` y al menos −10 | ok |
| 9 | La inversa deja las cuatro funciones con el mismo `md5` y saca las columnas | ok |

### API

`pnpm test`: 595 pruebas unitarias (la fórmula, el mirage del 2026-11-09, el tope, el mínimo, la participación, los esquemas y las rutas). `pnpm typecheck` sin errores. `src/db/types.ts` se editó a mano (columnas de la `98` y la `100`): la base local tiene cosas de otras ramas y no sirve para `pnpm db:types`.

### Web

`src/api/schema.d.ts` generado desde el `openapi.json` de la app (solo cambia lo del ELO). `pnpm typecheck`, `pnpm test` (710), `eslint` y `prettier` sin errores.

## Despliegue en producción (todo en la misma tanda)

1. Sin un mix por terminar en ese momento (el recálculo bloquea `player_elo` unos segundos).
2. Base: aplicar la `100` en el VPS, `notify pgrst, 'reload schema';`, comprobar `select base, min_delta, team_cap, formula_from from elo_config;` (20, 10, 30 y el inicio de la Temporada 2) y `select elo_recompute_all();`.
3. Comprobar el mix `ea84eb1a`: +30, +30, +30, +15, +15 y −25, −25, −23, −20, −18.
4. API y web desde `main`, como siempre.

**Estado: desplegado el 2026-11-09**, con un mix del matchmaking conectando en el #2 (siguió y pasó a en vivo):

- **Base (20:53 UTC):** la `100` aplicada, PostgREST recargado, `elo_config` en 20, 10, 30, 0,75–1,5 y 0,5–1,25 desde el inicio de la Temporada 2; `elo_recompute_all()` = 138 mixes en 3,3 s. El mix `ea84eb1a` quedó con +30, +30, +30, +15, +15 y −18, −20, −23, −25, −25. Los 4 mixes de la Temporada 2: el que más gana, +30 o +29; el que más pierde, −25 o −24; nadie debajo de 10.
- **API:** `f002fa643e02-local11092053` (595 pruebas; `/api/health` ok). `https://api.cmleague.lat/api/v1/elo/config` devuelve los campos nuevos y `formula_from`.
- **Web:** `f002fa643e02-local11092054` (710 pruebas).
- Las versiones llevan `-local` porque se desplegaron sin commit, sobre `main` en `f002fa64` (lo mismo que había en producción, más estos cambios).

## Falta

- Probar la pestaña en el navegador (con la `98` y la `100` aplicadas en la base local, sin `elo_recompute_all` o recargando la copia después).
- Commit: la base en `main`, `feat/frontend-fase-1` y `feat/mm-claim-en-sala`; la API y la web en `main`. El próximo despliegue desde `main` sin estos cambios commiteados los borraría.

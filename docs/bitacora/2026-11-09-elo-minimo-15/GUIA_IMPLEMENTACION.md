# Mínimo de 15 de ELO por partida terminada: guía de implementación

> **Reemplazado el mismo día** por [`2026-11-09-elo-por-partida`](../2026-11-09-elo-por-partida/) (replanteo `100`): el mínimo pasa a 10 y va al final, después del multiplicador por el rating del mix y del tope por equipo.

## Cambios respecto del plan

- La opción del bonus es la **(b)**: el mínimo va a la parte base, se suma el bonus y el total nunca baja de 15 × peso. Elegida por Daniel el 2026-11-09.
- La regla también entra en `elo_recompute_player` (repite la fórmula de `elo_apply_match`) y en `mm_elo_stake` ("En juego" de la sala), que el plan no nombraba.
- No se tocó `elo_set_config` ni la web: `min_delta` se cambia por SQL.
- El manual no usa una variable de `manual_valores()`: dice 15 en el texto. Si se cambia `min_delta`, hay que cambiar también `jugador/elo-y-estadisticas.md` y `admin/elo-y-mixes.md`.

## Pruebas (base local, 2026-11-09)

`pruebas/probar_98.sh` aplica la `98` y su inversa dentro de una transacción con `rollback`, sobre la copia local (187 mixes). Las funciones locales eran idénticas a las de producción (mismo `md5` de `elo_apply_match`, `elo_recompute_all` y `mm_elo_stake`).

| # | Prueba | Resultado |
|---|---|---|
| 1 | Con `min_delta = 0`, `elo_recompute_all()` deja las 1117 filas igual | ok |
| 2 | Con 15, 1049 filas (sin abandonos, lejos del piso, sin crash) siguen la fórmula (b) exacta | ok |
| 2b/c | Nadie con peso completo queda debajo de 15, abandonos incluidos | ok |
| 3 | 28 filas de mixes interrumpidos y empates sin cambios | ok |
| 4 | Con `min_delta_from` a la mitad del historial, lo anterior no cambia | ok |
| 5 | `elo_recompute_player` da lo mismo que `elo_recompute_all` | ok |
| 6 | `mm_elo_stake` muestra 15 o más en 50 salas | ok |
| 7 | La inversa deja las tres funciones con el mismo `md5` que antes | ok |

## Despliegue en producción

1. Aplicar la `98` en el VPS: `sudo docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < 98_elo_minimo.sql`.
2. `notify pgrst, 'reload schema';`.
3. Comprobar `select min_delta, min_delta_from from elo_config;` (15 y el inicio de la Temporada 2).
4. `select elo_recompute_all();` (unos 3 s). Lo ideal es sin mixes por terminar en ese momento: el recálculo bloquea `player_elo` y un resultado que llegue espera (hasta 30 s desde la `97`).
5. Comprobar el mix `ea84eb1a` (sala `cb04b97c`): de +15 a +19 y de −15 a −19.

**Estado:** aplicado en producción el 2026-11-09 a las 19:19 UTC, con un mix del matchmaking en curso en otro servidor (no lo afecta: el recálculo es una transacción de 3 s). `min_delta = 15`, `min_delta_from = 2026-11-09 09:00:05 UTC`, `elo_recompute_all()` = 135 mixes en 3,0 s. El mix `ea84eb1a` quedó con +19, +18, +17, +15, +15 y −15, −15, −16, −17, −19, y era el único mix terminado de la Temporada 2 (ninguna fila debajo de 15). Commit pendiente (en `main`, y en `feat/frontend-fase-1` y `feat/mm-claim-en-sala` por ser del matchmaking), cuando Daniel lo pida.

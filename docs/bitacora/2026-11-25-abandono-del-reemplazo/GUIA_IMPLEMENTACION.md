# Abandono del reemplazo y ELO de quien abandona si su equipo gana: guía de implementación

## Estado

La `145` está **aplicada en producción desde el 2026-11-25 (14:14 UTC)**. En `main` desde el mismo día. El manual sale con la web, en el próximo despliegue.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/145_mm_abandono_reemplazo.sql` | Nuevo |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/145_mm_abandono_reemplazo.sql` | Nuevo |
| `supabase/replanteo/README.md` | Fila de la `145` |
| `web/backend/src/db/types.ts` | `abandon_rules_from` y `mm_rounds_before` (a mano: la base local tiene replanteos que `main` no) |
| `docs/manual/jugador/buscar-partida.md`, `jugador/elo-y-estadisticas.md`, `admin/matchmaking.md` | Las reglas nuevas |

## Despliegue (hecho el 2026-11-25; falta el manual)

Solo la base del VPS y el manual (que sale con la web). No toca la API ni los servidores de juego (#1, #2 y #3).

1. Sin salas, cola ni mixes en vivo, respaldo `20261125T141403Z` (también en R2).
2. Por el túnel, `probar_145.sh "<cadena>"` contra producción (se deshace solo): todo bien, con 50 abandonos reales iguales a lo guardado. Con alguna sala en vivo no se corre: bloquea `mm_config`.
3. `145_mm_abandono_reemplazo.sql`, sin las `139` a `142` ni la `144`, que no necesita.
4. `abandon_rules_from` quedó en `2026-11-25 14:14:38 UTC`. En la partida de Artemis, `mm_rounds_before` da 15 y `mm_left_last_round`, verdadero. `anon` y `authenticated` no pueden llamar a `mm_rounds_before`.
5. El nivel de sanción de Artemis pasó de 1 a 0 (`mm_penalties`), a pedido de Daniel. La falta sigue en `mm_penalty_log`.
6. **Falta:** la web, para el manual, en el próximo despliegue.

El replanteo y su inversa van también en `feat/frontend-fase-1` y `feat/mm-claim-en-sala`.

## Pruebas

### Base (local, copia de producción del 2026-11-22, todo con rollback)

`pruebas/probar_145.sh docker`, todo bien:

1. El caso real (entró en la 16, jugó 8 de 24, se fue en la última): sin abandono ni sanción.
2. La partida entera con `elo_apply_match`: el reemplazo no mueve ELO, el que abandona y gana pierde 10, y el que abandona y pierde, como antes.
3. `elo_recompute_player` da lo mismo.
4. El reemplazo que abandona 4 rondas antes pierde 16 (con la cuenta vieja, 19). Con su equipo favorito, la derrota normal.
5. El ajuste de los equipos por el abandono de un reemplazo usa 4 rondas y no 19.
6. Una partida anterior a la fecha de corte da lo de antes.
7. Los 38 abandonos reales de la copia dan el mismo ELO que tienen guardado.

La inversa deja las funciones idénticas. El 2026-11-25 las cinco funciones del ELO y del abandono eran iguales (md5) en producción y en la base local.

No se corrió el `tsc` de la API: el worktree no tiene dependencias instaladas y el cambio son tres campos y una firma.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

`reversas/145_mm_abandono_reemplazo.sql`. Si ya hubo abandonos con la regla nueva, su ELO queda guardado, pero un recálculo posterior los cobraría con la vieja.

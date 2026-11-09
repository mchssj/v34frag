# El resultado de un mix no se corta por tiempo: guía de implementación

## Cambios respecto del plan

- Además del trigger de `matches`, los dos de `match_player_stats` (`medal_queue_stats_ins` y `_upd`) también llamaban a `medal_evaluate_now`. Los tres quedaron solo con la cola.
- No se probó en la base local: se aplicó directo en producción, con el incidente en curso.

## Aplicado en producción (2026-11-09, 18:54 UTC)

```sh
sudo docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < 97_ingreso_sin_timeout.sql
sudo docker exec -i supabase-db psql -U postgres -d postgres -c "notify pgrst, 'reload schema';"
```

Comprobado:

- `pg_proc.proconfig` de `ingest_server_chunk`: `{search_path=public,statement_timeout=30s}`.
- `tg_medal_queue_stats` y `tg_medal_queue_match` sin `medal_evaluate_now`.
- El primer envío después (19:01:51, el 8-16 de la sala `cb04b97c`) entró a la primera, y los 10 jugadores quedaron en `medal_queue` para el cron.

## Arreglo de la partida del incidente (2026-11-09, aprobado por Daniel)

1. 18:55: borrar el mix 8-15 `c213f804` (fila en `mix_deletions`, `elo_mode = 'revert'`), devolver la sala `cb04b97c` y la partida `ba1be92e` a `live` y `elo_recompute_all()` (2,8 s).
2. 19:01: el plugin del #2 manda el 8-16 (mix `ea84eb1a`).
3. ~19:10: `csstv_link_game('ea84eb1a…', 'KMEU8', 1)`, con la partida madre en `live` en la misma transacción. Sala terminada con `result` y `winner_team = 2`.

## Falta

- Commit en `main`, y en `feat/frontend-fase-1` y `feat/mm-claim-en-sala` (matchmaking), cuando Daniel lo pida.
- El plugin: no cancelar la sala con "se reinició" si el resultado de esa sala sigue en la cola (`docs/PENDIENTES.md`).

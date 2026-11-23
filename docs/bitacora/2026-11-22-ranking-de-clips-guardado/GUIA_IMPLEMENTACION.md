# Ranking de clips guardado: guía de implementación

## Estado

Probado en la base local el 2026-11-22 (copia de producción del 2026-11-20). **Pendiente de aplicar en producción.**

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/136_ranking_de_clips_guardado.sql` | Nuevo: tabla `match_clip_ranks`, `clip_rank_refresh` y sus ayudantes, `match_clip_ranked` leyendo la tabla y los triggers |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/136_ranking_de_clips_guardado.sql` | Nuevo: la inversa |
| `docs/bitacora/2026-11-22-ranking-de-clips-guardado/pruebas/triggers.sql` | Nuevo: 10 casos contra el cálculo de la vista vieja |
| `docs/bitacora/2026-11-22-ranking-de-clips-guardado/pruebas/tiempos.sql` | Nuevo: tiempos de las consultas de clips |
| `supabase/replanteo/README.md`, `docs/bitacora/README.md`, `docs/PENDIENTES.md` | Fila del replanteo, del requerimiento y el pendiente del despliegue |

## Despliegue (pendiente)

No reinicia nada ni toca los servidores de juego. Se puede aplicar con partidas en curso: la migración tarda menos de un segundo y los clips de un mix se guardan al final, con el resultado.

1. **Con la confirmación de Daniel**, desde Git Bash en su PC (usa la llave del agente de Windows):

   ```bash
   /c/Windows/System32/OpenSSH/ssh.exe ubuntu@<VPS> "sudo docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1" < supabase/replanteo/136_ranking_de_clips_guardado.sql
   ```

   Si la vista de producción no es la esperada, la migración aborta sin cambiar nada (`match_clip_ranked no es la esperada`). También aborta si el ranking guardado difiere del de la vista vieja en una sola fila.

2. Comprobar en el VPS:

   ```bash
   sudo docker exec supabase-db psql -U postgres -c "select count(*) from match_clip_ranks"
   sudo docker exec supabase-db psql -U postgres -c "select pg_stat_statements_reset()"
   ```

   `pg_stat_statements_reset()` es opcional: deja los promedios en cero para medir solo lo nuevo.

3. Después de la próxima partida, medir:
   - `pg_stat_statements`: `clip_discord_pending`, `player_featured_clips_list` y las de `match_clip_list` tendrían que bajar a milisegundos.
   - El log de Caddy de la API (`/var/log/caddy/api.log`): sin picos de pedidos de más de 1 s después del fin de la partida.

No depende de los replanteos `134` ni `135`, que todavía no están en producción: se puede aplicar antes que ellos.

## Pruebas

### Migración (base local)

- Dentro de una transacción con `rollback` y después aplicada: las dos comparaciones de la migración dan 0 filas distintas sobre los 4080 clips (2021 listados).
- La inversa deja `match_clip_ranked` con el mismo md5 de antes (`23ea45e0ca46ca54d22003488d73bb3c`) y borra la tabla. Después se volvió a aplicar la migración sin problemas.
- `anon` lee `match_clip_list` como antes; `match_clip_ranks` le da `permission denied`. `featured_clips_shown` sigue cerrada para `anon`, como desde la 76.

### Triggers (`pruebas/triggers.sql`)

Cada caso corre en su transacción, se deshace y compara `match_clip_ranks` con la vista de la 76 recreada como `ranked_ref`:

| Caso | Diferencias |
|---|---|
| 0. Sin cambios | 0 |
| 1. Clip nuevo (as) | 0 |
| 2. Prioridades invertidas (cambia 2020 filas) | 0 |
| 3. `per_match = 1` (cambia 1733 filas) | 0 |
| 4. Forzar un clip que no estaba en la lista | 0 |
| 5. Borrar un clip de la lista | 0 |
| 6. Cambiar `played_at` | 0 |
| 7. VIP nuevo para el dueño de un clip (cambia 203 filas) | 0 |
| 8. Una ficha pierde su SteamID | 0 |
| 9. SteamID de invitado como extra de una ficha | 0 |
| 10. Cambiar solo el video de todos los clips | No recalcula (50 ms) |

### Tiempos (`pruebas/tiempos.sql`)

| Consulta | Antes | Después |
|---|---|---|
| `match_clip_list` de una partida | 390 ms | 0,6 ms |
| `clip_discord_pending` | 780 ms | 15 ms |
| `player_featured_clips_list` | 400 ms | 6 ms |
| `clip_render_claim` | 450 ms | 4 ms |

`clip_discord_pending` y `clip_render_claim` piden el token del grabador (`render_auth`): para medirlas, la prueba reemplaza `render_auth` dentro de la transacción y la deshace.

No se corrieron las pruebas de integración del backend: necesitan `pnpm db:reset`, que borra la copia de producción de la base local.

## En qué se apartó del plan

- El trigger de actualización de `match_clips` compara con `except` y no con un join entre las tablas de transición. Con el join, cambiar el video de 4080 clips tardaba 1,9 s (loop anidado, porque las tablas de transición no tienen estadísticas); con `except`, 50 ms.

## Incidentes durante las pruebas

- La primera medición de `elo_apply_match` dio 8 s porque el resultado de prueba tenía fecha anterior al inicio de la temporada y disparaba `elo_recompute_all`. Con la fecha de hoy, 200 ms. No es parte de este cambio, pero queda anotado: un resultado que llegue con fecha anterior a un cierre de temporada recalcula todo el ELO (8 s en local), con `player_elo` bloqueada.

## Cómo revertir

```bash
/c/Windows/System32/OpenSSH/ssh.exe ubuntu@<VPS> "sudo docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1" < docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/136_ranking_de_clips_guardado.sql
```

No se pierden datos: la vista vuelve a calcular el puesto en cada lectura (y vuelve la lentitud).

# ELO de jugadores: guía de implementación

## Estado

| Paso | Estado |
|---|---|
| Migración SQL | Hecha y probada en local |
| Web (`index.html`) | Hecha. Sintaxis verificada; sin prueba en navegador |
| Despliegue en Supabase | **Pendiente** |
| `docs/MODELO_DATOS.md` y `docs/FUNCIONALIDADES.md` | Actualizados |
| Commit | Hecho (rama `csstv-reporter`) |

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261011180000_player_elo.sql` | Nuevo. Tabla `player_elo`, columnas de ELO en `match_player_stats`, funciones y permisos. Redefine `ingest_server_chunk` e `ingest_server_match`. |
| `index.html` | CSS de la insignia (`.lvl`, `.nb`, `.eu`, `.ed`), helpers de ELO, carga de `player_elo`, vistas de jugadores, perfil y mix, botón de admin. |
| `docs/MODELO_DATOS.md`, `docs/FUNCIONALIDADES.md` | Sección de ELO, `player_elo` en el diagrama, sección Mixes, columnas de Jugadores y panel Servidores. |
| `docs/bitacora/` | Índice de la bitácora y esta carpeta. |

## Despliegue

```mermaid
flowchart LR
  A["1. Ejecutar la migración"] --> B["2. elo_recompute_all"] --> C["3. Verificar en SQL"] --> D["4. Publicar index.html"] --> E["5. Revisar la web"]
```

1. **Migración.** Supabase → SQL Editor → pegar `supabase/migrations/20261011180000_player_elo.sql` → Run. Requiere que ya esté aplicada `20261011120000_csstv_match_reporter.sql`. Se puede ejecutar más de una vez.
2. **Calcular el ELO de los mixes existentes.**
   ```sql
   select elo_recompute_all();   -- devuelve la cantidad de mixes aplicados
   ```
3. **Verificar.**
   ```sql
   -- Top 10
   select e.steam_id, p.nick, e.elo, e.peak_elo, e.matches
     from player_elo e left join players p on p.steam_id = e.steam_id
    order by e.elo desc limit 10;

   -- Mixes sin ELO aplicado (debería estar vacío, salvo mixes solo con bots)
   select m.id, m.played_at from matches m
    where m.kind = 'mix' and m.status = 'finished'
      and not exists (select 1 from match_player_stats s where s.match_id = m.id and s.elo_after is not null);
   ```
4. **Web.** Publicar `index.html` como siempre.
5. **Revisar en la web:**
   - [ ] Jugadores: columnas Nivel y ELO, ordenados por ELO.
   - [ ] Perfil de un jugador con mixes: fila ELO con máximo, barra de nivel y cambio por mix.
   - [ ] Detalle de un mix: insignias y columna ELO.
   - [ ] Admin → Servidores → Recalcular ELO muestra "Listo: N mixes aplicados".
   - [ ] Jugar un mix nuevo: aparece con su cambio de ELO sin recalcular.
   - [ ] Tema claro y oscuro: las insignias se leen bien.

Si la web se publica antes que la migración, aparece el aviso "Error cargando player_elo" y todos se muestran con 1000.

## Pruebas

Los scripts están en [`pruebas/`](pruebas/). Usan un PostgreSQL local (probado con la versión 18) y un esquema mínimo que imita a Supabase (`stub_supabase.sql`).

```bash
initdb -D elodata -U postgres -A trust -E UTF8
pg_ctl -D elodata -o "-p 55432" start
psql -p 55432 -U postgres -c "create database t"
psql -p 55432 -U postgres -d t -v ON_ERROR_STOP=1 -f docs/bitacora/2026-10-11-elo-jugadores/pruebas/stub_supabase.sql
psql -p 55432 -U postgres -d t -v ON_ERROR_STOP=1 -f supabase/migrations/20261011120000_csstv_match_reporter.sql
psql -p 55432 -U postgres -d t -v ON_ERROR_STOP=1 -f supabase/migrations/20261011180000_player_elo.sql
psql -p 55432 -U postgres -d t -f docs/bitacora/2026-10-11-elo-jugadores/pruebas/pruebas_elo.sql
pg_ctl -D elodata stop && rm -rf elodata
```

Resultado de la última ejecución (2026-10-11): las 10 pruebas pasan.

| # | Prueba | Resultado |
|---|---|---|
| T1 | 5v5 con jugadores nuevos | ±30 + bonus (+27 … −26) |
| T2 | Reenviar el mismo `match_uid` | Sin cambios |
| T3 | Envío en 2 partes; revancha | Favorito 74 %, gana +12 … +15 |
| T4 | Ejemplos del plan | +34, +26, −25, −35 |
| T5 | Empate | Solo bonus; μ queda en 25 |
| T6 | Bot y jugador con 0 rondas | No reciben ELO |
| T7 | `elo_recompute_all` | Mismo estado final |
| T8 | Usuario que no es admin | Rechazado (42501) |
| T9 | No favorito extremo gana; piso | +60, sin NaN; piso de 100 |
| T10 | Permisos | `anon` solo lee `player_elo` |

Web: `node --check` sobre los scripts de `index.html` y prueba de los límites de `lvlOf` (500 → 1, 501 → 2, 1000 → 4, 2000 → 9, 2001 → 10).

## Revertir

```sql
begin;
drop function if exists public.elo_recompute_all();
drop function if exists public.elo_apply_match(uuid);
drop function if exists public.csstv_ncdf(double precision);
drop function if exists public.csstv_npdf(double precision);
drop table if exists public.player_elo;
alter table public.match_player_stats
  drop column if exists elo_before, drop column if exists elo_after,
  drop column if exists elo_delta,  drop column if exists win_prob;
drop index if exists public.matches_mix_played_idx;
commit;
```

Después, volver a ejecutar `20261011120000_csstv_match_reporter.sql` (es re-ejecutable) para restaurar `ingest_server_chunk` e `ingest_server_match` sin la llamada al ELO, y publicar el `index.html` anterior.

## Cambios respecto al plan

| Plan | Implementación | Motivo |
|---|---|---|
| `csstv_ingest` llama a `elo_apply_match` | La llaman `ingest_server_chunk` e `ingest_server_match` después de `csstv_ingest` | Evita copiar las ~120 líneas de `csstv_ingest` en la migración nueva. `elo_apply_match` es idempotente, así que el resultado es el mismo. |
| Borrar un mix no revierte el ELO | Borrarlo desde la web llama a `elo_recompute_all` | Evita que el admin olvide recalcular. Si se borra por SQL, hay que recalcular a mano. |
| `mu` y `sigma` como numeric | double precision | Los cálculos de TrueSkill usan `exp` y `sqrt` en double precision. |
| Insignia en el scoreboard | Usa `elo_before` (nivel al jugar ese mix) | Igual que en FACEIT: el scoreboard muestra el nivel con que se jugó. |

## Observaciones

- TrueSkill aprende rápido con jugadores nuevos (ver T3). Si se quiere que los cambios se queden cerca de ±30 durante más mixes, se puede subir `c_beta` en `elo_apply_match`.
- Si la cola del servidor envía un mix viejo después de uno nuevo, se aplica en el orden de llegada. `elo_recompute_all()` sí respeta `played_at`.

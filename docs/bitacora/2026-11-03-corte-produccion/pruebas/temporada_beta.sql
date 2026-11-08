-- Temporada BETA en producción (paso 2.5 del PLAN). Pedido por Daniel el 2026-11-03.
-- Todo lo jugado hasta ahora es parte de BETA: empieza antes del primer mix (2026-10-13 01:42 UTC).
-- No usa season_start: esa función abre la temporada en now() y pone el pico en el ELO actual. Sin
-- temporadas previas, el pico que ya hay en player_elo es el de toda la historia, que es el de BETA.
-- Los parámetros (top, mínimo, reinicio, reset_all y tramos) salen de season_config, como en season_start.
-- Fin: el de siempre, season_default_end(now(), duration_days) (las 06:00 de Argentina).
-- El trigger notify_seasons le manda a cada perfil el aviso "season_started".
-- Si ya hay una temporada, no hace nada.
\set ON_ERROR_STOP 1
begin;
insert into seasons(number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, reset_all, tiers)
select 1, 'BETA', '2026-10-13 00:00:00+00', season_default_end(now(), c.duration_days),
       c.top_n, c.min_matches, c.reset_pct, c.reset_floor, c.reset_all, c.tiers
  from season_config c
 where c.id = 1
   and not exists (select 1 from seasons);
commit;

-- Verificación
select id, number, name, status, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, reset_all from seasons;
select count(*) as jugadores, count(*) filter (where eligible) as con_puesto from season_live_standings;
select (select count(*) from matches) as mixes_totales,
       (select count(*) from matches where played_at >= (select starts_at from seasons where number = 1)) as mixes_en_beta;

-- Para deshacerlo (los avisos "season_started" ya enviados quedan):
-- delete from seasons where number = 1 and name = 'BETA' and status = 'active';

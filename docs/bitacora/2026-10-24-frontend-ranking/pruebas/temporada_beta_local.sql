-- Temporada BETA en la Supabase local (copia de producción). Corrido el 2026-10-24.
-- Empieza antes del primer mix (2026-10-13 01:42 UTC), así que todos los mixes cuentan para ella.
-- No usa season_start: esa función abre la temporada en now() y pone el pico en el ELO actual. Sin
-- temporadas previas, el pico que ya hay en player_elo es el de toda la historia, que es el de BETA.
-- En producción se hace lo mismo recién en el corte (el nombre puede cambiar).
begin;
insert into seasons(number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers)
select 1, 'BETA', '2026-10-13 00:00:00+00', season_default_end(now(), c.duration_days),
       c.top_n, c.min_matches, c.reset_pct, c.reset_floor, c.tiers
  from season_config c
 where c.id = 1
   and not exists (select 1 from seasons);
commit;

-- Verificación: la temporada y cuántos tienen puesto (en local: 77 jugadores, 6 con 20 mixes o más).
select id, number, name, status, starts_at, ends_at, top_n, min_matches from seasons;
select count(*) as jugadores, count(*) filter (where eligible) as con_puesto from season_live_standings;

-- Para deshacerlo:
-- delete from seasons where number = 1 and name = 'BETA' and status = 'active';

-- Replanteo 29: estadísticas de partida estilo HLTV, primera parte (plan docs/bitacora/2026-10-25-stats-partida).
-- Solo vistas, con los datos que el plugin ya manda (sin tocarlo):
--   1. live_match_players suma k2–k5, first_kills, first_deaths, plants y defuses de cada foto del mix en vivo.
--   2. player_stats suma los mismos totales por ficha.
--   3. match_clutches (clutches ganados por partida y SteamID) y player_clutches (por ficha), desde match_clips:
--      el servidor manda todos los clutches ganados; los topes de los clips se aplican al listarlos, no al guardarlos.
--   4. match_clutch_data: si la partida tiene datos de clutch (el servidor ya mandaba jugadas cuando se jugó).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.match_clips') is null then
    raise exception 'replanteo 29: falta match_clips (migración 20261023120000_clips.sql)';
  end if;
  if to_regclass('public.match_clutches') is not null then
    raise exception 'replanteo 29: ya existe match_clutches (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Mix en vivo: las columnas nuevas al final (create or replace solo permite sumar columnas)
-- =====================================================================================================
create or replace view public.live_match_players as
select l.uid,
       (case e.value ->> 'team' when 'a' then 1 when 'b' then 2 else null end)::smallint as side,
       csstv_steam64(e.value ->> 'steamid') as steam_id,
       steam_owner(csstv_steam64(e.value ->> 'steamid')) as player_id,
       left(coalesce(nullif(trim(e.value ->> 'name'), ''), '?'), 32) as game_nick,
       csstv_jint(e.value, 'rounds', 200) as rounds,
       csstv_jint(e.value, 'kills', 999) as kills,
       csstv_jint(e.value, 'deaths', 999) as deaths,
       csstv_jint(e.value, 'assists', 999) as assists,
       csstv_jint(e.value, 'headshots', 999) as headshots,
       csstv_jint(e.value, 'damage', 99999) as damage,
       csstv_rating(csstv_jint(e.value, 'kills', 999)::numeric, csstv_jint(e.value, 'deaths', 999)::numeric,
                    csstv_jint(e.value, 'rounds', 200)::numeric, csstv_jint(e.value, 'k1', 200)::numeric,
                    csstv_jint(e.value, 'k2', 200)::numeric, csstv_jint(e.value, 'k3', 200)::numeric,
                    csstv_jint(e.value, 'k4', 200)::numeric, csstv_jint(e.value, 'k5', 200)::numeric) as rating,
       -- (replanteo 29)
       csstv_jint(e.value, 'k2', 200) as k2,
       csstv_jint(e.value, 'k3', 200) as k3,
       csstv_jint(e.value, 'k4', 200) as k4,
       csstv_jint(e.value, 'k5', 200) as k5,
       csstv_jint(e.value, 'first_kills', 200) as first_kills,
       csstv_jint(e.value, 'first_deaths', 200) as first_deaths,
       csstv_jint(e.value, 'plants', 200) as plants,
       csstv_jint(e.value, 'defuses', 200) as defuses
  from live_matches l
  cross join lateral jsonb_array_elements(l.payload -> 'players') e(value);

-- =====================================================================================================
-- 2. Totales por ficha
-- =====================================================================================================
create or replace view public.player_stats with (security_invoker = true) as
select s.player_id,
       count(*)::integer as maps,
       coalesce(sum(s.rounds), 0)::integer as rounds,
       coalesce(sum(s.kills), 0)::integer as kills,
       coalesce(sum(s.deaths), 0)::integer as deaths,
       coalesce(sum(s.assists), 0)::integer as assists,
       coalesce(sum(s.damage), 0)::integer as damage,
       csstv_rating(sum(s.kills)::numeric, sum(s.deaths)::numeric, sum(s.rounds)::numeric, sum(s.k1)::numeric,
                    sum(s.k2)::numeric, sum(s.k3)::numeric, sum(s.k4)::numeric, sum(s.k5)::numeric) as rating,
       round(sum(s.kills)::numeric / greatest(sum(s.deaths), 1)::numeric, 2) as kd,
       case when sum(s.kills) > 0 then round(sum(s.headshots)::numeric * 100.0 / sum(s.kills)::numeric, 1) end as hs,
       case when sum(s.rounds) > 0 then round(sum(s.damage)::numeric / sum(s.rounds)::numeric, 1) end as adr,
       count(*) filter (where m.winner_side = s.team)::integer as wins,
       count(*) filter (where m.winner_side is not null and m.winner_side <> s.team)::integer as losses,
       -- (replanteo 29)
       coalesce(sum(s.k2), 0)::integer as k2,
       coalesce(sum(s.k3), 0)::integer as k3,
       coalesce(sum(s.k4), 0)::integer as k4,
       coalesce(sum(s.k5), 0)::integer as k5,
       coalesce(sum(s.first_kills), 0)::integer as first_kills,
       coalesce(sum(s.first_deaths), 0)::integer as first_deaths,
       coalesce(sum(s.plants), 0)::integer as plants,
       coalesce(sum(s.defuses), 0)::integer as defuses
  from match_player_stats s
  join matches m on m.id = s.match_id
 where s.player_id is not null and m.status = 'finished'
 group by s.player_id;

-- =====================================================================================================
-- 3. Clutches ganados
-- =====================================================================================================
-- Un clip con clutch_vs y round_won es un clutch ganado. Los que tienen round_won = false son jugadas destacadas
-- (un 3k, un 4k) en clutches perdidos: no sirven para contar los perdidos (solo llegan si hubo jugada).
create view public.match_clutches with (security_invoker = true) as
select c.match_id, c.player_steamid as steam_id, c.clutch_vs as vs, count(*)::integer as won
  from match_clips c
 where c.clutch_vs between 1 and 5 and c.round_won
 group by c.match_id, c.player_steamid, c.clutch_vs;
comment on view public.match_clutches is 'Clutches ganados por partida, SteamID y cantidad de rivales (desde match_clips)';

-- Por ficha (todos sus SteamID), solo de mixes terminados, como player_stats.
create view public.player_clutches with (security_invoker = true) as
select steam_owner(mc.steam_id) as player_id, mc.vs, sum(mc.won)::integer as won
  from match_clutches mc
  join matches m on m.id = mc.match_id
 where m.kind = 'mix' and m.status = 'finished' and steam_owner(mc.steam_id) is not null
 group by 1, 2;
comment on view public.player_clutches is 'Clutches ganados por ficha y cantidad de rivales';

-- Una partida tiene datos de clutch si tiene jugadas o si su servidor ya mandaba jugadas cuando se jugó
-- (reporter 2.5.0 en adelante). Las anteriores muestran "Sin datos de Clutches disponibles."
create view public.match_clutch_data with (security_invoker = true) as
select m.id as match_id,
       exists (select 1 from match_clips c where c.match_id = m.id)
       or exists (select 1 from match_clips c join matches x on x.id = c.match_id
                   where x.server_id = m.server_id and x.kind = 'mix'
                     and coalesce(x.played_at, x.starts_at) <= coalesce(m.played_at, m.starts_at)) as clutch_data
  from matches m
 where m.kind = 'mix';
comment on view public.match_clutch_data is 'Si el mix tiene datos de clutch (su servidor ya mandaba jugadas)';

revoke all on public.match_clutches, public.player_clutches, public.match_clutch_data from anon, authenticated;
grant select on public.match_clutches, public.player_clutches, public.match_clutch_data to anon, authenticated;

commit;

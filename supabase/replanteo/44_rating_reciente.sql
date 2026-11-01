-- Replanteo 44: rating reciente de los jugadores para las alineaciones de una serie (bitácora
-- docs/bitacora/2026-11-01-rating-alineaciones). Cuando la serie todavía no tiene juegos con stats (sin jugar o
-- con el resultado a mano), cada jugador del plantel muestra su rating de las últimas semanas en partidas 5v5
-- de cualquier tipo (mix, juego de torneo o de PCW).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.team_audit') is null then
    raise exception 'replanteo 44: falta el replanteo 43 (aplicar antes 43_moderar_equipos.sql)';
  end if;
  if to_regprocedure('public.player_recent_rating(uuid[], integer)') is not null then
    raise exception 'replanteo 44: player_recent_rating ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- 5v5 = los dos lados terminaron con al menos 5 jugadores con stats (un reemplazo suma un sexto, no resta).
-- El rating es el de las stats sumadas (ponderado por rondas), igual que player_stats.
-- security definer: anon no lee matches; solo devuelve el rating agregado.
create function public.player_recent_rating(p_players uuid[], p_days integer default 28)
  returns table (player_id uuid, rating numeric, maps integer)
  language sql stable security definer set search_path = public as $$
  with mine as (
    select s.match_id from match_player_stats s join matches m on m.id = s.match_id
     where s.player_id = any(p_players) and m.status = 'finished'
       and coalesce(m.played_at, m.starts_at) >= now() - make_interval(days => least(greatest(p_days, 1), 365))
     group by s.match_id
  ), sides as (
    select s.match_id, s.team, count(distinct coalesce(s.player_id::text, s.steam_id)) n
      from match_player_stats s where s.match_id in (select match_id from mine) group by 1, 2
  ), fives as (
    select match_id from sides group by match_id having count(*) = 2 and min(n) >= 5
  )
  select s.player_id,
         csstv_rating(sum(s.kills), sum(s.deaths), sum(s.rounds), sum(s.k1), sum(s.k2), sum(s.k3), sum(s.k4), sum(s.k5)),
         count(*)::integer
    from match_player_stats s
   where s.player_id = any(p_players) and s.match_id in (select match_id from fives)
   group by s.player_id
$$;
revoke all on function public.player_recent_rating(uuid[], integer) from public;
grant execute on function public.player_recent_rating(uuid[], integer) to anon, authenticated, service_role;
comment on function public.player_recent_rating(uuid[], integer) is
  'Rating de cada jugador en las partidas 5v5 terminadas de los últimos p_days días (por defecto 28; entre 1 y 365). Sin partidas, no aparece';

commit;

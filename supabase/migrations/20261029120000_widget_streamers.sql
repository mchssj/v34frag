-- =============================================================================
-- Widget de CM League para streamers (OBS)
--
-- widget_player(jugador, desde) junta en un JSON lo que muestra widget.html:
--   - nick y tag del equipo oficial
--   - elo, peak_elo y matches de player_elo (sin fila: elo_config.start_elo y 0)
--   - kd y rating totales de players
--   - hoy: mixes terminados desde p_desde (v, d, e, elo, kills, deaths)
--   - ultimos: los últimos 5 mixes terminados ('V', 'D' o 'E', con su elo_delta)
-- Un mix es del jugador si su fila de match_player_stats tiene su player_id o su
-- steam_id, y estuvo en el equipo 1 o 2. Gana si matches.winner es su equipo (team1
-- para el 1, team2 para el 2); sin winner es empate. Es la regla de elo_apply_match.
-- Solo lee tablas con lectura pública, así que es security invoker y la puede llamar anon.
-- Devuelve null si el jugador no existe.
-- Bitácora: docs/bitacora/2026-10-29-widget-streamers/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable.
-- =============================================================================

begin;

create or replace function public.widget_player(p_player uuid, p_desde timestamptz default now() - interval '24 hours')
returns jsonb language sql stable security invoker set search_path = public as $$
  with p as (
    select id, nick, steam_id, kd, rating from players where id = p_player
  ),
  mixes as (
    select distinct on (m.id) m.id, coalesce(m.played_at, m.starts_at) at, s.kills, s.deaths, s.elo_delta,
           case when m.winner is null then 'E'
                when m.winner = case s.team when 1 then m.team1 else m.team2 end then 'V'
                else 'D' end res
      from p
      join match_player_stats s on s.player_id = p.id or (p.steam_id is not null and s.steam_id = p.steam_id)
      join matches m on m.id = s.match_id
     where m.kind = 'mix' and m.status = 'finished' and s.team in (1, 2)
     order by m.id, (s.player_id = p.id) desc nulls last
  )
  select jsonb_build_object(
    'nick',     p.nick,
    'team_tag', (select nullif(t.tag, '') from teams t where t.kind = 'official' and p.id = any(t.members) order by t.name limit 1),
    'elo',      coalesce(e.elo, (select start_elo from elo_config where id = 1), 1000),
    'peak_elo', coalesce(e.peak_elo, e.elo, (select start_elo from elo_config where id = 1), 1000),
    'matches',  coalesce(e.matches, 0),
    'kd',       p.kd,
    'rating',   p.rating,
    'hoy', (select jsonb_build_object(
              'v',      count(*) filter (where res = 'V'),
              'd',      count(*) filter (where res = 'D'),
              'e',      count(*) filter (where res = 'E'),
              'elo',    coalesce(sum(elo_delta), 0),
              'kills',  coalesce(sum(kills), 0),
              'deaths', coalesce(sum(deaths), 0))
              from mixes where at >= p_desde),
    'ultimos', coalesce((select jsonb_agg(jsonb_build_object('r', res, 'elo', elo_delta) order by at desc)
                          from (select res, elo_delta, at from mixes order by at desc nulls last limit 5) u), '[]'::jsonb)
  )
  from p left join player_elo e on e.steam_id = p.steam_id
$$;

grant execute on function public.widget_player(uuid, timestamptz) to anon, authenticated;

commit;

-- Inversa de la 111: widget_player vuelve al cuerpo del replanteo 110 (sin 'photo_url'). No toca datos.

begin;

create or replace function public.widget_player(p_player uuid, p_period text default 'today', p_since timestamptz default null)
returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  o       player_overview%rowtype;
  v_from  timestamptz;
  v_rank  integer;
  v_crank integer;
  v_cty   text;
  v_per   jsonb;
  v_last  jsonb;
begin
  if p_period is null or p_period not in ('today', '24h', 'season', 'all') then
    raise exception 'widget_player: período inválido (%)', p_period using errcode = '22023';
  end if;

  select * into o from player_overview where id = p_player;
  if not found then
    return null;
  end if;

  v_from := case p_period
    when 'today'  then coalesce(p_since, now() - interval '24 hours')
    when '24h'    then now() - interval '24 hours'
    when 'season' then (select starts_at from seasons where status = 'active' order by starts_at desc limit 1)
    else null
  end;

  select r.position, r.country into v_rank, v_cty
    from player_ranking r where r.id = p_player;
  if v_cty is null then
    select d.country into v_cty
      from players p join profile_details d on d.user_id = p.user_id
     where p.id = p_player;
  end if;
  if v_cty is not null and v_rank is not null then
    select x.pos into v_crank
      from (select r.id, rank() over (order by r.elo desc)::integer as pos
              from player_ranking r where r.country = v_cty) x
     where x.id = p_player;
  end if;

  with mixes as (
    select s.team, s.kills, s.deaths, s.rounds, s.damage, s.headshots, s.k1, s.k2, s.k3, s.k4, s.k5, s.first_kills,
           s.elo_delta, m.winner_side, x.pistol_won, x.weapon_kills,
           coalesce(x.clutch_1v1, 0) + coalesce(x.clutch_1v2, 0) + coalesce(x.clutch_1v3, 0)
             + coalesce(x.clutch_1v4, 0) + coalesce(x.clutch_1v5, 0) as clutches
      from match_player_stats s
      join matches m on m.id = s.match_id
      left join match_player_extra x on x.match_id = s.match_id and x.steam_id = s.steam_id
     where s.player_id = p_player and s.team in (1, 2)
       and m.kind = 'mix' and m.status = 'finished'
       and (v_from is null or coalesce(m.played_at, m.starts_at) >= v_from)
  )
  select jsonb_build_object(
           'v', count(*) filter (where winner_side = team),
           'd', count(*) filter (where winner_side is not null and winner_side <> team),
           'e', count(*) filter (where winner_side is null),
           'elo', coalesce(sum(elo_delta), 0),
           'kills', coalesce(sum(kills), 0),
           'deaths', coalesce(sum(deaths), 0),
           'rounds', coalesce(sum(rounds), 0),
           'damage', coalesce(sum(damage), 0),
           'headshots', coalesce(sum(headshots), 0),
           'k3', coalesce(sum(k3), 0),
           'k4', coalesce(sum(k4), 0),
           'k5', coalesce(sum(k5), 0),
           'sniper', coalesce(sum(coalesce((weapon_kills->>'awp')::int, 0) + coalesce((weapon_kills->>'scout')::int, 0)), 0),
           'knife', coalesce(sum(coalesce((weapon_kills->>'knife')::int, 0)), 0),
           'clutches', coalesce(sum(clutches), 0),
           'entries', coalesce(sum(first_kills), 0),
           'pistols', coalesce(sum(pistol_won), 0),
           'rating', case when coalesce(sum(rounds), 0) > 0 then
                       round(csstv_rating(sum(kills)::numeric, sum(deaths)::numeric, sum(rounds)::numeric, sum(k1)::numeric,
                                          sum(k2)::numeric, sum(k3)::numeric, sum(k4)::numeric, sum(k5)::numeric), 2) end)
    into v_per
    from mixes;

  select coalesce(jsonb_agg(jsonb_build_object('r', l.r, 'elo', l.elo_delta) order by l.at desc nulls last, l.match_id desc), '[]')
    into v_last
    from (select case when m.winner_side is null then 'E' when m.winner_side = s.team then 'V' else 'D' end as r,
                 s.elo_delta, coalesce(m.played_at, m.starts_at) as at, s.match_id
            from match_player_stats s
            join matches m on m.id = s.match_id
           where s.player_id = p_player and s.team in (1, 2)
             and m.kind = 'mix' and m.status = 'finished'
           order by coalesce(m.played_at, m.starts_at) desc nulls last, s.match_id desc
           limit 10) l;

  return jsonb_build_object(
    'id', o.id,
    'nick', o.nick,
    'team_tag', (select nullif(btrim(t->>'tag'), '') from jsonb_array_elements(o.teams) t limit 1),
    'country', v_cty,
    'elo', coalesce(o.elo, (select start_elo from elo_config limit 1)),
    'peak_elo', coalesce(o.peak_elo, o.elo, (select start_elo from elo_config limit 1)),
    'matches', o.elo_matches,
    'rank', v_rank,
    'country_rank', v_crank,
    'period', v_per,
    'ultimos', v_last
  );
end $$;

comment on function public.widget_player(uuid, text, timestamptz) is
  'Datos del widget para streamers (OBS): ELO, puestos, equipo, stats del período (today, 24h, season, all) y últimos 10 resultados. null si la ficha no existe. Replanteo 110';

revoke all on function public.widget_player(uuid, text, timestamptz) from public;
grant execute on function public.widget_player(uuid, text, timestamptz) to anon, authenticated, service_role;

commit;

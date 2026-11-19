-- 129: estadísticas de la temporada: recap de cada jugador y resumen de la web y el matchmaking
-- (bitácora docs/bitacora/2026-11-19-estadisticas-de-temporada/, Kyan 2026-11-19; base: plan 2026-11-14-recap-temporada).
--
-- Una sola cuenta para todo: season_recap_compute (un recap por ficha, con promedios y percentiles de la temporada) y
-- season_summary_compute (la web y el matchmaking: mixes, cola, salas, horarios, servidores, mapas y comunidad), las dos
-- entre starts_at y p_until, con los mismos mixes que
-- season_rank (mix terminado que movió el ELO). El resumen no tiene rankings de jugadores (Kyan, 2026-11-19).
--   - Al cerrar (season_close_run) se guarda la foto en season_recaps y season_summaries: todos la ven.
--   - Durante la temporada, season_recap_live y season_summary_live calculan al momento, solo para admins.
-- Sin MVPs (match_player_stats no los guarda) y sin arma ni rivales (necesitan match_kills, que no existe en main).
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/129_estadisticas_de_temporada.sql.
begin;

do $$
begin
  if to_regclass('public.season_recaps') is not null then
    raise exception 'replanteo 129: ya se aplicó (season_recaps existe)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Las fotos del cierre
-- =====================================================================================================
create table public.season_recaps (
  season_id  uuid not null references public.seasons(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (season_id, player_id)
);
create index season_recaps_player on public.season_recaps (player_id);
comment on table public.season_recaps is 'Recap de cada ficha al cerrar la temporada (replanteo 129). Un recálculo posterior no lo cambia';

create table public.season_summaries (
  season_id  uuid primary key references public.seasons(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
comment on table public.season_summaries is 'Resumen global de la temporada al cerrarla (replanteo 129)';

alter table public.season_recaps enable row level security;
alter table public.season_summaries enable row level security;
create policy "season_recaps: todos ven" on public.season_recaps for select using (true);
create policy "season_summaries: todos ven" on public.season_summaries for select using (true);
revoke all on public.season_recaps, public.season_summaries from anon, authenticated;
grant select on public.season_recaps, public.season_summaries to anon, authenticated;

-- =====================================================================================================
-- 2. Las filas de la temporada: una por ficha y mix
-- =====================================================================================================
create function public.season_mix_rows(p_from timestamptz, p_until timestamptz)
  returns table(player_id uuid, match_id uuid, at timestamptz, secs numeric, map text, team integer, won boolean, lost boolean,
                own_score integer, other_score integer, kills integer, deaths integer, assists integer, headshots integer,
                damage integer, rounds integer, k1 integer, k2 integer, k3 integer, k4 integer, k5 integer,
                first_kills integer, plants integer, defuses integer, rating numeric, elo_before integer, elo_after integer)
  language sql stable set search_path = public as $$
  select x.player_id, ps.match_id, coalesce(m.played_at, m.starts_at),
         -- Duración del mix: de que arrancó a que terminó, sin contar los que quedaron abiertos más de 3 horas.
         case when m.played_at is not null and m.played_at > m.starts_at and m.played_at - m.starts_at <= interval '3 hours'
              then extract(epoch from m.played_at - m.starts_at) end,
         m.map, ps.team, ps.team = m.winner_side, m.winner_side is not null and ps.team <> m.winner_side,
         case when ps.team = 1 then m.score1 else m.score2 end, case when ps.team = 1 then m.score2 else m.score1 end,
         coalesce(ps.kills, 0), coalesce(ps.deaths, 0), coalesce(ps.assists, 0), coalesce(ps.headshots, 0),
         coalesce(ps.damage, 0), coalesce(ps.rounds, 0), coalesce(ps.k1, 0), coalesce(ps.k2, 0), coalesce(ps.k3, 0),
         coalesce(ps.k4, 0), coalesce(ps.k5, 0), coalesce(ps.first_kills, 0), coalesce(ps.plants, 0), coalesce(ps.defuses, 0),
         ps.rating, ps.elo_before, ps.elo_after
    from match_player_stats ps
    join matches m on m.id = ps.match_id
    join player_steam_all x on x.steam_id = ps.steam_id
   where m.kind = 'mix' and m.status = 'finished' and ps.elo_after is not null
     and coalesce(m.played_at, m.starts_at) > p_from and coalesce(m.played_at, m.starts_at) <= p_until
$$;

-- Totales y promedios de cada ficha en la temporada.
create function public.season_player_totals(p_from timestamptz, p_until timestamptz)
  returns table(player_id uuid, matches integer, wins integer, losses integer, rounds integer, hours numeric, kills integer,
                deaths integer, assists integer, headshots integer, k3 integer, k4 integer, aces integer, first_kills integer,
                plants integer, defuses integer, kd numeric, adr numeric, hs_pct integer, win_pct integer, rating numeric,
                elo_start integer, elo_end integer, elo_peak integer, elo_delta integer, best_streak integer)
  language sql stable set search_path = public as $$
  with r as (select * from season_mix_rows(p_from, p_until)),
  streak as (
    select s.player_id, max(s.n)::integer as best
      from (select g.player_id, count(*) as n
              from (select r.player_id, r.won,
                           row_number() over (partition by r.player_id order by r.at, r.match_id)
                         - row_number() over (partition by r.player_id, r.won order by r.at, r.match_id) as grp
                      from r) g
             where g.won
             group by g.player_id, g.grp) s
     group by s.player_id
  ),
  ends as (
    select distinct on (r.player_id) r.player_id, r.elo_after as elo_end from r order by r.player_id, r.at desc, r.match_id desc
  ),
  starts as (
    select distinct on (r.player_id) r.player_id, r.elo_before as elo_start from r order by r.player_id, r.at, r.match_id
  )
  select r.player_id,
         count(*)::integer, count(*) filter (where r.won)::integer, count(*) filter (where r.lost)::integer,
         sum(r.rounds)::integer, round(coalesce(sum(r.secs), 0) / 3600, 1),
         sum(r.kills)::integer, sum(r.deaths)::integer, sum(r.assists)::integer, sum(r.headshots)::integer,
         sum(r.k3)::integer, sum(r.k4)::integer, sum(r.k5)::integer, sum(r.first_kills)::integer,
         sum(r.plants)::integer, sum(r.defuses)::integer,
         round(sum(r.kills)::numeric / greatest(sum(r.deaths), 1), 2),
         round(sum(r.damage)::numeric / greatest(sum(r.rounds), 1), 1),
         round(100.0 * sum(r.headshots) / greatest(sum(r.kills), 1))::integer,
         round(100.0 * count(*) filter (where r.won) / count(*))::integer,
         csstv_rating(sum(r.kills), sum(r.deaths), sum(r.rounds), sum(r.k1), sum(r.k2), sum(r.k3), sum(r.k4), sum(r.k5)),
         min(st.elo_start), min(e.elo_end), greatest(min(st.elo_start), max(r.elo_after)),
         (min(e.elo_end) - min(st.elo_start))::integer,
         coalesce(min(sk.best), 0)
    from r
    join ends e on e.player_id = r.player_id
    join starts st on st.player_id = r.player_id
    left join streak sk on sk.player_id = r.player_id
   group by r.player_id
$$;

-- El puesto de cada ficha: la foto del cierre si la temporada está cerrada; el ranking al momento si no.
create function public.season_final_rows(p_season uuid, p_until timestamptz)
  returns table(player_id uuid, rank integer, eligible boolean, elo integer, tier text)
  language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare s seasons%rowtype;
begin
  select * into s from seasons where id = p_season;
  if s.status = 'closed' then
    return query select ss.player_id, ss.rank, ss.eligible, ss.elo, ss.tier from season_standings ss where ss.season_id = s.id;
  else
    return query select r.player_id, r.rank, r.eligible, r.elo, t.name
                   from season_rank(s.starts_at, p_until, s.min_matches) r
                   left join lateral season_tier(s.tiers, r.rank, s.top_n) t on true;
  end if;
end $$;

-- =====================================================================================================
-- 3. El recap de cada ficha
-- =====================================================================================================
create function public.season_recap_compute(p_season uuid, p_until timestamptz)
  returns table(player_id uuid, data jsonb)
  language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare
  s     seasons%rowtype;
  prev  seasons%rowtype;
  v_cnt integer;
begin
  select * into s from seasons where id = p_season;
  if s.id is null then raise exception 'No existe esa temporada' using errcode = 'P0002'; end if;
  select * into prev from seasons where number = s.number - 1;

  return query
  with r as (select * from season_mix_rows(s.starts_at, p_until)),
  t as (select * from season_player_totals(s.starts_at, p_until)),
  -- Promedio de la temporada y percentil de cada uno: qué parte de los demás quedó por debajo (en muertes, por arriba).
  cmp as (
    select t.player_id, jsonb_build_object(
      'matches',     jsonb_build_object('avg', round(avg(t.matches) over (), 1),     'pct', round(100 * percent_rank() over (order by t.matches))),
      'rounds',      jsonb_build_object('avg', round(avg(t.rounds) over ()),         'pct', round(100 * percent_rank() over (order by t.rounds))),
      'hours',       jsonb_build_object('avg', round(avg(t.hours) over (), 1),       'pct', round(100 * percent_rank() over (order by t.hours))),
      'win_pct',     jsonb_build_object('avg', round(avg(t.win_pct) over ()),        'pct', round(100 * percent_rank() over (order by t.win_pct))),
      'best_streak', jsonb_build_object('avg', round(avg(t.best_streak) over (), 1), 'pct', round(100 * percent_rank() over (order by t.best_streak))),
      'kills',       jsonb_build_object('avg', round(avg(t.kills) over ()),          'pct', round(100 * percent_rank() over (order by t.kills))),
      'deaths',      jsonb_build_object('avg', round(avg(t.deaths) over ()),         'pct', round(100 * percent_rank() over (order by t.deaths desc))),
      'assists',     jsonb_build_object('avg', round(avg(t.assists) over ()),        'pct', round(100 * percent_rank() over (order by t.assists))),
      'kd',          jsonb_build_object('avg', round(avg(t.kd) over (), 2),          'pct', round(100 * percent_rank() over (order by t.kd))),
      'hs_pct',      jsonb_build_object('avg', round(avg(t.hs_pct) over ()),         'pct', round(100 * percent_rank() over (order by t.hs_pct))),
      'adr',         jsonb_build_object('avg', round(avg(t.adr) over (), 1),         'pct', round(100 * percent_rank() over (order by t.adr))),
      'k3',          jsonb_build_object('avg', round(avg(t.k3) over (), 1),          'pct', round(100 * percent_rank() over (order by t.k3))),
      'first_kills', jsonb_build_object('avg', round(avg(t.first_kills) over ()),    'pct', round(100 * percent_rank() over (order by t.first_kills))),
      'k4',          jsonb_build_object('avg', round(avg(t.k4) over (), 1),          'pct', round(100 * percent_rank() over (order by t.k4))),
      'aces',        jsonb_build_object('avg', round(avg(t.aces) over (), 1),        'pct', round(100 * percent_rank() over (order by t.aces))),
      'elo_delta',   jsonb_build_object('avg', round(avg(t.elo_delta) over ()),      'pct', round(100 * percent_rank() over (order by t.elo_delta))),
      'rating',      jsonb_build_object('avg', round(avg(t.rating) over (), 2),      'pct', round(100 * percent_rank() over (order by t.rating)))
    ) as compare
      from t
  ),
  fin as (select * from season_final_rows(s.id, p_until)),
  ranked as (select count(*) filter (where fin.eligible)::integer as n from fin),
  -- El día con más mixes, en la hora de Argentina (la de los logs y el panel).
  days as (
    select distinct on (d.player_id) d.player_id, d.day, d.n
      from (select r.player_id, (r.at at time zone 'America/Argentina/Buenos_Aires')::date as day, count(*) as n
              from r group by 1, 2) d
     order by d.player_id, d.n desc, d.day desc
  ),
  pts as (
    select r.player_id, jsonb_agg(jsonb_build_object(
             'match_id', r.match_id, 'map', r.map, 'at', r.at, 'elo_before', r.elo_before, 'elo_after', r.elo_after,
             'elo_delta', r.elo_after - r.elo_before) order by r.at, r.match_id) as points
      from r group by r.player_id
  ),
  maps as (
    select mm.player_id, jsonb_agg(jsonb_build_object('name', mm.map, 'matches', mm.n, 'wins', mm.w, 'kd', mm.kd)
                                   order by mm.n desc, mm.w desc, mm.map) as maps
      from (select r.player_id, r.map, count(*)::integer as n, count(*) filter (where r.won)::integer as w,
                   round(sum(r.kills)::numeric / greatest(sum(r.deaths), 1), 2) as kd
              from r where r.map is not null group by 1, 2) mm
     group by mm.player_id
  ),
  best as (
    select distinct on (r.player_id) r.player_id, jsonb_build_object(
             'id', r.match_id, 'map', r.map, 'date', r.at, 'score', jsonb_build_array(r.own_score, r.other_score),
             'won', r.won, 'kills', r.kills, 'deaths', r.deaths,
             'adr', round(r.damage::numeric / greatest(r.rounds, 1), 1), 'rating', r.rating) as best_match
      from r order by r.player_id, r.rating desc nulls last, r.kills desc, r.at desc
  ),
  -- Compañeros: mixes en el mismo equipo y cuántos ganaron juntos.
  pairs as (
    select a.player_id, b.player_id as mate, count(*)::integer as together, count(*) filter (where a.won)::integer as won
      from r a join r b on b.match_id = a.match_id and b.team = a.team and b.player_id <> a.player_id
     group by 1, 2
  ),
  mate_most as (
    select distinct on (p.player_id) p.player_id, p.mate, p.together, p.won from pairs p
     order by p.player_id, p.together desc, p.won desc, p.mate
  ),
  mate_wins as (
    select distinct on (p.player_id) p.player_id, p.mate, p.together, p.won from pairs p
     order by p.player_id, p.won desc, p.together, p.mate
  ),
  -- Los 3 mejores clips: primero los destacados del jugador, después por la escala de clips (ace, 4K, clutch, 3K).
  clips as (
    select c.player_id, jsonb_agg(c.id order by c.ord) as ids
      from (select cl.player_id, cl.id,
                   row_number() over (partition by cl.player_id
                                      order by fc.position nulls last, cl.priority, cl.round_won desc, cl.created_at) as ord
              from match_clip_list cl
              join (select distinct r.player_id, r.match_id from r) rm on rm.player_id = cl.player_id and rm.match_id = cl.match_id
              join players pl on pl.id = cl.player_id
              left join player_featured_clips fc on fc.clip_id = cl.id and fc.user_id = pl.user_id) c
     where c.ord <= 3
     group by c.player_id
  ),
  -- La temporada anterior de la ficha, si jugó (de su recap guardado).
  pv as (
    select sr.player_id, jsonb_build_object(
             'name', prev.name, 'kd', sr.data->'numbers'->'kd', 'adr', sr.data->'numbers'->'adr',
             'hs_pct', sr.data->'numbers'->'hs_pct', 'win_pct', sr.data->'record'->'win_pct', 'rank', sr.data->'final'->'rank') as prev
      from season_recaps sr where prev.id is not null and sr.season_id = prev.id
  ),
  person as (
    select t.player_id, jsonb_build_object('id', t.player_id, 'elo', t.elo_end, 'kd', t.kd, 'matches', t.matches) as p from t
  )
  select t.player_id, jsonb_build_object(
    'season', jsonb_build_object('id', s.id, 'number', s.number, 'name', s.name, 'starts_at', s.starts_at,
                                 'ends_at', s.ends_at, 'closed_at', s.closed_at, 'until', p_until,
                                 'players', (select count(*) from t)),
    'player', pe.p,
    'mixes', jsonb_build_object('matches', t.matches, 'rounds', t.rounds, 'hours', t.hours,
                                'busiest_day', jsonb_build_object('date', d.day, 'matches', d.n)),
    'record', jsonb_build_object('wins', t.wins, 'losses', t.losses, 'win_pct', t.win_pct, 'best_streak', t.best_streak),
    'elo', jsonb_build_object('start', t.elo_start, 'end', t.elo_end, 'peak', t.elo_peak, 'delta', t.elo_delta,
                              'points', coalesce(pt.points, '[]'::jsonb)),
    'numbers', jsonb_build_object('kills', t.kills, 'deaths', t.deaths, 'assists', t.assists, 'kd', t.kd,
                                  'hs_pct', t.hs_pct, 'adr', t.adr, 'k3', t.k3, 'k4', t.k4, 'aces', t.aces,
                                  'first_kills', t.first_kills, 'plants', t.plants, 'defuses', t.defuses, 'rating', t.rating),
    'weapon', null,
    'maps', coalesce(mp.maps, '[]'::jsonb),
    'best_match', b.best_match,
    'mates', case when mm.mate is null then null else jsonb_build_object(
               'most_played', pm.p || jsonb_build_object('together', mm.together, 'won', mm.won),
               'most_wins', pw.p || jsonb_build_object('together', mw.together, 'won', mw.won)) end,
    'rivals', null,
    'clips', coalesce(cl.ids, '[]'::jsonb),
    'compare', c.compare,
    'prev', v.prev,
    'final', jsonb_build_object('rank', f.rank, 'eligible', coalesce(f.eligible, false), 'total_ranked', rk.n,
                                'elo', coalesce(f.elo, t.elo_end), 'tier', f.tier,
                                'top_n', s.top_n, 'min_matches', s.min_matches)
  )
    from t
    join cmp c on c.player_id = t.player_id
    join person pe on pe.player_id = t.player_id
    cross join ranked rk
    left join fin f on f.player_id = t.player_id
    left join days d on d.player_id = t.player_id
    left join pts pt on pt.player_id = t.player_id
    left join maps mp on mp.player_id = t.player_id
    left join best b on b.player_id = t.player_id
    left join mate_most mm on mm.player_id = t.player_id
    left join person pm on pm.player_id = mm.mate
    left join mate_wins mw on mw.player_id = t.player_id
    left join person pw on pw.player_id = mw.mate
    left join clips cl on cl.player_id = t.player_id
    left join pv v on v.player_id = t.player_id;
end $$;

-- =====================================================================================================
-- 4. El resumen global
-- =====================================================================================================
create function public.season_summary_compute(p_season uuid, p_until timestamptz)
  returns jsonb language plpgsql stable set search_path = public as $$
-- Las cifras de la web y del matchmaking en la temporada (no de los jugadores: eso es el recap de cada uno).
declare
  s    seasons%rowtype;
  v    jsonb;
  tz   constant text := 'America/Argentina/Buenos_Aires';
begin
  select * into s from seasons where id = p_season;
  if s.id is null then raise exception 'No existe esa temporada' using errcode = 'P0002'; end if;

  with r as (select * from season_mix_rows(s.starts_at, p_until)),
  m as (
    select r.match_id, min(r.at) as at, min(r.map) as map, max(r.secs) as secs,
           max(r.own_score) filter (where r.team = 1) as score1, max(r.own_score) filter (where r.team = 2) as score2
      from r group by r.match_id
  ),
  lob as (select * from mm_lobbies l where l.created_at > s.starts_at and l.created_at <= p_until),
  lp as (select lp.* from mm_lobby_players lp join lob on lob.id = lp.lobby_id),
  q as (select * from mm_queue_log x where x.joined_at > s.starts_at and x.joined_at <= p_until),
  other as (
    select mt.kind, count(*) as n from matches mt
     where mt.status = 'finished' and coalesce(mt.played_at, mt.starts_at) > s.starts_at
       and coalesce(mt.played_at, mt.starts_at) <= p_until
     group by mt.kind
  )
  select jsonb_build_object(
    'season', jsonb_build_object('id', s.id, 'number', s.number, 'name', s.name, 'status', s.status, 'starts_at', s.starts_at,
                                 'ends_at', s.ends_at, 'closed_at', s.closed_at, 'until', p_until,
                                 'min_matches', s.min_matches, 'top_n', s.top_n),
    -- Los mixes que contaron para el ranking.
    'games', (select jsonb_build_object(
                'mixes', (select count(*) from m),
                'players', (select count(distinct r.player_id) from r),
                'rounds', coalesce((select sum(m.score1 + m.score2) from m), 0),
                'hours', round(coalesce((select sum(m.secs) from m), 0) / 3600, 1),
                'avg_minutes', (select round(avg(m.secs) / 60) from m where m.secs is not null),
                'kills', coalesce(sum(r.kills), 0),
                'hs_pct', round(100.0 * sum(r.headshots) / greatest(sum(r.kills), 1)),
                'aces', coalesce(sum(r.k5), 0), 'k4', coalesce(sum(r.k4), 0),
                'plants', coalesce(sum(r.plants), 0), 'defuses', coalesce(sum(r.defuses), 0))
              from r),
    -- Cuándo se juega, en la hora de Argentina.
    'when', jsonb_build_object(
      'busiest_day', (select jsonb_build_object('date', d.day, 'matches', d.n)
                        from (select (m.at at time zone tz)::date as day, count(*) as n
                                from m group by 1 order by 2 desc, 1 desc limit 1) d),
      'by_hour', (select jsonb_agg(jsonb_build_object('hour', h.h, 'matches', coalesce(x.n, 0)) order by h.h)
                    from generate_series(0, 23) h(h)
                    left join (select extract(hour from m.at at time zone tz)::int as h, count(*) as n from m group by 1) x
                      on x.h = h.h),
      -- 1 = lunes … 7 = domingo.
      'by_weekday', (select jsonb_agg(jsonb_build_object('day', d.d, 'matches', coalesce(x.n, 0)) order by d.d)
                       from generate_series(1, 7) d(d)
                       left join (select extract(isodow from m.at at time zone tz)::int as d, count(*) as n from m group by 1) x
                         on x.d = d.d)),
    'maps', coalesce((select jsonb_agg(jsonb_build_object('name', mp.map, 'matches', mp.n, 'avg_rounds', mp.avg_rounds)
                                       order by mp.n desc, mp.map)
                        from (select m.map, count(*)::integer as n, round(avg(m.score1 + m.score2), 1) as avg_rounds
                                from m where m.map is not null group by m.map) mp), '[]'::jsonb),
    'servers', coalesce((select jsonb_agg(jsonb_build_object('name', sv.name, 'matches', sv.n) order by sv.n desc, sv.name)
                           from (select coalesce(gs.name, 'Sin servidor') as name, count(*)::integer as n
                                   from m join matches mt on mt.id = m.match_id
                                   left join game_servers gs on gs.id = mt.server_id
                                  group by 1) sv), '[]'::jsonb),
    'longest', (select jsonb_build_object('match_id', m.match_id, 'map', m.map, 'date', m.at, 'score1', m.score1, 'score2', m.score2)
                  from m order by m.score1 + m.score2 desc, m.at desc limit 1),
    -- La cola y las salas del matchmaking.
    'matchmaking', jsonb_build_object(
      'queue_joins', (select count(*) from q),
      'queue_players', (select count(distinct q.user_id) from q),
      'matched', (select count(*) from q where q.outcome = 'matched'),
      'left', (select count(*) from q where q.outcome in ('left', 'cancelled', 'disconnected')),
      'wait_median_s', (select round(percentile_cont(0.5) within group (order by extract(epoch from q.left_at - q.joined_at)))
                          from q where q.outcome = 'matched' and q.left_at is not null),
      'lobbies', (select count(*) from lob),
      'played', (select count(*) from lob where lob.status = 'finished'),
      'cancelled', (select count(*) from lob where lob.status = 'cancelled'),
      'cancel_reasons', coalesce((select jsonb_agg(jsonb_build_object('reason', c.reason, 'count', c.n) order by c.n desc, c.reason)
                                    from (select coalesce(lob.end_reason, 'Sin motivo') as reason, count(*)::integer as n
                                            from lob where lob.status = 'cancelled' group by 1) c), '[]'::jsonb),
      'party_pct', (select round(100.0 * count(*) filter (where lp.party_id is not null) / greatest(count(*), 1)) from lp),
      'abandons', (select count(*) from lp where lp.abandoned),
      'replacements', (select count(*) from mm_replacements x where x.created_at > s.starts_at and x.created_at <= p_until),
      'reports', (select count(*) from mm_reports x where x.created_at > s.starts_at and x.created_at <= p_until),
      'penalties', (select count(*) from mm_penalty_log x where x.created_at > s.starts_at and x.created_at <= p_until),
      'bans', (select count(*) from mm_bans x where x.created_at > s.starts_at and x.created_at <= p_until)),
    -- La web y la comunidad.
    'community', jsonb_build_object(
      'new_accounts', (select count(*) from auth.users u where u.created_at > s.starts_at and u.created_at <= p_until),
      'profile_visits', (select count(*) from profile_visits x where x.visited_at > s.starts_at and x.visited_at <= p_until),
      'comments', (select count(*) from profile_comments x where x.created_at > s.starts_at and x.created_at <= p_until and x.deleted_at is null),
      'friendships', (select count(*) from mm_friend_requests x where x.answered_at > s.starts_at and x.answered_at <= p_until and x.status = 'accepted'),
      'clips', (select count(*) from match_clip_list cl where cl.match_id in (select m.match_id from m)),
      'clips_video', (select count(*) from match_clip_list cl where cl.match_id in (select m.match_id from m) and cl.video_status = 'done'),
      'demos', (select count(*) from matches mt where mt.id in (select m.match_id from m) and mt.demo_status = 'uploaded'),
      'pcw', coalesce((select other.n from other where other.kind = 'pcw'), 0),
      'official', coalesce((select other.n from other where other.kind = 'official'), 0),
      'tournaments', (select count(*) from events e where e.starts_on > (s.starts_at at time zone tz)::date
                        and e.starts_on <= (p_until at time zone tz)::date and not coalesce(e.historic, false)
                        and not coalesce(e.testing, false)))
  ) into v;
  return v;
end $$;

-- =====================================================================================================
-- 5. Armar las fotos, el cierre y la vista en vivo
-- =====================================================================================================
create function public.season_recap_build(p_season uuid) returns integer
  language plpgsql security definer set search_path = public as $$
declare s seasons%rowtype; n integer;
begin
  select * into s from seasons where id = p_season;
  if s.id is null then raise exception 'No existe esa temporada' using errcode = 'P0002'; end if;
  if s.status <> 'closed' then raise exception 'La foto se arma solo con la temporada cerrada'; end if;
  delete from season_recaps where season_id = s.id;
  insert into season_recaps(season_id, player_id, data) select s.id, c.player_id, c.data from season_recap_compute(s.id, s.closed_at) c;
  get diagnostics n = row_count;
  insert into season_summaries(season_id, data) values (s.id, season_summary_compute(s.id, s.closed_at))
    on conflict (season_id) do update set data = excluded.data, created_at = now();
  return n;
end $$;

create function public.season_recap_live(p_season uuid, p_player uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin ve las estadísticas de la temporada en curso' using errcode = '42501'; end if;
  return (select c.data from season_recap_compute(p_season, now()) c where c.player_id = p_player);
end $$;

create function public.season_summary_live(p_season uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin ve las estadísticas de la temporada en curso' using errcode = '42501'; end if;
  return season_summary_compute(p_season, now());
end $$;

revoke all on function public.season_mix_rows(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.season_player_totals(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.season_final_rows(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.season_recap_compute(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.season_summary_compute(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.season_recap_build(uuid) from public, anon, authenticated;
revoke all on function public.season_recap_live(uuid, uuid) from public, anon;
revoke all on function public.season_summary_live(uuid) from public, anon;
grant execute on function public.season_recap_live(uuid, uuid) to authenticated;
grant execute on function public.season_summary_live(uuid) to authenticated;

-- El cierre guarda las dos fotos justo después de marcar la temporada cerrada.
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 129: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.season_close_run(uuid, uuid)', array[
  ['perform elo_season_event(s.id, true);',
   'perform elo_season_event(s.id, true);' || chr(10) || '  perform season_recap_build(s.id);   -- recap y resumen (replanteo 129)']]);

-- Las temporadas ya cerradas, en orden (para que cada recap encuentre el de la anterior).
do $$
declare r record;
begin
  for r in select id from seasons where status = 'closed' order by number loop
    perform season_recap_build(r.id);
  end loop;
end $$;

do $$ begin
  if has_function_privilege('anon', 'public.season_recap_build(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.season_recap_compute(uuid, timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.season_summary_live(uuid)', 'execute') then
    raise exception 'replanteo 129: quedó algún permiso de más';
  end if;
  if position('season_recap_build' in pg_get_functiondef('public.season_close_run(uuid, uuid)'::regprocedure)) = 0 then
    raise exception 'replanteo 129: season_close_run no arma el recap';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

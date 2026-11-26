-- 141: buscador avanzado y tarjeta de stats para VIP (bitácora docs/bitacora/2026-11-24-exportar-stats-y-buscador-vip,
-- Kyan y Daniel 2026-11-24).
--
--   1. player_filters: lo que le falta al ranking para filtrar (HS %, país según la privacidad del perfil, si es VIP, última
--      partida y mapa más jugado en mixes). player_ranking_search y season_standings_search son player_ranking y
--      season_standings_list con esas columnas: la API las usa solo si hay un filtro avanzado, así que el ranking de
--      siempre no cambia.
--   2. match_search(filtros, orden, dirección, tope, desde): la búsqueda de partidas que no se puede hacer filtrando
--      match_list (favoritas de la cuenta, con y contra otro jugador, diferencia de rondas, con demo y los órdenes por
--      diferencia y por rating del MVP). Devuelve los ids de la página y los contadores por tipo. Solo con sesión; que sea
--      VIP lo mira la API, porque los datos ya son públicos.
--   3. player_card(ficha, desde): las stats de mixes de la tarjeta para redes.
--   4. saved_searches: búsquedas guardadas, hasta 5 por tipo. Guardar es VIP; ver y borrar las propias, no.
-- Necesita la 140. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/141_buscador_y_tarjeta.sql.
begin;

do $$
begin
  if to_regclass('public.player_filters') is not null then raise exception 'replanteo 141: ya se aplicó (player_filters existe)'; end if;
  if to_regclass('public.match_favorites') is null then raise exception 'replanteo 141: falta la 140'; end if;
end $$;

---------------------------------------------------------------------------------------------------- 1. Jugadores

create view public.player_filters with (security_invoker = true) as
select p.id as player_id, s.hs, d.country,
       exists (select 1 from vip_public v where v.player_id = p.id) as vip,
       act.last_played_at, act.fav_map
  from players p
  left join player_stats s on s.player_id = p.id
  left join profile_details d on d.user_id = p.user_id
  left join (select x.player_id, max(x.at) as last_played_at,
                    mode() within group (order by x.map) filter (where x.kind = 'mix' and x.map is not null) as fav_map
               from (select ps.player_id, m.kind, coalesce(m.played_at, m.starts_at) as at,
                            regexp_replace(m.map, '^(de|cs)_', '') as map
                       from match_player_stats ps join matches m on m.id = ps.match_id
                      where ps.player_id is not null and m.status = 'finished' and m.kind <> 'mm') x
              group by x.player_id) act on act.player_id = p.id;
comment on view public.player_filters is 'Filtros avanzados del ranking: HS %, país (según la privacidad), VIP, última partida y mapa más jugado en mixes (replanteo 141)';

-- materialized: si no, con un filtro que estima pocas filas la base recalcula el ranking por cada una (260 ms contra 15).
create view public.player_ranking_search with (security_invoker = true) as
with r as materialized (select * from player_ranking), f as materialized (select * from player_filters)
select r.id, r.nick, r.photo_url, r.elo, r.elo_matches, r.maps, r.rating, r.kd, r.teams, r.search, r.position, r.country, r.game_role,
       r.teams <> '[]'::jsonb as has_team, f.hs, f.vip, f.last_played_at, f.fav_map
  from r join f on f.player_id = r.id;
comment on view public.player_ranking_search is 'player_ranking con los filtros avanzados (replanteo 141)';

create view public.season_standings_search with (security_invoker = true) as
with f as materialized (select * from player_filters)
select l.season_id, l.player_id, l.nick, l.photo_url, l.rank, l.eligible, l.elo, l.peak_elo, l.matches, l.wins, l.losses, l.elo_after,
       l.tier, l.icon, l.search, l.rating, l.kd, l.teams,
       l.teams <> '[]'::jsonb as has_team, f.hs, f.country, f.vip, f.last_played_at, f.fav_map
  from season_standings_list l join f on f.player_id = l.player_id;
comment on view public.season_standings_search is 'season_standings_list con los filtros avanzados (replanteo 141)';
revoke all on public.player_filters, public.player_ranking_search, public.season_standings_search from public, anon, authenticated;
grant select on public.player_filters, public.player_ranking_search, public.season_standings_search to anon, authenticated;

---------------------------------------------------------------------------------------------------- 2. Partidas

-- Filtros (jsonb, todos opcionales): kind, status[], review, event, team, server, player, me, with, against, map, from, to,
-- q (ya normalizado), max_diff, demo, favorites. with y against necesitan player.
create function public.match_search(p jsonb, p_sort text default 'played_at', p_order text default 'desc',
                                    p_limit integer default 20, p_offset integer default 0) returns jsonb
  language plpgsql stable set search_path = public as $$
declare
  v_player uuid := (p->>'player')::uuid;
  v_me     uuid := (p->>'me')::uuid;
  v_with   uuid := (p->>'with')::uuid;
  v_vs     uuid := (p->>'against')::uuid;
  v_diff   int  := (p->>'max_diff')::int;
  v_status text[] := case when p ? 'status' then array(select jsonb_array_elements_text(p->'status')) end;
  v_out    jsonb;
begin
  if p_sort not in ('played_at', 'starts_at', 'round_diff', 'mvp_rating') or p_order not in ('asc', 'desc') then
    raise exception 'match_search: orden inválido' using errcode = '22023';
  end if;
  if (v_with is not null or v_vs is not null) and v_player is null then
    raise exception 'match_search: falta el jugador' using errcode = '22023';
  end if;

  with f as materialized (
    select l.id, l.kind, l.played_at, l.starts_at
      from match_list l
     where l.bye = false
       and (v_status is null or l.status = any (v_status))
       and (not p ? 'review' or l.review = p->>'review')
       and (not p ? 'event' or l.event_id = (p->>'event')::uuid)
       and (not p ? 'team' or l.team1_id = (p->>'team')::uuid or l.team2_id = (p->>'team')::uuid)
       and (not p ? 'server' or l.server_id = (p->>'server')::uuid)
       and (not p ? 'map' or l.map ilike '%' || (p->>'map') || '%')
       and (not p ? 'from' or l.at >= (p->>'from')::timestamptz)
       and (not p ? 'to' or l.at <= (p->>'to')::timestamptz)
       and (not p ? 'demo' or (l.demo_status = 'uploaded') = (p->>'demo')::boolean)
       and (not coalesce((p->>'favorites')::boolean, false)
            or exists (select 1 from match_favorites x where x.match_id = l.id and x.user_id = auth.uid()))
       and (v_player is null or l.player_ids @> array[v_player])
       and (v_me is null or l.player_ids @> array[v_me])
       -- Con (mismo bando) y contra (otro bando): en el mix, o en alguno de los mapas de la serie.
       and (v_with is null or exists (
             select 1 from matches g
               join match_player_stats a on a.match_id = g.id and a.player_id = v_player and a.team in (1, 2)
               join match_player_stats b on b.match_id = g.id and b.player_id = v_with and b.team = a.team
              where g.id = l.id or g.parent_match_id = l.id))
       and (v_vs is null or exists (
             select 1 from matches g
               join match_player_stats a on a.match_id = g.id and a.player_id = v_player and a.team in (1, 2)
               join match_player_stats b on b.match_id = g.id and b.player_id = v_vs and b.team in (1, 2) and b.team <> a.team
              where g.id = l.id or g.parent_match_id = l.id))
       -- Diferencia de rondas: la del mix, o la de todos los mapas de la serie. Sin mapas jugados no entra.
       and (v_diff is null or (
             exists (select 1 from matches g where g.kind = 'mix' and (g.id = l.id or g.parent_match_id = l.id)
                        and g.score1 is not null and g.score2 is not null)
             and not exists (select 1 from matches g where g.kind = 'mix' and (g.id = l.id or g.parent_match_id = l.id)
                        and abs(g.score1 - g.score2) > v_diff)))
       and (not p ? 'q' or l.search ilike '%' || (p->>'q') || '%' or l.player_search ilike '%' || (p->>'q') || '%')
  ), k as (
    select f.id,
           case p_sort
             when 'played_at' then extract(epoch from f.played_at)::numeric
             when 'starts_at' then extract(epoch from f.starts_at)::numeric
             when 'round_diff' then (select avg(abs(g.score1 - g.score2)) from matches g
                                      where g.kind = 'mix' and (g.id = f.id or g.parent_match_id = f.id))
             else (select max(s.rating) from match_player_stats s join matches g on g.id = s.match_id
                    where g.kind = 'mix' and (g.id = f.id or g.parent_match_id = f.id))
           end as v,
           coalesce(f.played_at, f.starts_at) as at
      from f
     where not p ? 'kind' or f.kind = p->>'kind'
  ), pagina as (
    select k.id, row_number() over (order by case when p_order = 'asc' then k.v end asc nulls last,
                                             case when p_order = 'desc' then k.v end desc nulls last,
                                             k.at desc nulls last, k.id) as n
      from k
     order by n limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
  )
  select jsonb_build_object(
    'ids', coalesce((select jsonb_agg(id order by n) from pagina), '[]'::jsonb),
    'total', (select count(*) from k),
    'counts', (select jsonb_build_object('all', count(*), 'mix', count(*) filter (where kind = 'mix'),
                                         'pcw', count(*) filter (where kind = 'pcw'),
                                         'official', count(*) filter (where kind = 'official')) from f))
    into v_out;
  return v_out;
end $$;
comment on function public.match_search(jsonb, text, text, integer, integer) is 'Búsqueda de partidas con favoritas, con, contra, diferencia, demo y orden por diferencia o MVP (replanteo 141)';
revoke all on function public.match_search(jsonb, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.match_search(jsonb, text, text, integer, integer) to authenticated;

---------------------------------------------------------------------------------------------------- 3. Tarjeta

create function public.player_card(p_player uuid, p_from timestamptz default null) returns jsonb
  language plpgsql stable set search_path = public as $$
declare o player_overview%rowtype; v jsonb;
begin
  select * into o from player_overview where id = p_player;
  if not found then return null; end if;

  with r as materialized (
    select s.match_id, s.kills, s.deaths, s.headshots, s.damage, s.rounds, s.k1, s.k2, s.k3, s.k4, s.k5, s.rating,
           s.elo_before, s.elo_after, regexp_replace(m.map, '^(de|cs)_', '') as map,
           s.team = m.winner_side as won,
           coalesce(m.played_at, m.starts_at) as at,
           s.rating is not null and s.rating = (select max(x.rating) from match_player_stats x where x.match_id = s.match_id) as mvp
      from match_player_stats s join matches m on m.id = s.match_id
     where s.player_id = p_player and s.team in (1, 2) and m.kind = 'mix' and m.status = 'finished'
       and (p_from is null or coalesce(m.played_at, m.starts_at) >= p_from)
  ), tramos as (
    -- Racha: cada derrota o empate abre un tramo nuevo.
    select r.won, count(*) filter (where r.won is not true) over (order by r.at, r.match_id) as g from r
  ), mapas as (
    select jsonb_agg(jsonb_build_object('name', t.map, 'matches', t.n, 'wins', t.w) order by t.n desc, t.w desc, t.map) as j
      from (select map, count(*)::int as n, count(*) filter (where won)::int as w from r where map is not null
             group by map order by 2 desc, 3 desc, 1 limit 3) t
  )
  select jsonb_build_object(
    'matches', count(*)::int,
    'wins', count(*) filter (where won)::int,
    'kd', case when count(*) > 0 then round(sum(kills)::numeric / greatest(sum(deaths), 1), 2) end,
    'rating', csstv_rating(sum(kills)::numeric, sum(deaths)::numeric, sum(rounds)::numeric, sum(k1)::numeric,
                           sum(k2)::numeric, sum(k3)::numeric, sum(k4)::numeric, sum(k5)::numeric),
    'hs', case when sum(kills) > 0 then round(sum(headshots) * 100.0 / sum(kills), 1) end,
    'adr', case when sum(rounds) > 0 then round(sum(damage)::numeric / sum(rounds), 1) end,
    'mvp', count(*) filter (where mvp)::int,
    'peak_elo', greatest(max(elo_after), max(elo_before)),
    'streak', coalesce((select max(c) from (select count(*) filter (where won)::int as c from tramos group by g) t), 0),
    'maps', coalesce((select j from mapas), '[]'::jsonb),
    'elo_history', coalesce((select jsonb_agg(elo_after order by at, match_id) from r where elo_after is not null), '[]'::jsonb))
    into v from r;

  return v || jsonb_build_object('player_id', o.id, 'nick', o.nick, 'photo_url', o.photo_url, 'elo', o.elo,
    'team_tag', (select nullif(btrim(t->>'tag'), '') from jsonb_array_elements(o.teams) t limit 1));
end $$;
comment on function public.player_card(uuid, timestamptz) is 'Stats de mixes de la tarjeta para redes, desde una fecha o todas (replanteo 141)';
revoke all on function public.player_card(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.player_card(uuid, timestamptz) to authenticated;

---------------------------------------------------------------------------------------------------- 4. Búsquedas guardadas

create table public.saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('players', 'matches')),
  name       text not null check (char_length(name) between 1 and 30),
  query      jsonb not null check (jsonb_typeof(query) = 'object' and octet_length(query::text) <= 1000),
  created_at timestamptz not null default now()
);
comment on table public.saved_searches is 'Búsquedas guardadas de cada cuenta, hasta 5 por tipo (replanteo 141)';
create unique index saved_searches_name on public.saved_searches (user_id, kind, lower(name));
alter table public.saved_searches enable row level security;
revoke all on public.saved_searches from public, anon, authenticated;
grant select on public.saved_searches to authenticated;
create policy "búsquedas: ver las propias" on public.saved_searches for select to authenticated using (user_id = auth.uid());

create function public.saved_search_save(p_kind text, p_name text, p_query jsonb) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_name text := btrim(coalesce(p_name, '')); v_id uuid;
begin
  if v_user is null then raise exception 'Para guardar una búsqueda tienes que iniciar sesión' using errcode = '28000'; end if;
  if not is_vip(v_user) then raise exception 'Guardar búsquedas es para los VIP' using errcode = 'V8901'; end if;
  if char_length(v_name) not between 1 and 30 then raise exception 'El nombre de la búsqueda va de 1 a 30 caracteres'; end if;
  -- Dos guardados a la vez no pasan el tope.
  perform pg_advisory_xact_lock(hashtextextended('saved_searches:' || v_user, 0));
  update saved_searches set query = p_query, name = v_name
   where user_id = v_user and kind = p_kind and lower(name) = lower(v_name) returning id into v_id;
  if found then return v_id; end if;
  if (select count(*) from saved_searches where user_id = v_user and kind = p_kind) >= 5 then
    raise exception 'Ya tienes 5 búsquedas guardadas: borra una para guardar otra';
  end if;
  insert into saved_searches(user_id, kind, name, query) values (v_user, p_kind, v_name, p_query) returning id into v_id;
  return v_id;
end $$;
comment on function public.saved_search_save(text, text, jsonb) is 'Guardar una búsqueda (VIP, hasta 5 por tipo); con el mismo nombre la reemplaza (replanteo 141)';

create function public.saved_search_delete(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from saved_searches where id = p_id and user_id = auth.uid();
  if not found then raise exception 'Esa búsqueda no existe' using errcode = 'P0002'; end if;
end $$;
comment on function public.saved_search_delete(uuid) is 'Borrar una búsqueda guardada propia (replanteo 141)';
revoke all on function public.saved_search_save(text, text, jsonb), public.saved_search_delete(uuid) from public, anon, authenticated;
grant execute on function public.saved_search_save(text, text, jsonb), public.saved_search_delete(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Inversa de supabase/replanteo/30_mapas_temporadas.sql: map_pool, veto_act, los avisos del veto, create_pcw_post y
-- pcw_post_list como antes (sin pools propios; las fotos del bucket photos, en maps/, quedan y se borran a mano si hace
-- falta), y saca rating, kd y teams del ranking de las temporadas (season_close_run, season_live_standings y
-- season_standings_list como en la 24).
begin;

-- ---------- Catálogo de mapas y pools (bloques 1 a 3) ----------
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 30: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;
create function pg_temp.recrear(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 30: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute format('drop function %s', fn);
  execute d;
end $$;

select pg_temp.reemplazar('public.veto_act(uuid, text, text)', array[
  ['seq := veto_sequence(m.best_of, (select count(*)::int from match_map_pool(p_match)));',
   'seq := veto_sequence(m.best_of, (select count(*)::int from map_pool where active));'],
  ['select * into mp from match_map_pool(p_match) where name = p_map;',
   'select * into mp from map_pool where name = p_map and active;']
]);
select pg_temp.reemplazar('public.tg_notify_matches()', array[
  ['v_seq := veto_sequence(new.best_of, (select count(*)::int from match_map_pool(new.id)));',
   'v_seq := veto_sequence(new.best_of, (select count(*)::int from map_pool where active));']
]);
select pg_temp.reemplazar('public.tg_notify_match_vetos()', array[
  ['v_seq := veto_sequence(m.best_of, (select count(*)::int from match_map_pool(m.id)));',
   'v_seq := veto_sequence(m.best_of, (select count(*)::int from map_pool where active));']
]);
drop function public.match_map_pool(uuid);

drop view public.pcw_post_list;
create view public.pcw_post_list with (security_invoker = true) as
select po.id, po.by_user, (select p.nick from players p where p.user_id = po.by_user) as by_alias,
       po.best_of, po.maps, po.starts_at, po.note, po.status, po.match_id, po.created_at,
       po.team_id, s.name as side_name, s.parent_team_id, pt.name as parent_name, pt.tag as parent_tag,
       search_norm(concat_ws(' ', s.name, pt.name, pt.tag)) as search
  from pcw_posts po
  join teams s on s.id = po.team_id
  left join teams pt on pt.id = s.parent_team_id;
grant select on public.pcw_post_list to anon, authenticated;

select pg_temp.recrear('public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid, text[])', array[
  ['p_team uuid DEFAULT NULL::uuid, p_map_pool text[] DEFAULT NULL::text[])', 'p_team uuid DEFAULT NULL::uuid)'],
  ['insert into pcw_posts(team_id, by_user, best_of, maps, starts_at, note, status, map_pool)',
   'insert into pcw_posts(team_id, by_user, best_of, maps, starts_at, note, status)'],
  [$x$p_starts_at, left(nullif(trim(p_note), ''), 200), 'open', p_map_pool)$x$,
   $x$p_starts_at, left(nullif(trim(p_note), ''), 200), 'open')$x$]
]);
revoke all on function public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid) from public, anon;
grant execute on function public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid) to authenticated;

drop trigger pcw_posts_map_pool on public.pcw_posts;
drop function public.pcw_posts_map_pool();
drop trigger events_map_pool on public.events;
drop function public.events_map_pool();
drop function public.map_pool_check(text[], text[], integer);
drop function public.event_max_bo(jsonb);
alter table public.pcw_posts drop column map_pool;
alter table public.events drop column map_pool;

alter table public.map_pool drop constraint map_pool_veto_default,
  drop column image_url, drop column mixes, drop column veto_default;
comment on table public.map_pool is 'Mapas del veto. versions: nombres de mapa del servidor (el primero es el nombre del mapa); Inferno tiene dos';

-- ---------- Temporadas (bloque 4) ----------

drop view public.season_standings_list;
drop view public.season_live_standings;

create view public.season_live_standings with (security_invoker = true) as
select s.id as season_id, r.player_id, p.nick, coalesce(p.photo_url, d.avatar_url) as photo_url, r.rank, r.eligible,
       r.elo, r.peak_elo, r.matches, r.wins, r.losses, season_reset_elo(r.elo, s.reset_pct, s.reset_floor) as elo_after,
       t.name as tier, t.icon, search_norm(p.nick) as search
  from seasons s
  cross join lateral season_rank(s.starts_at, now(), s.min_matches) r
  join players p on p.id = r.player_id
  left join profile_details d on d.user_id = p.user_id
  left join lateral season_tier(s.tiers, r.rank, s.top_n) t on true
 where s.status = 'active';
comment on view public.season_live_standings is 'Ranking en vivo de la temporada activa';

create view public.season_standings_list with (security_invoker = true) as
select st.season_id, st.player_id, p.nick, coalesce(p.photo_url, d.avatar_url) as photo_url, st.rank, st.eligible,
       st.elo, st.peak_elo, st.matches, st.wins, st.losses, st.elo_after, st.tier, st.icon, search_norm(p.nick) as search
  from season_standings st
  join players p on p.id = st.player_id
  left join profile_details d on d.user_id = p.user_id
union all
select * from season_live_standings;
comment on view public.season_standings_list is 'Ranking por temporada: la foto de las cerradas y el ranking en vivo de la activa';

grant select on public.season_live_standings, public.season_standings_list to anon, authenticated;

select pg_temp.reemplazar('public.season_close_run(uuid, uuid)', array[
  [E'insert into season_standings(season_id, player_id, rank, eligible, elo, peak_elo, matches, wins, losses, elo_after, tier, icon, rating, kd)\n',
   E'insert into season_standings(season_id, player_id, rank, eligible, elo, peak_elo, matches, wins, losses, elo_after, tier, icon)\n'],
  [E'         season_reset_elo(r.elo, s.reset_pct, s.reset_floor), t.name, t.icon, ps.rating, ps.kd\n',
   E'         season_reset_elo(r.elo, s.reset_pct, s.reset_floor), t.name, t.icon\n'],
  [E'    left join lateral season_tier(s.tiers, r.rank, s.top_n) t on true\n' ||
   E'    left join season_player_stats(s.starts_at, v_at) ps on ps.player_id = r.player_id;\n',
   E'    left join lateral season_tier(s.tiers, r.rank, s.top_n) t on true;\n']
]);

alter table public.season_standings drop column rating, drop column kd;
drop function public.season_player_stats(timestamptz, timestamptz);

commit;

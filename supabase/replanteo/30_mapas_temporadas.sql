-- Replanteo 30: catálogo de mapas con pool propio por torneo y por PCW, y columnas del Histórico en el ranking de
-- una temporada. Planes: docs/bitacora/2026-10-25-pool-mapas-torneos-pcw (reemplaza el diseño de
-- 2026-10-25-maestra-mapas) y docs/bitacora/2026-10-25-ranking-temporada-columnas.
--   1. map_pool es el catálogo de todos los mapas: active pasa a ser "disponible" (inactivo = retirado) y suma la foto
--      (image_url), mixes (sale en el select de Mixes) y veto_default (pool por defecto). Los activos de hoy quedan con
--      las tres marcas: el veto no cambia.
--   2. Pool propio del torneo (events.map_pool, lo elige el organizador) y de la PCW (pcw_posts.map_pool, quien
--      publica; create_pcw_post suma p_map_pool). null = el pool por defecto. Se validan con map_pool_check: mapas
--      disponibles, sin repetidos, entre el BO más alto y 20. El del torneo no cambia después del primer veto.
--   3. match_map_pool(partida): el pool del veto de cada partida. Lo usan veto_act y los avisos del veto
--      (tg_notify_matches y tg_notify_match_vetos) en lugar de los active de map_pool.
--   4. season_player_stats(desde, hasta): rating y K/D de cada ficha con los mixes del período (los mismos que cuenta
--      season_rank). season_standings guarda rating y kd en la foto del cierre (season_close_run) y la migración llena
--      las temporadas ya cerradas. season_live_standings suma rating y kd, y season_standings_list suma además los
--      equipos oficiales actuales (teams, como player_overview).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.season_standings_list') is null then
    raise exception 'replanteo 30: falta season_standings_list (aplicar antes 24_temporadas.sql)';
  end if;
  if to_regprocedure('public.tg_notify_match_vetos()') is null then
    raise exception 'replanteo 30: falta tg_notify_match_vetos (aplicar antes 28_notificaciones.sql)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'map_pool' and column_name = 'image_url') then
    raise exception 'replanteo 30: map_pool ya tiene image_url (¿ya se aplicó?)';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 30: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Igual, para una función que cambia de firma: borra la vieja antes de crear la nueva.
create function pg_temp.recrear(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 30: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute format('drop function %s', fn);
  execute d;
end $$;

-- =====================================================================================================
-- 1. Catálogo de mapas
-- =====================================================================================================
alter table public.map_pool
  add column image_url    text,
  add column mixes        boolean not null default false,
  add column veto_default boolean not null default false;
update public.map_pool set mixes = active, veto_default = active;
alter table public.map_pool add constraint map_pool_veto_default check (not veto_default or active);
comment on table public.map_pool is 'Catálogo de mapas. versions: nombres de mapa del servidor (el primero es el nombre del mapa); Inferno tiene dos. active: disponible (inactivo = retirado); mixes: sale en el select de Mixes; veto_default: pool por defecto del veto (replanteo 30)';

-- =====================================================================================================
-- 2. Pool propio del torneo y de la PCW
-- =====================================================================================================
alter table public.events add column map_pool text[];
comment on column public.events.map_pool is 'Pool del veto del torneo (nombres de map_pool); null = el pool por defecto (replanteo 30)';
alter table public.pcw_posts add column map_pool text[];
comment on column public.pcw_posts.map_pool is 'Pool del veto de la PCW (nombres de map_pool); null = el pool por defecto (replanteo 30)';

-- BO más alto de la configuración de un torneo (bo, bo_semi, bo_final, bo_group…, también los de playoffs); 1 si no tiene.
create function public.event_max_bo(p_config jsonb) returns integer language sql immutable as $$
  select coalesce(max(kv.value::int), 1)
    from jsonb_path_query(coalesce(p_config, '{}'), 'lax $.** ? (@.type() == "object")') o,
         jsonb_each_text(o) kv
   where kv.key like 'bo%' and kv.value ~ '^\d{1,2}$' $$;

-- Un pool nuevo o cambiado: mapas disponibles (los que ya estaban en el pool anterior se aceptan aunque se hayan
-- retirado), sin repetidos, al menos p_min y como mucho 20. null no se valida (es el pool por defecto).
create function public.map_pool_check(p_new text[], p_old text[], p_min integer) returns void
  language plpgsql stable security definer set search_path = public as $$
declare v_bad text;
begin
  if p_new is null then return; end if;
  if cardinality(p_new) <> (select count(distinct x) from unnest(p_new) x) then
    raise exception 'El pool de mapas tiene mapas repetidos';
  end if;
  if cardinality(p_new) > 20 then raise exception 'El pool de mapas puede tener hasta 20 mapas'; end if;
  if cardinality(p_new) < greatest(p_min, 1) then
    raise exception 'El pool de mapas necesita al menos % mapas (el BO más alto)', greatest(p_min, 1);
  end if;
  select x into v_bad from unnest(p_new) x
   where not (x = any(coalesce(p_old, '{}'))) and not exists (select 1 from map_pool where name = x and active)
   limit 1;
  if v_bad is not null then raise exception 'El mapa % no está disponible', v_bad; end if;
end $$;
revoke all on function public.map_pool_check(text[], text[], integer) from public, anon, authenticated;

create function public.events_map_pool() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.map_pool is distinct from old.map_pool
     and exists (select 1 from match_vetos v join matches m on m.id = v.match_id where m.event_id = new.id) then
    raise exception 'El pool de mapas del torneo no se cambia después del primer veto';
  end if;
  perform map_pool_check(new.map_pool, case when tg_op = 'UPDATE' then old.map_pool end, event_max_bo(new.config));
  return new;
end $$;
create trigger events_map_pool before insert or update of map_pool, config on public.events
  for each row execute function public.events_map_pool();

create function public.pcw_posts_map_pool() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform map_pool_check(new.map_pool, case when tg_op = 'UPDATE' then old.map_pool end, new.best_of);
  return new;
end $$;
create trigger pcw_posts_map_pool before insert or update of map_pool, best_of on public.pcw_posts
  for each row execute function public.pcw_posts_map_pool();

-- Publicar una PCW con su pool (p_map_pool, null = el pool por defecto).
select pg_temp.recrear('public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid)', array[
  ['p_team uuid DEFAULT NULL::uuid)', 'p_team uuid DEFAULT NULL::uuid, p_map_pool text[] DEFAULT NULL::text[])'],
  ['insert into pcw_posts(team_id, by_user, best_of, maps, starts_at, note, status)',
   'insert into pcw_posts(team_id, by_user, best_of, maps, starts_at, note, status, map_pool)'],
  [$x$p_starts_at, left(nullif(trim(p_note), ''), 200), 'open')$x$,
   $x$p_starts_at, left(nullif(trim(p_note), ''), 200), 'open', p_map_pool)$x$]
]);
revoke all on function public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid, text[]) from public, anon;
grant execute on function public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid, text[]) to authenticated;

-- El listado de anuncios devuelve el pool.
create or replace view public.pcw_post_list with (security_invoker = true) as
select po.id, po.by_user, (select p.nick from players p where p.user_id = po.by_user) as by_alias,
       po.best_of, po.maps, po.starts_at, po.note, po.status, po.match_id, po.created_at, po.team_id,
       s.name as side_name, s.parent_team_id, pt.name as parent_name, pt.tag as parent_tag,
       search_norm(concat_ws(' ', s.name, pt.name, pt.tag)) as search, po.map_pool
  from pcw_posts po
  join teams s on s.id = po.team_id
  left join teams pt on pt.id = s.parent_team_id;

-- =====================================================================================================
-- 3. Pool del veto de cada partida
-- =====================================================================================================
-- El del torneo, si tiene; si no, el de la PCW, si tiene; si no, el pool por defecto.
create function public.match_map_pool(p_match uuid) returns setof public.map_pool
  language sql stable security definer set search_path = public as $$
  with pool as (
    select coalesce(e.map_pool, po.map_pool) as names
      from matches m
      left join events e on e.id = m.event_id
      left join pcw_posts po on po.match_id = m.id and m.kind = 'pcw'
     where m.id = p_match
     limit 1)
  select mp.* from map_pool mp, pool
   where case when pool.names is null then mp.active and mp.veto_default else mp.name = any(pool.names) end
   order by mp.position, mp.name $$;
comment on function public.match_map_pool(uuid) is 'Pool del veto de una partida: el del torneo, el de la PCW o el pool por defecto (replanteo 30)';
grant execute on function public.match_map_pool(uuid) to anon, authenticated;

select pg_temp.reemplazar('public.veto_act(uuid, text, text)', array[
  ['seq := veto_sequence(m.best_of, (select count(*)::int from map_pool where active));',
   'seq := veto_sequence(m.best_of, (select count(*)::int from match_map_pool(p_match)));'],
  ['select * into mp from map_pool where name = p_map and active;',
   'select * into mp from match_map_pool(p_match) where name = p_map;']
]);
select pg_temp.reemplazar('public.tg_notify_matches()', array[
  ['v_seq := veto_sequence(new.best_of, (select count(*)::int from map_pool where active));',
   'v_seq := veto_sequence(new.best_of, (select count(*)::int from match_map_pool(new.id)));']
]);
select pg_temp.reemplazar('public.tg_notify_match_vetos()', array[
  ['v_seq := veto_sequence(m.best_of, (select count(*)::int from map_pool where active));',
   'v_seq := veto_sequence(m.best_of, (select count(*)::int from match_map_pool(m.id)));']
]);

-- =====================================================================================================
-- 4. Rating, K/D y equipos en el ranking de una temporada
-- =====================================================================================================
-- Mismos mixes que season_rank (terminados, con ELO aplicado, en el período, con todos los SteamID de la ficha) y
-- mismas fórmulas que player_stats.
create function public.season_player_stats(p_from timestamptz, p_until timestamptz)
  returns table(player_id uuid, rating numeric, kd numeric)
  language sql stable set search_path = public as $$
  select x.player_id,
         csstv_rating(sum(ps.kills), sum(ps.deaths), sum(ps.rounds), sum(ps.k1), sum(ps.k2), sum(ps.k3), sum(ps.k4), sum(ps.k5)),
         round(sum(ps.kills)::numeric / greatest(sum(ps.deaths), 1), 2)
    from match_player_stats ps
    join matches m on m.id = ps.match_id
    join player_steam_all x on x.steam_id = ps.steam_id
   where m.kind = 'mix' and m.status = 'finished' and ps.elo_after is not null
     and coalesce(m.played_at, m.starts_at) > p_from and coalesce(m.played_at, m.starts_at) <= p_until
   group by x.player_id $$;
comment on function public.season_player_stats(timestamptz, timestamptz) is 'Rating y K/D de cada ficha con los mixes de un período (replanteo 30)';

alter table public.season_standings
  add column rating numeric(4,2),                  -- null: sin mixes en la temporada
  add column kd     numeric(6,2);

-- Temporadas ya cerradas: con su inicio y su cierre.
update public.season_standings st
   set rating = ps.rating, kd = ps.kd
  from public.seasons s, lateral public.season_player_stats(s.starts_at, s.closed_at) ps
 where s.id = st.season_id and s.status = 'closed' and ps.player_id = st.player_id;

-- La foto del cierre guarda el rating y el K/D de la temporada.
select pg_temp.reemplazar('public.season_close_run(uuid, uuid)', array[
  [E'insert into season_standings(season_id, player_id, rank, eligible, elo, peak_elo, matches, wins, losses, elo_after, tier, icon)\n',
   E'insert into season_standings(season_id, player_id, rank, eligible, elo, peak_elo, matches, wins, losses, elo_after, tier, icon, rating, kd)\n'],
  [E'         season_reset_elo(r.elo, s.reset_pct, s.reset_floor), t.name, t.icon\n',
   E'         season_reset_elo(r.elo, s.reset_pct, s.reset_floor), t.name, t.icon, ps.rating, ps.kd\n'],
  [E'    left join lateral season_tier(s.tiers, r.rank, s.top_n) t on true;\n',
   E'    left join lateral season_tier(s.tiers, r.rank, s.top_n) t on true\n' ||
   E'    left join season_player_stats(s.starts_at, v_at) ps on ps.player_id = r.player_id;\n']
]);

drop view public.season_standings_list;

create or replace view public.season_live_standings with (security_invoker = true) as
select s.id as season_id, r.player_id, p.nick, coalesce(p.photo_url, d.avatar_url) as photo_url, r.rank, r.eligible,
       r.elo, r.peak_elo, r.matches, r.wins, r.losses, season_reset_elo(r.elo, s.reset_pct, s.reset_floor) as elo_after,
       t.name as tier, t.icon, search_norm(p.nick) as search, ps.rating, ps.kd
  from seasons s
  cross join lateral season_rank(s.starts_at, now(), s.min_matches) r
  join players p on p.id = r.player_id
  left join profile_details d on d.user_id = p.user_id
  left join lateral season_tier(s.tiers, r.rank, s.top_n) t on true
  left join lateral season_player_stats(s.starts_at, now()) ps on ps.player_id = r.player_id
 where s.status = 'active';

-- Los equipos son los oficiales de hoy (como en el Histórico), también en las temporadas cerradas.
create view public.season_standings_list with (security_invoker = true) as
select u.*,
       coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'tag', t.tag) order by tm.joined_at nulls first, t.name)
                   from team_members tm join teams t on t.id = tm.team_id
                  where tm.player_id = u.player_id and tm.left_at is null and t.kind = 'official'), '[]'::jsonb) as teams
  from (
    select st.season_id, st.player_id, p.nick, coalesce(p.photo_url, d.avatar_url) as photo_url, st.rank, st.eligible,
           st.elo, st.peak_elo, st.matches, st.wins, st.losses, st.elo_after, st.tier, st.icon, search_norm(p.nick) as search,
           st.rating, st.kd
      from season_standings st
      join players p on p.id = st.player_id
      left join profile_details d on d.user_id = p.user_id
    union all
    select * from season_live_standings
  ) u;
comment on view public.season_standings_list is 'Ranking por temporada: la foto de las cerradas y el ranking en vivo de la activa, con rating, K/D y equipos actuales (replanteo 30)';
grant select on public.season_standings_list to anon, authenticated;

commit;

-- Replanteo 27: la API de los mockups de Mixes, Perfil público y Ranking
-- (plan docs/bitacora/2026-10-24-api-mixes-perfil-ranking).
--   1. Puerto de SourceTV de cada servidor (game_servers.tv_port) en game_servers_public, admin_server_list y
--      admin_create_server.
--   2. Nick único en todas las fichas (índice y mensaje claro), para buscar el perfil por nick. alias_check
--      también lo cuenta como tomado.
--   3. Borrar un mix manteniendo o revirtiendo su ELO, sin recalcular la historia: admin_delete_mix, el registro
--      mix_deletions y elo_adjustments.source ('mix_kept' no se muestra en el perfil del jugador).
--   4. Listado único de mixes (en vivo, terminados y cancelados) y sus números: vistas mix_list y mix_stats.
--   5. Perfil: player_elo_history, player_titles (palmarés) y player_matches con el torneo y la fase.
--   6. Ranking: player_ranking (posición global), players_together (comparador) y, para los equipos, team_results,
--      team_standings_at(fecha) y team_ranking con la posición de hace 30 días y los últimos 5 resultados.
-- Aborta si hay nicks repetidos (sin distinguir mayúsculas ni espacios de los costados): renombrar antes.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
declare rep text;
begin
  if to_regclass('public.player_elo_adjustment_list') is null then
    raise exception 'replanteo 27: falta player_elo_adjustment_list (aplicar antes 25_ajustes_elo_admin.sql)';
  end if;
  if to_regclass('public.live_match_list') is null then
    raise exception 'replanteo 27: falta live_match_list (aplicar antes 16_mixes_en_vivo.sql)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'game_servers' and column_name = 'tv_port') then
    raise exception 'replanteo 27: game_servers ya tiene tv_port (¿ya se aplicó?)';
  end if;
  select string_agg(n, ', ') into rep
    from (select lower(trim(nick)) as n from public.players group by 1 having count(*) > 1 order by 1 limit 20) x;
  if rep is not null then
    raise exception 'replanteo 27: hay nicks repetidos (renombrar antes): %', rep;
  end if;
end $$;

-- =====================================================================================================
-- 1. Puerto de SourceTV
-- =====================================================================================================
alter table public.game_servers
  add column tv_port integer constraint game_servers_tv_port_check check (tv_port between 1 and 65535);
comment on column public.game_servers.tv_port is 'Puerto de SourceTV (tv_port del servidor): "Ver en TV" de los mixes en vivo (replanteo 27)';

-- Como en la 20, con tv_port al final.
create or replace view public.game_servers_public as
select id, name, connect_address, mode, region, tv_port from game_servers
 where active and (license_expires_at is null or license_expires_at > now()); -- (replanteo 12)

create or replace view public.admin_server_list with (security_invoker = true) as
select g.id, g.name, g.active, g.created_at, g.last_seen_at, g.connect_address, g.panel_server_id,
       g.license_expires_at, g.allowed_ip, g.last_ip, g.plugin_version,
       case when not g.active then 'revoked'
            when g.license_expires_at <= now() then 'expired'
            when g.license_expires_at <= now() + interval '7 days' then 'expiring'
            else 'ok' end as license_state,
       coalesce(g.last_seen_at > now() - interval '35 minutes', false) as online,
       g.panel_server_id is not null as has_panel,
       (select count(*)::int from matches m where m.server_id = g.id) as matches,
       (select max(coalesce(m.played_at, m.starts_at)) from matches m where m.server_id = g.id) as last_match_at,
       search_norm(concat_ws(' ', g.name, g.connect_address, g.allowed_ip, g.last_ip, g.plugin_version, g.region)) as search,
       g.mode, g.region,
       g.tv_port -- (replanteo 27)
  from game_servers g;

-- Como en la 20, con p_tv_port.
drop function public.admin_create_server(text, text, text, timestamptz, text, text, text);
create function public.admin_create_server(p_name text, p_connect_address text default null, p_panel_server_id text default null,
                                           p_license_expires_at timestamptz default null, p_allowed_ip text default null,
                                           p_mode text default null, p_region text default null, p_tv_port integer default null)
  returns table(id uuid, token text) language plpgsql security definer set search_path = public as $$
declare v_token text; v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un admin puede crear servidores' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 40 then
    raise exception 'El nombre tiene que tener entre 2 y 40 caracteres';
  end if;
  if exists (select 1 from game_servers g where lower(trim(g.name)) = lower(trim(p_name))) then
    raise exception 'Ya hay un servidor con ese nombre' using errcode = '23505';
  end if;
  v_token := 'csstv_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into game_servers(name, token_hash, connect_address, panel_server_id, license_expires_at, allowed_ip, mode, region, tv_port)
  values (trim(p_name), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), nullif(trim(p_connect_address), ''),
          nullif(trim(p_panel_server_id), ''), p_license_expires_at, nullif(trim(p_allowed_ip), ''),
          nullif(trim(p_mode), ''), nullif(trim(p_region), ''), p_tv_port)
  returning game_servers.id into v_id;
  return query select v_id, v_token;
end $$;
revoke all on function public.admin_create_server(text, text, text, timestamptz, text, text, text, integer) from public, anon;
grant execute on function public.admin_create_server(text, text, text, timestamptz, text, text, text, integer) to authenticated;

-- =====================================================================================================
-- 2. Nick único
-- =====================================================================================================
create unique index players_nick_unico on public.players (lower(trim(nick)));

-- Mensaje claro antes de chocar con el índice (va después de players_nick_alias, que pone el alias de la cuenta).
create function public.players_nick_unico() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from players p where lower(trim(p.nick)) = lower(trim(new.nick)) and p.id <> new.id) then
    raise exception 'Ese alias ya está en uso: otro jugador se llama %', trim(new.nick) using errcode = '23505';
  end if;
  return new;
end $$;
create trigger players_nick_unico before insert or update of nick, user_id on public.players
  for each row execute function public.players_nick_unico();

-- Como en la 09: también está tomado el nick de otra ficha (no la propia).
create or replace function public.alias_check(p_tag text) returns text
  language plpgsql stable security definer set search_path = public as $$
declare v text := trim(coalesce(p_tag, ''));
begin
  if char_length(v) < 2 or char_length(v) > 24 then return 'length'; end if;
  if v ~ '[<>[:cntrl:]]' then return 'chars'; end if;
  if name_blocked(v) is not null then return 'blocked'; end if;
  if exists (select 1 from profiles where lower(trim(tag)) = lower(v) and id is distinct from auth.uid()) then return 'taken'; end if;
  -- (replanteo 27) nick de otra ficha
  if exists (select 1 from players where lower(trim(nick)) = lower(v) and user_id is distinct from auth.uid()) then return 'taken'; end if;
  return 'ok';
end $$;

-- =====================================================================================================
-- 3. Borrar un mix
-- =====================================================================================================
alter table public.elo_adjustments
  add column source text not null default 'manual' constraint elo_adjustments_source_check check (source in ('manual', 'mix_kept'));
comment on column public.elo_adjustments.source is
  'manual: ajuste de un admin. mix_kept: sostiene el ELO de un mix borrado con "mantener" (no se aplica al crearlo; solo cuenta en un recálculo). Replanteo 27';

-- Como en la 25, sin los ajustes que sostienen un mix borrado: para el jugador no cambió nada.
create or replace view public.player_elo_adjustment_list with (security_invoker = true) as
select a.id, x.player_id, a.delta, a.set_elo, a.reason, a.applied_at
  from elo_adjustments a
  join player_steam_all x on x.steam_id = a.steam_id
 where a.source = 'manual'; -- (replanteo 27)

-- Como en la 25, con source al final.
create or replace view public.admin_elo_adjustment_list with (security_invoker = true) as
select a.id, x.player_id, p.nick, a.steam_id, a.delta, a.set_elo, a.reason, a.applied_at, a.created_by,
       pr.tag as created_by_alias, search_norm(concat_ws(' ', p.nick, a.reason, a.steam_id)) as search,
       a.source -- (replanteo 27)
  from elo_adjustments a
  left join player_steam_all x on x.steam_id = a.steam_id
  left join players p on p.id = x.player_id
  left join profiles pr on pr.id = a.created_by
 where is_admin();

create table public.mix_deletions (
  id          bigint generated always as identity primary key,
  match_id    uuid not null,
  map         text,
  played_at   timestamptz,
  server_id   uuid,
  score1      integer,
  score2      integer,
  elo_mode    text not null check (elo_mode in ('keep', 'revert', 'none')),
  deltas      jsonb not null default '{}'::jsonb,
  deleted_by  uuid default auth.uid(),
  deleted_at  timestamptz not null default now()
);
comment on table public.mix_deletions is 'Mixes borrados por un admin: qué se borró, quién, y qué pasó con el ELO (deltas por SteamID). Replanteo 27';
alter table public.mix_deletions enable row level security;
create policy "mix_deletions: admin ve" on public.mix_deletions for select using (is_admin());
revoke all on public.mix_deletions from anon, authenticated;
grant select on public.mix_deletions to authenticated;

-- Borra un mix terminado o cancelado. p_elo: 'keep' (el ELO queda como está; un ajuste mix_kept con la fecha del
-- mix lo sostiene en un recálculo futuro) o 'revert' (resta ahora el cambio de cada jugador, sin guardar ajuste: un
-- recálculo futuro ya no ve el mix). Nunca recalcula la historia. Las stats, el chat, el veto, la caída y los clips se
-- borran en cascada.
create function public.admin_delete_mix(p_match uuid, p_elo text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  m      matches%rowtype;
  v_mode text;
  v_d    jsonb;
  v_n    integer;
  r      record;
begin
  if not is_admin() then raise exception 'Solo un admin puede borrar mixes' using errcode = '42501'; end if;
  if p_elo is null or p_elo not in ('keep', 'revert') then
    raise exception 'Elige qué pasa con el ELO: keep (mantener) o revert (revertir)' using errcode = '22023';
  end if;
  select * into m from matches where id = p_match for update;
  if m.id is null then raise exception 'No existe ese mix' using errcode = 'P0002'; end if;
  if m.kind <> 'mix' then raise exception 'Solo se borran mixes: las partidas de torneo o PCW tienen su propio camino'; end if;
  if m.status not in ('finished', 'cancelled') then raise exception 'Solo se borran mixes terminados o cancelados'; end if;
  if m.parent_match_id is not null then
    raise exception 'Este mix está vinculado con !match a una partida de torneo o PCW: no se borra';
  end if;

  select coalesce(jsonb_object_agg(s.steam_id, s.elo_delta), '{}'::jsonb), count(*) into v_d, v_n
    from match_player_stats s
   where s.match_id = p_match and coalesce(s.elo_delta, 0) <> 0
     and s.steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$';
  v_mode := case when v_n = 0 then 'none' else p_elo end;

  if v_n > 0 then
    -- Bloquea las filas en orden (como elo_add_adjustment) y espera a un recálculo en curso.
    perform 1 from player_elo
     where steam_id in (select elo_key(s.steam_id) from match_player_stats s where s.match_id = p_match)
     order by steam_id for update;
    for r in
      select s.steam_id, s.elo_delta from match_player_stats s
       where s.match_id = p_match and coalesce(s.elo_delta, 0) <> 0
         and s.steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$'
       order by s.steam_id
    loop
      if p_elo = 'keep' then
        insert into elo_adjustments(steam_id, delta, reason, applied_at, source)
        values (r.steam_id, r.elo_delta,
                format('Mix borrado (%s, %s): se mantiene su ELO', coalesce(m.map, 'sin mapa'),
                       to_char(coalesce(m.played_at, m.starts_at, now()) at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')),
                coalesce(m.played_at, m.starts_at, now()), 'mix_kept');
      else
        perform elo_apply_adjustment(r.steam_id, -r.elo_delta);
        update player_elo set matches = greatest(matches - 1, 0) where steam_id = elo_key(r.steam_id);
      end if;
    end loop;
  end if;

  insert into mix_deletions(match_id, map, played_at, server_id, score1, score2, elo_mode, deltas)
  values (m.id, m.map, coalesce(m.played_at, m.starts_at), m.server_id, m.score1, m.score2, v_mode, v_d);
  delete from matches where id = p_match;
  return jsonb_build_object('elo_mode', v_mode, 'players', v_n);
end $$;
revoke all on function public.admin_delete_mix(uuid, text) from public, anon;
grant execute on function public.admin_delete_mix(uuid, text) to authenticated;

-- =====================================================================================================
-- 4. Mixes: listado único y números
-- =====================================================================================================
-- Corre con los permisos de su dueño (como live_match_list): el nombre y el puerto de SourceTV del servidor están en
-- game_servers, que el público no lee. Solo expone esas dos columnas del servidor.
create view public.mix_list as
select null::uuid as match_id, l.uid as live_uid, 'live'::text as status, l.map, l.server_id,
       coalesce(g.name, l.server_name) as server_name,
       l.score1, l.score2, null::smallint as winner_side, l.side1_name, l.side2_name,
       l.rounds_played, l.rounds_played + 1 as current_round, l.max_rounds,
       l.started_at, null::timestamptz as ended_at, coalesce(l.started_at, l.updated_at) as at,
       null::text as cancel_reason, 'none'::text as demo_status, l.stale,
       mv.player_id as mvp_player_id, mvp.nick as mvp_alias, mv.game_nick as mvp_game_nick,
       mve.elo as mvp_elo, mv.rating as mvp_rating,
       nullif(split_part(g.connect_address, ':', 1), '') as tv_host, g.tv_port,
       l.player_ids, l.search, 1 as live_rank
  from live_match_list l
  left join game_servers g on g.id = l.server_id
  left join lateral (select lp.player_id, lp.game_nick, lp.rating, lp.steam_id from live_match_players lp
                      where lp.uid = l.uid order by lp.rating desc nulls last, lp.kills desc, lp.game_nick limit 1) mv on true
  left join players mvp on mvp.id = mv.player_id
  left join player_elo mve on mve.steam_id = coalesce(mvp.steam_id, mv.steam_id)
union all
select m.id, null, m.status, m.map, m.server_id, g.name,
       m.score1, m.score2, m.winner_side, m.side1_name, m.side2_name,
       coalesce(m.score1, 0) + coalesce(m.score2, 0), null, null,
       m.starts_at, m.played_at, coalesce(m.starts_at, m.played_at),
       m.cancel_reason, m.demo_status, false,
       mv.player_id, mvp.nick, mv.nick, mve.elo, mv.rating,
       null, null,
       array(select distinct s.player_id from match_player_stats s where s.match_id = m.id and s.player_id is not null),
       search_norm(concat_ws(' ', m.side1_name, m.side2_name, m.map, g.name,
                             (select string_agg(s.nick || ' ' || coalesce(p.nick, ''), ' ')
                                from match_player_stats s left join players p on p.id = s.player_id where s.match_id = m.id))),
       0
  from matches m
  left join game_servers g on g.id = m.server_id
  left join lateral (select s.player_id, s.nick, s.rating, s.steam_id from match_player_stats s
                      where s.match_id = m.id order by s.rating desc nulls last, s.kills desc, s.nick limit 1) mv on true
  left join players mvp on mvp.id = mv.player_id
  left join player_elo mve on mve.steam_id = coalesce(mvp.steam_id, elo_key(mv.steam_id))
 where m.kind = 'mix' and m.status in ('finished', 'cancelled');
comment on view public.mix_list is 'Mixes en vivo, terminados y cancelados en un solo listado: marcador, MVP, demo y SourceTV (replanteo 27)';
revoke all on public.mix_list from anon, authenticated;
grant select on public.mix_list to anon, authenticated;

-- Números de la cabecera de Mixes: en vivo ahora y los últimos 30 días.
create view public.mix_stats with (security_invoker = true) as
with recientes as (
  select m.id, m.map, coalesce(m.score1, 0) + coalesce(m.score2, 0) as rounds from matches m
   where m.kind = 'mix' and m.status = 'finished' and coalesce(m.played_at, m.starts_at) >= now() - interval '30 days'
)
select (select count(*)::int from live_match_list l where not l.stale) as live_now,
       (select count(distinct coalesce(s.player_id::text, s.steam_id))::int
          from match_player_stats s where s.match_id in (select id from recientes)) as players_recent,
       (select r.map from recientes r where r.map is not null group by r.map order by count(*) desc, r.map limit 1) as top_map,
       (select round(avg(r.rounds), 1) from recientes r) as avg_rounds,
       30 as window_days;
comment on view public.mix_stats is 'Mixes: en vivo ahora, jugadores distintos, mapa más jugado y promedio de rondas de los últimos 30 días (replanteo 27)';
grant select on public.mix_stats to anon, authenticated;

-- =====================================================================================================
-- 5. Perfil
-- =====================================================================================================
-- ELO de cada ficha después de cada mix; n = 1 es el más reciente.
create view public.player_elo_history with (security_invoker = true) as
select s.player_id, s.match_id, m.map, coalesce(m.played_at, m.starts_at) as at,
       s.elo_before, s.elo_after, s.elo_delta,
       row_number() over (partition by s.player_id order by coalesce(m.played_at, m.starts_at) desc nulls last, s.match_id desc)::int as n
  from match_player_stats s
  join matches m on m.id = s.match_id
 where s.player_id is not null and s.elo_after is not null and m.kind = 'mix' and m.status = 'finished';
comment on view public.player_elo_history is 'ELO de cada jugador después de cada mix (n = 1 es el último): gráfico del perfil, tendencia del ranking y comparador (replanteo 27)';
grant select on public.player_elo_history to anon, authenticated;

-- Palmarés: campeón y subcampeón de cada torneo terminado, con los jugadores inscritos de cada equipo.
create view public.player_titles with (security_invoker = true) as
with fin as (
  select e.id as event_id, e.name as event_name, e.champion,
         case when f.ganador = f.team1 then f.team2 when f.ganador = f.team2 then f.team1 end as runner_up,
         coalesce(coalesce(f.played_at, f.starts_at),
                  (select max(coalesce(x.played_at, x.starts_at)) from matches x where x.event_id = e.id and x.status = 'finished')) as at
    from events e
    left join lateral (select mm.team1, mm.team2, mm.played_at, mm.starts_at,
                              coalesce(mm.winner, case mm.winner_side when 1 then mm.team1 when 2 then mm.team2 end) as ganador
                         from matches mm
                        where mm.event_id = e.id and mm.status = 'finished'
                          and coalesce(mm.winner, case mm.winner_side when 1 then mm.team1 when 2 then mm.team2 end) = e.champion
                          and mm.stage = case when e.template = 'double' then 'grand' else 'ko' end
                        order by mm.phase desc nulls last, mm.round desc nulls last limit 1) f on true
   where e.champion is not null and e.status = 'finished'
), puestos as (
  select event_id, event_name, at, champion as team_id, 'champion'::text as result from fin
  union all
  select event_id, event_name, at, runner_up, 'runner_up' from fin where runner_up is not null
)
select r.player_id, p.event_id, p.event_name, p.result, p.team_id, t.name as team_name, t.tag as team_tag, p.at
  from puestos p
  join tournament_registration_players r on r.event_id = p.event_id and r.team_id = p.team_id
  join teams t on t.id = p.team_id;
comment on view public.player_titles is 'Palmarés: torneos ganados y finales perdidas de cada jugador inscrito, con su equipo y la fecha de la final (replanteo 27)';
grant select on public.player_titles to anon, authenticated;

-- Como en la 09, con el torneo y la fase al final (de la partida o, en un mix vinculado con !match, de su partida).
create or replace view public.player_matches with (security_invoker = true) as
select s.player_id, m.id as match_id, m.kind, m.status, coalesce(m.played_at, m.starts_at) as played_at, m.map,
       m.side1_name, m.side2_name, t1.name as team1_name, t2.name as team2_name, m.score1, m.score2, m.winner_side,
       s.team as side, s.team = m.winner_side as won, m.parent_match_id,
       s.nick as game_nick, s.kills, s.deaths, s.assists, s.headshots, s.damage, s.rounds, s.rating,
       s.elo_before, s.elo_after, s.elo_delta, m.demo_status,
       -- (replanteo 27)
       ev.event_id, e.name as event_name, ev.stage, ev.phase, ev.grp, ev.round,
       (select max(x.round) from matches x
         where x.event_id = ev.event_id and x.stage = ev.stage and x.phase is not distinct from ev.phase) as last_round
  from match_player_stats s
  join matches m on m.id = s.match_id
  left join teams t1 on t1.id = m.team1
  left join teams t2 on t2.id = m.team2
  left join matches par on par.id = m.parent_match_id
  cross join lateral (select coalesce(par.event_id, m.event_id) as event_id,
                             case when par.id is null then m.stage else par.stage end as stage,
                             case when par.id is null then m.phase else par.phase end as phase,
                             case when par.id is null then m.grp else par.grp end as grp,
                             case when par.id is null then m.round else par.round end as round) ev
  left join events e on e.id = ev.event_id
 where s.player_id is not null and m.status = 'finished';

-- =====================================================================================================
-- 6. Ranking
-- =====================================================================================================
-- Jugadores con ELO y su posición global (se calcula antes de cualquier filtro).
create view public.player_ranking with (security_invoker = true) as
select o.id, o.nick, o.photo_url, o.elo, o.peak_elo, o.elo_matches, o.maps, o.rating, o.kd, o.wins, o.losses, o.teams, o.search,
       rank() over (order by o.elo desc)::int as position,
       d.country, d.game_role
  from player_overview o
  join players p on p.id = o.id
  left join profile_details d on d.user_id = p.user_id
 where o.elo is not null;
comment on view public.player_ranking is 'Ranking de jugadores por ELO con la posición global; país y puesto según la privacidad del perfil (replanteo 27)';
grant select on public.player_ranking to anon, authenticated;

-- Comparador: mixes terminados que jugaron los dos, en el mismo bando (y cuántos ganaron) o como rivales (y cuántos ganó A).
create function public.players_together(p_a uuid, p_b uuid)
  returns table(same_matches int, same_wins int, against_matches int, a_wins int)
  language sql stable set search_path = public as $$
  select count(*) filter (where a.team = b.team)::int,
         count(*) filter (where a.team = b.team and a.team = m.winner_side)::int,
         count(*) filter (where a.team <> b.team)::int,
         count(*) filter (where a.team <> b.team and a.team = m.winner_side)::int
    from match_player_stats a
    join match_player_stats b on b.match_id = a.match_id and b.player_id = p_b
    join matches m on m.id = a.match_id
   where a.player_id = p_a and p_a <> p_b and m.kind = 'mix' and m.status = 'finished'
$$;
comment on function public.players_together(uuid, uuid) is 'Mixes que jugaron dos jugadores, juntos o como rivales (replanteo 27)';
grant execute on function public.players_together(uuid, uuid) to anon, authenticated;

-- Resultados de cada equipo oficial: partidas de torneo (sin byes, huérfanas ni W.O.) y PCW jugadas como ese equipo.
-- Mismas reglas que team_standings en la 10.
create view public.team_results with (security_invoker = true) as
with oficiales as (
  -- Columnas a mano: el público no lee matches.link_code (un m.* falla con anon).
  select m.id, m.team1, m.team2, m.winner_side, m.played_at, m.starts_at from matches m
   where m.kind = 'official' and m.status = 'finished' and not coalesce(m.bye, false) and m.winner_side is not null
     and m.team1 is not null and m.team2 is not null and m.end_reason is distinct from 'walkover'
     and not (coalesce(m.stage, '') <> '' and (m.event_id is null or not exists (select 1 from events e where e.id = m.event_id)))
)
select m.team1 as team_id, m.id as match_id, 'official'::text as tipo, m.winner_side = 1 as gano, coalesce(m.played_at, m.starts_at) as at from oficiales m
union all
select m.team2, m.id, 'official', m.winner_side = 2, coalesce(m.played_at, m.starts_at) from oficiales m
union all
select s.parent_team_id, m.id, 'pcw', m.winner_side = 1, coalesce(m.played_at, m.starts_at) from matches m join teams s on s.id = m.team1
 where m.kind = 'pcw' and m.status = 'finished' and m.winner_side is not null and s.parent_team_id is not null
union all
select s.parent_team_id, m.id, 'pcw', m.winner_side = 2, coalesce(m.played_at, m.starts_at) from matches m join teams s on s.id = m.team2
 where m.kind = 'pcw' and m.status = 'finished' and m.winner_side is not null and s.parent_team_id is not null;
comment on view public.team_results is 'Cada partida que cuenta para el ranking de equipos, por equipo oficial: tipo, si ganó y fecha (replanteo 27)';
grant select on public.team_results to anon, authenticated;

-- team_standings con las partidas jugadas hasta p_at (las que no tienen fecha cuentan siempre).
create function public.team_standings_at(p_at timestamptz)
  returns table(team_id uuid, name text, tag text, official_played int, official_won int, official_lost int,
                pcw_played int, pcw_won int, pcw_lost int, official_points int, pcw_points int)
  language sql stable set search_path = public as $$
  select t.id, t.name, t.tag,
         count(j.*) filter (where j.tipo = 'official')::int,
         count(j.*) filter (where j.tipo = 'official' and j.gano)::int,
         count(j.*) filter (where j.tipo = 'official' and not j.gano)::int,
         count(j.*) filter (where j.tipo = 'pcw')::int,
         count(j.*) filter (where j.tipo = 'pcw' and j.gano)::int,
         count(j.*) filter (where j.tipo = 'pcw' and not j.gano)::int,
         (count(j.*) filter (where j.tipo = 'official' and j.gano) * c.win_official)::int,
         (count(j.*) filter (where j.tipo = 'pcw' and j.gano) * c.win_pcw)::int
    from teams t
    cross join ranking_config c
    left join team_results j on j.team_id = t.id and coalesce(j.at, '-infinity'::timestamptz) <= p_at
   where t.kind = 'official'
   group by t.id, t.name, t.tag, c.win_official, c.win_pcw
$$;
comment on function public.team_standings_at(timestamptz) is 'Ranking de equipos con las partidas jugadas hasta una fecha (replanteo 27)';
grant execute on function public.team_standings_at(timestamptz) to anon, authenticated;

-- Las mismas columnas que en la 10, ahora desde team_standings_at: una sola regla.
create or replace view public.team_standings with (security_invoker = true) as
select team_id, name, tag, official_played, official_won, official_lost, pcw_played, pcw_won, pcw_lost, official_points, pcw_points
  from team_standings_at('infinity');

-- Como en la 11, con la posición de hace 30 días (null si no había jugado en ese modo) y los últimos 5 resultados.
create or replace view public.team_ranking with (security_invoker = true) as
with antes as (
  select a.team_id,
         case when a.official_played > 0 then
           rank() over (order by a.official_points desc, a.official_won desc, a.official_lost) end::int as official_position,
         case when a.official_played + a.pcw_played > 0 then
           rank() over (order by a.official_points + a.pcw_points desc, a.official_won + a.pcw_won desc, a.official_lost + a.pcw_lost) end::int as total_position
    from team_standings_at(now() - interval '30 days') a
)
select s.team_id, s.name, s.tag, search_norm(s.name || ' ' || coalesce(s.tag, '')) as search,
       s.official_played, s.official_won, s.official_lost, s.official_points,
       s.official_played + s.pcw_played as total_played, s.official_won + s.pcw_won as total_won,
       s.official_lost + s.pcw_lost as total_lost, s.official_points + s.pcw_points as total_points,
       rank() over (order by s.official_points desc, s.official_won desc, s.official_lost)::int as official_position,
       rank() over (order by s.official_points + s.pcw_points desc, s.official_won + s.pcw_won desc, s.official_lost + s.pcw_lost)::int as total_position,
       -- (replanteo 27)
       a.official_position as official_position_prev,
       a.total_position as total_position_prev,
       array(select x.r from (select case when r.gano then 'W' else 'L' end as r, r.at, r.match_id from team_results r
                               where r.team_id = s.team_id and r.tipo = 'official'
                               order by r.at desc nulls last, r.match_id desc limit 5) x
              order by x.at nulls first, x.match_id) as form_official,
       array(select x.r from (select case when r.gano then 'W' else 'L' end as r, r.at, r.match_id from team_results r
                               where r.team_id = s.team_id
                               order by r.at desc nulls last, r.match_id desc limit 5) x
              order by x.at nulls first, x.match_id) as form_total
  from team_standings s
  left join antes a on a.team_id = s.team_id;

commit;

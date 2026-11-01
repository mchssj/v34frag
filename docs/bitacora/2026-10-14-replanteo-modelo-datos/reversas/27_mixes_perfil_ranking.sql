-- Inversa de supabase/replanteo/27_mixes_perfil_ranking.sql: deja todo como en la 26.
--   - Borra mix_list, mix_stats, player_elo_history, player_titles, player_ranking, players_together, team_results, team_standings_at,
--     admin_delete_mix, mix_deletions, el nick único y game_servers.tv_port.
--   - Vuelven a su versión anterior game_servers_public, admin_server_list, admin_create_server (20), alias_check (09),
--     player_elo_adjustment_list y admin_elo_adjustment_list (25), player_matches (09), team_standings (10) y
--     team_ranking (11).
-- Los ajustes que sostenían mixes borrados (source = 'mix_kept') quedan como ajustes comunes: siguen sosteniendo ese
-- ELO en un recálculo, pero el jugador los ve en su perfil. Los mixes borrados no vuelven.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'game_servers' and column_name = 'tv_port') then
    raise exception 'inversa 27: game_servers no tiene tv_port (¿no se aplicó la 27?)';
  end if;
end $$;

-- ---------- 6. ranking ----------
drop view public.player_ranking;
drop function public.players_together(uuid, uuid);
drop view public.team_ranking;

-- Como en la 10.
create or replace view public.team_standings with (security_invoker = true) as
with jugadas as (
  select m.team1 as team_id, m.winner_side = 1 as gano, 'official' as tipo from matches m
   where m.kind = 'official' and m.status = 'finished' and not coalesce(m.bye, false) and m.winner_side is not null
     and m.team1 is not null and m.team2 is not null and m.end_reason is distinct from 'walkover'
     and not (coalesce(m.stage, '') <> '' and (m.event_id is null or not exists (select 1 from events e where e.id = m.event_id)))
  union all
  select m.team2, m.winner_side = 2, 'official' from matches m
   where m.kind = 'official' and m.status = 'finished' and not coalesce(m.bye, false) and m.winner_side is not null
     and m.team1 is not null and m.team2 is not null and m.end_reason is distinct from 'walkover'
     and not (coalesce(m.stage, '') <> '' and (m.event_id is null or not exists (select 1 from events e where e.id = m.event_id)))
  union all
  select s.parent_team_id, m.winner_side = 1, 'pcw' from matches m join teams s on s.id = m.team1
   where m.kind = 'pcw' and m.status = 'finished' and m.winner_side is not null and s.parent_team_id is not null
  union all
  select s.parent_team_id, m.winner_side = 2, 'pcw' from matches m join teams s on s.id = m.team2
   where m.kind = 'pcw' and m.status = 'finished' and m.winner_side is not null and s.parent_team_id is not null
)
select t.id as team_id, t.name, t.tag,
       count(j.*) filter (where j.tipo = 'official')::int                 as official_played,
       count(j.*) filter (where j.tipo = 'official' and j.gano)::int      as official_won,
       count(j.*) filter (where j.tipo = 'official' and not j.gano)::int  as official_lost,
       count(j.*) filter (where j.tipo = 'pcw')::int                      as pcw_played,
       count(j.*) filter (where j.tipo = 'pcw' and j.gano)::int           as pcw_won,
       count(j.*) filter (where j.tipo = 'pcw' and not j.gano)::int       as pcw_lost,
       (count(j.*) filter (where j.tipo = 'official' and j.gano) * c.win_official)::int as official_points,
       (count(j.*) filter (where j.tipo = 'pcw' and j.gano) * c.win_pcw)::int           as pcw_points
  from teams t
  cross join ranking_config c
  left join jugadas j on j.team_id = t.id
 where t.kind = 'official'
 group by t.id, t.name, t.tag, c.win_official, c.win_pcw;

drop function public.team_standings_at(timestamptz);
drop view public.team_results;

-- Como en la 11.
create view public.team_ranking with (security_invoker = true) as
select s.team_id, s.name, s.tag, search_norm(s.name || ' ' || coalesce(s.tag, '')) as search,
       s.official_played, s.official_won, s.official_lost, s.official_points,
       s.official_played + s.pcw_played as total_played, s.official_won + s.pcw_won as total_won,
       s.official_lost + s.pcw_lost as total_lost, s.official_points + s.pcw_points as total_points,
       rank() over (order by s.official_points desc, s.official_won desc, s.official_lost)::int as official_position,
       rank() over (order by s.official_points + s.pcw_points desc, s.official_won + s.pcw_won desc, s.official_lost + s.pcw_lost)::int as total_position
  from team_standings s;
grant select on public.team_ranking to anon, authenticated;

-- ---------- 5. perfil ----------
drop view public.player_titles;
drop view public.player_elo_history;

-- Como en la 09.
drop view public.player_matches;
create view public.player_matches with (security_invoker = true) as
select s.player_id, m.id as match_id, m.kind, m.status, coalesce(m.played_at, m.starts_at) as played_at, m.map,
       m.side1_name, m.side2_name, t1.name as team1_name, t2.name as team2_name, m.score1, m.score2, m.winner_side,
       s.team as side, s.team = m.winner_side as won, m.parent_match_id,
       s.nick as game_nick, s.kills, s.deaths, s.assists, s.headshots, s.damage, s.rounds, s.rating,
       s.elo_before, s.elo_after, s.elo_delta, m.demo_status
  from match_player_stats s
  join matches m on m.id = s.match_id
  left join teams t1 on t1.id = m.team1
  left join teams t2 on t2.id = m.team2
 where s.player_id is not null and m.status = 'finished';
comment on view public.player_matches is 'Partidas terminadas de cada jugador vinculado, con sus stats y su cambio de ELO';
grant select on public.player_matches to anon, authenticated;

-- ---------- 4. mixes ----------
drop view public.mix_stats;
drop view public.mix_list;

-- ---------- 3. borrar un mix ----------
drop function public.admin_delete_mix(uuid, text);
drop table public.mix_deletions;

-- Como en la 25.
create or replace view public.player_elo_adjustment_list with (security_invoker = true) as
select a.id, x.player_id, a.delta, a.set_elo, a.reason, a.applied_at
  from elo_adjustments a
  join player_steam_all x on x.steam_id = a.steam_id;

drop view public.admin_elo_adjustment_list;
create view public.admin_elo_adjustment_list with (security_invoker = true) as
select a.id, x.player_id, p.nick, a.steam_id, a.delta, a.set_elo, a.reason, a.applied_at, a.created_by,
       pr.tag as created_by_alias, search_norm(concat_ws(' ', p.nick, a.reason, a.steam_id)) as search
  from elo_adjustments a
  left join player_steam_all x on x.steam_id = a.steam_id
  left join players p on p.id = x.player_id
  left join profiles pr on pr.id = a.created_by
 where is_admin();
comment on view public.admin_elo_adjustment_list is 'Ajustes manuales de ELO para el admin';
grant select on public.admin_elo_adjustment_list to authenticated;

alter table public.elo_adjustments drop column source;

-- ---------- 2. nick único ----------
-- Como en la 09.
create or replace function public.alias_check(p_tag text) returns text
  language plpgsql stable security definer set search_path = public as $$
declare v text := trim(coalesce(p_tag, ''));
begin
  if char_length(v) < 2 or char_length(v) > 24 then return 'length'; end if;
  if v ~ '[<>[:cntrl:]]' then return 'chars'; end if;
  if name_blocked(v) is not null then return 'blocked'; end if;
  if exists (select 1 from profiles where lower(trim(tag)) = lower(v) and id is distinct from auth.uid()) then return 'taken'; end if;
  return 'ok';
end $$;

drop trigger players_nick_unico on public.players;
drop function public.players_nick_unico();
drop index public.players_nick_unico;

-- ---------- 1. puerto de SourceTV ----------
-- Como en la 20.
drop function public.admin_create_server(text, text, text, timestamptz, text, text, text, integer);
create function public.admin_create_server(p_name text, p_connect_address text default null, p_panel_server_id text default null,
                                           p_license_expires_at timestamptz default null, p_allowed_ip text default null,
                                           p_mode text default null, p_region text default null)
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
  insert into game_servers(name, token_hash, connect_address, panel_server_id, license_expires_at, allowed_ip, mode, region)
  values (trim(p_name), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), nullif(trim(p_connect_address), ''),
          nullif(trim(p_panel_server_id), ''), p_license_expires_at, nullif(trim(p_allowed_ip), ''),
          nullif(trim(p_mode), ''), nullif(trim(p_region), ''))
  returning game_servers.id into v_id;
  return query select v_id, v_token;
end $$;
revoke all on function public.admin_create_server(text, text, text, timestamptz, text, text, text) from public, anon;
grant execute on function public.admin_create_server(text, text, text, timestamptz, text, text, text) to authenticated;

drop view public.admin_server_list;
create view public.admin_server_list with (security_invoker = true) as
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
       g.mode, g.region
  from game_servers g;

drop view public.game_servers_public;
create view public.game_servers_public as
select id, name, connect_address, mode, region from game_servers
 where active and (license_expires_at is null or license_expires_at > now()); -- (replanteo 12)

alter table public.game_servers drop column tv_port;

commit;

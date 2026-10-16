-- Replanteo 11: vistas para listados con paginación, filtros y orden en el servidor
-- (plan docs/bitacora/2026-10-15-get-paginacion-filtros). Solo lectura: no cambia datos ni reglas.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.map_pool') is null then
    raise exception 'replanteo 11: falta map_pool (aplicar antes 10_partidas_torneos.sql)';
  end if;
  if to_regclass('public.match_list') is not null then
    raise exception 'replanteo 11: match_list ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- Partidas para listar: nombres de equipos y torneo, búsqueda, jugadores que jugaron (para filtrar por
-- jugador), última ronda de su etapa (para el nombre de la fase) y orden de la llave. Sin link_code.
create view public.match_list with (security_invoker = true) as
select m.id, m.kind, m.status, m.event_id, e.name as event_name, m.stage, m.phase, m.grp, m.round, m.pos, m.bye,
       m.best_of, m.map, m.starts_at, m.played_at, coalesce(m.played_at, m.starts_at) as at, m.score1, m.score2, m.winner_side, m.side1_name, m.side2_name,
       m.team1 as team1_id, t1.name as team1_name, t1.tag as team1_tag,
       m.team2 as team2_id, t2.name as team2_name, t2.tag as team2_tag,
       m.end_reason, m.demo_status, m.parent_match_id,
       max(m.round) over (partition by m.event_id, m.stage, m.phase) as last_round,
       case m.stage when 'swiss' then 0 when 'group' then 0 when 'upper' then 1 when 'ko' then 1 when 'lower' then 2
                    when 'third' then 3 when 'grand' then 4 end as stage_order,
       search_norm(concat_ws(' ', t1.name, t1.tag, t2.name, t2.tag, m.side1_name, m.side2_name, e.name)) as search,
       array(select distinct s.player_id from match_player_stats s
              where s.player_id is not null
                and (s.match_id = m.id or s.match_id in (select c.id from matches c where c.parent_match_id = m.id))) as player_ids
  from matches m
  left join teams t1 on t1.id = m.team1
  left join teams t2 on t2.id = m.team2
  left join events e on e.id = m.event_id;
comment on view public.match_list is 'Listado de partidas: nombres, búsqueda, jugadores, última ronda de la etapa y orden de llave';
grant select on public.match_list to anon, authenticated;

-- Torneos para listar: equipos inscritos, campeón, alias del organizador y búsqueda.
create view public.event_list with (security_invoker = true) as
select e.id, e.name, e.template, e.status, e.starts_on, e.ends_on, e.prize, e.max_teams, e.organizer_id,
       (select p.nick from players p where p.user_id = e.organizer_id) as organizer_alias,
       e.champion as champion_id, c.name as champion_name, c.tag as champion_tag,
       (select count(*) from tournament_registrations r where r.event_id = e.id)::int as teams,
       search_norm(e.name) as search
  from events e left join teams c on c.id = e.champion;
grant select on public.event_list to anon, authenticated;

-- Inscritos de un torneo con su siembra (posición en events.seeds; si no está, por orden de inscripción).
create view public.event_registrations_view with (security_invoker = true) as
select r.event_id, r.team_id, t.name, t.tag, r.start_stage, r.created_at,
       row_number() over (partition by r.event_id
                          order by coalesce(array_position(e.seeds, r.team_id), 1000), r.created_at, t.name)::int as seed,
       (select count(*) from tournament_registration_players p where p.event_id = r.event_id and p.team_id = r.team_id)::int as players,
       search_norm(t.name || ' ' || coalesce(t.tag, '')) as search
  from tournament_registrations r
  join teams t on t.id = r.team_id
  join events e on e.id = r.event_id;
grant select on public.event_registrations_view to anon, authenticated;

-- Tablas de grupos y del suizo con la posición que calcula la base.
create view public.event_standings with (security_invoker = true) as
select s.event_id, 'group'::text as stage, s.grp, 1 as phase, s.team_id, t.name, t.tag, o.place, o.tied,
       s.played, s.won, s.lost, s.points, s.rounds_for, s.rounds_against, s.rounds_diff,
       null::int as wins, null::int as losses, null::int as buchholz, null::text as state
  from event_group_standings s
  join lateral event_group_order(s.event_id, s.grp) o on o.team_id = s.team_id
  join teams t on t.id = s.team_id
union all
select w.event_id, 'swiss', 1, w.phase, w.team_id, t.name, t.tag,
       row_number() over (partition by w.event_id, w.phase order by w.wins desc, w.losses, w.buchholz desc, w.rounds_diff desc, w.seed)::int,
       false, w.wins + w.losses, w.wins, w.losses, null, null, null, w.rounds_diff,
       w.wins, w.losses, w.buchholz, w.state
  from event_swiss_standings w
  join teams t on t.id = w.team_id;
grant select on public.event_standings to anon, authenticated;

-- Ranking de equipos con la posición de cada modo (solo torneos, o torneos más PCW jugadas como el equipo).
create view public.team_ranking with (security_invoker = true) as
select s.team_id, s.name, s.tag, search_norm(s.name || ' ' || coalesce(s.tag, '')) as search,
       s.official_played, s.official_won, s.official_lost, s.official_points,
       s.official_played + s.pcw_played as total_played, s.official_won + s.pcw_won as total_won,
       s.official_lost + s.pcw_lost as total_lost, s.official_points + s.pcw_points as total_points,
       rank() over (order by s.official_points desc, s.official_won desc, s.official_lost)::int as official_position,
       rank() over (order by s.official_points + s.pcw_points desc, s.official_won + s.pcw_won desc, s.official_lost + s.pcw_lost)::int as total_position
  from team_standings s;
grant select on public.team_ranking to anon, authenticated;

-- Planteles (activos y pasados) con alias, ELO y equipo, para el equipo y para el historial del jugador.
create view public.team_members_view with (security_invoker = true) as
select tm.team_id, t.name as team_name, t.tag as team_tag, t.kind as team_kind, tm.player_id, p.nick as alias, p.photo_url,
       p.steam_id is not null as has_steam, e.elo, tm.role, tm.joined_at, tm.left_at, tm.left_at is null as active,
       (p.user_id is not null and p.user_id = t.captain_id and tm.left_at is null) as is_captain
  from team_members tm
  join players p on p.id = tm.player_id
  join teams t on t.id = tm.team_id
  left join player_elo e on e.steam_id = p.steam_id;
grant select on public.team_members_view to anon, authenticated;

-- Anuncios de PCW con el bando, el equipo con el que juega y el alias de quien publicó.
create view public.pcw_post_list with (security_invoker = true) as
select po.id, po.by_user, (select p.nick from players p where p.user_id = po.by_user) as by_alias,
       po.best_of, po.maps, po.starts_at, po.note, po.status, po.match_id, po.created_at,
       po.team_id, s.name as side_name, s.parent_team_id, pt.name as parent_name, pt.tag as parent_tag,
       search_norm(concat_ws(' ', s.name, pt.name, pt.tag)) as search
  from pcw_posts po
  join teams s on s.id = po.team_id
  left join teams pt on pt.id = s.parent_team_id;
grant select on public.pcw_post_list to anon, authenticated;

-- Para el admin (profiles solo deja leer el propio): la vista corre como su dueño y filtra por is_admin().
create view public.admin_user_list as
select pr.id, pr.tag as alias, pr.role, pr.tag_changed_at as alias_changed_at, p.id as player_id, p.steam_id,
       p.id is not null as has_player, p.steam_id is not null as has_steam, search_norm(pr.tag) as search
  from profiles pr left join players p on p.user_id = pr.id
 where is_admin();
grant select on public.admin_user_list to authenticated;

create view public.admin_team_requests as
select r.user_id, pr.tag as alias, exists (select 1 from players p where p.user_id = r.user_id and p.steam_id is not null) as has_steam,
       r.name, r.tag, r.status, case r.status when 'pending' then 0 else 1 end as status_order,
       search_norm(concat_ws(' ', r.name, r.tag, pr.tag)) as search
  from team_requests r left join profiles pr on pr.id = r.user_id
 where is_admin();
grant select on public.admin_team_requests to authenticated;

commit;

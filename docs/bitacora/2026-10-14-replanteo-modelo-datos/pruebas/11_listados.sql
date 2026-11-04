-- Pruebas de supabase/replanteo/11_listados.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '{"role":"anon"}'
         else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
grant execute on function pg_temp.como(text) to anon, authenticated;

-- Cuatro equipos de 5 jugadores con SteamID; un admin y un usuario común.
insert into public.teams(id, name, tag, kind)
  select ('eeeeeeee-1100-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'L' || i, 'L' || i, 'official' from generate_series(1, 4) i;
insert into public.players(id, nick, steam_id)
  select ('dddddddd-1100-4000-8000-' || lpad((i * 10 + j)::text, 12, '0'))::uuid, 'L' || i || 'p' || j, '7656119811' || lpad((i * 10 + j)::text, 7, '0')
    from generate_series(1, 4) i, generate_series(1, 5) j;
insert into public.team_members(team_id, player_id, joined_at)
  select ('eeeeeeee-1100-4000-8000-' || lpad(i::text, 12, '0'))::uuid, ('dddddddd-1100-4000-8000-' || lpad((i * 10 + j)::text, 12, '0'))::uuid, now()
    from generate_series(1, 4) i, generate_series(1, 5) j;
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-1100-4000-8000-0000000000ad', 'admin11@test.local', '{"tag":"Admin11"}'),
  ('aaaaaaaa-1100-4000-8000-000000000001', 'u11@test.local', '{"tag":"Usuario11"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-1100-4000-8000-0000000000ad';
update public.players set user_id = 'aaaaaaaa-1100-4000-8000-000000000001' where id = 'dddddddd-1100-4000-8000-000000000011';
update public.teams set captain_id = 'aaaaaaaa-1100-4000-8000-000000000001' where id = 'eeeeeeee-1100-4000-8000-000000000001';
insert into public.team_requests(user_id, name, tag) values ('aaaaaaaa-1100-4000-8000-000000000001', 'Pedido', 'PED');

-- Torneo de grupos (1 grupo de 4, clasifica 1) con los equipos 1 a 4, sembrados al revés.
insert into public.events(id, name, template, config, seeds) values ('ffffffff-1100-4000-8000-000000000001', 'Liga 11', 'groups', '{"groups":1,"advance":1}',
  array['eeeeeeee-1100-4000-8000-000000000004', 'eeeeeeee-1100-4000-8000-000000000003']::uuid[]);
insert into public.tournament_registrations(event_id, team_id)
  select 'ffffffff-1100-4000-8000-000000000001', ('eeeeeeee-1100-4000-8000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 4) i;
insert into public.tournament_registration_players(event_id, team_id, player_id)
  select 'ffffffff-1100-4000-8000-000000000001', ('eeeeeeee-1100-4000-8000-' || lpad(i::text, 12, '0'))::uuid, ('dddddddd-1100-4000-8000-' || lpad((i * 10 + j)::text, 12, '0'))::uuid
    from generate_series(1, 4) i, generate_series(1, 5) j;
select pg_temp.como('aaaaaaaa-1100-4000-8000-0000000000ad');
select public.event_generate('ffffffff-1100-4000-8000-000000000001');
select set_config('v34.engine', '', true);

-- Una partida jugada con un mix vinculado (para player_ids).
do $$
declare m record; g uuid;
begin
  select * into m from public.matches where event_id = 'ffffffff-1100-4000-8000-000000000001' order by round, pos limit 1;
  insert into public.matches(kind, status, side1_name, side2_name, parent_match_id, parent_side1)
    values ('mix', 'finished', 'a', 'b', m.id, 1) returning id into g;
  insert into public.match_player_stats(match_id, steam_id, player_id, team, nick, rounds)
    values (g, '76561198110000011', 'dddddddd-1100-4000-8000-000000000011', 1, 'x', 10);
end $$;

do $$
declare ev uuid := 'ffffffff-1100-4000-8000-000000000001';
begin
  -- event_registrations_view: E4 y E3 primero (siembra), después por orden de inscripción y nombre.
  assert (select array_agg(name order by seed) from public.event_registrations_view where event_id = ev) = '{L4,L3,L1,L2}', 'siembra';
  assert (select bool_and(players = 5) from public.event_registrations_view where event_id = ev), 'jugadores inscritos';
  -- match_list: 6 partidas de grupo, con nombres, búsqueda, orden de llave y última ronda.
  assert (select count(*) from public.match_list where event_id = ev) = 6, 'partidas';
  assert (select bool_and(stage_order = 0 and last_round = 3 and event_name = 'Liga 11') from public.match_list where event_id = ev), 'stage_order y last_round';
  assert exists (select 1 from public.match_list where event_id = ev and search like '%l4%' and search like '%liga 11%'), 'search';
  assert exists (select 1 from public.match_list where event_id = ev and 'dddddddd-1100-4000-8000-000000000011' = any(player_ids)), 'player_ids por el mix vinculado';
  -- event_list
  assert (select (teams, template) = (4, 'groups'::text) and organizer_alias is null from public.event_list where id = ev), 'event_list';
  -- event_standings: 4 filas con posición 1 a 4.
  assert (select array_agg(place order by place) from public.event_standings where event_id = ev) = '{1,2,3,4}', 'posiciones';
  -- team_members_view: el capitán marcado; el historial por jugador.
  assert (select is_captain from public.team_members_view where player_id = 'dddddddd-1100-4000-8000-000000000011'), 'is_captain';
  assert (select count(*) from public.team_members_view where team_id = 'eeeeeeee-1100-4000-8000-000000000001' and active) = 5, 'plantel';
  -- team_ranking: sin partidas, los cuatro empatados en la misma posición.
  assert (select count(distinct official_position) = 1 and count(distinct total_position) = 1 from public.team_ranking
           where team_id in (select id from public.teams where name ~ '^L[1-4]$')), 'ranking sin partidas';
end $$;

-- El ranking ordena por puntos: L1 le gana a L2 en una partida oficial suelta.
insert into public.matches(team1, team2, kind, status, best_of, winner) values
  ('eeeeeeee-1100-4000-8000-000000000001', 'eeeeeeee-1100-4000-8000-000000000002', 'official', 'finished', 1, 'eeeeeeee-1100-4000-8000-000000000001');
do $$
begin
  assert (select official_position from public.team_ranking where team_id = 'eeeeeeee-1100-4000-8000-000000000001')
       < (select official_position from public.team_ranking where team_id = 'eeeeeeee-1100-4000-8000-000000000003'), 'L1 antes que L3 (ganó)';
  assert (select official_position from public.team_ranking where team_id = 'eeeeeeee-1100-4000-8000-000000000002')
       > (select official_position from public.team_ranking where team_id = 'eeeeeeee-1100-4000-8000-000000000003'), 'L2 último (perdió)';
end $$;

-- Vistas de admin: vacías para un usuario común, completas para el admin.
set local role authenticated;
select pg_temp.como('aaaaaaaa-1100-4000-8000-000000000001');
do $$
begin
  assert (select count(*) from public.admin_user_list) = 0, 'un usuario común ve usuarios';
  assert (select count(*) from public.admin_team_requests) = 0, 'un usuario común ve solicitudes';
end $$;
select pg_temp.como('aaaaaaaa-1100-4000-8000-0000000000ad');
do $$
begin
  assert (select (alias, has_player, has_steam) = ('Usuario11'::text, true, true) from public.admin_user_list where id = 'aaaaaaaa-1100-4000-8000-000000000001'), 'admin_user_list';
  assert (select (alias, has_steam, status_order) = ('Usuario11'::text, true, 0) from public.admin_team_requests where user_id = 'aaaaaaaa-1100-4000-8000-000000000001'), 'admin_team_requests';
end $$;
reset role;
set local role anon;
select pg_temp.como(null);
do $$
begin
  assert (select count(*) from public.match_list where event_id = 'ffffffff-1100-4000-8000-000000000001') = 6, 'anon lee match_list';
  raise notice '11: vistas de listados OK';
end $$;
reset role;

rollback;

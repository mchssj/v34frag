-- Pruebas de supabase/replanteo/39_pendientes_frontend.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
-- SQLSTATE y detail del error de una sentencia, o null si no falla.
create function pg_temp.estado(q text) returns text language plpgsql as $$
declare s text; d text;
begin
  execute q;
  return null;
exception when others then
  get stacked diagnostics s = returned_sqlstate, d = pg_exception_detail;
  return s || coalesce(' ' || nullif(d, ''), '');
end $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119839' || lpad(n::text, 7, '0') $$;
create function pg_temp.avisos(u text, t text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = u::uuid and type = t $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.estado(text), pg_temp.s(int), pg_temp.avisos(text, text)
  to authenticated, anon;

-- Cuentas: admin (ad), capitán (c0), jugadores 1 y 2 con ficha y SteamID, y 3 sin ficha.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3900-4000-8000-0000000000ad', 'admin39@test.local', '{"tag":"Admin39"}', 'x'),
  ('aaaaaaaa-3900-4000-8000-0000000000c0', 'cap39@test.local', '{"tag":"Cap39"}', 'x'),
  ('aaaaaaaa-3900-4000-8000-000000000001', 'u1-39@test.local', '{"tag":"Uno39"}', 'x'),
  ('aaaaaaaa-3900-4000-8000-000000000002', 'u2-39@test.local', '{"tag":"Dos39"}', 'x'),
  ('aaaaaaaa-3900-4000-8000-000000000003', 'u3-39@test.local', '{"tag":"Tres39"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-3900-4000-8000-0000000000ad';
insert into public.players(id, nick, steam_id, user_id) values
  ('dddddddd-3900-4000-8000-0000000000c0', 'Cap39', pg_temp.s(0), 'aaaaaaaa-3900-4000-8000-0000000000c0'),
  ('dddddddd-3900-4000-8000-000000000001', 'Uno39', pg_temp.s(1), 'aaaaaaaa-3900-4000-8000-000000000001'),
  ('dddddddd-3900-4000-8000-000000000002', 'Dos39', pg_temp.s(2), 'aaaaaaaa-3900-4000-8000-000000000002');
insert into public.blocked_words(word) values ('malapalabra');

-- =====================================================================================================
-- 1. Solicitud de equipo nuevo (E9)
-- =====================================================================================================
set local role authenticated;
select pg_temp.como('aaaaaaaa-3900-4000-8000-000000000001');
select pg_temp.ok(pg_temp.estado('select public.cancel_team_request()') = 'P0002', 'cancelar sin solicitud: P0002 (404)');
insert into public.team_requests(user_id, name, tag, status, logo_url, reject_reason)
  values ('aaaaaaaa-3900-4000-8000-000000000001', 'Pedido39', 'P39', 'pending', 'http://x/logo.png', 'colado');
select pg_temp.ok((select created_at is not null and reject_reason is null from public.team_requests
                    where user_id = 'aaaaaaaa-3900-4000-8000-000000000001'), 'al enviarla: fecha puesta y sin motivo');

select pg_temp.como('aaaaaaaa-3900-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.estado($q$select public.reject_team_request('aaaaaaaa-3900-4000-8000-000000000001', repeat('x', 301))$q$) = 'P0001',
                  'motivo de más de 300: rechazado');
select public.reject_team_request('aaaaaaaa-3900-4000-8000-000000000001', '  Nombre repetido  ');
select pg_temp.ok((select status = 'rejected' and reject_reason = 'Nombre repetido' from public.team_requests
                    where user_id = 'aaaaaaaa-3900-4000-8000-000000000001'), 'rechazo con motivo (sin espacios de más)');

select pg_temp.como('aaaaaaaa-3900-4000-8000-000000000001');
select pg_temp.ok(pg_temp.estado('select public.cancel_team_request()') = 'V3901', 'cancelar una rechazada: V3901 (409)');
update public.team_requests set name = 'Pedido39b', status = 'pending' where user_id = 'aaaaaaaa-3900-4000-8000-000000000001';
select pg_temp.ok((select reject_reason is null and status = 'pending' from public.team_requests
                    where user_id = 'aaaaaaaa-3900-4000-8000-000000000001'), 'volver a enviarla borra el motivo');
select pg_temp.ok(public.cancel_team_request() = 'http://x/logo.png', 'cancelar la pendiente devuelve su logo');
select pg_temp.ok(not exists (select 1 from public.team_requests where user_id = 'aaaaaaaa-3900-4000-8000-000000000001'),
                  'la solicitud se borró');
select pg_temp.como('aaaaaaaa-3900-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.estado($q$select public.reject_team_request('aaaaaaaa-3900-4000-8000-000000000001')$q$) = 'P0001',
                  'rechazar sin solicitud pendiente: error');

-- =====================================================================================================
-- 2. Biografía (E12)
-- =====================================================================================================
select pg_temp.como('aaaaaaaa-3900-4000-8000-000000000003');
select pg_temp.ok(pg_temp.estado($q$select public.set_my_bio('hola')$q$) = 'V3901', 'sin ficha: V3901 (409)');
select pg_temp.como('aaaaaaaa-3900-4000-8000-000000000001');
select pg_temp.ok(public.set_my_bio(E'  AWPer de Rosario.\r\nBusco equipo.  ') = E'AWPer de Rosario.\nBusco equipo.', 'guarda sin espacios de más y con salto de línea');
select pg_temp.ok((select bio = E'AWPer de Rosario.\nBusco equipo.' from public.players where id = 'dddddddd-3900-4000-8000-000000000001'),
                  'queda en la ficha');
select pg_temp.ok(pg_temp.estado($q$select public.set_my_bio(repeat('a', 501))$q$) = 'P0001', 'más de 500: rechazada');
select pg_temp.ok(pg_temp.estado($q$select public.set_my_bio('soy una malapalabra')$q$) = 'P0001', 'palabra bloqueada: rechazada');
select pg_temp.ok(pg_temp.estado($q$select public.set_my_bio('una mala palabra suelta')$q$) is null, 'palabras sueltas que juntas forman una bloqueada: pasa');
select pg_temp.ok(pg_temp.estado($q$select public.set_my_bio(E'con\ttab')$q$) = 'P0001', 'caracteres de control: rechazada');
select pg_temp.ok(public.set_my_bio('') is null, 'vacía devuelve null');
select pg_temp.ok((select bio is null from public.players where id = 'dddddddd-3900-4000-8000-000000000001'), 'vacía la borra');

-- =====================================================================================================
-- 3. Equipos: nombre y sigla (E11) y disolver (E10)
-- =====================================================================================================
reset role;
insert into public.teams(id, name, tag, kind, owner_id, captain_id) values
  ('eeeeeeee-3900-4000-8000-000000000001', 'Furia39', 'FUR', 'official', 'aaaaaaaa-3900-4000-8000-0000000000c0', 'aaaaaaaa-3900-4000-8000-0000000000c0'),
  ('eeeeeeee-3900-4000-8000-000000000002', 'Otro39', 'OTR', 'official', null, null);
insert into public.team_members(team_id, player_id, joined_at) values
  ('eeeeeeee-3900-4000-8000-000000000001', 'dddddddd-3900-4000-8000-0000000000c0', now() - interval '10 days'),
  ('eeeeeeee-3900-4000-8000-000000000001', 'dddddddd-3900-4000-8000-000000000001', now() - interval '5 days');
insert into public.team_invites(team_id, player_id, kind, created_by) values
  ('eeeeeeee-3900-4000-8000-000000000001', 'dddddddd-3900-4000-8000-000000000002', 'invite', 'aaaaaaaa-3900-4000-8000-0000000000c0');
set local role authenticated;

select pg_temp.como('aaaaaaaa-3900-4000-8000-000000000001');
select pg_temp.ok(pg_temp.estado($q$select public.team_rename('eeeeeeee-3900-4000-8000-000000000001', 'Nuevo39', 'N39')$q$) = '42501',
                  'un miembro que no es capitán no cambia el nombre');
select pg_temp.como('aaaaaaaa-3900-4000-8000-0000000000c0');
select pg_temp.ok(pg_temp.estado($q$select public.team_rename('eeeeeeee-3900-4000-8000-000000000001', 'otro39', 'N39')$q$) = 'V3901',
                  'nombre de otro equipo activo (sin distinguir mayúsculas): V3901');
select pg_temp.ok(pg_temp.estado($q$select public.team_rename('eeeeeeee-3900-4000-8000-000000000001', 'Nuevo39', 'otr')$q$) = 'V3901',
                  'sigla de otro equipo activo: V3901');
select pg_temp.ok(pg_temp.estado($q$select public.team_rename('eeeeeeee-3900-4000-8000-000000000001', 'N', 'N39')$q$) = 'P0001',
                  'nombre de 1 caracter: rechazado');
select pg_temp.ok(pg_temp.estado($q$select public.team_rename('eeeeeeee-3900-4000-8000-000000000001', 'Nueva malapalabra', 'N39')$q$) = 'P0001',
                  'palabra bloqueada en el nombre: rechazado');
select public.team_rename('eeeeeeee-3900-4000-8000-000000000001', '  Nuevo39 ', 'n39');
select pg_temp.ok((select name = 'Nuevo39' and tag = 'N39' and name_changed_at is not null from public.teams
                    where id = 'eeeeeeee-3900-4000-8000-000000000001'), 'el capitán cambia nombre y sigla (sigla en mayúsculas)');
select pg_temp.ok(pg_temp.estado($q$select public.team_rename('eeeeeeee-3900-4000-8000-000000000001', 'Nuevo39', 'N39')$q$) is null,
                  'sin cambios: no cuenta como cambio ni pide esperar');
select pg_temp.ok(pg_temp.estado($q$select public.team_rename('eeeeeeee-3900-4000-8000-000000000001', 'Otra vez39', 'N39')$q$)
                    like 'V3901 {"next_change_at": %', 'segundo cambio antes de 30 días: V3901 con next_change_at');
select pg_temp.como('aaaaaaaa-3900-4000-8000-0000000000ad');
select public.team_rename('eeeeeeee-3900-4000-8000-000000000001', 'Admin39 Team', 'ADM');
select pg_temp.ok((select name = 'Admin39 Team' and name_changed_at > now() - interval '1 minute' from public.teams
                    where id = 'eeeeeeee-3900-4000-8000-000000000001'), 'el admin no espera y no reinicia la espera');

-- Disolver
select pg_temp.como('aaaaaaaa-3900-4000-8000-000000000001');
select pg_temp.ok(pg_temp.estado($q$select public.team_dissolve('eeeeeeee-3900-4000-8000-000000000001')$q$) = '42501',
                  'un miembro que no es capitán no lo disuelve');
reset role;
select pg_temp.como('aaaaaaaa-3900-4000-8000-0000000000ad');
insert into public.events(id, name, template, game_mode) values ('ffffffff-3900-4000-8000-000000000001', 'Copa39', 'single', '2v2');
insert into public.tournament_registrations(event_id, team_id) values ('ffffffff-3900-4000-8000-000000000001', 'eeeeeeee-3900-4000-8000-000000000001');
set local role authenticated;
select pg_temp.como('aaaaaaaa-3900-4000-8000-0000000000c0');
select pg_temp.ok(pg_temp.estado($q$select public.team_dissolve('eeeeeeee-3900-4000-8000-000000000001')$q$) = 'V3901',
                  'inscrito en un torneo con inscripciones abiertas: V3901');
reset role;
delete from public.tournament_registrations where event_id = 'ffffffff-3900-4000-8000-000000000001';
set local role authenticated;
select pg_temp.como('aaaaaaaa-3900-4000-8000-0000000000c0');
select public.team_dissolve('eeeeeeee-3900-4000-8000-000000000001');
reset role;
select pg_temp.ok((select dissolved_at is not null and dissolved_by = 'aaaaaaaa-3900-4000-8000-0000000000c0' from public.teams
                    where id = 'eeeeeeee-3900-4000-8000-000000000001'), 'queda disuelto, con quién lo hizo');
select pg_temp.ok(not exists (select 1 from public.team_members where team_id = 'eeeeeeee-3900-4000-8000-000000000001' and left_at is null),
                  'todos pasan a ex integrantes (también el capitán)');
select pg_temp.ok((select status = 'cancelled' from public.team_invites where team_id = 'eeeeeeee-3900-4000-8000-000000000001'),
                  'la invitación abierta se cancela');
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-3900-4000-8000-000000000001', 'team_dissolved') = 1, 'el miembro recibe team_dissolved');
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-3900-4000-8000-000000000001', 'team_removed') = 0, 'y no recibe team_removed');
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-3900-4000-8000-0000000000c0', 'team_dissolved') = 0, 'el que lo disolvió no se avisa a sí mismo');
select pg_temp.ok((select dissolved_at is not null from public.team_overview where id = 'eeeeeeee-3900-4000-8000-000000000001'),
                  'team_overview trae dissolved_at');
select pg_temp.ok(not exists (select 1 from public.team_ranking where team_id = 'eeeeeeee-3900-4000-8000-000000000001'),
                  'no sale en el ranking');
select pg_temp.ok(exists (select 1 from public.team_ranking where team_id = 'eeeeeeee-3900-4000-8000-000000000002'),
                  'los activos siguen en el ranking');
select pg_temp.ok(exists (select 1 from public.team_standings where team_id = 'eeeeeeee-3900-4000-8000-000000000001'),
                  'conserva su récord (team_standings)');
select pg_temp.ok(pg_temp.estado($q$insert into public.team_members(team_id, player_id, joined_at)
                                    values ('eeeeeeee-3900-4000-8000-000000000001', 'dddddddd-3900-4000-8000-000000000002', now())$q$) = 'V3901',
                  'no suma miembros');
select pg_temp.ok(pg_temp.estado($q$insert into public.team_invites(team_id, player_id, kind)
                                    values ('eeeeeeee-3900-4000-8000-000000000001', 'dddddddd-3900-4000-8000-000000000002', 'invite')$q$) = 'V3901',
                  'no invita');
select pg_temp.ok(pg_temp.estado($q$insert into public.tournament_registrations(event_id, team_id)
                                    values ('ffffffff-3900-4000-8000-000000000001', 'eeeeeeee-3900-4000-8000-000000000001')$q$) = 'V3901',
                  'no se inscribe');
set local role authenticated;
select pg_temp.como('aaaaaaaa-3900-4000-8000-0000000000c0');
select pg_temp.ok(pg_temp.estado($q$select public.team_update('eeeeeeee-3900-4000-8000-000000000001', array['player'])$q$) = 'V3901',
                  'no se edita lo que busca');
select pg_temp.ok(pg_temp.estado($q$select public.team_rename('eeeeeeee-3900-4000-8000-000000000001', 'Vuelta39', 'VUE')$q$) = 'V3901',
                  'no cambia de nombre');
select pg_temp.ok(pg_temp.estado($q$select public.team_dissolve('eeeeeeee-3900-4000-8000-000000000001')$q$) = 'V3901',
                  'disolverlo de nuevo: V3901');
select pg_temp.ok(pg_temp.estado($q$select public.team_dissolve('eeeeeeee-3900-4000-8000-0000000000ff')$q$) = 'P0002',
                  'equipo que no existe: P0002 (404)');
-- Su nombre queda libre para otro equipo.
select pg_temp.como('aaaaaaaa-3900-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.estado($q$select public.team_rename('eeeeeeee-3900-4000-8000-000000000002', 'Admin39 Team', 'ADM')$q$) is null,
                  'el nombre y la sigla de un disuelto se pueden usar');

-- =====================================================================================================
-- 4. Vistas: nick en match_list (E18) y temporadas (E20)
-- =====================================================================================================
reset role;
insert into public.matches(id, kind, status, side1_name, side2_name, played_at) values
  ('cccccccc-3900-4000-8000-000000000001', 'mix', 'finished', 'CT', 'T', now());
insert into public.match_player_stats(match_id, steam_id, team, nick, kills, deaths, rounds, player_id) values
  ('cccccccc-3900-4000-8000-000000000001', pg_temp.s(2), 1, 'ZetaEnJuego', 20, 10, 24, 'dddddddd-3900-4000-8000-000000000002');
select pg_temp.ok((select player_search like '%zetaenjuego%' and player_search like '%dos39%' from public.match_list
                    where id = 'cccccccc-3900-4000-8000-000000000001'), 'match_list.player_search con nombre en el juego y alias');

insert into public.seasons(id, number, name, status, starts_at, ends_at, closed_at, top_n, min_matches, reset_pct, reset_floor, tiers)
  select 'bbbbbbbb-3900-4000-8000-000000000001', 9039, 'T39', 'closed', '2020-01-01 12:00+00', '2020-01-05 12:00+00', '2020-01-05 12:00+00',
         20, 1, 50, 900, tiers from public.season_config;
insert into public.season_standings(season_id, player_id, rank, eligible, elo, peak_elo, matches, wins, losses, elo_after) values
  ('bbbbbbbb-3900-4000-8000-000000000001', 'dddddddd-3900-4000-8000-000000000001', 1, true, 1500, 1500, 5, 4, 1, 1500),
  ('bbbbbbbb-3900-4000-8000-000000000001', 'dddddddd-3900-4000-8000-000000000002', 2, true, 1400, 1400, 5, 3, 2, 1400),
  ('bbbbbbbb-3900-4000-8000-000000000001', 'dddddddd-3900-4000-8000-0000000000c0', null, false, 1000, 1000, 0, 0, 0, 1000);
select pg_temp.ok((select ended_at = '2020-01-05 12:00+00' and players = 2 from public.player_season_list
                    where season_id = 'bbbbbbbb-3900-4000-8000-000000000001' and player_id = 'dddddddd-3900-4000-8000-000000000001'),
                  'player_season_list: cierre y jugadores con puesto (sin los que no llegaron al mínimo)');

rollback;

-- Pruebas de supabase/replanteo/33_equipo_torneos.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
-- Mensaje del error de una sentencia, o null si no falla.
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
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
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119833' || lpad(n::text, 7, '0') $$;
create function pg_temp.avisos(u text, t text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = u::uuid and type = t $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.error(text), pg_temp.estado(text), pg_temp.s(int),
  pg_temp.avisos(text, text) to authenticated, anon;

-- Cuentas: admin (ad), organizador (0o), capitán (c0) y jugadores 1 a 6, todos con ficha y SteamID.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3300-4000-8000-0000000000ad', 'admin33@test.local', '{"tag":"Admin33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-00000000000f', 'org33@test.local', '{"tag":"Org33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-0000000000c0', 'cap33@test.local', '{"tag":"Cap33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000001', 'u1-33@test.local', '{"tag":"Uno33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000002', 'u2-33@test.local', '{"tag":"Dos33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000003', 'u3-33@test.local', '{"tag":"Tres33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000004', 'u4-33@test.local', '{"tag":"Cuatro33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000005', 'u5-33@test.local', '{"tag":"Cinco33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000006', 'u6-33@test.local', '{"tag":"Seis33"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-3300-4000-8000-0000000000ad';
update public.profiles set role = 'organizer' where id = 'aaaaaaaa-3300-4000-8000-00000000000f';
insert into public.players(id, nick, user_id, steam_id) values
  ('dddddddd-3300-4000-8000-0000000000c0', 'Cap33', 'aaaaaaaa-3300-4000-8000-0000000000c0', pg_temp.s(100)),
  ('dddddddd-3300-4000-8000-000000000001', 'Uno33', 'aaaaaaaa-3300-4000-8000-000000000001', pg_temp.s(1)),
  ('dddddddd-3300-4000-8000-000000000002', 'Dos33', 'aaaaaaaa-3300-4000-8000-000000000002', pg_temp.s(2)),
  ('dddddddd-3300-4000-8000-000000000003', 'Tres33', 'aaaaaaaa-3300-4000-8000-000000000003', pg_temp.s(3)),
  ('dddddddd-3300-4000-8000-000000000004', 'Cuatro33', 'aaaaaaaa-3300-4000-8000-000000000004', pg_temp.s(4)),
  ('dddddddd-3300-4000-8000-000000000005', 'Cinco33', 'aaaaaaaa-3300-4000-8000-000000000005', pg_temp.s(5)),
  ('dddddddd-3300-4000-8000-000000000006', 'Seis33', 'aaaaaaaa-3300-4000-8000-000000000006', pg_temp.s(6));
-- Equipo del capitán con el capitán y los jugadores 1 y 2.
insert into public.teams(id, name, tag, kind, owner_id, captain_id) values
  ('bbbbbbbb-3300-4000-8000-000000000001', 'Equipo33', 'E33', 'official', 'aaaaaaaa-3300-4000-8000-0000000000c0', 'aaaaaaaa-3300-4000-8000-0000000000c0');
insert into public.team_members(team_id, player_id, joined_at) values
  ('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-0000000000c0', now()),
  ('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000001', now()),
  ('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000002', now());

-- =====================================================================================================
-- 1. Máximo de miembros
-- =====================================================================================================
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select pg_temp.ok(pg_temp.estado($q$select public.set_team_config(3)$q$) = '42501', 'el capitán no cambia el máximo');
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error($q$select public.set_team_config(1)$q$) = 'El máximo de miembros tiene que estar entre 2 y 30', 'máximo fuera de rango');
select public.set_team_config(3);
select pg_temp.ok((select max_members from public.team_overview where id = 'bbbbbbbb-3300-4000-8000-000000000001') = 3
                  and not (select has_space from public.team_overview where id = 'bbbbbbbb-3300-4000-8000-000000000001'),
                  'team_overview usa el máximo configurado');
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select pg_temp.ok(pg_temp.estado($q$select public.team_invite('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000003')$q$) = 'V3402',
                  'con el plantel lleno, invitar da V3402');
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000ad');
select public.set_team_config(10);

-- =====================================================================================================
-- 2. Invitaciones con estado y mensaje; estado en el roster
-- =====================================================================================================
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select pg_temp.ok(pg_temp.error($q$select public.team_invite('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000003', null, 'capo')$q$)
                  = 'El estado tiene que ser player, sub o coach', 'estado inválido');
select pg_temp.ok(pg_temp.error(format($q$select public.team_invite('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000003', null, 'sub', %L)$q$, repeat('x', 201)))
                  = 'El mensaje puede tener hasta 200 caracteres', 'mensaje largo');
select public.team_invite('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000003', null, 'sub', '  ¿Jugás de suplente?  ');
select public.team_invite('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000004', null, 'coach');
reset role;
select pg_temp.ok((select role || '|' || message from public.team_invites where player_id = 'dddddddd-3300-4000-8000-000000000003' and status = 'open')
                  = 'sub|¿Jugás de suplente?', 'la invitación guarda el estado y el mensaje recortado');
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-000000000003');
select public.team_invite_answer((select id from public.team_invites where player_id = 'dddddddd-3300-4000-8000-000000000003' and status = 'open'), true);
select pg_temp.como('aaaaaaaa-3300-4000-8000-000000000004');
select public.team_invite_answer((select id from public.team_invites where player_id = 'dddddddd-3300-4000-8000-000000000004' and status = 'open'), true);
select pg_temp.ok((select role from public.team_members where player_id = 'dddddddd-3300-4000-8000-000000000003' and left_at is null) = 'sub',
                  'al aceptar entra con el estado de la invitación');
select pg_temp.ok((select role from public.team_members where player_id = 'dddddddd-3300-4000-8000-000000000004' and left_at is null) = 'coach',
                  'el coach entra como coach');
select pg_temp.como('aaaaaaaa-3300-4000-8000-000000000005');
select public.team_request_join('bbbbbbbb-3300-4000-8000-000000000001', 'Quiero jugar');
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select pg_temp.ok((select message from public.team_invites where player_id = 'dddddddd-3300-4000-8000-000000000005' and kind = 'request') = 'Quiero jugar',
                  'el pedido guarda el mensaje');
select public.team_invite_answer((select id from public.team_invites where player_id = 'dddddddd-3300-4000-8000-000000000005' and status = 'open'), true);
select pg_temp.ok((select role from public.team_members where player_id = 'dddddddd-3300-4000-8000-000000000005' and left_at is null) = 'player',
                  'un pedido entra como player');

select pg_temp.como('aaaaaaaa-3300-4000-8000-000000000001');
select pg_temp.ok(pg_temp.estado($q$select public.team_set_member_role('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000002', 'sub')$q$) = '42501',
                  'un miembro que no es capitán no cambia estados');
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select pg_temp.ok(pg_temp.estado($q$select public.team_set_member_role('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000006', 'sub')$q$) = 'V3401',
                  'cambiar el estado de alguien que no es miembro da V3401');
select public.team_set_member_role('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000002', 'sub');
select public.team_set_member_role('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000002', 'sub');
reset role;
select pg_temp.ok((select role from public.team_members where player_id = 'dddddddd-3300-4000-8000-000000000002' and left_at is null) = 'sub',
                  'el capitán cambia el estado');
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-3300-4000-8000-000000000002', 'team_role_changed') = 1, 'un solo aviso aunque se repita el mismo estado');
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select public.team_set_member_role('bbbbbbbb-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000002', 'player');

-- =====================================================================================================
-- 3. Qué busca el equipo y logo
-- =====================================================================================================
select pg_temp.ok(pg_temp.error($q$select public.team_update('bbbbbbbb-3300-4000-8000-000000000001', '{player,capo}')$q$)
                  = 'Lo que busca el equipo tiene que ser player, sub o coach', 'looking_for con un valor inválido');
select public.team_update('bbbbbbbb-3300-4000-8000-000000000001', '{sub,player,sub}');
select pg_temp.ok((select looking_for from public.team_overview where id = 'bbbbbbbb-3300-4000-8000-000000000001') = '{player,sub}',
                  'looking_for sin repetidos y ordenado');
select pg_temp.ok(pg_temp.error($q$select public.team_set_logo('bbbbbbbb-3300-4000-8000-000000000001', 'https://otro.sitio/logo.png')$q$)
                  = 'El logo tiene que estar en el almacenamiento de la web', 'el logo tiene que ser del bucket');
select public.team_set_logo('bbbbbbbb-3300-4000-8000-000000000001', 'http://x/storage/v1/object/public/photos/teams/b/1.png');
reset role;
select pg_temp.ok((select logo_url from public.team_overview where id = 'bbbbbbbb-3300-4000-8000-000000000001') like '%/photos/teams/b/1.png'
                  and public.team_ref('bbbbbbbb-3300-4000-8000-000000000001')->>'logo_url' like '%1.png', 'logo en team_overview y team_ref');
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-000000000001');
select pg_temp.ok(pg_temp.estado($q$select public.team_update('bbbbbbbb-3300-4000-8000-000000000001', '{}')$q$) = '42501', 'solo el capitán edita el equipo');
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000ad');
select public.set_team_config(6);
select pg_temp.ok((select looking_for from public.team_overview where id = 'bbbbbbbb-3300-4000-8000-000000000001') = '{}',
                  'con el plantel lleno, looking_for sale vacío');
select public.set_team_config(10);

-- =====================================================================================================
-- 4. Modos de juego
-- =====================================================================================================
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-00000000000f');
select pg_temp.ok(pg_temp.estado($q$select public.set_game_mode_active('1v1', false)$q$) = '42501', 'el organizador no cambia los modos');
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000ad');
select public.set_game_mode_active('1v1', false);
select pg_temp.ok(pg_temp.error($q$select public.set_game_mode_active('9v9', true)$q$) = 'No existe el modo de juego 9v9', 'modo inexistente');
select pg_temp.como('aaaaaaaa-3300-4000-8000-00000000000f');
select pg_temp.ok(pg_temp.error($q$insert into public.events(name, template, game_mode) values ('T33 1v1', 'single', '1v1')$q$)
                  = 'El modo de juego 1v1 no está habilitado', 'no se crea un torneo con un modo deshabilitado');
insert into public.events(id, name, template, game_mode, subs_max) values ('eeeeeeee-3300-4000-8000-000000000001', 'T33', 'single', '2v2', 1);
select pg_temp.ok((select players_per_team || '|' || subs_max || '|' || bo || '|' || bo_final from public.event_list where id = 'eeeeeeee-3300-4000-8000-000000000001') = '2|1|3|3',
                  'event_list con el modo, los suplentes y los BO');
select pg_temp.ok(pg_temp.error($q$update public.events set subs_max = 5 where id = 'eeeeeeee-3300-4000-8000-000000000001'$q$) like 'new row %',
                  'subs_max no pasa de 4');

-- =====================================================================================================
-- 5. Inscripción con activos y suplentes
-- =====================================================================================================
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select pg_temp.ok(pg_temp.error($q$select public.event_register('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001',
                  '{dddddddd-3300-4000-8000-0000000000c0}')$q$) = 'Cada equipo inscribe 2 jugadores activos (modo 2v2)', 'faltan activos');
select pg_temp.ok(pg_temp.error($q$select public.event_register('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001',
                  '{dddddddd-3300-4000-8000-0000000000c0,dddddddd-3300-4000-8000-000000000001}', '{dddddddd-3300-4000-8000-000000000002,dddddddd-3300-4000-8000-000000000003}')$q$)
                  = 'Este torneo admite hasta 1 suplentes', 'demasiados suplentes');
select pg_temp.ok(pg_temp.estado($q$select public.event_register('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001',
                  '{dddddddd-3300-4000-8000-0000000000c0,dddddddd-3300-4000-8000-000000000001}', '{dddddddd-3300-4000-8000-000000000004}')$q$) = 'V3403',
                  'el coach no se inscribe (V3403)');
select pg_temp.ok(pg_temp.error($q$select public.event_register('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001',
                  '{dddddddd-3300-4000-8000-0000000000c0,dddddddd-3300-4000-8000-000000000006}')$q$) = 'Seis33 no está en el plantel del equipo', 'solo miembros');
reset role;
update public.players set steam_id = null where id in ('dddddddd-3300-4000-8000-000000000001', 'dddddddd-3300-4000-8000-000000000002');
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select pg_temp.ok(pg_temp.estado($q$select public.event_register('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001',
                  '{dddddddd-3300-4000-8000-0000000000c0,dddddddd-3300-4000-8000-000000000001}', '{dddddddd-3300-4000-8000-000000000002}')$q$)
                  = 'V3405 ["Dos33", "Uno33"]', 'sin SteamID: V3405 con todos los alias');
select pg_temp.ok(pg_temp.error($q$select public.event_register('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001',
                  '{dddddddd-3300-4000-8000-0000000000c0,dddddddd-3300-4000-8000-000000000001}', '{dddddddd-3300-4000-8000-000000000002}')$q$)
                  = 'No tienen el SteamID vinculado: Dos33, Uno33', 'mensaje con los alias');
reset role;
update public.players set steam_id = pg_temp.s(1) where id = 'dddddddd-3300-4000-8000-000000000001';
update public.players set steam_id = pg_temp.s(2) where id = 'dddddddd-3300-4000-8000-000000000002';
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select public.event_register('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001',
                             '{dddddddd-3300-4000-8000-0000000000c0,dddddddd-3300-4000-8000-000000000001}', '{dddddddd-3300-4000-8000-000000000002}');
reset role;
select pg_temp.ok((select string_agg(p.nick || ':' || r.role, ',' order by p.nick) from public.tournament_registration_players r join public.players p on p.id = r.player_id
                    where r.event_id = 'eeeeeeee-3300-4000-8000-000000000001') = 'Cap33:active,Dos33:sub,Uno33:active', 'activos y suplente inscritos');
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-3300-4000-8000-000000000001', 'event_lineup') = 1
                  and pg_temp.avisos('aaaaaaaa-3300-4000-8000-000000000002', 'event_lineup') = 1
                  and pg_temp.avisos('aaaaaaaa-3300-4000-8000-0000000000c0', 'event_lineup') = 0, 'aviso a cada inscrito, no al capitán');
-- Cambia solo lo que cambió: Uno pasa a suplente, Dos a activo; Cap sigue igual.
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select public.event_register('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001',
                             '{dddddddd-3300-4000-8000-0000000000c0,dddddddd-3300-4000-8000-000000000002}', '{dddddddd-3300-4000-8000-000000000001}');
reset role;
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-3300-4000-8000-000000000001', 'event_lineup') = 2
                  and (select data->>'role' from public.notifications where user_id = 'aaaaaaaa-3300-4000-8000-000000000001' and type = 'event_lineup'
                        order by created_at desc, id desc limit 1) is not null, 'el cambio de activo a suplente avisa');
select pg_temp.ok((select players_per_team from public.event_list where id = 'eeeeeeee-3300-4000-8000-000000000001') = 2, 'sigue en 2v2');

-- El formato no cambia si deja inscritos que no cumplen.
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-00000000000f');
select pg_temp.ok(pg_temp.error($q$update public.events set subs_max = 0 where id = 'eeeeeeee-3300-4000-8000-000000000001'$q$)
                  = 'Hay equipos inscritos que no cumplen el formato nuevo (por ejemplo Equipo33): tienen que corregir su inscripción antes', 'subs_max no deja afuera a un inscrito');
select pg_temp.ok(pg_temp.error($q$update public.events set game_mode = '3v3' where id = 'eeeeeeee-3300-4000-8000-000000000001'$q$)
                  like 'Hay equipos inscritos que no cumplen%', 'el modo no deja afuera a un inscrito');

-- Cierre de inscripciones
update public.events set registration_closes_at = now() - interval '1 minute' where id = 'eeeeeeee-3300-4000-8000-000000000001';
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000c0');
select pg_temp.ok(pg_temp.estado($q$select public.event_register('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001',
                  '{dddddddd-3300-4000-8000-0000000000c0,dddddddd-3300-4000-8000-000000000001}')$q$) = 'V3404', 'cerradas: el capitán no cambia (V3404)');
select pg_temp.ok(pg_temp.estado($q$select public.event_unregister('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001')$q$) = 'V3404',
                  'cerradas: el capitán no da de baja (V3404)');
select pg_temp.ok((select result from public.team_event_history('bbbbbbbb-3300-4000-8000-000000000001') where event_id = 'eeeeeeee-3300-4000-8000-000000000001') = 'registered',
                  'historial: inscripto');
select pg_temp.como('aaaaaaaa-3300-4000-8000-00000000000f');
select public.event_register('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001',
                             '{dddddddd-3300-4000-8000-0000000000c0,dddddddd-3300-4000-8000-000000000001}');
reset role;
select pg_temp.ok((select count(*) from public.tournament_registration_players where event_id = 'eeeeeeee-3300-4000-8000-000000000001') = 2,
                  'el organizador sí cambia con las inscripciones cerradas');
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-3300-4000-8000-000000000002', 'event_lineup') = 3
                  and (select data->>'registered' from public.notifications where user_id = 'aaaaaaaa-3300-4000-8000-000000000002' and type = 'event_lineup'
                        order by created_at desc, id desc limit 1) = 'false', 'al que sacan le llega el aviso');
select pg_temp.ok(public.notification_category('event_lineup') = 'tournament', 'event_lineup es de la categoría tournament');
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-00000000000f');
select public.event_unregister('eeeeeeee-3300-4000-8000-000000000001', 'bbbbbbbb-3300-4000-8000-000000000001');
reset role;
select pg_temp.ok(not exists (select 1 from public.team_event_history('bbbbbbbb-3300-4000-8000-000000000001')), 'sin inscripción no hay historial');

rollback;

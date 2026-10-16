-- Pruebas de supabase/replanteo/09_jugadores_equipos.sql (correr con la migración aplicada). Todo con rollback.
-- Simula usuarios con request.jwt.claims (lo que lee auth.uid()) y el rol authenticated/anon.
begin;

-- Ejecuta una sentencia que tiene que fallar con un mensaje que cumpla el patrón (LIKE).
create function pg_temp.falla(q text, patron text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'NO FALLÓ: %', q;
exception when others then
  if sqlerrm like 'NO FALLÓ%' or sqlerrm not like patron then
    raise exception 'falla(%): se esperaba "%", vino "%"', q, patron, sqlerrm;
  end if;
end $$;
grant execute on function pg_temp.falla(text, text) to anon, authenticated;

create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '{"role":"anon"}'
         else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
grant execute on function pg_temp.como(text) to anon, authenticated;

-- Cuentas: admin, capitán (u1), jugador (u2), sin SteamID (u3), sin jugador (u4), extraño (u5).
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-0000000009ad', 'admin09@test.local', '{"tag":"Admin09"}'),
  ('aaaaaaaa-0000-4000-8000-000000000091', 'u1@test.local', '{"tag":"Capi"}'),
  ('aaaaaaaa-0000-4000-8000-000000000092', 'u2@test.local', '{"tag":"Jugador2"}'),
  ('aaaaaaaa-0000-4000-8000-000000000093', 'u3@test.local', '{"tag":"SinSteam"}'),
  ('aaaaaaaa-0000-4000-8000-000000000094', 'u4@test.local', '{"tag":"SinJugador"}'),
  ('aaaaaaaa-0000-4000-8000-000000000095', 'u5@test.local', '{"tag":"Extranio"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-0000000009ad';

insert into public.players (id, nick, steam_id, user_id) values
  ('dddddddd-0000-4000-8000-000000000901', 'viejo1', '76561198000000901', 'aaaaaaaa-0000-4000-8000-000000000091'),
  ('dddddddd-0000-4000-8000-000000000902', 'viejo2', '76561198000000902', 'aaaaaaaa-0000-4000-8000-000000000092'),
  ('dddddddd-0000-4000-8000-000000000903', 'viejo3', null,                'aaaaaaaa-0000-4000-8000-000000000093');
-- Doce jugadores sin cuenta con SteamID (x1..x12) y uno sin nada (x13).
insert into public.players (id, nick, steam_id)
  select ('dddddddd-0000-4000-8000-0000000009' || lpad((10 + i)::text, 2, '0'))::uuid, 'x' || i, '765611980000009' || lpad((10 + i)::text, 2, '0')
    from generate_series(1, 12) i;
insert into public.players (id, nick) values ('dddddddd-0000-4000-8000-000000000999', 'x13');
insert into public.players (id, nick, steam_id) values ('dddddddd-0000-4000-8000-000000000926', 'x14', '76561198000000926');

-- ---------- normalización y palabras bloqueadas ----------
do $$
begin
  assert public.name_norm(' P3p1t0 ') = 'pepito', public.name_norm(' P3p1t0 ');
  assert public.name_norm('Ñandú Ácido') = 'nanduacido', public.name_norm('Ñandú Ácido');
  assert public.name_norm('$@L 4 7') = 'salat', public.name_norm('$@L 4 7');
end $$;

set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000095');
select pg_temp.falla($q$insert into public.blocked_words(word) values ('malo')$q$, '%row-level security%');
select pg_temp.como('aaaaaaaa-0000-4000-8000-0000000009ad');
insert into public.blocked_words(word) values ('Pepito'), ('ñoño');
select pg_temp.falla($q$insert into public.blocked_words(word) values ('P'), ('a1')$q$, '%al menos 2 letras%');
do $$
begin
  assert (select array_agg(word order by word) from public.blocked_words) = '{nono,pepito}', 'no normalizó las palabras';
  assert (select created_by from public.blocked_words where word = 'pepito') = 'aaaaaaaa-0000-4000-8000-0000000009ad', 'sin autor';
end $$;
reset role;
set local role anon;
select pg_temp.como(null);
select pg_temp.falla('select * from public.blocked_words', '%permission denied%');
reset role;

-- ---------- alias ----------
do $$
begin
  -- El nick de los jugadores vinculados ya es el alias.
  assert (select nick from public.players where id = 'dddddddd-0000-4000-8000-000000000901') = 'Capi', 'el nick no tomó el alias al vincular';
  -- Registro con un alias tomado o bloqueado: queda el genérico.
  insert into auth.users (id, email, raw_user_meta_data) values
    ('aaaaaaaa-0000-4000-8000-000000000096', 'u6@test.local', '{"tag":"capi "}'),
    ('aaaaaaaa-0000-4000-8000-000000000097', 'u7@test.local', '{"tag":"El P3p1t0"}');
  assert (select tag from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000096') = 'user_00000096', 'alias tomado en el registro';
  assert (select count(*) from public.profiles where tag like 'user_%' and id in ('aaaaaaaa-0000-4000-8000-000000000096', 'aaaaaaaa-0000-4000-8000-000000000097')) = 2, 'alias bloqueado en el registro';
  -- Un alias repetido sin distinguir mayúsculas no entra ni por la tabla.
  begin
    update public.profiles set tag = 'CAPI' where id = 'aaaaaaaa-0000-4000-8000-000000000092';
    assert false, 'el índice único dejó repetir el alias';
  exception when unique_violation then null;
  end;
end $$;

set local role anon;
select pg_temp.como(null);
do $$
begin
  assert public.alias_check('capi') = 'taken', public.alias_check('capi');
  assert public.alias_check('x') = 'length', public.alias_check('x');
  assert public.alias_check('a<b') = 'chars', public.alias_check('a<b');
  assert public.alias_check('ÑOÑO123') = 'blocked', public.alias_check('ÑOÑO123');
  assert public.alias_check('Libre') = 'ok', public.alias_check('Libre');
end $$;
reset role;

set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000092');
do $$
begin
  assert public.alias_check('Jugador2') = 'ok', 'el alias propio cuenta como tomado';
end $$;
select pg_temp.falla($q$select public.set_my_tag('capi')$q$, 'Ese alias ya está en uso');
select pg_temp.falla($q$select public.set_my_tag('el pepito')$q$, 'El alias contiene una palabra no permitida');
select pg_temp.falla($q$select public.set_my_tag('a')$q$, 'El alias tiene que tener entre 2 y 24 caracteres');
select public.set_my_tag('  Dos  ');
do $$
begin
  assert (select tag from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000092') = 'Dos', 'no cambió el alias';
  assert (select nick from public.players where id = 'dddddddd-0000-4000-8000-000000000902') = 'Dos', 'el nick no siguió al alias';
end $$;
-- Solo mayúsculas: se puede; otro alias antes de 15 días: no.
select public.set_my_tag('DOS');
select pg_temp.falla($q$select public.set_my_tag('Tres')$q$, 'Podés volver a cambiar tu alias en 15 días');
reset role;
update public.profiles set tag_changed_at = now() - interval '14 days 1 hour' where id = 'aaaaaaaa-0000-4000-8000-000000000092';
set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000092');
select pg_temp.falla($q$select public.set_my_tag('Tres')$q$, 'Podés volver a cambiar tu alias en 1 día');
reset role;
update public.profiles set tag_changed_at = now() - interval '15 days' where id = 'aaaaaaaa-0000-4000-8000-000000000092';
set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000092');
select public.set_my_tag('Tres');
-- Un usuario común no cambia el alias de otro ni el nick de su jugador.
select pg_temp.falla($q$select public.set_user_tag('aaaaaaaa-0000-4000-8000-000000000091', 'Otro')$q$, 'Solo un administrador%');
-- El admin: sin espera, respeta la unicidad y fuerza las palabras bloqueadas.
select pg_temp.como('aaaaaaaa-0000-4000-8000-0000000009ad');
select pg_temp.falla($q$select public.set_user_tag('aaaaaaaa-0000-4000-8000-000000000092', 'capi')$q$, 'Ese alias ya está en uso');
select pg_temp.falla($q$select public.set_user_tag('aaaaaaaa-0000-4000-8000-000000000092', 'pepito99')$q$, 'El alias contiene una palabra no permitida (pepito)%');
select public.set_user_tag('aaaaaaaa-0000-4000-8000-000000000092', 'pepito99', true);
select public.set_user_tag('aaaaaaaa-0000-4000-8000-000000000092', 'Cuatro');
-- El admin edita el nick de un jugador vinculado: manda el alias. El de uno sin cuenta, sí cambia.
update public.players set nick = 'Pisado' where id = 'dddddddd-0000-4000-8000-000000000902';
update public.players set nick = 'equis1' where id = 'dddddddd-0000-4000-8000-000000000911';
do $$
begin
  assert (select nick from public.players where id = 'dddddddd-0000-4000-8000-000000000902') = 'Cuatro', 'el admin pisó el alias con el nick';
  assert (select nick from public.players where id = 'dddddddd-0000-4000-8000-000000000911') = 'equis1', 'no cambió el nick de un jugador sin cuenta';
end $$;
reset role;

-- ---------- solicitud de equipo nuevo ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000093');
select pg_temp.falla($q$insert into public.team_requests(user_id, name, tag) values ('aaaaaaaa-0000-4000-8000-000000000093', 'Sin', 'SIN')$q$, 'Para pedir un equipo tenés que tener tu SteamID vinculado');
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000091');
select pg_temp.falla($q$insert into public.team_requests(user_id, name, tag) values ('aaaaaaaa-0000-4000-8000-000000000091', 'Los Pepitos', 'LP')$q$, '%palabra no permitida');
insert into public.team_requests(user_id, name, tag) values ('aaaaaaaa-0000-4000-8000-000000000091', 'Titanes', 'TIT');
select pg_temp.falla($q$select public.approve_team_request('aaaaaaaa-0000-4000-8000-000000000091')$q$, 'Solo un administrador%');
select pg_temp.como('aaaaaaaa-0000-4000-8000-0000000009ad');
select public.approve_team_request('aaaaaaaa-0000-4000-8000-000000000091');
select pg_temp.falla($q$select public.approve_team_request('aaaaaaaa-0000-4000-8000-000000000091')$q$, 'No hay una solicitud pendiente%');
reset role;
create temp table eq as select id from public.teams where name = 'Titanes';
grant select on eq to anon, authenticated;
do $$
declare t uuid := (select id from eq);
begin
  assert (select owner_id = 'aaaaaaaa-0000-4000-8000-000000000091' and captain_id = owner_id and kind = 'official' from public.teams where id = t), 'equipo mal creado';
  assert (select count(*) from public.team_members where team_id = t and left_at is null) = 1, 'el capitán no quedó en el plantel';
  assert (select status from public.team_requests where user_id = 'aaaaaaaa-0000-4000-8000-000000000091') = 'approved', 'solicitud no aprobada';
end $$;

-- ---------- invitaciones y pedidos ----------
set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000092');
select pg_temp.falla(format('select public.team_invite(%L, null, %L)', (select id from eq), 'Capi'), 'Solo el capitán o un admin%');
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000091');
select pg_temp.falla(format('select public.team_invite(%L, null, %L)', (select id from eq), 'nadie'), 'No hay ningún usuario con ese alias');
select pg_temp.falla(format('select public.team_invite(%L, null, %L)', (select id from eq), 'SinJugador'), 'Ese usuario no tiene un SteamID vinculado%');
select pg_temp.falla(format('select public.team_invite(%L, null, %L)', (select id from eq), 'sinsteam'), 'SinSteam no tiene el SteamID vinculado%');
select pg_temp.falla(format('select public.team_invite(%L, null, %L)', (select id from eq), 'capi'), 'Capi ya está en el equipo');
select public.team_invite((select id from eq), null, 'cuatro');
select pg_temp.falla(format('select public.team_invite(%L, %L)', (select id from eq), 'dddddddd-0000-4000-8000-000000000902'), 'Cuatro ya tiene una invitación abierta%');
select pg_temp.falla(format('select public.team_invite(%L, %L)', (select id from eq), 'dddddddd-0000-4000-8000-000000000911'), 'equis1 no tiene cuenta en la web%');
-- El invitado ve su invitación; un extraño no ve nada.
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000095');
do $$ begin assert (select count(*) from public.team_invites) = 0, 'un extraño ve invitaciones'; end $$;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000092');
do $$ begin assert (select count(*) from public.team_invites where status = 'open') = 1, 'el invitado no ve su invitación'; end $$;
select pg_temp.falla(format('select public.team_request_join(%L)', (select id from eq)), 'Ya tenés una invitación de este equipo: aceptala');
select pg_temp.falla(format('select public.team_invite_cancel(%L)', (select id from public.team_invites limit 1)), 'No podés cancelar%');
select public.team_invite_answer((select id from public.team_invites limit 1), true);
select pg_temp.falla(format('select public.team_invite_answer(%L, true)', (select id from public.team_invites limit 1)), 'Esta invitación ya no está abierta (aceptada)');
select pg_temp.falla('insert into public.team_invites(team_id, player_id, kind) select id, ''dddddddd-0000-4000-8000-000000000911'', ''invite'' from eq', '%permission denied%');
-- Sale, vuelve a pedir, el capitán acepta: queda una fila nueva en el plantel.
select public.team_leave((select id from eq));
select pg_temp.falla(format('select public.team_leave(%L)', (select id from eq)), 'No estás en ese equipo');
select public.team_request_join((select id from eq));
select pg_temp.falla(format('select public.team_request_join(%L)', (select id from eq)), 'Ya pediste entrar a este equipo');
select pg_temp.falla(format('select public.team_invite_answer(%L, true)', (select id from public.team_invites where status = 'open')), 'No podés responder%');
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000093');
select pg_temp.falla(format('select public.team_request_join(%L)', (select id from eq)), 'Para entrar a un equipo tenés que tener tu SteamID vinculado');
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000091');
select public.team_invite_answer((select id from public.team_invites where status = 'open'), true);
select pg_temp.falla(format('select public.team_leave(%L)', (select id from eq)), 'Sos el capitán: cedé la capitanía%');
select pg_temp.falla(format('select public.team_kick(%L, %L)', (select id from eq), 'dddddddd-0000-4000-8000-000000000901'), 'No se puede sacar al capitán%');
select public.team_kick((select id from eq), 'dddddddd-0000-4000-8000-000000000902');
select pg_temp.falla(format('select public.team_kick(%L, %L)', (select id from eq), 'dddddddd-0000-4000-8000-000000000902'), 'Ese jugador no está en el equipo');
-- Pedido que vence.
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000092');
select public.team_request_join((select id from eq));
reset role;
update public.team_invites set expires_at = now() - interval '1 minute' where status = 'open';
set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000091');
select pg_temp.falla(format('select public.team_invite_answer(%L, true)', (select id from public.team_invites where expires_at < now())), 'Esta invitación ya no está abierta (vencida)');
reset role;
do $$
declare t uuid := (select id from eq);
begin
  assert (select count(*) from public.team_members where team_id = t and player_id = 'dddddddd-0000-4000-8000-000000000902') = 2, 'no quedó el historial de altas y bajas';
  assert (select count(*) from public.team_invites where team_id = t) = 3, 'cantidad de invitaciones';
  -- El error de arriba deshizo la marca: queda abierta con la fecha vencida hasta la próxima llamada que funcione.
  assert (select count(*) from public.team_invites where team_id = t and status = 'open' and expires_at < now()) = 1, 'no venció';
  perform public.team_invites_expire();
  assert (select count(*) from public.team_invites where team_id = t and status = 'expired') = 1, 'no quedó vencida';
end $$;

-- ---------- tope de 10 y SteamID obligatorio (también para el admin) ----------
insert into public.team_members(team_id, player_id, joined_at)
  select (select id from eq), ('dddddddd-0000-4000-8000-0000000009' || lpad((10 + i)::text, 2, '0'))::uuid, now() from generate_series(1, 9) i;
select pg_temp.falla($q$insert into public.team_members(team_id, player_id) select id, 'dddddddd-0000-4000-8000-000000000920' from eq$q$, 'El equipo ya tiene 10 jugadores, el máximo');
set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000091');
select pg_temp.falla(format('select public.team_invite(%L, null, %L)', (select id from eq), 'cuatro'), 'El equipo ya tiene 10 jugadores, el máximo');
reset role;
create temp table eq2 as select gen_random_uuid() as id;
grant select on eq2 to anon, authenticated;
insert into public.teams(id, name, tag, kind) select id, 'Rivales', 'RIV', 'official' from eq2;
select pg_temp.falla($q$insert into public.team_members(team_id, player_id) select id, 'dddddddd-0000-4000-8000-000000000999' from eq2$q$, 'x13 no tiene el SteamID vinculado%');
-- Rivales: x1 (también en Titanes) y cinco propios.
insert into public.team_members(team_id, player_id, joined_at)
  select (select id from eq2), ('dddddddd-0000-4000-8000-0000000009' || lpad((10 + i)::text, 2, '0'))::uuid, now() from generate_series(10, 12) i;
insert into public.team_members(team_id, player_id, joined_at) select id, 'dddddddd-0000-4000-8000-000000000911', now() from eq2;
insert into public.team_members(team_id, player_id, joined_at) select id, 'dddddddd-0000-4000-8000-000000000902', now() from eq2;
insert into public.team_members(team_id, player_id, joined_at) select id, 'dddddddd-0000-4000-8000-000000000926', now() from eq2;

-- ---------- torneos: un jugador no está inscrito con dos equipos ----------
create temp table ev as select gen_random_uuid() as id;
grant select on ev to anon, authenticated;
insert into public.events(id, name) select id, 'Copa 09' from ev;
insert into public.tournament_registrations(event_id, team_id) select ev.id, eq.id from ev, eq;
select pg_temp.falla($q$insert into public.tournament_registrations(event_id, team_id) select ev.id, eq2.id from ev, eq2$q$, 'equis1 ya está inscrito en este torneo con Titanes.%');
update public.team_members set left_at = now() where team_id = (select id from eq2) and player_id = 'dddddddd-0000-4000-8000-000000000911';
insert into public.tournament_registrations(event_id, team_id) select ev.id, eq2.id from ev, eq2;
-- Ya inscritos los dos: x1 no puede volver a Rivales mientras el torneo no tenga campeón.
select pg_temp.falla($q$insert into public.team_members(team_id, player_id) select id, 'dddddddd-0000-4000-8000-000000000911' from eq2$q$, 'equis1 ya está inscrito en el torneo Copa 09 con Titanes');
update public.events set champion = (select id from eq) where id = (select id from ev);

-- ---------- partida pendiente: nadie entra al plantel del rival ----------
insert into public.matches(team1, team2, status, kind, best_of) select eq.id, eq2.id, 'upcoming', 'official', 1 from eq, eq2;
select pg_temp.falla($q$insert into public.team_members(team_id, player_id) select id, 'dddddddd-0000-4000-8000-000000000911' from eq2$q$, 'equis1 está en el plantel de Titanes, rival de este equipo en una partida pendiente');
update public.matches set status = 'finished', score1 = 1, score2 = 0, winner = team1 where team1 = (select id from eq) and kind = 'official';
insert into public.team_members(team_id, player_id, joined_at) select id, 'dddddddd-0000-4000-8000-000000000911', now() from eq2;

-- ---------- bando de PCW como equipo y ranking ----------
create temp table pcw as select gen_random_uuid() as a, gen_random_uuid() as b;
grant select on pcw to anon, authenticated;
insert into public.teams(id, name, tag, kind) select a, 'Pick A', 'PCW', 'pcw' from pcw;
insert into public.teams(id, name, tag, kind) select b, 'Pick B', 'PCW', 'pcw' from pcw;
insert into public.team_members(team_id, player_id, joined_at)
  select (select a from pcw), ('dddddddd-0000-4000-8000-0000000009' || lpad((10 + i)::text, 2, '0'))::uuid, now() from generate_series(2, 4) i;
insert into public.team_members(team_id, player_id, joined_at) select a, 'dddddddd-0000-4000-8000-000000000902', now() from pcw;
select pg_temp.falla($q$update public.teams set parent_team_id = (select id from eq) where id = (select a from pcw)$q$, 'Para jugar como Titanes todos los jugadores del roster tienen que ser de su plantel (no lo son: Cuatro)');
delete from public.team_members where team_id = (select a from pcw) and player_id = 'dddddddd-0000-4000-8000-000000000902';
update public.teams set parent_team_id = (select id from eq) where id = (select a from pcw);
select pg_temp.falla($q$insert into public.team_members(team_id, player_id) select a, 'dddddddd-0000-4000-8000-000000000902' from pcw$q$, 'Cuatro no es del plantel de Titanes');
select pg_temp.falla($q$update public.teams set parent_team_id = (select id from eq2) where id = (select id from eq)$q$, 'Solo un bando de PCW puede jugar como un equipo oficial');
insert into public.matches(team1, team2, status, kind, best_of, score1, score2, winner)
  select a, b, 'finished', 'pcw', 1, 1, 0, a from pcw;
do $$
declare t record; r record;
begin
  select * into t from public.team_standings where team_id = (select id from eq);
  assert (t.official_played, t.official_won, t.official_lost, t.official_points) = (1, 1, 0, 30), format('torneo Titanes: %s', t);
  assert (t.pcw_played, t.pcw_won, t.pcw_points) = (1, 1, 5), format('pcw Titanes: %s', t);
  select * into r from public.team_standings where team_id = (select id from eq2);
  assert (r.official_played, r.official_lost, r.official_points, r.pcw_played) = (1, 1, 0, 0), format('Rivales: %s', r);
  assert not exists (select 1 from public.team_standings where team_id in (select a from pcw union select b from pcw)), 'los bandos de PCW aparecen en el ranking';
end $$;
set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000091');
select pg_temp.falla('select public.set_ranking_config(50, 10)', 'Solo un administrador%');
select pg_temp.como('aaaaaaaa-0000-4000-8000-0000000009ad');
select pg_temp.falla('select public.set_ranking_config(50, -1)', 'Los puntos tienen que estar entre 0 y 1000');
select public.set_ranking_config(50, 10);
reset role;
set local role anon;
select pg_temp.como(null);
do $$
begin
  assert (select (official_points, pcw_points) = (50, 10) from public.team_standings where team_id = (select id from eq)), 'los puntos no siguen a ranking_config';
end $$;

-- ---------- listado de jugadores ----------
do $$
declare o record;
begin
  select * into o from public.player_overview where id = 'dddddddd-0000-4000-8000-000000000911';
  assert not o.has_account and o.has_steam, 'has_account/has_steam';
  assert jsonb_array_length(o.teams) = 2, format('x1 tiene que estar en dos equipos: %s', o.teams);
  assert (select teams = '[]' from public.player_overview where id = 'dddddddd-0000-4000-8000-000000000999'), 'equipos de un jugador sin equipo';
  assert (select has_account from public.player_overview where id = 'dddddddd-0000-4000-8000-000000000901'), 'has_account de Capi';
  assert (select search from public.player_overview where id = 'dddddddd-0000-4000-8000-000000000901') = 'capi titanes tit', 'search de Capi';
  assert (select (captain_nick, members) = ('Capi'::text, 10) from public.team_overview where id = (select id from eq)), 'team_overview de Titanes';
end $$;
reset role;

-- ---------- bajas seguras ----------
select pg_temp.falla($q$delete from public.teams where id = (select id from eq)$q$, 'Titanes tiene partidas o inscripciones: no se puede borrar');
insert into public.matches(status, kind, best_of, lineup1, lineup2, side1_name, side2_name)
  values ('finished', 'mix', 1, '{dddddddd-0000-4000-8000-000000000912}', '{}', 'A', 'B');
select pg_temp.falla($q$delete from public.players where id = 'dddddddd-0000-4000-8000-000000000912'$q$, 'x2 tiene partidas jugadas: no se puede borrar');
delete from public.players where id = 'dddddddd-0000-4000-8000-000000000999';

-- ---------- historial, SteamIDs sin vincular y usuarios para el admin ----------
insert into public.match_player_stats(match_id, steam_id, team, nick, kills, deaths, rounds, player_id)
  select id, '76561198000000912', 1, 'jugó como x2', 20, 10, 16, 'dddddddd-0000-4000-8000-000000000912' from public.matches where side1_name = 'A';
insert into public.match_player_stats(match_id, steam_id, team, nick, kills, deaths, rounds)
  select id, '76561198000000777', 2, 'anónimo', 5, 15, 16 from public.matches where side1_name = 'A';
update public.matches set score1 = 16, score2 = 10, winner_side = 1 where side1_name = 'A';
do $$
begin
  assert (select (game_nick, won, side) = ('jugó como x2'::text, true, 1) from public.player_matches where player_id = 'dddddddd-0000-4000-8000-000000000912'), 'player_matches';
  assert (select (last_nick, matches) = ('anónimo'::text, 1) from public.steam_unlinked where steam_id = '76561198000000777'), 'steam_unlinked';
end $$;
set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000091');
select pg_temp.falla('select * from public.admin_users()', 'Solo un administrador%');
select pg_temp.como('aaaaaaaa-0000-4000-8000-0000000009ad');
do $$
begin
  assert (select player_id from public.admin_users('capí')) = 'dddddddd-0000-4000-8000-000000000901', 'admin_users con búsqueda';
end $$;
reset role;

-- ---------- hits de palabras bloqueadas ----------
update public.teams set name = 'Ñoños' where id = (select id from eq2);
set local role authenticated;
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000091');
select pg_temp.falla('select * from public.blocked_names_hits()', 'Solo un administrador%');
select pg_temp.falla($q$select public.admin_name_blocked('x')$q$, 'Solo un administrador%');
select pg_temp.como('aaaaaaaa-0000-4000-8000-0000000009ad');
do $$
begin
  assert public.admin_name_blocked('Los P3P1T0S') = 'pepito', 'admin_name_blocked';
  assert public.admin_name_blocked('Titanes') is null, 'admin_name_blocked de un nombre limpio';
  -- pepito99 ya no está (el admin lo cambió a Cuatro); el equipo de abajo sí.
  assert (select array_agg(kind || ':' || name || ':' || word order by kind, name) from public.blocked_names_hits())
         = '{team:Ñoños:nono}', format('hits: %s', (select array_agg(kind || ':' || name) from public.blocked_names_hits()));
end $$;
-- Un usuario común no puede ponerle un nombre bloqueado a un equipo (el admin sí, desde el backend con "forzar").
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000091');
select pg_temp.falla($q$select public.pcw_make_side('pepito team', '{dddddddd-0000-4000-8000-000000000913,dddddddd-0000-4000-8000-000000000914,dddddddd-0000-4000-8000-000000000915,dddddddd-0000-4000-8000-000000000916}', '{}')$q$, 'El nombre o la sigla del equipo contiene una palabra no permitida');
reset role;
do $$
begin
  raise notice '09: alias, palabras bloqueadas, plantel, torneos, PCW, ranking, listado y bajas seguras OK';
end $$;

rollback;

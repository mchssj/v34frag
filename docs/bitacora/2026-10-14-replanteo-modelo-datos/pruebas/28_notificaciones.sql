-- Pruebas de supabase/replanteo/28_notificaciones.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
create function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('aaaaaaaa-2800-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.f(n int) returns uuid language sql immutable as $$ select ('dddddddd-2800-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119828' || lpad(n::text, 7, '0') $$;
-- Cuántas notificaciones de ese tipo tiene la cuenta n.
create function pg_temp.n(u int, t text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = pg_temp.u(u) and type = t $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.u(int), pg_temp.f(int), pg_temp.s(int),
  pg_temp.n(int, text) to authenticated, anon;

-- Cuentas: 1 admin, 2 líder, 3 y 4 jugadores, 5 sin ficha. Fichas con SteamID; la 6 sin cuenta.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password)
select pg_temp.u(n), format('n28-%s@test.local', n), format('{"tag":"Not28_%s"}', n)::jsonb, 'x' from generate_series(1, 5) n;
update public.profiles set role = 'admin' where id = pg_temp.u(1);
insert into public.players(id, nick, steam_id, user_id)
select pg_temp.f(n), 'Not28_' || n, pg_temp.s(n), case when n between 2 and 4 then pg_temp.u(n) end from generate_series(2, 6) n;
-- Solo las del juego de pruebas (la base local ya puede tener otras).
create temp view mias as select * from public.notifications where user_id in (select pg_temp.u(n) from generate_series(1, 5) n);

-- =====================================================================================================
-- notify(): autor, cuentas, preferencias y tope
-- =====================================================================================================
select pg_temp.como(pg_temp.u(2)::text);
select public.notify(array[pg_temp.u(2), pg_temp.u(3), pg_temp.f(6), null], 'pcw_result', '{}');
select pg_temp.ok(pg_temp.n(2, 'pcw_result') = 0, 'no se notifica a quien hizo la acción');
select pg_temp.ok(pg_temp.n(3, 'pcw_result') = 1, 'sí al otro');
select pg_temp.ok((select count(*) from mias where type = 'pcw_result') = 1, 'un id que no es cuenta (ficha) se ignora');
select pg_temp.ok((select category from mias where type = 'pcw_result') = 'pcw' and (select actor_id from mias where type = 'pcw_result') = pg_temp.u(2),
  'categoría y autor');

insert into public.user_preferences(user_id, preferences) values (pg_temp.u(3), '{"notifications":{"pcw":false,"news":true}}')
  on conflict (user_id) do update set preferences = excluded.preferences;
select public.notify(array[pg_temp.u(3), pg_temp.u(4)], 'pcw_accepted', '{}');
select pg_temp.ok(pg_temp.n(3, 'pcw_accepted') = 0 and pg_temp.n(4, 'pcw_accepted') = 1, 'una categoría apagada no se guarda');
select public.notify(array[pg_temp.u(3), pg_temp.u(4)], 'event_new', '{}');
select pg_temp.ok(pg_temp.n(3, 'event_new') = 1 and pg_temp.n(4, 'event_new') = 0, 'Novedades: apagada por defecto, prendida si la eligió');
update public.user_preferences set preferences = '{"notifications":{"team":false,"account":false}}' where user_id = pg_temp.u(3);
select public.notify(array[pg_temp.u(3)], 'team_invite', '{}');
select public.notify(array[pg_temp.u(3)], 'password_changed', '{}');
select public.notify(array[pg_temp.u(3)], 'team_removed', '{}');
select pg_temp.ok(pg_temp.n(3, 'team_invite') = 1 and pg_temp.n(3, 'password_changed') = 1 and pg_temp.n(3, 'team_removed') = 0,
  'las obligatorias llegan aunque la categoría esté apagada');
delete from public.user_preferences where user_id = pg_temp.u(3);
select pg_temp.ok((select actionable from mias where user_id = pg_temp.u(3) and type = 'team_invite'), 'una invitación es accionable');

select public.notify(array[pg_temp.u(4)], 'level_changed', jsonb_build_object('i', i)) from generate_series(1, 105) i;
select pg_temp.ok((select count(*) from mias where user_id = pg_temp.u(4)) = 100, 'quedan las últimas 100 por cuenta');
select pg_temp.ok((select min((data ->> 'i')::int) from mias where user_id = pg_temp.u(4) and type = 'level_changed') = 6, 'se borran las más viejas');
delete from public.notifications where user_id in (select pg_temp.u(n) from generate_series(1, 5) n);

-- =====================================================================================================
-- Equipos: invitar, pedir, responder, cancelar, líder, bajas y altas
-- =====================================================================================================
select pg_temp.como(pg_temp.u(1)::text);
insert into public.teams(id, name, tag, kind, owner_id, captain_id) values
  ('bbbbbbbb-2800-4000-8000-000000000001', 'Alfa28', 'A28', 'official', pg_temp.u(2), pg_temp.u(2));
insert into public.team_members(team_id, player_id, joined_at) values ('bbbbbbbb-2800-4000-8000-000000000001', pg_temp.f(2), now());
select pg_temp.ok(pg_temp.n(2, 'team_added') = 0, 'el líder que crea el equipo no recibe "te sumaron"');

select pg_temp.como(pg_temp.u(2)::text);
select public.team_invite('bbbbbbbb-2800-4000-8000-000000000001', pg_temp.f(3));
select pg_temp.ok(pg_temp.n(3, 'team_invite') = 1, 'invitación: le llega al invitado');
select pg_temp.ok((select data -> 'team' ->> 'name' from mias where type = 'team_invite') = 'Alfa28', 'con el equipo en data');

select pg_temp.como(pg_temp.u(3)::text);
select public.team_invite_answer((select id from public.team_invites where player_id = pg_temp.f(3) and status = 'open'), true);
select pg_temp.ok((select resolution from mias where type = 'team_invite' and user_id = pg_temp.u(3)) = 'accepted', 'la invitación queda resuelta (aceptada)');
select pg_temp.ok(pg_temp.n(2, 'team_invite_answered') = 1
  and (select (data ->> 'accepted')::boolean from mias where type = 'team_invite_answered'), 'el líder se entera de que aceptó');
select pg_temp.ok(pg_temp.n(3, 'team_added') = 0, 'quien entra por invitación no recibe "te sumaron"');

select pg_temp.como(pg_temp.u(4)::text);
select public.team_request_join('bbbbbbbb-2800-4000-8000-000000000001');
select pg_temp.ok(pg_temp.n(2, 'team_join_request') = 1, 'pedido para entrar: le llega al líder');
select pg_temp.como(pg_temp.u(2)::text);
select public.team_invite_answer((select id from public.team_invites where player_id = pg_temp.f(4) and status = 'open'), false);
select pg_temp.ok((select resolution from mias where type = 'team_join_request') = 'rejected', 'el pedido queda resuelto (rechazado)');
select pg_temp.ok(pg_temp.n(4, 'team_join_answered') = 1
  and not (select (data ->> 'accepted')::boolean from mias where type = 'team_join_answered'), 'el jugador se entera del rechazo');

select public.team_invite('bbbbbbbb-2800-4000-8000-000000000001', pg_temp.f(4));
select public.team_invite_cancel((select id from public.team_invites where player_id = pg_temp.f(4) and status = 'open'));
select pg_temp.ok((select resolution from mias where type = 'team_invite' and user_id = pg_temp.u(4)) = 'cancelled', 'una invitación cancelada queda resuelta');

select public.set_team_captain('bbbbbbbb-2800-4000-8000-000000000001', pg_temp.u(3));
select pg_temp.ok(pg_temp.n(3, 'team_captain') = 1, 'el nuevo líder se entera');

-- La líder ahora es la 3: saca a la 2.
select pg_temp.como(pg_temp.u(3)::text);
update public.team_members set left_at = now() where team_id = 'bbbbbbbb-2800-4000-8000-000000000001' and player_id = pg_temp.f(2);
select pg_temp.ok(pg_temp.n(2, 'team_removed') = 1, 'te sacaron del equipo');
-- Un admin suma a la 4 y le cambia el rol; la 4 se va sola.
select pg_temp.como(pg_temp.u(1)::text);
insert into public.team_members(team_id, player_id, joined_at) values ('bbbbbbbb-2800-4000-8000-000000000001', pg_temp.f(4), now());
select pg_temp.ok(pg_temp.n(4, 'team_added') = 1, 'un admin te sumó a un equipo');
update public.team_members set role = 'sub' where team_id = 'bbbbbbbb-2800-4000-8000-000000000001' and player_id = pg_temp.f(4) and left_at is null;
select pg_temp.ok(pg_temp.n(4, 'team_role_changed') = 1 and (select data ->> 'role' from mias where type = 'team_role_changed') = 'sub', 'te cambiaron el rol');
select pg_temp.como(pg_temp.u(4)::text);
update public.team_members set left_at = now() where team_id = 'bbbbbbbb-2800-4000-8000-000000000001' and player_id = pg_temp.f(4) and left_at is null;
select pg_temp.ok(pg_temp.n(3, 'team_member_left') = 1 and pg_temp.n(4, 'team_removed') = 0, 'la líder se entera de que se fue (y él no recibe "te sacaron")');

-- Un equipo de PCW no avisa nada de su roster.
select pg_temp.como(pg_temp.u(2)::text);
insert into public.teams(id, name, tag, kind, owner_id, captain_id) values ('bbbbbbbb-2800-4000-8000-000000000009', 'Pick28', 'PCW', 'pcw', pg_temp.u(2), pg_temp.u(2));
insert into public.team_members(team_id, player_id, joined_at) values ('bbbbbbbb-2800-4000-8000-000000000009', pg_temp.f(4), now());
select pg_temp.ok(pg_temp.n(4, 'team_added') = 1, 'los equipos de PCW no avisan altas');

-- =====================================================================================================
-- Cuenta
-- =====================================================================================================
select pg_temp.como(pg_temp.u(1)::text);
update public.profiles set role = 'organizer' where id = pg_temp.u(5);
update public.profiles set tag = 'Renombrado28' where id = pg_temp.u(5);
select pg_temp.ok(pg_temp.n(5, 'role_changed') = 1 and pg_temp.n(5, 'alias_changed') = 1, 'rol y alias que cambia un admin');
select pg_temp.como(pg_temp.u(5)::text);
update public.profiles set tag = 'Propio28' where id = pg_temp.u(5);
select pg_temp.ok(pg_temp.n(5, 'alias_changed') = 1, 'el alias que cambia uno mismo no se avisa');
update public.profiles set password_changed_at = now() where id = pg_temp.u(5);
select pg_temp.ok(pg_temp.n(5, 'password_changed') = 1, 'cambio de contraseña: se avisa aunque lo haya hecho uno mismo');

-- =====================================================================================================
-- ELO, medallas y temporadas
-- =====================================================================================================
select pg_temp.como(null);
insert into public.player_elo(steam_id, elo, peak_elo, matches) values (pg_temp.s(3), 1190, 1190, 5)
  on conflict (steam_id) do update set elo = 1190, matches = 5;
update public.player_elo set elo = 1210 where steam_id = pg_temp.s(3);
select pg_temp.ok(pg_temp.n(3, 'level_changed') = 1 and (select (data ->> 'to')::int from mias where type = 'level_changed') = 6, 'subió de nivel (5 → 6)');
update public.player_elo set elo = 1220 where steam_id = pg_temp.s(3);
select pg_temp.ok(pg_temp.n(3, 'level_changed') = 1, 'sin cambio de nivel, nada');
select set_config('v34.elo_recompute', 'on', true);
update public.player_elo set elo = 1100 where steam_id = pg_temp.s(3);
select set_config('v34.elo_recompute', 'off', true);
select pg_temp.ok(pg_temp.n(3, 'level_changed') = 1, 'dentro de un recálculo no se avisa');

insert into public.elo_adjustments(steam_id, delta, reason, applied_at, source) values (pg_temp.s(3), 20, 'Mix caído', now(), 'manual');
insert into public.elo_adjustments(steam_id, delta, reason, applied_at, source) values (pg_temp.s(3), 15, 'Mix borrado', now(), 'mix_kept');
select pg_temp.ok(pg_temp.n(3, 'elo_adjusted') = 1, 'ajuste del admin sí; el interno de un mix borrado no');

insert into public.player_medals(player_id, title, icon) values (pg_temp.f(3), 'MVP de la semana', '🔥');
select pg_temp.ok(pg_temp.n(3, 'medal_granted') = 1, 'medalla dada a mano');

-- =====================================================================================================
-- Veto
-- =====================================================================================================
insert into public.teams(id, name, tag, kind, owner_id, captain_id) values
  ('bbbbbbbb-2800-4000-8000-000000000002', 'Beta28', 'B28', 'official', pg_temp.u(5), pg_temp.u(5));
insert into public.matches(id, kind, status, team1, team2, best_of) values
  ('cccccccc-2800-4000-8000-000000000001', 'official', 'upcoming', 'bbbbbbbb-2800-4000-8000-000000000001', 'bbbbbbbb-2800-4000-8000-000000000002', 1);
select pg_temp.ok(pg_temp.n(3, 'veto_turn') = 1, 'empieza el veto: le toca a la líder del equipo 1');
insert into public.match_vetos(match_id, seq, team_id, map, action, by_user) values
  ('cccccccc-2800-4000-8000-000000000001', 1, 'bbbbbbbb-2800-4000-8000-000000000001', 'de_dust2', 'ban', pg_temp.u(3));
select pg_temp.ok(pg_temp.n(5, 'veto_turn') = 1, 'después le toca al equipo 2');
delete from public.match_vetos where match_id = 'cccccccc-2800-4000-8000-000000000001';
select pg_temp.ok(pg_temp.n(3, 'veto_reset') = 1 and pg_temp.n(5, 'veto_reset') = 1, 'reiniciar el veto avisa a los dos líderes');

update public.matches set status = 'finished', score1 = 1, score2 = 0, winner = 'bbbbbbbb-2800-4000-8000-000000000001'
 where id = 'cccccccc-2800-4000-8000-000000000001';
select pg_temp.ok(pg_temp.n(3, 'match_result') = 1, 'resultado: le llega al roster');

-- =====================================================================================================
-- Para la API
-- =====================================================================================================
select pg_temp.como(pg_temp.u(3)::text);
set local role authenticated;
select pg_temp.ok((select unread from public.notifications_unread()) = (select count(*) from public.notifications where read_at is null),
  'contador: sin leer');
select pg_temp.ok((select count(*) from public.notification_list) = (select count(*) from public.notifications), 'cada uno ve solo las suyas');
select pg_temp.ok(public.notifications_mark_read(array[(select max(id) from public.notifications)]) = 1, 'marcar una');
select pg_temp.ok(public.notifications_mark_read(null, true) >= 1, 'marcar todas');
select pg_temp.ok((select unread from public.notifications_unread()) = 0, 'el contador queda en 0');
reset role;

rollback;

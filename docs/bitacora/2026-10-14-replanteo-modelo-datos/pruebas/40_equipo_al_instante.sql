-- Pruebas de supabase/replanteo/40_equipo_al_instante.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.estado(q text) returns text language plpgsql as $$
declare s text; d text;
begin
  execute q;
  return null;
exception when others then
  get stacked diagnostics s = returned_sqlstate, d = pg_exception_detail;
  return s || coalesce(' ' || nullif(d, ''), '');
end $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119840' || lpad(n::text, 7, '0') $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.estado(text), pg_temp.s(int) to authenticated, anon;

-- Cuentas: admin (ad), Uno y Dos con SteamID, Tres sin ficha. Cinco jugadores sueltos para completar planteles.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-4000-4000-8000-0000000000ad', 'admin40@test.local', '{"tag":"Admin40"}', 'x'),
  ('aaaaaaaa-4000-4000-8000-000000000001', 'u1-40@test.local', '{"tag":"Uno40"}', 'x'),
  ('aaaaaaaa-4000-4000-8000-000000000002', 'u2-40@test.local', '{"tag":"Dos40"}', 'x'),
  ('aaaaaaaa-4000-4000-8000-000000000003', 'u3-40@test.local', '{"tag":"Tres40"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-4000-4000-8000-0000000000ad';
insert into public.players(id, nick, steam_id, user_id) values
  ('dddddddd-4000-4000-8000-000000000001', 'Uno40', pg_temp.s(1), 'aaaaaaaa-4000-4000-8000-000000000001'),
  ('dddddddd-4000-4000-8000-000000000002', 'Dos40', pg_temp.s(2), 'aaaaaaaa-4000-4000-8000-000000000002');
insert into public.players(id, nick, steam_id)
  select ('dddddddd-4000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'Suelto40_' || i, pg_temp.s(100 + i) from generate_series(1, 5) i;
insert into public.blocked_words(word) values ('malapalabra') on conflict do nothing;
update public.team_config set max_led = 1 where id = 1;

set local role authenticated;

-- ---------- crear ----------
select pg_temp.como('aaaaaaaa-4000-4000-8000-000000000003');
select pg_temp.ok(pg_temp.estado($q$select public.team_create('Sin Steam 40', 'SS40')$q$) = 'P0001', 'sin ficha ni SteamID: no crea');

select pg_temp.como('aaaaaaaa-4000-4000-8000-000000000001');
select pg_temp.ok(pg_temp.estado($q$select public.team_create('X', 'AB')$q$) = 'P0001', 'nombre de 1 letra: no');
select pg_temp.ok(pg_temp.estado($q$select public.team_create('Nombre largo', 'SIETE77')$q$) = 'P0001', 'sigla de 7: no');
select pg_temp.ok(pg_temp.estado($q$select public.team_create('Los malapalabra', 'MP40')$q$) = 'P0001', 'palabra bloqueada: no');
create temp table t40 (k text primary key, id uuid);
grant all on t40 to authenticated;
insert into t40 values ('uno', public.team_create('  Halcones 40  ', 'h40'));
select pg_temp.ok((select name = 'Halcones 40' and tag = 'H40' and captain_id = 'aaaaaaaa-4000-4000-8000-000000000001' and owner_id = captain_id
                     and kind = 'official' and founded_at is not null from public.teams where id = (select id from t40 where k = 'uno')),
                  'creado al instante: nombre sin espacios, sigla en mayúsculas, capitán y dueño');
select pg_temp.ok((select count(*) = 1 from public.team_members where team_id = (select id from t40 where k = 'uno')
                     and player_id = 'dddddddd-4000-4000-8000-000000000001' and left_at is null), 'el creador es el primer miembro');
select pg_temp.ok(pg_temp.estado($q$select public.team_create('Otro 40', 'OT40')$q$) = 'V3901 {"reason": "lead_limit", "max_led": 1}',
                  'segundo equipo con tope 1: V3901 con el tope');

select pg_temp.como('aaaaaaaa-4000-4000-8000-000000000002');
select pg_temp.ok(pg_temp.estado($q$select public.team_create('HALCONES 40', 'ZZ40')$q$) = 'V3901 {"reason":"name_taken"}', 'nombre tomado (sin mayúsculas): V3901');
select pg_temp.ok(pg_temp.estado($q$select public.team_create('Otro nombre 40', 'h40')$q$) = 'V3901 {"reason":"tag_taken"}', 'sigla tomada: V3901');
insert into t40 values ('dos', public.team_create('Cóndores 40', 'CN40'));

-- Pasar la capitanía a quien ya está en el tope: no.
reset role;
insert into public.team_members(team_id, player_id, joined_at) values ((select id from t40 where k = 'dos'), 'dddddddd-4000-4000-8000-000000000001', now());
set local role authenticated;
select pg_temp.ok(pg_temp.estado(format($q$select public.set_team_captain('%s', 'aaaaaaaa-4000-4000-8000-000000000001')$q$,
                                        (select id from t40 where k = 'dos'))) like 'V3901%', 'pasar la capitanía a uno en el tope: V3901');

-- ---------- tope configurable ----------
select pg_temp.ok(pg_temp.estado('select public.set_team_config(10, 2)') = '42501', 'el tope lo cambia solo un admin');
select pg_temp.como('aaaaaaaa-4000-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.estado('select public.set_team_config(10, 11)') = 'P0001', 'tope de 11: no');
select public.set_team_config(10, 2);
select pg_temp.ok((select max_members = 10 and max_led = 2 from public.team_config where id = 1), 'admin: tope en 2');
select public.set_team_config(10);
select pg_temp.ok((select max_led = 2 from public.team_config where id = 1), 'sin tope en la llamada: queda el que estaba');
select pg_temp.como('aaaaaaaa-4000-4000-8000-000000000001');
insert into t40 values ('uno_b', public.team_create('Segundo 40', 'SG40'));
select pg_temp.ok((select id from t40 where k = 'uno_b') is not null, 'con tope 2: crea el segundo');
-- Un disuelto no cuenta.
select public.team_dissolve((select id from t40 where k = 'uno_b'));
select pg_temp.como('aaaaaaaa-4000-4000-8000-0000000000ad');
select public.set_team_config(10, 1);
select pg_temp.como('aaaaaaaa-4000-4000-8000-000000000001');
select pg_temp.ok(pg_temp.estado($q$select public.team_create('Tercero 40', 'TR40')$q$) like 'V3901%', 'tope 1 con uno activo y uno disuelto: no');
-- El admin no tiene tope.
select pg_temp.como('aaaaaaaa-4000-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.estado(format($q$select public.set_team_captain('%s', 'aaaaaaaa-4000-4000-8000-000000000001')$q$,
                                        (select id from t40 where k = 'dos'))) is null, 'el admin pasa la capitanía sin tope');
select pg_temp.ok((select captain_id = 'aaaaaaaa-4000-4000-8000-000000000001' from public.teams where id = (select id from t40 where k = 'dos')),
                  'y queda como capitán de dos equipos');

-- ---------- para qué alcanza ----------
select pg_temp.ok((select missing = 4 from public.team_eligible_modes((select id from t40 where k = 'uno')) where code = '5v5'),
                  'un solo jugador: le faltan 4 para 5v5');
select pg_temp.ok((select missing = 0 from public.team_eligible_modes((select id from t40 where k = 'uno')) where code = '1v1'),
                  'un solo jugador: apto para 1v1');
reset role;
insert into public.team_members(team_id, player_id, joined_at, role)
  select (select id from t40 where k = 'uno'), ('dddddddd-4000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid, now(),
         case when i = 5 then 'coach' when i = 4 then 'sub' else 'player' end
    from generate_series(1, 5) i;
set local role authenticated;
select pg_temp.ok(public.team_players((select id from t40 where k = 'uno')) = 5, 'cuentan jugadores y suplentes, no el coach');
select pg_temp.ok(public.team_rankable((select id from t40 where k = 'uno')), 'con 5 entra al ranking');
select pg_temp.ok(not public.team_rankable((select id from t40 where k = 'dos')), 'con 2 no entra al ranking');
select pg_temp.ok((select missing = 0 from public.team_eligible_modes((select id from t40 where k = 'uno')) where code = '5v5'), 'con 5: apto para 5v5');

-- ---------- sin aprobación ----------
select pg_temp.ok(to_regprocedure('public.approve_team_request(uuid)') is null and to_regprocedure('public.cancel_team_request()') is null,
                  'ya no existen aprobar ni cancelar solicitudes');
select pg_temp.como('aaaaaaaa-4000-4000-8000-000000000002');
select pg_temp.ok(pg_temp.estado($q$insert into public.team_requests(user_id, name, tag, status) values ('aaaaaaaa-4000-4000-8000-000000000002', 'Pedido', 'PD', 'pending')$q$) = '42501',
                  'ya no se pueden mandar solicitudes');

rollback;

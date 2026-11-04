-- Pruebas de supabase/replanteo/43_moderar_equipos.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.estado(q text) returns text language plpgsql as $$
declare s text;
begin
  execute q;
  return null;
exception when others then
  get stacked diagnostics s = returned_sqlstate;
  return s;
end $$;
-- Lee los avisos de cualquiera (con el rol del dueño: las pruebas corren como otros usuarios).
create function pg_temp.avisos(u text, t text) returns int language sql security definer as $$
  select count(*)::int from public.notifications where user_id = u::uuid and type = t $$;
create function pg_temp.aviso(u text, t text) returns jsonb language sql security definer as $$
  select data from public.notifications where user_id = u::uuid and type = t order by id desc limit 1 $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.estado(text), pg_temp.avisos(text, text), pg_temp.aviso(text, text) to authenticated, anon;

-- Cuentas: admin (ad), moderador (mo), líder (c0) y jugador (01). Un equipo con el líder, el jugador y otro sin cuenta.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-4300-4000-8000-0000000000ad', 'admin43@test.local', '{"tag":"Admin43"}', 'x'),
  ('aaaaaaaa-4300-4000-8000-0000000000a0', 'mod43@test.local', '{"tag":"Mod43"}', 'x'),
  ('aaaaaaaa-4300-4000-8000-0000000000c0', 'cap43@test.local', '{"tag":"Cap43"}', 'x'),
  ('aaaaaaaa-4300-4000-8000-000000000001', 'uno43@test.local', '{"tag":"Uno43"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-4300-4000-8000-0000000000ad';
update public.profiles set role = 'moderator' where id = 'aaaaaaaa-4300-4000-8000-0000000000a0';
insert into public.players(id, nick, steam_id, user_id) values
  ('dddddddd-4300-4000-8000-0000000000c0', 'Cap43', '76561198430000000', 'aaaaaaaa-4300-4000-8000-0000000000c0'),
  ('dddddddd-4300-4000-8000-000000000001', 'Uno43', '76561198430000001', 'aaaaaaaa-4300-4000-8000-000000000001'),
  ('dddddddd-4300-4000-8000-000000000002', 'Dos43', '76561198430000002', null),
  ('dddddddd-4300-4000-8000-000000000003', 'Tres43', '76561198430000003', null);
insert into public.blocked_words(word) values ('malapalabra') on conflict do nothing;

set local role authenticated;
select pg_temp.como('aaaaaaaa-4300-4000-8000-0000000000c0');
create temp table e43 as select public.team_create('Normal 43', 'MP43') as id;
select pg_temp.ok(pg_temp.estado('select 1') is null, 'arranque');
reset role;
select set_config('request.jwt.claims', '{}', true);
-- El nombre ofensivo lo puso un admin a mano (los usuarios no pueden): así aparece en la lista como bloqueado.
update public.teams set name = 'Los malapalabra 43' where id = (select id from e43);
insert into public.team_members(team_id, player_id, joined_at) values
  ((select id from e43), 'dddddddd-4300-4000-8000-000000000001', now()),
  ((select id from e43), 'dddddddd-4300-4000-8000-000000000002', now());
set local role authenticated;

-- ---------- historial y lista ----------
select pg_temp.como('aaaaaaaa-4300-4000-8000-0000000000a0');
select pg_temp.ok((select array_agg(action order by id) from public.team_audit where team_id = (select id from e43))
                  = array['created', 'member_added', 'renamed', 'member_added', 'member_added'], 'el historial registra crear, sumar y renombrar');
select pg_temp.ok((select actor_role from public.team_audit where team_id = (select id from e43) and action = 'created') = 'team', 'lo hizo el equipo');
select pg_temp.ok((select actor_role from public.team_audit where team_id = (select id from e43) and action = 'renamed') = 'system', 'una carga sin usuario queda como sistema');
select pg_temp.ok((select blocked and members = 3 and players = 3 and captain_alias = 'Cap43' from public.admin_team_list where id = (select id from e43)),
                  'la lista marca la palabra bloqueada y cuenta el plantel');
select pg_temp.como('aaaaaaaa-4300-4000-8000-000000000001');
select pg_temp.ok((select count(*) from public.team_audit where team_id = (select id from e43)) = 0, 'un jugador no ve el historial');

-- ---------- moderador ----------
select pg_temp.como('aaaaaaaa-4300-4000-8000-0000000000a0');
select pg_temp.ok(pg_temp.estado(format($q$select public.team_staff_rename('%s', 'Otra malapalabra', 'OM43')$q$, (select id from e43))) = 'P0001',
                  'el moderador tampoco puede poner una palabra bloqueada');
select public.team_staff_rename((select id from e43), 'Halcones 43', 'HC43', '  Palabra no permitida  ');
select pg_temp.ok((select name = 'Halcones 43' and tag = 'HC43' and name_changed_at is null from public.teams where id = (select id from e43)),
                  'renombrado sin tocar la espera de 30 días del equipo');
select pg_temp.ok((select actor_role = 'moderator' and reason = 'Palabra no permitida' and data->>'old_name' = 'Los malapalabra 43'
                     from public.team_audit where team_id = (select id from e43) and action = 'renamed' order by id desc limit 1),
                  'el historial guarda al moderador y el motivo');
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-4300-4000-8000-0000000000c0', 'team_staff_action') = 1, 'el líder recibe el aviso');
select pg_temp.ok((select d->>'reason' = 'Palabra no permitida' and d->>'by' = 'moderator' and d->>'action' = 'renamed'
                     from pg_temp.aviso('aaaaaaaa-4300-4000-8000-0000000000c0', 'team_staff_action') d),
                  'con el motivo y quién');
select pg_temp.ok(pg_temp.estado(format($q$select public.team_staff_remove_member('%s', 'dddddddd-4300-4000-8000-0000000000c0')$q$, (select id from e43))) = 'V3901',
                  'al líder no se lo saca directo');
select public.team_staff_remove_member((select id from e43), 'dddddddd-4300-4000-8000-000000000001');
select pg_temp.ok((select d is not null and d->>'reason' is null from pg_temp.aviso('aaaaaaaa-4300-4000-8000-000000000001', 'team_removed') d),
                  'sin motivo: el jugador recibe su aviso de siempre');
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-4300-4000-8000-0000000000c0', 'team_staff_action') = 2, 'y el líder también, sin motivo');
select pg_temp.ok(pg_temp.estado(format($q$select public.team_staff_set_captain('%s', 'dddddddd-4300-4000-8000-000000000002')$q$, (select id from e43))) = '42501',
                  'el moderador no cambia el líder');
select pg_temp.ok(pg_temp.estado(format($q$select public.team_staff_dissolve('%s')$q$, (select id from e43))) = '42501', 'ni disuelve');
select pg_temp.ok(pg_temp.estado(format($q$select public.team_staff_remove_logo('%s')$q$, (select id from e43))) = 'P0001', 'sin logo no hay nada que quitar');

-- ---------- admin ----------
select pg_temp.como('aaaaaaaa-4300-4000-8000-0000000000ad');
select public.team_staff_add_member((select id from e43), 'dddddddd-4300-4000-8000-000000000003', 'sub', 'Refuerzo');
select public.team_staff_set_role((select id from e43), 'dddddddd-4300-4000-8000-000000000003', 'player');
select pg_temp.ok((select role = 'player' from public.team_members where team_id = (select id from e43) and player_id = 'dddddddd-4300-4000-8000-000000000003' and left_at is null),
                  'el admin suma y cambia el rol');
select pg_temp.ok(pg_temp.estado(format($q$select public.team_staff_set_captain('%s', 'dddddddd-4300-4000-8000-000000000002')$q$, (select id from e43))) = 'P0001',
                  'un jugador sin cuenta no puede ser líder');
reset role;
update public.players set user_id = 'aaaaaaaa-4300-4000-8000-000000000001' where id = 'dddddddd-4300-4000-8000-000000000001';
insert into public.team_members(team_id, player_id, joined_at) values ((select id from e43), 'dddddddd-4300-4000-8000-000000000001', now());
set local role authenticated;
select pg_temp.como('aaaaaaaa-4300-4000-8000-0000000000ad');
select public.team_staff_set_captain((select id from e43), 'dddddddd-4300-4000-8000-000000000001', 'El líder pidió irse');
select pg_temp.ok((select captain_id = 'aaaaaaaa-4300-4000-8000-000000000001' from public.teams where id = (select id from e43)), 'el admin cambia el líder');
select pg_temp.ok((select actor_role = 'admin' and reason = 'El líder pidió irse' from public.team_audit
                    where team_id = (select id from e43) and action = 'captain_changed'), 'historial del admin con motivo');
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-4300-4000-8000-000000000001', 'team_staff_action') = 1, 'el aviso va al líder nuevo');
select pg_temp.ok(pg_temp.avisos('aaaaaaaa-4300-4000-8000-0000000000c0', 'team_staff_action') = 5, 'y al anterior (renombrar, quitar, sumar, rol y líder)');
select public.team_staff_dissolve((select id from e43));
select pg_temp.ok((select dissolved_at is not null from public.teams where id = (select id from e43)), 'el admin disuelve');
select pg_temp.ok(not exists (select 1 from public.admin_team_list where id = (select id from e43)), 'un disuelto no aparece en la lista');
select pg_temp.ok(pg_temp.estado(format($q$select public.team_staff_rename('%s', 'Nuevo 43', 'NV43')$q$, (select id from e43))) = 'P0002',
                  'un disuelto es como si no existiera');
select pg_temp.ok((select count(*) from public.team_audit where team_id = (select id from e43) and action = 'dissolved') = 1, 'disolver queda una sola vez en el historial');

-- Las preferencias no apagan el aviso del staff.
select pg_temp.ok(public.notification_required('team_staff_action') and public.notification_category('team_staff_action') = 'team',
                  'team_staff_action es obligatoria y de equipo');

rollback;

-- Pruebas de supabase/replanteo/22_cancelar_desvincular_password.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119822' || lpad(n::text, 7, '0') $$;
-- Mensaje del error de una sentencia, o null si no falla.
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.s(int), pg_temp.error(text) to authenticated;

-- Admin y dos cuentas: la 1 con principal 1 y adicionales 2 y 3; la 2 con principal 4 y adicional 5.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-2200-4000-8000-0000000000ad', 'admin22@test.local', '{"tag":"Admin22"}', 'x'),
  ('aaaaaaaa-2200-4000-8000-000000000001', 'u1-22@test.local', '{"tag":"Uno22"}', 'x'),
  ('aaaaaaaa-2200-4000-8000-000000000002', 'u2-22@test.local', '{"tag":"Dos22"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-2200-4000-8000-0000000000ad';
insert into public.players(id, nick, user_id, steam_id) values
  ('dddddddd-2200-4000-8000-000000000001', 'x1', 'aaaaaaaa-2200-4000-8000-000000000001', pg_temp.s(1)),
  ('dddddddd-2200-4000-8000-000000000002', 'x2', 'aaaaaaaa-2200-4000-8000-000000000002', pg_temp.s(4));
insert into public.player_extra_steam_ids(steam_id, player_id, added_at) values
  (pg_temp.s(2), 'dddddddd-2200-4000-8000-000000000001', '2026-01-02'),
  (pg_temp.s(3), 'dddddddd-2200-4000-8000-000000000001', '2026-01-03'),
  (pg_temp.s(5), 'dddddddd-2200-4000-8000-000000000002', '2026-01-05');

-- ---------- fecha del último cambio de contraseña ----------
select pg_temp.ok((select password_changed_at is null from public.profiles where id = 'aaaaaaaa-2200-4000-8000-000000000001'),
  'cuenta nueva: sin fecha de cambio de contraseña');
update auth.users set last_sign_in_at = now() where id = 'aaaaaaaa-2200-4000-8000-000000000001';
select pg_temp.ok((select password_changed_at is null from public.profiles where id = 'aaaaaaaa-2200-4000-8000-000000000001'),
  'otro cambio en auth.users (login) no la toca');
update auth.users set encrypted_password = 'x' where id = 'aaaaaaaa-2200-4000-8000-000000000001';
select pg_temp.ok((select password_changed_at is null from public.profiles where id = 'aaaaaaaa-2200-4000-8000-000000000001'),
  'la misma contraseña (sin cambio real) no la toca');
update auth.users set encrypted_password = 'y' where id = 'aaaaaaaa-2200-4000-8000-000000000001';
select pg_temp.ok((select password_changed_at = now() from public.profiles where id = 'aaaaaaaa-2200-4000-8000-000000000001'),
  'cambiar la contraseña guarda la fecha');
select pg_temp.ok((select password_changed_at is null from public.profiles where id = 'aaaaaaaa-2200-4000-8000-000000000002'),
  'la de otra cuenta no cambia');

set local role authenticated;
select pg_temp.como('aaaaaaaa-2200-4000-8000-000000000001');
select pg_temp.ok((select password_changed_at is not null from public.profiles where id = 'aaaaaaaa-2200-4000-8000-000000000001'),
  'el usuario lee su fecha');
select pg_temp.error($q$update public.profiles set password_changed_at = null where id = 'aaaaaaaa-2200-4000-8000-000000000001'$q$);
select pg_temp.ok((select password_changed_at is not null from public.profiles where id = 'aaaaaaaa-2200-4000-8000-000000000001'),
  'el usuario no la puede cambiar a mano');

-- ---------- cancelar el pedido de desvincular ----------
select pg_temp.ok(pg_temp.error(format('select public.cancel_steam_unlink(%L)', pg_temp.s(2))) like 'No tenés un pedido pendiente%',
  'sin pedido no hay nada para cancelar');
select public.request_steam_unlink(pg_temp.s(2), 'cuenta vieja');
select public.cancel_steam_unlink(pg_temp.s(2));
select pg_temp.ok((select status = 'cancelled' and resolved_at is not null and resolved_by = 'aaaaaaaa-2200-4000-8000-000000000001'
                     from public.steam_requests where steam_id = pg_temp.s(2)),
  'el pedido queda cancelled con fecha y quién');
select pg_temp.ok((select count(*) = 1 from public.player_steam_all where steam_id = pg_temp.s(2)),
  'el SteamID sigue en la ficha');
select pg_temp.ok(pg_temp.error(format('select public.cancel_steam_unlink(%L)', pg_temp.s(2))) like 'No tenés un pedido pendiente%',
  'cancelar dos veces falla');
-- Después de cancelar se puede volver a pedir, y el SteamID puede ser principal.
select public.request_steam_unlink(pg_temp.s(2), null);
select pg_temp.ok((select count(*) = 1 from public.steam_requests where steam_id = pg_temp.s(2) and status = 'pending'),
  'se puede pedir de nuevo después de cancelar');
select public.cancel_steam_unlink(pg_temp.s(2));
select public.set_my_primary_steam(pg_temp.s(2));
select pg_temp.ok((select steam_id = pg_temp.s(2) from public.players where id = 'dddddddd-2200-4000-8000-000000000001'),
  'cancelado, el SteamID puede ser principal');

-- Otra cuenta no puede cancelar un pedido ajeno.
select public.request_steam_unlink(pg_temp.s(3), null);
select pg_temp.como('aaaaaaaa-2200-4000-8000-000000000002');
select pg_temp.ok(pg_temp.error(format('select public.cancel_steam_unlink(%L)', pg_temp.s(3))) like 'No tenés un pedido pendiente%',
  'no se cancela el pedido de otra cuenta');

-- Un pedido ya resuelto por el admin no se cancela.
select pg_temp.como('aaaaaaaa-2200-4000-8000-0000000000ad');
select public.reject_steam_request((select id from public.steam_requests where steam_id = pg_temp.s(3) and status = 'pending'), 'no');
select pg_temp.como('aaaaaaaa-2200-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error(format('select public.cancel_steam_unlink(%L)', pg_temp.s(3))) like 'No tenés un pedido pendiente%',
  'un pedido rechazado no se cancela');

-- El admin no puede aprobar ni rechazar uno cancelado, y lo ve en la bandeja.
select pg_temp.como('aaaaaaaa-2200-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error(format('select public.approve_steam_request(%s)',
  (select max(id) from public.steam_requests where steam_id = pg_temp.s(2) and status = 'cancelled'))) like 'La solicitud ya no está pendiente (cancelled)',
  'el admin no aprueba un pedido cancelado');
select pg_temp.ok((select count(*) = 2 from public.admin_steam_requests where steam_id = pg_temp.s(2) and status = 'cancelled' and status_order = 1),
  'la bandeja del admin muestra los cancelados después de los pendientes');

-- Sin sesión.
select set_config('request.jwt.claims', '', true);
select pg_temp.ok(pg_temp.error(format('select public.cancel_steam_unlink(%L)', pg_temp.s(3))) like 'Iniciá sesión%',
  'sin sesión no se cancela');

rollback;

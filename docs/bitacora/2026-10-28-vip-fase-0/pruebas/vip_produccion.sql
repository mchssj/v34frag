-- Pruebas de supabase/migrations/20261028120000_vip.sql, sobre la base de producción (sin replanteo). Todo con rollback.
-- Los avisos se prueban en docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/32_vip.sql.
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
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.error(text) to authenticated, anon;

-- Cuentas: admin, usuarios U1 (con ficha), U2, U3 y U4. Las fechas se comparan con un margen de un minuto.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3200-4000-8000-0000000000ad', 'admin32@test.local', '{"tag":"Admin32"}', 'x'),
  ('aaaaaaaa-3200-4000-8000-000000000001', 'u1-32@test.local', '{"tag":"Uno32"}', 'x'),
  ('aaaaaaaa-3200-4000-8000-000000000002', 'u2-32@test.local', '{"tag":"Dos32"}', 'x'),
  ('aaaaaaaa-3200-4000-8000-000000000003', 'u3-32@test.local', '{"tag":"Tres32"}', 'x'),
  ('aaaaaaaa-3200-4000-8000-000000000004', 'u4-32@test.local', '{"tag":"Cuatro32"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-3200-4000-8000-0000000000ad';
insert into public.players(id, nick, user_id) values
  ('dddddddd-3200-4000-8000-000000000001', 'Ficha32', 'aaaaaaaa-3200-4000-8000-000000000001');

create function pg_temp.cerca(a timestamptz, b timestamptz) returns boolean language sql as $$
  select a is not null and b is not null and abs(extract(epoch from a - b)) < 60 $$;
grant execute on function pg_temp.cerca(timestamptz, timestamptz) to authenticated, anon;

-- =====================================================================================================
-- 1. Permisos
-- =====================================================================================================
set local role authenticated;
select pg_temp.como('aaaaaaaa-3200-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000001', 1)$q$)
                  = 'Solo un administrador puede dar VIP', 'un usuario no se da VIP');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_revoke('aaaaaaaa-3200-4000-8000-000000000001', 'x')$q$)
                  = 'Solo un administrador puede quitar VIP', 'un usuario no quita VIP');
select pg_temp.ok(pg_temp.error($q$insert into public.vip_memberships(user_id, source) values ('aaaaaaaa-3200-4000-8000-000000000001', 'manual')$q$)
                  like 'permission denied%', 'nadie escribe la tabla directo');
select pg_temp.ok(not public.is_vip(), 'sin VIP, is_vip da false');

-- =====================================================================================================
-- 2. Validaciones
-- =====================================================================================================
select pg_temp.como('aaaaaaaa-3200-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000001')$q$)
                  = 'Elegí una duración: meses, una fecha o lifetime', 'sin duración');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000001', 1, null, true)$q$)
                  = 'Elegí una duración: meses, una fecha o lifetime', 'dos duraciones a la vez');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000001', 2)$q$)
                  = 'Los meses tienen que ser 1, 3, 6 o 12', 'meses fuera de la lista');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000001', null, now() - interval '1 day')$q$)
                  like 'La fecha tiene que ser posterior al %', 'fecha en el pasado');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000001', 1, null, false, repeat('x', 201))$q$)
                  = 'La nota puede tener hasta 200 caracteres', 'nota larga');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-0000000000ff', 1)$q$)
                  = 'No existe ese usuario', 'cuenta que no existe');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_revoke('aaaaaaaa-3200-4000-8000-000000000001', '  ')$q$)
                  like 'El motivo es obligatorio%', 'quitar sin motivo');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_revoke('aaaaaaaa-3200-4000-8000-000000000001', 'x')$q$)
                  = 'No tiene VIP vigente', 'quitar sin VIP');

-- =====================================================================================================
-- 3. Dar y extender
-- =====================================================================================================
-- U1: 1 mes y después 3 más (el segundo empieza donde termina el primero).
select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000001', 1, null, false, ' pagó 1 mes ');
select pg_temp.ok(public.is_vip('aaaaaaaa-3200-4000-8000-000000000001'), 'con 1 mes es VIP');
select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000001', 3);
reset role;
select pg_temp.ok((select count(*) = 2 and bool_and(source = 'manual' and granted_by = 'aaaaaaaa-3200-4000-8000-0000000000ad')
                     from public.vip_memberships where user_id = 'aaaaaaaa-3200-4000-8000-000000000001'),
  'cada vez que se da es un período, con quién lo dio');
select pg_temp.ok((select note = 'pagó 1 mes' from public.vip_memberships
                    where user_id = 'aaaaaaaa-3200-4000-8000-000000000001' order by created_at, starts_at limit 1), 'la nota sin espacios');
select pg_temp.ok((select pg_temp.cerca(b.starts_at, a.ends_at) and pg_temp.cerca(b.ends_at, a.ends_at + interval '3 months')
                     from (select * from public.vip_memberships where user_id = 'aaaaaaaa-3200-4000-8000-000000000001' order by starts_at limit 1) a,
                          (select * from public.vip_memberships where user_id = 'aaaaaaaa-3200-4000-8000-000000000001' order by starts_at desc limit 1) b),
  'extender empieza donde termina el vigente');
select pg_temp.ok((select pg_temp.cerca(until, now() + interval '1 month' + interval '3 months') and status = 'active' and not lifetime
                     from public.vip_status where user_id = 'aaaaaaaa-3200-4000-8000-000000000001'),
  'vip_status: activo hasta el fin del último período');

-- U2: un período que ya venció; dar de nuevo empieza ahora.
insert into public.vip_memberships(user_id, starts_at, ends_at, source)
values ('aaaaaaaa-3200-4000-8000-000000000002', now() - interval '2 months', now() - interval '1 month', 'import');
select pg_temp.ok(not public.is_vip('aaaaaaaa-3200-4000-8000-000000000002'), 'vencido no es VIP');
select pg_temp.ok((select status = 'expired' and until is null and not active from public.vip_status where user_id = 'aaaaaaaa-3200-4000-8000-000000000002'),
  'vip_status: vencido');
set local role authenticated;
select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000002', null, now() + interval '10 days');
reset role;
select pg_temp.ok((select pg_temp.cerca(starts_at, now()) and pg_temp.cerca(ends_at, now() + interval '10 days')
                     from public.vip_memberships where user_id = 'aaaaaaaa-3200-4000-8000-000000000002' and source = 'manual'),
  'después de vencido, dar de nuevo empieza ahora; con fecha, termina en esa fecha');
select pg_temp.ok((select pg_temp.cerca(since, now() - interval '2 months') from public.vip_status where user_id = 'aaaaaaaa-3200-4000-8000-000000000002'),
  'since es el inicio del primer período');
set local role authenticated;
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000002', null, now() + interval '5 days')$q$)
                  like 'La fecha tiene que ser posterior al %', 'con VIP vigente, la fecha tiene que pasar el fin actual');

-- U3: lifetime.
select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000003', null, null, true, 'apoyo inicial');
select pg_temp.ok(public.is_vip('aaaaaaaa-3200-4000-8000-000000000003'), 'lifetime es VIP');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000003', 1)$q$)
                  = 'Ya es VIP lifetime', 'un temporal a un lifetime se rechaza');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000003', null, null, true)$q$)
                  = 'Ya es VIP lifetime', 'lifetime dos veces se rechaza');
select pg_temp.ok((select status = 'lifetime' and lifetime and until is null from public.vip_status where user_id = 'aaaaaaaa-3200-4000-8000-000000000003'),
  'vip_status: lifetime sin fecha de fin');

-- U1 pasa a lifetime con su temporal vigente.
select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000001', null, null, true);
select pg_temp.ok((select status = 'lifetime' and until is null from public.vip_status where user_id = 'aaaaaaaa-3200-4000-8000-000000000001'),
  'un temporal puede pasar a lifetime');

-- =====================================================================================================
-- 4. Quitar
-- =====================================================================================================
select pg_temp.ok(public.admin_vip_revoke('aaaaaaaa-3200-4000-8000-000000000001', ' baneado ') = 3,
  'quitar revoca todos los vigentes y futuros, también el lifetime');
select pg_temp.ok(not public.is_vip('aaaaaaaa-3200-4000-8000-000000000001'), 'después de quitarlo no es VIP');
reset role;
select pg_temp.ok((select bool_and(revoked_by = 'aaaaaaaa-3200-4000-8000-0000000000ad' and revoke_reason = 'baneado')
                     from public.vip_memberships where user_id = 'aaaaaaaa-3200-4000-8000-000000000001'),
  'la revocación guarda quién y el motivo');
select pg_temp.ok((select status = 'revoked' and not active from public.vip_status where user_id = 'aaaaaaaa-3200-4000-8000-000000000001'),
  'vip_status: revocado');
-- U2: un vencido y uno vigente; quitar no toca el vencido.
set local role authenticated;
select pg_temp.ok(public.admin_vip_revoke('aaaaaaaa-3200-4000-8000-000000000002', 'error') = 1, 'quitar no toca los vencidos');
select pg_temp.ok(pg_temp.error($q$select public.admin_vip_revoke('aaaaaaaa-3200-4000-8000-000000000002', 'x')$q$)
                  = 'No tiene VIP vigente', 'quitar dos veces');
-- Dar de nuevo después de revocado.
select public.admin_vip_grant('aaaaaaaa-3200-4000-8000-000000000001', 6);
select pg_temp.ok(public.is_vip('aaaaaaaa-3200-4000-8000-000000000001'), 'después de revocado se puede dar de nuevo');
reset role;
select pg_temp.ok((select pg_temp.cerca(starts_at, now()) from public.vip_memberships
                    where user_id = 'aaaaaaaa-3200-4000-8000-000000000001' and revoked_at is null),
  'los revocados no cuentan para extender: empieza ahora');

-- =====================================================================================================
-- 5. Lectura
-- =====================================================================================================
set local role authenticated;
select pg_temp.como('aaaaaaaa-3200-4000-8000-000000000003');
select pg_temp.ok((select count(*) = 1 from public.vip_memberships), 'cada uno ve solo sus períodos');
select pg_temp.ok((select count(*) = 1 and bool_and(user_id = 'aaaaaaaa-3200-4000-8000-000000000003') from public.vip_status),
  'vip_status: el dueño ve solo la suya');
select pg_temp.ok(public.is_vip(), 'is_vip sin argumento es la cuenta de la sesión');
select pg_temp.como('aaaaaaaa-3200-4000-8000-0000000000ad');
select pg_temp.ok((select count(*) = 3 from public.vip_status where user_id::text like 'aaaaaaaa-3200-%'), 'el admin ve todas');
select pg_temp.ok((select player_id = 'dddddddd-3200-4000-8000-000000000001' and alias = 'Uno32'
                     from public.vip_status where user_id = 'aaaaaaaa-3200-4000-8000-000000000001'),
  'vip_status trae el alias y la ficha');
reset role;
set local role anon;
select pg_temp.ok((select count(*) = 2 from public.vip_public where user_id::text like 'aaaaaaaa-3200-%'),
  'vip_public: los VIP de hoy, sin sesión');
select pg_temp.ok((select player_id = 'dddddddd-3200-4000-8000-000000000001' from public.vip_public
                    where user_id = 'aaaaaaaa-3200-4000-8000-000000000001'), 'vip_public trae la ficha');
select pg_temp.ok(public.is_vip('aaaaaaaa-3200-4000-8000-000000000003'), 'is_vip se puede consultar sin sesión');
select pg_temp.ok(pg_temp.error($q$select * from public.vip_status$q$) like 'permission denied%', 'vip_status no se lee sin sesión');
select pg_temp.ok(pg_temp.error($q$select * from public.vip_memberships$q$) like 'permission denied%', 'la tabla no se lee sin sesión');
reset role;

rollback;

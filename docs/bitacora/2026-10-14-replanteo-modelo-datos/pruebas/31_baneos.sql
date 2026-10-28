-- Pruebas de supabase/replanteo/31_baneos.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119831' || lpad(n::text, 7, '0') $$;
-- Mensaje del error de una sentencia, o null si no falla.
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.s(int), pg_temp.error(text) to authenticated, anon;

-- Cuentas: admin, moderador, organizador y usuario. Fichas: F1 (SteamID 1 y adicional 2), F2 (5). SteamID 3 y 4 sin ficha.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3100-4000-8000-0000000000ad', 'admin31@test.local', '{"tag":"Admin31"}', 'x'),
  ('aaaaaaaa-3100-4000-8000-0000000000aa', 'mod31@test.local', '{"tag":"Mod31"}', 'x'),
  ('aaaaaaaa-3100-4000-8000-0000000000bb', 'org31@test.local', '{"tag":"Org31"}', 'x'),
  ('aaaaaaaa-3100-4000-8000-000000000001', 'u1-31@test.local', '{"tag":"Uno31"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-3100-4000-8000-0000000000ad';
update public.profiles set role = 'organizer' where id = 'aaaaaaaa-3100-4000-8000-0000000000bb';
insert into public.players(id, nick, steam_id) values
  ('dddddddd-3100-4000-8000-000000000001', 'Ficha31', pg_temp.s(1)),
  ('dddddddd-3100-4000-8000-000000000002', 'Otra31', pg_temp.s(5)),
  ('dddddddd-3100-4000-8000-000000000003', 'SinSteam31', null);
insert into public.player_extra_steam_ids(steam_id, player_id, added_at) values (pg_temp.s(2), 'dddddddd-3100-4000-8000-000000000001', '2026-01-02');
insert into public.game_servers(id, name, token_hash) values
  ('eeeeeeee-3100-4000-8000-000000000001', 'Server 31', encode(sha256(convert_to('token-ban-31', 'UTF8')), 'hex'));

-- =====================================================================================================
-- 1. Rol de moderador
-- =====================================================================================================
set local role authenticated;
select pg_temp.como('aaaaaaaa-3100-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error($q$select public.set_user_role('aaaaaaaa-3100-4000-8000-0000000000aa', 'moderator')$q$)
                  = 'Solo un administrador puede cambiar roles', 'un usuario no da roles');
select pg_temp.como('aaaaaaaa-3100-4000-8000-0000000000ad');
select public.set_user_role('aaaaaaaa-3100-4000-8000-0000000000aa', 'moderator');
select pg_temp.ok(pg_temp.error($q$select public.set_user_role('aaaaaaaa-3100-4000-8000-0000000000aa', 'admin')$q$)
                  = 'El rol tiene que ser user, organizer o moderator', 'el rol admin no se da desde la web');
select pg_temp.ok(public.is_moderator() and public.is_organizer(), 'el admin modera y organiza');
select pg_temp.como('aaaaaaaa-3100-4000-8000-0000000000aa');
select pg_temp.ok(public.is_moderator() and not public.is_organizer() and not public.is_admin(), 'el moderador modera y nada más');
select pg_temp.como('aaaaaaaa-3100-4000-8000-0000000000bb');
select pg_temp.ok(not public.is_moderator(), 'el organizador no modera');

-- =====================================================================================================
-- 2. Banear desde la web
-- =====================================================================================================
select pg_temp.ok(pg_temp.error($q$select public.ban_create('dddddddd-3100-4000-8000-000000000001', null, 'x', now() + interval '1 day')$q$)
                  = 'Solo moderadores y admins pueden banear', 'un organizador no banea');
select pg_temp.como('aaaaaaaa-3100-4000-8000-0000000000aa');
select pg_temp.ok(pg_temp.error($q$select public.ban_create('dddddddd-3100-4000-8000-000000000001', null, 'Wallhack', null)$q$)
                  = 'Solo un admin puede banear de forma permanente', 'el moderador no banea permanente');
select pg_temp.ok(pg_temp.error($q$select public.ban_create('dddddddd-3100-4000-8000-000000000001', pg_temp.s(1), 'x', now() + interval '1 day')$q$)
                  = 'Elegí una ficha o un SteamID, uno de los dos', 'ficha o SteamID, no los dos');
select pg_temp.ok(pg_temp.error($q$select public.ban_create('dddddddd-3100-4000-8000-000000000001', null, 'x', now() - interval '1 day')$q$)
                  = 'El vencimiento tiene que ser futuro', 'vencimiento en el pasado');
select pg_temp.ok(pg_temp.error($q$select public.ban_create('dddddddd-3100-4000-8000-000000000001', null, '  ', now() + interval '1 day')$q$)
                  like 'El motivo es obligatorio%', 'motivo obligatorio');
select pg_temp.ok(pg_temp.error($q$select public.ban_create('dddddddd-3100-4000-8000-000000000003', null, 'x', now() + interval '1 day')$q$)
                  like 'La ficha no tiene SteamID%', 'una ficha sin SteamID no se banea');
select pg_temp.ok(pg_temp.error($q$select public.ban_create(null, '123', 'x', now() + interval '1 day')$q$)
                  = 'SteamID inválido', 'SteamID inválido');
select pg_temp.ok(pg_temp.error($q$select * from public.bans$q$) like 'permission denied%', 'la tabla no se lee directo');

select set_config('t.b1', public.ban_create('dddddddd-3100-4000-8000-000000000001', null, ' Wallhack ', now() + interval '7 days')::text, true);
select set_config('t.b2', public.ban_create('dddddddd-3100-4000-8000-000000000001', null, 'Insultos', now() + interval '3 days')::text, true);
reset role;
select pg_temp.ok((select player_id = 'dddddddd-3100-4000-8000-000000000001' and steam_id = pg_temp.s(1) and nick = 'Ficha31'
                          and reason = 'Wallhack' and source = 'web' and created_by = 'aaaaaaaa-3100-4000-8000-0000000000aa'
                     from public.bans where id = current_setting('t.b1')::uuid),
  'el baneo de una ficha guarda la ficha, su SteamID principal, el nick y quién');
select pg_temp.ok((select lifted_at is not null and replaced_by = current_setting('t.b2')::uuid and lift_reason = 'Reemplazado por un baneo nuevo'
                     from public.bans where id = current_setting('t.b1')::uuid),
  'un baneo nuevo levanta el anterior y lo apunta');
select pg_temp.ok((select count(*) = 1 from public.ban_active_for(pg_temp.s(1))), 'un solo baneo activo por ficha');
select pg_temp.ok((select r @> '{"ok": true, "banned": true, "reason": "Insultos"}' from public.csstv_ban_check('token-ban-31', pg_temp.s(2)) r),
  'el SteamID adicional de la ficha también está baneado');
select pg_temp.ok((select r @> '{"ok": true, "banned": true}' from public.csstv_ban_check('token-ban-31', public.csstv_steam0(pg_temp.s(1))) r),
  'el plugin puede consultar con STEAM_0');

-- =====================================================================================================
-- 3. Cambiar y levantar
-- =====================================================================================================
set local role authenticated;
select pg_temp.como('aaaaaaaa-3100-4000-8000-0000000000aa');
select public.ban_update(current_setting('t.b2')::uuid, null, now() + interval '10 days');
select pg_temp.ok(pg_temp.error(format($q$select public.ban_update(%L, null, null, true)$q$, current_setting('t.b2')))
                  = 'Solo un admin puede banear de forma permanente', 'el moderador no lo vuelve permanente');
select pg_temp.ok(pg_temp.error(format($q$select public.ban_update(%L, null, null)$q$, current_setting('t.b2')))
                  = 'No hay nada que cambiar', 'sin cambios');
select pg_temp.como('aaaaaaaa-3100-4000-8000-0000000000ad');
select public.ban_update(current_setting('t.b2')::uuid, 'Insultos graves', null, true);
select pg_temp.como('aaaaaaaa-3100-4000-8000-0000000000aa');
select pg_temp.ok(pg_temp.error(format($q$select public.ban_update(%L, 'otro', null)$q$, current_setting('t.b2')))
                  = 'Solo un admin puede cambiar un baneo permanente', 'el moderador no cambia uno permanente');
select pg_temp.ok(pg_temp.error(format($q$select public.ban_lift(%L, 'perdón')$q$, current_setting('t.b2')))
                  = 'Solo un admin puede levantar un baneo permanente', 'el moderador no levanta uno permanente');
select pg_temp.ok(pg_temp.error($q$select public.ban_create('dddddddd-3100-4000-8000-000000000001', null, 'x', now() + interval '1 day')$q$)
                  = 'Ya tiene un baneo permanente: solo un admin lo puede cambiar', 'el moderador no reemplaza uno permanente');
select pg_temp.como('aaaaaaaa-3100-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error(format($q$select public.ban_lift(%L, '')$q$, current_setting('t.b2'))) like 'El motivo es obligatorio%',
  'levantar pide motivo');
select public.ban_lift(current_setting('t.b2')::uuid, 'Apelación aceptada');
select pg_temp.ok(pg_temp.error(format($q$select public.ban_lift(%L, 'otra vez')$q$, current_setting('t.b2')))
                  = 'Ese baneo ya no está activo', 'no se levanta dos veces');
reset role;
select pg_temp.ok((select status = 'lifted' and permanent and reason = 'Insultos graves' and lift_reason = 'Apelación aceptada'
                          and lifted_by_alias = 'Admin31'
                     from public.ban_list where id = current_setting('t.b2')::uuid),
  'la vista muestra el levantado, el motivo y quién');
select pg_temp.ok((select r = '{"ok": true, "banned": false}' from public.csstv_ban_check('token-ban-31', pg_temp.s(1)) r),
  'levantado: ya entra');

-- =====================================================================================================
-- 4. SteamID sin ficha
-- =====================================================================================================
set local role authenticated;
select pg_temp.como('aaaaaaaa-3100-4000-8000-0000000000aa');
select set_config('t.b4', public.ban_create(null, pg_temp.s(4), 'Smurf', now() + interval '1 day')::text, true);
reset role;
select pg_temp.ok((select player_id is null and steam_id = pg_temp.s(4) and search like '%' || pg_temp.s(4) || '%'
                     from public.ban_list where id = current_setting('t.b4')::uuid),
  'sin ficha: el SteamID se puede buscar');
-- Después, ese SteamID pasa a ser adicional de F2: el baneo alcanza a toda la ficha.
insert into public.player_extra_steam_ids(steam_id, player_id) values (pg_temp.s(4), 'dddddddd-3100-4000-8000-000000000002');
select pg_temp.ok((select r @> '{"banned": true, "reason": "Smurf"}' from public.csstv_ban_check('token-ban-31', pg_temp.s(5)) r),
  'si el SteamID suma una ficha, el baneo alcanza a su principal');
select pg_temp.ok((select player_id = 'dddddddd-3100-4000-8000-000000000002' and nick = 'Otra31'
                          and search not like '%' || pg_temp.s(4) || '%' and search_all like '%' || pg_temp.s(4) || '%'
                     from public.ban_list where id = current_setting('t.b4')::uuid),
  'la vista lo muestra en la ficha y su búsqueda pública ya no tiene el SteamID');

-- =====================================================================================================
-- 5. Plugin
-- =====================================================================================================
select pg_temp.ok(pg_temp.error($q$select public.csstv_ban_check('token-falso', '76561198310000001')$q$) like 'Token de servidor inválido%',
  'token inválido');
select pg_temp.ok((select r = '{"ok": false, "message": "SteamID inválido"}' from public.csstv_ban_check('token-ban-31', 'xx') r),
  'SteamID inválido: ok false');
select pg_temp.ok((select r @> '{"ok": false}' from public.csstv_ban_add('token-ban-31', pg_temp.s(3), 'Tres', null, 'Consola', -1, 'x') r),
  '!ban con duración negativa');
select set_config('t.b3', (public.csstv_ban_add('token-ban-31', pg_temp.s(3), 'Tres', public.csstv_steam0(pg_temp.s(9)), 'AdminJuego', 0, '')->>'ban_id'), true);
select pg_temp.ok((select source = 'server' and server_id = 'eeeeeeee-3100-4000-8000-000000000001' and expires_at is null
                          and nick = 'Tres' and created_by_steam = pg_temp.s(9) and created_by_name = 'AdminJuego'
                          and reason = 'Sin motivo (baneado en el servidor)'
                     from public.bans where id = current_setting('t.b3')::uuid),
  '!ban 0: permanente, con el servidor, el admin del juego y un motivo por defecto');
select pg_temp.ok((select r @> '{"banned": true, "expires": 0}' from public.csstv_ban_check('token-ban-31', pg_temp.s(3)) r),
  'permanente: expires 0');
select pg_temp.ok((select (r->>'ban_id') = current_setting('t.b3')
                     from public.csstv_ban_add('token-ban-31', pg_temp.s(3), 'Tres', null, 'Consola', 30, 'otro') r),
  'un !ban temporal no reemplaza uno permanente');

select pg_temp.ok((select (r->'items') @> jsonb_build_array(
                            jsonb_build_object('steam', public.csstv_steam0(pg_temp.s(3)), 'active', true, 'expires', 0),
                            jsonb_build_object('steam64', pg_temp.s(5), 'active', true),
                            jsonb_build_object('steam64', pg_temp.s(4), 'active', true))
                          and not (r->'items') @> jsonb_build_array(jsonb_build_object('steam64', pg_temp.s(1)))
                     from public.csstv_bans_since('token-ban-31') r),
  'sin cursor: todos los SteamID alcanzados por los activos, nada de los levantados');
select pg_temp.ok((select (r->'items') @> jsonb_build_array(jsonb_build_object('steam64', pg_temp.s(1), 'active', false),
                                                             jsonb_build_object('steam64', pg_temp.s(2), 'active', false))
                     from public.csstv_bans_since('token-ban-31', (now() - interval '1 minute')::text) r),
  'con cursor: también los levantados, con todos los SteamID de la ficha');
select pg_temp.ok((select r->'items' = '[]' and (r->>'cursor')::timestamptz = now() - interval '1 minute'
                     from public.csstv_bans_since('token-ban-31', (now() + interval '1 second')::text) r),
  'nada nuevo después del cursor; el próximo cursor deja un minuto de margen');
insert into public.player_extra_steam_ids(steam_id, player_id, added_at) values (pg_temp.s(6), 'dddddddd-3100-4000-8000-000000000002', now() + interval '2 seconds');
select pg_temp.ok((select r->'items' @> jsonb_build_array(jsonb_build_object('steam64', pg_temp.s(6), 'active', true))
                     from public.csstv_bans_since('token-ban-31', (now() + interval '1 second')::text) r),
  'un SteamID nuevo de una ficha baneada sale aunque el baneo no cambie');
select pg_temp.ok((select r = '{"ok": false, "message": "Cursor inválido"}' from public.csstv_bans_since('token-ban-31', 'ayer') r),
  'cursor inválido');

select pg_temp.ok((select r = '{"ok": true, "lifted": 1}'
                     from public.csstv_ban_lift('token-ban-31', public.csstv_steam0(pg_temp.s(3)), pg_temp.s(9), 'AdminJuego') r),
  '!unban levanta, también uno permanente');
select pg_temp.ok((select lift_reason = 'Levantado en el servidor Server 31' and lifted_by_steam = pg_temp.s(9) and lifted_by is null
                     from public.bans where id = current_setting('t.b3')::uuid),
  '!unban guarda el servidor y el admin del juego');
select pg_temp.ok((select r = '{"ok": true, "lifted": 0}' from public.csstv_ban_lift('token-ban-31', pg_temp.s(7), null, null) r),
  '!unban sin baneo');

-- Un moderador levanta uno del juego que no es permanente.
select set_config('t.b7', (public.csstv_ban_add('token-ban-31', pg_temp.s(7), null, null, 'Consola', 60, 'Spam')->>'ban_id'), true);
set local role authenticated;
select pg_temp.como('aaaaaaaa-3100-4000-8000-0000000000aa');
select public.ban_lift(current_setting('t.b7')::uuid, 'Error del admin');
reset role;
select pg_temp.ok((select status = 'lifted' and created_by_name = 'Consola' and server_name = 'Server 31'
                     from public.ban_list where id = current_setting('t.b7')::uuid),
  'el moderador levanta uno temporal del juego');

-- =====================================================================================================
-- 6. Vista y permisos
-- =====================================================================================================
insert into public.bans(steam_id, reason, source, created_at, expires_at) values (pg_temp.s(8), 'Viejo', 'import', now() - interval '3 days', now() - interval '1 day');
select pg_temp.ok((select status = 'expired' from public.ban_list where steam_id = pg_temp.s(8)), 'un vencido sale como expired');
select pg_temp.ok((select r = '{"ok": true, "banned": false}' from public.csstv_ban_check('token-ban-31', pg_temp.s(8)) r),
  'vencido: entra');
select pg_temp.ok(has_function_privilege('anon', 'public.csstv_bans_since(text, text)', 'execute')
                  and has_function_privilege('anon', 'public.csstv_ban_add(text, text, text, text, text, int, text)', 'execute')
                  and not has_function_privilege('anon', 'public.ban_create(uuid, text, text, timestamptz)', 'execute')
                  and not has_function_privilege('authenticated', 'public.ban_insert(uuid, text, text, text, timestamptz, text, uuid, text, text, uuid)', 'execute'),
  'el plugin llama con la anon key; ban_insert es interna');
set local role anon;
select pg_temp.ok((select count(*) >= 5 from public.ban_list where nick in ('Ficha31', 'Otra31', 'Tres') or steam_id in (pg_temp.s(7), pg_temp.s(8))),
  'la lista es pública');
reset role;

rollback;

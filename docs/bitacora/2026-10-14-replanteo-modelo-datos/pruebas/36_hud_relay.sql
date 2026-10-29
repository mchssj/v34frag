-- Pruebas de supabase/replanteo/36_hud_relay.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
-- Mensaje y código del error de una sentencia, o null si no falla.
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
create function pg_temp.estado(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlstate;
end $$;
create function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('aaaaaaaa-3600-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.g(n int) returns uuid language sql immutable as $$ select ('99999999-3600-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
-- Cuenta los avisos sin la RLS de notifications (que deja ver solo los propios): security definer.
create function pg_temp.n(u int, t text) returns int language sql security definer as $$
  select count(*)::int from public.notifications where user_id = pg_temp.u(u) and type = t $$;
create function pg_temp.hash(t text) returns text language sql immutable as $$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.error(text), pg_temp.estado(text), pg_temp.u(int),
  pg_temp.g(int), pg_temp.n(int, text), pg_temp.hash(text) to authenticated, anon;

-- Cuentas: 1 admin, 2 y 3 usuarios. Servidores: A con SourceTV, B sin SourceTV.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password)
select pg_temp.u(n), format('h36-%s@test.local', n), format('{"tag":"Hud36_%s"}', n)::jsonb, 'x' from generate_series(1, 3) n;
update public.profiles set role = 'admin' where id = pg_temp.u(1);
insert into public.game_servers(id, name, token_hash, connect_address, tv_port) values
  (pg_temp.g(1), 'Hud36 A', pg_temp.hash('srv36a'), '10.0.0.1:27015', 27020),
  (pg_temp.g(2), 'Hud36 B', pg_temp.hash('srv36b'), null, null);
-- El token del relay de la prueba.
insert into public.hud_relays(name, token_hash) values ('prueba36', pg_temp.hash('hudr_prueba36'));
-- Si la base local ya usa los puertos de la prueba, se liberan adentro de la transacción.
update public.game_servers set hud_port = null, hud_enabled = false, hud_key = null
 where hud_port in (27501, 27502, 27519) and id not in (pg_temp.g(1), pg_temp.g(2));

-- =====================================================================================================
-- Permisos
-- =====================================================================================================
set local role authenticated;
select pg_temp.como(pg_temp.u(2)::text);
select pg_temp.ok(pg_temp.error(format('select public.admin_set_server_hud(%L, 27501, false)', pg_temp.g(1))) = 'Solo un admin configura el HUD',
  'un usuario no configura el HUD');
select pg_temp.ok(pg_temp.error(format('select public.admin_grant_streamer(%L)', pg_temp.u(2))) = 'Solo un admin da la marca de streamer',
  'un usuario no se da la marca');
select pg_temp.ok(pg_temp.error('select * from public.hud_streamers') like 'permission denied%', 'nadie lee hud_streamers directo');
select pg_temp.ok(pg_temp.error('select * from public.hud_relays') like 'permission denied%', 'ni hud_relays');
select pg_temp.ok(pg_temp.error('select * from public.hud_sessions') like 'permission denied%', 'ni hud_sessions');
select pg_temp.ok(pg_temp.error('select public.hud_streamer_new_token()') = 'Solo los streamers tienen link del HUD',
  'sin la marca no hay link');
reset role;
set local role anon;
select pg_temp.ok(pg_temp.error(format('select public.admin_grant_streamer(%L)', pg_temp.u(2))) like 'permission denied%',
  'anon no llama a las funciones del admin');
reset role;

-- =====================================================================================================
-- HUD de cada servidor
-- =====================================================================================================
set local role authenticated;
select pg_temp.como(pg_temp.u(1)::text);
select public.admin_set_server_hud(pg_temp.g(2), 27502, false);
select pg_temp.ok((select hud_port = 27502 and not hud_enabled and hud_key ~ '^[A-Za-z0-9]{24}$' from public.admin_server_list where id = pg_temp.g(2)),
  'poner el puerto genera la clave');
select pg_temp.ok(pg_temp.error(format('select public.admin_set_server_hud(%L, 27502, true)', pg_temp.g(2)))
                  = 'Para activar el HUD, el servidor necesita su dirección y el puerto de SourceTV', 'sin SourceTV no se activa');
select pg_temp.ok(pg_temp.error(format('select public.admin_set_server_hud(%L, 27600, true)', pg_temp.g(1)))
                  = 'El puerto del HUD tiene que estar entre 27500 y 27519', 'puerto fuera del rango');
select pg_temp.ok(pg_temp.error(format('select public.admin_set_server_hud(%L, 27502, true)', pg_temp.g(1)))
                  = 'El puerto 27502 ya lo usa el servidor Hud36 B', 'puerto repetido: dice quién lo usa');
select pg_temp.ok(pg_temp.estado(format('select public.admin_set_server_hud(%L, 27502, true)', pg_temp.g(1))) = '23505',
  'puerto repetido: 23505 (la API responde 409)');
select public.admin_set_server_hud(pg_temp.g(1), 27501, true);
select pg_temp.ok((select hud_port = 27501 and hud_enabled from public.admin_server_list where id = pg_temp.g(1)), 'con SourceTV se activa');

create temp table clave as select hud_key as k from public.admin_server_list where id = pg_temp.g(1);
select public.admin_set_server_hud(pg_temp.g(1), 27519, true);
select pg_temp.ok((select hud_port = 27519 and hud_key = (select k from clave) from public.admin_server_list where id = pg_temp.g(1)),
  'cambiar el puerto conserva la clave');
select pg_temp.ok(public.admin_regenerate_hud_key(pg_temp.g(1)) <> (select k from clave), 'regenerar cambia la clave');
select pg_temp.ok((select hud_key <> (select k from clave) from public.admin_server_list where id = pg_temp.g(1)), 'y queda guardada');
select public.admin_set_server_hud(pg_temp.g(2), null, false);
select pg_temp.ok((select hud_port is null and hud_key is null and not hud_enabled from public.admin_server_list where id = pg_temp.g(2)),
  'sin puerto: sin clave y apagado');
select pg_temp.ok(pg_temp.error(format('select public.admin_regenerate_hud_key(%L)', pg_temp.g(2))) = 'Ese servidor no tiene puerto del HUD',
  'no se regenera la clave sin puerto');
reset role;

update public.game_servers set tv_port = null where id = pg_temp.g(1);
select pg_temp.ok((select not hud_enabled and hud_port = 27519 from public.game_servers where id = pg_temp.g(1)),
  'sacarle la SourceTV apaga el HUD (y conserva el puerto)');
update public.game_servers set tv_port = 27020 where id = pg_temp.g(1);
select pg_temp.ok(pg_temp.estado(format('update public.game_servers set hud_key = %L where id = %L', 'con|barra', pg_temp.g(1))) = '23514',
  'la clave no puede tener | (separador del protocolo)');

-- =====================================================================================================
-- Streamers
-- =====================================================================================================
set local role authenticated;
select pg_temp.como(pg_temp.u(1)::text);
select public.admin_set_server_hud(pg_temp.g(1), 27519, true);   -- se había apagado al sacarle la SourceTV
select public.admin_grant_streamer(pg_temp.u(2));
select public.admin_grant_streamer(pg_temp.u(2));
select pg_temp.ok(pg_temp.n(2, 'streamer_granted') = 1, 'dar la marca avisa una sola vez');
select pg_temp.ok((select active and not has_link and granted_by_alias = 'Hud36_1' from public.hud_streamer_list where user_id = pg_temp.u(2)),
  'el admin la ve: activa, sin link y quién la dio');
select pg_temp.ok((select is_streamer from public.admin_user_list where id = pg_temp.u(2))
                  and not (select is_streamer from public.admin_user_list where id = pg_temp.u(3)), 'admin_user_list: is_streamer');
select pg_temp.ok(pg_temp.error(format('select public.admin_revoke_streamer(%L)', pg_temp.u(3))) = 'Esa cuenta no es streamer',
  'no se quita a quien no la tiene');

select pg_temp.como(pg_temp.u(2)::text);
create temp table tok as select public.hud_streamer_new_token() as t;
grant select on tok to anon, postgres;
select pg_temp.ok((select t ~ '^hud_[0-9a-f]{64}$' from tok), 'el streamer genera su link');
select pg_temp.ok((select has_link from public.hud_streamer_list where user_id = pg_temp.u(2)), 'y lo ve en su marca');
select pg_temp.ok((select count(*) from public.hud_streamer_list) = 1, 'cada cuenta ve solo la suya');
select pg_temp.como(pg_temp.u(3)::text);
select pg_temp.ok(not exists (select 1 from public.hud_streamer_list), 'otra cuenta no la ve');
reset role;
select pg_temp.ok((select token_hash = pg_temp.hash((select t from tok)) from public.hud_streamers where user_id = pg_temp.u(2)),
  'en la base queda el hash');

-- =====================================================================================================
-- Relay
-- =====================================================================================================
set local role anon;
select pg_temp.ok(pg_temp.estado($q$select public.hud_relay_config('hudr_otro')$q$) = 'PT401', 'token del relay malo: PT401');
create temp table cfg as select public.hud_relay_config('hudr_prueba36') as c;
select pg_temp.ok((select jsonb_path_exists(c, '$.servers[*] ? (@.name == "Hud36 A" && @.port == 27519 && @.tv_address == "10.0.0.1:27020")')
                     from cfg), 'devuelve el servidor activo con su puerto y su SourceTV');
select pg_temp.ok((select not jsonb_path_exists(c, '$.servers[*] ? (@.name == "Hud36 B")') from cfg), 'no el que no tiene HUD');
select pg_temp.ok((select jsonb_path_exists(c, ('$.streamers[*] ? (@.alias == "Hud36_2" && @.token_hash == "'
                                                  || pg_temp.hash((select t from tok)) || '")')::jsonpath) from cfg),
  'y el streamer con el hash de su link');

-- Sesiones: el 2 en A cuenta; el 3 (no es streamer) y B (sin HUD) no.
select public.hud_relay_config('hudr_prueba36',
  jsonb_build_array(jsonb_build_object('user_id', pg_temp.u(2), 'server_id', pg_temp.g(1)),
                    jsonb_build_object('user_id', pg_temp.u(3), 'server_id', pg_temp.g(1)),
                    jsonb_build_object('user_id', pg_temp.u(2), 'server_id', pg_temp.g(2))),
  jsonb_build_object(pg_temp.g(1)::text, now() - interval '5 seconds'));
reset role;
select pg_temp.ok((select count(*) = 1 from public.hud_sessions where user_id in (pg_temp.u(2), pg_temp.u(3))), 'solo cuenta la sesión válida');
select pg_temp.ok((select last_seen_at is not null from public.hud_relays where name = 'prueba36'), 'el relay queda visto');
set local role authenticated;
select pg_temp.como(pg_temp.u(1)::text);
select pg_temp.ok((select hud_streaming @> '[{"alias": "Hud36_2"}]' and hud_seen_at > now() - interval '1 minute'
                     from public.admin_server_list where id = pg_temp.g(1)), 'el admin ve quién transmite y el último paquete');
select pg_temp.como(pg_temp.u(2)::text);
select pg_temp.ok(not exists (select 1 from public.admin_server_list), 'un usuario no ve los servidores');
reset role;

-- Una sesión vieja no cuenta.
update public.hud_sessions set seen_at = now() - interval '2 minutes' where user_id = pg_temp.u(2);
set local role authenticated;
select pg_temp.como(pg_temp.u(1)::text);
select pg_temp.ok((select hud_streaming = '[]' from public.admin_server_list where id = pg_temp.g(1)), 'una sesión de hace 2 minutos no cuenta');

-- Quitar la marca: aviso, sin link, sin sesiones y fuera de la configuración del relay.
select public.admin_revoke_streamer(pg_temp.u(2));
select pg_temp.ok(pg_temp.n(2, 'streamer_revoked') = 1, 'quitar la marca avisa');
select pg_temp.ok((select not active and not has_link from public.hud_streamer_list where user_id = pg_temp.u(2)), 'queda inactiva y sin link');
select pg_temp.como(pg_temp.u(2)::text);
select pg_temp.ok(pg_temp.error('select public.hud_streamer_new_token()') = 'Solo los streamers tienen link del HUD', 'ya no genera link');
reset role;
select pg_temp.ok(not exists (select 1 from public.hud_sessions where user_id = pg_temp.u(2)), 'se borran sus sesiones');
set local role anon;
select pg_temp.ok((select not jsonb_path_exists(public.hud_relay_config('hudr_prueba36'), '$.streamers[*] ? (@.alias == "Hud36_2")')),
  'el relay deja de recibirlo');
reset role;

-- Volver a darla: activa y sin link.
set local role authenticated;
select pg_temp.como(pg_temp.u(1)::text);
select public.admin_grant_streamer(pg_temp.u(2));
select pg_temp.ok((select active and not has_link and revoked_at is null from public.hud_streamer_list where user_id = pg_temp.u(2)),
  'volver a darla: activa y sin link');
select pg_temp.ok(pg_temp.n(2, 'streamer_granted') = 2, 'con aviso');
reset role;

-- Un relay desactivado no entra.
update public.hud_relays set active = false where name = 'prueba36';
set local role anon;
select pg_temp.ok(pg_temp.estado($q$select public.hud_relay_config('hudr_prueba36')$q$) = 'PT401', 'relay desactivado: PT401');
reset role;

rollback;

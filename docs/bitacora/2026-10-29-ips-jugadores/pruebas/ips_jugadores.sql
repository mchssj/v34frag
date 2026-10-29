-- Pruebas de supabase/migrations/20261029180000_ips_jugadores.sql (correr con la migración aplicada, en la base LOCAL).
-- Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;

-- Un servidor de prueba con su token.
insert into public.game_servers(id, name, token_hash, active)
values ('eeeeeeee-1900-4000-8000-000000000001', 'Prueba IPs', encode(sha256(convert_to('token-ips', 'UTF8')), 'hex'), true);

-- ---------- token ----------
select pg_temp.ok((public.csstv_connections('malo', '[]', '[]') ->> 'ok')::boolean = false, 'token inválido: ok false, sin error');
select pg_temp.ok((public.csstv_connections('token-ips') ->> 'ok')::boolean, 'token válido, lote vacío');

-- ---------- entradas ----------
create temp table r1 as select public.csstv_connections('token-ips',
  '[{"steam":"STEAM_0:1:12345","ip":"190.1.2.3","nick":"Uno"},
    {"steam":"STEAM_1:1:12345","ip":"190.1.2.3","nick":"Uno otra vez"},
    {"steam":"76561197960290419","ip":"200.9.9.9"},
    {"steam":"STEAM_0:0:777","ip":"190.1.2.3","nick":"Otro"},
    {"steam":"BOT","ip":"190.1.2.3"},
    {"steam":"STEAM_0:1:99999999999999999999","ip":"190.1.2.3"},
    {"steam":"STEAM_0:1:5","ip":"no es ip"},
    {"steam":"STEAM_0:1:5","ip":"10.0.0.0/8"},
    {"steam":"STEAM_0:1:6","ip":"2800:810:4e1::1","nick":"IPv6"}]', '[]') r;
select pg_temp.ok((select (r ->> 'seen')::int = 5 from r1), '5 entradas válidas (sin bot, SteamID roto, IP inválida ni máscara)');
select pg_temp.ok((select times = 2 and last_nick = 'Uno otra vez' and last_server_id = 'eeeeeeee-1900-4000-8000-000000000001'
                     from public.player_ips where steam_id = '76561197960290419' and ip = '190.1.2.3'),
  'STEAM_0 y STEAM_1 son el mismo SteamID64: una fila con 2 veces y el último nick');
select pg_temp.ok((select count(*) = 2 from public.player_ips where steam_id = '76561197960290419'), 'un SteamID puede tener varias IPs');
select pg_temp.ok((select count(*) = 2 from public.player_ips where ip = '190.1.2.3'), 'una IP puede ser de varios SteamID');
select pg_temp.ok((select last_nick is null from public.player_ips where ip = '200.9.9.9'), 'sin nick: null');
select pg_temp.ok(exists (select 1 from public.player_ips where ip = '2800:810:4e1::1'), 'IPv6');
select pg_temp.ok((select count(*) = 5 from public.player_connections where server_id = 'eeeeeeee-1900-4000-8000-000000000001'),
  'el registro guarda cada entrada');

-- ---------- intentos ----------
create temp table r2 as select public.csstv_connections('token-ips', '[]',
  '[{"ip":"45.1.1.1","n":500},{"ip":"45.1.1.1","n":3},{"ip":"8.8.8.8","n":"x"},{"ip":"8.8.4.4"},{"ip":"basura","n":1},{"ip":"9.9.9.9","n":-5}]') r;
select pg_temp.ok((select (r ->> 'attempts')::int = 3 from r2), '3 intentos válidos (sin contador o IP inválida se descartan)');
select pg_temp.ok((select count = 503 from public.connect_attempts where ip = '45.1.1.1'), 'se suman en la misma hora');
select pg_temp.ok((select count = 1 from public.connect_attempts where ip = '9.9.9.9'), 'un contador negativo cuenta 1');
select pg_temp.ok((select hour = date_trunc('hour', now()) from public.connect_attempts where ip = '45.1.1.1'), 'por hora');

-- ---------- topes ----------
create temp table r3 as select public.csstv_connections('token-ips',
  (select jsonb_agg(jsonb_build_object('steam', 'STEAM_0:0:' || g, 'ip', '1.1.1.1')) from generate_series(1000, 1100) g),
  (select jsonb_agg(jsonb_build_object('ip', '2.2.' || (g / 256) || '.' || (g % 256), 'n', 1)) from generate_series(1, 300) g)) r;
select pg_temp.ok((select (r ->> 'seen')::int = 64 and (r ->> 'attempts')::int = 256 from r3), 'topes: 64 entradas y 256 intentos por lote');
select pg_temp.ok((public.csstv_connections('token-ips', '{"no":"lista"}', '"texto"') ->> 'ok')::boolean, 'si no son listas, no falla');

-- ---------- privacidad ----------
set local role anon;
select pg_temp.ok((select count(*) from information_schema.role_table_grants
                    where grantee in ('anon', 'authenticated') and table_name in ('player_ips', 'player_connections', 'connect_attempts')) = 0,
  'anon y authenticated no tienen permisos sobre las tablas');
reset role;
do $$ begin
  set local role anon;
  perform 1 from public.player_ips;
  raise exception 'FALLA: anon pudo leer player_ips';
exception when insufficient_privilege then
  raise notice 'OK: anon no puede leer player_ips';
end $$;
reset role;

-- ---------- borrado de lo viejo ----------
insert into public.player_connections(at, server_id, steam_id, ip) values (now() - interval '91 days', null, '76561197960290419', '3.3.3.3');
insert into public.connect_attempts(server_id, ip, hour, count) values ('eeeeeeee-1900-4000-8000-000000000001', '3.3.3.3', now() - interval '91 days', 1);
do $$ begin
  for i in 1 .. 400 loop
    perform public.csstv_connections('token-ips');
    exit when not exists (select 1 from public.player_connections where ip = '3.3.3.3');
  end loop;
end $$;
select pg_temp.ok(not exists (select 1 from public.player_connections where ip = '3.3.3.3')
                  and not exists (select 1 from public.connect_attempts where ip = '3.3.3.3'),
  'lo de más de 90 días se borra (de vez en cuando)');
select pg_temp.ok(exists (select 1 from public.player_ips where ip = '190.1.2.3'), 'el resumen no se borra');

-- ---------- re-ejecutable ----------
select pg_temp.ok(true, 'fin');
rollback;

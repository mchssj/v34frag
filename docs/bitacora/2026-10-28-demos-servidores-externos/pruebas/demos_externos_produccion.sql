-- Pruebas de supabase/migrations/20261028200000_demos_servidores_externos.sql, sobre el esquema de producción
-- (también corren con el replanteo aplicado). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;

-- Un token del Worker y tres servidores: el #1 (panel por defecto), RBK (otro id) y uno sin id del panel.
insert into public.demo_workers(name, token_hash) values ('prueba-ext', encode(sha256(convert_to('demow_prueba_ext', 'UTF8')), 'hex'));
insert into public.game_servers(id, name, token_hash, panel_server_id, panel_url) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'Ext #1', 'h-ext-1', 'aaaa1111', null),
  ('eeeeeeee-0000-4000-8000-000000000002', 'Ext flow', 'h-ext-2', 'bbbb2222', 'https://panel-flow.example.com'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'Ext sin panel', 'h-ext-3', null, null);
insert into public.matches(id, external_id, server_id, kind, status, map, played_at, demo_status) values
  ('eeeeeeee-1000-4000-8000-000000000001', 'ext-uid-0001', 'eeeeeeee-0000-4000-8000-000000000001', 'mix', 'finished', 'de_dust2', '2000-01-01 20:00+00', 'pending'),
  ('eeeeeeee-1000-4000-8000-000000000002', 'ext-uid-0002', 'eeeeeeee-0000-4000-8000-000000000002', 'mix', 'finished', 'de_nuke',  '2000-01-01 21:00+00', 'pending'),
  ('eeeeeeee-1000-4000-8000-000000000003', 'ext-uid-0003', 'eeeeeeee-0000-4000-8000-000000000003', 'mix', 'finished', 'de_train', '2000-01-01 22:00+00', 'pending'),
  ('eeeeeeee-1000-4000-8000-000000000004', 'ext-uid-0004', 'eeeeeeee-0000-4000-8000-000000000002', 'mix', 'finished', 'de_inferno', '2000-01-01 23:00+00', 'uploaded');

create temp view ext as
  select external_id, demo_status, demo_via, demo_fallback_reason, demo_attempts from public.matches where external_id like 'ext-uid-%';
grant select on ext to anon;

-- Columnas y restricciones
select pg_temp.ok(pg_temp.error($q$update game_servers set panel_url = 'http://x.com' where name = 'Ext #1'$q$) is not null, 'panel_url solo https');
select pg_temp.ok(pg_temp.error($q$update game_servers set panel_url = 'https://panel.x.com:8443' where name = 'Ext #1'$q$) is null, 'panel_url https con puerto');
update public.game_servers set panel_url = null where name = 'Ext #1';
select pg_temp.ok(pg_temp.error($q$update matches set demo_via = 'api' where external_id = 'ext-uid-0001'$q$) is not null, 'demo_via solo null o sftp');

-- La firma vieja ya no existe (si no, PostgREST no sabría cuál llamar)
select pg_temp.ok(not exists (select 1 from pg_proc where proname = 'demo_pending' and pronargs = 2), 'sin demo_pending de 2 parámetros');
select pg_temp.ok((select count(*) from pg_proc where proname = 'demo_pending') = 1, 'una sola demo_pending');

-- Desde acá, como lo llama el Worker: anon con el token
set local role anon;

select pg_temp.ok(pg_temp.error($q$select * from demo_pending('malo')$q$) like '%Token del Worker%', 'token inválido rechazado');
select pg_temp.ok(pg_temp.error($q$select * from demo_pending('demow_prueba_ext', 10, 'ftp')$q$) like '%Cola inválida%', 'cola inválida rechazada');

-- Como el Worker de hoy: sin p_via es la cola de la API, con panel_url
select pg_temp.ok((select array_agg(external_id order by played_at) from demo_pending('demow_prueba_ext') where external_id like 'ext-uid-%')
                  = array['ext-uid-0001', 'ext-uid-0002'], 'cola api: las pendientes con id del panel (sin la que no tiene)');
select pg_temp.ok((select panel_url from demo_pending('demow_prueba_ext') where external_id = 'ext-uid-0002') = 'https://panel-flow.example.com', 'devuelve panel_url');
select pg_temp.ok((select panel_url from demo_pending('demow_prueba_ext') where external_id = 'ext-uid-0001') is null, 'panel_url vacío = el por defecto');
select pg_temp.ok(not exists (select 1 from demo_pending('demow_prueba_ext', 10, 'sftp') where external_id like 'ext-uid-%'), 'cola sftp vacía al principio');

-- demo_fallback
select pg_temp.ok(demo_fallback('demow_prueba_ext', 'ext-uid-0002', 'sin key') = 'sftp', 'fallback pasa a sftp');
select pg_temp.ok((select demo_via = 'sftp' and demo_fallback_reason = 'sin key' and demo_attempts = 0 from ext where external_id = 'ext-uid-0002'), 'fallback sin gastar intento y con el motivo');
select pg_temp.ok(not exists (select 1 from demo_pending('demow_prueba_ext') where external_id = 'ext-uid-0002'), 'ya no está en la cola api');
select pg_temp.ok(exists (select 1 from demo_pending('demow_prueba_ext', 10, 'sftp') where external_id = 'ext-uid-0002'), 'está en la cola sftp');
select pg_temp.ok(demo_fallback('demow_prueba_ext', 'ext-uid-0002', 'otra vez') = 'sftp', 'fallback dos veces: sigue en sftp');
select pg_temp.ok((select demo_fallback_reason from ext where external_id = 'ext-uid-0002') = 'sin key', 'el segundo fallback no pisa el motivo');
select pg_temp.ok(demo_fallback('demow_prueba_ext', 'ext-uid-0004', 'x') = 'uploaded', 'fallback de una subida: no cambia');
select pg_temp.ok((select demo_via from ext where external_id = 'ext-uid-0004') is null, 'la subida sigue sin demo_via');
select pg_temp.ok(pg_temp.error($q$select demo_fallback('demow_prueba_ext', 'no-existe-uid')$q$) like '%no existe%', 'fallback de una partida que no existe');
select pg_temp.ok(pg_temp.error($q$select demo_fallback('malo', 'ext-uid-0001')$q$) like '%Token del Worker%', 'fallback con token inválido');

-- demo_mark desde la cola sftp
select pg_temp.ok(demo_mark('demow_prueba_ext', 'ext-uid-0002', 'retry') = 'pending', 'retry por sftp: sigue pendiente');
select pg_temp.ok((select demo_via is null and demo_attempts = 1 from ext where external_id = 'ext-uid-0002'), 'retry vacía demo_via y gasta intento');
select pg_temp.ok(exists (select 1 from demo_pending('demow_prueba_ext') where external_id = 'ext-uid-0002'), 'vuelve a la cola api');
select pg_temp.ok(demo_fallback('demow_prueba_ext', 'ext-uid-0002', 'api 403') = 'sftp', 'de nuevo a sftp');
select pg_temp.ok(demo_mark('demow_prueba_ext', 'ext-uid-0002', 'uploaded', 'demos/2000/01/ext-uid-0002.dem', 1234) = 'uploaded', 'subida por sftp');
select pg_temp.ok((select demo_via is null and demo_attempts = 2 from ext where external_id = 'ext-uid-0002'), 'uploaded vacía demo_via');
select pg_temp.ok(not exists (select 1 from demo_pending('demow_prueba_ext', 10, 'sftp') where external_id = 'ext-uid-0002'), 'fuera de la cola sftp');

-- A los 6 intentos queda missing, también pasando por sftp
select demo_fallback('demow_prueba_ext', 'ext-uid-0001', 'x'), demo_mark('demow_prueba_ext', 'ext-uid-0001', 'retry') from generate_series(1, 6);
select pg_temp.ok((select demo_status = 'missing' and demo_via is null and demo_attempts = 6 from ext where external_id = 'ext-uid-0001'), 'missing a los 6 intentos, sin demo_via');
select pg_temp.ok(demo_fallback('demow_prueba_ext', 'ext-uid-0001', 'x') = 'missing', 'fallback de una missing: no cambia');

-- Lo de siempre sigue igual
select pg_temp.ok(pg_temp.error($q$select demo_mark('demow_prueba_ext', 'ext-uid-0003', 'uploaded', 'otra/ruta.dem', 1)$q$) like '%Ruta de R2%', 'ruta de R2 inválida');
select pg_temp.ok(pg_temp.error($q$select demo_mark('demow_prueba_ext', 'ext-uid-0003', 'nada')$q$) like '%Resultado inválido%', 'resultado inválido');

reset role;
rollback;

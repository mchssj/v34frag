-- Pruebas de 20261013120000_licencia_servidores.sql sobre el esquema mínimo de
-- docs/bitacora/2026-10-11-elo-jugadores/pruebas/stub_supabase.sql (ver GUIA_IMPLEMENTACION.md).
\set ON_ERROR_STOP 1
set client_min_messages = notice;
insert into game_servers(name, token_hash) values ('real', encode(sha256('tok'::bytea), 'hex'));
insert into game_servers(name, token_hash) values ('tercero', encode(sha256('tok2'::bytea), 'hex'));

create function t_assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALLA: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- Simula las cabeceras que PostgREST deja en request.headers.
create function t_ip(ip text) returns void language sql as $$
  select set_config('request.headers', case when ip is null then '' else json_build_object('x-forwarded-for', ip || ', 10.0.0.1')::text end, false)
$$;

-- L1: servidor existente con columnas vacías => ok, igual que antes.
select t_ip('1.2.3.4');
select t_assert((csstv_license('tok', '1.5.0')->>'ok')::boolean, 'L1 token válido => ok');
select t_assert((select last_ip = '1.2.3.4' and plugin_version = '1.5.0' and last_seen_at is not null from game_servers where name = 'real'), 'L1 guarda last_ip, versión y última conexión');
select t_assert(csstv_auth('tok') = (select id from game_servers where name = 'real'), 'L1 csstv_auth sigue devolviendo el id');
select t_assert((csstv_license('tok')->>'server_id')::uuid = (select id from game_servers where name = 'real'), 'L1 devuelve server_id; sin versión no la pisa');
select t_assert((select plugin_version = '1.5.0' from game_servers where name = 'real'), 'L1 versión intacta sin p_version');

-- L2: token inexistente.
select t_assert(csstv_license('nada', '1.5.0') = '{"ok": false, "reason": "token"}'::jsonb, 'L2 token inválido => reason token');
do $$ begin perform csstv_auth('nada'); raise exception 'FALLA: L2 csstv_auth aceptó un token inválido';
exception when sqlstate 'PT401' then raise notice 'ok: L2 csstv_auth => PT401 (%)', sqlerrm; end $$;

-- L3: revocado.
update game_servers set active = false where name = 'tercero';
select t_assert(csstv_license('tok2')->>'reason' = 'token', 'L3 revocado => reason token');
update game_servers set active = true where name = 'tercero';

-- L4: vencido y vigente.
update game_servers set license_expires_at = now() - interval '1 minute' where name = 'tercero';
select t_assert(csstv_license('tok2')->>'reason' = 'expired', 'L4 vencido => reason expired');
do $$ begin perform csstv_auth('tok2'); raise exception 'FALLA: L4 ingesta con licencia vencida';
exception when sqlstate 'PT401' then raise notice 'ok: L4 csstv_auth => PT401 (%)', sqlerrm; end $$;
update game_servers set license_expires_at = now() + interval '30 days' where name = 'tercero';
select t_assert((csstv_license('tok2')->>'expires_at') is not null and (csstv_license('tok2')->>'ok')::boolean, 'L4 vigente => ok con expires_at');

-- L5: IP permitida.
update game_servers set allowed_ip = '5.6.7.8' where name = 'tercero';
select t_ip('9.9.9.9');
select t_assert(csstv_license('tok2')->>'reason' = 'ip', 'L5 otra IP => reason ip');
select t_assert((select last_ip = '1.2.3.4' from game_servers where name = 'tercero'), 'L5 un intento rechazado no pisa last_ip');
do $$ begin perform csstv_auth('tok2'); raise exception 'FALLA: L5 ingesta desde otra IP';
exception when sqlstate 'PT401' then raise notice 'ok: L5 csstv_auth => PT401 (%)', sqlerrm; end $$;
select t_ip('5.6.7.8');
select t_assert((csstv_license('tok2')->>'ok')::boolean, 'L5 IP correcta => ok');
select set_config('request.headers', '{"cf-connecting-ip":"5.6.7.8","x-forwarded-for":"7.7.7.7"}', false);
select t_assert((csstv_license('tok2')->>'ok')::boolean, 'L5 cf-connecting-ip tiene prioridad');
select t_ip(null);
select t_assert(csstv_license('tok2')->>'reason' = 'ip', 'L5 sin cabeceras e IP fija => rechazado');
select t_assert((csstv_license('tok')->>'ok')::boolean, 'L5 sin cabeceras y sin IP fija => ok');

-- L6: la ingesta completa sigue funcionando con la licencia vigente.
select t_ip('1.2.3.4');
select t_assert(ingest_server_chunk('tok', 'srv1-lic-0001', 1, 2, 'eyJ4Ijox') is null, 'L6 ingest parte 1/2 aceptada');

-- L7: permisos.
select t_assert(has_function_privilege('anon', 'public.csstv_license(text, text)', 'execute'), 'L7 anon puede llamar csstv_license');
select t_assert(not has_function_privilege('anon', 'public.csstv_check_token(text)', 'execute'), 'L7 anon no llama csstv_check_token');
select t_assert(not has_function_privilege('anon', 'public.csstv_auth(text)', 'execute'), 'L7 anon no llama csstv_auth');
select t_assert(not has_function_privilege('anon', 'public.csstv_request_ip()', 'execute'), 'L7 anon no llama csstv_request_ip');
set role anon;
select t_assert((csstv_license('tok')->>'ok')::boolean, 'L7 como anon: csstv_license funciona');
reset role;

-- L8: re-ejecutable (se vuelve a correr la migración desde el script de pruebas).
\echo FIN

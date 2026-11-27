-- Prueba de la 159 (y de la 155 a la 158 debajo), todo dentro de una transacción que termina en rollback:
-- no deja nada en la base. Uso: armar_prueba.sh (concatena las migraciones sin sus begin/commit y este archivo).
\set ON_ERROR_STOP on
create temp table r (caso text, got text, want text);

do $$
declare
  v_user uuid := gen_random_uuid();
  v_srv  uuid := gen_random_uuid();
  v_pl   uuid := gen_random_uuid();
  v_dev  uuid;
  v_mach uuid;
  steam  text := '76561199' || lpad((floor(random() * 1e9))::bigint::text, 9, '0');
  x jsonb;
  hb jsonb;
  procedure_ok boolean;
begin
  update ac_config set api_secret_hash = ac_hash('secreto-prueba'), open_until = null where id = 1;
  insert into auth.users (id, instance_id, aud, role, email) values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_user || '@prueba.local');
  insert into game_servers (id, name, token_hash, active) values (v_srv, 'Prueba 159', ac_hash('token-prueba'), true);
  insert into players (id, nick, steam_id, user_id) values (v_pl, 'Prueba159', steam, v_user);
  insert into ac_server_policy (server_id, protected, enforce_mixes) values (v_srv, true, true);
  insert into ac_devices (user_id, name, access_hash, access_expires_at, refresh_hash)
    values (v_user, 'PC', ac_hash('acceso'), now() + interval '1 hour', ac_hash('renovar')) returning id into v_dev;

  -- Latido con el EAC prendido (sin firma: equipo recién vinculado y sin clave).
  hb := ac_heartbeat('secreto-prueba', 'acceso', '10.0.0.1', '0.6.0', '{"clientmod": true, "hl2": false, "eac": true, "eac_why": "parent"}');
  insert into r values ('latido devuelve algo', (hb is not null)::text, 'true');
  insert into r select 'latido guarda eac', game_eac::text || '/' || game_eac_why, 'true/parent' from ac_devices where id = v_dev;

  x := ac_bridge_player('token-prueba', steam, '10.0.0.1', true);
  insert into r values ('eac en mix', x->>'reason' || '/' || (x->>'action'), 'eac_on/kick');
  x := ac_bridge_player('token-prueba', steam, '10.0.0.1', false);
  insert into r values ('eac fuera de mix (mixes)', x->>'reason' || '/' || (x->>'action'), 'eac_on/allow');
  insert into r values ('respuesta: always con mixes', x->>'always', 'false');
  update ac_server_policy set enforce_always = true where server_id = v_srv;
  x := ac_bridge_player('token-prueba', steam, '10.0.0.1', false);
  insert into r values ('eac fuera de mix (always)', x->>'reason' || '/' || (x->>'action'), 'eac_on/kick');
  insert into r values ('respuesta: always', x->>'always', 'true');
  -- Un SteamID sin vincular (todavía no escribió !claim): el Bridge 1.4.0 le da un minuto desde que entra.
  x := ac_bridge_player('token-prueba', '76561197960000001', '10.0.0.1', false);
  insert into r values ('steamid sin vincular (always)', x->>'reason' || '/' || (x->>'action'), 'no_profile/kick');
  update ac_config set open_until = now() + interval '10 minutes' where id = 1;
  x := ac_bridge_player('token-prueba', steam, '10.0.0.1', false);
  insert into r values ('eac con los mixes abiertos', x->>'reason' || '/' || (x->>'action'), 'eac_on/allow');
  update ac_config set open_until = null where id = 1;

  -- EAC apagado.
  hb := ac_heartbeat('secreto-prueba', 'acceso', '10.0.0.1', '0.6.0', '{"clientmod": true, "hl2": false, "eac": false}');
  x := ac_bridge_player('token-prueba', steam, '10.0.0.1', false);
  insert into r values ('sin eac', x->>'reason' || '/' || (x->>'action'), 'ok/allow');

  -- Agente viejo (sin eac): no se expulsa por eso.
  hb := ac_heartbeat('secreto-prueba', 'acceso', '10.0.0.1', '0.5.0', '{"clientmod": true, "hl2": false}');
  x := ac_bridge_player('token-prueba', steam, '10.0.0.1', false);
  insert into r values ('agente 0.5.0', x->>'reason', 'ok');

  -- Otra IPv4: ip_mismatch. IPv6 en el agente e IPv4 en el servidor: ok con marca ip_family.
  x := ac_bridge_player('token-prueba', steam, '10.0.0.2', false);
  insert into r values ('otra ipv4', x->>'reason' || '/' || (x->>'action'), 'ip_mismatch/kick');
  hb := ac_heartbeat('secreto-prueba', 'acceso', '2800:810:1:2::5', '0.6.0', '{"clientmod": true, "hl2": false, "eac": false}');
  x := ac_bridge_player('token-prueba', steam, '10.0.0.1', false);
  insert into r values ('ipv6 contra ipv4', x->>'reason' || '/' || (x->>'action'), 'ok/allow');
  insert into r select 'marca ip_family', count(*)::text, '1' from ac_flags where session_id = (x->>'session_id')::uuid and rule = 'ip_family';

  -- Sin agente: AC-1 con always, también fuera de mix.
  update ac_devices set last_seen_at = now() - interval '5 minutes' where id = v_dev;
  x := ac_bridge_player('token-prueba', steam, '10.0.0.1', false);
  insert into r values ('agente sin latido (always)', x->>'reason' || '/' || (x->>'action'), 'agent_stale/kick');

  -- Máquina baneada con el equipo revocado: machine_banned, expulsa aunque esté en mixes y fuera de mix.
  insert into ac_machines default values returning id into v_mach;
  update ac_devices set machine_id = v_mach, revoked_at = now() where id = v_dev;
  insert into ac_machine_bans (machine_id, reason) values (v_mach, 'prueba 159');
  update ac_server_policy set enforce_always = false where server_id = v_srv;
  x := ac_bridge_player('token-prueba', steam, '10.0.0.1', false);
  insert into r values ('máquina baneada, equipo revocado', x->>'reason' || '/' || (x->>'action'), 'machine_banned/kick');
  -- Con excepción para esa cuenta: ya no.
  insert into ac_machine_exceptions (machine_id, user_id) values (v_mach, v_user);
  x := ac_bridge_player('token-prueba', steam, '10.0.0.1', false);
  insert into r values ('máquina con excepción', x->>'reason' || '/' || (x->>'action'), 'no_agent/allow');
end $$;

-- Panel: el modo de cada servidor, como admin y como alguien que no lo es.
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_otro  uuid := gen_random_uuid();
  v_srv   uuid := (select id from game_servers where name = 'Prueba 159');
  x jsonb;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_admin || '@prueba.local'),
    (v_otro, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_otro || '@prueba.local');
  insert into profiles (id, role) values (v_admin, 'admin') on conflict (id) do update set role = 'admin';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  x := ac_admin_set_server_policy(v_srv, 'always');
  insert into r values ('panel: always', x->>'mode', 'always');
  insert into r select 'panel: always en la tabla', protected::text || '/' || enforce_mixes::text || '/' || enforce_always::text, 'true/false/true'
    from ac_server_policy where server_id = v_srv;
  begin
    perform ac_admin_set_server_policy(v_srv, 'mixes');
    insert into r values ('panel: mixes ya no se elige', 'aceptado', 'rechazado');
  exception when others then insert into r values ('panel: mixes ya no se elige', 'rechazado', 'rechazado');
  end;
  x := ac_admin_set_server_policy(v_srv, 'off');
  insert into r values ('panel: off', x->>'mode', 'off');
  insert into r select 'panel: queda registrado', count(*)::text, '2' from ac_admin_actions where actor = v_admin and action = 'server_policy';
  x := ac_admin_server_policies('Prueba 159', null);
  insert into r values ('panel: listado con filtro de nombre', (x->>'total') || '/' || (x->'items'->0->>'mode'), '1/off');
  x := ac_admin_server_policies(null, 'always');
  insert into r values ('panel: filtro por modo', (select bool_and(i->>'mode' = 'always')::text from jsonb_array_elements(x->'items') i), null);
  begin
    perform ac_admin_set_server_policy(v_srv, 'siempre');
    insert into r values ('panel: modo inválido', 'aceptado', 'rechazado');
  exception when others then insert into r values ('panel: modo inválido', 'rechazado', 'rechazado');
  end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
  begin
    perform ac_admin_set_server_policy(v_srv, 'always');
    insert into r values ('panel: sin ser admin', 'aceptado', 'rechazado');
  exception when insufficient_privilege then insert into r values ('panel: sin ser admin', 'rechazado', 'rechazado');
  end;
  perform set_config('request.jwt.claims', '', true);
end $$;

select caso, got, want, case when got is not distinct from want then 'ok' else 'FALLA' end as resultado from r;
select count(*) filter (where got is distinct from want) as fallas from r \gset

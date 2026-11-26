-- Prueba del replanteo 149, después de aplicarlo en la misma transacción (termina en rollback). Como supabase_admin:
--   (echo "begin;"; sed '/^begin;$/d; /^commit;$/d' supabase/replanteo/149_baneo_por_ip.sql; cat prueba_149.sql) | psql -U supabase_admin
-- La IP del pedido se simula como la pone PostgREST: request.headers con x-forwarded-for.
reset role;
do $$
declare v_admin uuid; v_user uuid; v_user2 uuid; v_player uuid; v_ban uuid; n int; r record;
begin
  -- 1. request_ip
  perform set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 172.18.0.5"}', true);
  assert request_ip() = '203.0.113.7'::inet, '1a primer valor';
  perform set_config('request.headers', '{"x-forwarded-for":"127.0.0.1"}', true);
  assert request_ip() is null, '1b loopback';
  perform set_config('request.headers', '{"x-forwarded-for":"172.20.0.3"}', true);
  assert request_ip() is null, '1c docker';
  perform set_config('request.headers', '{"x-forwarded-for":"basura"}', true);
  assert request_ip() is null, '1d inválida';
  perform set_config('request.headers', '', true);
  assert request_ip() is null, '1e sin headers';
  raise notice '1 ok: request_ip';

  -- 2. account_ip_seen (con una cuenta que tiene ficha)
  select pl.user_id, pl.id into v_user, v_player from players pl where pl.user_id is not null limit 1;
  select u.id into v_user2 from auth.users u where u.id <> v_user limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', '{"x-forwarded-for":"198.51.100.9"}', true);
  perform account_ip_seen();
  perform account_ip_seen();   -- dentro del minuto: no suma
  select times into n from account_ips where user_id = v_user and ip = '198.51.100.9';
  assert n = 1, '2a una vez';
  -- Otra cuenta desde la misma IP (para el aviso de IP compartida).
  perform set_config('request.jwt.claims', json_build_object('sub', v_user2, 'role', 'authenticated')::text, true);
  perform account_ip_seen();
  raise notice '2 ok: account_ip_seen';

  -- 3. Admin: candidatos, banear IP, tope de 30 días
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select * into r from admin_ban_ip_candidates(v_player) where ip = '198.51.100.9';
  assert r.ip is not null, '3a la IP de la web aparece';
  assert 'web' = any (r.sources), '3b origen web';
  assert jsonb_array_length(r.others) >= 1, '3c avisa la otra cuenta';
  assert not r.banned, '3d todavía no';
  insert into bans (player_id, reason, expires_at, source, created_by)
  values (v_player, 'prueba 149', null, 'web', v_admin) returning id into v_ban;
  n := admin_ban_ips_set(v_ban, array['198.51.100.9', '2001:db8::5']);
  assert n = 2, '3e dos IPs';
  assert (select expires_at from ban_ips where ban_id = v_ban and ip = '198.51.100.9') <= now() + interval '30 days 1 minute', '3f tope 30 días';
  assert ip_banned('198.51.100.9'), '3g baneada';
  begin
    perform admin_ban_ips_set(v_ban, array['10.0.0.0/8']);
    raise exception '3h: tendría que haber fallado (rango de más de /16)';
  exception when sqlstate 'P0001' then null;
  end;
  raise notice '3 ok: admin';

  -- 3b. Rangos (Daniel, 2026-11-26): /24 normalizado, una IP del rango queda baneada, y a quién afecta
  n := admin_ban_ips_set(v_ban, array['198.51.100.9', '2001:db8::5', '203.0.113.77/24']);
  assert n = 3, '3i con un rango';
  assert exists (select 1 from ban_ips where ban_id = v_ban and ip = '203.0.113.0/24'::inet and lifted_at is null), '3j normalizado a la red';
  assert ip_banned('203.0.113.200'), '3k una IP del rango';
  assert not ip_banned('203.0.114.1'), '3l fuera del rango';
  assert exists (select 1 from admin_ban_ips(v_ban) x where x.ip = '203.0.113.0/24'), '3m se muestra como rango';
  assert exists (select 1 from admin_ip_range_accounts('198.51.100.0/24') x where x.alias is not null), '3n a quién afecta';
  perform admin_ban_ips_set(v_ban, array['198.51.100.9', '2001:db8::5']);   -- se saca el rango
  assert not ip_banned('203.0.113.200'), '3o el rango se levantó';
  raise notice '3b ok: rangos';

  -- 4. El freno: entrar a la cola, entrar a un grupo y aceptar
  perform set_config('request.jwt.claims', json_build_object('sub', v_user2, 'role', 'authenticated')::text, true);
  assert request_ip_banned(), '4a la IP del pedido está baneada';
  begin
    insert into mm_queue (user_id) values (v_user2);
    raise exception '4b: tendría que haber fallado';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'No puedes buscar partida desde esta conexión%' then raise; end if;
  end;
  begin
    insert into mm_party_members (party_id, user_id) values (gen_random_uuid(), v_user2);
    raise exception '4c: tendría que haber fallado';
  exception when sqlstate 'P0001' then null;
  end;
  -- Sin sesión (worker o servidores) no frena: falla por otra cosa (la fila es de prueba), no por la IP.
  perform set_config('request.jwt.claims', '', true);
  begin
    insert into mm_queue (user_id) values (v_user2);
  exception when sqlstate 'P0001' then raise exception '4d: frenó sin sesión';
            when others then null;
  end;
  -- Otra IP: no frena.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user2, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', '{"x-forwarded-for":"192.0.2.44"}', true);
  assert not request_ip_banned(), '4e otra IP';
  raise notice '4 ok: freno';

  -- 5. Levantar
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  update bans set lifted_at = now(), lifted_by = v_admin, lift_reason = 'prueba' where id = v_ban;
  assert not ip_banned('198.51.100.9'), '5a levantar el baneo levanta la IP';
  update bans set lifted_at = null, lifted_by = null, lift_reason = null where id = v_ban;
  perform admin_ban_ip_lift((select id from ban_ips where ban_id = v_ban and ip = '198.51.100.9'));
  assert not ip_banned('198.51.100.9') and ip_banned('2001:db8::5'), '5b levantar una';
  select count(*) into n from admin_ban_ips(v_ban);
  assert n = 1, '5c queda una';
  raise notice '5 ok: levantar';

  -- 6. Permisos
  assert has_function_privilege('anon', 'public.request_ip_banned()', 'execute'), '6a anon consulta';
  assert not has_function_privilege('anon', 'public.ip_banned(inet)', 'execute'), '6b anon no consulta otras';
  assert not has_function_privilege('anon', 'public.account_ip_seen()', 'execute'), '6c';
  assert not has_table_privilege('anon', 'public.ban_ips', 'select'), '6d';
  assert not has_table_privilege('authenticated', 'public.account_ips', 'insert'), '6e';
  assert not has_function_privilege('authenticated', 'public.mm_ip_guard()', 'execute'), '6f';
  -- Un usuario común no ve candidatos
  perform set_config('request.jwt.claims', json_build_object('sub', v_user2, 'role', 'authenticated')::text, true);
  begin
    perform * from admin_ban_ip_candidates(v_player);
    raise exception '6g: tendría que haber fallado';
  exception when sqlstate '42501' then null;
  end;
  raise notice '6 ok: permisos';
end $$;
rollback;

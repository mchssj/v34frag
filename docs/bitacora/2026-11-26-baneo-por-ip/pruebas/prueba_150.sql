-- Prueba del replanteo 150 (sobre el 149 ya aplicado), en una transacción que termina en rollback. Como supabase_admin.
reset role;
do $$
declare v_admin uuid; u_ban uuid; p_ban uuid; u_ok uuid; p_ok uuid; u_other uuid; v_ban uuid; v_ip uuid; v_exc uuid; n int;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  select pl.user_id, pl.id into u_ban, p_ban from players pl where pl.user_id is not null order by pl.id limit 1;
  select pl.user_id, pl.id into u_ok, p_ok from players pl where pl.user_id is not null and pl.id <> p_ban order by pl.id limit 1;
  select u.id into u_other from auth.users u where u.id not in (u_ban, u_ok) limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  insert into bans (player_id, reason, source, created_by) values (p_ban, 'prueba 150', 'web', v_admin) returning id into v_ban;

  -- 1. Rango con una ficha exceptuada (y la baneada en la lista, que se ignora)
  v_ip := admin_ban_ip_add(v_ban, '203.0.113.0/24', array[p_ok, p_ban], '{}');
  assert (select count(*) from ban_ip_exceptions where ban_ip_id = v_ip) = 1, '1a solo la otra ficha';
  perform set_config('request.headers', '{"x-forwarded-for":"203.0.113.50"}', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_ok, 'role', 'authenticated')::text, true);
  assert not request_ip_banned(), '1b la exceptuada puede';
  perform set_config('request.jwt.claims', json_build_object('sub', u_other, 'role', 'authenticated')::text, true);
  assert request_ip_banned(), '1c otra cuenta no';
  perform set_config('request.jwt.claims', '', true);
  assert request_ip_banned(), '1d sin sesión (registro) no';
  raise notice '1 ok: excepción por ficha';

  -- 2. Excepción por cuenta, y sacarla
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_exc := admin_ban_ip_exception_add(v_ip, null, u_other);
  assert v_exc = admin_ban_ip_exception_add(v_ip, null, u_other), '2a repetida devuelve la misma';
  perform set_config('request.jwt.claims', json_build_object('sub', u_other, 'role', 'authenticated')::text, true);
  assert not request_ip_banned(), '2b exceptuada por cuenta';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform admin_ban_ip_exception_remove(v_exc);
  perform set_config('request.jwt.claims', json_build_object('sub', u_other, 'role', 'authenticated')::text, true);
  assert request_ip_banned(), '2c sin la excepción, baneada';
  raise notice '2 ok: excepción por cuenta';

  -- 3. Listados de admin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select jsonb_array_length(exceptions) into n from admin_ban_ips(v_ban) where ip = '203.0.113.0/24';
  assert n = 1, '3a admin_ban_ips trae las excepciones';
  perform * from admin_ip_range_accounts('181.21.0.0/16');
  raise notice '3 ok: listados';

  -- 4. Permisos
  assert not has_function_privilege('anon', 'public.admin_ban_ip_add(uuid,text,uuid[],uuid[])', 'execute'), '4a';
  assert has_function_privilege('anon', 'public.request_ip_banned()', 'execute'), '4b';
  assert not has_table_privilege('anon', 'public.ban_ip_exceptions', 'select'), '4c';
  perform set_config('request.jwt.claims', json_build_object('sub', u_other, 'role', 'authenticated')::text, true);
  begin
    perform admin_ban_ip_exception_add(v_ip, p_ok, null);
    raise exception '4d: tendría que haber fallado';
  exception when sqlstate '42501' then null;
  end;
  raise notice '4 ok: permisos';
end $$;
rollback;

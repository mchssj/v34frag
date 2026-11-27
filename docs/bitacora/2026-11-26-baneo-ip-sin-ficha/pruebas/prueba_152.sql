-- Prueba del replanteo 152, en una transacción que termina en rollback. Como supabase_admin.
reset role;
do $$
declare v_admin uuid; v_user uuid; p_ok uuid; v_id uuid; ok boolean;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  select id into v_user from profiles where role = 'user' limit 1;
  select id into p_ok from players where user_id is not null and not exists (select 1 from bans b where b.player_id = players.id and b.lifted_at is null) limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  v_id := admin_ban_ip_add_loose('203.0.113.7/24', 'Cuentas nuevas del cheater', 1440, array[p_ok], '{}');
  assert (select ip_text(ip) from ban_ips where id = v_id) = '203.0.113.0/24', '1a normaliza el rango';
  assert (select ban_id is null and source = 'web' and created_by = v_admin and expires_at between now() + interval '23 hours' and now() + interval '25 hours' from ban_ips where id = v_id), '1b';
  assert ip_banned('203.0.113.50'), '1c frena';
  assert not ip_banned_for('203.0.113.50', (select user_id from players where id = p_ok)), '1d el exceptuado no';
  assert exists (select 1 from admin_ban_ips_loose() where id = v_id and server_name is null and reason = 'Cuentas nuevas del cheater'), '1e se lista';
  raise notice '1 ok: baneo sin ficha con excepción';

  begin perform admin_ban_ip_add_loose('198.51.100.1', 'x', 43201); ok := false; exception when others then ok := true; end;
  assert ok, '2a más de 30 días';
  begin perform admin_ban_ip_add_loose('198.51.100.1', '  ', 60); ok := false; exception when others then ok := true; end;
  assert ok, '2b sin motivo';
  begin perform admin_ban_ip_add_loose('10.0.0.0/8', 'x', 60); ok := false; exception when others then ok := true; end;
  assert ok, '2c rango demasiado grande';
  raise notice '2 ok: límites';

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  begin perform admin_ban_ip_add_loose('198.51.100.1', 'x', 60); ok := false; exception when sqlstate '42501' then ok := true; end;
  assert ok, '3a solo admin';
  assert not has_function_privilege('anon', 'public.admin_ban_ip_add_loose(text,text,integer,uuid[],uuid[])', 'execute'), '3b';
  raise notice '3 ok: permisos';
end $$;
rollback;

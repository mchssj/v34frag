-- Prueba del replanteo 153, en una transacción que termina en rollback. Como supabase_admin.
reset role;
do $$
declare v_admin uuid; v_perm uuid; v_temp uuid; v_id uuid;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select id into v_perm from bans where lifted_at is null and expires_at is null limit 1;
  insert into bans (steam_id, reason, expires_at, source) values ('76561199999999992', 'Prueba', now() + interval '90 days', 'web') returning id into v_temp;

  v_id := admin_ban_ip_add(v_perm, '203.0.113.5', '{}', '{}', true);
  assert (select expires_at = 'infinity' from ban_ips where id = v_id), '1a permanente con el baneo permanente';
  assert (select expires_at is null from admin_ban_ips(v_perm) where id = v_id), '1b la lista dice null';
  v_id := admin_ban_ip_add(v_perm, '203.0.113.6', '{}', '{}', false);
  assert (select expires_at < now() + interval '31 days' from ban_ips where id = v_id), '1c sin p_full, 30 días';
  v_id := admin_ban_ip_add(v_temp, '203.0.113.7', '{}', '{}', true);
  assert (select expires_at = (select expires_at from bans where id = v_temp) from ban_ips where id = v_id), '1d hasta que vence el baneo';
  v_id := admin_ban_ip_add(v_temp, '203.0.113.8');
  assert (select expires_at < now() + interval '31 days' from ban_ips where id = v_id), '1e por defecto, 30 días';
  raise notice '1 ok: de una ficha';

  v_id := admin_ban_ip_add_loose('198.51.100.0/24', 'Permanente', 0);
  assert (select expires_at = 'infinity' from ban_ips where id = v_id), '2a sin ficha, permanente';
  assert (select expires_at is null from admin_ban_ips_loose() where id = v_id), '2b';
  assert ip_banned('198.51.100.20'), '2c frena';
  raise notice '2 ok: sin ficha';
end $$;
-- La copia de los servidores lo trae sin vencimiento (0)
do $$
declare v_admin uuid; v_id uuid;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_id := admin_ban_ip_add_loose('192.0.2.0/24', 'Permanente', 0);
  assert exists (select 1 from ban_ips where id = v_id and family(ip) = 4 and expires_at = 'infinity'), '3a';
  raise notice '3 ok: guardado sin vencimiento, que la copia de los servidores manda como 0';
end $$;
rollback;

-- Prueba del replanteo 151 (sobre el 150 aplicado), en una transacción que termina en rollback. Como supabase_admin.
-- csstv_auth se reemplaza por una de prueba (devuelve un servidor cualquiera) solo dentro de la transacción.
reset role;
create or replace function public.csstv_auth(p_token text) returns uuid language sql as $$ select id from game_servers order by name limit 1 $$;
do $$
declare v_admin uuid; p_ban uuid; s_ban text; p_ok uuid; s_ok text; s_free text; r jsonb; v_ban uuid; v_id uuid; n int;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  -- Dos fichas con SteamID que no estén baneadas, y un SteamID sin ficha
  select pl.id, pl.steam_id into p_ban, s_ban from players pl where pl.steam_id is not null and not exists (select 1 from ban_active_for(pl.steam_id)) order by pl.id limit 1;
  select pl.id, pl.steam_id into p_ok, s_ok from players pl where pl.steam_id is not null and pl.id <> p_ban and not exists (select 1 from ban_active_for(pl.steam_id)) order by pl.id limit 1;
  s_free := '76561199999999991';

  -- 1. !banip de un rango, sin ficha
  r := csstv_ban_ip_add('t', '203.0.113.0/24', 60, 'Rango de prueba', '76561198000000001', 'Admin', null);
  assert (r->>'ok')::boolean and r->>'ip' = '203.0.113.0/24', '1a ' || r::text;
  r := csstv_ban_check_ip('t', s_free, '203.0.113.9');
  assert (r->>'banned')::boolean and r->>'kind' = 'ip', '1b frena por IP: ' || r::text;
  r := csstv_ban_check_ip('t', s_free, '198.51.100.1');
  assert not (r->>'banned')::boolean, '1c otra IP no';
  r := csstv_ban_ip_add('t', '10.0.0.0/8', 60, 'x', null, null, null);
  assert not (r->>'ok')::boolean, '1d rango demasiado grande';
  raise notice '1 ok: !banip';

  -- 2. Excepción por ficha: el servidor la respeta y la copia local la trae
  select id into v_id from ban_ips where ip = '203.0.113.0/24' and lifted_at is null;
  insert into ban_ip_exceptions (ban_ip_id, player_id) values (v_id, p_ok);
  r := csstv_ban_check_ip('t', s_ok, '203.0.113.9');
  assert not (r->>'banned')::boolean, '2a la ficha exceptuada entra';
  r := csstv_ban_ips_active('t');
  assert exists (select 1 from jsonb_array_elements(r->'items') x where x->>'ip' = '203.0.113.0/24' and (x->'except') ? s_ok), '2b la copia trae el SteamID exceptuado';
  assert csstv_ban_ips_compact('t') like '%203.0.113.0/24|%|%' || csstv_steam0(s_ok) || '%', '2c compacto con el exceptuado: ' || csstv_ban_ips_compact('t');
  raise notice '2 ok: excepciones';

  -- 3. !ban con su IP: misma duración que el baneo
  r := csstv_ban_add('t', s_ban, 'Prueba', '76561198000000001', 'Admin', 1440, 'Cheats');
  v_ban := (r->>'ban_id')::uuid;
  r := csstv_ban_ip_add('t', '192.0.2.77', 0, null, '76561198000000001', 'Admin', v_ban);
  assert (r->>'ok')::boolean, '3a';
  assert csstv_bans_compact('t') like '%' || csstv_steam0(s_ban) || '|%', '3a2 el SteamID en el compacto';
  assert csstv_ban_ips_compact('t') like '%192.0.2.77/32|%', '3a3 la IP en el compacto';
  assert (select expires_at from ban_ips where id = (r->>'id')::uuid) = (select expires_at from bans where id = v_ban), '3b mismo vencimiento';
  r := csstv_ban_check_ip('t', s_ban, '192.0.2.77');
  assert (r->>'kind') = 'steam', '3c el SteamID manda';
  r := csstv_ban_check_ip('t', s_free, '192.0.2.77');
  assert (r->>'kind') = 'ip', '3d otra cuenta desde su IP';
  -- Levantar el baneo levanta la IP atada
  update bans set lifted_at = now() where id = v_ban;
  r := csstv_ban_check_ip('t', s_free, '192.0.2.77');
  assert not (r->>'banned')::boolean, '3e levantado';
  raise notice '3 ok: !ban con IP';

  -- 4. !unbanip
  r := csstv_ban_ip_lift('t', '203.0.113.0/24', '76561198000000001', 'Admin');
  assert (r->>'lifted')::int = 1, '4a';
  r := csstv_ban_check_ip('t', s_free, '203.0.113.9');
  assert not (r->>'banned')::boolean, '4b';
  raise notice '4 ok: !unbanip';

  -- 5. Web: los sin ficha y la vista de admin; request_ip_banned con un baneo sin ficha
  perform csstv_ban_ip_add('t', '198.18.0.0/16', 0, 'Permanente', null, 'Admin', null);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select count(*) into n from admin_ban_ips_loose() where ip = '198.18.0.0/16' and expires_at is null;
  assert n = 1, '5a se ve en la web, sin vencimiento';
  perform set_config('request.headers', '{"x-forwarded-for":"198.18.5.5"}', true);
  assert request_ip_banned(), '5b la web también lo frena';
  raise notice '5 ok: web';

  -- 6. Permisos
  assert has_function_privilege('anon', 'public.csstv_ban_check_ip(text,text,text)', 'execute'), '6a';
  assert not has_function_privilege('anon', 'public.admin_ban_ips_loose()', 'execute'), '6b';
  assert not has_function_privilege('anon', 'public.ip_ban_match(inet,uuid,uuid)', 'execute'), '6c';
  raise notice '6 ok: permisos';
end $$;
rollback;

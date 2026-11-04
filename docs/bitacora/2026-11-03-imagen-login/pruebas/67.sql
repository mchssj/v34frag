-- Pruebas del replanteo 67 (imagen del inicio de sesión). Se corren con correr_local.sh, dentro de una transacción que
-- se deshace.
do $$
declare
  u_admin uuid := gen_random_uuid(); u_user uuid := gen_random_uuid();
  v_old text;
  img constant text := 'https://x/storage/v1/object/public/photos/site/1.jpg';
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now(), 'authenticated', 'authenticated' from unnest(array[u_admin, u_user]) x;
  update profiles set role = 'admin' where id = u_admin;

  if site_auth_image() is not null then raise exception 'FALLA 67a: arranca con imagen'; end if;

  -- Un usuario común no puede.
  perform set_config('request.jwt.claims', json_build_object('sub', u_user, 'role', 'authenticated')::text, true);
  begin
    perform site_admin_set_auth_image(img);
    raise exception 'FALLA 67b: un usuario común guardó la imagen';
  exception when insufficient_privilege then null;
  end;

  -- El admin la guarda, la cambia y la quita; cada vez devuelve la anterior.
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  v_old := site_admin_set_auth_image(img);
  if v_old is not null then raise exception 'FALLA 67c: había una imagen antes: %', v_old; end if;
  if site_auth_image() is distinct from img then raise exception 'FALLA 67d: site_auth_image no la devuelve'; end if;
  v_old := site_admin_set_auth_image('  ');
  if v_old is distinct from img or site_auth_image() is not null then raise exception 'FALLA 67e: vacío no la quitó'; end if;
  perform site_admin_set_auth_image(img);
  v_old := site_admin_set_auth_image(null);
  if v_old is distinct from img or site_auth_image() is not null then raise exception 'FALLA 67f: null no la quitó'; end if;

  -- Una sola fila.
  begin
    insert into site_config (id) values (2);
    raise exception 'FALLA 67g: entró una segunda fila';
  exception when check_violation then null;
  end;

  -- Permisos: anon lee la imagen, no la escribe ni ve la tabla.
  if not has_function_privilege('anon', 'public.site_auth_image()', 'execute') then raise exception 'FALLA 67h: anon no puede leerla'; end if;
  if has_function_privilege('anon', 'public.site_admin_set_auth_image(text)', 'execute') then raise exception 'FALLA 67i: anon puede escribirla'; end if;
  if has_table_privilege('anon', 'public.site_config', 'select') or has_table_privilege('authenticated', 'public.site_config', 'update') then
    raise exception 'FALLA 67j: la tabla quedó abierta';
  end if;

  raise notice 'OK: 10 pruebas del replanteo 67';
end $$;

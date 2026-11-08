-- Pruebas de los replanteos 53 (match_list sin la serie del matchmaking) y 54 (imagen del MVP). Se corren con
-- correr_local.sh, dentro de una transacción que se deshace.
do $$
declare
  v_serie uuid; v_mix uuid; v_lobby uuid;
  u_admin uuid := gen_random_uuid(); u_user uuid := gen_random_uuid();
  ok int := 0; v_old text;
begin
  -- 53: una serie mm con su mapa jugado (un mix colgado de ella).
  insert into matches (kind, status, best_of, side1_name, side2_name) values ('mm', 'finished', 1, 'team_a', 'team_b') returning id into v_serie;
  insert into matches (kind, status, best_of, side1_name, side2_name, parent_match_id, parent_side1, map, external_id)
    values ('mix', 'finished', 1, 'A', 'B', v_serie, 1, 'de_dust2', 'prueba-53-' || md5(random()::text)) returning id into v_mix;
  if exists (select 1 from match_list where id = v_serie) then raise exception 'FALLA 53a: la serie mm sigue en match_list'; end if;
  if not exists (select 1 from match_list where id = v_mix and kind = 'mix') then raise exception 'FALLA 53b: el mix no está en match_list'; end if;
  if exists (select 1 from match_list where kind = 'mm') then raise exception 'FALLA 53c: quedan filas mm'; end if;
  if (select reloptions from pg_class where oid = 'public.match_list'::regclass) is distinct from '{security_invoker=true}' then
    raise exception 'FALLA 53d: match_list perdió security_invoker';
  end if;
  ok := ok + 4;

  -- 54: un admin guarda y quita la imagen; un usuario común no puede.
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now(), 'authenticated', 'authenticated' from unnest(array[u_admin, u_user]) x;
  update profiles set role = 'admin' where id = u_admin;
  perform set_config('request.jwt.claims', json_build_object('sub', u_user, 'role', 'authenticated')::text, true);
  begin
    perform mm_admin_set_mvp_image('https://x/storage/v1/object/public/photos/mm/1.webp');
    raise exception 'FALLA 54a: un usuario común guardó la imagen';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  v_old := mm_admin_set_mvp_image('https://x/storage/v1/object/public/photos/mm/1.webp');
  if v_old is not null then raise exception 'FALLA 54b: había una imagen antes: %', v_old; end if;
  if mm_mvp_image() is distinct from 'https://x/storage/v1/object/public/photos/mm/1.webp' then raise exception 'FALLA 54c: mm_mvp_image no la devuelve'; end if;
  if (mm_admin_config()->>'mvp_image_url') is distinct from mm_mvp_image() then raise exception 'FALLA 54d: mm_admin_config no la trae'; end if;
  insert into mm_lobbies (mode, status) values ('5v5', 'finished') returning id into v_lobby;
  if (mm_lobby_json(v_lobby, u_admin)->>'mvp_image_url') is distinct from mm_mvp_image() then raise exception 'FALLA 54e: mm_lobby_json no la trae'; end if;
  v_old := mm_admin_set_mvp_image(null);
  if v_old is distinct from 'https://x/storage/v1/object/public/photos/mm/1.webp' or mm_mvp_image() is not null then
    raise exception 'FALLA 54f: quitar no devolvió la anterior o no la borró';
  end if;
  perform set_config('request.jwt.claims', '', true);
  ok := ok + 6;

  raise notice 'OK: % comprobaciones de los replanteos 53 y 54', ok;
end $$;

-- Pruebas del replanteo 55 (foto de cada jugador en el matchmaking). Se corren con correr_local.sh.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  p1 uuid; p2 uuid; v_party uuid; st jsonb; ok int := 0;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now(), 'authenticated', 'authenticated' from unnest(array[u1, u2]) x;
  insert into profile_details (user_id, avatar_url) values (u1, 'https://x/storage/v1/object/public/avatars/1.webp'), (u2, 'https://x/storage/v1/object/public/avatars/2.webp')
    on conflict (user_id) do update set avatar_url = excluded.avatar_url;
  insert into players (nick, user_id) values ('f1' || substr(md5(random()::text), 1, 8), u1) returning id into p1;
  insert into players (nick, user_id, photo_url) values ('f2' || substr(md5(random()::text), 1, 8), u2, 'https://x/ficha2.webp') returning id into p2;

  -- Sin foto en la ficha: el avatar del perfil. Con foto en la ficha: esa (como player_overview).
  if mm_player_card(p1, u1)->>'photo_url' is distinct from 'https://x/storage/v1/object/public/avatars/1.webp' then raise exception 'FALLA 55a: %', mm_player_card(p1, u1)->>'photo_url'; end if;
  if mm_player_card(p2, u1)->>'photo_url' is distinct from 'https://x/ficha2.webp' then raise exception 'FALLA 55b'; end if;
  if mm_player_card(p1, u1)->>'photo_url' is distinct from (select photo_url from player_overview where id = p1) then raise exception 'FALLA 55c: distinto de player_overview'; end if;
  ok := ok + 3;

  -- Los compañeros del grupo traen su foto.
  insert into mm_parties (leader_id) values (u1) returning id into v_party;
  insert into mm_party_members (party_id, user_id) values (v_party, u1), (v_party, u2);
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  st := mm_my_state();
  perform set_config('request.jwt.claims', '', true);
  if (select count(*) from jsonb_array_elements(st->'party'->'members') m where m->>'photo_url' is not null) <> 2 then
    raise exception 'FALLA 55d: el grupo no trae las fotos: %', st->'party'->'members';
  end if;
  if st->'me'->>'photo_url' is distinct from 'https://x/storage/v1/object/public/avatars/1.webp' then raise exception 'FALLA 55e: me sin foto'; end if;
  ok := ok + 2;

  raise notice 'OK: % comprobaciones del replanteo 55', ok;
end $$;

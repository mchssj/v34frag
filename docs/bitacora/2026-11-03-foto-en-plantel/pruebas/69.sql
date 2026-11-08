-- Pruebas del replanteo 69. Se corren con correr.sh, dentro de una transacción que se deshace.
-- Un jugador con foto solo en la cuenta (profile_details.avatar_url) y otro con foto en la ficha (players.photo_url).
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  pa uuid; pb uuid; t uuid := gen_random_uuid();
  sfx text := substr(md5(random()::text), 1, 6);
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now(), 'authenticated', 'authenticated' from unnest(array[ua, ub]) x;
  insert into profiles (id, role) values (ua, 'user'), (ub, 'user') on conflict (id) do nothing;
  insert into profile_details (user_id, avatar_url) values (ua, 'https://x.test/storage/v1/object/public/avatars/' || ua || '/a.jpg'), (ub, 'https://x.test/storage/v1/object/public/avatars/' || ub || '/b.jpg')
    on conflict (user_id) do update set avatar_url = excluded.avatar_url;
  insert into players (nick, user_id, steam_id) values ('fa69' || sfx, ua, (76561197960265728 + floor(random() * 1e9)::bigint)::text) returning id into pa;
  insert into players (nick, user_id, steam_id, photo_url) values ('fb69' || sfx, ub, (76561197960265728 + floor(random() * 1e9)::bigint)::text, 'https://x.test/ficha.jpg') returning id into pb;
  insert into teams (id, name, tag, kind, captain_id) values (t, 'Foto69 ' || sfx, 'F' || upper(substr(sfx, 1, 3)), 'official', ua);
  insert into team_members (team_id, player_id, role) values (t, pa, 'player'), (t, pb, 'player');

  if (select photo_url from team_members_view where team_id = t and player_id = pa) is distinct from 'https://x.test/storage/v1/object/public/avatars/' || ua || '/a.jpg' then
    raise exception 'FALLA 1: sin foto en la ficha no toma la de la cuenta';
  end if;
  raise notice 'OK 1: sin foto en la ficha, la de la cuenta';
  if (select photo_url from team_members_view where team_id = t and player_id = pb) is distinct from 'https://x.test/ficha.jpg' then
    raise exception 'FALLA 2: la foto de la ficha no manda';
  end if;
  raise notice 'OK 2: con foto en la ficha, manda la de la ficha (como player_overview)';
  if (select photo_url from team_members_view where team_id = t and player_id = pa)
     is distinct from (select photo_url from player_overview where id = pa) then
    raise exception 'FALLA 3: distinta de player_overview';
  end if;
  raise notice 'OK 3: igual que player_overview';
  if (select reloptions from pg_class where oid = 'public.team_members_view'::regclass) is distinct from array['security_invoker=true'] then
    raise exception 'FALLA 4: perdió security_invoker';
  end if;
  raise notice 'OK 4: sigue con security_invoker';
end $$;

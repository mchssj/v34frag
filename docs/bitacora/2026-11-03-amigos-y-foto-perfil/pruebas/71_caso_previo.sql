-- Antes de la 71: una cuenta con su foto y su ficha con otra. El arreglo de datos tiene que respaldarla y borrarla.
create temp table caso (u uuid, p uuid);
insert into caso values (gen_random_uuid(), null);
insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
  select u, u || '@prueba.local', now(), now(), 'authenticated', 'authenticated' from caso;
insert into profile_details (user_id, avatar_url) select u, 'https://x/storage/v1/object/public/avatars/viejo.jpg' from caso
  on conflict (user_id) do update set avatar_url = excluded.avatar_url;
insert into players (nick, user_id, photo_url) select 'prueba71caso', u, 'https://x/photos/viejo.jpg' from caso;
update caso set p = (select id from players where user_id = caso.u) where true;

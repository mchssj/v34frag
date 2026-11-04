-- Después de la inversa: sin las piezas de la 71 y con la foto de la ficha del caso previo restaurada.
do $$ begin
  if to_regclass('public.replanteo71_fotos_ficha') is not null or to_regprocedure('public.mm_friend_users(uuid)') is not null
     or exists (select 1 from pg_trigger where tgname = 'profile_details_avatar_photo') then
    raise exception 'FALLA inversa 71';
  end if;
  if (select photo_url from players where id = (select p from caso)) is distinct from 'https://x/photos/viejo.jpg' then
    raise exception 'FALLA inversa 71: no restauró la foto de la ficha';
  end if;
  raise notice 'OK: la inversa de la 71';
end $$;

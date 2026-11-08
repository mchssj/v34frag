-- Pruebas del replanteo 71 (amigos al instante y la foto de perfil). Se corren con correr_local.sh, dentro de una
-- transacción que se deshace. Los avisos se capturan reemplazando mm_emit por una versión que los anota.
create temp table avisos (t text, users uuid[], d jsonb);
grant all on avisos to public;  -- las funciones security definer corren como su dueño
create or replace function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null) returns void
  language sql as $$ insert into avisos values (p_type, p_users, p_data) $$;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  pa uuid; pb uuid; pc uuid; v avisos;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now(), 'authenticated', 'authenticated' from unnest(array[ua, ub]) x;
  insert into players (nick, user_id) values ('prueba71a', ua) returning id into pa;
  insert into players (nick, user_id) values ('prueba71b', ub) returning id into pb;
  insert into players (nick) values ('prueba71sincuenta') returning id into pc;

  -- B suma a A: el aviso va a A y a B.
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  perform mm_add_friend(pa);
  select * into v from avisos order by ctid desc limit 1;
  if v.t is distinct from 'friend.changed' or not (v.users @> array[ua, ub]) or cardinality(v.users) <> 2 then
    raise exception 'FALLA 71a: el aviso de sumar no fue a los dos: %', v;
  end if;
  if (v.d->>'player_id')::uuid is distinct from pa then raise exception 'FALLA 71b: d sin player_id'; end if;

  -- Sumarlo de nuevo no avisa (no cambió nada).
  delete from avisos where true;
  perform mm_add_friend(pa);
  if exists (select 1 from avisos) then raise exception 'FALLA 71c: avisó sin cambio'; end if;

  -- Una ficha sin cuenta: el aviso va solo a quien lo hizo (nunca la lista vacía, que es "a todos").
  perform mm_add_friend(pc);
  select * into v from avisos order by ctid desc limit 1;
  if v.users is distinct from array[ub] then raise exception 'FALLA 71d: ficha sin cuenta, destinatarios %', v.users; end if;

  -- Sacar avisa; sacar a quien no está, no.
  delete from avisos where true;
  perform mm_remove_friend(pa);
  if (select count(*) from avisos where t = 'friend.changed' and users @> array[ua, ub]) <> 1 then raise exception 'FALLA 71e: sacar no avisó'; end if;
  delete from avisos where true;
  perform mm_remove_friend(pa);
  if exists (select 1 from avisos) then raise exception 'FALLA 71f: sacar a quien no está avisó'; end if;

  -- Foto: un admin le pone foto a la ficha de A; A sube la suya y gana la suya.
  update players set photo_url = 'https://x/photos/ficha.jpg' where id = pa;
  insert into profile_details (user_id, avatar_url) values (ua, 'https://x/storage/v1/object/public/avatars/1.jpg')
    on conflict (user_id) do update set avatar_url = excluded.avatar_url;
  if (select photo_url from players where id = pa) is not null then raise exception 'FALLA 71g: al subir su foto quedó la de la ficha'; end if;
  if (select photo_url from player_overview where id = pa) is distinct from 'https://x/storage/v1/object/public/avatars/1.jpg' then raise exception 'FALLA 71h: player_overview no muestra la suya'; end if;

  -- Después el admin pone otra: se ve la del admin. Cambiar otra cosa del perfil no la toca.
  update players set photo_url = 'https://x/photos/ficha2.jpg' where id = pa;
  update profile_details set real_name = 'Prueba' where user_id = ua;
  if (select photo_url from player_overview where id = pa) is distinct from 'https://x/photos/ficha2.jpg' then raise exception 'FALLA 71i: se perdió la del admin'; end if;

  -- Quitar su foto (null) no borra la de la ficha.
  update profile_details set avatar_url = null where user_id = ua;
  if (select photo_url from players where id = pa) is distinct from 'https://x/photos/ficha2.jpg' then raise exception 'FALLA 71j: quitar la foto borró la de la ficha'; end if;

  -- La ficha de B no se tocó.
  update players set photo_url = 'https://x/photos/b.jpg' where id = pb;
  update profile_details set avatar_url = 'https://x/storage/v1/object/public/avatars/2.jpg' where user_id = ua;
  if (select photo_url from players where id = pb) is distinct from 'https://x/photos/b.jpg' then raise exception 'FALLA 71k: tocó otra ficha'; end if;

  raise notice 'OK: 11 pruebas del replanteo 71';
end $$;

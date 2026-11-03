-- Inversa del replanteo 70: amigos sin aviso por el socket (como en la 48), sin el trigger de la foto y con las fotos de
-- ficha que la 70 había borrado (solo si la ficha sigue sin foto: una que puso un admin después no se pisa).
begin;

create or replace function public.mm_add_friend(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if (select user_id from players where id = p_player) = auth.uid() then raise exception 'No te podés sumar a vos mismo'; end if;
  insert into mm_friends (user_id, player_id) values (auth.uid(), p_player) on conflict do nothing;
end $$;

create or replace function public.mm_remove_friend(p_player uuid) returns void
  language sql security definer set search_path = public as $$ delete from mm_friends where user_id = auth.uid() and player_id = p_player $$;

drop function if exists public.mm_friend_users(uuid);

drop trigger if exists profile_details_avatar_photo on public.profile_details;
drop function if exists public.profile_avatar_clears_player_photo();

update players p set photo_url = r.photo_url from replanteo70_fotos_ficha r where r.player_id = p.id and p.photo_url is null;
drop table if exists public.replanteo70_fotos_ficha;

notify pgrst, 'reload schema';
commit;

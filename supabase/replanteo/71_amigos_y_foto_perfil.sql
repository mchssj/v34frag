-- Replanteo 71: amigos al instante y la misma foto de perfil en toda la web (bitácora docs/bitacora/2026-11-03-amigos-y-foto-perfil).
--   - mm_add_friend y mm_remove_friend avisan friend.changed por el socket: a la otra persona (su lista deja de decir
--     "Todavía no te marcó" sin recargar) y a quien lo hizo (sus otras pestañas). Antes no avisaban nada.
--   - Gana la última foto que se subió (Daniel, 2026-11-03): cuando el jugador cambia su foto (profile_details.avatar_url),
--     se borra la de su ficha (players.photo_url), que le ganaba en coalesce(players.photo_url, avatar_url). Si después
--     un admin le pone otra a la ficha, se ve la del admin.
--   - Las fichas que ya tenían otra foto pasan a mostrar la del jugador; las fotos borradas quedan en replanteo71_fotos_ficha.
-- Va después de la 70 (70_aviso_staff_equipos.sql, de Kyan; antes este era el 70). Es del matchmaking: va en feat/frontend-fase-1 y en feat/mm-claim-en-sala.
begin;

-- Amigos ------------------------------------------------------------------------------------------------------------
-- mm_emit con la lista vacía avisa a todos: solo se suman usuarios que existen.
create or replace function public.mm_friend_users(p_player uuid) returns uuid[]
  language sql stable security definer set search_path = public as $$
  select array_remove(array[auth.uid(), (select user_id from players where id = p_player and user_id is distinct from auth.uid())], null) $$;

create or replace function public.mm_add_friend(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if (select user_id from players where id = p_player) = auth.uid() then raise exception 'No te podés sumar a vos mismo'; end if;
  insert into mm_friends (user_id, player_id) values (auth.uid(), p_player) on conflict do nothing;
  -- (replanteo 71) la otra persona ve el cambio sin recargar
  if found then perform mm_emit('friend.changed', null, mm_friend_users(p_player), jsonb_build_object('player_id', p_player)); end if;
end $$;

create or replace function public.mm_remove_friend(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from mm_friends where user_id = auth.uid() and player_id = p_player;
  if found then perform mm_emit('friend.changed', null, mm_friend_users(p_player), jsonb_build_object('player_id', p_player)); end if;
end $$;

revoke all on function public.mm_friend_users(uuid) from public, anon, authenticated;
grant execute on function public.mm_friend_users(uuid) to service_role;

-- Foto de perfil ----------------------------------------------------------------------------------------------------
create function public.profile_avatar_clears_player_photo() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.avatar_url is not null and new.avatar_url is distinct from (case when tg_op = 'UPDATE' then old.avatar_url end) then
    update players set photo_url = null where user_id = new.user_id and photo_url is not null;
  end if;
  return null;
end $$;
comment on function public.profile_avatar_clears_player_photo() is 'Gana la última foto: al subir la suya, el jugador deja de ver la de su ficha (replanteo 71)';
revoke all on function public.profile_avatar_clears_player_photo() from public, anon, authenticated;

create trigger profile_details_avatar_photo after insert or update of avatar_url on public.profile_details
  for each row execute function public.profile_avatar_clears_player_photo();

-- Las que ya estaban distintas: se respaldan y pasa a verse la del jugador.
create table public.replanteo71_fotos_ficha (player_id uuid primary key, photo_url text not null, saved_at timestamptz not null default now());
comment on table public.replanteo71_fotos_ficha is 'Fotos de ficha que el replanteo 71 borró porque la cuenta tenía otra. La inversa las restaura';
alter table public.replanteo71_fotos_ficha enable row level security;
revoke all on table public.replanteo71_fotos_ficha from public, anon, authenticated;

insert into replanteo71_fotos_ficha (player_id, photo_url)
  select p.id, p.photo_url from players p join profile_details d on d.user_id = p.user_id
  where p.photo_url is not null and d.avatar_url is not null and p.photo_url <> d.avatar_url;
update players p set photo_url = null from replanteo71_fotos_ficha r where r.player_id = p.id;

notify pgrst, 'reload schema';

commit;

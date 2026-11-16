-- Inversa del replanteo 125: mm_active_lobby vuelve a contar también las salas donde el jugador ya fue reemplazado.
begin;

create or replace function public.mm_active_lobby(p_user uuid) returns uuid
  language sql stable as $$
  select l.id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id
   where lp.user_id = p_user and l.status not in ('finished', 'cancelled')
   order by l.created_at desc limit 1 $$;
comment on function public.mm_active_lobby(uuid) is null;

notify pgrst, 'reload schema';

commit;

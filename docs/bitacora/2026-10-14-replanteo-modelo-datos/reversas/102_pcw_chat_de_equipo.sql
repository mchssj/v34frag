-- Inversa del replanteo 102 (chat de equipo en la sala de la PCW): mm_my_team y mm_chat_can_read vuelven a como los dejó
-- la 48 y se borra la política "chat: lado propio". Los mensajes de equipo de PCW que ya existan quedan, pero los lee
-- cualquiera que lea el chat de esa partida.
begin;

do $$
begin
  if not exists (select 1 from pg_policy where polrelid = 'public.match_chat'::regclass and polname = 'chat: lado propio') then
    raise exception 'inversa 102: falta la política "chat: lado propio" (¿se aplicó la 102?)';
  end if;
end $$;

drop policy "chat: lado propio" on public.match_chat;

create or replace function public.mm_my_team(p_match uuid) returns smallint
  language sql stable security definer set search_path = public as $$
  select lp.team from mm_lobbies l join mm_lobby_players lp on lp.lobby_id = l.id where l.match_id = p_match and lp.user_id = auth.uid() $$;

create or replace function public.mm_chat_can_read(p_match uuid, p_side smallint) returns boolean
  language sql stable security definer set search_path = public as $$
  select not exists (select 1 from matches m where m.id = p_match and m.kind = 'mm')
      or is_admin()
      or exists (select 1 from mm_lobbies l join mm_lobby_players lp on lp.lobby_id = l.id
                  where l.match_id = p_match and lp.user_id = auth.uid() and (p_side is null or lp.team = p_side)) $$;

commit;

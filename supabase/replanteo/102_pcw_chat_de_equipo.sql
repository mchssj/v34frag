-- 102: chat de equipo en la sala de la PCW (bitácora docs/bitacora/2026-11-09-pcw-chat-de-equipo, Daniel 2026-11-09).
--
--   1. mm_my_team: sin sala del matchmaking, en una PCW devuelve el lado de match_my_side (null si no juega).
--   2. mm_chat_can_read: en una PCW, un mensaje con lado lo leen ese lado y los admins.
--   3. "chat: lado propio": nadie escribe con un lado que no es el suyo (también en el matchmaking).
-- Necesita la 48 y la 56. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/102_pcw_chat_de_equipo.sql.
begin;

do $$
begin
  if to_regprocedure('public.mm_my_team(uuid)') is null then raise exception 'replanteo 102: falta la 48 (mm_my_team)'; end if;
  if to_regprocedure('public.match_my_side(uuid)') is null then raise exception 'replanteo 102: falta la 56 (match_my_side)'; end if;
  if exists (select 1 from pg_policy where polrelid = 'public.match_chat'::regclass and polname = 'chat: lado propio') then
    raise exception 'replanteo 102: ya se aplicó (política "chat: lado propio")';
  end if;
end $$;

/** Mi lado en la partida: el del matchmaking o, en una PCW, el de match_my_side. */
create or replace function public.mm_my_team(p_match uuid) returns smallint
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select lp.team from mm_lobbies l join mm_lobby_players lp on lp.lobby_id = l.id where l.match_id = p_match and lp.user_id = auth.uid()),
    (select nullif(match_my_side(m.id), 0)::smallint from matches m where m.id = p_match and m.kind = 'pcw')) $$;

/** En una mm leen los 10 y los admins; en una PCW, los mensajes de equipo solo ese lado y los admins. */
create or replace function public.mm_chat_can_read(p_match uuid, p_side smallint) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select case m.kind
      when 'mm' then is_admin()
        or exists (select 1 from mm_lobbies l join mm_lobby_players lp on lp.lobby_id = l.id
                    where l.match_id = p_match and lp.user_id = auth.uid() and (p_side is null or lp.team = p_side))
      -- Sin lado (o sin sesión) mm_my_team es null: el coalesce de afuera lo daría por bueno.
      when 'pcw' then p_side is null or is_admin() or coalesce(mm_my_team(p_match) = p_side, false)
      else true end
    from matches m where m.id = p_match), true) $$;

create policy "chat: lado propio" on public.match_chat as restrictive for insert to authenticated
  with check (side is null or side = mm_my_team(match_id));

commit;

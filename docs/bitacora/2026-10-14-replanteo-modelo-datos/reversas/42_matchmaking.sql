-- Inversa del replanteo 42 (matchmaking). Borra las salas y las partidas mm.
begin;

drop trigger if exists mm_notify_chat on public.match_chat;
drop policy if exists "chat: mm solo la sala" on public.match_chat;
drop view if exists public.match_chat_public;
create view public.match_chat_public as
  select c.id, c.match_id, c.user_id, coalesce(p.tag, c.tag, 'Usuario'::text) as alias, c.message, c.created_at
    from match_chat c left join profiles p on p.id = c.user_id;
grant select on public.match_chat_public to anon, authenticated;

create or replace function public.match_chat_can_write(p_match uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from matches m where m.id = p_match
       and (m.kind = 'mix' or is_admin() or (m.event_id is not null and can_manage_event(m.event_id)) or is_match_participant(p_match)))
$$;

drop function public.veto_act(uuid, text, text);
alter function public.veto_act_base(uuid, text, text) rename to veto_act;
grant execute on function public.veto_act(uuid, text, text) to authenticated;
drop function public.csstv_link_game(uuid, text, int);
alter function public.csstv_link_game_base(uuid, text, int) rename to csstv_link_game;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'mm\_%' or p.proname like 'csstv\_mm\_%') loop
    execute format('drop function %s cascade', f.sig);
  end loop;
end $$;

drop table public.mm_server_passwords, public.mm_server_state, public.mm_sound_choice, public.mm_sounds, public.mm_commends,
  public.mm_friends, public.mm_blocks, public.mm_bans, public.mm_reports, public.mm_penalty_log, public.mm_penalties,
  public.mm_lobby_players, public.mm_lobbies, public.mm_queue_log, public.mm_queue, public.mm_party_invites,
  public.mm_party_members, public.mm_parties, public.mm_mode_maps, public.mm_mode_settings, public.mm_config;

delete from public.matches where kind = 'mm';
alter table public.matches drop constraint matches_kind_check;
alter table public.matches add constraint matches_kind_check check (kind = any (array['official', 'pcw', 'mix'])) not valid;
delete from public.notifications where category = 'mm';
alter table public.notifications drop constraint notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category = any (array['team', 'tournament', 'pcw', 'elo', 'season', 'account', 'news', 'admin']));
delete from public.match_vetos where team_id is null;
alter table public.match_vetos drop column side, alter column team_id set not null, alter column by_user set not null;
alter table public.match_chat drop column side;
alter table public.game_servers drop column mm_enabled;

notify pgrst, 'reload schema';

commit;

-- Inversa de supabase/replanteo/36_hud_relay.sql: se borran las tablas, las funciones y las columnas del HUD, los avisos
-- de streamer, admin_server_list vuelve a la de la 27, admin_user_list a la de la 11 y notification_category a la de la 35.
begin;

delete from public.notifications where type in ('streamer_granted', 'streamer_revoked');

-- Como en la 27 (create or replace no puede quitar columnas).
drop view public.admin_server_list;
create view public.admin_server_list with (security_invoker = true) as
select g.id, g.name, g.active, g.created_at, g.last_seen_at, g.connect_address, g.panel_server_id,
       g.license_expires_at, g.allowed_ip, g.last_ip, g.plugin_version,
       case when not g.active then 'revoked'
            when g.license_expires_at <= now() then 'expired'
            when g.license_expires_at <= now() + interval '7 days' then 'expiring'
            else 'ok' end as license_state,
       coalesce(g.last_seen_at > now() - interval '35 minutes', false) as online,
       g.panel_server_id is not null as has_panel,
       (select count(*)::int from matches m where m.server_id = g.id) as matches,
       (select max(coalesce(m.played_at, m.starts_at)) from matches m where m.server_id = g.id) as last_match_at,
       search_norm(concat_ws(' ', g.name, g.connect_address, g.allowed_ip, g.last_ip, g.plugin_version, g.region)) as search,
       g.mode, g.region, g.tv_port
  from game_servers g;
grant select on public.admin_server_list to authenticated;

-- Como en la 11.
drop view public.admin_user_list;
create view public.admin_user_list as
select pr.id, pr.tag as alias, pr.role, pr.tag_changed_at as alias_changed_at, p.id as player_id, p.steam_id,
       p.id is not null as has_player, p.steam_id is not null as has_steam, search_norm(pr.tag) as search
  from profiles pr
  left join players p on p.user_id = pr.id
 where is_admin();
grant select on public.admin_user_list to authenticated;

drop view public.hud_streamer_list;
drop function public.hud_streaming(uuid);
drop function public.hud_relay_config(text, jsonb, jsonb);
drop function public.hud_streamer_new_token();
drop function public.admin_revoke_streamer(uuid);
drop function public.admin_grant_streamer(uuid);
drop function public.admin_regenerate_hud_key(uuid);
drop function public.admin_set_server_hud(uuid, integer, boolean);
drop function public.hud_new_key();
drop table public.hud_sessions;
drop table public.hud_relays;
drop table public.hud_streamers;
drop trigger game_servers_hud_off on public.game_servers;
drop function public.tg_game_servers_hud_off();
alter table public.game_servers drop column hud_seen_at, drop column hud_key, drop column hud_enabled, drop column hud_port;

-- Como en la 35.
create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered') then 'team'
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled', 'event_lineup', 'match_soon') then 'tournament' -- (replanteo 35) match_soon
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result', 'pcw_soon', 'pcw_expired') then 'pcw' -- (replanteo 35) pcw_soon y pcw_expired
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted', 'season_ending') then 'season' -- (replanteo 35) season_ending
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked', 'vip_expiring') then 'account' -- (replanteo 35) vip_expiring
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed',
                    'match_no_result') then 'admin' -- (replanteo 35) match_no_result
  end $$;

commit;

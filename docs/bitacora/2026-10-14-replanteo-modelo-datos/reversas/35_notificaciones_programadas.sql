-- Inversa de supabase/replanteo/35_notificaciones_programadas.sql: se borran notify_due, notification_sent y los avisos
-- programados, y notification_category queda como en la 33.
begin;

delete from public.notifications
 where type in ('match_soon', 'pcw_soon', 'pcw_expired', 'season_ending', 'match_no_result', 'vip_expiring');

drop function public.notify_due();
drop table public.notification_sent;

-- Como en la 33.
create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered') then 'team'
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled', 'event_lineup') then 'tournament' -- (replanteo 33) event_lineup
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result') then 'pcw'
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted') then 'season'
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked') then 'account' -- (replanteo 32)
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed') then 'admin'
  end $$;

commit;

-- Inversa de supabase/replanteo/28_notificaciones.sql: borra las notificaciones, sus triggers y funciones, y deja
-- season_close_due como estaba. Las preferencias de notificaciones que haya en user_preferences quedan (no molestan).
begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 28: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.season_close_due()', array[
  [E'    perform notify_season_delayed(s.id); -- (replanteo 28)\n', '']
]);

drop trigger notify_team_invites on public.team_invites;
drop trigger notify_teams_captain on public.teams;
drop trigger notify_teams_delete on public.teams;
drop trigger notify_team_members on public.team_members;
drop trigger notify_team_requests on public.team_requests;
drop trigger notify_steam_requests on public.steam_requests;
drop trigger notify_claim_log on public.claim_log;
drop trigger notify_profiles on public.profiles;
drop trigger notify_player_elo on public.player_elo;
drop trigger notify_match_crashes on public.match_crashes;
drop trigger notify_mix_deletions on public.mix_deletions;
drop trigger notify_elo_adjustments on public.elo_adjustments;
drop trigger notify_match_clips on public.match_clips;
drop trigger notify_season_standings on public.season_standings;
drop trigger notify_seasons on public.seasons;
drop trigger notify_player_medals on public.player_medals;
drop trigger notify_matches on public.matches;
drop trigger notify_match_vetos on public.match_vetos;
drop trigger notify_events on public.events;
drop trigger notify_events_delete on public.events;
drop trigger notify_registrations on public.tournament_registrations;
drop trigger notify_pcw_posts on public.pcw_posts;

drop function public.tg_notify_team_invites(), public.tg_notify_teams(), public.tg_notify_team_members(),
  public.tg_notify_team_requests(), public.tg_notify_steam_requests(), public.tg_notify_claim_log(), public.tg_notify_profiles(),
  public.tg_notify_player_elo(), public.tg_notify_match_crashes(), public.tg_notify_mix_deletions(), public.tg_notify_elo_adjustments(),
  public.tg_notify_match_clips(), public.tg_notify_season_standings(), public.tg_notify_seasons(), public.tg_notify_player_medals(),
  public.tg_notify_matches(), public.tg_notify_match_vetos(), public.tg_notify_events(), public.tg_notify_registrations(),
  public.tg_notify_pcw_posts();

drop view public.notification_list;
drop function public.notifications_mark_read(bigint[], boolean), public.notifications_unread(),
  public.notify_season_delayed(uuid), public.notify(uuid[], text, jsonb, text, boolean), public.notifications_resolve(text, text),
  public.notification_wants(uuid, text), public.users_of_players(uuid[]), public.users_of_steam(text[]),
  public.team_roster_users(uuid), public.side_users(uuid, uuid), public.match_users(uuid), public.mix_users(uuid),
  public.notify_admin_ids(), public.team_ref(uuid), public.player_ref(uuid), public.event_ref(uuid), public.match_ref(uuid);
drop table public.notifications;
drop function public.notification_required(text), public.notification_category(text), public.elo_level(integer);

commit;

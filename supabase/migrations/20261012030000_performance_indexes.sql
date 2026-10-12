-- Phase 11: indexes for frequent filters, joins, and ordered lists.
-- Safe to apply repeatedly; existing primary/unique indexes are left intact.
create index if not exists match_chat_match_created_idx
  on public.match_chat (match_id, created_at desc);

create index if not exists match_vetos_match_seq_idx
  on public.match_vetos (match_id, seq);

create index if not exists tournament_registrations_event_team_idx
  on public.tournament_registrations (event_id, team_id);

create index if not exists player_medals_player_idx
  on public.player_medals (player_id);

create index if not exists player_map_stats_player_idx
  on public.player_map_stats (player_id);

create index if not exists profile_requests_status_created_idx
  on public.profile_requests (status, created_at desc);

create index if not exists team_requests_user_idx
  on public.team_requests (user_id);

create index if not exists pcw_posts_status_created_idx
  on public.pcw_posts (status, created_at desc);

create index if not exists match_player_stats_match_idx
  on public.match_player_stats (match_id);

create index if not exists matches_event_idx
  on public.matches (event_id);

create index if not exists game_servers_matchmaking_idx
  on public.game_servers (active, matchmaking_enabled);

\timing on
select player_id as p from match_player_stats where player_id is not null group by 1 order by count(*) desc limit 1 \gset
select match_id as m from match_clips order by created_at desc limit 1 \gset
begin;
create or replace function render_auth(p_token text) returns uuid language plpgsql as $x$ begin return null; end $x$;
\echo '--- match_clip_list de una partida (antes 390 ms)'
select count(*) from match_clip_list where match_id = :'m';
select count(*) from match_clip_list where match_id = :'m';
\echo '--- clip_discord_pending (antes 780 ms)'
select length(clip_discord_pending('x', 5, 20)::text);
\echo '--- player_featured_clips_list (antes 400 ms)'
select count(*) from player_featured_clips_list(:'p');
\echo '--- clip_render_claim (antes 450 ms)'
select length(clip_render_claim('x')::text);
\echo '--- clips_notify_detected'
select clips_notify_detected(:'m');
rollback;

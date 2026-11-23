-- Pruebas del replanteo 136 (base local con la migración aplicada). Cada caso corre en su transacción y se deshace.
-- Compara match_clip_ranks con el cálculo de la vista vieja (la de la 76), que se recrea como vista temporal.
\set ON_ERROR_STOP 1
\pset footer off

drop view if exists ranked_ref;
create view ranked_ref as
WITH cfg AS (
         SELECT clip_config.priorities,
            clip_config.per_player,
            clip_config.per_match,
            clip_config.vip_per_match
           FROM clip_config
          WHERE (clip_config.id = 1)
        ), tipados AS (
         SELECT c.id,
            c.match_id,
            c.round,
            c.player_steamid,
            c.player_name,
            c.round_seconds,
            c.round_won,
            c.kill_ticks,
            c.clutch_vs,
            c.clutch_start_tick,
            c.end_tick,
            c.created_at,
            c.video_status,
            c.video_key,
            c.video_bytes,
            c.video_seconds,
            c.video_drive_id,
            c.video_attempts,
            c.video_error,
            c.video_claimed_at,
            c.video_rendered_at,
            c.video_r2_deleted_at,
            c.discord_posted_at,
            c.discord_message_id,
            c.video_forced,
            c.video_forced_at,
            c.video_forced_by,
            c.video_review,
            c.video_reprocessed_at,
            c.video_reprocess_count,
            c.video_reviewed_at,
            c.video_reviewed_by,
            clip_type(cardinality(c.kill_ticks), c.clutch_vs, c.round_won, cfg.priorities) AS type,
            cfg.priorities,
            cfg.per_player,
            cfg.per_match,
            cfg.vip_per_match,
            o.owner_id,
            COALESCE(vip_at(pl_1.user_id, COALESCE(m_1.played_at, c.created_at)), false) AS owner_vip
           FROM ((((match_clips c
             CROSS JOIN cfg)
             JOIN matches m_1 ON ((m_1.id = c.match_id)))
             CROSS JOIN LATERAL ( SELECT steam_owner(c.player_steamid) AS owner_id) o)
             LEFT JOIN players pl_1 ON ((pl_1.id = o.owner_id)))
        ), con_prioridad AS (
         SELECT t.id,
            t.match_id,
            t.round,
            t.player_steamid,
            t.player_name,
            t.round_seconds,
            t.round_won,
            t.kill_ticks,
            t.clutch_vs,
            t.clutch_start_tick,
            t.end_tick,
            t.created_at,
            t.video_status,
            t.video_key,
            t.video_bytes,
            t.video_seconds,
            t.video_drive_id,
            t.video_attempts,
            t.video_error,
            t.video_claimed_at,
            t.video_rendered_at,
            t.video_r2_deleted_at,
            t.discord_posted_at,
            t.discord_message_id,
            t.video_forced,
            t.video_forced_at,
            t.video_forced_by,
            t.video_review,
            t.video_reprocessed_at,
            t.video_reprocess_count,
            t.video_reviewed_at,
            t.video_reviewed_by,
            t.type,
            t.priorities,
            t.per_player,
            t.per_match,
            t.vip_per_match,
            t.owner_id,
            t.owner_vip,
            ((t.priorities ->> t.type))::integer AS priority
           FROM tipados t
        ), por_jugador AS (
         SELECT p.id,
            p.match_id,
            p.round,
            p.player_steamid,
            p.player_name,
            p.round_seconds,
            p.round_won,
            p.kill_ticks,
            p.clutch_vs,
            p.clutch_start_tick,
            p.end_tick,
            p.created_at,
            p.video_status,
            p.video_key,
            p.video_bytes,
            p.video_seconds,
            p.video_drive_id,
            p.video_attempts,
            p.video_error,
            p.video_claimed_at,
            p.video_rendered_at,
            p.video_r2_deleted_at,
            p.discord_posted_at,
            p.discord_message_id,
            p.video_forced,
            p.video_forced_at,
            p.video_forced_by,
            p.video_review,
            p.video_reprocessed_at,
            p.video_reprocess_count,
            p.video_reviewed_at,
            p.video_reviewed_by,
            p.type,
            p.priorities,
            p.per_player,
            p.per_match,
            p.vip_per_match,
            p.owner_id,
            p.owner_vip,
            p.priority,
            row_number() OVER (PARTITION BY p.match_id, COALESCE((p.owner_id)::text, p.player_steamid) ORDER BY p.priority, p.round_won DESC, p.round DESC) AS rank_player
           FROM con_prioridad p
        ), por_partida AS (
         SELECT j.id,
            j.match_id,
            j.round,
            j.player_steamid,
            j.player_name,
            j.round_seconds,
            j.round_won,
            j.kill_ticks,
            j.clutch_vs,
            j.clutch_start_tick,
            j.end_tick,
            j.created_at,
            j.video_status,
            j.video_key,
            j.video_bytes,
            j.video_seconds,
            j.video_drive_id,
            j.video_attempts,
            j.video_error,
            j.video_claimed_at,
            j.video_rendered_at,
            j.video_r2_deleted_at,
            j.discord_posted_at,
            j.discord_message_id,
            j.video_forced,
            j.video_forced_at,
            j.video_forced_by,
            j.video_review,
            j.video_reprocessed_at,
            j.video_reprocess_count,
            j.video_reviewed_at,
            j.video_reviewed_by,
            j.type,
            j.priorities,
            j.per_player,
            j.per_match,
            j.vip_per_match,
            j.owner_id,
            j.owner_vip,
            j.priority,
            j.rank_player,
            row_number() OVER (PARTITION BY j.match_id ORDER BY j.priority, j.round_won DESC, j.round DESC, j.player_steamid) AS rank_match
           FROM por_jugador j
          WHERE ((j.rank_player <= j.per_player) AND (NOT j.owner_vip))
        ), top AS (
         SELECT pp.id,
            pp.match_id,
            pp.rank_match AS pos
           FROM por_partida pp
          WHERE (pp.rank_match <= pp.per_match)
        ), vips AS (
         SELECT j.id,
            j.match_id,
            (( SELECT count(*) AS count
                   FROM top t
                  WHERE (t.match_id = j.match_id)) + row_number() OVER (PARTITION BY j.match_id ORDER BY j.priority, j.round_won DESC, j.round DESC, j.player_steamid)) AS pos
           FROM por_jugador j
          WHERE (j.owner_vip AND (j.rank_player <= j.vip_per_match))
        ), forzadas AS (
         SELECT p.id,
            p.match_id,
            ((( SELECT count(*) AS count
                   FROM top t
                  WHERE (t.match_id = p.match_id)) + ( SELECT count(*) AS count
                   FROM vips v
                  WHERE (v.match_id = p.match_id))) + row_number() OVER (PARTITION BY p.match_id ORDER BY p.priority, p.round_won DESC, p.round DESC, p.player_steamid)) AS pos
           FROM con_prioridad p
          WHERE (p.video_forced AND (NOT (EXISTS ( SELECT 1
                   FROM top t
                  WHERE (t.id = p.id)))) AND (NOT (EXISTS ( SELECT 1
                   FROM vips v
                  WHERE (v.id = p.id)))))
        ), lista AS (
         SELECT top.id,
            top.pos,
            false AS vip
           FROM top
        UNION ALL
         SELECT vips.id,
            vips.pos,
            true
           FROM vips
        UNION ALL
         SELECT forzadas.id,
            forzadas.pos,
            false
           FROM forzadas
        )
 SELECT r.id,
    r.match_id,
    (l.pos)::integer AS "position",
    r.type,
    r.priority,
    (r.round)::integer AS round,
    (r.round_seconds)::integer AS round_seconds,
    r.round_won,
    r.player_steamid,
    pl.id AS player_id,
    COALESCE(NULLIF(r.player_name, ''::text), pl.nick) AS player_name,
    cardinality(r.kill_ticks) AS kills,
    r.kill_ticks,
    (r.clutch_vs)::integer AS clutch_vs,
    r.clutch_start_tick,
    r.end_tick,
    (m.tickrate)::integer AS tickrate,
    m.demo_status,
    m.status AS match_status,
    r.created_at,
    r.video_status,
    r.video_key,
    r.video_seconds,
    r.video_drive_id,
    ((r.video_status = 'done'::text) AND (r.video_r2_deleted_at IS NULL)) AS video_in_r2,
    r.video_forced AS forced,
    l.vip,
    r.video_review AS review
   FROM (((lista l
     JOIN con_prioridad r ON ((r.id = l.id)))
     JOIN matches m ON ((m.id = r.match_id)))
     LEFT JOIN players pl ON ((pl.id = r.owner_id)));
\set diff 'select count(*) as diferencias from ((select id, match_id, position, vip, type, priority, player_id from ranked_ref except all select clip_id, match_id, position, vip, type, priority, owner_id from match_clip_ranks) union all (select clip_id, match_id, position, vip, type, priority, owner_id from match_clip_ranks except all select id, match_id, position, vip, type, priority, player_id from ranked_ref)) d;'

select c.match_id as m, c.id as clip, c.player_steamid as steam
  from match_clips c join match_clip_ranks k on k.clip_id = c.id
 order by c.created_at desc limit 1 \gset
select c.id as fuera from match_clips c where not exists (select 1 from match_clip_ranks k where k.clip_id = c.id)
 and c.match_id = :'m' limit 1 \gset

\echo '== 0. sin cambios'
begin; :diff rollback;

\echo '== 1. clip nuevo (as en una ronda nueva de la última partida)'
begin;
insert into match_clips(match_id, round, player_steamid, player_name, round_seconds, round_won, kill_ticks)
select match_id, 99, player_steamid, player_name, round_seconds, true, array[1,2,3,4,5] from match_clips where id = :'clip';
:diff rollback;

\echo '== 2. cambian las prioridades (clip_config)'
begin;
update clip_config set priorities = (select jsonb_object_agg(k, (100 - v::int)) from jsonb_each_text(priorities) e(k, v)) where id = 1;
:diff rollback;

\echo '== 3. cambian los topes (per_match = 1)'
begin;
update clip_config set per_match = 1 where id = 1;
:diff rollback;

\echo '== 4. se fuerza un clip que no estaba en la lista'
begin;
update match_clips set video_forced = true where id = coalesce(:'fuera', :'clip')::uuid;
:diff rollback;

\echo '== 5. se borra un clip de la lista'
begin;
delete from match_clips where id = :'clip';
:diff rollback;

\echo '== 6. cambia played_at de la partida'
begin;
update matches set played_at = played_at - interval '400 days' where id = :'m';
:diff rollback;

\echo '== 7. VIP nuevo para el dueño de un clip (desde siempre)'
begin;
insert into vip_memberships(user_id, starts_at, source)
select p.user_id, '2000-01-01', 'manual' from match_clip_ranks k join players p on p.id = k.owner_id
 where k.match_id = :'m' and p.user_id is not null limit 1;
:diff rollback;

\echo '== 8. la ficha pierde su SteamID'
begin;
update players set steam_id = null where steam_id = :'steam';
:diff rollback;

\echo '== 9. una SteamID de invitado pasa a ser extra de una ficha'
begin;
insert into player_extra_steam_ids(steam_id, player_id)
select c.player_steamid, (select id from players order by created_at limit 1)
  from match_clips c where steam_owner(c.player_steamid) is null and c.player_steamid is not null limit 1;
:diff rollback;

\echo '== 10. cambiar solo el video de todos los clips no recalcula (tiene que tardar poco)'
begin;
\timing on
update match_clips set video_seconds = coalesce(video_seconds, 0) + 1 where true;
\timing off
rollback;

drop view ranked_ref;

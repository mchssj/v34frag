-- Inversa de supabase/replanteo/26_clips.sql: match_clip_list vuelve a buscar la ficha solo por players.steam_id,
-- como en la migración 20261024180000_clips_forzados.sql. Los clips no cambian.
begin;

do $$
begin
  if to_regclass('public.match_clip_list') is null
     or position('steam_owner' in pg_get_viewdef('public.match_clip_list'::regclass)) = 0 then
    raise exception 'inversa 26: match_clip_list no usa steam_owner (¿no se aplicó la 26?)';
  end if;
end $$;

create or replace view public.match_clip_list with (security_invoker = true) as
with cfg as (
  select priorities, per_player, per_match from clip_config where id = 1
), tipados as (
  select c.*, clip_type(cardinality(c.kill_ticks), c.clutch_vs, c.round_won, cfg.priorities) as type,
         cfg.priorities, cfg.per_player, cfg.per_match
    from match_clips c cross join cfg
), con_prioridad as (
  select t.*, (t.priorities->>t.type)::integer as priority from tipados t
), por_jugador as (
  select p.*, row_number() over (partition by p.match_id, p.player_steamid
                                 order by p.priority, p.round_won desc, p.round desc) as rank_player
    from con_prioridad p
), por_partida as (
  select j.*, row_number() over (partition by j.match_id
                                 order by j.priority, j.round_won desc, j.round desc, j.player_steamid) as rank_match
    from por_jugador j
   where j.rank_player <= j.per_player
), top as (
  select pp.id, pp.match_id, pp.rank_match as pos from por_partida pp where pp.rank_match <= pp.per_match
), forzadas as (
  -- (20261024180000) las que un admin eligió y no entraron en el top, a continuación
  select p.id, p.match_id,
         (select count(*) from top t where t.match_id = p.match_id)
           + row_number() over (partition by p.match_id
                                order by p.priority, p.round_won desc, p.round desc, p.player_steamid) as pos
    from con_prioridad p
   where p.video_forced and not exists (select 1 from top t where t.id = p.id)
), lista as (
  select id, pos from top
  union all
  select id, pos from forzadas
)
select r.id, r.match_id, l.pos::integer as position, r.type, r.priority, r.round::integer as round,
       r.round_seconds::integer as round_seconds, r.round_won,
       r.player_steamid, pl.id as player_id, coalesce(nullif(r.player_name, ''), pl.nick) as player_name,
       cardinality(r.kill_ticks) as kills, r.kill_ticks, r.clutch_vs::integer as clutch_vs, r.clutch_start_tick, r.end_tick,
       m.tickrate::integer as tickrate, m.demo_status, m.status as match_status, r.created_at,
       -- (20261023180000) video
       r.video_status, r.video_key, r.video_seconds, r.video_drive_id,
       (r.video_status = 'done' and r.video_r2_deleted_at is null) as video_in_r2,
       -- (20261024180000) elegida por un admin
       r.video_forced as forced
  from lista l
  join con_prioridad r on r.id = l.id
  join matches m on m.id = r.match_id
  left join players pl on pl.steam_id = r.player_steamid;

commit;

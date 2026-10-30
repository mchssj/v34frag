-- Replanteo 26: clips automáticos con varios SteamID por ficha (plan docs/bitacora/2026-10-22-clips-automaticos).
--   - match_clip_list encuentra la ficha de cada clip con steam_owner() de la 15: el SteamID principal o uno
--     adicional. Antes la buscaba solo por players.steam_id (el único SteamID que hay hasta el corte).
--   - El tope por jugador (clip_config.per_player) pasa a contar por ficha: los clips de sus distintos SteamID
--     en una partida suman juntos. Un SteamID sin ficha sigue contando solo.
--   - Los clips guardan el SteamID que mandó el servidor, no la ficha: un SteamID adicional que se suma después
--     también lleva sus clips viejos a la ficha.
-- Necesita las migraciones 20261023120000_clips.sql, 20261023180000_clips_video.sql,
-- 20261024180000_clips_forzados.sql y 20261028180000_clips_vip_reprocesar.sql (producción: clips VIP y revisión) y la 15
-- (steam_owner).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.match_clip_list') is null then
    raise exception 'replanteo 26: falta match_clip_list (aplicar antes supabase/migrations/20261023120000_clips.sql)';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'match_clip_list' and column_name = 'vip') then
    raise exception 'replanteo 26: match_clip_list sin vip (aplicar antes supabase/migrations/20261028180000_clips_vip_reprocesar.sql)';
  end if;
  if to_regprocedure('public.steam_owner(text)') is null then
    raise exception 'replanteo 26: falta steam_owner (aplicar antes 15_claim.sql)';
  end if;
  if position('steam_owner' in pg_get_viewdef('public.match_clip_list'::regclass)) > 0 then
    raise exception 'replanteo 26: match_clip_list ya usa steam_owner (¿ya se aplicó?)';
  end if;
end $$;

-- Igual que en 20261028180000_clips_vip_reprocesar.sql, salvo la ficha (owner_id) y el tope por ficha.
create or replace view public.match_clip_list with (security_invoker = true) as
with cfg as (
  select priorities, per_player, per_match, vip_per_match from clip_config where id = 1
), tipados as (
  select c.*, clip_type(cardinality(c.kill_ticks), c.clutch_vs, c.round_won, cfg.priorities) as type,
         cfg.priorities, cfg.per_player, cfg.per_match, cfg.vip_per_match,
         o.owner_id, -- (replanteo 26) ficha del SteamID principal o adicional
         coalesce(vip_at(pl.user_id, coalesce(m.played_at, c.created_at)), false) as owner_vip
    from match_clips c cross join cfg
    join matches m on m.id = c.match_id
    cross join lateral (select steam_owner(c.player_steamid) as owner_id) o
    left join players pl on pl.id = o.owner_id
), con_prioridad as (
  select t.*, (t.priorities->>t.type)::integer as priority from tipados t
), por_jugador as (
  -- (replanteo 26) el tope por jugador (y el de cada VIP) es por ficha; un SteamID sin ficha cuenta solo
  select p.*, row_number() over (partition by p.match_id, coalesce(p.owner_id::text, p.player_steamid)
                                 order by p.priority, p.round_won desc, p.round desc) as rank_player
    from con_prioridad p
), por_partida as (
  select j.*, row_number() over (partition by j.match_id
                                 order by j.priority, j.round_won desc, j.round desc, j.player_steamid) as rank_match
    from por_jugador j
   where j.rank_player <= j.per_player and not j.owner_vip
), top as (
  select pp.id, pp.match_id, pp.rank_match as pos from por_partida pp where pp.rank_match <= pp.per_match
), vips as (
  select j.id, j.match_id,
         (select count(*) from top t where t.match_id = j.match_id)
           + row_number() over (partition by j.match_id
                                order by j.priority, j.round_won desc, j.round desc, j.player_steamid) as pos
    from por_jugador j
   where j.owner_vip and j.rank_player <= j.vip_per_match
), forzadas as (
  -- (20261024180000) las que un admin eligió y no entraron, a continuación
  select p.id, p.match_id,
         (select count(*) from top t where t.match_id = p.match_id) + (select count(*) from vips v where v.match_id = p.match_id)
           + row_number() over (partition by p.match_id
                                order by p.priority, p.round_won desc, p.round desc, p.player_steamid) as pos
    from con_prioridad p
   where p.video_forced and not exists (select 1 from top t where t.id = p.id)
     and not exists (select 1 from vips v where v.id = p.id)
), lista as (
  select id, pos, false as vip from top
  union all
  select id, pos, true from vips
  union all
  select id, pos, false from forzadas
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
       r.video_forced as forced,
       -- (20261028180000) entró por ser de un VIP, y la revisión de un reprocesado
       l.vip, r.video_review as review
  from lista l
  join con_prioridad r on r.id = l.id
  join matches m on m.id = r.match_id
  left join players pl on pl.id = r.owner_id;

commit;

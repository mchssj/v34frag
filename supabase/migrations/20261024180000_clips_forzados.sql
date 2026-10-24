-- =============================================================================
-- Forzar el video de una jugada que quedó fuera del top
--
-- - match_clips.video_forced: un admin marca una jugada (clip_force) y el bot la graba y la
--   publica en Discord como las del top, aunque esté fuera de los topes de clip_config.
-- - match_clip_list: las del top como antes y, después, las forzadas que no entraron, con puesto
--   a continuación (6, 7…). Columna nueva al final: forced.
-- - clip_render_claim no cambia: ya toma lo que muestra match_clip_list.
-- - clip_discord_pending suma las forzadas y devuelve "forced" (el mensaje dice "Elegida por los admins").
--
-- Necesita 20261023180000_clips_video.sql y 20261024120000_clips_discord.sql. El replanteo 26 vuelve
-- a definir match_clip_list con estas mismas columnas: aplicarlo después.
--
-- Bitácora: docs/bitacora/2026-10-24-clips-forzados/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable (antes del
-- corte: con el replanteo 26 aplicado, volver a correrla le saca steam_owner a la vista).
-- =============================================================================

begin;

alter table public.match_clips add column if not exists video_forced    boolean not null default false;
alter table public.match_clips add column if not exists video_forced_at timestamptz;
alter table public.match_clips add column if not exists video_forced_by uuid;

-- ---------- Lista: el top y, después, las forzadas ----------
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

-- ---------- Forzar y desforzar (admin, o el SQL Editor) ----------
-- Marca la jugada. Si había fallado o se había saltado, vuelve a la cola con los intentos en 0.
-- Devuelve el estado en que quedó: pending, processing, done, failed o skipped.
create or replace function public.clip_force(p_clip uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede pedir el video de una jugada' using errcode = '42501';
  end if;
  update match_clips
     set video_forced = true, video_forced_at = now(), video_forced_by = auth.uid(),
         video_attempts = case when video_status in ('failed', 'skipped') then 0 else video_attempts end,
         video_error = case when video_status in ('failed', 'skipped') then null else video_error end,
         video_status = case when video_status in ('failed', 'skipped') then null else video_status end
   where id = p_clip
  returning coalesce(video_status, 'pending') into v_status;
  if v_status is null then
    raise exception 'Esa jugada no existe' using errcode = 'P0002';
  end if;
  return v_status;
end $$;

-- Le saca la marca. Un video que ya se grabó queda (y si ya no entra en el top, deja de verse).
create or replace function public.clip_unforce(p_clip uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede cambiar eso' using errcode = '42501';
  end if;
  update match_clips set video_forced = false, video_forced_at = null, video_forced_by = null
   where id = p_clip and video_forced;
  return found;
end $$;

-- ---------- Discord: también las forzadas ----------
create or replace function public.clip_discord_pending(p_token text, p_top integer default 5, p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform render_auth(p_token);
  if p_top is null or p_top not between 1 and 50 then
    raise exception 'Tope inválido' using errcode = 'PT422';
  end if;
  return coalesce((
    select jsonb_agg(x order by x.played_at, x.match_id, x.position)
      from (
        select l.id as clip_id, l.match_id, m.external_id, m.map, m.score1, m.score2, m.played_at,
               l.position, l.type, l.round, l.player_name, l.clutch_vs,
               l.video_key, l.video_in_r2, l.video_drive_id, l.video_seconds, l.forced
          from match_clip_list l
          join matches m on m.id = l.match_id
          join match_clips c on c.id = l.id
         where (l.position <= p_top or l.forced) and l.video_status = 'done' and c.discord_posted_at is null
           and m.status in ('finished', 'cancelled')
           and not exists (select 1 from match_clip_list p
                            where p.match_id = l.match_id and (p.position <= p_top or p.forced)
                              and (p.video_status is null or p.video_status = 'processing'))
         order by m.played_at, l.match_id, l.position
         limit least(greatest(coalesce(p_limit, 20), 1), 100)
      ) x), '[]'::jsonb);
end $$;

revoke all on function public.clip_force(uuid) from public, anon;
revoke all on function public.clip_unforce(uuid) from public, anon;
grant execute on function public.clip_force(uuid) to authenticated, service_role;
grant execute on function public.clip_unforce(uuid) to authenticated, service_role;
grant select on public.match_clip_list to anon, authenticated, service_role;

commit;

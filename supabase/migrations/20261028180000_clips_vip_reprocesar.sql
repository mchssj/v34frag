-- =============================================================================
-- Clips extra para los VIP y reprocesar un clip
--
-- - Clips VIP: el top del mix (per_match y per_player de clip_config) se arma solo con las jugadas de
--   quienes no eran VIP cuando se jugó el mix. Cada VIP suma aparte sus clip_config.vip_per_match mejores
--   jugadas (3 al principio; 0 las apaga), a continuación del top. Las forzadas, al final.
--   match_clip_list suma al final las columnas vip y review.
-- - vip_at(cuenta, fecha): tenía VIP en esa fecha (para "VIP cuando se jugó el mix").
-- - Reprocesar: clip_reprocess manda el video a la papelera y deja la jugada en la cola, esperando revisión
--   (video_review = 'pending'). clip_review_ok la aprueba. clip_discord_pending publica el top, los VIP y
--   las forzadas, sin las que esperan revisión; una reprocesada se publica otra vez al aprobarla.
-- - clip_render_claim manda review y reprocess en cada jugada (el bot nombra distinto el video en Drive).
-- - match_clips_video_guard: una jugada con otros ticks vuelve a la cola sin revisión pendiente.
--
-- Necesita 20261024180000_clips_forzados.sql y 20261028120000_vip.sql. El replanteo 26 vuelve a definir
-- match_clip_list (con steam_owner) con estas mismas columnas.
--
-- Bitácora: docs/bitacora/2026-10-28-clips-vip-y-reprocesar/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable antes del corte
-- (con el replanteo 26 aplicado, volver a correrla le saca steam_owner a la vista).
-- =============================================================================

begin;

-- ---------- 1. Configuración y columnas ----------
alter table public.clip_config add column if not exists vip_per_match smallint not null default 3;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clip_config_vip_per_match_check') then
    alter table public.clip_config add constraint clip_config_vip_per_match_check check (vip_per_match between 0 and 10);
  end if;
end $$;

alter table public.match_clips add column if not exists video_review          text;
alter table public.match_clips add column if not exists video_reprocessed_at  timestamptz;
alter table public.match_clips add column if not exists video_reprocess_count smallint not null default 0;
alter table public.match_clips add column if not exists video_reviewed_at     timestamptz;
alter table public.match_clips add column if not exists video_reviewed_by     uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'match_clips_video_review_check') then
    alter table public.match_clips add constraint match_clips_video_review_check
      check (video_review is null or video_review in ('pending', 'approved'));
  end if;
end $$;

-- p_vip_per_match: si no viene, no cambia. Reemplaza a la de 6 parámetros.
drop function if exists public.clip_set_config(jsonb, integer, integer, integer, integer, integer);
create or replace function public.clip_set_config(p_priorities jsonb, p_per_player integer, p_per_match integer,
                                                  p_split_gap_seconds integer, p_pre_seconds integer, p_post_seconds integer,
                                                  p_vip_per_match integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede cambiar la configuración de los clips' using errcode = '42501';
  end if;
  if jsonb_typeof(p_priorities) is distinct from 'object' then
    raise exception 'La escala tiene que ser un objeto con un número por tipo' using errcode = '22023';
  end if;
  foreach k in array array['ace', 'clutch_5', 'clutch_4', '4k', 'clutch_3', '3k', 'clutch_2', 'clutch_1'] loop
    if jsonb_typeof(p_priorities->k) is distinct from 'number' or (p_priorities->>k)::numeric not between 1 and 99
       or (p_priorities->>k)::numeric <> trunc((p_priorities->>k)::numeric) then
      raise exception 'La prioridad de % tiene que ser un entero entre 1 y 99', k using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from jsonb_object_keys(p_priorities)) <> 8 then
    raise exception 'La escala tiene tipos que no existen' using errcode = '22023';
  end if;
  if p_per_player is null or p_per_player not between 1 and 10 then
    raise exception 'El tope por jugador tiene que estar entre 1 y 10' using errcode = '22023'; end if;
  if p_per_match is null or p_per_match not between 1 and 50 then
    raise exception 'El tope por partida tiene que estar entre 1 y 50' using errcode = '22023'; end if;
  if p_split_gap_seconds is null or p_split_gap_seconds not between 1 and 60 then
    raise exception 'El corte entre kills tiene que estar entre 1 y 60 segundos' using errcode = '22023'; end if;
  if p_pre_seconds is null or p_pre_seconds not between 0 and 15 or p_post_seconds is null or p_post_seconds not between 0 and 15 then
    raise exception 'Los márgenes del video tienen que estar entre 0 y 15 segundos' using errcode = '22023'; end if;
  if p_vip_per_match is not null and p_vip_per_match not between 0 and 10 then
    raise exception 'Los clips por VIP tienen que estar entre 0 y 10' using errcode = '22023'; end if;

  update clip_config
     set priorities = p_priorities, per_player = p_per_player, per_match = p_per_match,
         split_gap_seconds = p_split_gap_seconds, pre_seconds = p_pre_seconds, post_seconds = p_post_seconds,
         vip_per_match = coalesce(p_vip_per_match, vip_per_match),
         updated_at = now(), updated_by = auth.uid()
   where id = 1;
end $$;

-- ---------- 2. VIP en una fecha ----------
-- Un período empezado, sin vencer y sin revocar antes de esa fecha.
create or replace function public.vip_at(p_user uuid, p_at timestamptz) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from vip_memberships v
                  where v.user_id = p_user and v.starts_at <= p_at and (v.ends_at is null or v.ends_at > p_at)
                    and (v.revoked_at is null or v.revoked_at > p_at))
$$;

-- ---------- 3. Lista ----------
-- Top: las jugadas de quienes no eran VIP al jugarse el mix, con per_player y per_match. VIP: las
-- vip_per_match mejores de cada uno, a continuación. Forzadas que no entraron, al final.
create or replace view public.match_clip_list with (security_invoker = true) as
with cfg as (
  select priorities, per_player, per_match, vip_per_match from clip_config where id = 1
), tipados as (
  select c.*, clip_type(cardinality(c.kill_ticks), c.clutch_vs, c.round_won, cfg.priorities) as type,
         cfg.priorities, cfg.per_player, cfg.per_match, cfg.vip_per_match,
         coalesce(vip_at(pl.user_id, coalesce(m.played_at, c.created_at)), false) as owner_vip
    from match_clips c cross join cfg
    join matches m on m.id = c.match_id
    left join players pl on pl.steam_id = c.player_steamid
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
  left join players pl on pl.steam_id = r.player_steamid;

-- ---------- 4. Reprocesar y revisar ----------
-- Vuelve a grabar una jugada de la lista: el video va a la papelera y la jugada a la cola, esperando revisión.
-- Al aprobarla se publica otra vez en Discord. Admin, o el SQL Editor. Devuelve 'pending'.
create or replace function public.clip_reprocess(p_clip uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c match_clips; v_demo text; v_key text;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede reprocesar un clip' using errcode = '42501';
  end if;
  select * into c from match_clips where id = p_clip for update;
  if c.id is null then raise exception 'Esa jugada no existe' using errcode = 'P0002'; end if;
  if not exists (select 1 from match_clip_list l where l.id = p_clip) then
    raise exception 'Esa jugada no está entre los clips del mix';
  end if;
  select demo_status into v_demo from matches where id = c.match_id;
  if v_demo is distinct from 'uploaded' then
    raise exception 'La demo de ese mix ya no está: no se puede volver a grabar';
  end if;
  if c.video_status is null then raise exception 'Esa jugada todavía no se grabó: ya está en la cola'; end if;
  if c.video_status = 'processing' then raise exception 'Esa jugada se está grabando ahora: espera a que termine'; end if;

  v_key := case when c.video_r2_deleted_at is null then c.video_key end;
  if v_key is not null or c.video_drive_id is not null then
    insert into clip_video_trash(video_key, video_drive_id) values (v_key, c.video_drive_id);
  end if;
  update match_clips
     set video_status = null, video_key = null, video_bytes = null, video_seconds = null, video_drive_id = null,
         video_attempts = 0, video_error = null, video_claimed_at = null, video_rendered_at = null, video_r2_deleted_at = null,
         video_review = 'pending', video_reprocessed_at = now(), video_reprocess_count = video_reprocess_count + 1,
         video_reviewed_at = null, video_reviewed_by = null, discord_posted_at = null
   where id = p_clip;
  return 'pending';
end $$;

-- El video reprocesado quedó bien: sale en Discord. Admin, o el SQL Editor.
create or replace function public.clip_review_ok(p_clip uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare c match_clips;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede aprobar un clip' using errcode = '42501';
  end if;
  select * into c from match_clips where id = p_clip for update;
  if c.id is null then raise exception 'Esa jugada no existe' using errcode = 'P0002'; end if;
  if c.video_review is distinct from 'pending' then raise exception 'Esa jugada no espera revisión'; end if;
  if c.video_status is distinct from 'done' then raise exception 'El video nuevo todavía no está listo'; end if;
  update match_clips set video_review = 'approved', video_reviewed_at = now(), video_reviewed_by = auth.uid() where id = p_clip;
  return true;
end $$;

-- Una jugada con otros ticks (un reenvío después de un !rr) es otra: vuelve a la cola sin revisión pendiente.
create or replace function public.match_clips_video_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if tg_op = 'UPDATE'
     and (new.kill_ticks, new.round_won, new.clutch_vs, new.clutch_start_tick, new.end_tick)
         is not distinct from (old.kill_ticks, old.round_won, old.clutch_vs, old.clutch_start_tick, old.end_tick) then
    return new;
  end if;
  v_key := case when old.video_r2_deleted_at is null then old.video_key end;
  if v_key is not null or old.video_drive_id is not null then
    insert into clip_video_trash(video_key, video_drive_id) values (v_key, old.video_drive_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.video_status := null;  new.video_key := null;        new.video_bytes := null;
  new.video_seconds := null; new.video_drive_id := null;   new.video_attempts := 0;
  new.video_error := null;   new.video_claimed_at := null; new.video_rendered_at := null;
  new.video_r2_deleted_at := null;
  new.video_review := null;  new.video_reviewed_at := null; new.video_reviewed_by := null; -- (20261028180000)
  return new;
end $$;

-- ---------- 5. El bot ----------
-- Como en 20261023180000_clips_video.sql, con review y reprocess en cada jugada.
create or replace function public.clip_render_claim(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_match uuid;
  v_ids   uuid[];
begin
  perform render_auth(p_token);
  perform pg_advisory_xact_lock(hashtext('clip_render_claim'));

  update match_clips
     set video_status = case when video_attempts >= 3 then 'failed' end,
         video_error = 'El render no terminó en 30 minutos'
   where video_status = 'processing' and video_claimed_at < now() - interval '30 minutes';

  select l.match_id into v_match
    from match_clip_list l
   where l.video_status is null and l.match_status in ('finished', 'cancelled') and l.demo_status = 'uploaded'
   order by (select m.played_at from matches m where m.id = l.match_id), l.match_id
   limit 1;
  if v_match is null then return null; end if;

  with u as (
    update match_clips c
       set video_status = 'processing', video_claimed_at = now(), video_attempts = c.video_attempts + 1
     where c.id in (select l.id from match_clip_list l where l.match_id = v_match and l.video_status is null)
    returning c.id
  )
  select array_agg(id) into v_ids from u;

  return (
    select jsonb_build_object(
             'match', jsonb_build_object('id', m.id, 'external_id', m.external_id, 'map', m.map, 'status', m.status,
                                         'tickrate', m.tickrate, 'demo_key', m.demo_key, 'demo_size', m.demo_size,
                                         'played_at', m.played_at),
             'config', (select jsonb_build_object('pre_seconds', pre_seconds, 'post_seconds', post_seconds,
                                                  'split_gap_seconds', split_gap_seconds)
                          from clip_config where id = 1),
             'clips', (select jsonb_agg(jsonb_build_object(
                                'id', l.id, 'position', l.position, 'type', l.type, 'round', l.round,
                                'round_won', l.round_won, 'player_steamid', l.player_steamid, 'player_name', l.player_name,
                                'kill_ticks', to_jsonb(l.kill_ticks), 'clutch_vs', l.clutch_vs,
                                'clutch_start_tick', l.clutch_start_tick, 'end_tick', l.end_tick,
                                'attempt', c.video_attempts,
                                'vip', l.vip, 'review', l.review, 'reprocess', c.video_reprocess_count) -- (20261028180000)
                              order by least(l.kill_ticks[1], l.clutch_start_tick), l.id)
                         from match_clip_list l join match_clips c on c.id = l.id
                        where l.id = any(v_ids)))
      from matches m where m.id = v_match);
end $$;

-- Discord: el top, los VIP y las forzadas, sin las que esperan revisión (que tampoco frenan al resto del mix).
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
               l.video_key, l.video_in_r2, l.video_drive_id, l.video_seconds, l.forced, l.vip
          from match_clip_list l
          join matches m on m.id = l.match_id
          join match_clips c on c.id = l.id
         where (l.position <= p_top or l.forced or l.vip) and l.video_status = 'done' and c.discord_posted_at is null
           and l.review is distinct from 'pending'
           and m.status in ('finished', 'cancelled')
           and not exists (select 1 from match_clip_list p
                            where p.match_id = l.match_id and (p.position <= p_top or p.forced or p.vip)
                              and p.review is distinct from 'pending'
                              and (p.video_status is null or p.video_status = 'processing'))
         order by m.played_at, l.match_id, l.position
         limit least(greatest(coalesce(p_limit, 20), 1), 100)
      ) x), '[]'::jsonb);
end $$;

-- ---------- 6. Permisos ----------
revoke all on function public.clip_set_config(jsonb, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.clip_set_config(jsonb, integer, integer, integer, integer, integer, integer) to authenticated, service_role;
revoke all on function public.vip_at(uuid, timestamptz) from public;
grant execute on function public.vip_at(uuid, timestamptz) to anon, authenticated, service_role;
revoke all on function public.clip_reprocess(uuid), public.clip_review_ok(uuid) from public, anon;
grant execute on function public.clip_reprocess(uuid), public.clip_review_ok(uuid) to authenticated, service_role;
revoke all on function public.match_clips_video_guard() from public, anon, authenticated;
revoke all on function public.clip_render_claim(text) from public;
grant execute on function public.clip_render_claim(text) to anon, authenticated, service_role;
revoke all on function public.clip_discord_pending(text, integer, integer) from public;
grant execute on function public.clip_discord_pending(text, integer, integer) to anon, authenticated, service_role;
grant select on public.match_clip_list to anon, authenticated, service_role;

commit;

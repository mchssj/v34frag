-- Replanteo 136: el puesto de cada clip se guarda en lugar de calcularse en cada lectura (Daniel, 2026-11-22).
-- Bitácora: docs/bitacora/2026-11-22-ranking-de-clips-guardado/
--
-- match_clip_ranked (replanteo 76) armaba el puesto de todos los clips de la base en cada consulta: 400 ms a 1,5 s por
-- lectura, aunque se pidieran los 5 clips de una partida. Al terminar un mix se juntaban el grabador, el bot de Discord y
-- los 10 de la sala, y la web se trababa uno a tres minutos.
--
-- 1. match_clip_ranks: el puesto, vip, tipo, prioridad y dueño de cada clip que se lista.
-- 2. clip_rank_refresh(partidas): el mismo cálculo de la vista de la 76, solo para esas partidas (null = todas).
-- 3. match_clip_ranked lee la tabla, con las mismas columnas. match_clip_list y featured_clips_shown no cambian.
-- 4. Triggers: se recalcula al cambiar algo de lo que define el puesto (clips, clip_config, played_at, SteamID, VIP).
-- Antes de cambiar la vista y al final, compara el ranking nuevo con el de la vista vieja, clip por clip.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/136_ranking_de_clips_guardado.sql
begin;

do $$
begin
  if to_regclass('public.match_clip_ranks') is not null then
    raise exception 'replanteo 136: match_clip_ranks ya existe';
  end if;
  if md5(pg_get_viewdef('public.match_clip_ranked'::regclass)) <> '23ea45e0ca46ca54d22003488d73bb3c' then
    raise exception 'replanteo 136: match_clip_ranked no es la esperada (la de la 76); no se cambia nada';
  end if;
end $$;

-- El ranking de la vista vieja, para compararlo al final.
create temp table clip_rank_antes on commit drop as select * from public.match_clip_ranked;

-- =====================================================================================================
-- 1. La tabla
-- =====================================================================================================
create table public.match_clip_ranks (
  clip_id  uuid primary key references public.match_clips(id) on delete cascade,
  match_id uuid not null,
  position integer not null,
  vip      boolean not null,
  type     text,
  priority integer,
  owner_id uuid
);
create index match_clip_ranks_match on public.match_clip_ranks(match_id);
create index match_clip_ranks_owner on public.match_clip_ranks(owner_id);
comment on table public.match_clip_ranks is 'El puesto de cada clip que se lista (lo lee match_clip_ranked). Lo mantiene clip_rank_refresh con triggers. Replanteo 136';
alter table public.match_clip_ranks enable row level security;
revoke all on table public.match_clip_ranks from anon, authenticated;

-- =====================================================================================================
-- 2. El cálculo (las CTE de la vista de la 76, con el filtro por partida en "tipados")
-- =====================================================================================================
create function public.clip_rank_refresh(p_matches uuid[]) returns void
  language plpgsql security definer set search_path = public as $$
begin
  -- Dos recálculos a la vez de la misma partida chocarían con la clave primaria.
  perform pg_advisory_xact_lock(hashtext('clip_rank_refresh'));
  if p_matches is null then
    delete from match_clip_ranks where true;
  else
    delete from match_clip_ranks where match_id = any(p_matches);
  end if;
  insert into match_clip_ranks(clip_id, match_id, position, vip, type, priority, owner_id)
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
              WHERE p_matches IS NULL OR c.match_id = ANY (p_matches)
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
  SELECT l.id, r.match_id, (l.pos)::integer, l.vip, r.type, r.priority, r.owner_id
    FROM lista l
    JOIN con_prioridad r ON r.id = l.id;
end $$;
comment on function public.clip_rank_refresh(uuid[]) is 'Recalcula el puesto de los clips de esas partidas (null = todas) en match_clip_ranks. Replanteo 136';

-- Las partidas con clips de esas SteamID (cambió su dueño o su VIP).
create function public.clip_rank_refresh_steams(p_steams text[]) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v uuid[] := array(select distinct match_id from match_clips where player_steamid = any(p_steams));
begin
  if cardinality(v) > 0 then perform clip_rank_refresh(v); end if;
end $$;

-- Las SteamID de una ficha: la principal y las extra.
create function public.clip_rank_player_steams(p_player uuid) returns text[]
  language sql stable security definer set search_path = public as $$
  select array(select steam_id from players where id = p_player and steam_id is not null
               union select steam_id from player_extra_steam_ids where player_id = p_player) $$;

revoke all on function public.clip_rank_refresh(uuid[]), public.clip_rank_refresh_steams(text[]),
                       public.clip_rank_player_steams(uuid) from public, anon, authenticated;

-- =====================================================================================================
-- 3. Se llena y se compara antes de cambiar la vista
-- =====================================================================================================
select public.clip_rank_refresh(null);

do $$
declare
  n bigint;
begin
  select count(*) into n from (
    (select id, match_id, position, vip, type, priority, player_id from clip_rank_antes
     except all
     select k.clip_id, k.match_id, k.position, k.vip, k.type, k.priority, k.owner_id from public.match_clip_ranks k)
    union all
    (select k.clip_id, k.match_id, k.position, k.vip, k.type, k.priority, k.owner_id from public.match_clip_ranks k
     except all
     select id, match_id, position, vip, type, priority, player_id from clip_rank_antes)) d;
  if n > 0 then raise exception 'replanteo 136: el ranking guardado difiere de la vista vieja en % filas', n; end if;
end $$;

-- =====================================================================================================
-- 4. La vista lee la tabla (mismas columnas, mismo orden)
-- =====================================================================================================
create or replace view public.match_clip_ranked as
select c.id,
       c.match_id,
       k.position,
       k.type,
       k.priority,
       c.round::integer as round,
       c.round_seconds::integer as round_seconds,
       c.round_won,
       c.player_steamid,
       pl.id as player_id,
       coalesce(nullif(c.player_name, ''), pl.nick) as player_name,
       cardinality(c.kill_ticks) as kills,
       c.kill_ticks,
       c.clutch_vs::integer as clutch_vs,
       c.clutch_start_tick,
       c.end_tick,
       m.tickrate::integer as tickrate,
       m.demo_status,
       m.status as match_status,
       c.created_at,
       c.video_status,
       c.video_key,
       c.video_seconds,
       c.video_drive_id,
       (c.video_status = 'done' and c.video_r2_deleted_at is null) as video_in_r2,
       c.video_forced as forced,
       k.vip,
       c.video_review as review
  from public.match_clip_ranks k
  join public.match_clips c on c.id = k.clip_id
  join public.matches m on m.id = c.match_id
  left join public.players pl on pl.id = k.owner_id;
comment on view public.match_clip_ranked is 'Las jugadas de cada mix con su puesto, también las rechazadas (Administración). El puesto sale de match_clip_ranks (replanteo 136); antes se calculaba acá (replanteo 76)';

-- =====================================================================================================
-- 5. Triggers: se recalcula cuando cambia algo de lo que define el puesto
-- =====================================================================================================
-- Clips: nuevos, borrados o con cambios en el puesto (no los del video: video_status, etc.).
create function public.tg_clip_rank_clips() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v uuid[];
begin
  if tg_op = 'INSERT' then
    v := array(select distinct match_id from nuevas);
  elsif tg_op = 'DELETE' then
    v := array(select distinct match_id from viejas);
  else
    -- Con except y no con un join: las tablas de transición no tienen estadísticas y el join terminaba en un loop
    -- anidado (1,9 s al tocar el video de 4000 clips).
    v := array(select distinct match_id from (
      (select id, match_id, round, player_steamid, kill_ticks, clutch_vs, round_won, video_forced from viejas
       except
       select id, match_id, round, player_steamid, kill_ticks, clutch_vs, round_won, video_forced from nuevas)
      union all
      (select id, match_id, round, player_steamid, kill_ticks, clutch_vs, round_won, video_forced from nuevas
       except
       select id, match_id, round, player_steamid, kill_ticks, clutch_vs, round_won, video_forced from viejas)) d);
  end if;
  if cardinality(v) > 0 then perform clip_rank_refresh(v); end if;
  return null;
end $$;
create trigger clip_rank_ins after insert on public.match_clips
  referencing new table as nuevas for each statement execute function public.tg_clip_rank_clips();
create trigger clip_rank_upd after update on public.match_clips
  referencing old table as viejas new table as nuevas for each statement execute function public.tg_clip_rank_clips();
create trigger clip_rank_del after delete on public.match_clips
  referencing old table as viejas for each statement execute function public.tg_clip_rank_clips();

-- La configuración: prioridades y topes cambian el puesto de todos.
create function public.tg_clip_rank_config() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform clip_rank_refresh(null);
  return null;
end $$;
create trigger clip_rank_config after update on public.clip_config
  for each row when ((old.priorities, old.per_player, old.per_match, old.vip_per_match)
                     is distinct from (new.priorities, new.per_player, new.per_match, new.vip_per_match))
  execute function public.tg_clip_rank_config();

-- La fecha de la partida decide si el dueño era VIP.
create function public.tg_clip_rank_match() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from match_clips where match_id = new.id) then perform clip_rank_refresh(array[new.id]); end if;
  return null;
end $$;
create trigger clip_rank_match after update of played_at on public.matches
  for each row when (old.played_at is distinct from new.played_at)
  execute function public.tg_clip_rank_match();

-- Fichas: la SteamID decide el dueño, y la cuenta (user_id), su VIP.
create function public.tg_clip_rank_player() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform clip_rank_refresh_steams(array_remove(array[new.steam_id], null) || clip_rank_player_steams(new.id));
  elsif tg_op = 'DELETE' then
    perform clip_rank_refresh_steams(array_remove(array[old.steam_id], null) || clip_rank_player_steams(old.id));
  else
    perform clip_rank_refresh_steams(array_remove(array[old.steam_id, new.steam_id], null) || clip_rank_player_steams(new.id));
  end if;
  return null;
end $$;
create trigger clip_rank_player_ins_del after insert or delete on public.players
  for each row execute function public.tg_clip_rank_player();
create trigger clip_rank_player_upd after update of steam_id, user_id on public.players
  for each row when (old.steam_id is distinct from new.steam_id or old.user_id is distinct from new.user_id)
  execute function public.tg_clip_rank_player();

-- SteamID extra de una ficha.
create function public.tg_clip_rank_extra_steam() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform clip_rank_refresh_steams(array[new.steam_id]);
  elsif tg_op = 'DELETE' then
    perform clip_rank_refresh_steams(array[old.steam_id]);
  else
    perform clip_rank_refresh_steams(array[old.steam_id, new.steam_id]);
  end if;
  return null;
end $$;
create trigger clip_rank_extra_steam after insert or update or delete on public.player_extra_steam_ids
  for each row execute function public.tg_clip_rank_extra_steam();

-- VIP: las partidas con clips de las fichas de esa cuenta.
create function public.tg_clip_rank_vip() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_users uuid[];
begin
  if tg_op = 'INSERT' then v_users := array[new.user_id];
  elsif tg_op = 'DELETE' then v_users := array[old.user_id];
  else v_users := array[old.user_id, new.user_id];
  end if;
  perform clip_rank_refresh_steams(array(
    select unnest(clip_rank_player_steams(p.id)) from players p where p.user_id = any(v_users)));
  return null;
end $$;
create trigger clip_rank_vip after insert or update or delete on public.vip_memberships
  for each row execute function public.tg_clip_rank_vip();

revoke all on function public.tg_clip_rank_clips(), public.tg_clip_rank_config(), public.tg_clip_rank_match(),
                       public.tg_clip_rank_player(), public.tg_clip_rank_extra_steam(), public.tg_clip_rank_vip()
  from public, anon, authenticated;

-- =====================================================================================================
-- 6. Comparación final: la vista nueva contra la vieja, todas las columnas
-- =====================================================================================================
do $$
declare
  n bigint;
begin
  select count(*) into n from (
    (select * from clip_rank_antes except all select * from public.match_clip_ranked)
    union all
    (select * from public.match_clip_ranked except all select * from clip_rank_antes)) d;
  if n > 0 then raise exception 'replanteo 136: la vista nueva difiere de la vieja en % filas', n; end if;
end $$;

commit;

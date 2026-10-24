-- =============================================================================
-- Video de los clips (fase C2): grabación automática en la máquina de render
--
-- - match_clips guarda el video de cada jugada: estado, clave en R2 (cuenta de Daniel),
--   id del archivo en Google Drive, peso y duración. Los primeros 15 días el video está en
--   R2 y en Drive; después solo en Drive.
-- - csstv_clips_save deja de borrar y recrear las jugadas en cada ingesta: actualiza por
--   (partida, ronda, SteamID), así el id de la jugada (y su video) se conserva. Solo borra
--   las que dejaron de venir.
-- - Si una jugada se borra, o cambian sus ticks, su video va a clip_video_trash para que el
--   render borre los archivos (trigger match_clips_video_guard).
-- - La máquina de render se autentica con su propio token (render_workers, como
--   demo_workers) y usa clip_render_claim, clip_render_done, clip_render_fail,
--   clip_archive_due, clip_archive_mark, clip_trash_list y clip_trash_done.
-- - match_clip_list suma el video al final.
--
-- Necesita 20261023120000_clips.sql. El replanteo 26 vuelve a definir match_clip_list con
-- estas mismas columnas: aplicarlo después de esta migración.
--
-- Bitácora: docs/bitacora/2026-10-23-clips-render-automatico/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable (antes
-- del corte: con el replanteo 26 aplicado, volver a correrla le saca steam_owner a la vista).
-- Después: crear el token de la máquina de render (ver el final del archivo).
-- =============================================================================

begin;

-- ---------- 1. El video de cada jugada ----------
alter table public.match_clips add column if not exists video_status        text;
alter table public.match_clips add column if not exists video_key           text;
alter table public.match_clips add column if not exists video_bytes         bigint;
alter table public.match_clips add column if not exists video_seconds       numeric(6,2);
alter table public.match_clips add column if not exists video_drive_id      text;
alter table public.match_clips add column if not exists video_attempts      smallint not null default 0;
alter table public.match_clips add column if not exists video_error         text;
alter table public.match_clips add column if not exists video_claimed_at    timestamptz;
alter table public.match_clips add column if not exists video_rendered_at   timestamptz;
alter table public.match_clips add column if not exists video_r2_deleted_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'match_clips_video_status_check') then
    -- null: sin procesar. processing: tomada por el render. done: grabada y subida.
    -- failed: tres intentos fallidos. skipped: no se puede grabar (sin demo, nombre inusable).
    alter table public.match_clips add constraint match_clips_video_status_check
      check (video_status is null or video_status in ('processing', 'done', 'failed', 'skipped'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'match_clips_video_done_check') then
    alter table public.match_clips add constraint match_clips_video_done_check
      check (video_status is distinct from 'done'
             or (video_key is not null and video_bytes > 0 and video_seconds > 0 and video_rendered_at is not null));
  end if;
end $$;

-- Para el archivo de los 15 días.
create index if not exists match_clips_video_r2_idx on public.match_clips(video_rendered_at)
  where video_status = 'done' and video_r2_deleted_at is null;

-- ---------- 2. Papelera: archivos de videos que ya no tienen jugada ----------
create table if not exists public.clip_video_trash (
  id             bigint generated always as identity primary key,
  video_key      text,
  video_drive_id text,
  created_at     timestamptz not null default now(),
  constraint clip_video_trash_algo check (video_key is not null or video_drive_id is not null)
);
alter table public.clip_video_trash enable row level security;
-- Sin políticas: la lee y la vacía el render con clip_trash_list y clip_trash_done.

-- Una jugada borrada, o con otros ticks (un reenvío después de un !rr), deja su video en la
-- papelera. Si cambian los ticks, el video se descarta y la jugada vuelve a la cola.
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
  return new;
end $$;

drop trigger if exists match_clips_video_guard on public.match_clips;
create trigger match_clips_video_guard before update or delete on public.match_clips
  for each row execute function public.match_clips_video_guard();

-- ---------- 3. Tokens de la máquina de render ----------
create table if not exists public.render_workers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique check (char_length(trim(name)) between 2 and 40),
  token_hash   text not null unique,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.render_workers enable row level security;
drop policy if exists "workers de render: admin gestiona" on public.render_workers;
create policy "workers de render: admin gestiona" on public.render_workers
  for all using (is_admin()) with check (is_admin());

-- Valida el token. Error PT401 => HTTP 401.
create or replace function public.render_auth(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare wid uuid;
begin
  select id into wid from render_workers
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') and active;
  if wid is null then
    raise exception 'Token de render inválido o revocado' using errcode = 'PT401';
  end if;
  update render_workers set last_seen_at = now() where id = wid;
  return wid;
end $$;

-- Crea un token (se muestra una sola vez). Solo un admin con sesión en la web; desde el SQL
-- Editor se usa el insert del final del archivo.
create or replace function public.create_render_worker_token(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not is_admin() then
    raise exception 'Solo un admin puede crear tokens de render' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Poné un nombre de al menos 2 caracteres' using errcode = '22023';
  end if;
  v_token := 'renderw_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into render_workers(name, token_hash) values (left(trim(p_name), 40), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));
  return v_token;
end $$;

-- ---------- 4. Listado: suma el video (al final, para no cambiar las columnas de antes) ----------
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
)
select r.id, r.match_id, r.rank_match::integer as position, r.type, r.priority, r.round::integer as round,
       r.round_seconds::integer as round_seconds, r.round_won,
       r.player_steamid, pl.id as player_id, coalesce(nullif(r.player_name, ''), pl.nick) as player_name,
       cardinality(r.kill_ticks) as kills, r.kill_ticks, r.clutch_vs::integer as clutch_vs, r.clutch_start_tick, r.end_tick,
       m.tickrate::integer as tickrate, m.demo_status, m.status as match_status, r.created_at,
       -- (20261023180000) video
       r.video_status, r.video_key, r.video_seconds, r.video_drive_id,
       (r.video_status = 'done' and r.video_r2_deleted_at is null) as video_in_r2
  from por_partida r
  join matches m on m.id = r.match_id
  left join players pl on pl.steam_id = r.player_steamid
 where r.rank_match <= r.per_match;

-- ---------- 5. Guardado desde la ingesta: actualiza en lugar de recrear ----------
-- Lee "tickrate" y "clips" del resultado. Cada jugada se actualiza por (partida, ronda,
-- SteamID), así conserva su id y su video; las que no vinieron se borran. Un registro
-- inválido se descarta con un aviso, sin tirar la ingesta; uno repetido, también (queda el
-- primero).
create or replace function public.csstv_clips_save(p_match uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  c       jsonb;
  tr      integer;
  v_round smallint;
  v_steam text;
  v_keys  text[] := '{}';
begin
  if p_match is null then return; end if;

  if jsonb_typeof(p->'tickrate') = 'number' then
    tr := round((p->>'tickrate')::numeric);
    if tr between 10 and 1000 then
      update matches set tickrate = tr where id = p_match;
    end if;
  end if;

  if jsonb_typeof(p->'clips') is distinct from 'array' then return; end if;
  for c in select value from jsonb_array_elements(p->'clips') limit 100 loop
    begin
      v_round := (c->>'round')::smallint;
      v_steam := coalesce(csstv_steam64(c->>'steamid'), left(nullif(trim(c->>'steamid'), ''), 40));
      if v_round || '|' || v_steam = any(v_keys) then
        raise warning 'csstv_clips_save: clip repetido en %: %', p_match, left(c::text, 200);
        continue;
      end if;
      insert into match_clips(match_id, round, player_steamid, player_name, round_seconds, round_won,
                              kill_ticks, clutch_vs, clutch_start_tick, end_tick)
      values (p_match, v_round, v_steam,
              left(coalesce(c->>'name', ''), 64),
              coalesce((c->>'round_seconds')::smallint, 0),
              coalesce(c->>'round_won' in ('true', '1'), false),
              coalesce(array(select x::integer from jsonb_array_elements_text(
                               case jsonb_typeof(c->'kill_ticks') when 'array' then c->'kill_ticks' else '[]' end) x), '{}'),
              (c->>'clutch_vs')::smallint,
              (c->>'clutch_start_tick')::integer,
              (c->>'end_tick')::integer)
      on conflict (match_id, round, player_steamid) do update
        set player_name = excluded.player_name, round_seconds = excluded.round_seconds,
            round_won = excluded.round_won, kill_ticks = excluded.kill_ticks, clutch_vs = excluded.clutch_vs,
            clutch_start_tick = excluded.clutch_start_tick, end_tick = excluded.end_tick;
      v_keys := v_keys || (v_round || '|' || v_steam);
    exception when others then
      raise warning 'csstv_clips_save: clip descartado en %: % (%)', p_match, sqlerrm, left(c::text, 200);
    end;
  end loop;
  delete from match_clips
   where match_id = p_match and not ((round || '|' || player_steamid) = any(v_keys));
end $$;

-- ---------- 6. La cola del render ----------
-- Toma la partida más vieja (terminada o cancelada, con la demo en R2) que tenga jugadas
-- visibles sin video y las marca 'processing'. Devuelve la partida, los márgenes de
-- clip_config y las jugadas ordenadas por su primer tick, o null si no hay nada.
-- Antes, una jugada en 'processing' hace más de 30 minutos vuelve a la cola (o queda
-- 'failed' si ya iba por el tercer intento).
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
                                'attempt', c.video_attempts)
                              order by least(l.kill_ticks[1], l.clutch_start_tick), l.id)
                         from match_clip_list l join match_clips c on c.id = l.id
                        where l.id = any(v_ids)))
      from matches m where m.id = v_match);
end $$;

-- Video grabado y subido. p_key: clips/<partida>/<jugada>-<sufijo>.mp4 (el sufijo cambia en
-- cada grabación, así una clave que va a la papelera nunca es la de un video nuevo).
-- Devuelve false si la jugada ya no estaba en 'processing' (se borró, o cambiaron sus ticks
-- mientras se grababa): entonces los archivos van a la papelera.
create or replace function public.clip_render_done(p_token text, p_clip uuid, p_key text, p_bytes bigint,
                                                   p_seconds numeric, p_drive_id text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_match uuid;
begin
  perform render_auth(p_token);
  if p_key is null or p_key !~ ('^clips/[0-9a-f-]{36}/' || p_clip::text || '-[A-Za-z0-9]{4,32}\.mp4$') then
    raise exception 'Clave de R2 inválida' using errcode = 'PT422';
  end if;
  if p_bytes is null or p_bytes not between 1 and 524288000 then
    raise exception 'Tamaño inválido' using errcode = 'PT422';
  end if;
  if p_seconds is null or p_seconds <= 0 or p_seconds > 600 then
    raise exception 'Duración inválida' using errcode = 'PT422';
  end if;
  if p_drive_id is not null and p_drive_id !~ '^[A-Za-z0-9_-]{10,200}$' then
    raise exception 'Id de Drive inválido' using errcode = 'PT422';
  end if;

  update match_clips
     set video_status = 'done', video_key = p_key, video_bytes = p_bytes, video_seconds = round(p_seconds, 2),
         video_drive_id = p_drive_id, video_error = null, video_rendered_at = now(), video_r2_deleted_at = null
   where id = p_clip and video_status = 'processing' and p_key like 'clips/' || match_id::text || '/%'
  returning match_id into v_match;

  if v_match is null then
    insert into clip_video_trash(video_key, video_drive_id) values (p_key, p_drive_id);
    return false;
  end if;
  return true;
end $$;

-- Falló un intento. p_final (sin demo, demo vencida, jugador sin nombre usable) la deja
-- 'skipped'; si no, vuelve a la cola, o queda 'failed' al tercer intento.
-- Devuelve el estado en que quedó: pending, failed, skipped (o gone si la jugada ya no existe).
create or replace function public.clip_render_fail(p_token text, p_clip uuid, p_error text, p_final boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  perform render_auth(p_token);
  update match_clips
     set video_status = case when coalesce(p_final, false) then 'skipped'
                             when video_attempts >= 3 then 'failed' end,
         video_error = left(coalesce(nullif(trim(p_error), ''), 'Sin detalle'), 500)
   where id = p_clip and video_status = 'processing';
  if not exists (select 1 from match_clips where id = p_clip) then return 'gone'; end if;
  select coalesce(video_status, 'pending') into v_status from match_clips where id = p_clip;
  return v_status;
end $$;

-- ---------- 7. Archivo: a los p_days días el video queda solo en Drive ----------
-- Los videos con más de p_days días en R2 que ya están en Drive.
create or replace function public.clip_archive_due(p_token text, p_days integer default 15, p_limit integer default 100)
returns table(clip_id uuid, video_key text)
language plpgsql security definer set search_path = public as $$
begin
  perform render_auth(p_token);
  if p_days is null or p_days not between 1 and 3650 then
    raise exception 'Días inválidos' using errcode = 'PT422';
  end if;
  return query
    select c.id, c.video_key from match_clips c
     where c.video_status = 'done' and c.video_r2_deleted_at is null and c.video_drive_id is not null
       and c.video_rendered_at < now() - make_interval(days => p_days)
     order by c.video_rendered_at
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

-- Marca que el video se borró de R2.
create or replace function public.clip_archive_mark(p_token text, p_clip uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform render_auth(p_token);
  update match_clips set video_r2_deleted_at = now()
   where id = p_clip and video_status = 'done' and video_r2_deleted_at is null and video_drive_id is not null;
  return found;
end $$;

-- ---------- 8. Papelera ----------
create or replace function public.clip_trash_list(p_token text, p_limit integer default 100)
returns table(id bigint, video_key text, video_drive_id text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform render_auth(p_token);
  return query
    select t.id, t.video_key, t.video_drive_id, t.created_at from clip_video_trash t
     order by t.id limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

-- Los archivos ya se borraron (de R2 y de Drive).
create or replace function public.clip_trash_done(p_token text, p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform render_auth(p_token);
  delete from clip_video_trash where id = p_id;
  return found;
end $$;

-- ---------- 9. Permisos ----------
-- Las funciones del render se llaman por PostgREST con la clave pública y el token propio.
revoke all on function public.match_clips_video_guard()                                from public, anon, authenticated;
revoke all on function public.render_auth(text)                                        from public, anon, authenticated;
revoke all on function public.create_render_worker_token(text)                         from public, anon;
revoke all on function public.clip_render_claim(text)                                  from public;
revoke all on function public.clip_render_done(text, uuid, text, bigint, numeric, text) from public;
revoke all on function public.clip_render_fail(text, uuid, text, boolean)              from public;
revoke all on function public.clip_archive_due(text, integer, integer)                 from public;
revoke all on function public.clip_archive_mark(text, uuid)                            from public;
revoke all on function public.clip_trash_list(text, integer)                           from public;
revoke all on function public.clip_trash_done(text, bigint)                            from public;
grant execute on function public.create_render_worker_token(text)                         to authenticated;
grant execute on function public.clip_render_claim(text)                                  to anon, authenticated, service_role;
grant execute on function public.clip_render_done(text, uuid, text, bigint, numeric, text) to anon, authenticated, service_role;
grant execute on function public.clip_render_fail(text, uuid, text, boolean)              to anon, authenticated, service_role;
grant execute on function public.clip_archive_due(text, integer, integer)                 to anon, authenticated, service_role;
grant execute on function public.clip_archive_mark(text, uuid)                            to anon, authenticated, service_role;
grant execute on function public.clip_trash_list(text, integer)                           to anon, authenticated, service_role;
grant execute on function public.clip_trash_done(text, bigint)                            to anon, authenticated, service_role;
revoke all on public.clip_video_trash from anon, authenticated;
grant all on public.render_workers, public.clip_video_trash to service_role;
grant select on public.match_clip_list to anon, authenticated, service_role;

commit;

-- -----------------------------------------------------------------------------
-- Token de la máquina de render (correr aparte en el SQL Editor; el token se ve una sola vez
-- y va al .env de la máquina como RENDER_WORKER_TOKEN):
--
--   with t as (select 'renderw_' || replace(gen_random_uuid()::text, '-', '')
--                                || replace(gen_random_uuid()::text, '-', '') as token),
--        i as (insert into render_workers(name, token_hash)
--              select 'portatil-render', encode(sha256(convert_to(token, 'UTF8')), 'hex') from t)
--   select token from t;
-- -----------------------------------------------------------------------------

-- =============================================================================
-- Clips automáticos por partida (jugadas destacadas)
--
-- - El plugin (2.5.0) manda en el resultado "tickrate" y "clips": por jugador y por ronda,
--   los ticks de cada kill (desde el inicio de la grabación de la demo), si quedó en clutch
--   y contra cuántos, y si su equipo ganó la ronda. Solo registros con 3+ kills o clutch
--   ganado. Los dos campos son opcionales: un plugin viejo se guarda como siempre.
-- - match_clips guarda esos hechos tal cual; la web los clasifica (ace, 4k, clutch 1v3…),
--   los ordena y aplica los topes en match_clip_list, con la escala de clip_config.
-- - Se guardan en csstv_after_ingest, que ya corre después de csstv_ingest en las tres
--   entradas (ingest_server_chunk, ingest_server_match y live_match_close).
--
-- csstv_ingest no se toca (el replanteo lo redefine). El fragmento de csstv_after_ingest
-- que parchea el replanteo 16 queda igual.
--
-- Bitácora: docs/bitacora/2026-10-22-clips-automaticos/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable.
-- =============================================================================

-- ---------- 1. Tickrate de la partida (para pasar de ticks a segundos) ----------
alter table public.matches add column if not exists tickrate smallint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matches_tickrate_check') then
    alter table public.matches add constraint matches_tickrate_check check (tickrate is null or tickrate between 10 and 1000);
  end if;
end $$;

-- ---------- 2. Clips: un registro por jugador y ronda ----------
create table if not exists public.match_clips (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references public.matches(id) on delete cascade,
  round             smallint not null check (round between 1 and 200),
  player_steamid    text not null,
  player_name       text not null default '',
  round_seconds     smallint not null default 0 check (round_seconds between 0 and 3600),
  round_won         boolean not null,
  kill_ticks        integer[] not null default '{}',
  clutch_vs         smallint check (clutch_vs between 1 and 5),
  clutch_start_tick integer check (clutch_start_tick >= 0),
  end_tick          integer check (end_tick >= 0),
  created_at        timestamptz not null default now(),
  constraint match_clips_unico unique (match_id, round, player_steamid),
  constraint match_clips_kills check (cardinality(kill_ticks) <= 5 and array_position(kill_ticks, null) is null
                                      and 0 <= all(kill_ticks)),
  -- Los tres datos del clutch van juntos o ninguno.
  constraint match_clips_clutch check ((clutch_vs is null) = (clutch_start_tick is null)
                                       and (clutch_vs is null) = (end_tick is null)),
  -- Solo jugadas destacadas: 3+ kills o un clutch ganado.
  constraint match_clips_destacado check (cardinality(kill_ticks) >= 3 or (clutch_vs is not null and round_won))
);

alter table public.match_clips enable row level security;
drop policy if exists "match_clips: todos ven" on public.match_clips;
create policy "match_clips: todos ven" on public.match_clips for select using (true);
-- Sin políticas de escritura: escribe csstv_clips_save (security definer).

-- ---------- 3. Configuración: escala de prioridad, topes y cortes del video ----------
create table if not exists public.clip_config (
  id                smallint primary key default 1 check (id = 1),
  -- 1 es lo más valioso. Las claves son los tipos que arma clip_type.
  priorities        jsonb not null default '{"ace": 1, "clutch_5": 2, "clutch_4": 2, "4k": 3, "clutch_3": 4,
                                              "3k": 5, "clutch_2": 6, "clutch_1": 7}',
  per_player        smallint not null default 2  check (per_player between 1 and 10),
  per_match         smallint not null default 10 check (per_match between 1 and 50),
  -- Para el render (fase C): más de split_gap_seconds entre kills parte el clip en tramos.
  split_gap_seconds smallint not null default 8  check (split_gap_seconds between 1 and 60),
  pre_seconds       smallint not null default 3  check (pre_seconds between 0 and 15),
  post_seconds      smallint not null default 2  check (post_seconds between 0 and 15),
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  constraint clip_config_tipos check (priorities ?& array['ace', 'clutch_5', 'clutch_4', '4k', 'clutch_3', '3k', 'clutch_2', 'clutch_1'])
);
insert into public.clip_config(id) values (1) on conflict (id) do nothing;

alter table public.clip_config enable row level security;
drop policy if exists "clip_config: todos ven" on public.clip_config;
create policy "clip_config: todos ven" on public.clip_config for select using (true);
-- Sin políticas de escritura: se cambia con clip_set_config (o desde el SQL Editor).

-- Guarda la configuración (solo admin). p_priorities: un número de 1 a 99 por cada tipo.
create or replace function public.clip_set_config(p_priorities jsonb, p_per_player integer, p_per_match integer,
                                                  p_split_gap_seconds integer, p_pre_seconds integer, p_post_seconds integer)
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

  update clip_config
     set priorities = p_priorities, per_player = p_per_player, per_match = p_per_match,
         split_gap_seconds = p_split_gap_seconds, pre_seconds = p_pre_seconds, post_seconds = p_post_seconds,
         updated_at = now(), updated_by = auth.uid()
   where id = 1;
end $$;

-- ---------- 4. Clasificación y listado ----------
-- El tipo de un registro: el de mayor prioridad (número más chico) entre sus kills y su
-- clutch. Un clutch solo cuenta si su equipo ganó la ronda.
create or replace function public.clip_type(p_kills integer, p_clutch_vs smallint, p_won boolean, p_priorities jsonb)
returns text language sql immutable as $$
  select t
    from (values (case p_kills when 5 then 'ace' when 4 then '4k' when 3 then '3k' end),
                 (case when p_won and p_clutch_vs is not null then 'clutch_' || p_clutch_vs end)) v(t)
   where t is not null
   order by (p_priorities->>t)::integer nulls last, t
   limit 1
$$;

-- Los clips que se muestran: ordenados por prioridad, después la ronda ganada y después la
-- ronda más tardía, con el tope por jugador y el tope por partida de clip_config.
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
       m.tickrate::integer as tickrate, m.demo_status, m.status as match_status, r.created_at
  from por_partida r
  join matches m on m.id = r.match_id
  left join players pl on pl.steam_id = r.player_steamid
 where r.rank_match <= r.per_match;

-- ---------- 5. Guardado desde la ingesta ----------
-- Lee "tickrate" y "clips" del resultado. Reemplaza los clips de la partida (una reingesta
-- no duplica). Un registro inválido se descarta con un aviso, sin tirar la ingesta.
create or replace function public.csstv_clips_save(p_match uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  c  jsonb;
  tr integer;
begin
  if p_match is null then return; end if;

  if jsonb_typeof(p->'tickrate') = 'number' then
    tr := round((p->>'tickrate')::numeric);
    if tr between 10 and 1000 then
      update matches set tickrate = tr where id = p_match;
    end if;
  end if;

  if jsonb_typeof(p->'clips') is distinct from 'array' then return; end if;
  delete from match_clips where match_id = p_match;
  for c in select value from jsonb_array_elements(p->'clips') limit 100 loop
    begin
      insert into match_clips(match_id, round, player_steamid, player_name, round_seconds, round_won,
                              kill_ticks, clutch_vs, clutch_start_tick, end_tick)
      values (p_match,
              (c->>'round')::smallint,
              coalesce(csstv_steam64(c->>'steamid'), left(nullif(trim(c->>'steamid'), ''), 40)),
              left(coalesce(c->>'name', ''), 64),
              coalesce((c->>'round_seconds')::smallint, 0),
              coalesce(c->>'round_won' in ('true', '1'), false),
              coalesce(array(select x::integer from jsonb_array_elements_text(
                               case jsonb_typeof(c->'kill_ticks') when 'array' then c->'kill_ticks' else '[]' end) x), '{}'),
              (c->>'clutch_vs')::smallint,
              (c->>'clutch_start_tick')::integer,
              (c->>'end_tick')::integer)
      on conflict (match_id, round, player_steamid) do nothing;
    exception when others then
      raise warning 'csstv_clips_save: clip descartado en %: % (%)', p_match, sqlerrm, left(c::text, 200);
    end;
  end loop;
end $$;

-- Igual que en 20261017120000, más el guardado de los clips al final.
create or replace function public.csstv_after_ingest(p_match uuid, p jsonb, p_source text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from live_matches where uid = p->>'match_uid';
  if p->>'status' = 'cancelled' and p->>'cancel_reason' = 'crash' then
    update matches set cancel_reason = 'crash', cancelled_by = null
     where id = p_match and kind = 'mix' and status = 'cancelled';
    if found then
      insert into match_crashes(match_id, max_rounds, source)
      values (p_match, greatest(csstv_jint(p, 'max_rounds', 200), 1), p_source)
      on conflict (match_id) do nothing;
    end if;
  end if;
  -- Clips automáticos (20261023120000)
  perform csstv_clips_save(p_match, p);
end $$;

-- ---------- 6. Permisos ----------
revoke all on function public.csstv_clips_save(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.csstv_after_ingest(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.clip_set_config(jsonb, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.clip_set_config(jsonb, integer, integer, integer, integer, integer) to authenticated, service_role;
grant execute on function public.clip_type(integer, smallint, boolean, jsonb) to anon, authenticated, service_role;
grant select on public.match_clips, public.clip_config, public.match_clip_list to anon, authenticated;
grant all on public.match_clips, public.clip_config to service_role;
grant select on public.match_clip_list to service_role;

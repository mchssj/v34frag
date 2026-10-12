-- =============================================================================
-- Demos en Cloudflare R2 y partidas canceladas
--
-- 1. matches.status admite 'cancelled' (con motivo y quién canceló).
-- 2. matches guarda el estado de la demo: none, pending, uploaded, missing, expired.
-- 3. csstv_ingest acepta "status", "cancel_reason", "cancelled_by" y "demo" en el resultado.
--    Si no vienen, todo funciona como antes (status finished, sin demo).
-- 4. El Worker de demos se autentica con su propio token (tabla demo_workers) y usa
--    demo_pending, demo_mark y demo_expire.
--
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run.
-- Es re-ejecutable: usa IF NOT EXISTS / CREATE OR REPLACE.
-- Después: cargar game_servers.panel_server_id del servidor real y crear el token del Worker
-- (ver el final del archivo).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Columnas nuevas
-- -----------------------------------------------------------------------------
alter table public.matches add column if not exists cancel_reason    text;
alter table public.matches add column if not exists cancelled_by     text;
alter table public.matches add column if not exists demo_status      text not null default 'none';
alter table public.matches add column if not exists demo_key         text;
alter table public.matches add column if not exists demo_size        bigint;
alter table public.matches add column if not exists demo_attempts    integer not null default 0;
alter table public.matches add column if not exists demo_uploaded_at timestamptz;

-- Si existía un check sobre status, se reemplaza por uno que incluya 'cancelled'.
do $$
declare r record;
begin
  for r in
    select c.conname from pg_constraint c
     where c.contype = 'c' and c.conrelid = 'public.matches'::regclass
       and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.matches drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.matches drop constraint if exists matches_cancel_reason_check;
alter table public.matches add constraint matches_status_check
  check (status in ('upcoming', 'live', 'finished', 'cancelled')) not valid;
alter table public.matches add constraint matches_cancel_reason_check
  check (cancel_reason is null or cancel_reason in ('admin', 'map_change'));
alter table public.matches add constraint matches_demo_status_check
  check (demo_status in ('none', 'pending', 'uploaded', 'missing', 'expired'));

create index if not exists matches_demo_pending_idx on public.matches(played_at) where demo_status = 'pending';

-- Id del servidor en el panel Pterodactyl (no es secreto: el Worker lo usa para saber de dónde bajar).
alter table public.game_servers add column if not exists panel_server_id text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'game_servers_panel_server_id_check') then
    alter table public.game_servers add constraint game_servers_panel_server_id_check
      check (panel_server_id is null or panel_server_id ~ '^[A-Za-z0-9-]{8,36}$');
  end if;
end $$;

-- Tokens del Worker de demos (separados de los de servidores: no pueden enviar resultados).
create table if not exists public.demo_workers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  token_hash   text not null unique,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.demo_workers enable row level security;
drop policy if exists "workers de demos: admin gestiona" on public.demo_workers;
create policy "workers de demos: admin gestiona" on public.demo_workers
  for all using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------------------------
-- 2. Procesamiento del resultado: partidas canceladas y demo
-- -----------------------------------------------------------------------------
-- Igual que en 20261011120000, con estos cambios:
--   - status 'finished' (por defecto) o 'cancelled'; las canceladas no tienen ganador
--     y no recalculan las estadísticas del jugador (recompute_player_stats solo cuenta finished);
--   - cancel_reason y cancelled_by;
--   - demo_status 'pending' si el plugin grabó la demo.
create or replace function public.csstv_ingest(p_server uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid     text := p->>'match_uid';
  v_id      uuid;
  v_map     text;
  v_a       integer;
  v_b       integer;
  v_players jsonb := p->'players';
  v_status  text := coalesce(nullif(p->>'status', ''), 'finished');
  v_reason  text;
  v_by      text;
  v_demo    boolean := coalesce(p->'demo' = 'true'::jsonb, false);
  pl        jsonb;
  v_team    integer;
  v_name    text;
  v_s64     text;
  v_pid     uuid;
  mem_a     uuid[] := '{}';
  mem_b     uuid[] := '{}';
  g_a       text[] := '{}';
  g_b       text[] := '{}';
  top_a     text;
  top_b     text;
  v_ta      uuid;
  v_tb      uuid;
  v_rounds  integer;
  v_kills   integer;
  v_deaths  integer;
  affected  uuid[] := '{}';
  x         uuid;
begin
  if coalesce(p->>'schema', '') <> '1' then
    raise exception 'Versión de datos no soportada' using errcode = 'PT422';
  end if;
  if v_uid is null or v_uid !~ '^[A-Za-z0-9_-]{6,80}$' then
    raise exception 'match_uid inválido' using errcode = 'PT422';
  end if;

  -- Idempotencia: el mismo resultado enviado dos veces devuelve la misma partida.
  select id into v_id from matches where external_id = v_uid;
  if v_id is not null then return v_id; end if;

  if v_status not in ('finished', 'cancelled') then
    raise exception 'Estado de partida inválido' using errcode = 'PT422';
  end if;
  if v_status = 'cancelled' then
    v_reason := case when p->>'cancel_reason' in ('admin', 'map_change') then p->>'cancel_reason' else 'admin' end;
    v_by     := left(nullif(trim(p->>'cancelled_by'), ''), 32);
  end if;

  v_a := (p #>> '{score,a}')::integer;
  v_b := (p #>> '{score,b}')::integer;
  if v_a is null or v_b is null or v_a not between 0 and 200 or v_b not between 0 and 200 then
    raise exception 'Marcador inválido' using errcode = 'PT422';
  end if;
  if jsonb_typeof(v_players) is distinct from 'array' or jsonb_array_length(v_players) not between 2 and 32 then
    raise exception 'Cantidad de jugadores inválida' using errcode = 'PT422';
  end if;

  v_map := regexp_replace(lower(left(coalesce(p->>'map', ''), 64)), '^(de|cs)_', '');

  -- Plantel de cada lado: jugadores vinculados por SteamID y nicks sin perfil.
  for pl in select value from jsonb_array_elements(v_players) loop
    v_team := case pl->>'team' when 'a' then 1 when 'b' then 2 end;
    if v_team is null then raise exception 'Equipo de jugador inválido' using errcode = 'PT422'; end if;
    v_name := left(coalesce(nullif(trim(pl->>'name'), ''), '?'), 32);
    v_s64  := csstv_steam64(pl->>'steamid');
    v_pid  := null;
    if v_s64 is not null then select id into v_pid from players where steam_id = v_s64; end if;
    if v_team = 1 then
      if v_pid is not null then mem_a := array_append(mem_a, v_pid); else g_a := array_append(g_a, v_name); end if;
    else
      if v_pid is not null then mem_b := array_append(mem_b, v_pid); else g_b := array_append(g_b, v_name); end if;
    end if;
  end loop;

  select left(coalesce(nullif(trim(e->>'name'), ''), 'A'), 17) into top_a
    from jsonb_array_elements(v_players) e where e->>'team' = 'a'
   order by csstv_jint(e, 'kills') desc limit 1;
  select left(coalesce(nullif(trim(e->>'name'), ''), 'B'), 17) into top_b
    from jsonb_array_elements(v_players) e where e->>'team' = 'b'
   order by csstv_jint(e, 'kills') desc limit 1;

  insert into teams(name, tag, members, guests, kind)
  values ('Mix de ' || coalesce(top_a, 'A'), 'MIX', array(select distinct unnest(mem_a)), g_a, 'mix')
  returning id into v_ta;
  insert into teams(name, tag, members, guests, kind)
  values ('Mix de ' || coalesce(top_b, 'B'), 'MIX', array(select distinct unnest(mem_b)), g_b, 'mix')
  returning id into v_tb;

  -- En los mixes score1/score2 son rondas (un solo mapa).
  insert into matches(team1, team2, score1, score2, map, maps, status, best_of, kind, winner,
                      starts_at, played_at, external_id, server_id,
                      cancel_reason, cancelled_by, demo_status)
  values (v_ta, v_tb, v_a, v_b, nullif(v_map, ''),
          jsonb_build_array(jsonb_build_object('map', v_map, 'r1', v_a, 'r2', v_b)),
          v_status, 1, 'mix',
          case when v_status = 'finished' then case when v_a > v_b then v_ta when v_b > v_a then v_tb end end,
          to_timestamp(nullif(csstv_jint(p, 'started_at', 2147483647), 0)),
          coalesce(to_timestamp(nullif(csstv_jint(p, 'ended_at', 2147483647), 0)), now()),
          v_uid, p_server,
          v_reason, v_by, case when v_demo then 'pending' else 'none' end)
  returning id into v_id;

  for pl in select value from jsonb_array_elements(v_players) loop
    v_s64 := csstv_steam64(pl->>'steamid');
    v_pid := null;
    if v_s64 is not null then select id into v_pid from players where steam_id = v_s64; end if;
    v_rounds := csstv_jint(pl, 'rounds', 200);
    v_kills  := csstv_jint(pl, 'kills', 999);
    v_deaths := csstv_jint(pl, 'deaths', 999);
    insert into match_player_stats(
      match_id, steam_id, player_id, nick, team, rounds, kills, deaths, assists, headshots, damage,
      k1, k2, k3, k4, k5, first_kills, first_deaths, plants, defuses, teamkills, suicides, rating)
    values (
      v_id,
      coalesce(v_s64, left(coalesce(nullif(pl->>'steamid', ''), 'desconocido'), 40)),
      v_pid,
      left(coalesce(nullif(trim(pl->>'name'), ''), '?'), 32),
      case pl->>'team' when 'a' then 1 else 2 end,
      v_rounds, v_kills, v_deaths,
      csstv_jint(pl, 'assists', 999), csstv_jint(pl, 'headshots', 999), csstv_jint(pl, 'damage', 99999),
      csstv_jint(pl, 'k1', 200), csstv_jint(pl, 'k2', 200), csstv_jint(pl, 'k3', 200),
      csstv_jint(pl, 'k4', 200), csstv_jint(pl, 'k5', 200),
      csstv_jint(pl, 'first_kills', 200), csstv_jint(pl, 'first_deaths', 200),
      csstv_jint(pl, 'plants', 200), csstv_jint(pl, 'defuses', 200),
      csstv_jint(pl, 'teamkills', 200), csstv_jint(pl, 'suicides', 200),
      csstv_rating(v_kills, v_deaths, v_rounds,
                   csstv_jint(pl, 'k1', 200), csstv_jint(pl, 'k2', 200), csstv_jint(pl, 'k3', 200),
                   csstv_jint(pl, 'k4', 200), csstv_jint(pl, 'k5', 200)))
    on conflict (match_id, steam_id) do nothing;
    if v_pid is not null then affected := array_append(affected, v_pid); end if;
  end loop;

  -- Una cancelada no cambia las estadísticas de nadie.
  if v_status = 'finished' then
    foreach x in array array(select distinct unnest(affected)) loop
      perform recompute_player_stats(x);
    end loop;
  end if;

  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Funciones del Worker de demos
-- -----------------------------------------------------------------------------

-- Valida el token del Worker. Error PT401 => HTTP 401.
create or replace function public.demo_auth(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare wid uuid;
begin
  select id into wid from demo_workers
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') and active;
  if wid is null then
    raise exception 'Token del Worker inválido o revocado' using errcode = 'PT401';
  end if;
  update demo_workers set last_seen_at = now() where id = wid;
  return wid;
end $$;

-- Partidas con demo por subir, de la más vieja a la más nueva.
-- Solo las de servidores con panel_server_id: sin él el Worker no sabe de dónde bajarlas.
create or replace function public.demo_pending(p_token text, p_limit integer default 10)
returns table(external_id text, panel_server_id text, server_name text, map text, status text,
              score1 integer, score2 integer, played_at timestamptz, attempts integer)
language plpgsql security definer set search_path = public as $$
begin
  perform demo_auth(p_token);
  return query
    select m.external_id, g.panel_server_id, g.name, m.map, m.status,
           m.score1, m.score2, m.played_at, m.demo_attempts
      from matches m join game_servers g on g.id = m.server_id
     where m.demo_status = 'pending' and g.panel_server_id is not null
     order by m.played_at
     limit least(greatest(coalesce(p_limit, 10), 1), 50);
end $$;

-- Resultado de un intento de subida:
--   'uploaded' con la ruta en R2 y el tamaño;
--   'retry' si la demo no estaba o falló algo (a los 6 intentos queda 'missing').
-- Devuelve el estado en que quedó la demo.
create or replace function public.demo_mark(p_token text, p_uid text, p_result text,
                                            p_key text default null, p_size bigint default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  perform demo_auth(p_token);
  if p_result = 'uploaded' then
    if p_key is null or p_key !~ '^demos/[0-9]{4}/[0-9]{2}/[A-Za-z0-9_-]{6,80}\.dem$' then
      raise exception 'Ruta de R2 inválida' using errcode = 'PT422';
    end if;
    if p_size is null or p_size <= 0 then
      raise exception 'Tamaño inválido' using errcode = 'PT422';
    end if;
    update matches
       set demo_status = 'uploaded', demo_key = p_key, demo_size = p_size,
           demo_uploaded_at = now(), demo_attempts = demo_attempts + 1
     where external_id = p_uid and demo_status in ('pending', 'missing')
    returning demo_status into v_status;
  elsif p_result = 'retry' then
    update matches
       set demo_attempts = demo_attempts + 1,
           demo_status   = case when demo_attempts + 1 >= 6 then 'missing' else 'pending' end
     where external_id = p_uid and demo_status = 'pending'
    returning demo_status into v_status;
  else
    raise exception 'Resultado inválido: usá uploaded o retry' using errcode = 'PT422';
  end if;
  if v_status is null then
    select demo_status into v_status from matches where external_id = p_uid;
    if v_status is null then raise exception 'La partida no existe' using errcode = 'PT422'; end if;
  end if;
  return v_status;
end $$;

-- Marca 'expired' las demos subidas hace más de p_days días (la regla de expiración del
-- bucket las borra de R2). Devuelve cuántas marcó.
create or replace function public.demo_expire(p_token text, p_days integer default 90)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform demo_auth(p_token);
  if p_days is null or p_days not between 1 and 3650 then
    raise exception 'Días inválidos' using errcode = 'PT422';
  end if;
  update matches set demo_status = 'expired'
   where demo_status = 'uploaded' and demo_uploaded_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;

-- Crea un token para el Worker (se muestra una sola vez). Solo un admin con sesión en la web;
-- desde el SQL Editor se usa el insert del final del archivo.
create or replace function public.create_demo_worker_token(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not is_admin() then
    raise exception 'Solo un admin puede crear tokens del Worker' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Poné un nombre de al menos 2 caracteres' using errcode = '22023'; end if;
  v_token := 'demow_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into demo_workers(name, token_hash) values (left(trim(p_name), 40), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));
  return v_token;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Permisos
-- -----------------------------------------------------------------------------
revoke all on function public.csstv_ingest(uuid, jsonb)                       from public, anon, authenticated;
revoke all on function public.demo_auth(text)                                 from public, anon, authenticated;
revoke all on function public.demo_pending(text, integer)                     from public;
revoke all on function public.demo_mark(text, text, text, text, bigint)       from public;
revoke all on function public.demo_expire(text, integer)                      from public;
revoke all on function public.create_demo_worker_token(text)                  from public, anon;

grant execute on function public.demo_pending(text, integer)               to anon, authenticated;
grant execute on function public.demo_mark(text, text, text, text, bigint) to anon, authenticated;
grant execute on function public.demo_expire(text, integer)                to anon, authenticated;
grant execute on function public.create_demo_worker_token(text)            to authenticated;

commit;

-- Que PostgREST vea las funciones nuevas sin esperar.
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Después de aplicarla (una sola vez, en el SQL Editor):
--
--   -- 1. Decirle al Worker en qué servidor del panel está cada servidor de juego:
--   select id, name, panel_server_id from game_servers;
--   update game_servers set panel_server_id = '55f80fed' where name = '<nombre del servidor real>';
--
--   -- 2. Crear el token del Worker (copiarlo: no se vuelve a mostrar; en la base queda solo su hash):
--   with t as (select 'demow_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') as token),
--        i as (insert into demo_workers(name, token_hash)
--              select 'cloudflare-demos', encode(sha256(convert_to(token, 'UTF8')), 'hex') from t)
--   select token from t;
-- -----------------------------------------------------------------------------

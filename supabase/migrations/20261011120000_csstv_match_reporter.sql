-- =============================================================================
-- CSSTV Match Reporter
-- Recepción de resultados enviados por el plugin del servidor CS:S v34.
--
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run.
-- Es re-ejecutable: usa IF NOT EXISTS / CREATE OR REPLACE.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Nuevo tipo de partida y equipo: 'mix'
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.matches'::regclass, 'public.teams'::regclass)
      and pg_get_constraintdef(c.oid) ilike '%kind%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.matches add constraint matches_kind_check check (kind in ('official', 'pcw', 'mix')) not valid;
alter table public.teams   add constraint teams_kind_check   check (kind in ('official', 'pcw', 'mix')) not valid;

-- -----------------------------------------------------------------------------
-- 2. Servidores autorizados
-- -----------------------------------------------------------------------------
create table if not exists public.game_servers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  token_hash   text not null unique,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.game_servers enable row level security;
drop policy if exists "servidores: admin gestiona" on public.game_servers;
create policy "servidores: admin gestiona" on public.game_servers
  for all using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------------------------
-- 3. Columnas nuevas
-- -----------------------------------------------------------------------------
alter table public.players add column if not exists steam_id   text;
alter table public.players add column if not exists stats_auto boolean not null default true;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'players_steam_id_key') then
    alter table public.players add constraint players_steam_id_key unique (steam_id);
  end if;
end $$;

alter table public.matches add column if not exists external_id text;
alter table public.matches add column if not exists server_id   uuid references public.game_servers(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'matches_external_id_key') then
    alter table public.matches add constraint matches_external_id_key unique (external_id);
  end if;
end $$;

alter table public.match_player_stats
  add column if not exists player_id    uuid references public.players(id) on delete set null,
  add column if not exists nick         text,
  add column if not exists rounds       integer not null default 0,
  add column if not exists k1           integer not null default 0,
  add column if not exists k2           integer not null default 0,
  add column if not exists k3           integer not null default 0,
  add column if not exists k4           integer not null default 0,
  add column if not exists k5           integer not null default 0,
  add column if not exists first_kills  integer not null default 0,
  add column if not exists first_deaths integer not null default 0,
  add column if not exists plants       integer not null default 0,
  add column if not exists defuses      integer not null default 0,
  add column if not exists teamkills    integer not null default 0,
  add column if not exists suicides     integer not null default 0,
  add column if not exists rating       numeric;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'match_player_stats_match_steam_key') then
    alter table public.match_player_stats add constraint match_player_stats_match_steam_key unique (match_id, steam_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.match_player_stats'::regclass and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%(match_id)%'
  ) then
    alter table public.match_player_stats
      add constraint match_player_stats_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade;
  end if;
end $$;
create index if not exists match_player_stats_player_idx on public.match_player_stats(player_id);
create index if not exists match_player_stats_steam_idx  on public.match_player_stats(steam_id);

alter table public.match_player_stats enable row level security;
drop policy if exists "stats: todos ven" on public.match_player_stats;
create policy "stats: todos ven" on public.match_player_stats for select using (true);
drop policy if exists "stats: admin gestiona" on public.match_player_stats;
create policy "stats: admin gestiona" on public.match_player_stats
  for all using (is_admin()) with check (is_admin());

-- Partes recibidas del plugin (se borran al reconstruir el resultado)
create table if not exists public.ingest_chunks (
  uid        text not null,
  part       integer not null,
  total      integer not null,
  data       text not null,
  server_id  uuid not null references public.game_servers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (uid, part)
);
alter table public.ingest_chunks enable row level security;   -- sin políticas: solo lo tocan las funciones

-- -----------------------------------------------------------------------------
-- 4. Utilidades
-- -----------------------------------------------------------------------------

-- Convierte STEAM_X:Y:Z, [U:1:N], SteamID64 o el link de perfil a SteamID64.
create or replace function public.csstv_steam64(p text)
returns text language plpgsql immutable as $$
declare m text[];
begin
  if p is null then return null; end if;
  p := trim(p);
  if p ~ '^7656119[0-9]{10}$' then return p; end if;
  m := regexp_match(p, '^STEAM_[0-5]:([01]):([0-9]+)$', 'i');
  if m is not null then return (76561197960265728 + m[2]::bigint * 2 + m[1]::bigint)::text; end if;
  m := regexp_match(p, '^\[?U:1:([0-9]+)\]?$', 'i');
  if m is not null then return (76561197960265728 + m[1]::bigint)::text; end if;
  m := regexp_match(p, 'steamcommunity\.com/profiles/(7656119[0-9]{10})', 'i');
  if m is not null then return m[1]; end if;
  return null;
end $$;

-- Entero de un JSON, limitado a [0, p_max].
create or replace function public.csstv_jint(j jsonb, k text, p_max integer default 9999)
returns integer language sql immutable as $$
  select least(greatest(coalesce((j->>k)::integer, 0), 0), p_max)
$$;

-- HLTV Rating 1.0
create or replace function public.csstv_rating(kills numeric, deaths numeric, rounds numeric, k1 numeric, k2 numeric, k3 numeric, k4 numeric, k5 numeric)
returns numeric language sql immutable as $$
  select case when coalesce(rounds, 0) = 0 then null else round(
    ( kills::numeric / rounds / 0.679
    + 0.7 * (rounds - deaths)::numeric / rounds / 0.317
    + (k1 + 4 * k2 + 9 * k3 + 16 * k4 + 25 * k5)::numeric / rounds / 1.277
    ) / 2.7, 2) end
$$;

-- Recalcula los agregados del jugador a partir de sus mixes.
create or replace function public.recompute_player_stats(p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  -- Desde la web solo un admin; las funciones de ingesta la llaman sin usuario (anon).
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede recalcular estadísticas' using errcode = '42501';
  end if;
  select count(*) as maps,
         coalesce(sum(s.kills), 0) as k, coalesce(sum(s.deaths), 0) as d, coalesce(sum(s.headshots), 0) as hs,
         coalesce(sum(s.damage), 0) as dmg, coalesce(sum(s.rounds), 0) as r,
         coalesce(sum(s.k1), 0) as k1, coalesce(sum(s.k2), 0) as k2, coalesce(sum(s.k3), 0) as k3,
         coalesce(sum(s.k4), 0) as k4, coalesce(sum(s.k5), 0) as k5,
         count(*) filter (where m.winner is not null and m.winner =  case s.team when 1 then m.team1 else m.team2 end) as w,
         count(*) filter (where m.winner is not null and m.winner <> case s.team when 1 then m.team1 else m.team2 end) as l
    into a
    from match_player_stats s
    join matches m on m.id = s.match_id
   where s.player_id = p_player and m.status = 'finished';

  if a.maps = 0 then return; end if;

  update players set
    rating = csstv_rating(a.k, a.d, a.r, a.k1, a.k2, a.k3, a.k4, a.k5),
    kd     = round(a.k::numeric / greatest(a.d, 1), 2),
    hs     = case when a.k > 0 then round(a.hs * 100.0 / a.k, 1) end,
    adr    = case when a.r > 0 then round(a.dmg::numeric / a.r, 1) end,
    maps   = a.maps,
    wins   = a.w,
    losses = a.l
  where id = p_player and stats_auto;
end $$;

-- Valida el token del servidor. Error PT401 => HTTP 401.
create or replace function public.csstv_auth(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select id into sid from game_servers
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') and active;
  if sid is null then
    raise exception 'Token de servidor inválido o revocado' using errcode = 'PT401';
  end if;
  update game_servers set last_seen_at = now() where id = sid;
  return sid;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Procesamiento del resultado
-- -----------------------------------------------------------------------------
create or replace function public.csstv_ingest(p_server uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid     text := p->>'match_uid';
  v_id      uuid;
  v_map     text;
  v_a       integer;
  v_b       integer;
  v_players jsonb := p->'players';
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
                      starts_at, played_at, external_id, server_id)
  values (v_ta, v_tb, v_a, v_b, nullif(v_map, ''),
          jsonb_build_array(jsonb_build_object('map', v_map, 'r1', v_a, 'r2', v_b)),
          'finished', 1, 'mix',
          case when v_a > v_b then v_ta when v_b > v_a then v_tb end,
          to_timestamp(nullif(csstv_jint(p, 'started_at', 2147483647), 0)),
          coalesce(to_timestamp(nullif(csstv_jint(p, 'ended_at', 2147483647), 0)), now()),
          v_uid, p_server)
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

  foreach x in array array(select distinct unnest(affected)) loop
    perform recompute_player_stats(x);
  end loop;

  return v_id;
end $$;

-- Recibe el resultado en partes (lo usa el plugin con System2).
create or replace function public.ingest_server_chunk(p_token text, p_uid text, p_part integer, p_total integer, p_data text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  sid       uuid;
  v_id      uuid;
  v_b64     text;
  v_payload jsonb;
begin
  sid := csstv_auth(p_token);
  if p_uid is null or p_uid !~ '^[A-Za-z0-9_-]{6,80}$' then
    raise exception 'uid inválido' using errcode = 'PT422';
  end if;

  select id into v_id from matches where external_id = p_uid;
  if v_id is not null then return v_id; end if;

  if p_total is null or p_total not between 1 and 200 or p_part is null or p_part not between 1 and p_total then
    raise exception 'Número de parte inválido' using errcode = 'PT422';
  end if;
  if p_data is null or length(p_data) > 4000 or p_data !~ '^[A-Za-z0-9+/=]*$' then
    raise exception 'Parte inválida' using errcode = 'PT422';
  end if;

  delete from ingest_chunks where created_at < now() - interval '2 days';
  insert into ingest_chunks(uid, part, total, data, server_id)
  values (p_uid, p_part, p_total, p_data, sid)
  on conflict (uid, part) do update
    set data = excluded.data, total = excluded.total, server_id = excluded.server_id, created_at = now();

  if (select count(*) from ingest_chunks where uid = p_uid and total = p_total and part <= p_total) < p_total then
    return null;   -- faltan partes
  end if;

  select string_agg(data, '' order by part) into v_b64
    from ingest_chunks where uid = p_uid and part <= p_total;
  begin
    v_payload := convert_from(decode(v_b64, 'base64'), 'UTF8')::jsonb;
  exception when others then
    raise exception 'El resultado llegó dañado' using errcode = 'PT422';
  end;
  if v_payload->>'match_uid' is distinct from p_uid then
    raise exception 'El uid no coincide con el contenido' using errcode = 'PT422';
  end if;

  v_id := csstv_ingest(sid, v_payload);
  delete from ingest_chunks where uid = p_uid;
  return v_id;
end $$;

-- Recibe el resultado completo (lo usa csstv_uploader.py).
create or replace function public.ingest_server_match(p_token text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  return csstv_ingest(csstv_auth(p_token), p_payload);
end $$;

-- -----------------------------------------------------------------------------
-- 6. Funciones de administración
-- -----------------------------------------------------------------------------

-- Vincula (o desvincula, con p_player null) un SteamID a un jugador.
create or replace function public.link_steam_id(p_steam text, p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s64  text := csstv_steam64(p_steam);
  cur  uuid;
  prev text;
begin
  if not is_admin() then raise exception 'Solo un admin puede vincular SteamIDs' using errcode = '42501'; end if;
  if s64 is null then raise exception 'SteamID inválido. Usá STEAM_0:X:Y, SteamID64 o el link del perfil.' using errcode = '22023'; end if;

  select id into cur from players where steam_id = s64;

  if p_player is null then
    if cur is null then return; end if;
    update players set steam_id = null where id = cur;
    update match_player_stats set player_id = null where steam_id = s64;
    update teams t
       set members = array_remove(t.members, cur),
           guests  = case when s.nick = any(t.guests) then t.guests else array_append(t.guests, s.nick) end
      from match_player_stats s join matches m on m.id = s.match_id
     where s.steam_id = s64 and t.kind = 'mix' and t.id = case s.team when 1 then m.team1 else m.team2 end;
    perform recompute_player_stats(cur);
    return;
  end if;

  if cur is not null and cur <> p_player then
    raise exception 'Ese SteamID ya está vinculado a otro jugador' using errcode = '23505';
  end if;
  if cur = p_player then return; end if;

  select steam_id into prev from players where id = p_player;
  if prev is not null then perform link_steam_id(prev, null); end if;

  update players set steam_id = s64 where id = p_player;
  update match_player_stats set player_id = p_player where steam_id = s64;
  update teams t
     set members = case when p_player = any(t.members) then t.members else array_append(t.members, p_player) end,
         guests  = array_remove(t.guests, s.nick)
    from match_player_stats s join matches m on m.id = s.match_id
   where s.steam_id = s64 and t.kind = 'mix' and t.id = case s.team when 1 then m.team1 else m.team2 end;
  perform recompute_player_stats(p_player);
end $$;

-- Crea un servidor y devuelve su token (se muestra una sola vez).
create or replace function public.create_server_token(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not is_admin() then raise exception 'Solo un admin puede crear servidores' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Poné un nombre de al menos 2 caracteres' using errcode = '22023'; end if;
  v_token := 'csstv_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into game_servers(name, token_hash) values (left(trim(p_name), 40), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));
  return v_token;
end $$;

-- Genera un token nuevo para un servidor existente (el anterior deja de funcionar).
create or replace function public.rotate_server_token(p_server uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar tokens' using errcode = '42501'; end if;
  v_token := 'csstv_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update game_servers set token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), active = true where id = p_server;
  if not found then raise exception 'El servidor no existe' using errcode = '22023'; end if;
  return v_token;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Permisos
-- -----------------------------------------------------------------------------
revoke all on function public.csstv_auth(text)                                 from public, anon, authenticated;
revoke all on function public.csstv_ingest(uuid, jsonb)                        from public, anon, authenticated;
revoke all on function public.recompute_player_stats(uuid)                     from public, anon;
revoke all on function public.ingest_server_chunk(text, text, integer, integer, text) from public;
revoke all on function public.ingest_server_match(text, jsonb)                 from public;
revoke all on function public.link_steam_id(text, uuid)                        from public, anon;
revoke all on function public.create_server_token(text)                        from public, anon;
revoke all on function public.rotate_server_token(uuid)                        from public, anon;

grant execute on function public.ingest_server_chunk(text, text, integer, integer, text) to anon, authenticated;
grant execute on function public.ingest_server_match(text, jsonb)                 to anon, authenticated;
grant execute on function public.link_steam_id(text, uuid)                        to authenticated;
grant execute on function public.recompute_player_stats(uuid)                     to authenticated;
grant execute on function public.create_server_token(text)                        to authenticated;
grant execute on function public.rotate_server_token(uuid)                        to authenticated;

commit;

-- Que PostgREST vea las funciones nuevas sin esperar.
notify pgrst, 'reload schema';

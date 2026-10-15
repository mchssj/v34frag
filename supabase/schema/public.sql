--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: accept_pcw(uuid, text, uuid[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_pcw(p_post uuid, p_name text, p_players uuid[], p_guests text[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare po pcw_posts%rowtype; tid uuid; mid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into po from pcw_posts where id = p_post for update;
  if not found or po.status <> 'open' then raise exception 'Este anuncio ya no está disponible'; end if;
  if po.by_user = auth.uid() then raise exception 'No podés aceptar tu propio anuncio'; end if;
  tid := pcw_make_side(p_name, p_players, p_guests);
  if exists (select 1 from teams a, teams b where a.id = po.team_id and b.id = tid and a.members && b.members) then
    raise exception 'Hay jugadores que están en los dos rosters';
  end if;
  if exists (select 1 from teams a, teams b, unnest(a.guests) x, unnest(b.guests) y
             where a.id = po.team_id and b.id = tid and lower(x) = lower(y)) then
    raise exception 'Hay tags repetidos entre los dos rosters';
  end if;
  insert into matches(team1, team2, status, starts_at, best_of, kind)
  values (po.team_id, tid, 'upcoming', po.starts_at, po.best_of, 'pcw')
  returning id into mid;
  update pcw_posts set status = 'matched', match_id = mid where id = p_post;
  return mid;
end $$;


--
-- Name: autoapply_pcw(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.autoapply_pcw() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare m matches%rowtype; otro result_reports%rowtype; s1 int := 0; s2 int := 0; e jsonb;
begin
  select * into m from matches where id = new.match_id;
  if not found or m.kind <> 'pcw' or m.status = 'finished' then return new; end if;
  select * into otro from result_reports where match_id = new.match_id and team_id <> new.team_id limit 1;
  if not found then return new; end if;
  if norm_maps(otro.maps) <> norm_maps(new.maps) then return new; end if;
  for e in select value from jsonb_array_elements(new.maps) loop
    if (e->>'r1')::int > (e->>'r2')::int then s1 := s1 + 1;
    elsif (e->>'r2')::int > (e->>'r1')::int then s2 := s2 + 1;
    end if;
  end loop;
  if s1 = s2 then return new; end if;
  update matches set
    status = 'finished', maps = new.maps, score1 = s1, score2 = s2,
    winner = case when s1 > s2 then m.team1 else m.team2 end,
    map = (select string_agg(coalesce(nullif(x->>'map',''), '?'), ', ') from jsonb_array_elements(new.maps) x)
  where id = new.match_id;
  return new;
end $$;


--
-- Name: cancel_pcw_match(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_pcw_match(p_match uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare m matches%rowtype;
begin
  select * into m from matches where id = p_match;
  if not found or m.kind <> 'pcw' then raise exception 'Esa partida no es una práctica'; end if;
  if m.status = 'finished' then raise exception 'La práctica ya terminó'; end if;
  if not (is_admin() or is_team_captain(m.team1) or is_team_captain(m.team2)) then
    raise exception 'Solo los capitanes de la práctica o un admin pueden cancelarla';
  end if;
  update pcw_posts set status = 'cancelled' where match_id = p_match;
  delete from matches where id = p_match;
  delete from teams t where t.id in (m.team1, m.team2) and t.kind = 'pcw'
    and not exists (select 1 from matches x where x.team1 = t.id or x.team2 = t.id);
end $$;


--
-- Name: cancel_pcw_post(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_pcw_post(p_post uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare po pcw_posts%rowtype;
begin
  select * into po from pcw_posts where id = p_post;
  if not found then raise exception 'El anuncio no existe'; end if;
  if not (po.by_user = auth.uid() or is_admin()) then raise exception 'Solo quien lo publicó o un admin puede cancelarlo'; end if;
  if po.status <> 'open' then raise exception 'Ese anuncio ya no se puede cancelar'; end if;
  delete from pcw_posts where id = p_post;
  delete from teams where id = po.team_id and kind = 'pcw'
    and not exists (select 1 from matches m where m.team1 = po.team_id or m.team2 = po.team_id);
end $$;


--
-- Name: chat_rate_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_rate_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if exists (select 1 from match_chat where user_id = new.user_id and created_at > now() - interval '2 seconds') then
    raise exception 'Estás enviando mensajes muy rápido. Esperá un momento.';
  end if;
  return new;
end $$;


--
-- Name: create_demo_worker_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_demo_worker_token(p_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_pcw_post(p_name text, p_best_of integer, p_maps text, p_starts_at timestamp with time zone, p_note text, p_players uuid[], p_guests text[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare tid uuid; pid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform pcw_cleanup();
  if p_best_of not in (1, 3, 5) then raise exception 'El formato tiene que ser BO1, BO3 o BO5'; end if;
  if exists (select 1 from pcw_posts where by_user = auth.uid() and status = 'open') then
    raise exception 'Ya tenés un anuncio abierto. Cancelalo para publicar otro.';
  end if;
  if (select count(*) from pcw_posts where by_user = auth.uid() and created_at > now() - interval '1 day') >= 6 then
    raise exception 'Alcanzaste el límite de anuncios por día';
  end if;
  tid := pcw_make_side(p_name, p_players, p_guests);
  insert into pcw_posts(team_id, by_user, best_of, maps, starts_at, note, status)
  values (tid, auth.uid(), p_best_of, left(nullif(trim(p_maps), ''), 120), p_starts_at, left(nullif(trim(p_note), ''), 200), 'open')
  returning id into pid;
  return pid;
end $$;


--
-- Name: create_server_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_server_token(p_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_token text;
begin
  if not is_admin() then raise exception 'Solo un admin puede crear servidores' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Poné un nombre de al menos 2 caracteres' using errcode = '22023'; end if;
  v_token := 'csstv_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into game_servers(name, token_hash) values (left(trim(p_name), 40), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));
  return v_token;
end $$;


--
-- Name: csstv_auth(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.csstv_auth(p_token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record;
begin
  select * into r from csstv_check_token(p_token);
  if r.reason = 'expired' then
    raise exception 'La licencia del servidor venció' using errcode = 'PT401';
  elsif r.reason = 'ip' then
    raise exception 'El token no está autorizado desde esta IP' using errcode = 'PT401';
  elsif r.sid is null then
    raise exception 'Token de servidor inválido o revocado' using errcode = 'PT401';
  end if;
  return r.sid;
end $$;


--
-- Name: csstv_check_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.csstv_check_token(p_token text, OUT sid uuid, OUT reason text) RETURNS record
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  g  game_servers%rowtype;
  ip text := csstv_request_ip();
begin
  select * into g from game_servers
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if g.id is null or not g.active then
    reason := 'token';
  elsif g.license_expires_at is not null and g.license_expires_at <= now() then
    reason := 'expired';
  elsif nullif(trim(g.allowed_ip), '') is not null and ip is distinct from trim(g.allowed_ip) then
    reason := 'ip';
  else
    update game_servers set last_seen_at = now(), last_ip = coalesce(ip, last_ip) where id = g.id;
    sid := g.id;
  end if;
end $$;


--
-- Name: csstv_ingest(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.csstv_ingest(p_server uuid, p jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
  v_end     text;
  v_name_a  text := left(nullif(trim(p #>> '{team_names,a}'), ''), 20);
  v_name_b  text := left(nullif(trim(p #>> '{team_names,b}'), ''), 20);
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
    v_reason := case when p->>'cancel_reason' in ('admin', 'map_change', 'abandoned') then p->>'cancel_reason' else 'admin' end;
    v_by     := left(nullif(trim(p->>'cancelled_by'), ''), 32);
  elsif p->>'end_reason' = 'surrender' then
    v_end := 'surrender';
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
  values (coalesce('Equipo ' || v_name_a, 'Mix de ' || coalesce(top_a, 'A')), 'MIX', array(select distinct unnest(mem_a)), g_a, 'mix')
  returning id into v_ta;
  insert into teams(name, tag, members, guests, kind)
  values (coalesce('Equipo ' || v_name_b, 'Mix de ' || coalesce(top_b, 'B')), 'MIX', array(select distinct unnest(mem_b)), g_b, 'mix')
  returning id into v_tb;

  -- En los mixes score1/score2 son rondas (un solo mapa).
  insert into matches(team1, team2, score1, score2, map, maps, status, best_of, kind, winner,
                      starts_at, played_at, external_id, server_id,
                      cancel_reason, cancelled_by, demo_status, end_reason)
  values (v_ta, v_tb, v_a, v_b, nullif(v_map, ''),
          jsonb_build_array(jsonb_build_object('map', v_map, 'r1', v_a, 'r2', v_b)),
          v_status, 1, 'mix',
          case when v_status = 'finished' then case when v_a > v_b then v_ta when v_b > v_a then v_tb end end,
          to_timestamp(nullif(csstv_jint(p, 'started_at', 2147483647), 0)),
          coalesce(to_timestamp(nullif(csstv_jint(p, 'ended_at', 2147483647), 0)), now()),
          v_uid, p_server,
          v_reason, v_by, case when v_demo then 'pending' else 'none' end, v_end)
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
end $_$;


--
-- Name: csstv_jint(jsonb, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.csstv_jint(j jsonb, k text, p_max integer DEFAULT 9999) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  select least(greatest(coalesce((j->>k)::integer, 0), 0), p_max)
$$;


--
-- Name: csstv_license(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.csstv_license(p_token text, p_version text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r record;
  g game_servers%rowtype;
begin
  select * into r from csstv_check_token(p_token);
  if r.sid is null then
    return jsonb_build_object('ok', false, 'reason', r.reason);
  end if;
  update game_servers set plugin_version = left(nullif(trim(p_version), ''), 20)
   where id = r.sid and p_version is not null
   returning * into g;
  if g.id is null then
    select * into g from game_servers where id = r.sid;
  end if;
  return jsonb_build_object('ok', true, 'server_id', g.id, 'name', g.name, 'expires_at', g.license_expires_at);
end $$;


--
-- Name: csstv_ncdf(double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.csstv_ncdf(x double precision) RETURNS double precision
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  z double precision := abs(x) / sqrt(2);
  t double precision := 1 / (1 + 0.3275911 * z);
  y double precision;
begin
  y := 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-z * z);
  return 0.5 * (1 + sign(x) * y);
end $$;


--
-- Name: csstv_npdf(double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.csstv_npdf(x double precision) RETURNS double precision
    LANGUAGE sql IMMUTABLE
    AS $$
  select exp(-x * x / 2) / sqrt(2 * pi())
$$;


--
-- Name: csstv_rating(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.csstv_rating(kills numeric, deaths numeric, rounds numeric, k1 numeric, k2 numeric, k3 numeric, k4 numeric, k5 numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select case when coalesce(rounds, 0) = 0 then null else round(
    ( kills::numeric / rounds / 0.679
    + 0.7 * (rounds - deaths)::numeric / rounds / 0.317
    + (k1 + 4 * k2 + 9 * k3 + 16 * k4 + 25 * k5)::numeric / rounds / 1.277
    ) / 2.7, 2) end
$$;


--
-- Name: csstv_request_ip(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.csstv_request_ip() RETURNS text
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare h jsonb;
begin
  h := nullif(current_setting('request.headers', true), '')::jsonb;
  return nullif(trim(coalesce(h->>'cf-connecting-ip', split_part(h->>'x-forwarded-for', ',', 1))), '');
exception when others then
  return null;
end $$;


--
-- Name: csstv_steam64(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.csstv_steam64(p text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
declare m text[];
begin
  if p is null then return null; end if;
  p := trim(p);
  if p ~ '^(7656119[0-9]{10}|765612[0-9]{11})$' then return p; end if;
  m := regexp_match(p, '^STEAM_[0-5]:([01]):([0-9]+)$', 'i');
  if m is not null then return (76561197960265728 + m[2]::bigint * 2 + m[1]::bigint)::text; end if;
  m := regexp_match(p, '^\[?U:1:([0-9]+)\]?$', 'i');
  if m is not null then return (76561197960265728 + m[1]::bigint)::text; end if;
  m := regexp_match(p, 'steamcommunity\.com/profiles/(7656119[0-9]{10}|765612[0-9]{11})', 'i');
  if m is not null then return m[1]; end if;
  return null;
end $_$;


--
-- Name: demo_auth(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.demo_auth(p_token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: demo_expire(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.demo_expire(p_token text, p_days integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: demo_mark(text, text, text, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.demo_mark(p_token text, p_uid text, p_result text, p_key text DEFAULT NULL::text, p_size bigint DEFAULT NULL::bigint) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
end $_$;


--
-- Name: demo_pending(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.demo_pending(p_token text, p_limit integer DEFAULT 10) RETURNS TABLE(external_id text, panel_server_id text, server_name text, map text, status text, score1 integer, score2 integer, played_at timestamp with time zone, attempts integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: elo_apply_match(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.elo_apply_match(p_match uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  c_mu0   constant double precision := 25;          -- jugador nuevo / sin SteamID
  c_sig0  constant double precision := 25.0 / 3;
  c_beta  constant double precision := 25.0 / 6;    -- σ₀ / 2
  c_tau   constant double precision := 25.0 / 300;  -- σ₀ / 100
  cfg     record;             -- elo_config: base, bonus_max, bonus_factor, elo_floor, start_elo
  m       record;
  r       record;
  ids     text[];
  n1      integer;
  n2      integer;
  mu1     double precision;
  mu2     double precision;
  s2_tot  double precision;
  c       double precision;
  p1      double precision;   -- probabilidad de que gane el equipo 1
  res1    double precision;   -- 1 gana el equipo 1, 0 pierde, 0.5 empate
  t       double precision;
  v       double precision;
  w       double precision;
  s2      double precision;
  p_team  double precision;
  res     double precision;
  base    integer;
  bonus   integer;
  delta   integer;
  new_elo integer;
  new_mu  double precision;
begin
  select id, kind, status, team1, team2, winner into m from matches where id = p_match for update;
  select c.base, c.bonus_max, c.bonus_factor, c.elo_floor, c.start_elo into cfg from elo_config c where c.id = 1;
  if not found then
    select 30 as base, 5 as bonus_max, 10::numeric as bonus_factor, 100 as elo_floor, 1000 as start_elo into cfg;
  end if;
  if not found or m.kind <> 'mix' or m.status <> 'finished' then return; end if;
  if exists (select 1 from match_player_stats where match_id = p_match and elo_after is not null) then return; end if;

  -- Solo los SteamID64 reciben ELO.
  select array_agg(steam_id order by steam_id) into ids
    from match_player_stats
   where match_id = p_match and steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$' and rounds > 0 and team in (1, 2);
  if ids is null then return; end if;

  insert into player_elo(steam_id, elo, peak_elo) select x, cfg.start_elo, cfg.start_elo from unnest(ids) x
  on conflict (steam_id) do nothing;
  -- Bloqueo en orden fijo para que dos mixes simultáneos no se pisen ni se bloqueen entre sí.
  perform 1 from player_elo where steam_id = any(ids) order by steam_id for update;

  -- Fuerza de cada equipo: todos los que jugaron al menos una ronda. Los que no tienen
  -- SteamID64 no tienen fila en player_elo y cuentan como un jugador nuevo.
  -- σ² de cada jugador ya incluye τ² (la habilidad puede cambiar entre mixes).
  select count(*) filter (where s.team = 1), count(*) filter (where s.team = 2),
         coalesce(sum(coalesce(e.mu, c_mu0)) filter (where s.team = 1), 0),
         coalesce(sum(coalesce(e.mu, c_mu0)) filter (where s.team = 2), 0),
         sum(coalesce(e.sigma, c_sig0) ^ 2 + c_tau * c_tau)
    into n1, n2, mu1, mu2, s2_tot
    from match_player_stats s left join player_elo e on e.steam_id = s.steam_id
   where s.match_id = p_match and s.rounds > 0 and s.team in (1, 2);
  if n1 = 0 or n2 = 0 then return; end if;

  c    := sqrt((n1 + n2) * c_beta * c_beta + s2_tot);
  p1   := csstv_ncdf((mu1 - mu2) / c);
  res1 := case when m.winner is null then 0.5 when m.winner = m.team1 then 1 else 0 end;

  -- Factores de TrueSkill para dos equipos (sin empate): v = φ(t)/Φ(t), w = v(v + t).
  if res1 <> 0.5 then
    t := case when res1 = 1 then mu1 - mu2 else mu2 - mu1 end / c;
    if t < -4 then
      v := -t - 1 / t;   -- Φ(t) es demasiado chico para dividir con precisión
    else
      v := csstv_npdf(t) / csstv_ncdf(t);
    end if;
    w := v * (v + t);
  end if;

  for r in
    select s.id, s.team, s.rating, e.steam_id, e.elo, e.peak_elo, e.mu, e.sigma
      from match_player_stats s join player_elo e on e.steam_id = s.steam_id
     where s.match_id = p_match and s.steam_id = any(ids)
  loop
    p_team := case when r.team = 1 then p1 else 1 - p1 end;
    res    := case when r.team = 1 then res1 else 1 - res1 end;

    base  := round(2 * cfg.base * (res - p_team));   -- ±base con equipos parejos
    bonus := greatest(-cfg.bonus_max, least(cfg.bonus_max, round((coalesce(r.rating, 1) - 1) * cfg.bonus_factor)::integer));
    delta := base + bonus;
    if res = 1 then delta := greatest(delta, 1); elsif res = 0 then delta := least(delta, -1); end if;
    new_elo := greatest(cfg.elo_floor, r.elo + delta);

    s2     := r.sigma * r.sigma + c_tau * c_tau;
    new_mu := r.mu;
    if res = 1 then
      new_mu := r.mu + s2 / c * v;
    elsif res = 0 then
      new_mu := r.mu - s2 / c * v;
    end if;
    if res <> 0.5 then
      s2 := s2 * greatest(1 - s2 / (c * c) * w, 0.0001);
    end if;

    update player_elo
       set elo = new_elo, peak_elo = greatest(r.peak_elo, new_elo), mu = new_mu, sigma = sqrt(s2),
           matches = matches + 1, updated_at = now()
     where steam_id = r.steam_id;

    update match_player_stats
       set elo_before = r.elo, elo_after = new_elo, elo_delta = new_elo - r.elo, win_prob = round(p_team::numeric, 4)
     where id = r.id;
  end loop;
end $_$;


--
-- Name: elo_recompute_all(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.elo_recompute_all() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  x uuid;
  n integer := 0;
begin
  -- Desde la web solo un admin; desde el SQL Editor no hay usuario.
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede recalcular el ELO' using errcode = '42501';
  end if;
  lock table player_elo in exclusive mode;   -- espera a los envíos en curso y frena los nuevos hasta terminar

  delete from player_elo where true;
  update match_player_stats set elo_before = null, elo_after = null, elo_delta = null, win_prob = null
   where elo_after is not null or win_prob is not null;

  for x in
    select id from matches where kind = 'mix' and status = 'finished'
     order by coalesce(played_at, starts_at), id
  loop
    perform elo_apply_match(x);
    n := n + 1;
  end loop;
  return n;
end $$;


--
-- Name: elo_set_config(integer, integer, numeric, integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.elo_set_config(p_base integer, p_bonus_max integer, p_bonus_factor numeric, p_floor integer, p_start_elo integer, p_recompute boolean DEFAULT false) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede cambiar la configuración del ELO' using errcode = '42501';
  end if;
  if p_base is null or p_base not between 5 and 100 then
    raise exception 'La base tiene que estar entre 5 y 100' using errcode = '22023'; end if;
  if p_bonus_max is null or p_bonus_max not between 0 and 20 then
    raise exception 'El bonus máximo tiene que estar entre 0 y 20' using errcode = '22023'; end if;
  if p_bonus_factor is null or p_bonus_factor not between 0 and 50 then
    raise exception 'El factor del bonus tiene que estar entre 0 y 50' using errcode = '22023'; end if;
  if p_floor is null or p_floor not between 0 and 1000 then
    raise exception 'El ELO mínimo tiene que estar entre 0 y 1000' using errcode = '22023'; end if;
  if p_start_elo is null or p_start_elo not between 100 and 5000 or p_start_elo < p_floor then
    raise exception 'El ELO inicial tiene que estar entre 100 y 5000 y no ser menor que el mínimo' using errcode = '22023'; end if;

  insert into elo_config(id, base, bonus_max, bonus_factor, elo_floor, start_elo, updated_at, updated_by)
  values (1, p_base, p_bonus_max, p_bonus_factor, p_floor, p_start_elo, now(), auth.uid())
  on conflict (id) do update
    set base = excluded.base, bonus_max = excluded.bonus_max, bonus_factor = excluded.bonus_factor,
        elo_floor = excluded.elo_floor, start_elo = excluded.start_elo,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  if p_recompute then
    return elo_recompute_all();
  end if;
  return 0;
end $$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into profiles(id, tag)
  values (new.id, coalesce(nullif(left(trim(coalesce(new.raw_user_meta_data->>'tag','')), 24), ''), 'user_' || left(new.id::text, 6)))
  on conflict (id) do nothing;
  insert into profile_details(user_id, joined_at) values (new.id, new.created_at) on conflict do nothing;
  return new;
end $$;


--
-- Name: ingest_server_chunk(text, text, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ingest_server_chunk(p_token text, p_uid text, p_part integer, p_total integer, p_data text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
  perform elo_apply_match(v_id);
  delete from ingest_chunks where uid = p_uid;
  return v_id;
end $_$;


--
-- Name: ingest_server_match(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ingest_server_match(p_token text, p_payload jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  v_id := csstv_ingest(csstv_auth(p_token), p_payload);
  perform elo_apply_match(v_id);
  return v_id;
end $$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;


--
-- Name: is_match_captain(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_match_captain(p_match uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select exists (
     select 1 from matches m join teams t on t.id = m.team1 or t.id = m.team2
     where m.id = p_match and t.captain_id = auth.uid()) $$;


--
-- Name: is_team_captain(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_team_captain(p_team uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select exists (select 1 from teams where id = p_team and captain_id = auth.uid()) $$;


--
-- Name: link_steam_id(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_steam_id(p_steam text, p_player uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: matchmaking_admin_release_server(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_admin_release_server(p_match_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and role='admin') then raise exception 'Solo un administrador puede liberar una partida.' using errcode='42501'; end if;
 update public.matchmaking_dispatch set dispatch_state='finished',updated_at=now() where match_id=p_match_id;
 update public.matches set status='finished' where id=p_match_id and status in ('upcoming','live');
 update public.matchmaking_queue set status='cancelled' where match_id=p_match_id and status='matched';
 return found;
end; $$;


--
-- Name: matchmaking_cancel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_cancel() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uid uuid:=auth.uid();begin if uid is null then raise exception 'Iniciá sesión.' using errcode='42501';end if;update public.matchmaking_queue set status='cancelled' where user_id=uid and status='waiting';return public.matchmaking_status();end $$;


--
-- Name: matchmaking_join(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_join(p_mode text DEFAULT '5v5'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  uid uuid := auth.uid();
  p public.players%rowtype;
  elo_now integer;
  is_open boolean;
  mode_enabled boolean;
  existing_mode text;
begin
  if uid is null then
    raise exception 'Iniciá sesión para entrar a la cola.' using errcode='42501';
  end if;
  select queue_open into is_open from public.matchmaking_settings where id=true;
  if coalesce(is_open,true)=false then
    raise exception 'La queue está cerrada por administración.' using errcode='55000';
  end if;
  if p_mode not in ('1v1','2v2','3v3','5v5') then
    raise exception 'Formato de matchmaking inválido.' using errcode='22023';
  end if;
  select enabled into mode_enabled from public.matchmaking_modes where mode=p_mode;
  if coalesce(mode_enabled,false)=false then
    raise exception 'Ese formato está deshabilitado por administración.' using errcode='55000';
  end if;
  if exists (
    select 1 from public.matchmaking_queue q join public.matches m on m.id=q.match_id
    where q.user_id=uid and q.status='matched' and m.status in ('upcoming','live')
  ) then
    raise exception 'Ya tenés una partida de matchmaking activa.' using errcode='23505';
  end if;
  select q.mode into existing_mode
  from public.matchmaking_queue q
  where q.user_id=uid and q.status='waiting'
  order by q.joined_at desc limit 1;
  if existing_mode is not null and existing_mode <> p_mode then
    raise exception 'Ya estás en la cola %. Cancelá la búsqueda antes de cambiar de formato.', existing_mode using errcode='23505';
  end if;

  select * into p
  from public.players
  where user_id=uid and steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$'
  order by id limit 1;
  if not found then
    raise exception 'Necesitás vincular tu cuenta a un perfil de jugador con SteamID64 válido.' using errcode='22023';
  end if;

  select coalesce(pe.elo, ec.start_elo, 1000) into elo_now
  from (select 1) x
  left join public.player_elo pe on pe.steam_id=p.steam_id
  left join public.elo_config ec on ec.id=1;

  if existing_mode is null then
    insert into public.matchmaking_queue(user_id, player_id, steam_id, elo, mode)
    values (uid, p.id, p.steam_id, coalesce(elo_now,1000), p_mode);
  end if;

  perform public.matchmaking_try_match();
  return public.matchmaking_status();
end;
$_$;


--
-- Name: matchmaking_queue_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_queue_state() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'queue_open', coalesce((select queue_open from public.matchmaking_settings where id = true), true),
    'updated_at', (select updated_at from public.matchmaking_settings where id = true),
    'modes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mode', mm.mode,
        'enabled', mm.enabled,
        'players_per_team', mm.players_per_team,
        'queue_size', (select count(*)::integer from public.matchmaking_queue q where q.status='waiting' and q.mode=mm.mode)
      ) order by mm.players_per_team)
      from public.matchmaking_modes mm
    ), '[]'::jsonb)
  );
$$;


--
-- Name: matchmaking_server_mark_live(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_server_mark_live(p_token text, p_match_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare sid uuid;
begin
 sid:=public.csstv_auth(p_token);
 update public.matchmaking_dispatch set dispatch_state='live',updated_at=now() where match_id=p_match_id and server_id=sid and dispatch_state in ('assigned','live');
 return found;
end; $$;


--
-- Name: matchmaking_server_poll(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_server_poll(p_token text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare sid uuid; mid uuid; pwd text; map_name text; steam_ids text; state text;
begin
 sid:=public.csstv_auth(p_token);
 select d.match_id,d.server_password,d.dispatch_state,coalesce(nullif(m.map,''),'de_dust2')
 into mid,pwd,state,map_name
 from public.matchmaking_dispatch d join public.matches m on m.id=d.match_id
 where d.server_id=sid and d.dispatch_state in ('assigned','live') and m.status in ('upcoming','live')
 order by d.created_at desc limit 1;
 if mid is null then
  select m.id,coalesce(nullif(m.map,''),'de_dust2') into mid,map_name
  from public.matches m where m.server_id=sid and m.status in ('upcoming','live')
  order by m.starts_at desc nulls last limit 1;
  if mid is null then return 'IDLE'; end if;
  pwd:='frag'||lpad(floor(random()*10000)::integer::text,4,'0');
  insert into public.matchmaking_dispatch(match_id,server_id,server_password,dispatch_state)
  values(mid,sid,pwd,'assigned')
  on conflict(match_id) do update set server_password=excluded.server_password,dispatch_state='assigned',updated_at=now(),last_error=null
  returning server_password,dispatch_state into pwd,state;
 end if;
 select string_agg(
   'STEAM_0:'||mod((p.steam_id::numeric-76561197960265728)::bigint,2)::text||':'||
   floor((p.steam_id::numeric-76561197960265728)/2)::bigint::text||'='||
   case when p.id=any(m.lineup1) then '3' else '2' end,
   ',' order by p.nick
 )
 into steam_ids
 from public.matchmaking_queue q
 join public.players p on p.id=q.player_id
 join public.matches m on m.id=q.match_id
 where q.match_id=mid and q.status='matched'
   and p.steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$';
 if coalesce(steam_ids,'')='' then return 'ERROR|ROSTER_EMPTY'; end if;
 update public.matchmaking_dispatch set updated_at=now() where match_id=mid;
 return mid::text||'|'||pwd||'|'||coalesce(map_name,'de_dust2')||'|'||steam_ids;
end;
$_$;


--
-- Name: matchmaking_set_mode(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_set_mode(p_mode text, p_enabled boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id=uid and role='admin') then
    raise exception 'Solo un administrador puede configurar los formatos de matchmaking.' using errcode='42501';
  end if;
  if p_mode not in ('1v1','2v2','3v3','5v5') then
    raise exception 'Formato de matchmaking inválido.' using errcode='22023';
  end if;
  update public.matchmaking_modes
    set enabled = p_enabled, updated_at = now(), updated_by = uid
  where mode = p_mode;
  if not found then raise exception 'No existe el formato solicitado.' using errcode='22023'; end if;
  return public.matchmaking_queue_state();
end;
$$;


--
-- Name: matchmaking_set_queue_open(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_set_queue_open(p_open boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'Solo un administrador puede cambiar el estado de la queue.' using errcode = '42501';
  end if;
  insert into public.matchmaking_settings(id, queue_open, updated_at, updated_by)
  values (true, p_open, now(), uid)
  on conflict (id) do update
    set queue_open = excluded.queue_open,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
  return public.matchmaking_queue_state();
end;
$$;


--
-- Name: matchmaking_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_status() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  q public.matchmaking_queue%rowtype;
  waiting integer := 0;
  pos integer := null;
  st text := 'idle';
  mdata jsonb := null;
  mode_size integer := 5;
begin
  if uid is null then raise exception 'Iniciá sesión.' using errcode='42501'; end if;
  perform public.matchmaking_try_match();

  select * into q
  from public.matchmaking_queue x
  where x.user_id=uid and (
    x.status='waiting' or
    (x.status='matched' and exists (
      select 1 from public.matches mm where mm.id=x.match_id and mm.status in ('upcoming','live')
    ))
  )
  order by x.joined_at desc limit 1;

  if found then
    select players_per_team into mode_size from public.matchmaking_modes where mode=q.mode;
    select count(*)::integer into waiting from public.matchmaking_queue x where x.status='waiting' and x.mode=q.mode;
    if q.status='waiting' then
      st := 'waiting';
      select count(*)::integer+1 into pos from public.matchmaking_queue x
      where x.status='waiting' and x.mode=q.mode and x.joined_at<q.joined_at;
    else
      st := 'matched';
      select jsonb_build_object(
        'id',m.id,'status',m.status,'mode',coalesce(m.matchmaking_mode,q.mode),
        'server_name',gs.name,'connect_address',gs.connect_address,
        'server_password',(select d.server_password from public.matchmaking_dispatch d where d.match_id=m.id and d.dispatch_state in ('assigned','live')),
        'team1',t1.name,'team2',t2.name,'lineup1',m.lineup1,'lineup2',m.lineup2,
        'roster',coalesce((
          select jsonb_agg(jsonb_build_object(
            'player_id',p.id,'nick',p.nick,'elo',coalesce(pe.elo,q2.elo),
            'team',case when p.id=any(m.lineup1) then 1 else 2 end
          ) order by p.nick)
          from public.matchmaking_queue q2 join public.players p on p.id=q2.player_id
          left join public.player_elo pe on pe.steam_id=q2.steam_id
          where q2.match_id=m.id and q2.status='matched'
        ),'[]'::jsonb)
      )
      into mdata
      from public.matches m
      left join public.game_servers gs on gs.id=m.server_id
      left join public.teams t1 on t1.id=m.team1
      left join public.teams t2 on t2.id=m.team2
      where m.id=q.match_id;
    end if;
    return jsonb_build_object(
      'status',st,'queue_size',waiting,'position',pos,'mode',q.mode,
      'players_per_team',mode_size,'match',mdata
    );
  end if;
  return jsonb_build_object('status','idle','queue_size',0,'position',null,'mode',null,'players_per_team',null,'match',null);
end;
$$;


--
-- Name: matchmaking_try_match(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_try_match() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare is_open boolean;
begin
  select queue_open into is_open from public.matchmaking_settings where id = true;
  if coalesce(is_open, true) = false then return false; end if;
  return public.matchmaking_try_match_unchecked();
end;
$$;


--
-- Name: matchmaking_try_match_unchecked(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_try_match_unchecked() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  chosen_mode text;
  team_size integer;
  total_slots integer;
  qids uuid[];
  pids uuid[];
  elos integer[];
  n integer := 0;
  i integer;
  t1 uuid[] := '{}';
  t2 uuid[] := '{}';
  srv record;
  mid uuid;
  tid1 uuid;
  tid2 uuid;
  shortid text;
begin
  select mm.mode, mm.players_per_team
    into chosen_mode, team_size
  from public.matchmaking_modes mm
  join public.matchmaking_queue q on q.mode = mm.mode and q.status = 'waiting'
  where mm.enabled
  group by mm.mode, mm.players_per_team
  having count(*) >= mm.players_per_team * 2
  order by min(q.joined_at), mm.players_per_team
  limit 1;

  if chosen_mode is null then return false; end if;
  total_slots := team_size * 2;

  select array_agg(x.id order by x.elo desc, x.joined_at),
         array_agg(x.player_id order by x.elo desc, x.joined_at),
         array_agg(x.elo order by x.elo desc, x.joined_at),
         count(*)::integer
    into qids, pids, elos, n
  from (
    select q.id, q.player_id, q.elo, q.joined_at
    from public.matchmaking_queue q
    where q.status = 'waiting' and q.mode = chosen_mode
    order by q.joined_at
    for update skip locked
    limit total_slots
  ) x;

  if coalesce(n, 0) < total_slots then return false; end if;

  select gs.id, gs.name, gs.connect_address
    into srv
  from public.game_servers gs
  where gs.active and gs.matchmaking_enabled and gs.connect_address is not null
    and not exists (
      select 1 from public.matches m
      where m.server_id = gs.id and m.status in ('upcoming','live')
    )
  order by gs.last_assigned_at nulls first, gs.created_at
  for update skip locked
  limit 1;
  if not found then return false; end if;

  for i in 1..total_slots loop
    if mod(floor((i - 1)::numeric / 2)::integer, 2) = 0 then
      if mod(i, 2) = 1 then t1 := array_append(t1, pids[i]);
      else t2 := array_append(t2, pids[i]); end if;
    else
      if mod(i, 2) = 1 then t2 := array_append(t2, pids[i]);
      else t1 := array_append(t1, pids[i]); end if;
    end if;
  end loop;

  mid := gen_random_uuid();
  tid1 := gen_random_uuid();
  tid2 := gen_random_uuid();
  shortid := substr(replace(mid::text, '-', ''), 1, 6);

  insert into public.teams(id, name, tag, members, kind)
  values (tid1, 'MM-'||shortid||'-A', 'MMA', t1, 'mix'),
         (tid2, 'MM-'||shortid||'-B', 'MMB', t2, 'mix');

  insert into public.matches(
    id, kind, team1, team2, status, starts_at, best_of, server_id, server_ip,
    lineup1, lineup2, matchmaking_mode
  )
  values (
    mid, 'mix', tid1, tid2, 'upcoming', now(), 1, srv.id, srv.connect_address,
    t1, t2, chosen_mode
  );

  update public.matchmaking_queue
  set status = 'matched', match_id = mid, matched_at = now()
  where id = any(qids);
  update public.game_servers set last_assigned_at = now() where id = srv.id;
  return true;
end;
$$;


--
-- Name: norm_maps(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.norm_maps(j jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$ select coalesce(
     jsonb_agg(jsonb_build_object('m', lower(trim(coalesce(e.v->>'map',''))), 'a', (e.v->>'r1')::int, 'b', (e.v->>'r2')::int) order by e.n),
     '[]'::jsonb)
   from jsonb_array_elements(j) with ordinality as e(v, n) $$;


--
-- Name: pcw_cleanup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pcw_cleanup() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from teams t
  where t.kind = 'pcw'
    and exists (select 1 from pcw_posts p where p.team_id = t.id and p.status = 'open' and p.created_at < now() - interval '7 days')
    and not exists (select 1 from matches m where m.team1 = t.id or m.team2 = t.id);
end $$;


--
-- Name: pcw_make_side(text, uuid[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pcw_make_side(p_name text, p_players uuid[], p_guests text[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare tid uuid; n int; g text; nombre text; found int; vistos text[] := '{}';
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  p_players := coalesce(p_players, '{}');
  p_guests := coalesce(p_guests, '{}');
  n := coalesce(array_length(p_players, 1), 0) + coalesce(array_length(p_guests, 1), 0);
  if n < 1 or n > 7 then raise exception 'El roster tiene que tener entre 1 y 7 jugadores'; end if;
  select count(distinct x) into found from unnest(p_players) x;
  if found <> coalesce(array_length(p_players, 1), 0) then raise exception 'Hay jugadores repetidos en el roster'; end if;
  select count(*) into found from players where id = any(p_players);
  if found <> coalesce(array_length(p_players, 1), 0) then raise exception 'Algún jugador del roster no existe'; end if;
  foreach g in array p_guests loop
    g := trim(g);
    if char_length(g) < 2 or char_length(g) > 24 or g ~ '[<>]' then
      raise exception 'Los tags tienen que tener entre 2 y 24 caracteres y sin < ni >';
    end if;
    if lower(g) = any(vistos) then raise exception 'Hay tags repetidos en el roster'; end if;
    vistos := vistos || lower(g);
  end loop;
  nombre := left(coalesce(nullif(trim(p_name), ''), 'Pick de ' || coalesce((select tag from profiles where id = auth.uid()), 'jugador')), 24);
  insert into teams(name, tag, owner_id, captain_id, members, guests, kind)
  values (nombre, 'PCW', auth.uid(), auth.uid(), p_players, vistos, 'pcw')
  returning id into tid;
  -- guardamos los tags con su mayúscula original
  update teams set guests = (select coalesce(array_agg(trim(x)), '{}') from unnest(p_guests) x) where id = tid;
  return tid;
end $$;


--
-- Name: recompute_player_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompute_player_stats(p_player uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: rotate_server_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rotate_server_token(p_server uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_token text;
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar tokens' using errcode = '42501'; end if;
  v_token := 'csstv_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update game_servers set token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), active = true where id = p_server;
  if not found then raise exception 'El servidor no existe' using errcode = '22023'; end if;
  return v_token;
end $$;


--
-- Name: set_my_tag(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_my_tag(p_tag text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  p_tag := trim(coalesce(p_tag, ''));
  if char_length(p_tag) < 2 or char_length(p_tag) > 24 then
    raise exception 'El nickname debe tener entre 2 y 24 caracteres';
  end if;
  insert into profiles(id, tag) values (auth.uid(), p_tag)
  on conflict (id) do update set tag = excluded.tag;
end $$;


--
-- Name: set_team_captain(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_team_captain(p_team uuid, p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not (is_admin() or exists (select 1 from teams where id = p_team and captain_id = auth.uid())) then
    raise exception 'Solo el capitán actual o un admin puede cambiar al capitán';
  end if;
  if not is_admin() and not exists (
    select 1 from teams t join players p on p.id = any(t.members)
    where t.id = p_team and p.user_id = p_user) then
    raise exception 'El nuevo capitán tiene que ser un jugador de tu equipo con cuenta verificada';
  end if;
  update teams set captain_id = p_user where id = p_team;
end $$;


--
-- Name: validate_report(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_report() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare m matches%rowtype; roster uuid[]; e jsonb; u text;
begin
  select * into m from matches where id = new.match_id;
  if not found or m.team1 is null or m.team2 is null then raise exception 'La partida todavía no tiene los dos equipos'; end if;
  if new.team_id not in (m.team1, m.team2) then raise exception 'Ese equipo no juega esta partida'; end if;
  if m.status = 'finished' then raise exception 'La partida ya terminó'; end if;
  if jsonb_typeof(new.maps) <> 'array' or jsonb_array_length(new.maps) not between 1 and 5 then
    raise exception 'Cargá entre 1 y 5 mapas';
  end if;
  if jsonb_array_length(new.maps) > coalesce(m.best_of, 1) then
    raise exception 'Esta partida es BO% como máximo', coalesce(m.best_of, 1);
  end if;
  for e in select value from jsonb_array_elements(new.maps) loop
    if (e->>'r1') is null or (e->>'r2') is null or (e->>'r1') !~ '^\d{1,2}$' or (e->>'r2') !~ '^\d{1,2}$' then
      raise exception 'Cada mapa necesita las rondas de los dos equipos (números de 0 a 99)';
    end if;
    if length(coalesce(e->>'map','')) > 40 then raise exception 'Nombre de mapa demasiado largo'; end if;
  end loop;
  select coalesce(members, '{}') into roster from teams where id = new.team_id;
  if coalesce(array_length(new.lineup, 1), 0) > 7 then raise exception 'La alineación puede tener hasta 7 jugadores'; end if;
  if not (new.lineup <@ roster) then raise exception 'La alineación solo puede tener jugadores del plantel del equipo'; end if;
  if coalesce(array_length(new.proof, 1), 0) > 3 then raise exception 'Se pueden subir hasta 3 capturas'; end if;
  foreach u in array new.proof loop
    if u not like 'https://%/storage/v1/object/public/proofs/%' then
      raise exception 'Las capturas tienen que estar subidas a la página';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end $_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: demo_workers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demo_workers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    token_hash text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone
);


--
-- Name: elo_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.elo_config (
    id smallint DEFAULT 1 NOT NULL,
    base integer DEFAULT 30 NOT NULL,
    bonus_max integer DEFAULT 5 NOT NULL,
    bonus_factor numeric DEFAULT 10 NOT NULL,
    elo_floor integer DEFAULT 100 NOT NULL,
    start_elo integer DEFAULT 1000 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT elo_config_base_check CHECK (((base >= 5) AND (base <= 100))),
    CONSTRAINT elo_config_bonus_factor_check CHECK (((bonus_factor >= (0)::numeric) AND (bonus_factor <= (50)::numeric))),
    CONSTRAINT elo_config_bonus_max_check CHECK (((bonus_max >= 0) AND (bonus_max <= 20))),
    CONSTRAINT elo_config_elo_floor_check CHECK (((elo_floor >= 0) AND (elo_floor <= 1000))),
    CONSTRAINT elo_config_id_check CHECK ((id = 1)),
    CONSTRAINT elo_config_start_elo_check CHECK (((start_elo >= 100) AND (start_elo <= 5000))),
    CONSTRAINT elo_config_start_floor CHECK ((start_elo >= elo_floor))
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    starts_on date,
    ends_on date,
    format text DEFAULT 'playoffs'::text,
    stage text DEFAULT 'Inscripciones'::text,
    prize text,
    min_teams integer,
    max_teams integer,
    best_of integer DEFAULT 1 NOT NULL,
    final_bo integer DEFAULT 1 NOT NULL,
    group_count integer DEFAULT 2 NOT NULL,
    advance integer DEFAULT 2 NOT NULL,
    double_rr boolean DEFAULT false NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    champion uuid,
    rules text,
    seeds uuid[] DEFAULT '{}'::uuid[] NOT NULL
);


--
-- Name: game_servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    token_hash text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone,
    connect_address text,
    matchmaking_enabled boolean DEFAULT false NOT NULL,
    last_assigned_at timestamp with time zone,
    panel_server_id text,
    license_expires_at timestamp with time zone,
    allowed_ip text,
    last_ip text,
    plugin_version text,
    CONSTRAINT game_servers_connect_address_format CHECK (((connect_address IS NULL) OR (connect_address ~ '^[A-Za-z0-9.-]+:[0-9]{1,5}$'::text))),
    CONSTRAINT game_servers_panel_server_id_check CHECK (((panel_server_id IS NULL) OR (panel_server_id ~ '^[A-Za-z0-9-]{8,36}$'::text)))
);


--
-- Name: ingest_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingest_chunks (
    uid text NOT NULL,
    part integer NOT NULL,
    total integer NOT NULL,
    data text NOT NULL,
    server_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: match_chat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_chat (
    id integer NOT NULL,
    match_id uuid,
    user_id uuid,
    user_email text,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    tag text
);


--
-- Name: match_chat_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.match_chat_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: match_chat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.match_chat_id_seq OWNED BY public.match_chat.id;


--
-- Name: match_player_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_player_stats (
    id integer NOT NULL,
    match_id uuid,
    steam_id text NOT NULL,
    team integer NOT NULL,
    kills integer DEFAULT 0,
    deaths integer DEFAULT 0,
    assists integer DEFAULT 0,
    headshots integer DEFAULT 0,
    damage integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    player_id uuid,
    nick text,
    rounds integer DEFAULT 0 NOT NULL,
    k1 integer DEFAULT 0 NOT NULL,
    k2 integer DEFAULT 0 NOT NULL,
    k3 integer DEFAULT 0 NOT NULL,
    k4 integer DEFAULT 0 NOT NULL,
    k5 integer DEFAULT 0 NOT NULL,
    first_kills integer DEFAULT 0 NOT NULL,
    first_deaths integer DEFAULT 0 NOT NULL,
    plants integer DEFAULT 0 NOT NULL,
    defuses integer DEFAULT 0 NOT NULL,
    teamkills integer DEFAULT 0 NOT NULL,
    suicides integer DEFAULT 0 NOT NULL,
    rating numeric,
    elo_before integer,
    elo_after integer,
    elo_delta integer,
    win_prob numeric
);


--
-- Name: match_player_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.match_player_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: match_player_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.match_player_stats_id_seq OWNED BY public.match_player_stats.id;


--
-- Name: match_vetos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_vetos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    seq integer NOT NULL,
    team_id uuid NOT NULL,
    map text NOT NULL,
    action text NOT NULL,
    by_user uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT match_vetos_action_check CHECK ((action = ANY (ARRAY['ban'::text, 'pick'::text])))
);


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team1 uuid,
    team2 uuid,
    score1 integer,
    score2 integer,
    map text,
    event_id uuid,
    status text DEFAULT 'upcoming'::text NOT NULL,
    starts_at timestamp with time zone,
    demo_url text,
    video_url text,
    stage text,
    grp integer,
    round integer,
    pos integer,
    best_of integer DEFAULT 1 NOT NULL,
    dead1 boolean DEFAULT false NOT NULL,
    dead2 boolean DEFAULT false NOT NULL,
    bye boolean DEFAULT false NOT NULL,
    next_win uuid,
    next_win_slot integer,
    next_lose uuid,
    next_lose_slot integer,
    maps jsonb,
    winner uuid,
    server_ip text,
    kind text DEFAULT 'official'::text NOT NULL,
    lineup1 uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    lineup2 uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    played_at timestamp with time zone,
    external_id text,
    server_id uuid,
    cancel_reason text,
    cancelled_by text,
    demo_status text DEFAULT 'none'::text NOT NULL,
    demo_key text,
    demo_size bigint,
    demo_attempts integer DEFAULT 0 NOT NULL,
    demo_uploaded_at timestamp with time zone,
    matchmaking_mode text,
    end_reason text,
    CONSTRAINT matches_cancel_reason_check CHECK (((cancel_reason IS NULL) OR (cancel_reason = ANY (ARRAY['admin'::text, 'map_change'::text, 'abandoned'::text])))),
    CONSTRAINT matches_demo_status_check CHECK ((demo_status = ANY (ARRAY['none'::text, 'pending'::text, 'uploaded'::text, 'missing'::text, 'expired'::text]))),
    CONSTRAINT matches_end_reason_check CHECK (((end_reason IS NULL) OR (end_reason = 'surrender'::text))),
    CONSTRAINT matches_matchmaking_mode_check CHECK (((matchmaking_mode IS NULL) OR (matchmaking_mode = ANY (ARRAY['1v1'::text, '2v2'::text, '3v3'::text, '5v5'::text]))))
);


--
-- Name: matchmaking_dispatch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchmaking_dispatch (
    match_id uuid NOT NULL,
    server_id uuid NOT NULL,
    server_password text NOT NULL,
    dispatch_state text DEFAULT 'assigned'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    CONSTRAINT matchmaking_dispatch_dispatch_state_check CHECK ((dispatch_state = ANY (ARRAY['assigned'::text, 'live'::text, 'finished'::text, 'failed'::text])))
);


--
-- Name: matchmaking_modes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchmaking_modes (
    mode text NOT NULL,
    players_per_team integer NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT matchmaking_modes_mode_check CHECK ((mode = ANY (ARRAY['1v1'::text, '2v2'::text, '3v3'::text, '5v5'::text]))),
    CONSTRAINT matchmaking_modes_players_per_team_check CHECK ((players_per_team = ANY (ARRAY[1, 2, 3, 5])))
);


--
-- Name: matchmaking_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchmaking_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    player_id uuid NOT NULL,
    steam_id text NOT NULL,
    elo integer DEFAULT 1000 NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    match_id uuid,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    matched_at timestamp with time zone,
    mode text DEFAULT '5v5'::text NOT NULL,
    CONSTRAINT matchmaking_queue_elo_check CHECK ((elo >= 0)),
    CONSTRAINT matchmaking_queue_mode_check CHECK ((mode = ANY (ARRAY['1v1'::text, '2v2'::text, '3v3'::text, '5v5'::text]))),
    CONSTRAINT matchmaking_queue_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'matched'::text, 'cancelled'::text])))
);


--
-- Name: matchmaking_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchmaking_settings (
    id boolean DEFAULT true NOT NULL,
    queue_open boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT matchmaking_settings_id_check CHECK (id)
);


--
-- Name: pcw_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pcw_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    by_user uuid NOT NULL,
    best_of integer DEFAULT 1 NOT NULL,
    maps text,
    starts_at timestamp with time zone,
    note text,
    status text DEFAULT 'open'::text NOT NULL,
    match_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pcw_posts_best_of_check CHECK ((best_of = ANY (ARRAY[1, 3, 5]))),
    CONSTRAINT pcw_posts_maps_check CHECK ((char_length(maps) <= 120)),
    CONSTRAINT pcw_posts_note_check CHECK ((char_length(note) <= 200)),
    CONSTRAINT pcw_posts_status_check CHECK ((status = ANY (ARRAY['open'::text, 'matched'::text, 'cancelled'::text])))
);


--
-- Name: player_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    player_id uuid NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT player_claims_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: player_elo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_elo (
    steam_id text NOT NULL,
    elo integer DEFAULT 1000 NOT NULL,
    peak_elo integer DEFAULT 1000 NOT NULL,
    mu double precision DEFAULT '20'::double precision NOT NULL,
    sigma double precision DEFAULT (25.0 / (3)::numeric) NOT NULL,
    matches integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT player_elo_elo_min CHECK ((elo >= 0))
);


--
-- Name: player_map_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_map_stats (
    id integer NOT NULL,
    player_id uuid,
    map_name text NOT NULL,
    rating numeric(4,2),
    kd numeric(4,2),
    maps integer
);


--
-- Name: player_map_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_map_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_map_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_map_stats_id_seq OWNED BY public.player_map_stats.id;


--
-- Name: player_medals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_medals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id uuid,
    title text NOT NULL,
    icon text DEFAULT '🏆'::text,
    color text DEFAULT '#4a9be8'::text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nick text NOT NULL,
    photo_url text,
    rating numeric,
    kd numeric,
    hs numeric,
    adr numeric,
    maps integer,
    user_id uuid,
    wins integer,
    losses integer,
    team_history text,
    achievements text,
    bio text,
    privacy text DEFAULT 'public'::text NOT NULL,
    steam_id text,
    stats_auto boolean DEFAULT true NOT NULL,
    CONSTRAINT players_privacy_check CHECK ((privacy = ANY (ARRAY['public'::text, 'members'::text, 'private'::text])))
);


--
-- Name: profile_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_details (
    user_id uuid NOT NULL,
    avatar_url text,
    real_name text,
    country text,
    game_role text,
    steam text,
    faceit text,
    discord text,
    joined_at timestamp with time zone,
    last_seen timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_details_country_check CHECK ((char_length(country) <= 40)),
    CONSTRAINT profile_details_discord_check CHECK ((char_length(discord) <= 40)),
    CONSTRAINT profile_details_faceit_check CHECK ((char_length(faceit) <= 120)),
    CONSTRAINT profile_details_game_role_check CHECK ((char_length(game_role) <= 30)),
    CONSTRAINT profile_details_real_name_check CHECK ((char_length(real_name) <= 60)),
    CONSTRAINT profile_details_steam_check CHECK ((char_length(steam) <= 120))
);


--
-- Name: profile_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    tag text,
    updated_at timestamp without time zone,
    player_id uuid
);


--
-- Name: public_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_profiles WITH (security_invoker='true') AS
 SELECT id,
    tag
   FROM public.profiles;


--
-- Name: result_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.result_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    team_id uuid NOT NULL,
    by_user uuid NOT NULL,
    maps jsonb NOT NULL,
    lineup uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    proof text[] DEFAULT '{}'::text[] NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT result_reports_note_check CHECK ((char_length(note) <= 300))
);


--
-- Name: team_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_requests (
    user_id uuid NOT NULL,
    name text NOT NULL,
    tag text,
    status text DEFAULT 'pending'::text NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    tag text,
    owner_id uuid,
    members uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    captain_id uuid,
    kind text DEFAULT 'official'::text NOT NULL,
    guests text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: tournament_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid,
    team_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: match_chat id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_chat ALTER COLUMN id SET DEFAULT nextval('public.match_chat_id_seq'::regclass);


--
-- Name: match_player_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_player_stats ALTER COLUMN id SET DEFAULT nextval('public.match_player_stats_id_seq'::regclass);


--
-- Name: player_map_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_map_stats ALTER COLUMN id SET DEFAULT nextval('public.player_map_stats_id_seq'::regclass);


--
-- Name: profile_details avatar_url_propio; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.profile_details
    ADD CONSTRAINT avatar_url_propio CHECK (((avatar_url IS NULL) OR (avatar_url ~~ 'https://%/storage/v1/object/public/avatars/%'::text))) NOT VALID;


--
-- Name: match_chat chat_largo; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.match_chat
    ADD CONSTRAINT chat_largo CHECK (((char_length(message) >= 1) AND (char_length(message) <= 300))) NOT VALID;


--
-- Name: demo_workers demo_workers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_workers
    ADD CONSTRAINT demo_workers_pkey PRIMARY KEY (id);


--
-- Name: demo_workers demo_workers_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_workers
    ADD CONSTRAINT demo_workers_token_hash_key UNIQUE (token_hash);


--
-- Name: elo_config elo_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elo_config
    ADD CONSTRAINT elo_config_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: game_servers game_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_servers
    ADD CONSTRAINT game_servers_pkey PRIMARY KEY (id);


--
-- Name: game_servers game_servers_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_servers
    ADD CONSTRAINT game_servers_token_hash_key UNIQUE (token_hash);


--
-- Name: ingest_chunks ingest_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingest_chunks
    ADD CONSTRAINT ingest_chunks_pkey PRIMARY KEY (uid, part);


--
-- Name: match_chat match_chat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_chat
    ADD CONSTRAINT match_chat_pkey PRIMARY KEY (id);


--
-- Name: match_player_stats match_player_stats_match_steam_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_player_stats
    ADD CONSTRAINT match_player_stats_match_steam_key UNIQUE (match_id, steam_id);


--
-- Name: match_player_stats match_player_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_player_stats
    ADD CONSTRAINT match_player_stats_pkey PRIMARY KEY (id);


--
-- Name: match_vetos match_vetos_match_id_map_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_vetos
    ADD CONSTRAINT match_vetos_match_id_map_key UNIQUE (match_id, map);


--
-- Name: match_vetos match_vetos_match_id_seq_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_vetos
    ADD CONSTRAINT match_vetos_match_id_seq_key UNIQUE (match_id, seq);


--
-- Name: match_vetos match_vetos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_vetos
    ADD CONSTRAINT match_vetos_pkey PRIMARY KEY (id);


--
-- Name: matches matches_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_external_id_key UNIQUE (external_id);


--
-- Name: matches matches_kind_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.matches
    ADD CONSTRAINT matches_kind_check CHECK ((kind = ANY (ARRAY['official'::text, 'pcw'::text, 'mix'::text]))) NOT VALID;


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: matches matches_status_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.matches
    ADD CONSTRAINT matches_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'live'::text, 'finished'::text, 'cancelled'::text]))) NOT VALID;


--
-- Name: matchmaking_dispatch matchmaking_dispatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_dispatch
    ADD CONSTRAINT matchmaking_dispatch_pkey PRIMARY KEY (match_id);


--
-- Name: matchmaking_modes matchmaking_modes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_modes
    ADD CONSTRAINT matchmaking_modes_pkey PRIMARY KEY (mode);


--
-- Name: matchmaking_queue matchmaking_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_pkey PRIMARY KEY (id);


--
-- Name: matchmaking_settings matchmaking_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_settings
    ADD CONSTRAINT matchmaking_settings_pkey PRIMARY KEY (id);


--
-- Name: pcw_posts pcw_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcw_posts
    ADD CONSTRAINT pcw_posts_pkey PRIMARY KEY (id);


--
-- Name: player_claims player_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_claims
    ADD CONSTRAINT player_claims_pkey PRIMARY KEY (id);


--
-- Name: player_claims player_claims_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_claims
    ADD CONSTRAINT player_claims_player_id_key UNIQUE (player_id);


--
-- Name: player_claims player_claims_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_claims
    ADD CONSTRAINT player_claims_user_id_key UNIQUE (user_id);


--
-- Name: player_elo player_elo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_elo
    ADD CONSTRAINT player_elo_pkey PRIMARY KEY (steam_id);


--
-- Name: player_map_stats player_map_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_map_stats
    ADD CONSTRAINT player_map_stats_pkey PRIMARY KEY (id);


--
-- Name: player_medals player_medals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_medals
    ADD CONSTRAINT player_medals_pkey PRIMARY KEY (id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: players players_steam_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_steam_id_key UNIQUE (steam_id);


--
-- Name: profile_details profile_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_details
    ADD CONSTRAINT profile_details_pkey PRIMARY KEY (user_id);


--
-- Name: profile_requests profile_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_requests
    ADD CONSTRAINT profile_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: result_reports result_reports_match_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_reports
    ADD CONSTRAINT result_reports_match_id_team_id_key UNIQUE (match_id, team_id);


--
-- Name: result_reports result_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_reports
    ADD CONSTRAINT result_reports_pkey PRIMARY KEY (id);


--
-- Name: team_requests team_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_requests
    ADD CONSTRAINT team_requests_pkey PRIMARY KEY (user_id);


--
-- Name: teams teams_kind_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.teams
    ADD CONSTRAINT teams_kind_check CHECK ((kind = ANY (ARRAY['official'::text, 'pcw'::text, 'mix'::text]))) NOT VALID;


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: tournament_registrations tournament_registrations_event_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_registrations
    ADD CONSTRAINT tournament_registrations_event_id_team_id_key UNIQUE (event_id, team_id);


--
-- Name: tournament_registrations tournament_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_registrations
    ADD CONSTRAINT tournament_registrations_pkey PRIMARY KEY (id);


--
-- Name: idx_chat_match_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_match_fecha ON public.match_chat USING btree (match_id, created_at DESC);


--
-- Name: idx_inscripciones_evento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inscripciones_evento ON public.tournament_registrations USING btree (event_id);


--
-- Name: idx_mapstats_jugador; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mapstats_jugador ON public.player_map_stats USING btree (player_id);


--
-- Name: idx_matches_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_event ON public.matches USING btree (event_id);


--
-- Name: idx_matches_kind_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_kind_status ON public.matches USING btree (kind, status);


--
-- Name: idx_matches_played; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_played ON public.matches USING btree (played_at);


--
-- Name: idx_matches_starts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_starts ON public.matches USING btree (starts_at DESC);


--
-- Name: idx_medallas_jugador; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medallas_jugador ON public.player_medals USING btree (player_id);


--
-- Name: idx_pcw_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pcw_estado ON public.pcw_posts USING btree (status, created_at DESC);


--
-- Name: idx_reportes_match; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reportes_match ON public.result_reports USING btree (match_id);


--
-- Name: idx_solicitudes_equipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_equipo ON public.team_requests USING btree (user_id);


--
-- Name: idx_solicitudes_perfil; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_perfil ON public.profile_requests USING btree (player_id);


--
-- Name: idx_vetos_match; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vetos_match ON public.match_vetos USING btree (match_id);


--
-- Name: match_player_stats_player_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX match_player_stats_player_idx ON public.match_player_stats USING btree (player_id);


--
-- Name: match_player_stats_steam_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX match_player_stats_steam_idx ON public.match_player_stats USING btree (steam_id);


--
-- Name: matches_demo_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matches_demo_pending_idx ON public.matches USING btree (played_at) WHERE (demo_status = 'pending'::text);


--
-- Name: matches_mix_played_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matches_mix_played_idx ON public.matches USING btree (played_at) WHERE (kind = 'mix'::text);


--
-- Name: matches_server_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matches_server_status_idx ON public.matches USING btree (server_id, status);


--
-- Name: matchmaking_queue_match_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchmaking_queue_match_id_idx ON public.matchmaking_queue USING btree (match_id);


--
-- Name: matchmaking_queue_one_waiting_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX matchmaking_queue_one_waiting_per_user ON public.matchmaking_queue USING btree (user_id) WHERE (status = 'waiting'::text);


--
-- Name: matchmaking_queue_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchmaking_queue_user_idx ON public.matchmaking_queue USING btree (user_id, joined_at DESC);


--
-- Name: matchmaking_queue_waiting_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchmaking_queue_waiting_idx ON public.matchmaking_queue USING btree (joined_at) WHERE (status = 'waiting'::text);


--
-- Name: matchmaking_queue_waiting_mode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchmaking_queue_waiting_mode_idx ON public.matchmaking_queue USING btree (mode, joined_at) WHERE (status = 'waiting'::text);


--
-- Name: pcw_un_abierto_por_equipo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pcw_un_abierto_por_equipo ON public.pcw_posts USING btree (team_id) WHERE (status = 'open'::text);


--
-- Name: pcw_un_abierto_por_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pcw_un_abierto_por_usuario ON public.pcw_posts USING btree (by_user) WHERE (status = 'open'::text);


--
-- Name: players_user_id_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX players_user_id_unico ON public.players USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: result_reports autoapply_pcw; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER autoapply_pcw AFTER INSERT OR UPDATE ON public.result_reports FOR EACH ROW EXECUTE FUNCTION public.autoapply_pcw();


--
-- Name: match_chat chat_rate_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_rate_limit BEFORE INSERT ON public.match_chat FOR EACH ROW EXECUTE FUNCTION public.chat_rate_limit();


--
-- Name: result_reports validate_report; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_report BEFORE INSERT OR UPDATE ON public.result_reports FOR EACH ROW EXECUTE FUNCTION public.validate_report();


--
-- Name: events events_champion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_champion_fkey FOREIGN KEY (champion) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: ingest_chunks ingest_chunks_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingest_chunks
    ADD CONSTRAINT ingest_chunks_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.game_servers(id) ON DELETE CASCADE;


--
-- Name: match_chat match_chat_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_chat
    ADD CONSTRAINT match_chat_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: match_player_stats match_player_stats_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_player_stats
    ADD CONSTRAINT match_player_stats_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: match_player_stats match_player_stats_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_player_stats
    ADD CONSTRAINT match_player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: match_vetos match_vetos_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_vetos
    ADD CONSTRAINT match_vetos_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: match_vetos match_vetos_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_vetos
    ADD CONSTRAINT match_vetos_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: matches matches_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: matches matches_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.game_servers(id) ON DELETE SET NULL;


--
-- Name: matches matches_team1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team1_fkey FOREIGN KEY (team1) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: matches matches_team2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team2_fkey FOREIGN KEY (team2) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: matchmaking_dispatch matchmaking_dispatch_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_dispatch
    ADD CONSTRAINT matchmaking_dispatch_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: matchmaking_dispatch matchmaking_dispatch_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_dispatch
    ADD CONSTRAINT matchmaking_dispatch_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.game_servers(id) ON DELETE CASCADE;


--
-- Name: matchmaking_modes matchmaking_modes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_modes
    ADD CONSTRAINT matchmaking_modes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: matchmaking_queue matchmaking_queue_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL;


--
-- Name: matchmaking_queue matchmaking_queue_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: matchmaking_queue matchmaking_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: matchmaking_settings matchmaking_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_settings
    ADD CONSTRAINT matchmaking_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: pcw_posts pcw_posts_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcw_posts
    ADD CONSTRAINT pcw_posts_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL;


--
-- Name: pcw_posts pcw_posts_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcw_posts
    ADD CONSTRAINT pcw_posts_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: player_claims player_claims_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_claims
    ADD CONSTRAINT player_claims_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: player_claims player_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_claims
    ADD CONSTRAINT player_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: player_map_stats player_map_stats_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_map_stats
    ADD CONSTRAINT player_map_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: player_medals player_medals_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_medals
    ADD CONSTRAINT player_medals_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: players players_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profile_details profile_details_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_details
    ADD CONSTRAINT profile_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profile_requests profile_requests_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_requests
    ADD CONSTRAINT profile_requests_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: profile_requests profile_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_requests
    ADD CONSTRAINT profile_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: result_reports result_reports_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_reports
    ADD CONSTRAINT result_reports_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: result_reports result_reports_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_reports
    ADD CONSTRAINT result_reports_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_requests team_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_requests
    ADD CONSTRAINT team_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tournament_registrations tournament_registrations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_registrations
    ADD CONSTRAINT tournament_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: tournament_registrations tournament_registrations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_registrations
    ADD CONSTRAINT tournament_registrations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: profile_requests Admins pueden actualizar y borrar solicitudes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins pueden actualizar y borrar solicitudes" ON public.profile_requests FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: profile_requests Admins pueden eliminar solicitudes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins pueden eliminar solicitudes" ON public.profile_requests FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: match_chat Mensajes de chat visibles para todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Mensajes de chat visibles para todos" ON public.match_chat FOR SELECT USING (true);


--
-- Name: player_map_stats Permitir lectura general de map stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir lectura general de map stats" ON public.player_map_stats FOR SELECT USING (true);


--
-- Name: players Permitir lectura pública de jugadores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir lectura pública de jugadores" ON public.players FOR SELECT USING (true);


--
-- Name: match_chat Usuarios autenticados pueden enviar mensajes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios autenticados pueden enviar mensajes" ON public.match_chat FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profile_requests Usuarios ven sus solicitudes y admins ven todas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios ven sus solicitudes y admins ven todas" ON public.profile_requests FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: team_requests admin borra solicitud; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin borra solicitud" ON public.team_requests FOR DELETE USING (public.is_admin());


--
-- Name: teams admin gestiona equipos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin gestiona equipos" ON public.teams USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: events admin gestiona eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin gestiona eventos" ON public.events USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: players admin gestiona jugadores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin gestiona jugadores" ON public.players USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: matches admin gestiona partidas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin gestiona partidas" ON public.matches USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: match_chat chat: admin borra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat: admin borra" ON public.match_chat FOR DELETE USING (public.is_admin());


--
-- Name: match_chat chat: borrar el propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "chat: borrar el propio" ON public.match_chat FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: demo_workers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demo_workers ENABLE ROW LEVEL SECURITY;

--
-- Name: team_requests editar solicitud; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "editar solicitud" ON public.team_requests FOR UPDATE USING (((user_id = auth.uid()) OR public.is_admin())) WITH CHECK ((public.is_admin() OR (status = 'pending'::text)));


--
-- Name: elo_config elo config: todos ven; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "elo config: todos ven" ON public.elo_config FOR SELECT USING (true);


--
-- Name: player_elo elo: todos ven; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "elo: todos ven" ON public.player_elo FOR SELECT USING (true);


--
-- Name: elo_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.elo_config ENABLE ROW LEVEL SECURITY;

--
-- Name: team_requests enviar solicitud; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "enviar solicitud" ON public.team_requests FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (status = 'pending'::text)));


--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: game_servers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.game_servers ENABLE ROW LEVEL SECURITY;

--
-- Name: ingest_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ingest_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_registrations inscripciones: admin borra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "inscripciones: admin borra" ON public.tournament_registrations FOR DELETE USING (public.is_admin());


--
-- Name: tournament_registrations inscripciones: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "inscripciones: admin gestiona" ON public.tournament_registrations USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tournament_registrations inscripciones: duenio o capitan inscribe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "inscripciones: duenio o capitan inscribe" ON public.tournament_registrations FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = tournament_registrations.team_id) AND ((t.owner_id = auth.uid()) OR (t.captain_id = auth.uid()))))) AND (EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = tournament_registrations.event_id) AND (COALESCE(e.stage, 'Inscripciones'::text) = 'Inscripciones'::text) AND (NOT COALESCE(e.generated, false)))))));


--
-- Name: tournament_registrations inscripciones: duenio o capitan se da de baja; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "inscripciones: duenio o capitan se da de baja" ON public.tournament_registrations FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = tournament_registrations.team_id) AND ((t.owner_id = auth.uid()) OR (t.captain_id = auth.uid()))))) OR public.is_admin()));


--
-- Name: tournament_registrations inscripciones: todos ven; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "inscripciones: todos ven" ON public.tournament_registrations FOR SELECT USING (true);


--
-- Name: player_map_stats mapstats: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mapstats: admin gestiona" ON public.player_map_stats USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: match_chat; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_chat ENABLE ROW LEVEL SECURITY;

--
-- Name: match_player_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_player_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: match_vetos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_vetos ENABLE ROW LEVEL SECURITY;

--
-- Name: matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_queue matchmaking: ver solo la propia cola; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "matchmaking: ver solo la propia cola" ON public.matchmaking_queue FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: matchmaking_dispatch; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchmaking_dispatch ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_modes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchmaking_modes ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchmaking_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_settings matchmaking_settings_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matchmaking_settings_public_read ON public.matchmaking_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: player_medals medallas: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "medallas: admin gestiona" ON public.player_medals USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: player_medals medallas: todos ven; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "medallas: todos ven" ON public.player_medals FOR SELECT USING (true);


--
-- Name: matches partidas: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "partidas: admin gestiona" ON public.matches USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: matches partidas: todos ven; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "partidas: todos ven" ON public.matches FOR SELECT USING (true);


--
-- Name: pcw_posts pcw: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pcw: admin gestiona" ON public.pcw_posts USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: pcw_posts pcw: todos ven; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pcw: todos ven" ON public.pcw_posts FOR SELECT USING (true);


--
-- Name: pcw_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pcw_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_details perfil: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "perfil: admin gestiona" ON public.profile_details USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profile_details perfil: crear el propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "perfil: crear el propio" ON public.profile_details FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: profile_details perfil: editar el propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "perfil: editar el propio" ON public.profile_details FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profile_details perfil: ver segun privacidad; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "perfil: ver segun privacidad" ON public.profile_details FOR SELECT USING (((user_id = auth.uid()) OR public.is_admin() OR COALESCE(( SELECT
        CASE p.privacy
            WHEN 'public'::text THEN true
            WHEN 'members'::text THEN (auth.uid() IS NOT NULL)
            ELSE false
        END AS "case"
   FROM public.players p
  WHERE (p.user_id = profile_details.user_id)
 LIMIT 1), true)));


--
-- Name: player_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.player_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: player_elo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.player_elo ENABLE ROW LEVEL SECURITY;

--
-- Name: player_map_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.player_map_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: player_medals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.player_medals ENABLE ROW LEVEL SECURITY;

--
-- Name: players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_details ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: result_reports reportes: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reportes: admin gestiona" ON public.result_reports USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: result_reports reportes: el capitan edita el suyo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reportes: el capitan edita el suyo" ON public.result_reports FOR UPDATE USING (((by_user = auth.uid()) AND public.is_team_captain(team_id))) WITH CHECK (((by_user = auth.uid()) AND public.is_team_captain(team_id)));


--
-- Name: result_reports reportes: el capitan envia el suyo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reportes: el capitan envia el suyo" ON public.result_reports FOR INSERT WITH CHECK (((by_user = auth.uid()) AND public.is_team_captain(team_id) AND public.is_match_captain(match_id)));


--
-- Name: result_reports reportes: el capitan retira el suyo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reportes: el capitan retira el suyo" ON public.result_reports FOR DELETE USING ((((by_user = auth.uid()) AND public.is_team_captain(team_id) AND (EXISTS ( SELECT 1
   FROM public.matches m
  WHERE ((m.id = result_reports.match_id) AND (m.status <> 'finished'::text))))) OR public.is_admin()));


--
-- Name: result_reports reportes: ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reportes: ver" ON public.result_reports FOR SELECT USING ((public.is_admin() OR public.is_match_captain(match_id) OR (EXISTS ( SELECT 1
   FROM public.matches m
  WHERE ((m.id = result_reports.match_id) AND (m.status = 'finished'::text))))));


--
-- Name: result_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.result_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: game_servers servidores: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "servidores: admin gestiona" ON public.game_servers USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profile_requests solicitudes: crear la propia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "solicitudes: crear la propia" ON public.profile_requests FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.players p
  WHERE ((p.id = profile_requests.player_id) AND (p.user_id IS NULL))))));


--
-- Name: match_player_stats stats: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stats: admin gestiona" ON public.match_player_stats USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: match_player_stats stats: todos ven; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stats: todos ven" ON public.match_player_stats FOR SELECT USING (true);


--
-- Name: team_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: teams todos ven equipos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "todos ven equipos" ON public.teams FOR SELECT USING (true);


--
-- Name: events todos ven eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "todos ven eventos" ON public.events FOR SELECT USING (true);


--
-- Name: players todos ven jugadores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "todos ven jugadores" ON public.players FOR SELECT USING (true);


--
-- Name: matches todos ven partidas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "todos ven partidas" ON public.matches FOR SELECT USING (true);


--
-- Name: events torneos: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "torneos: admin gestiona" ON public.events USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: events torneos: todos ven; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "torneos: todos ven" ON public.events FOR SELECT USING (true);


--
-- Name: tournament_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles ver mi perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ver mi perfil" ON public.profiles FOR SELECT USING ((id = auth.uid()));


--
-- Name: team_requests ver mi solicitud o admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ver mi solicitud o admin" ON public.team_requests FOR SELECT USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: match_vetos vetos: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vetos: admin gestiona" ON public.match_vetos USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: match_vetos vetos: capitan en su turno; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vetos: capitan en su turno" ON public.match_vetos FOR INSERT WITH CHECK (((by_user = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.matches m
     JOIN public.teams t ON ((t.id = match_vetos.team_id)))
  WHERE ((m.id = match_vetos.match_id) AND (m.status <> 'finished'::text) AND (t.captain_id = auth.uid()) AND (match_vetos.team_id =
        CASE
            WHEN ((match_vetos.seq % 2) = 1) THEN m.team1
            ELSE m.team2
        END)))) AND (seq = ( SELECT (count(*) + 1)
   FROM public.match_vetos v
  WHERE (v.match_id = match_vetos.match_id)))));


--
-- Name: match_vetos vetos: todos ven; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vetos: todos ven" ON public.match_vetos FOR SELECT USING (true);


--
-- Name: demo_workers workers de demos: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "workers de demos: admin gestiona" ON public.demo_workers USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION accept_pcw(p_post uuid, p_name text, p_players uuid[], p_guests text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accept_pcw(p_post uuid, p_name text, p_players uuid[], p_guests text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_pcw(p_post uuid, p_name text, p_players uuid[], p_guests text[]) TO anon;
GRANT ALL ON FUNCTION public.accept_pcw(p_post uuid, p_name text, p_players uuid[], p_guests text[]) TO authenticated;
GRANT ALL ON FUNCTION public.accept_pcw(p_post uuid, p_name text, p_players uuid[], p_guests text[]) TO service_role;


--
-- Name: FUNCTION autoapply_pcw(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.autoapply_pcw() TO anon;
GRANT ALL ON FUNCTION public.autoapply_pcw() TO authenticated;
GRANT ALL ON FUNCTION public.autoapply_pcw() TO service_role;


--
-- Name: FUNCTION cancel_pcw_match(p_match uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_pcw_match(p_match uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_pcw_match(p_match uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_pcw_match(p_match uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_pcw_match(p_match uuid) TO service_role;


--
-- Name: FUNCTION cancel_pcw_post(p_post uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_pcw_post(p_post uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_pcw_post(p_post uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_pcw_post(p_post uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_pcw_post(p_post uuid) TO service_role;


--
-- Name: FUNCTION chat_rate_limit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.chat_rate_limit() TO anon;
GRANT ALL ON FUNCTION public.chat_rate_limit() TO authenticated;
GRANT ALL ON FUNCTION public.chat_rate_limit() TO service_role;


--
-- Name: FUNCTION create_demo_worker_token(p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_demo_worker_token(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_demo_worker_token(p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.create_demo_worker_token(p_name text) TO service_role;


--
-- Name: FUNCTION create_pcw_post(p_name text, p_best_of integer, p_maps text, p_starts_at timestamp with time zone, p_note text, p_players uuid[], p_guests text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_pcw_post(p_name text, p_best_of integer, p_maps text, p_starts_at timestamp with time zone, p_note text, p_players uuid[], p_guests text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_pcw_post(p_name text, p_best_of integer, p_maps text, p_starts_at timestamp with time zone, p_note text, p_players uuid[], p_guests text[]) TO anon;
GRANT ALL ON FUNCTION public.create_pcw_post(p_name text, p_best_of integer, p_maps text, p_starts_at timestamp with time zone, p_note text, p_players uuid[], p_guests text[]) TO authenticated;
GRANT ALL ON FUNCTION public.create_pcw_post(p_name text, p_best_of integer, p_maps text, p_starts_at timestamp with time zone, p_note text, p_players uuid[], p_guests text[]) TO service_role;


--
-- Name: FUNCTION create_server_token(p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_server_token(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_server_token(p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.create_server_token(p_name text) TO service_role;


--
-- Name: FUNCTION csstv_auth(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.csstv_auth(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.csstv_auth(p_token text) TO service_role;


--
-- Name: FUNCTION csstv_check_token(p_token text, OUT sid uuid, OUT reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.csstv_check_token(p_token text, OUT sid uuid, OUT reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.csstv_check_token(p_token text, OUT sid uuid, OUT reason text) TO service_role;


--
-- Name: FUNCTION csstv_ingest(p_server uuid, p jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.csstv_ingest(p_server uuid, p jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.csstv_ingest(p_server uuid, p jsonb) TO service_role;


--
-- Name: FUNCTION csstv_jint(j jsonb, k text, p_max integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.csstv_jint(j jsonb, k text, p_max integer) TO anon;
GRANT ALL ON FUNCTION public.csstv_jint(j jsonb, k text, p_max integer) TO authenticated;
GRANT ALL ON FUNCTION public.csstv_jint(j jsonb, k text, p_max integer) TO service_role;


--
-- Name: FUNCTION csstv_license(p_token text, p_version text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.csstv_license(p_token text, p_version text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.csstv_license(p_token text, p_version text) TO anon;
GRANT ALL ON FUNCTION public.csstv_license(p_token text, p_version text) TO authenticated;
GRANT ALL ON FUNCTION public.csstv_license(p_token text, p_version text) TO service_role;


--
-- Name: FUNCTION csstv_ncdf(x double precision); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.csstv_ncdf(x double precision) TO anon;
GRANT ALL ON FUNCTION public.csstv_ncdf(x double precision) TO authenticated;
GRANT ALL ON FUNCTION public.csstv_ncdf(x double precision) TO service_role;


--
-- Name: FUNCTION csstv_npdf(x double precision); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.csstv_npdf(x double precision) TO anon;
GRANT ALL ON FUNCTION public.csstv_npdf(x double precision) TO authenticated;
GRANT ALL ON FUNCTION public.csstv_npdf(x double precision) TO service_role;


--
-- Name: FUNCTION csstv_rating(kills numeric, deaths numeric, rounds numeric, k1 numeric, k2 numeric, k3 numeric, k4 numeric, k5 numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.csstv_rating(kills numeric, deaths numeric, rounds numeric, k1 numeric, k2 numeric, k3 numeric, k4 numeric, k5 numeric) TO anon;
GRANT ALL ON FUNCTION public.csstv_rating(kills numeric, deaths numeric, rounds numeric, k1 numeric, k2 numeric, k3 numeric, k4 numeric, k5 numeric) TO authenticated;
GRANT ALL ON FUNCTION public.csstv_rating(kills numeric, deaths numeric, rounds numeric, k1 numeric, k2 numeric, k3 numeric, k4 numeric, k5 numeric) TO service_role;


--
-- Name: FUNCTION csstv_request_ip(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.csstv_request_ip() FROM PUBLIC;
GRANT ALL ON FUNCTION public.csstv_request_ip() TO service_role;


--
-- Name: FUNCTION csstv_steam64(p text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.csstv_steam64(p text) TO anon;
GRANT ALL ON FUNCTION public.csstv_steam64(p text) TO authenticated;
GRANT ALL ON FUNCTION public.csstv_steam64(p text) TO service_role;


--
-- Name: FUNCTION demo_auth(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.demo_auth(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.demo_auth(p_token text) TO service_role;


--
-- Name: FUNCTION demo_expire(p_token text, p_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.demo_expire(p_token text, p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.demo_expire(p_token text, p_days integer) TO anon;
GRANT ALL ON FUNCTION public.demo_expire(p_token text, p_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.demo_expire(p_token text, p_days integer) TO service_role;


--
-- Name: FUNCTION demo_mark(p_token text, p_uid text, p_result text, p_key text, p_size bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.demo_mark(p_token text, p_uid text, p_result text, p_key text, p_size bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.demo_mark(p_token text, p_uid text, p_result text, p_key text, p_size bigint) TO anon;
GRANT ALL ON FUNCTION public.demo_mark(p_token text, p_uid text, p_result text, p_key text, p_size bigint) TO authenticated;
GRANT ALL ON FUNCTION public.demo_mark(p_token text, p_uid text, p_result text, p_key text, p_size bigint) TO service_role;


--
-- Name: FUNCTION demo_pending(p_token text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.demo_pending(p_token text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.demo_pending(p_token text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.demo_pending(p_token text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.demo_pending(p_token text, p_limit integer) TO service_role;


--
-- Name: FUNCTION elo_apply_match(p_match uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.elo_apply_match(p_match uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.elo_apply_match(p_match uuid) TO service_role;


--
-- Name: FUNCTION elo_recompute_all(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.elo_recompute_all() FROM PUBLIC;
GRANT ALL ON FUNCTION public.elo_recompute_all() TO authenticated;
GRANT ALL ON FUNCTION public.elo_recompute_all() TO service_role;


--
-- Name: FUNCTION elo_set_config(p_base integer, p_bonus_max integer, p_bonus_factor numeric, p_floor integer, p_start_elo integer, p_recompute boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.elo_set_config(p_base integer, p_bonus_max integer, p_bonus_factor numeric, p_floor integer, p_start_elo integer, p_recompute boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.elo_set_config(p_base integer, p_bonus_max integer, p_bonus_factor numeric, p_floor integer, p_start_elo integer, p_recompute boolean) TO authenticated;
GRANT ALL ON FUNCTION public.elo_set_config(p_base integer, p_bonus_max integer, p_bonus_factor numeric, p_floor integer, p_start_elo integer, p_recompute boolean) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION ingest_server_chunk(p_token text, p_uid text, p_part integer, p_total integer, p_data text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ingest_server_chunk(p_token text, p_uid text, p_part integer, p_total integer, p_data text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ingest_server_chunk(p_token text, p_uid text, p_part integer, p_total integer, p_data text) TO anon;
GRANT ALL ON FUNCTION public.ingest_server_chunk(p_token text, p_uid text, p_part integer, p_total integer, p_data text) TO authenticated;
GRANT ALL ON FUNCTION public.ingest_server_chunk(p_token text, p_uid text, p_part integer, p_total integer, p_data text) TO service_role;


--
-- Name: FUNCTION ingest_server_match(p_token text, p_payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ingest_server_match(p_token text, p_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ingest_server_match(p_token text, p_payload jsonb) TO anon;
GRANT ALL ON FUNCTION public.ingest_server_match(p_token text, p_payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.ingest_server_match(p_token text, p_payload jsonb) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_match_captain(p_match uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_match_captain(p_match uuid) TO anon;
GRANT ALL ON FUNCTION public.is_match_captain(p_match uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_match_captain(p_match uuid) TO service_role;


--
-- Name: FUNCTION is_team_captain(p_team uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_team_captain(p_team uuid) TO anon;
GRANT ALL ON FUNCTION public.is_team_captain(p_team uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_team_captain(p_team uuid) TO service_role;


--
-- Name: FUNCTION link_steam_id(p_steam text, p_player uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.link_steam_id(p_steam text, p_player uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.link_steam_id(p_steam text, p_player uuid) TO authenticated;
GRANT ALL ON FUNCTION public.link_steam_id(p_steam text, p_player uuid) TO service_role;


--
-- Name: FUNCTION matchmaking_admin_release_server(p_match_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_admin_release_server(p_match_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_admin_release_server(p_match_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_admin_release_server(p_match_id uuid) TO service_role;


--
-- Name: FUNCTION matchmaking_cancel(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_cancel() FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_cancel() TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_cancel() TO service_role;


--
-- Name: FUNCTION matchmaking_join(p_mode text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_join(p_mode text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_join(p_mode text) TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_join(p_mode text) TO service_role;


--
-- Name: FUNCTION matchmaking_queue_state(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_queue_state() FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_queue_state() TO anon;
GRANT ALL ON FUNCTION public.matchmaking_queue_state() TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_queue_state() TO service_role;


--
-- Name: FUNCTION matchmaking_server_mark_live(p_token text, p_match_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_server_mark_live(p_token text, p_match_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_server_mark_live(p_token text, p_match_id uuid) TO anon;
GRANT ALL ON FUNCTION public.matchmaking_server_mark_live(p_token text, p_match_id uuid) TO service_role;


--
-- Name: FUNCTION matchmaking_server_poll(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_server_poll(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_server_poll(p_token text) TO anon;
GRANT ALL ON FUNCTION public.matchmaking_server_poll(p_token text) TO service_role;


--
-- Name: FUNCTION matchmaking_set_mode(p_mode text, p_enabled boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_set_mode(p_mode text, p_enabled boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_set_mode(p_mode text, p_enabled boolean) TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_set_mode(p_mode text, p_enabled boolean) TO service_role;


--
-- Name: FUNCTION matchmaking_set_queue_open(p_open boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_set_queue_open(p_open boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_set_queue_open(p_open boolean) TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_set_queue_open(p_open boolean) TO service_role;


--
-- Name: FUNCTION matchmaking_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_status() TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_status() TO service_role;


--
-- Name: FUNCTION matchmaking_try_match(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_try_match() FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_try_match() TO service_role;


--
-- Name: FUNCTION matchmaking_try_match_unchecked(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_try_match_unchecked() FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_try_match_unchecked() TO service_role;


--
-- Name: FUNCTION norm_maps(j jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.norm_maps(j jsonb) TO anon;
GRANT ALL ON FUNCTION public.norm_maps(j jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.norm_maps(j jsonb) TO service_role;


--
-- Name: FUNCTION pcw_cleanup(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pcw_cleanup() FROM PUBLIC;
GRANT ALL ON FUNCTION public.pcw_cleanup() TO anon;
GRANT ALL ON FUNCTION public.pcw_cleanup() TO authenticated;
GRANT ALL ON FUNCTION public.pcw_cleanup() TO service_role;


--
-- Name: FUNCTION pcw_make_side(p_name text, p_players uuid[], p_guests text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pcw_make_side(p_name text, p_players uuid[], p_guests text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pcw_make_side(p_name text, p_players uuid[], p_guests text[]) TO anon;
GRANT ALL ON FUNCTION public.pcw_make_side(p_name text, p_players uuid[], p_guests text[]) TO authenticated;
GRANT ALL ON FUNCTION public.pcw_make_side(p_name text, p_players uuid[], p_guests text[]) TO service_role;


--
-- Name: FUNCTION recompute_player_stats(p_player uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recompute_player_stats(p_player uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recompute_player_stats(p_player uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recompute_player_stats(p_player uuid) TO service_role;


--
-- Name: FUNCTION rotate_server_token(p_server uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rotate_server_token(p_server uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rotate_server_token(p_server uuid) TO authenticated;
GRANT ALL ON FUNCTION public.rotate_server_token(p_server uuid) TO service_role;


--
-- Name: FUNCTION set_my_tag(p_tag text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_my_tag(p_tag text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_my_tag(p_tag text) TO anon;
GRANT ALL ON FUNCTION public.set_my_tag(p_tag text) TO authenticated;
GRANT ALL ON FUNCTION public.set_my_tag(p_tag text) TO service_role;


--
-- Name: FUNCTION set_team_captain(p_team uuid, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_team_captain(p_team uuid, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_team_captain(p_team uuid, p_user uuid) TO anon;
GRANT ALL ON FUNCTION public.set_team_captain(p_team uuid, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.set_team_captain(p_team uuid, p_user uuid) TO service_role;


--
-- Name: FUNCTION validate_report(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_report() TO anon;
GRANT ALL ON FUNCTION public.validate_report() TO authenticated;
GRANT ALL ON FUNCTION public.validate_report() TO service_role;


--
-- Name: TABLE demo_workers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.demo_workers TO anon;
GRANT ALL ON TABLE public.demo_workers TO authenticated;
GRANT ALL ON TABLE public.demo_workers TO service_role;


--
-- Name: TABLE elo_config; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.elo_config TO anon;
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.elo_config TO authenticated;
GRANT ALL ON TABLE public.elo_config TO service_role;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;


--
-- Name: TABLE game_servers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.game_servers TO anon;
GRANT ALL ON TABLE public.game_servers TO authenticated;
GRANT ALL ON TABLE public.game_servers TO service_role;


--
-- Name: TABLE ingest_chunks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ingest_chunks TO anon;
GRANT ALL ON TABLE public.ingest_chunks TO authenticated;
GRANT ALL ON TABLE public.ingest_chunks TO service_role;


--
-- Name: TABLE match_chat; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.match_chat TO anon;
GRANT ALL ON TABLE public.match_chat TO authenticated;
GRANT ALL ON TABLE public.match_chat TO service_role;


--
-- Name: SEQUENCE match_chat_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.match_chat_id_seq TO anon;
GRANT ALL ON SEQUENCE public.match_chat_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.match_chat_id_seq TO service_role;


--
-- Name: TABLE match_player_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.match_player_stats TO anon;
GRANT ALL ON TABLE public.match_player_stats TO authenticated;
GRANT ALL ON TABLE public.match_player_stats TO service_role;


--
-- Name: SEQUENCE match_player_stats_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.match_player_stats_id_seq TO anon;
GRANT ALL ON SEQUENCE public.match_player_stats_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.match_player_stats_id_seq TO service_role;


--
-- Name: TABLE match_vetos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.match_vetos TO anon;
GRANT ALL ON TABLE public.match_vetos TO authenticated;
GRANT ALL ON TABLE public.match_vetos TO service_role;


--
-- Name: TABLE matches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matches TO anon;
GRANT ALL ON TABLE public.matches TO authenticated;
GRANT ALL ON TABLE public.matches TO service_role;


--
-- Name: TABLE matchmaking_dispatch; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchmaking_dispatch TO service_role;


--
-- Name: TABLE matchmaking_modes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchmaking_modes TO service_role;


--
-- Name: TABLE matchmaking_queue; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchmaking_queue TO anon;
GRANT ALL ON TABLE public.matchmaking_queue TO authenticated;
GRANT ALL ON TABLE public.matchmaking_queue TO service_role;


--
-- Name: TABLE matchmaking_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchmaking_settings TO service_role;


--
-- Name: COLUMN matchmaking_settings.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.matchmaking_settings TO anon;
GRANT SELECT(id) ON TABLE public.matchmaking_settings TO authenticated;


--
-- Name: COLUMN matchmaking_settings.queue_open; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(queue_open) ON TABLE public.matchmaking_settings TO anon;
GRANT SELECT(queue_open) ON TABLE public.matchmaking_settings TO authenticated;


--
-- Name: COLUMN matchmaking_settings.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.matchmaking_settings TO anon;
GRANT SELECT(updated_at) ON TABLE public.matchmaking_settings TO authenticated;


--
-- Name: TABLE pcw_posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pcw_posts TO anon;
GRANT ALL ON TABLE public.pcw_posts TO authenticated;
GRANT ALL ON TABLE public.pcw_posts TO service_role;


--
-- Name: TABLE player_claims; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.player_claims TO anon;
GRANT ALL ON TABLE public.player_claims TO authenticated;
GRANT ALL ON TABLE public.player_claims TO service_role;


--
-- Name: TABLE player_elo; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.player_elo TO anon;
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.player_elo TO authenticated;
GRANT ALL ON TABLE public.player_elo TO service_role;


--
-- Name: TABLE player_map_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.player_map_stats TO anon;
GRANT ALL ON TABLE public.player_map_stats TO authenticated;
GRANT ALL ON TABLE public.player_map_stats TO service_role;


--
-- Name: SEQUENCE player_map_stats_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.player_map_stats_id_seq TO anon;
GRANT ALL ON SEQUENCE public.player_map_stats_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.player_map_stats_id_seq TO service_role;


--
-- Name: TABLE player_medals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.player_medals TO anon;
GRANT ALL ON TABLE public.player_medals TO authenticated;
GRANT ALL ON TABLE public.player_medals TO service_role;


--
-- Name: TABLE players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.players TO anon;
GRANT ALL ON TABLE public.players TO authenticated;
GRANT ALL ON TABLE public.players TO service_role;


--
-- Name: TABLE profile_details; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profile_details TO anon;
GRANT ALL ON TABLE public.profile_details TO authenticated;
GRANT ALL ON TABLE public.profile_details TO service_role;


--
-- Name: TABLE profile_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profile_requests TO anon;
GRANT ALL ON TABLE public.profile_requests TO authenticated;
GRANT ALL ON TABLE public.profile_requests TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE public_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.public_profiles TO anon;
GRANT ALL ON TABLE public.public_profiles TO authenticated;
GRANT ALL ON TABLE public.public_profiles TO service_role;


--
-- Name: TABLE result_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.result_reports TO anon;
GRANT ALL ON TABLE public.result_reports TO authenticated;
GRANT ALL ON TABLE public.result_reports TO service_role;


--
-- Name: TABLE team_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_requests TO anon;
GRANT ALL ON TABLE public.team_requests TO authenticated;
GRANT ALL ON TABLE public.team_requests TO service_role;


--
-- Name: TABLE teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teams TO anon;
GRANT ALL ON TABLE public.teams TO authenticated;
GRANT ALL ON TABLE public.teams TO service_role;


--
-- Name: TABLE tournament_registrations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tournament_registrations TO anon;
GRANT ALL ON TABLE public.tournament_registrations TO authenticated;
GRANT ALL ON TABLE public.tournament_registrations TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--



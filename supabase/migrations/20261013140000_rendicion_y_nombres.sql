-- =============================================================================
-- Rendición (!gg) y nombres de equipo de los mixes (plugin 1.6.0)
--
-- - matches.end_reason: 'surrender' cuando un equipo se rindió con !gg. La partida sigue
--   siendo 'finished' (gana el que iba adelante y cuenta para el ELO como cualquier otra).
-- - Los equipos del mix se llaman "Equipo <nick>" con el nick que eligió el plugin
--   (team_names.a / team_names.b). Sin esos datos (plugin anterior), sigue "Mix de <top fragger>".
--
-- csstv_ingest es la misma de 20261012140000 con esos dos cambios.
-- Bitácora: docs/bitacora/2026-10-13-plugin-1-6-0/
--
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run.
-- Es re-ejecutable.
-- =============================================================================

begin;

alter table public.matches add column if not exists end_reason text;
alter table public.matches drop constraint if exists matches_end_reason_check;
alter table public.matches add constraint matches_end_reason_check
  check (end_reason is null or end_reason = 'surrender');

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
end $$;

revoke all on function public.csstv_ingest(uuid, jsonb) from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- Replanteo 41: gestión de torneos (plan docs/bitacora/2026-11-01-admin-torneos).
--   1. Moderadores: operan todos los torneos; borrar y cancelar queda para el admin y el organizador dueño.
--   2. Siembra: el start_stage del suizo de varias etapas sale de la posición (los mejores, a la etapa más avanzada),
--      y la siembra se puede ordenar por ranking (puntos de torneos y PCW, ELO promedio de los activos, inscripción).
--   3. Mapas de una serie: vincular a mano un mix ya jugado o cargar el resultado a mano, mapa por mapa.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.team_create(text, text)') is null then
    raise exception 'replanteo 41: falta el replanteo 40 (aplicar antes 40_equipo_al_instante.sql)';
  end if;
  if to_regprocedure('public.can_own_event(uuid)') is not null then
    raise exception 'replanteo 41: ya existe can_own_event (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Permisos
-- =====================================================================================================
-- Gestionar (inscripciones, siembra, fixture, resultados, horarios, empates): admin, moderador u organizador dueño.
-- is_moderator() ya incluye al admin.
create or replace function public.can_manage_event(p_event uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_moderator() or exists (
    select 1 from events e join profiles p on p.id = e.organizer_id
     where e.id = p_event and e.organizer_id = auth.uid() and p.role = 'organizer')
$$;

-- Borrar y cancelar: admin u organizador dueño (el moderador no).
create function public.can_own_event(p_event uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from events e join profiles p on p.id = e.organizer_id
     where e.id = p_event and e.organizer_id = auth.uid() and p.role = 'organizer')
$$;
grant execute on function public.can_own_event(uuid) to anon, authenticated;

drop policy "torneos: borrar" on public.events;
create policy "torneos: borrar" on public.events for delete to authenticated using (can_own_event(id));

create function public.events_owner_only() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.status = 'cancelled' and old.status <> 'cancelled' and not can_own_event(new.id) then
    raise exception 'Solo el organizador del torneo o un admin puede cancelarlo' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger events_owner_only before update of status on public.events
  for each row execute function public.events_owner_only();

-- =====================================================================================================
-- 2. Siembra
-- =====================================================================================================
-- Suizo de varias etapas: la siembra se parte en bloques de size/2; el primero entra a la última etapa, el segundo a la
-- anterior, y el resto juega la 1. Major clásico (2 etapas de 16): 1-8 a la etapa 2, 9-24 a la 1. Expandido (3): 1-8 a la 3,
-- 9-16 a la 2, 17-32 a la 1. En los demás formatos, todos en la 1.
create function public.events_seed_stages() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_stages int := 1; v_half int := 1;
begin
  if new.status <> 'registration' then return null; end if;
  if new.template = 'swiss' then
    v_stages := coalesce((new.config->>'stages')::int, 1);
    v_half := greatest(coalesce((new.config->>'size')::int, 2) / 2, 1);
  end if;
  update tournament_registrations r
     set start_stage = case when v_stages > 1 and array_position(new.seeds, r.team_id) is not null
                            then greatest(v_stages - (array_position(new.seeds, r.team_id) - 1) / v_half, 1)
                            else 1 end
   where r.event_id = new.id;
  return null;
end $$;
create trigger events_seed_stages after update of seeds, template, config on public.events
  for each row execute function public.events_seed_stages();

-- Siembra por ranking: puntos totales del ranking de equipos (torneos y PCW), ELO promedio de los activos inscritos
-- y, si siguen empatados, quién se inscribió antes.
create function public.event_seed_ranking(p_event uuid) returns uuid[]
  language plpgsql security definer set search_path = public as $$
declare e events%rowtype; s uuid[];
begin
  if not can_manage_event(p_event) then
    raise exception 'Solo el organizador del torneo, un moderador o un admin puede sembrar' using errcode = '42501';
  end if;
  select * into e from events where id = p_event for update;
  if not found then raise exception 'No existe ese torneo' using errcode = 'P0002'; end if;
  if e.status <> 'registration' then raise exception 'La siembra solo se cambia antes de generar el fixture'; end if;
  select array_agg(x.team_id order by x.pts desc, x.elo desc nulls last, x.created_at, x.team_id) into s
    from (
      select r.team_id, r.created_at,
             coalesce((select st.official_points + st.pcw_points from team_standings st where st.team_id = r.team_id), 0) as pts,
             (select avg(pe.elo) from tournament_registration_players trp
                join players p on p.id = trp.player_id
                join player_elo pe on pe.steam_id = p.steam_id
               where trp.event_id = p_event and trp.team_id = r.team_id and trp.role = 'active') as elo
        from tournament_registrations r where r.event_id = p_event
    ) x;
  if coalesce(cardinality(s), 0) < 2 then raise exception 'Hacen falta al menos 2 equipos inscritos para sembrar'; end if;
  update events set seeds = s where id = p_event;
  return s;
end $$;
revoke all on function public.event_seed_ranking(uuid) from public, anon;
grant execute on function public.event_seed_ranking(uuid) to authenticated;

-- =====================================================================================================
-- 3. Mapas de una serie: mix vinculado o resultado a mano
-- =====================================================================================================
-- Qué bando del mix jugó como el equipo 1 de la partida: el que tiene más inscritos de ese equipo.
create function public.match_game_side(p_match uuid, p_game uuid) returns int
  language sql stable security definer set search_path = public as $$
  select case when count(*) filter (where (s.team = 1 and s.player_id in (select match_roster(p_match, m.team1)))
                                          or (s.team = 2 and s.player_id in (select match_roster(p_match, m.team2))))
                  >= count(*) filter (where (s.team = 2 and s.player_id in (select match_roster(p_match, m.team1)))
                                          or (s.team = 1 and s.player_id in (select match_roster(p_match, m.team2))))
              then 1 else 2 end
    from matches m join match_player_stats s on s.match_id = p_game and s.rounds > 0
   where m.id = p_match
$$;

-- Mixes para vincular: terminados en los últimos 14 días, sin vincular (o ya vinculados a esta partida), con al menos
-- un inscrito de alguno de los dos equipos. Primero los vinculados y después los que más inscritos tienen.
create function public.match_game_candidates(p_match uuid)
  returns table(game_id uuid, map text, played_at timestamptz, score1 int, score2 int, server_name text,
                players int, registered int, side1 int, linked boolean)
  language plpgsql stable security definer set search_path = public as $$
declare m matches%rowtype;
begin
  select * into m from matches where id = p_match;
  if not found or m.kind <> 'official' or m.event_id is null then raise exception 'Esa partida no es de un torneo' using errcode = 'P0002'; end if;
  if not can_manage_event(m.event_id) then
    raise exception 'Solo el organizador del torneo, un moderador o un admin puede vincular mixes' using errcode = '42501';
  end if;
  return query
    select g.id, g.map, g.played_at, g.score1, g.score2, gs.name,
           (select count(*)::int from match_player_stats s where s.match_id = g.id and s.rounds > 0),
           (select count(*)::int from match_player_stats s where s.match_id = g.id and s.rounds > 0
               and (s.player_id in (select match_roster(p_match, m.team1)) or s.player_id in (select match_roster(p_match, m.team2)))),
           coalesce(g.parent_side1::int, match_game_side(p_match, g.id)),
           g.parent_match_id is not null
      from matches g left join game_servers gs on gs.id = g.server_id
     where g.kind = 'mix' and g.status = 'finished'
       and (g.parent_match_id is null or g.parent_match_id = p_match)
       and (g.parent_match_id = p_match or g.played_at > now() - interval '14 days')
       and exists (select 1 from match_player_stats s where s.match_id = g.id and s.rounds > 0
                     and (s.player_id in (select match_roster(p_match, m.team1)) or s.player_id in (select match_roster(p_match, m.team2))))
     order by g.parent_match_id is not null desc, 8 desc, g.played_at desc
     limit 20;
end $$;
revoke all on function public.match_game_candidates(uuid) from public, anon;
grant execute on function public.match_game_candidates(uuid) to authenticated;

-- Guarda los mapas de una serie. Cada elemento: { game_id, side1? } (mix vinculado; side1 = bando del mix que es el
-- equipo 1, se deduce si falta) o { map, r1, r2 } (resultado a mano, sin detalle). Con la serie definida, la cierra con
-- event_set_result (y la llave avanza); si no, la deja en curso. Los mixes que salen de la lista se desvinculan.
create function public.match_set_maps(p_match uuid, p_maps jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  m      matches%rowtype;
  g      matches%rowtype;
  x      jsonb;
  res    jsonb := '[]';
  ids    uuid[] := '{}';
  sides  int[] := '{}';
  s      int;
  r1     int;
  r2     int;
  w1     int := 0;
  w2     int := 0;
  hace   int;
  i      int;
begin
  select * into m from matches where id = p_match for update;
  if not found or m.kind <> 'official' or m.event_id is null then raise exception 'Esa partida no es de un torneo' using errcode = 'P0002'; end if;
  if not can_manage_event(m.event_id) then
    raise exception 'Solo el organizador del torneo, un moderador o un admin puede cargar resultados' using errcode = '42501';
  end if;
  if m.bye or m.team1 is null or m.team2 is null then raise exception 'La partida todavía no tiene los dos equipos'; end if;
  if m.status = 'cancelled' then raise exception 'La partida está cancelada'; end if;
  if jsonb_typeof(p_maps) <> 'array' or jsonb_array_length(p_maps) > m.best_of then
    raise exception 'Cargá hasta % mapas', m.best_of;
  end if;

  for x in select value from jsonb_array_elements(p_maps) loop
    if nullif(x->>'game_id', '') is not null then
      select * into g from matches where id = (x->>'game_id')::uuid;
      if not found or g.kind <> 'mix' or g.status <> 'finished' then raise exception 'Ese mix no existe o no terminó'; end if;
      if g.parent_match_id is not null and g.parent_match_id <> p_match then
        raise exception 'Ese mix ya está vinculado a otra partida' using errcode = 'V3901';
      end if;
      if g.id = any(ids) then raise exception 'El mismo mix no puede ser dos mapas'; end if;
      s := coalesce((x->>'side1')::int, g.parent_side1::int, match_game_side(p_match, g.id));
      if s not in (1, 2) then raise exception 'El bando tiene que ser 1 o 2'; end if;
      r1 := case s when 1 then g.score1 else g.score2 end;
      r2 := case s when 1 then g.score2 else g.score1 end;
      res := res || jsonb_build_array(jsonb_build_object('map', g.map, 'r1', r1, 'r2', r2, 'game_id', g.id));
      ids := ids || g.id;
      sides := sides || s;
    else
      if (x->>'r1') !~ '^\d{1,2}$' or (x->>'r2') !~ '^\d{1,2}$' then raise exception 'Cada mapa necesita las rondas de los dos equipos (0 a 99)'; end if;
      r1 := (x->>'r1')::int;
      r2 := (x->>'r2')::int;
      if char_length(x->>'map') > 40 then raise exception 'El nombre del mapa tiene hasta 40 caracteres'; end if;
      res := res || jsonb_build_array(jsonb_build_object('map', nullif(btrim(coalesce(x->>'map', '')), ''), 'r1', r1, 'r2', r2));
    end if;
    if r1 = r2 then raise exception 'Un mapa no puede terminar empatado (se juega overtime)'; end if;
    if r1 > r2 then w1 := w1 + 1; else w2 := w2 + 1; end if;
  end loop;

  w1 := w1 + case when m.advantage_side = 1 then 1 else 0 end;
  w2 := w2 + case when m.advantage_side = 2 then 1 else 0 end;
  hace := m.best_of / 2 + 1;
  if w1 >= hace and w2 >= hace then raise exception 'Con esos mapas los dos equipos ganan la serie'; end if;

  -- Si la serie ya estaba cerrada y deja de estarlo (o cambia), se reabre primero (deshace el avance de la llave).
  if m.status = 'finished' and greatest(w1, w2) < hace then
    perform event_set_result(p_match, null, null, true);
  end if;

  -- Mixes: se desvinculan los que salen y se vinculan los de la lista, con su bando.
  update matches set parent_match_id = null, parent_side1 = null where parent_match_id = p_match and not (id = any(ids));
  for i in 1 .. coalesce(cardinality(ids), 0) loop
    update matches set parent_match_id = p_match, parent_side1 = sides[i],
      side1_name = coalesce((select name from teams where id = case sides[i] when 1 then m.team1 else m.team2 end), side1_name),
      side2_name = coalesce((select name from teams where id = case sides[i] when 1 then m.team2 else m.team1 end), side2_name)
     where id = ids[i];
  end loop;

  if greatest(w1, w2) >= hace then
    perform event_set_result(p_match, res);
  else
    perform event_engine_on();
    perform set_config('v34.no_progress', '1', true);
    update matches set
      maps = case when jsonb_array_length(res) = 0 then null else res end,
      score1 = case when jsonb_array_length(res) = 0 and m.advantage_side is null then null else w1 end,
      score2 = case when jsonb_array_length(res) = 0 and m.advantage_side is null then null else w2 end,
      map = (select string_agg(coalesce(nullif(y->>'map', ''), '?'), ', ') from jsonb_array_elements(res) y),
      status = case when jsonb_array_length(res) = 0 then 'upcoming' else 'live' end,
      winner = null, end_reason = null
     where id = p_match;
    perform set_config('v34.no_progress', '', true);
  end if;
end $$;
revoke all on function public.match_set_maps(uuid, jsonb) from public, anon;
grant execute on function public.match_set_maps(uuid, jsonb) to authenticated;

commit;

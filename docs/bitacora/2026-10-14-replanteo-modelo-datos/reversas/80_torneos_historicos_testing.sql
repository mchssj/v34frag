-- Inversa del replanteo 80 (torneos históricos, aprobación de organizadores y fase de testing).
-- Deja las funciones, las vistas y las políticas como estaban con la 78 (definiciones guardadas antes de aplicar la 80)
-- y saca las columnas nuevas. ABORTA si hay torneos históricos, en testing, pendientes o rechazados, o equipos
-- históricos: se perderían (borrarlos o publicarlos antes).
begin;

do $$
begin
  if exists (select 1 from public.events where historic or testing or approval <> 'approved')
     or exists (select 1 from public.teams where kind = 'historic') then
    raise exception 'inversa 80: hay torneos históricos, en testing, pendientes o rechazados, o equipos históricos';
  end if;
end $$;

drop function public.event_review(uuid, boolean, text);
drop function public.event_resubmit(uuid);
drop function public.match_review_game(uuid, boolean);
drop function public.match_set_played_at(uuid, timestamptz);
drop function public.event_create_historic_team(uuid, text, text);
drop function public.historic_team_similar(text);
drop function public.historic_team_update(uuid, text, text);
drop function public.historic_team_set_logo(uuid, text);
drop function public.historic_team_can_edit(uuid);

-- Políticas de antes
drop policy "torneos: ver" on public.events;
create policy "torneos: todos ven" on public.events for select using (true);
drop policy "torneos: crear" on public.events;
create policy "torneos: crear" on public.events for insert to authenticated with check (is_organizer() and (organizer_id = auth.uid() or is_admin()));
drop policy "partidas: ver" on public.matches;
create policy "partidas: todos ven" on public.matches for select using (true);
drop policy "inscripciones: ver" on public.tournament_registrations;
create policy "inscripciones: todos ven" on public.tournament_registrations for select using (true);
drop policy trp_ver on public.tournament_registration_players;
create policy trp_ver on public.tournament_registration_players for select to anon, authenticated using (true);
drop policy event_stage_teams_ver on public.event_stage_teams;
create policy event_stage_teams_ver on public.event_stage_teams for select to anon, authenticated using (true);

-- Triggers de antes
drop trigger notify_events on public.events;
create trigger notify_events after insert or update of status on public.events for each row execute function public.tg_notify_events();
drop trigger matches_played_at on public.matches;
create trigger matches_played_at before insert or update of status on public.matches for each row execute function public.matches_played_at();
drop trigger matches_parent_approved on public.matches;
drop function public.matches_parent_approved();

-- Candidatos con la firma de la 41
drop function public.match_game_candidates(uuid, timestamptz, timestamptz, text, uuid, int, int);
CREATE OR REPLACE FUNCTION public.match_game_candidates(p_match uuid)
 RETURNS TABLE(game_id uuid, map text, played_at timestamp with time zone, score1 integer, score2 integer, server_name text, players integer, registered integer, side1 integer, linked boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;
revoke all on function public.match_game_candidates(uuid) from public;

-- Funciones como estaban con la 78
CREATE OR REPLACE FUNCTION public.can_manage_event(p_event uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select is_moderator() or exists (
    select 1 from events e join profiles p on p.id = e.organizer_id
     where e.id = p_event and e.organizer_id = auth.uid() and p.role = 'organizer')
$function$

;

CREATE OR REPLACE FUNCTION public.can_own_event(p_event uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select is_admin() or exists (
    select 1 from events e join profiles p on p.id = e.organizer_id
     where e.id = p_event and e.organizer_id = auth.uid() and p.role = 'organizer')
$function$

;

CREATE OR REPLACE FUNCTION public.event_ref(p_event uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('id', id, 'name', name) from events where id = p_event $function$

;

CREATE OR REPLACE FUNCTION public.events_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare x record;
begin
  if tg_op = 'INSERT' then
    new.organizer_id := coalesce(new.organizer_id, auth.uid());
    new.status := 'registration';
    new.champion := null;
    new.config := event_config(new.template, new.config);
    if auth.uid() is not null and not is_organizer() then
      raise exception 'Solo un organizador o un admin puede crear torneos' using errcode = '42501';
    end if;
    -- (replanteo 33) solo un modo habilitado
    if not exists (select 1 from game_modes where code = new.game_mode and active) then
      raise exception 'El modo de juego % no está habilitado', new.game_mode;
    end if;
    return new;
  end if;
  if (new.template, new.config, new.game_mode, new.subs_max) is distinct from (old.template, old.config, old.game_mode, old.subs_max) then
    if old.status <> 'registration' then raise exception 'El formato de un torneo ya generado no se puede cambiar (reinicialo primero)'; end if;
    new.config := event_config(new.template, new.config);
  end if;
  -- (replanteo 33) el modo nuevo tiene que estar habilitado, y los inscritos tienen que cumplir el formato nuevo
  if new.game_mode is distinct from old.game_mode and not exists (select 1 from game_modes where code = new.game_mode and active) then
    raise exception 'El modo de juego % no está habilitado', new.game_mode;
  end if;
  if (new.game_mode, new.subs_max) is distinct from (old.game_mode, old.subs_max) then
    select t.name into x
      from tournament_registrations r join teams t on t.id = r.team_id
     where r.event_id = new.id
       and ((select count(*) from tournament_registration_players p where p.event_id = r.event_id and p.team_id = r.team_id and p.role = 'active')
              <> (select players_per_team from game_modes where code = new.game_mode)
            or (select count(*) from tournament_registration_players p where p.event_id = r.event_id and p.team_id = r.team_id and p.role = 'sub')
              > new.subs_max)
     order by t.name
     limit 1;
    if found then
      raise exception 'Hay equipos inscritos que no cumplen el formato nuevo (por ejemplo %): tienen que corregir su inscripción antes', x.name;
    end if;
  end if;
  if new.seeds is distinct from old.seeds and old.status <> 'registration' then
    raise exception 'La siembra solo se cambia antes de generar el fixture';
  end if;
  if current_setting('v34.engine', true) is distinct from '1' then
    if new.status is distinct from old.status and not (new.status = 'cancelled' and old.status in ('registration', 'in_progress')) then
      raise exception 'El estado del torneo lo maneja la página (solo se puede cancelar)';
    end if;
    if new.champion is distinct from old.champion or new.tie_pending is distinct from old.tie_pending then
      raise exception 'El campeón lo define la página';
    end if;
    if new.organizer_id is distinct from old.organizer_id and not is_admin() then
      raise exception 'Solo un admin puede cambiar el organizador';
    end if;
  end if;
  return new;
end $function$

;

CREATE OR REPLACE FUNCTION public.match_set_maps(p_match uuid, p_maps jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION public.matches_played_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.kind <> 'mix' and new.status = 'finished' and new.played_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'finished') then
    new.played_at := now();
  end if;
  return new;
end $function$

;

CREATE OR REPLACE FUNCTION public.event_register(p_event uuid, p_team uuid, p_active uuid[], p_subs uuid[] DEFAULT '{}'::uuid[], p_start_stage integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e        events%rowtype;
  t        teams%rowtype;
  gestor   boolean;
  ya       boolean;
  x        record;
  activos  uuid[] := coalesce(p_active, '{}');
  todos    uuid[] := coalesce(p_active, '{}') || coalesce(p_subs, '{}');
  ns       int := coalesce(cardinality(p_subs), 0);
  ppt      int;
  sin      text[];
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into e from events where id = p_event for update;
  if not found then raise exception 'No existe ese torneo'; end if;
  select * into t from teams where id = p_team;
  if not found or t.kind <> 'official' then raise exception 'Solo se inscriben equipos oficiales'; end if;
  gestor := can_manage_event(p_event);
  if not gestor and t.captain_id is distinct from auth.uid() then
    raise exception 'Solo el capitán del equipo puede inscribirlo' using errcode = '42501';
  end if;
  ya := exists (select 1 from tournament_registrations where event_id = p_event and team_id = p_team);
  if e.status in ('finished', 'cancelled') then raise exception 'El torneo ya terminó o fue cancelado'; end if;
  if e.status = 'in_progress' and (not gestor or not ya) then
    raise exception 'El fixture ya está generado: solo el organizador cambia los inscritos de un equipo inscrito';
  end if;
  if not gestor and e.registration_closes_at is not null and now() >= e.registration_closes_at then
    raise exception 'Las inscripciones de este torneo ya cerraron' using errcode = 'V3404';
  end if;
  if not ya and e.max_teams is not null and (select count(*) from tournament_registrations where event_id = p_event) >= e.max_teams then
    raise exception 'El torneo ya tiene el cupo completo (% equipos)', e.max_teams;
  end if;
  if cardinality(todos) <> (select count(distinct y) from unnest(todos) y) then raise exception 'Hay jugadores repetidos'; end if;
  select players_per_team into ppt from game_modes where code = e.game_mode;
  if cardinality(activos) <> ppt then
    raise exception 'Cada equipo inscribe % jugadores activos (modo %)', ppt, e.game_mode;
  end if;
  if ns > e.subs_max then
    if e.subs_max = 0 then raise exception 'Este torneo no admite suplentes'; end if;
    raise exception 'Este torneo admite hasta % suplentes', e.subs_max;
  end if;
  if (select count(*) from players where id = any(todos)) <> cardinality(todos) then raise exception 'Algún jugador no existe'; end if;
  for x in select p.nick, tm.role as estado
             from unnest(todos) u join players p on p.id = u
             left join team_members tm on tm.team_id = p_team and tm.player_id = p.id and tm.left_at is null
            order by p.nick loop
    if x.estado is null then raise exception '% no está en el plantel del equipo', x.nick; end if;
    if x.estado = 'coach' then
      raise exception '% es el coach del equipo: el coach no se inscribe como jugador', x.nick using errcode = 'V3403';
    end if;
  end loop;
  select array_agg(p.nick order by p.nick) into sin from players p where p.id = any(todos) and p.steam_id is null;
  if sin is not null then
    if cardinality(sin) = 1 then
      raise exception '% no tiene el SteamID vinculado', sin[1] using errcode = 'V3405', detail = to_jsonb(sin)::text;
    end if;
    raise exception 'No tienen el SteamID vinculado: %', array_to_string(sin, ', ') using errcode = 'V3405', detail = to_jsonb(sin)::text;
  end if;
  for x in select p.nick, t2.name as otro
             from unnest(todos) u join players p on p.id = u
             join tournament_registration_players r on r.event_id = p_event and r.player_id = p.id and r.team_id <> p_team
             join teams t2 on t2.id = r.team_id
            order by p.nick limit 1 loop
    raise exception '% ya está inscrito en este torneo con %. Uno de los dos equipos tiene que sacarlo', x.nick, x.otro;
  end loop;
  if p_start_stage is not null and not gestor then raise exception 'La fase de inicio la elige el organizador'; end if;
  insert into tournament_registrations(event_id, team_id, start_stage) values (p_event, p_team, coalesce(p_start_stage, 1))
  on conflict (event_id, team_id) do update set start_stage = coalesce(p_start_stage, tournament_registrations.start_stage);
  delete from tournament_registration_players where event_id = p_event and team_id = p_team and not (player_id = any(todos));
  insert into tournament_registration_players(event_id, team_id, player_id, role)
  select p_event, p_team, u, case when u = any(activos) then 'active' else 'sub' end from unnest(todos) u
  on conflict (event_id, player_id) do update set role = excluded.role
   where tournament_registration_players.role is distinct from excluded.role;
  if not ya and not (p_team = any(e.seeds)) then
    update events set seeds = array_append(seeds, p_team) where id = p_event;
  end if;
end $function$

;

CREATE OR REPLACE FUNCTION public.event_generate(p_event uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e       events%rowtype;
  equipos uuid[];
  x       record;
  need    int;
begin
  if not can_manage_event(p_event) then raise exception 'Solo el organizador del torneo o un admin puede generar el fixture' using errcode = '42501'; end if;
  perform event_engine_on();
  select * into e from events where id = p_event for update;
  if e.status <> 'registration' then raise exception 'El fixture ya está generado'; end if;
  select coalesce(array_agg(r.team_id order by coalesce(array_position(e.seeds, r.team_id), 1000), r.created_at, t.name), '{}') into equipos
    from tournament_registrations r join teams t on t.id = r.team_id where r.event_id = p_event;
  if cardinality(equipos) < greatest(2, coalesce(e.min_teams, 2)) then
    raise exception 'Hacen falta al menos % equipos inscritos (hay %)', greatest(2, coalesce(e.min_teams, 2)), cardinality(equipos);
  end if;
  -- (replanteo 33) los activos del modo completos (alguno pudo salir del plantel después de inscribirse)
  need := (select players_per_team from game_modes where code = e.game_mode);
  for x in select t.name, (select count(*) from tournament_registration_players p where p.event_id = p_event and p.team_id = r.team_id and p.role = 'active') as n
             from tournament_registrations r join teams t on t.id = r.team_id where r.event_id = p_event loop
    if x.n < need then raise exception '% tiene % jugadores activos inscritos (hacen falta %)', x.name, x.n, need; end if;
  end loop;
  update events set status = 'in_progress', tie_pending = null where id = p_event;
  case e.template
    when 'single' then perform event_build_ko(p_event, equipos, 1, e.config);
    when 'double' then perform event_build_double(p_event, equipos, e.config);
    when 'groups' then perform event_build_groups(p_event, equipos, e.config);
    when 'groups_double' then perform event_build_group_double(p_event, equipos, e.config); -- (replanteo 17)
    when 'swiss' then
      need := (e.config->>'size')::int + ((e.config->>'stages')::int - 1) * (e.config->>'size')::int / 2;
      if cardinality(equipos) <> need then
        raise exception 'Este suizo necesita % equipos (% en la fase 1 y % que empiezan en cada fase siguiente); hay %',
          need, (e.config->>'size')::int, (e.config->>'size')::int / 2, cardinality(equipos);
      end if;
      for x in select s as fase, (select count(*) from tournament_registrations where event_id = p_event and start_stage = s) as n
                 from generate_series(1, (e.config->>'stages')::int) s loop
        need := (case when x.fase = 1 then (e.config->>'size')::int else (e.config->>'size')::int / 2 end);
        if x.n <> need then
          raise exception 'La fase % necesita % equipos que empiecen en ella (hay %)', x.fase, need, x.n;
        end if;
      end loop;
      perform event_swiss_phase(p_event, 1);
  end case;
  perform event_progress(p_event);
end $function$

;

CREATE OR REPLACE FUNCTION public.match_start(p_match uuid, p_server uuid, p_wait integer DEFAULT 10)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m matches%rowtype;
  v_id uuid;
begin
  select * into m from matches where id = p_match for update;
  if m.id is null then raise exception 'No existe esa partida'; end if;
  if m.kind <> 'official' or m.event_id is null then raise exception 'Solo se inician así las partidas de un torneo'; end if;
  if not can_manage_event(m.event_id) then raise exception 'Solo el organizador del torneo o un moderador' using errcode = '42501'; end if;
  if m.team1 is null or m.team2 is null then raise exception 'La partida todavía no tiene los dos equipos'; end if;
  if m.status not in ('upcoming', 'live') then raise exception 'La partida ya terminó o fue cancelada'; end if;
  if coalesce(m.bye, false) then raise exception 'Es un pase libre: no se juega'; end if;
  if p_wait is null or p_wait not between 1 and 20 then raise exception 'La espera va de 1 a 20 minutos'; end if;
  if exists (select 1 from match_bookings where match_id = p_match and status not in ('finished', 'abandoned', 'cancelled')) then
    raise exception 'La partida ya está iniciada';
  end if;
  perform server_alloc_lock();
  if not server_is_free(p_server, 'official') then
    raise exception 'Ese servidor ya no está libre: elegí otro o esperá a que se libere' using errcode = 'V5602';
  end if;
  insert into match_bookings (match_id, kind, status, server_id, password, wait_minutes, assigned_at, created_by, map_no)
    values (p_match, 'official', 'veto', p_server, mm_new_password(), p_wait, now(), auth.uid(),
            coalesce(jsonb_array_length(m.maps), 0) + 1)
    returning id into v_id;
  update matches set server_id = p_server, server_ip = (select connect_address from game_servers where id = p_server) where id = p_match;
  -- Con el veto ya hecho pasa directo a "asignada"; si no, arranca el reloj del primer turno.
  perform booking_after_veto(p_match);
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.team_standings_at(p_at timestamp with time zone)
 RETURNS TABLE(team_id uuid, name text, tag text, official_played integer, official_won integer, official_lost integer, pcw_played integer, pcw_won integer, pcw_lost integer, official_points integer, pcw_points integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select t.id, t.name, t.tag,
         count(j.*) filter (where j.tipo = 'official')::int,
         count(j.*) filter (where j.tipo = 'official' and j.gano)::int,
         count(j.*) filter (where j.tipo = 'official' and not j.gano)::int,
         count(j.*) filter (where j.tipo = 'pcw')::int,
         count(j.*) filter (where j.tipo = 'pcw' and j.gano)::int,
         count(j.*) filter (where j.tipo = 'pcw' and not j.gano)::int,
         (count(j.*) filter (where j.tipo = 'official' and j.gano) * c.win_official)::int,
         (count(j.*) filter (where j.tipo = 'pcw' and j.gano) * c.win_pcw)::int
    from teams t
    cross join ranking_config c
    left join team_results j on j.team_id = t.id and coalesce(j.at, '-infinity'::timestamptz) <= p_at
   where t.kind = 'official'
   group by t.id, t.name, t.tag, c.win_official, c.win_pcw
$function$
;

CREATE OR REPLACE FUNCTION public.notification_category(p_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered',
                    'team_dissolved', 'team_staff_action') then 'team' -- (replanteo 70) team_staff_action -- (replanteo 39) team_dissolved
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled', 'event_lineup', 'match_soon',
                    'match_server_ready', 'booking_attention') then 'tournament' -- (replanteo 35) match_soon; (replanteo 56) reservas
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result', 'pcw_soon', 'pcw_expired',
                    'pcw_server_ready', 'pcw_abandoned') then 'pcw' -- (replanteo 35) pcw_soon y pcw_expired; (replanteo 56) reservas
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted', 'season_ending') then 'season' -- (replanteo 35) season_ending
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked', 'vip_expiring',
                    'streamer_granted', 'streamer_revoked') then 'account' -- (replanteo 36) streamer_granted y streamer_revoked
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed',
                    'match_no_result', 'admin_steam_linked') then 'admin' -- (replanteo 35) match_no_result; (replanteo 58) admin_steam_linked
  end $function$

;

CREATE OR REPLACE FUNCTION public.tg_notify_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record;
begin
  if tg_op = 'INSERT' then
    if new.status = 'registration' then
      perform notify(array(select id from profiles), 'event_new', jsonb_build_object('event', event_ref(new.id), 'starts_on', new.starts_on));
    end if;
    return null;
  end if;
  if tg_op = 'DELETE' then
    perform notify(array(select unnest(side_users(team_id, old.id)) from tournament_registrations where event_id = old.id),
                   'event_cancelled', jsonb_build_object('event', jsonb_build_object('id', old.id, 'name', old.name)));
    return old;
  end if;
  if new.status = old.status then return null; end if;
  if new.status = 'in_progress' and old.status = 'registration' then
    -- Fixture listo: cada equipo con su primer rival.
    for r in
      select tr.team_id,
             (select m.id from matches m where m.event_id = new.id and (m.team1 = tr.team_id or m.team2 = tr.team_id) and not coalesce(m.bye, false)
               order by m.round nulls last, m.pos nulls last limit 1) as match_id
        from tournament_registrations tr where tr.event_id = new.id
    loop
      perform notify(side_users(r.team_id, new.id), 'event_fixture',
                     jsonb_build_object('event', event_ref(new.id), 'team', team_ref(r.team_id), 'match_id', r.match_id,
                                        'opponent', (select team_ref(case when m.team1 = r.team_id then m.team2 else m.team1 end)
                                                       from matches m where m.id = r.match_id)));
    end loop;
  elsif new.status = 'cancelled' then
    perform notify(array(select unnest(side_users(team_id, new.id)) from tournament_registrations where event_id = new.id),
                   'event_cancelled', jsonb_build_object('event', event_ref(new.id)));
  elsif new.status = 'finished' then
    for r in select distinct team_id, result from player_titles where event_id = new.id loop
      perform notify(side_users(r.team_id, new.id), 'event_progress',
                     jsonb_build_object('event', event_ref(new.id), 'team', team_ref(r.team_id), 'result', r.result));
    end loop;
  end if;
  return null;
end $function$

;

CREATE OR REPLACE FUNCTION public.tg_notify_registrations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r tournament_registrations%rowtype; v_captain uuid;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  if not exists (select 1 from events where id = r.event_id and status = 'registration') then return null; end if;
  v_captain := (select captain_id from teams where id = r.team_id);
  if v_captain is not distinct from auth.uid() then return null; end if;
  perform notify(array[v_captain], 'event_registration',
                 jsonb_build_object('event', event_ref(r.event_id), 'team', team_ref(r.team_id), 'registered', tg_op = 'INSERT'));
  return null;
end $function$

;

CREATE OR REPLACE FUNCTION public.tg_notify_registration_players()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r tournament_registration_players%rowtype; v_user uuid;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  if tg_op = 'UPDATE' and new.role is not distinct from old.role then return null; end if;
  if not exists (select 1 from events where id = r.event_id and status in ('registration', 'in_progress')) then return null; end if;
  v_user := (select user_id from players where id = r.player_id);
  if v_user is null or v_user is not distinct from (select captain_id from teams where id = r.team_id) then return null; end if;
  perform notify(array[v_user], 'event_lineup',
                 jsonb_build_object('event', event_ref(r.event_id), 'team', team_ref(r.team_id), 'registered', tg_op <> 'DELETE',
                                    'role', case when tg_op = 'DELETE' then null else r.role end));
  return null;
end $function$

;

CREATE OR REPLACE FUNCTION public.tg_notify_matches()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_seq text[];
begin
  if new.kind = 'mix' then
    if tg_op = 'UPDATE' and new.demo_status = 'missing' and old.demo_status is distinct from 'missing' then
      perform notify(notify_admin_ids(), 'admin_demo_failed', jsonb_build_object('match_id', new.id, 'map', new.map));
    end if;
    return null;
  end if;
  if coalesce(new.bye, false) then return null; end if;

  -- Empieza el veto: los dos equipos definidos y la partida por jugar. Le toca al equipo 1.
  if new.status = 'upcoming' and new.team1 is not null and new.team2 is not null
     and (tg_op = 'INSERT' or old.team1 is null or old.team2 is null)
     and not exists (select 1 from match_vetos where match_id = new.id) then
    v_seq := veto_sequence(new.best_of, (select count(*)::int from match_map_pool(new.id)));
    if cardinality(v_seq) > 0 then
      perform notify(array[(select captain_id from teams where id = new.team1)], 'veto_turn',
                     match_ref(new.id) || jsonb_build_object('action', v_seq[1]));
    end if;
  end if;
  if tg_op = 'INSERT' then return null; end if;

  if new.kind = 'official' and new.status = 'upcoming' and new.starts_at is distinct from old.starts_at and new.starts_at is not null
     and new.team1 is not null and new.team2 is not null then
    perform notify(match_users(new.id), 'match_scheduled', match_ref(new.id) || jsonb_build_object('previous', old.starts_at));
  end if;

  if new.status = 'finished' and (old.status is distinct from 'finished' or new.winner is distinct from old.winner
                                  or new.score1 is distinct from old.score1 or new.score2 is distinct from old.score2) then
    perform notify(match_users(new.id), case when new.kind = 'pcw' then 'pcw_result' else 'match_result' end,
                   match_ref(new.id) || jsonb_build_object('score1', new.score1, 'score2', new.score2, 'winner', new.winner,
                                                        'walkover', new.end_reason = 'walkover', 'corrected', old.status = 'finished'));
  end if;
  return null;
end $function$

;

CREATE OR REPLACE FUNCTION public.notify_due()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
  r record;
  p record;
  v_soon int := 0; v_pcw_soon int := 0; v_pcw_expired int := 0; v_season int := 0; v_no_result int := 0; v_vip int := 0;
begin
  -- Partida de torneo o PCW en menos de 1 hora. La ref lleva el horario: si se reprograma, se avisa de nuevo.
  for r in
    with c as (
      select m.id, m.kind, 'match_soon:' || m.id || ':' || extract(epoch from m.starts_at)::bigint as ref
        from matches m
       where m.kind in ('official', 'pcw') and m.status = 'upcoming' and m.parent_match_id is null and m.bye is not true
         and m.team1 is not null and m.team2 is not null
         and m.starts_at > v_now and m.starts_at <= v_now + interval '1 hour')
    insert into notification_sent(kind, ref)
    select case c.kind when 'pcw' then 'pcw_soon' else 'match_soon' end, c.ref from c
    on conflict do nothing
    returning kind, ref
  loop
    perform notify(match_users(split_part(r.ref, ':', 2)::uuid), r.kind, match_ref(split_part(r.ref, ':', 2)::uuid), r.ref);
    if r.kind = 'pcw_soon' then v_pcw_soon := v_pcw_soon + 1; else v_soon := v_soon + 1; end if;
  end loop;

  -- Anuncio de PCW que nadie aceptó y cuyo horario ya pasó: a quien lo publicó.
  for r in
    insert into notification_sent(kind, ref)
    select 'pcw_expired', 'pcw_expired:' || pp.id
      from pcw_posts pp
     where pp.status = 'open' and pp.starts_at <= v_now and pp.starts_at > v_now - interval '7 days'
    on conflict do nothing
    returning ref
  loop
    select pp.* into p from pcw_posts pp where pp.id = split_part(r.ref, ':', 2)::uuid;
    perform notify(array[p.by_user], 'pcw_expired',
                   jsonb_build_object('post_id', p.id, 'starts_at', p.starts_at, 'best_of', p.best_of, 'maps', p.maps),
                   r.ref, true);
    v_pcw_expired := v_pcw_expired + 1;
  end loop;

  -- Temporada que termina en menos de 24 horas: a quien jugó al menos la mitad de los mixes que pide el ranking.
  for r in
    insert into notification_sent(kind, ref)
    select 'season_ending', 'season_ending:' || s.id
      from seasons s
     where s.status = 'active' and s.ends_at > v_now and s.ends_at <= v_now + interval '24 hours'
    on conflict do nothing
    returning ref
  loop
    for p in
      select s.id as season_id, s.number, s.name, s.ends_at, s.min_matches, k.player_id, k.matches,
             case when k.eligible then k.rank end as position
        from seasons s, season_rank(s.starts_at, v_now, s.min_matches) k
       where s.id = split_part(r.ref, ':', 2)::uuid and k.matches >= ceil(s.min_matches / 2.0)
    loop
      perform notify(users_of_players(array[p.player_id]), 'season_ending',
                     jsonb_build_object('season', jsonb_build_object('id', p.season_id, 'number', p.number, 'name', p.name),
                                        'ends_at', p.ends_at, 'position', p.position, 'matches', p.matches,
                                        'min_matches', p.min_matches),
                     r.ref);
      v_season := v_season + 1;
    end loop;
  end loop;

  -- Partida de torneo sin resultado 3 horas después de su horario: al organizador del torneo y a los admins.
  for r in
    insert into notification_sent(kind, ref)
    select 'match_no_result', 'match_no_result:' || m.id || ':' || extract(epoch from m.starts_at)::bigint
      from matches m
     where m.kind = 'official' and m.status in ('upcoming', 'live') and m.parent_match_id is null and m.bye is not true
       and m.team1 is not null and m.team2 is not null
       and m.starts_at <= v_now - interval '3 hours' and m.starts_at > v_now - interval '7 days'
    on conflict do nothing
    returning ref
  loop
    perform notify(notify_admin_ids() || coalesce(
                     (select array_agg(e.organizer_id) from matches m join events e on e.id = m.event_id
                        join profiles pr on pr.id = e.organizer_id and pr.role = 'organizer'
                       where m.id = split_part(r.ref, ':', 2)::uuid), '{}'),
                   'match_no_result', match_ref(split_part(r.ref, ':', 2)::uuid), r.ref);
    v_no_result := v_no_result + 1;
  end loop;

  -- VIP que termina en menos de 3 días, sin revocar y sin otro período que lo continúe. Un lifetime no tiene fin.
  for r in
    insert into notification_sent(kind, ref)
    select 'vip_expiring', 'vip_expiring:' || v.id
      from vip_memberships v
     where v.revoked_at is null and v.ends_at > v_now and v.ends_at <= v_now + interval '3 days'
       and not exists (select 1 from vip_memberships n
                        where n.user_id = v.user_id and n.id <> v.id and n.revoked_at is null
                          and n.starts_at <= v.ends_at and (n.ends_at is null or n.ends_at > v.ends_at))
    on conflict do nothing
    returning ref
  loop
    select v.user_id, v.ends_at into p from vip_memberships v where v.id = split_part(r.ref, ':', 2)::uuid;
    perform notify(array[p.user_id], 'vip_expiring', jsonb_build_object('ends_at', p.ends_at), r.ref, true);
    v_vip := v_vip + 1;
  end loop;

  delete from notification_sent where sent_at < v_now - interval '60 days';

  return jsonb_build_object('match_soon', v_soon, 'pcw_soon', v_pcw_soon, 'pcw_expired', v_pcw_expired,
                            'season_ending', v_season, 'match_no_result', v_no_result, 'vip_expiring', v_vip);
end $function$

;

-- Vistas como estaban con la 78
create or replace view public.live_match_list as
 SELECT l.uid,
    l.server_id,
    l.server_name,
    l.seq,
    l.map,
    l.score_a AS score1,
    l.score_b AS score2,
    l.score_a + l.score_b AS rounds_played,
    l.max_rounds,
    l.started_at,
    l.updated_at,
    l.updated_at < (now() - '00:10:00'::interval) AS stale,
    COALESCE('Equipo '::text || "left"(NULLIF(TRIM(BOTH FROM l.payload #>> '{team_names,a}'::text[]), ''::text), 20), 'Mix de '::text || COALESCE(ta.name, 'A'::text)) AS side1_name,
    COALESCE('Equipo '::text || "left"(NULLIF(TRIM(BOTH FROM l.payload #>> '{team_names,b}'::text[]), ''::text), 20), 'Mix de '::text || COALESCE(tb.name, 'B'::text)) AS side2_name,
    par.id AS parent_match_id,
        CASE
            WHEN par.id IS NULL THEN NULL::integer
            WHEN (l.payload ->> 'link_side_a'::text) = '2'::text THEN 2
            ELSE 1
        END::smallint AS parent_side1,
    search_norm(concat_ws(' '::text, l.payload #>> '{team_names,a}'::text[], l.payload #>> '{team_names,b}'::text[], l.map, l.server_name, ( SELECT string_agg(e.value ->> 'name'::text, ' '::text) AS string_agg
           FROM jsonb_array_elements(l.payload -> 'players'::text) e(value)))) AS search,
    ARRAY( SELECT DISTINCT steam_owner(csstv_steam64(e.value ->> 'steamid'::text)) AS steam_owner
           FROM jsonb_array_elements(l.payload -> 'players'::text) e(value)
          WHERE steam_owner(csstv_steam64(e.value ->> 'steamid'::text)) IS NOT NULL) AS player_ids
   FROM live_matches l
     LEFT JOIN LATERAL ( SELECT "left"(COALESCE(NULLIF(TRIM(BOTH FROM e.value ->> 'name'::text), ''::text), 'A'::text), 17) AS name
           FROM jsonb_array_elements(l.payload -> 'players'::text) e(value)
          WHERE (e.value ->> 'team'::text) = 'a'::text
          ORDER BY (csstv_jint(e.value, 'kills'::text)) DESC
         LIMIT 1) ta ON true
     LEFT JOIN LATERAL ( SELECT "left"(COALESCE(NULLIF(TRIM(BOTH FROM e.value ->> 'name'::text), ''::text), 'B'::text), 17) AS name
           FROM jsonb_array_elements(l.payload -> 'players'::text) e(value)
          WHERE (e.value ->> 'team'::text) = 'b'::text
          ORDER BY (csstv_jint(e.value, 'kills'::text)) DESC
         LIMIT 1) tb ON true
     LEFT JOIN matches par ON NULLIF(TRIM(BOTH FROM l.payload ->> 'link_code'::text), ''::text) IS NOT NULL AND par.link_code = upper(TRIM(BOTH FROM l.payload ->> 'link_code'::text)) AND par.kind <> 'mix'::text AND (par.status = ANY (ARRAY['upcoming'::text, 'live'::text]));

drop view public.event_list;
create view public.event_list with (security_invoker = true) as
 SELECT e.id,
    e.name,
    e.template,
    e.status,
    e.starts_on,
    e.ends_on,
    e.prize,
    e.max_teams,
    e.organizer_id,
    ( SELECT p.nick
           FROM players p
          WHERE p.user_id = e.organizer_id) AS organizer_alias,
    e.champion AS champion_id,
    c.name AS champion_name,
    c.tag AS champion_tag,
    (( SELECT count(*) AS count
           FROM tournament_registrations r
          WHERE r.event_id = e.id))::integer AS teams,
    search_norm(e.name) AS search,
    c.logo_url AS champion_logo_url,
    e.game_mode,
    ( SELECT g.players_per_team
           FROM game_modes g
          WHERE g.code = e.game_mode) AS players_per_team,
    e.subs_max,
    e.banner_url,
    e.registration_closes_at,
        CASE e.template
            WHEN 'groups'::text THEN e.config ->> 'bo_group'::text
            WHEN 'groups_double'::text THEN e.config ->> 'bo_group'::text
            ELSE e.config ->> 'bo'::text
        END::integer AS bo,
        CASE e.template
            WHEN 'single'::text THEN e.config ->> 'bo_final'::text
            WHEN 'double'::text THEN e.config ->> 'bo_grand_final'::text
            ELSE (e.config -> 'playoffs'::text) ->> 'bo_final'::text
        END::integer AS bo_final,
        CASE
            WHEN e.status = ANY (ARRAY['in_progress'::text, 'finished'::text]) THEN (( SELECT count(*) AS count
               FROM matches m
              WHERE m.event_id = e.id AND NOT m.bye AND m.status = 'finished'::text))::integer
            ELSE NULL::integer
        END AS progress_played,
        CASE
            WHEN e.status = ANY (ARRAY['in_progress'::text, 'finished'::text]) THEN (( SELECT count(*) AS count
               FROM matches m
              WHERE m.event_id = e.id AND NOT m.bye AND m.status <> 'cancelled'::text))::integer
            ELSE NULL::integer
        END AS progress_total,
        CASE
            WHEN e.status = 'in_progress'::text THEN ( SELECT ml.id
               FROM match_list ml
              WHERE ml.event_id = e.id AND NOT ml.bye AND (ml.status = ANY (ARRAY['live'::text, 'upcoming'::text])) AND ml.team1_id IS NOT NULL AND ml.team2_id IS NOT NULL
              ORDER BY (ml.status = 'live'::text) DESC, ml.phase, ml.stage_order, ml.round, ml.grp, ml.pos
             LIMIT 1)
            ELSE NULL::uuid
        END AS current_match_id,
        CASE
            WHEN e.status = 'finished'::text THEN ( SELECT max(COALESCE(m.played_at, m.starts_at)) AS max
               FROM matches m
              WHERE m.event_id = e.id AND m.status = 'finished'::text AND NOT m.bye)
            ELSE NULL::timestamp with time zone
        END AS finished_at
   FROM events e
     LEFT JOIN teams c ON c.id = e.champion;

drop function public.match_rankable(uuid);
drop function public.match_map_date(text);
drop function public.event_quiet(uuid);
drop function public.event_visible(uuid);
drop function public.notify_staff_ids();

-- Columnas
alter table public.teams drop constraint teams_kind_check;
alter table public.teams add constraint teams_kind_check check (kind in ('official', 'pcw'));
alter table public.matches drop column parent_approved;
alter table public.events drop constraint events_historic_dates,
  drop column historic, drop column testing, drop column approval, drop column approval_note,
  drop column reviewed_by, drop column reviewed_at;

notify pgrst, 'reload schema';
commit;

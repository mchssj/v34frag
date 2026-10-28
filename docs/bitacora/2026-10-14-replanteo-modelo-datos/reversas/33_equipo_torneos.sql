-- Inversa de supabase/replanteo/33_equipo_torneos.sql: vuelven el tope fijo de 10, las invitaciones sin estado ni
-- mensaje, los torneos con players_min y players_max (5 y 5 + subs_max) y la inscripción sin activos ni suplentes.
-- Se pierden los logos, los banners, lo que busca cada equipo, la fecha de fundación, los modos de juego y los avisos
-- event_lineup. Las funciones y las vistas vuelven a la definición que tenían antes de la 33.
begin;

delete from public.notifications where type = 'event_lineup';
drop trigger notify_registration_players on public.tournament_registration_players;
drop function public.tg_notify_registration_players();
drop function public.team_event_history(uuid);

-- Como en la 32.
CREATE OR REPLACE FUNCTION public.notification_category(p_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered') then 'team'
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled') then 'tournament'
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result') then 'pcw'
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted') then 'season'
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked') then 'account' -- (replanteo 32)
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed') then 'admin'
  end $function$
;


-- Vistas: se borran (create or replace no saca columnas) y se crean como antes de la 33. event_list usa match_list.
drop view public.event_list;
drop view public.match_list;
drop view public.team_ranking;
drop view public.event_registrations_view;
drop view public.team_members_view;
drop view public.team_overview;

create view public.team_overview with (security_invoker = true) as
 SELECT id,
    name,
    tag,
    kind,
    owner_id,
    captain_id,
    parent_team_id,
    ( SELECT p.id
           FROM players p
          WHERE p.user_id = t.captain_id) AS captain_player_id,
    ( SELECT p.nick
           FROM players p
          WHERE p.user_id = t.captain_id) AS captain_nick,
    (( SELECT count(*) AS count
           FROM team_members tm
          WHERE tm.team_id = t.id AND tm.left_at IS NULL))::integer AS members,
    search_norm((name || ' '::text) || COALESCE(tag, ''::text)) AS search
   FROM teams t;
comment on view public.team_overview is 'Listado de equipos con capitán y cantidad de jugadores activos';
grant TRIGGER, INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES on public.team_overview to anon;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.team_overview to authenticated;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.team_overview to postgres;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.team_overview to service_role;

create view public.team_members_view with (security_invoker = true) as
 SELECT tm.team_id,
    t.name AS team_name,
    t.tag AS team_tag,
    t.kind AS team_kind,
    tm.player_id,
    p.nick AS alias,
    p.photo_url,
    p.steam_id IS NOT NULL AS has_steam,
    e.elo,
    tm.role,
    tm.joined_at,
    tm.left_at,
    tm.left_at IS NULL AS active,
    p.user_id IS NOT NULL AND p.user_id = t.captain_id AND tm.left_at IS NULL AS is_captain
   FROM team_members tm
     JOIN players p ON p.id = tm.player_id
     JOIN teams t ON t.id = tm.team_id
     LEFT JOIN player_elo e ON e.steam_id = p.steam_id;

grant TRIGGER, INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES on public.team_members_view to anon;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.team_members_view to authenticated;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.team_members_view to postgres;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.team_members_view to service_role;

create view public.event_registrations_view with (security_invoker = true) as
 SELECT r.event_id,
    r.team_id,
    t.name,
    t.tag,
    r.start_stage,
    r.created_at,
    row_number() OVER (PARTITION BY r.event_id ORDER BY (COALESCE(array_position(e.seeds, r.team_id), 1000)), r.created_at, t.name)::integer AS seed,
    (( SELECT count(*) AS count
           FROM tournament_registration_players p
          WHERE p.event_id = r.event_id AND p.team_id = r.team_id))::integer AS players,
    search_norm((t.name || ' '::text) || COALESCE(t.tag, ''::text)) AS search
   FROM tournament_registrations r
     JOIN teams t ON t.id = r.team_id
     JOIN events e ON e.id = r.event_id;

grant TRIGGER, INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES on public.event_registrations_view to anon;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.event_registrations_view to authenticated;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.event_registrations_view to postgres;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.event_registrations_view to service_role;

create view public.team_ranking with (security_invoker = true) as
 WITH antes AS (
         SELECT a_1.team_id,
                CASE
                    WHEN a_1.official_played > 0 THEN rank() OVER (ORDER BY a_1.official_points DESC, a_1.official_won DESC, a_1.official_lost)
                    ELSE NULL::bigint
                END::integer AS official_position,
                CASE
                    WHEN (a_1.official_played + a_1.pcw_played) > 0 THEN rank() OVER (ORDER BY (a_1.official_points + a_1.pcw_points) DESC, (a_1.official_won + a_1.pcw_won) DESC, (a_1.official_lost + a_1.pcw_lost))
                    ELSE NULL::bigint
                END::integer AS total_position
           FROM team_standings_at(now() - '30 days'::interval) a_1(team_id, name, tag, official_played, official_won, official_lost, pcw_played, pcw_won, pcw_lost, official_points, pcw_points)
        )
 SELECT s.team_id,
    s.name,
    s.tag,
    search_norm((s.name || ' '::text) || COALESCE(s.tag, ''::text)) AS search,
    s.official_played,
    s.official_won,
    s.official_lost,
    s.official_points,
    s.official_played + s.pcw_played AS total_played,
    s.official_won + s.pcw_won AS total_won,
    s.official_lost + s.pcw_lost AS total_lost,
    s.official_points + s.pcw_points AS total_points,
    rank() OVER (ORDER BY s.official_points DESC, s.official_won DESC, s.official_lost)::integer AS official_position,
    rank() OVER (ORDER BY (s.official_points + s.pcw_points) DESC, (s.official_won + s.pcw_won) DESC, (s.official_lost + s.pcw_lost))::integer AS total_position,
    a.official_position AS official_position_prev,
    a.total_position AS total_position_prev,
    ARRAY( SELECT x.r
           FROM ( SELECT
                        CASE
                            WHEN r.gano THEN 'W'::text
                            ELSE 'L'::text
                        END AS r,
                    r.at,
                    r.match_id
                   FROM team_results r
                  WHERE r.team_id = s.team_id AND r.tipo = 'official'::text
                  ORDER BY r.at DESC NULLS LAST, r.match_id DESC
                 LIMIT 5) x
          ORDER BY x.at NULLS FIRST, x.match_id) AS form_official,
    ARRAY( SELECT x.r
           FROM ( SELECT
                        CASE
                            WHEN r.gano THEN 'W'::text
                            ELSE 'L'::text
                        END AS r,
                    r.at,
                    r.match_id
                   FROM team_results r
                  WHERE r.team_id = s.team_id
                  ORDER BY r.at DESC NULLS LAST, r.match_id DESC
                 LIMIT 5) x
          ORDER BY x.at NULLS FIRST, x.match_id) AS form_total
   FROM team_standings s
     LEFT JOIN antes a ON a.team_id = s.team_id;

grant TRIGGER, INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES on public.team_ranking to anon;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.team_ranking to authenticated;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.team_ranking to postgres;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.team_ranking to service_role;

create view public.match_list with (security_invoker = true) as
 SELECT m.id,
    m.kind,
    m.status,
    m.event_id,
    e.name AS event_name,
    m.stage,
    m.phase,
    m.grp,
    m.round,
    m.pos,
    m.bye,
    m.best_of,
    m.map,
    m.starts_at,
    m.played_at,
    COALESCE(m.played_at, m.starts_at) AS at,
    m.score1,
    m.score2,
    m.winner_side,
    m.side1_name,
    m.side2_name,
    m.team1 AS team1_id,
    t1.name AS team1_name,
    t1.tag AS team1_tag,
    m.team2 AS team2_id,
    t2.name AS team2_name,
    t2.tag AS team2_tag,
    m.end_reason,
    m.demo_status,
    m.parent_match_id,
    max(m.round) OVER (PARTITION BY m.event_id, m.stage, m.phase) AS last_round,
        CASE m.stage
            WHEN 'swiss'::text THEN 0
            WHEN 'group'::text THEN 0
            WHEN 'group_upper'::text THEN 0
            WHEN 'group_lower'::text THEN 0
            WHEN 'upper'::text THEN 1
            WHEN 'ko'::text THEN 1
            WHEN 'lower'::text THEN 2
            WHEN 'third'::text THEN 3
            WHEN 'grand'::text THEN 4
            ELSE NULL::integer
        END AS stage_order,
    search_norm(concat_ws(' '::text, t1.name, t1.tag, t2.name, t2.tag, m.side1_name, m.side2_name, e.name)) AS search,
    ARRAY( SELECT DISTINCT s.player_id
           FROM match_player_stats s
          WHERE s.player_id IS NOT NULL AND (s.match_id = m.id OR (s.match_id IN ( SELECT c.id
                   FROM matches c
                  WHERE c.parent_match_id = m.id)))) AS player_ids,
    m.cancel_reason,
        CASE
            WHEN mc.match_id IS NULL THEN NULL::text
            WHEN mc.decision IS NULL THEN 'pending'::text
            ELSE mc.decision
        END AS review,
    mc.max_rounds AS review_max_rounds,
    m.server_id
   FROM matches m
     LEFT JOIN teams t1 ON t1.id = m.team1
     LEFT JOIN teams t2 ON t2.id = m.team2
     LEFT JOIN events e ON e.id = m.event_id
     LEFT JOIN match_crashes mc ON mc.match_id = m.id;
comment on view public.match_list is 'Listado de partidas: nombres, búsqueda, jugadores, última ronda de la etapa y orden de llave';
grant TRIGGER, INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES on public.match_list to anon;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.match_list to authenticated;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.match_list to postgres;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.match_list to service_role;

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
    search_norm(e.name) AS search
   FROM events e
     LEFT JOIN teams c ON c.id = e.champion;

grant TRIGGER, INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES on public.event_list to anon;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.event_list to authenticated;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.event_list to postgres;
grant INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on public.event_list to service_role;

-- Torneos
alter table public.events add column players_min int not null default 5, add column players_max int not null default 7;
update public.events set players_max = 5 + subs_max;
alter table public.events add constraint events_players_check
  check (players_min between 1 and 10 and players_max between players_min and 10);
drop function public.event_register(uuid, uuid, uuid[], uuid[], int);
alter table public.tournament_registration_players drop column role;

-- Equipos e invitaciones
drop function public.team_set_member_role(uuid, uuid, text);
drop function public.team_update(uuid, text[]);
drop function public.team_set_logo(uuid, text);
drop function public.team_invite(uuid, uuid, text, text, text);
drop function public.team_request_join(uuid, text);

-- Funciones como antes de la 33.
CREATE OR REPLACE FUNCTION public.team_members_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t teams%rowtype; pl players%rowtype; x record;
begin
  if new.left_at is not null then return new; end if;
  select * into t from teams where id = new.team_id;
  select * into pl from players where id = new.player_id;
  if t.kind = 'official' then
    if (select count(*) from team_members where team_id = new.team_id and left_at is null and id <> new.id) >= 10 then
      raise exception 'El equipo ya tiene 10 jugadores, el máximo';
    end if;
    if pl.steam_id is null then
      raise exception '% no tiene el SteamID vinculado: hace falta para entrar a un equipo', pl.nick;
    end if;
  end if;
  if t.kind = 'pcw' and t.parent_team_id is not null
     and not exists (select 1 from team_members where team_id = t.parent_team_id and player_id = new.player_id and left_at is null) then
    raise exception '% no es del plantel de %', pl.nick, (select name from teams where id = t.parent_team_id);
  end if;
  -- (replanteo 10) el control de torneos pasa a los inscritos (tournament_registration_players)
  -- Ni en el plantel del rival de una partida pendiente o en vivo.
  select rv.name as equipo into x
    from matches m
    join teams rv on rv.id = case when m.team1 = new.team_id then m.team2 else m.team1 end
   where m.kind <> 'mix' and m.status in ('upcoming', 'live') and new.team_id in (m.team1, m.team2)
     and exists (select 1 from team_members r where r.team_id = rv.id and r.player_id = new.player_id and r.left_at is null)
   limit 1;
  if found then
    raise exception '% está en el plantel de %, rival de este equipo en una partida pendiente', pl.nick, x.equipo;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.team_can_join(p_team uuid, p_player uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t teams%rowtype; pl players%rowtype;
begin
  select * into t from teams where id = p_team;
  if not found then raise exception 'No existe ese equipo'; end if;
  if t.kind <> 'official' then raise exception 'Solo los equipos oficiales tienen plantel con invitaciones'; end if;
  select * into pl from players where id = p_player;
  if pl.steam_id is null then
    raise exception '% no tiene el SteamID vinculado: hace falta para entrar a un equipo', pl.nick;
  end if;
  if exists (select 1 from team_members where team_id = p_team and player_id = p_player and left_at is null) then
    raise exception '% ya está en el equipo', pl.nick;
  end if;
  if (select count(*) from team_members where team_id = p_team and left_at is null) >= 10 then
    raise exception 'El equipo ya tiene 10 jugadores, el máximo';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.team_invite(p_team uuid, p_player uuid DEFAULT NULL::uuid, p_alias text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u uuid; pl players%rowtype; v uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform team_invites_expire();
  if not (is_admin() or exists (select 1 from teams where id = p_team and captain_id = auth.uid())) then
    raise exception 'Solo el capitán o un admin puede invitar jugadores' using errcode = '42501';
  end if;
  if p_player is not null then
    select * into pl from players where id = p_player;
    if not found then raise exception 'No existe ese jugador'; end if;
    if pl.user_id is null then raise exception '% no tiene cuenta en la web: no puede aceptar una invitación', pl.nick; end if;
  else
    select id into u from profiles where lower(trim(tag)) = lower(trim(coalesce(p_alias, '')));
    if u is null then raise exception 'No hay ningún usuario con ese alias'; end if;
    select * into pl from players where user_id = u;
    if not found then raise exception 'Ese usuario no tiene un SteamID vinculado: hace falta para entrar a un equipo'; end if;
  end if;
  perform team_can_join(p_team, pl.id);
  if exists (select 1 from team_invites where team_id = p_team and player_id = pl.id and status = 'open' and kind = 'request') then
    raise exception '% ya pidió entrar al equipo: aceptá su pedido', pl.nick;
  end if;
  if exists (select 1 from team_invites where team_id = p_team and player_id = pl.id and status = 'open') then
    raise exception '% ya tiene una invitación abierta a este equipo', pl.nick;
  end if;
  insert into team_invites(team_id, player_id, kind, created_by) values (p_team, pl.id, 'invite', auth.uid()) returning id into v;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.team_request_join(p_team uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pl players%rowtype; v uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform team_invites_expire();
  select * into pl from players where user_id = auth.uid();
  if not found then raise exception 'Para entrar a un equipo tenés que tener tu SteamID vinculado'; end if;
  if pl.steam_id is null then raise exception 'Para entrar a un equipo tenés que tener tu SteamID vinculado'; end if;
  perform team_can_join(p_team, pl.id);
  if exists (select 1 from team_invites where team_id = p_team and player_id = pl.id and status = 'open' and kind = 'invite') then
    raise exception 'Ya tenés una invitación de este equipo: aceptala';
  end if;
  if exists (select 1 from team_invites where team_id = p_team and player_id = pl.id and status = 'open') then
    raise exception 'Ya pediste entrar a este equipo';
  end if;
  insert into team_invites(team_id, player_id, kind, created_by) values (p_team, pl.id, 'request', auth.uid()) returning id into v;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.team_invite_answer(p_id uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i team_invites%rowtype; puede boolean;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform team_invites_expire();
  select * into i from team_invites where id = p_id for update;
  if not found then raise exception 'No existe esa invitación'; end if;
  if i.kind = 'invite' then
    puede := exists (select 1 from players where id = i.player_id and user_id = auth.uid()) or is_admin();
  else
    puede := exists (select 1 from teams where id = i.team_id and captain_id = auth.uid()) or is_admin();
  end if;
  if not puede then raise exception 'No podés responder esta invitación' using errcode = '42501'; end if;
  if i.status <> 'open' then
    raise exception 'Esta invitación ya no está abierta (%)', case i.status when 'accepted' then 'aceptada' when 'rejected' then 'rechazada'
                                                             when 'cancelled' then 'cancelada' else 'vencida' end;
  end if;
  if coalesce(p_accept, false) then
    perform team_can_join(i.team_id, i.player_id);
    insert into team_members(team_id, player_id, joined_at) values (i.team_id, i.player_id, now());
  end if;
  update team_invites set status = case when p_accept then 'accepted' else 'rejected' end, resolved_at = now(), resolved_by = auth.uid()
   where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.approve_team_request(p_user uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r team_requests%rowtype; pid uuid; tid uuid;
begin
  if not is_admin() then raise exception 'Solo un administrador puede aprobar solicitudes de equipo' using errcode = '42501'; end if;
  select * into r from team_requests where user_id = p_user for update;
  if not found or r.status <> 'pending' then raise exception 'No hay una solicitud pendiente de ese usuario'; end if;
  select id into pid from players where user_id = p_user and steam_id is not null;
  if pid is null then raise exception 'El usuario no tiene el SteamID vinculado: hace falta para crear el equipo'; end if;
  insert into teams(name, tag, owner_id, captain_id, kind) values (r.name, r.tag, p_user, p_user, 'official') returning id into tid;
  insert into team_members(team_id, player_id, joined_at) values (tid, pid, now());
  update team_requests set status = 'approved' where user_id = p_user;
  return tid;
end $function$
;

CREATE OR REPLACE FUNCTION public.events_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    new.organizer_id := coalesce(new.organizer_id, auth.uid());
    new.status := 'registration';
    new.champion := null;
    new.config := event_config(new.template, new.config);
    if auth.uid() is not null and not is_organizer() then
      raise exception 'Solo un organizador o un admin puede crear torneos' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.template, new.config, new.players_min, new.players_max) is distinct from (old.template, old.config, old.players_min, old.players_max) then
    if old.status <> 'registration' then raise exception 'El formato de un torneo ya generado no se puede cambiar (reinicialo primero)'; end if;
    new.config := event_config(new.template, new.config);
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

CREATE OR REPLACE FUNCTION public.event_register(p_event uuid, p_team uuid, p_players uuid[], p_start_stage integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e       events%rowtype;
  t       teams%rowtype;
  gestor  boolean;
  ya      boolean;
  x       record;
  n       int := coalesce(cardinality(p_players), 0);
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
  if not ya and e.max_teams is not null and (select count(*) from tournament_registrations where event_id = p_event) >= e.max_teams then
    raise exception 'El torneo ya tiene el cupo completo (% equipos)', e.max_teams;
  end if;
  if n <> (select count(distinct y) from unnest(p_players) y) then raise exception 'Hay jugadores repetidos'; end if;
  if n < e.players_min or n > e.players_max then
    raise exception 'Cada equipo inscribe entre % y % jugadores', e.players_min, e.players_max;
  end if;
  for x in select p.id, p.nick, p.steam_id,
                  exists (select 1 from team_members tm where tm.team_id = p_team and tm.player_id = p.id and tm.left_at is null) as miembro,
                  (select t2.name from tournament_registration_players r join teams t2 on t2.id = r.team_id
                    where r.event_id = p_event and r.player_id = p.id and r.team_id <> p_team) as otro
             from unnest(p_players) u join players p on p.id = u loop
    if not x.miembro then raise exception '% no está en el plantel del equipo', x.nick; end if;
    if x.steam_id is null then raise exception '% no tiene el SteamID vinculado', x.nick; end if;
    if x.otro is not null then
      raise exception '% ya está inscrito en este torneo con %. Uno de los dos equipos tiene que sacarlo', x.nick, x.otro;
    end if;
  end loop;
  if (select count(*) from players where id = any(p_players)) <> n then raise exception 'Algún jugador no existe'; end if;
  if p_start_stage is not null and not gestor then raise exception 'La fase de inicio la elige el organizador'; end if;
  insert into tournament_registrations(event_id, team_id, start_stage) values (p_event, p_team, coalesce(p_start_stage, 1))
  on conflict (event_id, team_id) do update set start_stage = coalesce(p_start_stage, tournament_registrations.start_stage);
  delete from tournament_registration_players where event_id = p_event and team_id = p_team;
  insert into tournament_registration_players(event_id, team_id, player_id) select p_event, p_team, u from unnest(p_players) u;
  if not ya and not (p_team = any(e.seeds)) then
    update events set seeds = array_append(seeds, p_team) where id = p_event;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.event_unregister(p_event uuid, p_team uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e events%rowtype;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into e from events where id = p_event for update;
  if not found then raise exception 'No existe ese torneo'; end if;
  if not can_manage_event(p_event) and not exists (select 1 from teams where id = p_team and captain_id = auth.uid()) then
    raise exception 'Solo el capitán del equipo o el organizador puede darlo de baja' using errcode = '42501';
  end if;
  if e.status <> 'registration' then raise exception 'El fixture ya está generado: el equipo no se puede dar de baja'; end if;
  delete from tournament_registrations where event_id = p_event and team_id = p_team;
  if not found then raise exception 'Ese equipo no está inscrito'; end if;
  delete from tournament_registration_players where event_id = p_event and team_id = p_team;
  update events set seeds = array_remove(seeds, p_team) where id = p_event;
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
  for x in select t.name, (select count(*) from tournament_registration_players p where p.event_id = p_event and p.team_id = r.team_id) as n
             from tournament_registrations r join teams t on t.id = r.team_id where r.event_id = p_event loop
    if x.n < e.players_min then raise exception '% tiene % jugadores inscritos (mínimo %)', x.name, x.n, e.players_min; end if;
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

CREATE OR REPLACE FUNCTION public.csstv_match_lookup(p_token text, p_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m      record;
  limpio text;
  linea  text := E'\n';
begin
  begin
    perform csstv_auth(p_token);
  exception when others then
    return 'ok=0' || linea || 'error=' || sqlerrm;
  end;
  select x.id, x.kind, x.status, x.best_of, x.score1, x.score2, x.stage, x.link_code, x.team1, x.team2, e.players_min, -- (replanteo 10) inscritos y mínimo del torneo
        
         t1.name n1, t2.name n2, e.name torneo
    into m
    from matches x
    left join teams t1 on t1.id = x.team1
    left join teams t2 on t2.id = x.team2
    left join events e on e.id = x.event_id
   where x.link_code = upper(trim(coalesce(p_code, ''))) and x.kind <> 'mix';
  if not found then
    return 'ok=0' || linea || 'error=No hay ninguna partida con ese código';
  end if;
  if m.status not in ('upcoming', 'live') then
    return 'ok=0' || linea || 'error=Esa partida ya terminó o fue cancelada';
  end if;
  if m.n1 is null or m.n2 is null then
    return 'ok=0' || linea || 'error=La partida todavía no tiene los dos equipos';
  end if;
  return concat_ws(linea,
    'ok=1',
    'kind=' || m.kind,
    'title=' || translate(
       case when m.kind = 'pcw' then 'PCW: ' || m.n1 || ' vs ' || m.n2
            else coalesce(m.torneo || ' · ', '') || coalesce(nullif(m.stage, '') || ': ', '') || m.n1 || ' vs ' || m.n2 end,
       E'\r\n', '  '),
    'best_of=' || coalesce(m.best_of, 1),
    'score1=' || coalesce(m.score1, 0),
    'score2=' || coalesce(m.score2, 0),
    'team1=' || translate(m.n1, E'\r\n', '  '),
    'team2=' || translate(m.n2, E'\r\n', '  '),
    't1=' || coalesce((select string_agg(public.csstv_steam2(x.steam_id), ',' order by x.steam_id) from match_roster(m.id, m.team1) r join player_steam_all x on x.player_id = r /* (replanteo 15) todos sus SteamID */), ''),
    't2=' || coalesce((select string_agg(public.csstv_steam2(x.steam_id), ',' order by x.steam_id) from match_roster(m.id, m.team2) r join player_steam_all x on x.player_id = r), ''),
    'max_standins=' || case when m.kind = 'pcw' then 2 else 0 end,
    'min_roster=' || case when m.kind = 'pcw' then 3 else coalesce(m.players_min, 5) end,
    'code=' || m.link_code);
end $function$
;

CREATE OR REPLACE FUNCTION public.team_ref(p_team uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('id', id, 'name', name, 'tag', tag) from teams where id = p_team $function$
;

revoke all on function public.event_register(uuid, uuid, uuid[], int) from public, anon;
grant execute on function public.event_register(uuid, uuid, uuid[], int) to authenticated;
revoke all on function public.team_invite(uuid, uuid, text) from public, anon;
revoke all on function public.team_request_join(uuid) from public, anon;
grant execute on function public.team_invite(uuid, uuid, text) to authenticated;
grant execute on function public.team_request_join(uuid) to authenticated;

alter table public.events drop column game_mode, drop column subs_max, drop column banner_url, drop column registration_closes_at;
drop function public.set_game_mode_active(text, boolean);
drop table public.game_modes;

drop policy "photos: capitán sube el logo" on storage.objects;
drop policy "photos: capitán borra el logo" on storage.objects;
drop policy "photos: logo de la solicitud" on storage.objects;
drop policy "photos: borrar logo de la solicitud" on storage.objects;
drop policy "photos: organizador sube el banner" on storage.objects;
drop policy "photos: organizador borra el banner" on storage.objects;

alter table public.teams drop column logo_url, drop column looking_for, drop column founded_at;
alter table public.team_requests drop column logo_url;
alter table public.team_invites drop column role, drop column message;

drop function public.set_team_config(int);
drop function public.team_max_members();
drop table public.team_config;

commit;

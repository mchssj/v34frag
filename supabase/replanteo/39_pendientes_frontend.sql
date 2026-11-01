-- Replanteo 39: pendientes de la API para el frontend (plan docs/bitacora/2026-10-30-api-pendientes-frontend).
--   1. Solicitud de equipo nuevo: fecha de envío, motivo del rechazo y cancelarla (E9).
--   2. Disolver un equipo: queda archivado con su historial; nadie entra, se invita ni se inscribe (E10).
--   3. Nombre y sigla del equipo editables por el capitán, una vez cada 30 días (E11).
--   4. Biografía editable por el jugador (E12).
--   5. Vistas: team_overview y team_ranking con los disueltos, match_list con los nicks (E18) y
--      player_season_list con el cierre y los jugadores con puesto (E20).
-- Errores con SQLSTATE propio V3901 (la API lo da como 409 CONFLICT; el detail, si viene, es un objeto JSON).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.admin_player_ips(uuid)') is null then
    raise exception 'replanteo 39: falta el replanteo 38 (aplicar antes 38_ips_jugadores.sql)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'teams' and column_name = 'dissolved_at') then
    raise exception 'replanteo 39: teams ya tiene dissolved_at (¿ya se aplicó?)';
  end if;
end $$;

-- Cambia textos dentro de la definición de una vista y la vuelve a crear (con create or replace: no saca columnas).
create function pg_temp.vista_reemplazar(v regclass, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_viewdef(v, true); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 39: en % no se encontró: %', v, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute format('create or replace view %s with (security_invoker = true) as %s', v, d);
end $$;

-- Suma columnas al final de una vista (como en la 33). Busca el FROM de primer nivel.
create function pg_temp.sumar_columnas(v regclass, cols text) returns void language plpgsql as $$
declare d text := pg_get_viewdef(v, true); marca text := E'\n   FROM '; n int;
begin
  n := (length(d) - length(replace(d, marca, ''))) / length(marca);
  if n <> 1 then raise exception 'replanteo 39: la vista % tiene % FROM de primer nivel', v, n; end if;
  execute format('create or replace view %s with (security_invoker = true) as %s', v,
                 replace(d, marca, E',\n    ' || cols || marca));
end $$;

-- =====================================================================================================
-- 1. Solicitud de equipo nuevo (E9)
-- =====================================================================================================
alter table public.team_requests
  add column created_at timestamptz,
  add column reject_reason text constraint team_requests_reject_reason_largo check (char_length(reject_reason) <= 300);
comment on column public.team_requests.created_at is 'Cuándo se envió (o se volvió a enviar). null en las anteriores al replanteo 39';
comment on column public.team_requests.reject_reason is 'Motivo del rechazo que escribió el admin (opcional). Se borra al volver a enviarla';

-- Enviarla (o volver a enviarla) renueva la fecha y borra el motivo de un rechazo anterior.
create function public.team_requests_fechas() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.status = 'pending' then
    new.created_at := now();
    new.reject_reason := null;
  end if;
  return new;
end $$;
create trigger team_requests_fechas before insert or update on public.team_requests
  for each row execute function public.team_requests_fechas();

-- Cancelar la propia solicitud pendiente. Devuelve el logo que tenía, para que la API lo borre del bucket.
create function public.cancel_team_request() returns text
  language plpgsql security definer set search_path = public as $$
declare r team_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into r from team_requests where user_id = auth.uid() for update;
  if not found then raise exception 'No tenés una solicitud de equipo' using errcode = 'P0002'; end if;
  if r.status <> 'pending' then
    raise exception 'La solicitud ya fue %: no se puede cancelar', case r.status when 'approved' then 'aprobada' else 'rechazada' end
      using errcode = 'V3901';
  end if;
  delete from team_requests where user_id = auth.uid();
  return r.logo_url;
end $$;
revoke all on function public.cancel_team_request() from public, anon;
grant execute on function public.cancel_team_request() to authenticated;

-- Rechazar con un motivo opcional (firma nueva: la de un argumento se va).
drop function public.reject_team_request(uuid);
create function public.reject_team_request(p_user uuid, p_reason text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not is_admin() then raise exception 'Solo un administrador puede rechazar solicitudes de equipo' using errcode = '42501'; end if;
  if char_length(v_reason) > 300 then raise exception 'El motivo tiene hasta 300 caracteres'; end if;
  update team_requests set status = 'rejected', reject_reason = v_reason where user_id = p_user and status = 'pending';
  if not found then raise exception 'No hay una solicitud pendiente de ese usuario'; end if;
end $$;
revoke all on function public.reject_team_request(uuid, text) from public, anon;
grant execute on function public.reject_team_request(uuid, text) to authenticated;

-- =====================================================================================================
-- 2. Disolver un equipo (E10) y 3. nombre y sigla (E11)
-- =====================================================================================================
alter table public.teams
  add column dissolved_at timestamptz,
  add column dissolved_by uuid,
  add column name_changed_at timestamptz;
comment on column public.teams.dissolved_at is 'Equipo disuelto (archivado): conserva partidas y títulos, pero no sale en los listados ni en el ranking';
comment on column public.teams.dissolved_by is 'Quién lo disolvió (capitán o admin)';
comment on column public.teams.name_changed_at is 'Último cambio de nombre o sigla hecho por el capitán (espera de 30 días; el admin no la cuenta)';

-- Aviso a los que estaban en el plantel.
create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered',
                    'team_dissolved') then 'team' -- (replanteo 39) team_dissolved
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled', 'event_lineup', 'match_soon') then 'tournament' -- (replanteo 35) match_soon
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result', 'pcw_soon', 'pcw_expired') then 'pcw' -- (replanteo 35) pcw_soon y pcw_expired
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted', 'season_ending') then 'season' -- (replanteo 35) season_ending
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked', 'vip_expiring',
                    'streamer_granted', 'streamer_revoked') then 'account' -- (replanteo 36) streamer_granted y streamer_revoked
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed',
                    'match_no_result') then 'admin' -- (replanteo 35) match_no_result
  end $$;

-- Un equipo disuelto no suma jugadores, invitaciones ni inscripciones.
create function public.team_not_dissolved() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from teams where id = new.team_id and dissolved_at is not null) then
    raise exception 'El equipo está disuelto' using errcode = 'V3901';
  end if;
  return new;
end $$;
create trigger team_members_disuelto before insert on public.team_members
  for each row execute function public.team_not_dissolved();
create trigger team_invites_disuelto before insert on public.team_invites
  for each row execute function public.team_not_dissolved();
create trigger tournament_registrations_disuelto before insert on public.tournament_registrations
  for each row execute function public.team_not_dissolved();

create function public.team_dissolve(p_team uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare t teams%rowtype; v_users uuid[]; v_event text;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into t from teams where id = p_team and kind = 'official' for update;
  if not found then raise exception 'No existe ese equipo' using errcode = 'P0002'; end if;
  if not (is_admin() or t.captain_id = auth.uid()) then
    raise exception 'Solo el capitán o un admin puede disolver el equipo' using errcode = '42501';
  end if;
  if t.dissolved_at is not null then raise exception 'El equipo ya está disuelto' using errcode = 'V3901'; end if;
  select e.name into v_event
    from tournament_registrations r join events e on e.id = r.event_id
   where r.team_id = p_team and e.status in ('registration', 'in_progress')
   order by e.name limit 1;
  if v_event is not null then
    raise exception 'El equipo está inscrito en %: primero hay que darlo de baja del torneo', v_event using errcode = 'V3901';
  end if;
  v_users := team_roster_users(p_team);
  -- Las bajas no mandan "te sacaron del equipo": el aviso es uno solo, team_dissolved.
  perform set_config('v34.team_deleting', p_team::text, true);
  update team_invites set status = 'cancelled', resolved_at = now(), resolved_by = auth.uid() where team_id = p_team and status = 'open';
  update team_members set left_at = now() where team_id = p_team and left_at is null;
  perform set_config('v34.team_deleting', '', true);
  update teams set dissolved_at = now(), dissolved_by = auth.uid() where id = p_team;
  perform notify(v_users, 'team_dissolved', jsonb_build_object('team', team_ref(p_team)));
end $$;
revoke all on function public.team_dissolve(uuid) from public, anon;
grant execute on function public.team_dissolve(uuid) to authenticated;

-- Como en la 33, sin dejar editar un equipo disuelto.
create or replace function public.team_update(p_team uuid, p_looking_for text[]) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not (is_admin() or exists (select 1 from teams where id = p_team and captain_id = auth.uid() and kind = 'official')) then
    raise exception 'Solo el capitán o un admin puede editar el equipo' using errcode = '42501';
  end if;
  -- (replanteo 39)
  if exists (select 1 from teams where id = p_team and dissolved_at is not null) then
    raise exception 'El equipo está disuelto' using errcode = 'V3901';
  end if;
  if not coalesce(p_looking_for, '{}') <@ array['player', 'sub', 'coach'] then
    raise exception 'Lo que busca el equipo tiene que ser player, sub o coach';
  end if;
  update teams set looking_for = array(select distinct x from unnest(coalesce(p_looking_for, '{}')) x order by 1) where id = p_team;
end $$;

-- Nombre y sigla (E11). Las palabras bloqueadas las frena teams_rules (el admin pasa).
create function public.team_rename(p_team uuid, p_name text, p_tag text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  t      teams%rowtype;
  adm    boolean := is_admin();
  v_name text := btrim(coalesce(p_name, ''));
  v_tag  text := nullif(upper(btrim(coalesce(p_tag, ''))), '');
  v_next timestamptz;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into t from teams where id = p_team and kind = 'official' for update;
  if not found then raise exception 'No existe ese equipo' using errcode = 'P0002'; end if;
  if not (adm or t.captain_id = auth.uid()) then
    raise exception 'Solo el capitán o un admin puede cambiar el nombre' using errcode = '42501';
  end if;
  if t.dissolved_at is not null then raise exception 'El equipo está disuelto' using errcode = 'V3901'; end if;
  if v_name = t.name and v_tag is not distinct from t.tag then return; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'El nombre tiene que tener entre 2 y 40 caracteres'; end if;
  -- Sin sigla solo si ya no tenía (equipos viejos creados por un admin).
  if (v_tag is null and t.tag is not null) or char_length(v_tag) > 6 then
    raise exception 'La sigla tiene que tener entre 1 y 6 caracteres';
  end if;
  if not adm and t.name_changed_at > now() - interval '30 days' then
    v_next := t.name_changed_at + interval '30 days';
    raise exception 'El nombre y la sigla se cambian una vez cada 30 días'
      using errcode = 'V3901', detail = jsonb_build_object('next_change_at', v_next)::text;
  end if;
  if exists (select 1 from tournament_registrations r join events e on e.id = r.event_id
              where r.team_id = p_team and e.status = 'in_progress') then
    raise exception 'El equipo está jugando un torneo: el nombre se puede cambiar cuando termine' using errcode = 'V3901';
  end if;
  if lower(v_name) <> lower(t.name) and exists (
       select 1 from teams where id <> p_team and kind = 'official' and dissolved_at is null and lower(btrim(name)) = lower(v_name)) then
    raise exception 'Ya hay un equipo con ese nombre' using errcode = 'V3901';
  end if;
  if v_tag is distinct from t.tag and exists (
       select 1 from teams where id <> p_team and kind = 'official' and dissolved_at is null and upper(btrim(tag)) = v_tag) then
    raise exception 'Ya hay un equipo con esa sigla' using errcode = 'V3901';
  end if;
  update teams set name = v_name, tag = v_tag, name_changed_at = case when adm then name_changed_at else now() end where id = p_team;
end $$;
revoke all on function public.team_rename(uuid, text, text) from public, anon;
grant execute on function public.team_rename(uuid, text, text) to authenticated;

-- =====================================================================================================
-- 4. Biografía (E12)
-- =====================================================================================================
-- Hasta 500 caracteres (como el admin), con saltos de línea. Vacía o null la borra. Las palabras bloqueadas se buscan
-- palabra por palabra: name_blocked sobre el texto entero junta las palabras y daría falsos positivos.
create function public.set_my_bio(p_bio text) returns text
  language plpgsql security definer set search_path = public as $$
declare v text := nullif(btrim(replace(coalesce(p_bio, ''), E'\r\n', E'\n')), '');
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not exists (select 1 from players where user_id = auth.uid()) then
    raise exception 'Tu cuenta no tiene un jugador vinculado: la biografía va en la ficha del jugador' using errcode = 'V3901';
  end if;
  if char_length(v) > 500 then raise exception 'La biografía tiene hasta 500 caracteres'; end if;
  if v ~ '[\x01-\x09\x0b-\x1f\x7f]' then raise exception 'La biografía tiene caracteres no permitidos'; end if;
  if exists (select 1 from regexp_split_to_table(v, '\s+') w where w <> '' and name_blocked(w) is not null) then
    raise exception 'La biografía tiene una palabra no permitida';
  end if;
  update players set bio = v where user_id = auth.uid();
  return v;
end $$;
revoke all on function public.set_my_bio(text) from public, anon;
grant execute on function public.set_my_bio(text) to authenticated;

-- =====================================================================================================
-- 5. Vistas
-- =====================================================================================================
-- Listado de equipos: si está disuelto y cuándo cambió el nombre.
select pg_temp.sumar_columnas('public.team_overview', 't.dissolved_at, t.name_changed_at');

-- Ranking sin los disueltos, ni ahora ni hace 30 días (las posiciones se calculan sin ellos).
select pg_temp.vista_reemplazar('public.team_ranking', array[
  ['official_points, pcw_points)',
   'official_points, pcw_points)
          WHERE (( SELECT td.dissolved_at FROM teams td WHERE td.id = a_1.team_id)) IS NULL'],
  ['LEFT JOIN antes a ON a.team_id = s.team_id;',
   'LEFT JOIN antes a ON a.team_id = s.team_id
  WHERE (( SELECT td.dissolved_at FROM teams td WHERE td.id = s.team_id)) IS NULL;']
]);

-- Partidas: alias y nombre en el juego de los que jugaron (también en los mapas de una serie), para buscar por nick (E18).
-- Dos subconsultas que usan índices: la de la partida y, solo en torneo y PCW, la de sus mapas (parent_match_id).
create index matches_parent_match on public.matches (parent_match_id) where parent_match_id is not null;
select pg_temp.sumar_columnas('public.match_list', $c$search_norm(concat_ws(' ',
      ( SELECT string_agg((s.nick || ' ') || COALESCE(p.nick, ''), ' ')
           FROM match_player_stats s LEFT JOIN players p ON p.id = s.player_id
          WHERE s.match_id = m.id),
      CASE WHEN m.kind <> 'mix' THEN ( SELECT string_agg((s.nick || ' ') || COALESCE(p.nick, ''), ' ')
           FROM matches c JOIN match_player_stats s ON s.match_id = c.id LEFT JOIN players p ON p.id = s.player_id
          WHERE c.parent_match_id = m.id) END)) AS player_search$c$);

-- Temporadas de un jugador: cuándo cerró y cuántos jugadores tuvieron puesto (E20).
select pg_temp.sumar_columnas('public.player_season_list', $c$s.closed_at AS ended_at,
    ( SELECT count(*)::integer FROM season_standings x WHERE x.season_id = s.id AND x.rank IS NOT NULL) AS players$c$);

notify pgrst, 'reload schema';

commit;

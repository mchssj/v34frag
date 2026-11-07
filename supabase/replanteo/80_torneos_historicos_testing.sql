-- 80: torneos históricos, aprobación de lo que hace un organizador y torneos en fase de testing
-- (bitácora docs/bitacora/2026-11-06-torneos-historicos-y-testing, Daniel 2026-11-06).
--
--   1. events.historic (se elige al crear), events.testing (solo admins y moderadores) y la aprobación
--      (events.approval pending/approved/rejected, approval_note, reviewed_by, reviewed_at). Lo que crea un organizador
--      nace pendiente; lo de un admin o moderador, aprobado. event_review y event_resubmit.
--   2. Visibilidad en la base: event_visible() y RLS en events, matches (de torneo), tournament_registrations,
--      tournament_registration_players y event_stage_teams. Un torneo en testing lo ven y gestionan solo admins y
--      moderadores; uno pendiente o rechazado, además su organizador. event_ref y live_match_list lo respetan.
--   3. Mix vinculado por aprobar: matches.parent_approved. Lo que vincula un organizador queda en false; lo de un admin,
--      un moderador o el plugin, en true. match_review_game aprueba o rechaza (el rechazo deja el marcador a mano).
--   4. Torneo histórico: equipos 'historic' (teams.kind), inscripción sin plantel ni SteamID y con 0 a 10 jugadores
--      (event_register, event_create_historic_team, historic_team_similar, historic_team_update, historic_team_set_logo), fixture sin el mínimo de activos,
--      sin partidas en el servidor, candidatos sin los 14 días con filtros y paginado (match_game_candidates), y fecha
--      en cada mapa a mano (match_set_maps, matches_played_at) y en el W.O. (match_set_played_at).
--   5. Ranking: match_rankable(). Nunca suman los torneos en testing, pendientes o rechazados; en un histórico, solo la
--      serie con todos sus mapas con un mix aprobado. team_standings_at lo usa.
--   6. Avisos: ninguno de un torneo histórico, en testing, pendiente o rechazado; event_new cuando un torneo se hace
--      público; avisos nuevos admin_event_review, admin_game_review, event_reviewed y game_reviewed.
--   7. event_list suma historic, testing, approval, approval_note y pending_games.
-- Necesita la 78. Va después de la 79 (medallas), sin depender de ella. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/80_torneos_historicos_testing.sql.
begin;

do $$
begin
  if to_regprocedure('public.mm_game_room(uuid)') is null then
    raise exception 'replanteo 80: falta la 78 (mm_game_room)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = 'historic') then
    raise exception 'replanteo 80: ya se aplicó (events.historic existe)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 80: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Suma columnas al final de una vista security_invoker. Busca el FROM de primer nivel.
create or replace function pg_temp.sumar_columnas(v regclass, cols text) returns void language plpgsql as $$
declare d text := pg_get_viewdef(v, true); marca text := E'\n   FROM '; n int;
begin
  n := (length(d) - length(replace(d, marca, ''))) / length(marca);
  if n <> 1 then raise exception 'replanteo 80: la vista % tiene % FROM de primer nivel', v, n; end if;
  execute format('create or replace view %s with (security_invoker = true) as %s', v,
                 replace(d, marca, E',\n    ' || cols || marca));
end $$;

-- =====================================================================================================
-- 1. Columnas
-- =====================================================================================================
alter table public.events
  add column historic boolean not null default false,
  add column testing boolean not null default false,
  add column approval text not null default 'approved' constraint events_approval_check check (approval in ('pending', 'approved', 'rejected')),
  add column approval_note text constraint events_approval_note_len check (char_length(approval_note) <= 500),
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz,
  add constraint events_historic_dates check (not historic or (starts_on is not null and ends_on is not null and ends_on >= starts_on));
comment on column public.events.historic is 'Torneo histórico: el registro de un torneo ya jugado. Se elige al crear (replanteo 80)';
comment on column public.events.testing is 'En fase de testing: solo lo ven y gestionan admins y moderadores; no suma al ranking ni avisa (replanteo 80)';
comment on column public.events.approval is 'pending: lo creó un organizador y espera a un admin o moderador; approved; rejected (con approval_note). Replanteo 80';

alter table public.matches add column parent_approved boolean;
comment on column public.matches.parent_approved is 'Mix vinculado a una partida de torneo: false si lo vinculó un organizador y espera aprobación; true aprobado; null sin vincular (replanteo 80)';
update public.matches set parent_approved = true where parent_match_id is not null;

alter table public.teams drop constraint teams_kind_check;
alter table public.teams add constraint teams_kind_check check (kind in ('official', 'pcw', 'historic'));

-- Al vincular un mix sin decir si está aprobado (el plugin con !match, un mix interrumpido aprobado), queda aprobado;
-- al desvincularlo, sin marca.
create function public.matches_parent_approved() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.parent_match_id is null then
    new.parent_approved := null;
  elsif new.parent_approved is null then
    new.parent_approved := true;
  end if;
  return new;
end $$;
create trigger matches_parent_approved before insert or update of parent_match_id, parent_approved on public.matches
  for each row execute function public.matches_parent_approved();

-- =====================================================================================================
-- 2. Quién ve y quién gestiona
-- =====================================================================================================
-- Admins y moderadores (los que aprueban y reciben los avisos de revisión).
create function public.notify_staff_ids() returns uuid[]
  language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from profiles where role in ('admin', 'moderator') $$;
revoke all on function public.notify_staff_ids() from public, anon, authenticated;

-- Un torneo visible para quien mira: admin o moderador siempre; si no, que no esté en testing y que esté aprobado o
-- sea suyo.
create function public.event_visible(p_event uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_moderator() or exists (
    select 1 from events e where e.id = p_event and not e.testing and (e.approval = 'approved' or e.organizer_id = auth.uid())) $$;
grant execute on function public.event_visible(uuid) to anon, authenticated;

-- Un torneo que no avisa a nadie (salvo los avisos de revisión): histórico, en testing, pendiente o rechazado.
create function public.event_quiet(p_event uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select historic or testing or approval <> 'approved' from events where id = p_event), false) $$;
revoke all on function public.event_quiet(uuid) from public, anon, authenticated;

-- El organizador no gestiona ni cancela un torneo en testing, aunque sea suyo.
create or replace function public.can_manage_event(p_event uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_moderator() or exists (
    select 1 from events e join profiles p on p.id = e.organizer_id
     where e.id = p_event and e.organizer_id = auth.uid() and p.role = 'organizer' and not e.testing)   -- (replanteo 80) testing
$$;
create or replace function public.can_own_event(p_event uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from events e join profiles p on p.id = e.organizer_id
     where e.id = p_event and e.organizer_id = auth.uid() and p.role = 'organizer' and not e.testing)   -- (replanteo 80) testing
$$;

drop policy "torneos: todos ven" on public.events;
create policy "torneos: ver" on public.events for select
  using (is_moderator() or (not testing and (approval = 'approved' or organizer_id = auth.uid())));
drop policy "torneos: crear" on public.events;
create policy "torneos: crear" on public.events for insert to authenticated
  with check ((is_organizer() or (historic and is_moderator())) and (organizer_id = auth.uid() or is_admin()));

drop policy "partidas: todos ven" on public.matches;
create policy "partidas: ver" on public.matches for select using (event_id is null or event_visible(event_id));
drop policy "inscripciones: todos ven" on public.tournament_registrations;
create policy "inscripciones: ver" on public.tournament_registrations for select using (event_visible(event_id));
drop policy trp_ver on public.tournament_registration_players;
create policy trp_ver on public.tournament_registration_players for select to anon, authenticated using (event_visible(event_id));
drop policy event_stage_teams_ver on public.event_stage_teams;
create policy event_stage_teams_ver on public.event_stage_teams for select to anon, authenticated using (event_visible(event_id));

-- El nombre del torneo en un aviso o en una referencia: nada si quien mira no lo puede ver.
create or replace function public.event_ref(p_event uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', name) from events where id = p_event and event_visible(p_event) $$;

-- Lo en vivo: el mix de una partida de un torneo que quien mira no puede ver, no aparece.
do $$
declare d text := pg_get_viewdef('public.live_match_list'::regclass, true);
begin
  if right(d, 1) <> ';' or position(E'\n  WHERE ' in d) > 0 then raise exception 'replanteo 80: live_match_list cambió de forma'; end if;
  execute 'create or replace view public.live_match_list as ' || left(d, length(d) - 1) || E'\n  WHERE NOT (EXISTS ( SELECT 1 FROM matches h'
    || ' WHERE NULLIF(TRIM(BOTH FROM l.payload ->> ''link_code''::text), ''''::text) IS NOT NULL'
    || ' AND h.link_code = upper(TRIM(BOTH FROM l.payload ->> ''link_code''::text)) AND h.event_id IS NOT NULL'
    || ' AND NOT event_visible(h.event_id)));';
end $$;

-- =====================================================================================================
-- 3. Crear y cambiar un torneo
-- =====================================================================================================
select pg_temp.reemplazar('public.events_guard()', array[
  ['    if auth.uid() is not null and not is_organizer() then',
   E'    -- (replanteo 80) un moderador crea solo históricos; testing solo admin o moderador; lo de un organizador nace pendiente\n'
   || E'    if auth.uid() is not null and not is_organizer() and not (new.historic and is_moderator()) then'],
  ['    return new;
  end if;
  if (new.template, new.config, new.game_mode, new.subs_max)',
   E'    if new.testing and auth.uid() is not null and not is_moderator() then\n'
   || E'      raise exception ''Solo un admin o un moderador puede marcar un torneo en fase de testing'' using errcode = ''42501'';\n'
   || E'    end if;\n'
   || E'    if new.historic and (new.starts_on is null or new.ends_on is null) then\n'
   || E'      raise exception ''Un torneo histórico necesita la fecha en que empezó y la fecha en que terminó'';\n'
   || E'    end if;\n'
   || E'    new.approval := case when auth.uid() is null or is_moderator() then ''approved'' else ''pending'' end;\n'
   || E'    new.approval_note := null;\n'
   || E'    new.reviewed_by := case when new.approval = ''approved'' then auth.uid() end;\n'
   || E'    new.reviewed_at := case when new.approval = ''approved'' then now() end;\n'
   || E'    return new;\n  end if;\n'
   || E'  if new.historic is distinct from old.historic then raise exception ''El tipo del torneo (histórico o normal) no se cambia''; end if;\n'
   || E'  if new.testing is distinct from old.testing and auth.uid() is not null and not is_moderator() then\n'
   || E'    raise exception ''Solo un admin o un moderador cambia la fase de testing'' using errcode = ''42501'';\n'
   || E'  end if;\n'
   || E'  if (new.approval, new.approval_note, new.reviewed_by, new.reviewed_at) is distinct from (old.approval, old.approval_note, old.reviewed_by, old.reviewed_at)\n'
   || E'     and auth.uid() is not null and current_setting(''v34.review'', true) is distinct from ''1'' then\n'
   || E'    raise exception ''La aprobación se cambia con aprobar, rechazar o volver a enviar'';\n'
   || E'  end if;\n'
   || E'  if (new.template, new.config, new.game_mode, new.subs_max)']
]);

-- Aprobar o rechazar un torneo pendiente (admin o moderador). Al aprobarlo se aprueban también sus mixes vinculados.
create function public.event_review(p_event uuid, p_approve boolean, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare e events%rowtype; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not is_moderator() then raise exception 'Solo un admin o un moderador aprueba torneos' using errcode = '42501'; end if;
  select * into e from events where id = p_event for update;
  if not found then raise exception 'No existe ese torneo' using errcode = 'P0002'; end if;
  if e.approval <> 'pending' then raise exception 'Ese torneo no espera aprobación' using errcode = 'V3901'; end if;
  if p_approve is null then raise exception 'Falta decir si se aprueba o se rechaza'; end if;
  if not p_approve and v_note is null then raise exception 'Para rechazarlo escribí el motivo (lo ve el organizador)'; end if;
  if char_length(v_note) > 500 then raise exception 'El motivo tiene hasta 500 caracteres'; end if;
  perform set_config('v34.review', '1', true);
  update events set approval = case when p_approve then 'approved' else 'rejected' end,
                    approval_note = case when p_approve then null else v_note end,
                    reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_event;
  perform set_config('v34.review', '', true);
  if p_approve then
    update matches g set parent_approved = true
      from matches p where g.parent_match_id = p.id and p.event_id = p_event and g.parent_approved = false;
  end if;
  perform notify(array[e.organizer_id], 'event_reviewed',
                 jsonb_build_object('event', jsonb_build_object('id', e.id, 'name', e.name), 'approved', p_approve, 'note', v_note));
end $$;
revoke all on function public.event_review(uuid, boolean, text) from public, anon;
grant execute on function public.event_review(uuid, boolean, text) to authenticated;

-- El organizador vuelve a enviar un torneo rechazado.
create function public.event_resubmit(p_event uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare e events%rowtype;
begin
  select * into e from events where id = p_event for update;
  if not found then raise exception 'No existe ese torneo' using errcode = 'P0002'; end if;
  if e.organizer_id is distinct from auth.uid() or e.testing then
    raise exception 'Solo el organizador del torneo lo vuelve a enviar' using errcode = '42501';
  end if;
  if e.approval <> 'rejected' then raise exception 'Solo se vuelve a enviar un torneo rechazado' using errcode = 'V3901'; end if;
  perform set_config('v34.review', '1', true);
  update events set approval = 'pending', reviewed_by = null, reviewed_at = null where id = p_event;
  perform set_config('v34.review', '', true);
  perform notify(notify_staff_ids(), 'admin_event_review',
                 jsonb_build_object('event', jsonb_build_object('id', e.id, 'name', e.name), 'historic', e.historic, 'resubmitted', true));
end $$;
revoke all on function public.event_resubmit(uuid) from public, anon;
grant execute on function public.event_resubmit(uuid) to authenticated;

-- =====================================================================================================
-- 4. Mapas de una serie: mix por aprobar y fechas
-- =====================================================================================================
-- Fecha de un mapa cargado a mano: AAAA-MM-DD o con hora; no en el futuro.
create function public.match_map_date(p text) returns timestamptz
  language plpgsql stable set search_path = public as $$
declare v timestamptz;
begin
  begin
    v := p::timestamptz;
  exception when others then
    raise exception 'La fecha del mapa no es válida (%)', p;
  end;
  if v > now() + interval '1 day' then raise exception 'La fecha del mapa no puede ser futura'; end if;
  return v;
end $$;

select pg_temp.reemplazar('public.match_set_maps(uuid, jsonb)', array[
  ['  i      int;
begin', E'  i      int;\n  v_nuevos int := 0;   -- (replanteo 80) mixes que se vinculan ahora\nbegin'],
  ['jsonb_build_object(''map'', g.map, ''r1'', r1, ''r2'', r2, ''game_id'', g.id)',
   'jsonb_build_object(''map'', g.map, ''r1'', r1, ''r2'', r2, ''game_id'', g.id, ''played_at'', g.played_at)'],
  ['jsonb_build_object(''map'', nullif(btrim(coalesce(x->>''map'', '''')), ''''), ''r1'', r1, ''r2'', r2)',
   'jsonb_build_object(''map'', nullif(btrim(coalesce(x->>''map'', '''')), ''''), ''r1'', r1, ''r2'', r2)'
   || E'\n        || case when nullif(x->>''played_at'', '''') is null then ''{}''::jsonb'
   || E'\n                else jsonb_build_object(''played_at'', match_map_date(x->>''played_at'')) end'],
  ['    update matches set parent_match_id = p_match, parent_side1 = sides[i],',
   E'    if not exists (select 1 from matches where id = ids[i] and parent_match_id = p_match) then v_nuevos := v_nuevos + 1; end if;\n'
   || E'    -- (replanteo 80) lo que vincula un organizador espera la aprobación de un admin o moderador\n'
   || E'    update matches set parent_approved = case when parent_match_id is not distinct from p_match then coalesce(parent_approved, is_moderator())\n'
   || E'                                              else is_moderator() end,\n'
   || E'      parent_match_id = p_match, parent_side1 = sides[i],'],
  ['     where id = ids[i];
  end loop;',
   E'     where id = ids[i];\n  end loop;\n'
   || E'  if v_nuevos > 0 and not is_moderator() then\n'
   || E'    perform notify(notify_staff_ids(), ''admin_game_review'', match_ref(p_match) || jsonb_build_object(''games'', v_nuevos));\n'
   || E'  end if;']
]);

-- Aprobar o rechazar un mix vinculado (admin o moderador). Rechazado: se desvincula y el mapa queda con el mismo mapa,
-- marcador y fecha como resultado a mano, sin tocar la serie ni la llave.
create function public.match_review_game(p_game uuid, p_approve boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare g matches%rowtype; p matches%rowtype; v_org uuid;
begin
  if not is_moderator() then raise exception 'Solo un admin o un moderador aprueba los mixes vinculados' using errcode = '42501'; end if;
  select * into g from matches where id = p_game for update;
  if not found or g.parent_match_id is null then raise exception 'Ese mix no está vinculado a una partida' using errcode = 'P0002'; end if;
  select * into p from matches where id = g.parent_match_id for update;
  if p.kind <> 'official' or p.event_id is null then raise exception 'Ese mix no está vinculado a una partida de torneo'; end if;
  if g.parent_approved then raise exception 'Ese mix ya está aprobado' using errcode = 'V3901'; end if;
  if p_approve is null then raise exception 'Falta decir si se aprueba o se rechaza'; end if;
  if p_approve then
    update matches set parent_approved = true where id = p_game;
  else
    update matches set maps = (select jsonb_agg(case when y.v->>'game_id' = p_game::text then y.v - 'game_id' else y.v end order by y.o)
                                 from jsonb_array_elements(p.maps) with ordinality y(v, o))
     where id = p.id and maps is not null;
    update matches set parent_match_id = null, parent_side1 = null where id = p_game;
  end if;
  select e.organizer_id into v_org from events e join profiles pr on pr.id = e.organizer_id and pr.role = 'organizer' where e.id = p.event_id;
  perform notify(array[v_org], 'game_reviewed', match_ref(p.id) || jsonb_build_object('approved', p_approve, 'map', g.map));
end $$;
revoke all on function public.match_review_game(uuid, boolean) from public, anon;
grant execute on function public.match_review_game(uuid, boolean) to authenticated;

-- La fecha de una serie terminada (por ejemplo, un W.O. de un histórico). Quien gestiona el torneo.
create function public.match_set_played_at(p_match uuid, p_at timestamptz) returns void
  language plpgsql security definer set search_path = public as $$
declare m matches%rowtype;
begin
  select * into m from matches where id = p_match for update;
  if not found or m.kind <> 'official' or m.event_id is null then raise exception 'Esa partida no es de un torneo' using errcode = 'P0002'; end if;
  if not can_manage_event(m.event_id) then raise exception 'Solo quien gestiona el torneo cambia la fecha' using errcode = '42501'; end if;
  if m.status <> 'finished' then raise exception 'La fecha se pone a una partida terminada'; end if;
  if p_at is null or p_at > now() + interval '1 day' then raise exception 'La fecha no puede ser futura'; end if;
  update matches set played_at = p_at where id = p_match;
end $$;
revoke all on function public.match_set_played_at(uuid, timestamptz) from public, anon;
grant execute on function public.match_set_played_at(uuid, timestamptz) to authenticated;

-- La fecha de una serie: la del último mapa que la tenga (mix o a mano). Si ninguno la tiene, la del momento en que se
-- cierra, o el comienzo del torneo si es histórico.
create or replace function public.matches_played_at() returns trigger
  language plpgsql set search_path = public as $$
declare v timestamptz;
begin
  if new.kind <> 'mix' and new.status = 'finished'
     and (tg_op = 'INSERT' or old.status is distinct from 'finished' or new.maps is distinct from old.maps) then
    select max((y->>'played_at')::timestamptz) into v
      from jsonb_array_elements(case when jsonb_typeof(new.maps) = 'array' then new.maps else '[]' end) y
     where nullif(y->>'played_at', '') is not null;
    if v is not null then
      new.played_at := v;
    elsif new.played_at is null then
      new.played_at := coalesce((select e.starts_on::timestamptz from events e where e.id = new.event_id and e.historic), now());
    end if;
  end if;
  return new;
end $$;
drop trigger matches_played_at on public.matches;
create trigger matches_played_at before insert or update of status, maps on public.matches
  for each row execute function public.matches_played_at();

-- Mixes para vincular. En un torneo normal, como antes: de los últimos 14 días y con al menos un inscrito. En un
-- histórico, cualquier mix terminado y sin vincular. Filtros por fecha, mapa y servidor, y paginado (total en cada fila).
drop function public.match_game_candidates(uuid);
create function public.match_game_candidates(p_match uuid, p_from timestamptz default null, p_to timestamptz default null,
                                             p_map text default null, p_server uuid default null,
                                             p_limit int default 20, p_offset int default 0)
  returns table(game_id uuid, map text, played_at timestamptz, score1 int, score2 int, server_name text,
                players int, registered int, side1 int, linked boolean, approved boolean, total bigint)
  language plpgsql stable security definer set search_path = public as $$
declare m matches%rowtype; v_hist boolean;
begin
  select * into m from matches where id = p_match;
  if not found or m.kind <> 'official' or m.event_id is null then raise exception 'Esa partida no es de un torneo' using errcode = 'P0002'; end if;
  if not can_manage_event(m.event_id) then
    raise exception 'Solo el organizador del torneo, un moderador o un admin puede vincular mixes' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then raise exception 'Paginado inválido'; end if;
  select historic into v_hist from events where id = m.event_id;
  return query
    select x.*, count(*) over () as total from (
      select g.id, g.map, g.played_at, g.score1, g.score2, gs.name,
             (select count(*)::int from match_player_stats s where s.match_id = g.id and s.rounds > 0),
             (select count(*)::int from match_player_stats s where s.match_id = g.id and s.rounds > 0
                 and (s.player_id in (select match_roster(p_match, m.team1)) or s.player_id in (select match_roster(p_match, m.team2)))) as reg,
             coalesce(g.parent_side1::int, match_game_side(p_match, g.id)),
             g.parent_match_id is not null as lnk,
             g.parent_approved
        from matches g left join game_servers gs on gs.id = g.server_id
       where g.kind = 'mix' and g.status = 'finished'
         and (g.parent_match_id is null or g.parent_match_id = p_match)
         and (v_hist or g.parent_match_id = p_match or g.played_at > now() - interval '14 days')
         and (v_hist or exists (select 1 from match_player_stats s where s.match_id = g.id and s.rounds > 0
                       and (s.player_id in (select match_roster(p_match, m.team1)) or s.player_id in (select match_roster(p_match, m.team2)))))
         and (p_from is null or g.played_at >= p_from)
         and (p_to is null or g.played_at < p_to)
         and (nullif(btrim(coalesce(p_map, '')), '') is null or g.map ilike '%' || btrim(p_map) || '%')
         and (p_server is null or g.server_id = p_server)
    ) x
    order by x.lnk desc, x.reg desc, x.played_at desc
    limit p_limit offset p_offset;
end $$;
revoke all on function public.match_game_candidates(uuid, timestamptz, timestamptz, text, uuid, int, int) from public, anon;
grant execute on function public.match_game_candidates(uuid, timestamptz, timestamptz, text, uuid, int, int) to authenticated;

-- =====================================================================================================
-- 5. Torneo histórico: equipos, inscripción, fixture y servidor
-- =====================================================================================================
select pg_temp.reemplazar('public.event_register(uuid, uuid, uuid[], uuid[], integer)', array[
  ['  if not found or t.kind <> ''official'' then raise exception ''Solo se inscriben equipos oficiales''; end if;
  gestor := can_manage_event(p_event);',
   E'  if not found or t.kind not in (''official'', ''historic'') or (t.kind = ''historic'' and not e.historic) then\n'
   || E'    raise exception ''Solo se inscriben equipos oficiales'';\n  end if;\n'
   || E'  gestor := can_manage_event(p_event);\n'
   || E'  -- (replanteo 80) histórico: lo carga quien gestiona, sin plantel, SteamID ni cupo de activos, con 0 a 10 jugadores\n'
   || E'  if e.historic then\n'
   || E'    if not gestor then raise exception ''Los equipos de un torneo histórico los carga quien lo gestiona'' using errcode = ''42501''; end if;\n'
   || E'    ya := exists (select 1 from tournament_registrations where event_id = p_event and team_id = p_team);\n'
   || E'    if e.status = ''cancelled'' then raise exception ''El torneo fue cancelado''; end if;\n'
   || E'    if e.status <> ''registration'' and not ya then raise exception ''El fixture ya está generado: solo se cambian los jugadores de un equipo inscrito''; end if;\n'
   || E'    if not ya and e.max_teams is not null and (select count(*) from tournament_registrations where event_id = p_event) >= e.max_teams then\n'
   || E'      raise exception ''El torneo ya tiene el cupo completo (% equipos)'', e.max_teams;\n'
   || E'    end if;\n'
   || E'    if cardinality(todos) > 10 then raise exception ''Hasta 10 jugadores por equipo''; end if;\n'
   || E'    if cardinality(todos) <> (select count(distinct y) from unnest(todos) y) then raise exception ''Hay jugadores repetidos''; end if;\n'
   || E'    if (select count(*) from players where id = any(todos)) <> cardinality(todos) then raise exception ''Algún jugador no existe''; end if;\n'
   || E'    for x in select p.nick, t2.name as otro\n'
   || E'               from unnest(todos) u join players p on p.id = u\n'
   || E'               join tournament_registration_players r on r.event_id = p_event and r.player_id = p.id and r.team_id <> p_team\n'
   || E'               join teams t2 on t2.id = r.team_id\n'
   || E'              order by p.nick limit 1 loop\n'
   || E'      raise exception ''% ya está inscrito en este torneo con %. Uno de los dos equipos tiene que sacarlo'', x.nick, x.otro;\n'
   || E'    end loop;\n'
   || E'    insert into tournament_registrations(event_id, team_id, start_stage) values (p_event, p_team, coalesce(p_start_stage, 1))\n'
   || E'    on conflict (event_id, team_id) do update set start_stage = coalesce(p_start_stage, tournament_registrations.start_stage);\n'
   || E'    delete from tournament_registration_players where event_id = p_event and team_id = p_team and not (player_id = any(todos));\n'
   || E'    insert into tournament_registration_players(event_id, team_id, player_id, role)\n'
   || E'    select p_event, p_team, u, ''active'' from unnest(todos) u\n'
   || E'    on conflict (event_id, player_id) do update set role = excluded.role\n'
   || E'     where tournament_registration_players.role is distinct from excluded.role;\n'
   || E'    if not ya and not (p_team = any(e.seeds)) then\n'
   || E'      update events set seeds = array_append(seeds, p_team) where id = p_event;\n'
   || E'    end if;\n'
   || E'    return;\n'
   || E'  end if;']
]);

-- Crea un equipo histórico (no está en la plataforma) y lo inscribe en el torneo histórico.
create function public.event_create_historic_team(p_event uuid, p_name text, p_tag text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  e events%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_tag  text := upper(btrim(coalesce(p_tag, '')));
  v_id   uuid;
begin
  select * into e from events where id = p_event;
  if not found then raise exception 'No existe ese torneo' using errcode = 'P0002'; end if;
  if not e.historic then raise exception 'Los equipos que no están en la plataforma se cargan solo en un torneo histórico'; end if;
  if not can_manage_event(p_event) then raise exception 'Solo quien gestiona el torneo' using errcode = '42501'; end if;
  if e.status <> 'registration' then raise exception 'El fixture ya está generado: no se suman equipos'; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'El nombre tiene que tener entre 2 y 40 caracteres'; end if;
  if char_length(v_tag) not between 1 and 6 then raise exception 'La sigla tiene que tener entre 1 y 6 caracteres'; end if;
  insert into teams(name, tag, kind, founded_at) values (v_name, v_tag, 'historic', null) returning id into v_id;
  perform event_register(p_event, v_id, '{}', '{}', null);
  return v_id;
end $$;
revoke all on function public.event_create_historic_team(uuid, text, text) from public, anon;
grant execute on function public.event_create_historic_team(uuid, text, text) to authenticated;

-- Equipos (de la plataforma o históricos) con un nombre o sigla parecidos, para no duplicar uno que ya existe.
create function public.historic_team_similar(p_name text)
  returns table(team_id uuid, name text, tag text, kind text, logo_url text)
  language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.tag, t.kind, t.logo_url
    from teams t
   where (is_organizer() or is_moderator())
     and char_length(btrim(coalesce(p_name, ''))) >= 2
     and t.kind in ('official', 'historic') and t.dissolved_at is null
     and (search_norm(t.name) like '%' || search_norm(btrim(p_name)) || '%'
          or search_norm(btrim(p_name)) like '%' || search_norm(t.name) || '%'
          or upper(btrim(t.tag)) = upper(btrim(p_name)))
   order by t.kind, t.name
   limit 10 $$;
revoke all on function public.historic_team_similar(text) from public, anon;
grant execute on function public.historic_team_similar(text) to authenticated;

-- Quién corrige un equipo histórico (nombre, sigla y logo): un admin o moderador, o quien gestiona un torneo histórico
-- donde está inscrito.
create function public.historic_team_can_edit(p_team uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from teams where id = p_team and kind = 'historic')
     and (is_moderator() or exists (select 1 from tournament_registrations r join events e on e.id = r.event_id
                                      where r.team_id = p_team and e.historic and can_manage_event(e.id))) $$;
grant execute on function public.historic_team_can_edit(uuid) to authenticated;

create function public.historic_team_update(p_team uuid, p_name text, p_tag text) returns void
  language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name, '')); v_tag text := upper(btrim(coalesce(p_tag, '')));
begin
  if not historic_team_can_edit(p_team) then raise exception 'Solo quien gestiona su torneo histórico corrige ese equipo' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'El nombre tiene que tener entre 2 y 40 caracteres'; end if;
  if char_length(v_tag) not between 1 and 6 then raise exception 'La sigla tiene que tener entre 1 y 6 caracteres'; end if;
  update teams set name = v_name, tag = v_tag where id = p_team;
end $$;
revoke all on function public.historic_team_update(uuid, text, text) from public, anon;
grant execute on function public.historic_team_update(uuid, text, text) to authenticated;

create function public.historic_team_set_logo(p_team uuid, p_url text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not historic_team_can_edit(p_team) then raise exception 'Solo quien gestiona su torneo histórico corrige ese equipo' using errcode = '42501'; end if;
  update teams set logo_url = p_url where id = p_team;
end $$;
revoke all on function public.historic_team_set_logo(uuid, text) from public, anon;
grant execute on function public.historic_team_set_logo(uuid, text) to authenticated;

select pg_temp.reemplazar('public.event_generate(uuid)', array[
  ['    if x.n < need then raise exception', '    if x.n < need and not e.historic then raise exception']   -- (replanteo 80)
]);

select pg_temp.reemplazar('public.match_start(uuid, uuid, integer)', array[
  ['  if not can_manage_event(m.event_id) then raise exception ''Solo el organizador del torneo o un moderador'' using errcode = ''42501''; end if;',
   E'  if not can_manage_event(m.event_id) then raise exception ''Solo el organizador del torneo o un moderador'' using errcode = ''42501''; end if;\n'
   || E'  if (select historic from events where id = m.event_id) then raise exception ''Un torneo histórico no se juega en el servidor''; end if; -- (replanteo 80)']
]);

-- =====================================================================================================
-- 6. Ranking
-- =====================================================================================================
-- Si una partida de torneo suma al ranking de equipos. Igual para todos (no depende de quién mira).
create function public.match_rankable(p_match uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when m.event_id is null then true
    when e.id is null then true
    when e.testing or e.approval <> 'approved' then false
    when e.historic then m.end_reason is distinct from 'walkover'
                         and jsonb_typeof(m.maps) = 'array' and jsonb_array_length(m.maps) > 0
                         and not exists (select 1 from jsonb_array_elements(m.maps) y
                                          where nullif(y->>'game_id', '') is null
                                             or not exists (select 1 from matches g where g.id = (y->>'game_id')::uuid
                                                              and g.parent_match_id = m.id and g.parent_approved))
    else true end
    from matches m left join events e on e.id = m.event_id
   where m.id = p_match $$;
grant execute on function public.match_rankable(uuid) to anon, authenticated;

-- Los puntos salen solo de lo que suma. Las partidas de torneo se leen sin la RLS de quien mira (así el ranking es el
-- mismo para todos): por eso la función pasa a security definer, como match_rankable.
select pg_temp.reemplazar('public.team_standings_at(timestamp with time zone)', array[
  [' STABLE
', E' STABLE SECURITY DEFINER\n'],
  ['    left join team_results j on j.team_id = t.id and coalesce(j.at, ''-infinity''::timestamptz) <= p_at',
   '    left join team_results j on j.team_id = t.id and coalesce(j.at, ''-infinity''::timestamptz) <= p_at and match_rankable(j.match_id)   -- (replanteo 80)']
]);

-- =====================================================================================================
-- 7. Avisos
-- =====================================================================================================
select pg_temp.reemplazar('public.notification_category(text)', array[
  ['''match_server_ready'', ''booking_attention'') then ''tournament''',
   '''match_server_ready'', ''booking_attention'', ''event_reviewed'', ''game_reviewed'') then ''tournament'''],   -- (replanteo 80)
  ['''match_no_result'', ''admin_steam_linked'') then ''admin''',
   '''match_no_result'', ''admin_steam_linked'', ''admin_event_review'', ''admin_game_review'') then ''admin''']    -- (replanteo 80)
]);

create or replace function public.tg_notify_events() returns trigger
  language plpgsql security definer set search_path = public as $$
declare r record; v_quiet boolean; v_was boolean;
begin
  if tg_op = 'INSERT' then
    -- (replanteo 80) lo de un organizador espera aprobación; un torneo histórico, en testing o pendiente no se anuncia
    if new.approval = 'pending' then
      perform notify(notify_staff_ids(), 'admin_event_review',
                     jsonb_build_object('event', jsonb_build_object('id', new.id, 'name', new.name), 'historic', new.historic));
    end if;
    if new.status = 'registration' and not (new.historic or new.testing or new.approval <> 'approved') then
      perform notify(array(select id from profiles), 'event_new', jsonb_build_object('event', event_ref(new.id), 'starts_on', new.starts_on));
    end if;
    return null;
  end if;
  if tg_op = 'DELETE' then
    if old.historic or old.testing or old.approval <> 'approved' then return old; end if;
    perform notify(array(select unnest(side_users(team_id, old.id)) from tournament_registrations where event_id = old.id),
                   'event_cancelled', jsonb_build_object('event', jsonb_build_object('id', old.id, 'name', old.name)));
    return old;
  end if;
  v_quiet := new.historic or new.testing or new.approval <> 'approved';
  v_was := old.historic or old.testing or old.approval <> 'approved';
  -- (replanteo 80) se hace público (aprobado o fuera de testing) con las inscripciones abiertas: se anuncia
  if v_was and not v_quiet and new.status = 'registration' then
    perform notify(array(select id from profiles), 'event_new', jsonb_build_object('event', event_ref(new.id), 'starts_on', new.starts_on));
  end if;
  if new.status = old.status or v_quiet then return null; end if;
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
end $$;
drop trigger notify_events on public.events;
create trigger notify_events after insert or update of status, approval, testing on public.events
  for each row execute function public.tg_notify_events();

select pg_temp.reemplazar('public.tg_notify_registrations()', array[
  ['  if not exists (select 1 from events where id = r.event_id and status = ''registration'') then return null; end if;',
   E'  if not exists (select 1 from events where id = r.event_id and status = ''registration'') then return null; end if;\n'
   || E'  if event_quiet(r.event_id) then return null; end if;   -- (replanteo 80)']
]);
select pg_temp.reemplazar('public.tg_notify_registration_players()', array[
  ['  if not exists (select 1 from events where id = r.event_id and status in (''registration'', ''in_progress'')) then return null; end if;',
   E'  if not exists (select 1 from events where id = r.event_id and status in (''registration'', ''in_progress'')) then return null; end if;\n'
   || E'  if event_quiet(r.event_id) then return null; end if;   -- (replanteo 80)']
]);
select pg_temp.reemplazar('public.tg_notify_matches()', array[
  ['  if coalesce(new.bye, false) then return null; end if;',
   E'  if coalesce(new.bye, false) then return null; end if;\n'
   || E'  if new.event_id is not null and event_quiet(new.event_id) then return null; end if;   -- (replanteo 80)']
]);
select pg_temp.reemplazar('public.notify_due()', array[
  ['       where m.kind in (''official'', ''pcw'') and m.status = ''upcoming'' and m.parent_match_id is null and m.bye is not true',
   '       where m.kind in (''official'', ''pcw'') and m.status = ''upcoming'' and m.parent_match_id is null and m.bye is not true'
   || E'\n         and (m.event_id is null or not event_quiet(m.event_id))   -- (replanteo 80)'],
  ['     where m.kind = ''official'' and m.status in (''upcoming'', ''live'') and m.parent_match_id is null and m.bye is not true',
   '     where m.kind = ''official'' and m.status in (''upcoming'', ''live'') and m.parent_match_id is null and m.bye is not true'
   || E'\n       and not event_quiet(m.event_id)   -- (replanteo 80)']
]);

-- =====================================================================================================
-- 8. Listado de torneos
-- =====================================================================================================
select pg_temp.sumar_columnas('public.event_list',
  'e.historic, e.testing, e.approval, e.approval_note, '
  || '(( SELECT count(*) FROM matches g JOIN matches p ON p.id = g.parent_match_id '
  || 'WHERE p.event_id = e.id AND g.parent_approved = false))::integer AS pending_games');

notify pgrst, 'reload schema';
commit;

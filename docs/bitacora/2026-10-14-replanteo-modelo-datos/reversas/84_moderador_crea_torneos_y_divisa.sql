-- Inversa del replanteo 84 (el moderador crea torneos y el premio con monto y divisa).
-- Deja las funciones, la política y event_list como estaban con la 80 (definiciones guardadas antes de aplicar la 84) y
-- saca las columnas nuevas. ABORTA si hay torneos que creó un moderador (admin_review) o premios con monto: se perderían
-- (publicarlos, borrarlos o sacarles el monto antes).
begin;

do $$
begin
  if exists (select 1 from public.events where admin_review or prize_amount is not null) then
    raise exception 'inversa 84: hay torneos creados por un moderador o premios con monto';
  end if;
end $$;

drop policy "torneos: crear" on public.events;
create policy "torneos: crear" on public.events for insert to authenticated
  with check ((is_organizer() or (historic and is_moderator())) and (organizer_id = auth.uid() or is_admin()));

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
    -- (replanteo 80) un moderador crea solo históricos; testing solo admin o moderador; lo de un organizador nace pendiente
    if auth.uid() is not null and not is_organizer() and not (new.historic and is_moderator()) then
      raise exception 'Solo un organizador o un admin puede crear torneos' using errcode = '42501';
    end if;
    -- (replanteo 33) solo un modo habilitado
    if not exists (select 1 from game_modes where code = new.game_mode and active) then
      raise exception 'El modo de juego % no está habilitado', new.game_mode;
    end if;
    if new.testing and auth.uid() is not null and not is_moderator() then
      raise exception 'Solo un admin o un moderador puede marcar un torneo en fase de testing' using errcode = '42501';
    end if;
    if new.historic and (new.starts_on is null or new.ends_on is null) then
      raise exception 'Un torneo histórico necesita la fecha en que empezó y la fecha en que terminó';
    end if;
    new.approval := case when auth.uid() is null or is_moderator() then 'approved' else 'pending' end;
    new.approval_note := null;
    new.reviewed_by := case when new.approval = 'approved' then auth.uid() end;
    new.reviewed_at := case when new.approval = 'approved' then now() end;
    return new;
  end if;
  if new.historic is distinct from old.historic then raise exception 'El tipo del torneo (histórico o normal) no se cambia'; end if;
  if new.testing is distinct from old.testing and auth.uid() is not null and not is_moderator() then
    raise exception 'Solo un admin o un moderador cambia la fase de testing' using errcode = '42501';
  end if;
  if (new.approval, new.approval_note, new.reviewed_by, new.reviewed_at) is distinct from (old.approval, old.approval_note, old.reviewed_by, old.reviewed_at)
     and auth.uid() is not null and current_setting('v34.review', true) is distinct from '1' then
    raise exception 'La aprobación se cambia con aprobar, rechazar o volver a enviar';
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

CREATE OR REPLACE FUNCTION public.event_review(p_event uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.event_resubmit(p_event uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.can_own_event(p_event uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select is_admin() or exists (
    select 1 from events e join profiles p on p.id = e.organizer_id
     where e.id = p_event and e.organizer_id = auth.uid() and p.role = 'organizer' and not e.testing)   -- (replanteo 80) testing
$function$
;

CREATE OR REPLACE FUNCTION public.tg_notify_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;


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
        END AS finished_at,
    e.historic,
    e.testing,
    e.approval,
    e.approval_note,
    (( SELECT count(*) AS count
           FROM matches g
             JOIN matches p ON p.id = g.parent_match_id
          WHERE p.event_id = e.id AND g.parent_approved = false))::integer AS pending_games
   FROM events e
     LEFT JOIN teams c ON c.id = e.champion;

alter table public.events
  drop constraint events_prize_currency_other_check,
  drop constraint events_prize_amount_currency,
  drop column prize_currency_other,
  drop column prize_currency,
  drop column prize_amount,
  drop column admin_review;

notify pgrst, 'reload schema';
commit;

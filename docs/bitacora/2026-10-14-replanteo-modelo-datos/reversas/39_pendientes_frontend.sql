-- Inversa de supabase/replanteo/39_pendientes_frontend.sql.
-- Aborta si hay equipos disueltos: volverían a estar activos sin plantel.
-- Se pierden las fechas y los motivos de las solicitudes de equipo, y los avisos team_dissolved.
begin;

do $$
begin
  if to_regprocedure('public.team_dissolve(uuid)') is null then
    raise exception 'inversa 39: no existe team_dissolve (¿no se aplicó la 39?)';
  end if;
  if exists (select 1 from public.teams where dissolved_at is not null) then
    raise exception 'inversa 39: hay equipos disueltos; volverían a estar activos';
  end if;
end $$;

-- Vuelve a crear una vista sin las columnas que la 39 le sumó al final (desde `inicio` hasta el FROM de primer nivel).
-- create or replace no saca columnas: se borra y se crea, con las vistas que dependen de ella.
create function pg_temp.sin_columnas(v regclass, inicio text) returns void language plpgsql as $$
declare
  nombre text := v::text;
  d      text := pg_get_viewdef(v, true);
  i      int  := position(inicio in d);
  j      int  := position(E'\n   FROM ' in d);
  com    text := obj_description(v, 'pg_class');
  opts   text[] := (select reloptions from pg_class where oid = v);
  dep    record;
  deps   jsonb := '[]';
  x      jsonb;
begin
  if i = 0 or i > j then raise exception 'inversa 39: en % no se encontró: %', v, left(inicio, 60); end if;
  for dep in select distinct r.ev_class::regclass as vista
               from pg_depend x join pg_rewrite r on r.oid = x.objid
              where x.refobjid = v and r.ev_class <> v loop
    deps := deps || jsonb_build_object('n', dep.vista::text, 'd', pg_get_viewdef(dep.vista, true),
                                       'c', obj_description(dep.vista, 'pg_class'),
                                       'o', (select array_to_string(reloptions, ', ') from pg_class where oid = dep.vista));
    execute format('drop view %s', dep.vista);
  end loop;
  execute format('drop view %s', nombre);
  execute format('create view %s %s as %s', nombre,
                 coalesce('with (' || array_to_string(opts, ', ') || ')', ''), left(d, i - 1) || substr(d, j));
  execute format('comment on view %s is %L', nombre, com);
  execute format('grant select on %s to anon, authenticated', nombre);
  for x in select * from jsonb_array_elements(deps) loop
    execute format('create view %s %s as %s', x->>'n', coalesce('with (' || (x->>'o') || ')', ''), x->>'d');
    execute format('comment on view %s is %L', x->>'n', x->>'c');
    execute format('grant select on %s to anon, authenticated', x->>'n');
  end loop;
end $$;

create function pg_temp.vista_reemplazar(v regclass, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_viewdef(v, true); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 39: en % no se encontró: %', v, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute format('create or replace view %s with (security_invoker = true) as %s', v, d);
end $$;

-- ---------- vistas ----------
select pg_temp.sin_columnas('public.team_overview', E',\n    dissolved_at,\n    name_changed_at');
select pg_temp.sin_columnas('public.match_list', E',\n    search_norm(concat_ws('' ''::text, ( SELECT string_agg((s.nick');
drop index public.matches_parent_match;
select pg_temp.sin_columnas('public.player_season_list', E',\n    s.closed_at AS ended_at');
select pg_temp.vista_reemplazar('public.team_ranking', array[
  [E'\n          WHERE (( SELECT td.dissolved_at\n                   FROM teams td\n                  WHERE td.id = a_1.team_id)) IS NULL', ''],
  [E'\n  WHERE (( SELECT td.dissolved_at\n           FROM teams td\n          WHERE td.id = s.team_id)) IS NULL', '']
]);

-- ---------- biografía, nombre y disolver ----------
drop function public.set_my_bio(text);
drop function public.team_rename(uuid, text, text);
drop function public.team_dissolve(uuid);
drop trigger team_members_disuelto on public.team_members;
drop trigger team_invites_disuelto on public.team_invites;
drop trigger tournament_registrations_disuelto on public.tournament_registrations;
drop function public.team_not_dissolved();

-- team_update como en la 33.
create or replace function public.team_update(p_team uuid, p_looking_for text[]) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not (is_admin() or exists (select 1 from teams where id = p_team and captain_id = auth.uid() and kind = 'official')) then
    raise exception 'Solo el capitán o un admin puede editar el equipo' using errcode = '42501';
  end if;
  if not coalesce(p_looking_for, '{}') <@ array['player', 'sub', 'coach'] then
    raise exception 'Lo que busca el equipo tiene que ser player, sub o coach';
  end if;
  update teams set looking_for = array(select distinct x from unnest(coalesce(p_looking_for, '{}')) x order by 1) where id = p_team;
end $$;

-- notification_category como en la 36 (sin team_dissolved).
delete from public.notifications where type = 'team_dissolved';
create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered') then 'team'
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

alter table public.teams drop column dissolved_at, drop column dissolved_by, drop column name_changed_at;

-- ---------- solicitud de equipo nuevo ----------
drop function public.cancel_team_request();
drop function public.reject_team_request(uuid, text);
create function public.reject_team_request(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede rechazar solicitudes de equipo' using errcode = '42501'; end if;
  update team_requests set status = 'rejected' where user_id = p_user and status = 'pending';
  if not found then raise exception 'No hay una solicitud pendiente de ese usuario'; end if;
end $$;
revoke all on function public.reject_team_request(uuid) from public, anon;
grant execute on function public.reject_team_request(uuid) to authenticated;

drop trigger team_requests_fechas on public.team_requests;
drop function public.team_requests_fechas();
alter table public.team_requests drop column created_at, drop column reject_reason;

notify pgrst, 'reload schema';

commit;

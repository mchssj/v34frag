-- Inversa de supabase/replanteo/40_equipo_al_instante.sql.
-- Vuelve la aprobación de solicitudes por un admin. Los equipos creados al instante (y los de las solicitudes que la 40
-- resolvió) se quedan: son equipos normales. Se pierde el tope de equipos por capitán.
begin;

do $$
begin
  if to_regprocedure('public.team_create(text, text)') is null then
    raise exception 'inversa 40: no existe team_create (¿no se aplicó la 40?)';
  end if;
end $$;

create function pg_temp.vista_reemplazar(v regclass, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_viewdef(v, true); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 40: en % no se encontró: %', v, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute format('create or replace view %s with (security_invoker = true) as %s', v, d);
end $$;

-- Ranking sin el mínimo de jugadores.
select pg_temp.vista_reemplazar('public.team_ranking', array[
  [' AND team_rankable(a_1.team_id)', ''],
  [' AND team_rankable(s.team_id)', '']
]);
drop function public.team_rankable(uuid);
drop function public.team_eligible_modes(uuid);
drop function public.team_players(uuid);
drop function public.team_create(text, text);

drop trigger teams_lead_limit on public.teams;
drop function public.teams_lead_limit();
drop function public.set_team_config(integer, integer);
create function public.set_team_config(p_max_members integer) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar el máximo de miembros' using errcode = '42501'; end if;
  if p_max_members is null or p_max_members not between 2 and 30 then
    raise exception 'El máximo de miembros tiene que estar entre 2 y 30';
  end if;
  update team_config set max_members = p_max_members, updated_at = now() where id = 1;
end $$;
revoke all on function public.set_team_config(integer) from public, anon;
grant execute on function public.set_team_config(integer) to authenticated;
alter table public.team_config drop column max_led;

-- Solicitudes: como quedaron en la 39.
create policy "enviar solicitud" on public.team_requests for insert
  with check ((user_id = auth.uid()) and (status = 'pending'));
create policy "editar solicitud" on public.team_requests for update
  using ((user_id = auth.uid()) or is_admin()) with check (is_admin() or (status = 'pending'));
comment on table public.team_requests is null;

create function public.approve_team_request(p_user uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare r team_requests%rowtype; pid uuid; tid uuid;
begin
  if not is_admin() then raise exception 'Solo un administrador puede aprobar solicitudes de equipo' using errcode = '42501'; end if;
  select * into r from team_requests where user_id = p_user for update;
  if not found or r.status <> 'pending' then raise exception 'No hay una solicitud pendiente de ese usuario'; end if;
  select id into pid from players where user_id = p_user and steam_id is not null;
  if pid is null then raise exception 'El usuario no tiene el SteamID vinculado: hace falta para crear el equipo'; end if;
  insert into teams(name, tag, owner_id, captain_id, kind, logo_url, founded_at)
  values (r.name, r.tag, p_user, p_user, 'official', r.logo_url, now()) returning id into tid;
  insert into team_members(team_id, player_id, joined_at) values (tid, pid, now());
  update team_requests set status = 'approved' where user_id = p_user;
  return tid;
end $$;
revoke all on function public.approve_team_request(uuid) from public, anon;
grant execute on function public.approve_team_request(uuid) to authenticated;

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

commit;

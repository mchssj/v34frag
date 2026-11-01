-- Replanteo 43: moderar equipos (plan docs/bitacora/2026-11-01-moderar-equipos).
--   1. team_audit: historial de cambios de cada equipo (lo llenan triggers), visible para moderadores y admins.
--   2. Acciones del staff con motivo opcional y aviso obligatorio al líder (team_staff_action):
--      admin o moderador: renombrar, quitar el logo, quitar un miembro (no al líder);
--      solo admin: cambiar el líder, sumar un jugador, cambiar un rol, disolver.
--   3. admin_team_list: la lista de Administración › Equipos.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.team_create(text, text)') is null then
    raise exception 'replanteo 43: falta el replanteo 40 (aplicar antes 40_equipo_al_instante.sql)';
  end if;
  if to_regclass('public.team_audit') is not null then
    raise exception 'replanteo 43: ya existe team_audit (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Historial
-- =====================================================================================================
create table public.team_audit (
  id         bigint generated always as identity primary key,
  team_id    uuid not null references public.teams(id) on delete cascade,
  at         timestamptz not null default now(),
  actor_id   uuid,
  actor_role text not null check (actor_role in ('team', 'moderator', 'admin', 'system')),
  action     text not null,
  data       jsonb not null default '{}',
  reason     text check (char_length(reason) <= 300)
);
comment on table public.team_audit is 'Historial de cambios de un equipo (replanteo 43): quién, cuándo, qué y el motivo si lo dio el staff';
create index team_audit_team on public.team_audit (team_id, at desc);
alter table public.team_audit enable row level security;
create policy "historial: moderadores y admins" on public.team_audit for select using (is_moderator());

-- Rol de quien hace el cambio. Las funciones del staff lo fijan (v34.staff_role); si no, staff que toca un equipo ajeno
-- cuenta como staff, y el resto como el propio equipo.
create function public.team_actor_role(p_team uuid) returns text
  language sql stable security definer set search_path = public as $$
  select case
    when nullif(current_setting('v34.staff_role', true), '') is not null then current_setting('v34.staff_role', true)
    when auth.uid() is null then 'system'
    when exists (select 1 from teams where id = p_team and captain_id = auth.uid())
      or exists (select 1 from team_members m join players p on p.id = m.player_id
                  where m.team_id = p_team and m.left_at is null and p.user_id = auth.uid()) then 'team'
    when is_admin() then 'admin'
    when is_moderator() then 'moderator'
    else 'team'
  end
$$;

create function public.team_audit_add(p_team uuid, p_action text, p_data jsonb) returns void
  language sql security definer set search_path = public as $$
  insert into team_audit(team_id, actor_id, actor_role, action, data, reason)
  values (p_team, auth.uid(), team_actor_role(p_team), p_action, coalesce(p_data, '{}'),
          left(nullif(btrim(current_setting('v34.audit_reason', true)), ''), 300))
$$;

create function public.tg_team_audit_teams() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'official' then return null; end if;
  if tg_op = 'INSERT' then
    perform team_audit_add(new.id, 'created', jsonb_build_object('name', new.name, 'tag', new.tag));
    return null;
  end if;
  if (new.name, new.tag) is distinct from (old.name, old.tag) then
    perform team_audit_add(new.id, 'renamed', jsonb_build_object('old_name', old.name, 'old_tag', old.tag, 'name', new.name, 'tag', new.tag));
  end if;
  if new.logo_url is distinct from old.logo_url then
    perform team_audit_add(new.id, case when new.logo_url is null then 'logo_removed' else 'logo_changed' end, '{}');
  end if;
  if new.captain_id is distinct from old.captain_id then
    perform team_audit_add(new.id, 'captain_changed', jsonb_build_object(
      'from', (select nick from players where user_id = old.captain_id), 'to', (select nick from players where user_id = new.captain_id)));
  end if;
  if new.dissolved_at is not null and old.dissolved_at is null then
    perform team_audit_add(new.id, 'dissolved', '{}');
  end if;
  return null;
end $$;
create trigger team_audit_teams after insert or update on public.teams
  for each row execute function public.tg_team_audit_teams();

create function public.tg_team_audit_members() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_nick text := (select nick from players where id = new.player_id); v_user uuid := (select user_id from players where id = new.player_id);
begin
  if (select kind from teams where id = new.team_id) is distinct from 'official' then return null; end if;
  -- La baja masiva de una disolución queda como "dissolved", no miembro por miembro.
  if current_setting('v34.team_deleting', true) = new.team_id::text then return null; end if;
  if tg_op = 'INSERT' then
    if new.left_at is null then
      perform team_audit_add(new.team_id, 'member_added', jsonb_build_object('player', v_nick, 'role', new.role));
    end if;
  elsif old.left_at is null and new.left_at is not null then
    perform team_audit_add(new.team_id, case when v_user is not null and v_user = auth.uid() then 'member_left' else 'member_removed' end,
                           jsonb_build_object('player', v_nick));
  elsif new.left_at is null and new.role is distinct from old.role then
    perform team_audit_add(new.team_id, 'role_changed', jsonb_build_object('player', v_nick, 'from', old.role, 'to', new.role));
  end if;
  return null;
end $$;
create trigger team_audit_members after insert or update of left_at, role on public.team_members
  for each row execute function public.tg_team_audit_members();

-- =====================================================================================================
-- 2. Avisos
-- =====================================================================================================
-- team_staff_action: categoría equipo y obligatoria (no se puede apagar).
do $$
declare d text := pg_get_functiondef('public.notification_category(text)'::regprocedure);
begin
  if position('''team_dissolved'') then ''team''' in d) = 0 then raise exception 'replanteo 43: notification_category cambió'; end if;
  execute replace(d, '''team_dissolved'') then ''team''', '''team_dissolved'', ''team_staff_action'') then ''team''');
end $$;
create or replace function public.notification_required(p_type text) returns boolean
  language sql immutable as $$
  select p_type in ('team_invite', 'team_join_request', 'password_changed', 'team_staff_action') -- (replanteo 43) team_staff_action
$$;

-- Los avisos de siempre al jugador (lo sumaron, lo sacaron, le cambiaron el rol) suman el motivo del staff si lo hay.
create or replace function public.tg_notify_team_members() returns trigger
  language plpgsql security definer set search_path = public as $$
declare t teams%rowtype; v_user uuid;
  v_why jsonb := case when nullif(btrim(current_setting('v34.audit_reason', true)), '') is null then '{}'
                      else jsonb_build_object('reason', btrim(current_setting('v34.audit_reason', true))) end; -- (replanteo 43)
begin
  select * into t from teams where id = new.team_id;
  if t.kind is distinct from 'official' then return null; end if;
  v_user := (select user_id from players where id = new.player_id);
  if tg_op = 'INSERT' then
    -- Entró por una invitación o un pedido (lo avisa su respuesta) o es quien creó el equipo: nada más.
    if new.left_at is null and v_user is distinct from t.captain_id
       and not exists (select 1 from team_invites where team_id = new.team_id and player_id = new.player_id and status = 'open') then
      perform notify(array[v_user], 'team_added', jsonb_build_object('team', team_ref(t.id), 'role', new.role) || v_why);
    end if;
    return null;
  end if;
  if old.left_at is null and new.left_at is not null then
    if current_setting('v34.team_deleting', true) = t.id::text then return null; end if;
    if v_user is not null and v_user = auth.uid() then
      perform notify(array[t.captain_id], 'team_member_left', jsonb_build_object('team', team_ref(t.id), 'player', player_ref(new.player_id)));
    else
      perform notify(array[v_user], 'team_removed', jsonb_build_object('team', team_ref(t.id)) || v_why);
    end if;
  elsif new.left_at is null and new.role is distinct from old.role then
    perform notify(array[v_user], 'team_role_changed', jsonb_build_object('team', team_ref(t.id), 'role', new.role) || v_why);
  end if;
  return null;
end $$;

-- =====================================================================================================
-- 3. Acciones del staff
-- =====================================================================================================
-- Prepara una acción: permiso, equipo oficial activo, motivo y rol para el historial. Devuelve el equipo.
create function public.team_staff_begin(p_team uuid, p_reason text, p_admin_only boolean) returns teams
  language plpgsql security definer set search_path = public as $$
declare t teams%rowtype; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if p_admin_only and not is_admin() then raise exception 'Solo un admin puede hacer esto' using errcode = '42501'; end if;
  if not is_moderator() then raise exception 'Solo un moderador o un admin puede hacer esto' using errcode = '42501'; end if;
  select * into t from teams where id = p_team and kind = 'official' for update;
  if not found or t.dissolved_at is not null then raise exception 'No existe ese equipo' using errcode = 'P0002'; end if;
  if char_length(v_reason) > 300 then raise exception 'El motivo tiene hasta 300 caracteres'; end if;
  perform set_config('v34.audit_reason', coalesce(v_reason, ''), true);
  perform set_config('v34.staff_role', case when is_admin() then 'admin' else 'moderator' end, true);
  return t;
end $$;

-- Aviso obligatorio al líder (y al anterior, si cambió) y limpieza del contexto de la acción.
create function public.team_staff_end(p_team teams, p_action text, p_extra jsonb default '{}') returns void
  language plpgsql security definer set search_path = public as $$
begin
  -- Al líder de ahora y, si el staff lo cambió, también al de antes.
  perform notify(array[(select captain_id from teams where id = p_team.id), p_team.captain_id], 'team_staff_action',
                 jsonb_build_object('team', team_ref(p_team.id), 'action', p_action,
                                    'by', current_setting('v34.staff_role', true),
                                    'reason', nullif(current_setting('v34.audit_reason', true), '')) || coalesce(p_extra, '{}'));
  perform set_config('v34.audit_reason', '', true);
  perform set_config('v34.staff_role', '', true);
end $$;

create function public.team_staff_rename(p_team uuid, p_name text, p_tag text, p_reason text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare t teams; v_name text := btrim(coalesce(p_name, '')); v_tag text := upper(btrim(coalesce(p_tag, '')));
begin
  t := team_staff_begin(p_team, p_reason, false);
  if char_length(v_name) not between 2 and 40 then raise exception 'El nombre tiene que tener entre 2 y 40 caracteres'; end if;
  if char_length(v_tag) not between 1 and 6 then raise exception 'La sigla tiene que tener entre 1 y 6 caracteres'; end if;
  if v_name = t.name and v_tag is not distinct from t.tag then raise exception 'El nombre y la sigla son los mismos'; end if;
  -- Solo se controla lo que cambia (como team_rename): una sigla vieja repetida no frena un cambio de nombre.
  if lower(v_name) <> lower(t.name) and exists (select 1 from teams where id <> p_team and kind = 'official' and dissolved_at is null and lower(btrim(name)) = lower(v_name)) then
    raise exception 'Ya hay un equipo con ese nombre' using errcode = 'V3901', detail = '{"reason":"name_taken"}';
  end if;
  if v_tag is distinct from upper(coalesce(t.tag, '')) and exists (select 1 from teams where id <> p_team and kind = 'official' and dissolved_at is null and upper(btrim(tag)) = v_tag) then
    raise exception 'Ya hay un equipo con esa sigla' using errcode = 'V3901', detail = '{"reason":"tag_taken"}';
  end if;
  -- name_changed_at no se toca: la espera de 30 días del equipo sigue contando desde su último cambio.
  update teams set name = v_name, tag = v_tag where id = p_team;
  perform team_staff_end(t, 'renamed', jsonb_build_object('old_name', t.name, 'name', v_name, 'tag', v_tag));
end $$;

-- Devuelve la URL del logo que se quitó, para que la API lo borre del bucket.
create function public.team_staff_remove_logo(p_team uuid, p_reason text default null) returns text
  language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  t := team_staff_begin(p_team, p_reason, false);
  if t.logo_url is null then raise exception 'El equipo no tiene logo'; end if;
  update teams set logo_url = null where id = p_team;
  perform team_staff_end(t, 'logo_removed');
  return t.logo_url;
end $$;

create function public.team_staff_remove_member(p_team uuid, p_player uuid, p_reason text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare t teams; v_user uuid := (select user_id from players where id = p_player);
begin
  t := team_staff_begin(p_team, p_reason, false);
  if v_user is not null and v_user = t.captain_id then
    raise exception 'Es el líder: primero hay que cambiar el líder' using errcode = 'V3901';
  end if;
  update team_members set left_at = now() where team_id = p_team and player_id = p_player and left_at is null;
  if not found then raise exception 'Ese jugador no está en el plantel' using errcode = 'P0002'; end if;
  perform team_staff_end(t, 'member_removed', jsonb_build_object('player', player_ref(p_player)));
end $$;

create function public.team_staff_set_captain(p_team uuid, p_player uuid, p_reason text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare t teams; v_user uuid := (select user_id from players where id = p_player);
begin
  t := team_staff_begin(p_team, p_reason, true);
  if not exists (select 1 from team_members where team_id = p_team and player_id = p_player and left_at is null) then
    raise exception 'El nuevo líder tiene que ser del plantel' using errcode = 'P0002';
  end if;
  if v_user is null then raise exception 'Ese jugador no tiene cuenta en la web: no puede ser líder'; end if;
  if v_user = t.captain_id then raise exception 'Ya es el líder'; end if;
  update teams set captain_id = v_user, owner_id = coalesce(owner_id, v_user) where id = p_team;
  perform team_staff_end(t, 'captain_changed', jsonb_build_object('player', player_ref(p_player)));
end $$;

create function public.team_staff_add_member(p_team uuid, p_player uuid, p_role text default 'player', p_reason text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  t := team_staff_begin(p_team, p_reason, true);
  if p_role not in ('player', 'sub', 'coach') then raise exception 'El rol tiene que ser player, sub o coach'; end if;
  if exists (select 1 from team_members where team_id = p_team and player_id = p_player and left_at is null) then
    raise exception 'Ese jugador ya está en el equipo' using errcode = 'V3901';
  end if;
  insert into team_members(team_id, player_id, role, joined_at) values (p_team, p_player, p_role, now());
  perform team_staff_end(t, 'member_added', jsonb_build_object('player', player_ref(p_player), 'role', p_role));
end $$;

create function public.team_staff_set_role(p_team uuid, p_player uuid, p_role text, p_reason text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  t := team_staff_begin(p_team, p_reason, true);
  if p_role not in ('player', 'sub', 'coach') then raise exception 'El rol tiene que ser player, sub o coach'; end if;
  update team_members set role = p_role where team_id = p_team and player_id = p_player and left_at is null and role is distinct from p_role;
  if not found then raise exception 'Ese jugador no está en el plantel o ya tiene ese rol' using errcode = 'P0002'; end if;
  perform team_staff_end(t, 'role_changed', jsonb_build_object('player', player_ref(p_player), 'role', p_role));
end $$;

create function public.team_staff_dissolve(p_team uuid, p_reason text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare t teams;
begin
  t := team_staff_begin(p_team, p_reason, true);
  perform team_dissolve(p_team);
  perform team_staff_end(t, 'dissolved');
end $$;

revoke all on function public.team_staff_begin(uuid, text, boolean), public.team_staff_end(teams, text, jsonb),
  public.team_audit_add(uuid, text, jsonb) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['team_staff_rename(uuid, text, text, text)', 'team_staff_remove_logo(uuid, text)',
                           'team_staff_remove_member(uuid, uuid, text)', 'team_staff_set_captain(uuid, uuid, text)',
                           'team_staff_add_member(uuid, uuid, text, text)', 'team_staff_set_role(uuid, uuid, text, text)',
                           'team_staff_dissolve(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- =====================================================================================================
-- 4. Lista de Administración › Equipos
-- =====================================================================================================
-- name_blocked no se expone: la lista solo necesita saber si hay una palabra bloqueada.
create function public.team_name_blocked(p_name text, p_tag text) returns boolean
  language sql stable security definer set search_path = public as $$
  select name_blocked(coalesce(p_name, '')) is not null or name_blocked(coalesce(p_tag, '')) is not null
$$;
revoke all on function public.team_name_blocked(text, text) from public, anon;
grant execute on function public.team_name_blocked(text, text) to authenticated;

-- Solo los activos: un disuelto es como si no existiera.
create view public.admin_team_list with (security_invoker = true) as
select t.id, t.name, t.tag, t.logo_url, t.founded_at,
       cp.id as captain_player_id, cp.nick as captain_alias,
       (select count(*)::int from team_members m where m.team_id = t.id and m.left_at is null) as members,
       team_players(t.id) as players,
       (select count(*)::int from tournament_registrations r join events e on e.id = r.event_id
         where r.team_id = t.id and e.status in ('registration', 'in_progress')) as events_active,
       team_name_blocked(t.name, t.tag) as blocked,
       (select max(a.at) from team_audit a where a.team_id = t.id) as last_change_at,
       search_norm(t.name || ' ' || coalesce(t.tag, '') || ' ' || coalesce((
         select string_agg(p.nick, ' ') from team_members m join players p on p.id = m.player_id
          where m.team_id = t.id and m.left_at is null), '')) as search
  from teams t left join players cp on cp.user_id = t.captain_id
 where t.kind = 'official' and t.dissolved_at is null;
grant select on public.admin_team_list to authenticated;

commit;

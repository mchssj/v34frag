-- Replanteo 40: crear un equipo al instante, sin aprobación del admin (plan docs/bitacora/2026-11-01-equipo-al-instante).
--   1. team_config.max_led: de cuántos equipos oficiales activos puede ser capitán una persona (1 por defecto).
--   2. team_create: cualquier usuario con SteamID crea su equipo y queda como dueño, capitán y primer miembro.
--   3. team_eligible_modes y team_rankable: para qué modos alcanza el plantel; el ranking solo muestra los que llegan a 5v5.
--   4. Las solicitudes pendientes se resuelven (se crea el equipo o se rechazan con el motivo) y se borra la aprobación.
-- Errores con SQLSTATE V3901 (la API los da como 409 CONFLICT; el detail, si viene, es un objeto JSON).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'teams' and column_name = 'dissolved_at') then
    raise exception 'replanteo 40: falta el replanteo 39 (aplicar antes 39_pendientes_frontend.sql)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_config' and column_name = 'max_led') then
    raise exception 'replanteo 40: team_config ya tiene max_led (¿ya se aplicó?)';
  end if;
end $$;

-- Cambia textos dentro de la definición de una vista y la vuelve a crear (como en la 39).
create function pg_temp.vista_reemplazar(v regclass, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_viewdef(v, true); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 40: en % no se encontró: %', v, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute format('create or replace view %s with (security_invoker = true) as %s', v, d);
end $$;

-- =====================================================================================================
-- 1. Tope de equipos por capitán
-- =====================================================================================================
alter table public.team_config
  add column max_led int not null default 1 constraint team_config_max_led check (max_led between 1 and 10);
comment on column public.team_config.max_led is 'De cuántos equipos oficiales activos puede ser capitán una persona (replanteo 40)';

-- Vale al crear y al pasar la capitanía. El admin y las cargas sin usuario no tienen tope.
create function public.teams_lead_limit() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_max int; v_n int;
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if new.kind <> 'official' or new.dissolved_at is not null or new.captain_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.captain_id is not distinct from old.captain_id then return new; end if;
  select max_led into v_max from team_config where id = 1;
  select count(*) into v_n from teams
   where captain_id = new.captain_id and kind = 'official' and dissolved_at is null and id <> new.id;
  if v_n >= v_max then
    raise exception '%', case when new.captain_id = auth.uid()
                          then format('Ya sos capitán de %s equipo%s: el máximo es %s', v_n, case when v_n = 1 then '' else 's' end, v_max)
                          else format('%s ya es capitán de %s equipo%s: el máximo es %s',
                                      coalesce((select tag from profiles where id = new.captain_id), 'Ese jugador'), v_n,
                                      case when v_n = 1 then '' else 's' end, v_max) end
      using errcode = 'V3901', detail = jsonb_build_object('reason', 'lead_limit', 'max_led', v_max)::text;
  end if;
  return new;
end $$;
create trigger teams_lead_limit before insert or update of captain_id on public.teams
  for each row execute function public.teams_lead_limit();

-- La firma nueva suma el tope; la de un argumento se va.
drop function public.set_team_config(integer);
create function public.set_team_config(p_max_members integer, p_max_led integer default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar la configuración de los equipos' using errcode = '42501'; end if;
  if p_max_members is null or p_max_members not between 2 and 30 then
    raise exception 'El máximo de miembros tiene que estar entre 2 y 30';
  end if;
  if p_max_led is not null and p_max_led not between 1 and 10 then
    raise exception 'El máximo de equipos por capitán tiene que estar entre 1 y 10';
  end if;
  update team_config set max_members = p_max_members, max_led = coalesce(p_max_led, max_led), updated_at = now() where id = 1;
end $$;
revoke all on function public.set_team_config(integer, integer) from public, anon;
grant execute on function public.set_team_config(integer, integer) to authenticated;

-- =====================================================================================================
-- 2. Crear equipo
-- =====================================================================================================
-- Mismas reglas de nombre y sigla que team_rename (39). Las palabras bloqueadas las frena teams_rules y el tope, teams_lead_limit.
create function public.team_create(p_name text, p_tag text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_tag  text := upper(btrim(coalesce(p_tag, '')));
  v_pid  uuid;
  v_id   uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select id into v_pid from players where user_id = auth.uid() and steam_id is not null;
  if v_pid is null then raise exception 'Para crear un equipo tenés que tener tu SteamID vinculado'; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'El nombre tiene que tener entre 2 y 40 caracteres'; end if;
  if char_length(v_tag) not between 1 and 6 then raise exception 'La sigla tiene que tener entre 1 y 6 caracteres'; end if;
  if exists (select 1 from teams where kind = 'official' and dissolved_at is null and lower(btrim(name)) = lower(v_name)) then
    raise exception 'Ya hay un equipo con ese nombre' using errcode = 'V3901', detail = '{"reason":"name_taken"}';
  end if;
  if exists (select 1 from teams where kind = 'official' and dissolved_at is null and upper(btrim(tag)) = v_tag) then
    raise exception 'Ya hay un equipo con esa sigla' using errcode = 'V3901', detail = '{"reason":"tag_taken"}';
  end if;
  insert into teams(name, tag, owner_id, captain_id, kind, founded_at)
  values (v_name, v_tag, auth.uid(), auth.uid(), 'official', now()) returning id into v_id;
  insert into team_members(team_id, player_id, joined_at) values (v_id, v_pid, now());
  return v_id;
end $$;
revoke all on function public.team_create(text, text) from public, anon;
grant execute on function public.team_create(text, text) to authenticated;

-- =====================================================================================================
-- 3. Para qué alcanza el plantel
-- =====================================================================================================
-- Juegan los miembros activos con rol jugador o suplente (el coach no).
create function public.team_players(p_team uuid) returns int
  language sql stable security definer set search_path = public as $$
  select count(*)::int from team_members where team_id = p_team and left_at is null and role in ('player', 'sub')
$$;
grant execute on function public.team_players(uuid) to anon, authenticated;

-- Cada modo activo con cuántos jugadores le faltan al equipo (0 = apto).
create function public.team_eligible_modes(p_team uuid)
  returns table(code text, name text, players_per_team int, missing int)
  language sql stable security definer set search_path = public as $$
  select g.code, g.name, g.players_per_team, greatest(g.players_per_team - team_players(p_team), 0)
    from game_modes g where g.active order by g.sort, g.players_per_team
$$;
grant execute on function public.team_eligible_modes(uuid) to anon, authenticated;

-- En el ranking, los que llegan al mínimo de 5v5 (5 si el modo no existe).
create function public.team_rankable(p_team uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select team_players(p_team) >= coalesce((select players_per_team from game_modes where code = '5v5'), 5)
$$;
grant execute on function public.team_rankable(uuid) to anon, authenticated;

select pg_temp.vista_reemplazar('public.team_ranking', array[
  ['WHERE td.id = a_1.team_id)) IS NULL',
   'WHERE td.id = a_1.team_id)) IS NULL AND team_rankable(a_1.team_id)'],
  ['WHERE td.id = s.team_id)) IS NULL;',
   'WHERE td.id = s.team_id)) IS NULL AND team_rankable(s.team_id);']
]);

-- =====================================================================================================
-- 4. Solicitudes pendientes y fin de la aprobación
-- =====================================================================================================
-- Cada pendiente se crea como equipo (aviso "aprobada") o se rechaza con el motivo (aviso "rechazada").
do $$
declare r record; v_pid uuid; v_id uuid; v_why text; v_max int := (select max_led from team_config where id = 1);
begin
  for r in select * from team_requests where status = 'pending' order by created_at nulls first loop
    v_why := null;
    select id into v_pid from players where user_id = r.user_id and steam_id is not null;
    if v_pid is null then
      v_why := 'No tenés el SteamID vinculado. Vinculalo y creá el equipo desde "Mi equipo".';
    elsif (select count(*) from teams where captain_id = r.user_id and kind = 'official' and dissolved_at is null) >= v_max then
      v_why := 'Ya sos capitán de un equipo.';
    elsif exists (select 1 from teams where kind = 'official' and dissolved_at is null and lower(btrim(name)) = lower(btrim(r.name))) then
      v_why := 'Ya hay un equipo con ese nombre. Creá el tuyo con otro desde "Mi equipo".';
    elsif exists (select 1 from teams where kind = 'official' and dissolved_at is null and upper(btrim(tag)) = upper(btrim(r.tag))) then
      v_why := 'Ya hay un equipo con esa sigla. Creá el tuyo con otra desde "Mi equipo".';
    end if;
    if v_why is null then
      begin
        insert into teams(name, tag, owner_id, captain_id, kind, logo_url, founded_at)
        values (btrim(r.name), upper(btrim(r.tag)), r.user_id, r.user_id, 'official', r.logo_url, now()) returning id into v_id;
        insert into team_members(team_id, player_id, joined_at) values (v_id, v_pid, now());
        update team_requests set status = 'approved' where user_id = r.user_id;
      exception when others then
        v_why := 'No se pudo crear el equipo (' || sqlerrm || '). Creá el tuyo desde "Mi equipo".';
      end;
    end if;
    if v_why is not null then
      update team_requests set status = 'rejected', reject_reason = left(v_why, 300) where user_id = r.user_id;
    end if;
  end loop;
end $$;

-- Ya no se piden ni se aprueban equipos: la tabla queda como historial (cada uno ve la suya; el admin, todas).
drop function public.approve_team_request(uuid);
drop function public.reject_team_request(uuid, text);
drop function public.cancel_team_request();
drop policy "enviar solicitud" on public.team_requests;
drop policy "editar solicitud" on public.team_requests;
comment on table public.team_requests is 'Historial de las solicitudes de equipo nuevo (hasta el replanteo 40: desde entonces el equipo se crea al instante con team_create)';

commit;

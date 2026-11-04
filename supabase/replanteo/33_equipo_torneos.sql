-- Replanteo 33: lo que piden las vistas de Equipo y Torneos (plan docs/bitacora/2026-10-28-equipo-torneos-api).
--   1. Máximo de miembros de un equipo configurable por el admin (team_config, 10 por defecto).
--   2. Estado (player, sub, coach) y mensaje en las invitaciones; el capitán cambia el estado (team_set_member_role).
--   3. Equipos: logo, qué buscan (looking_for) y fecha de fundación; logo en la solicitud de equipo nuevo.
--   4. Catálogo de modos de juego (game_modes): cada torneo elige uno y sus activos son los jugadores por equipo del modo.
--   5. Torneos: suplentes (subs_max, de 0 a 4), banner y cierre de inscripciones. Se van players_min y players_max.
--      La inscripción separa activos y suplentes, y el coach no se inscribe.
--   6. Aviso a cada jugador cuando lo inscriben, lo cambian o lo sacan de un torneo (event_lineup).
--   7. Historial de torneos de un equipo (team_event_history) y columnas nuevas en las vistas de listados.
-- Errores con código propio (la API los traduce): V3401 no es miembro, V3402 plantel lleno, V3403 coach,
-- V3404 inscripciones cerradas, V3405 jugadores sin SteamID (detail: JSON con los alias).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if public.notification_category('vip_granted') is null then
    raise exception 'replanteo 33: falta el replanteo 32 (aplicar antes 32_vip.sql)';
  end if;
  if to_regclass('public.game_modes') is not null then
    raise exception 'replanteo 33: game_modes ya existe (¿ya se aplicó?)';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 33: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Suma columnas al final de una vista (create or replace solo deja agregar al final). Busca el FROM de primer nivel.
create function pg_temp.sumar_columnas(v regclass, cols text) returns void language plpgsql as $$
declare d text := pg_get_viewdef(v, true); marca text := E'\n   FROM '; n int;
begin
  n := (length(d) - length(replace(d, marca, ''))) / length(marca);
  if n <> 1 then raise exception 'replanteo 33: la vista % tiene % FROM de primer nivel', v, n; end if;
  execute format('create or replace view %s with (security_invoker = true) as %s', v,
                 replace(d, marca, E',\n    ' || cols || marca));
end $$;

-- =====================================================================================================
-- 1. Máximo de miembros
-- =====================================================================================================
create table public.team_config (
  id          int primary key default 1 constraint team_config_una check (id = 1),
  max_members int not null default 10 constraint team_config_max check (max_members between 2 and 30),
  updated_at  timestamptz not null default now()
);
comment on table public.team_config is 'Plantel de los equipos oficiales (una sola fila): máximo de miembros. Se cambia con set_team_config (replanteo 33)';
insert into public.team_config (id) values (1);
alter table public.team_config enable row level security;
create policy team_config_ver on public.team_config for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.team_config from anon, authenticated;

create function public.team_max_members() returns int
  language sql stable security definer set search_path = public as $$
  select coalesce((select max_members from team_config where id = 1), 10) $$;

-- Si un equipo ya tiene más miembros que el máximo nuevo, nadie sale: solo no entra gente nueva.
create function public.set_team_config(p_max_members int) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar el máximo de miembros' using errcode = '42501'; end if;
  if p_max_members is null or p_max_members not between 2 and 30 then
    raise exception 'El máximo de miembros tiene que estar entre 2 y 30';
  end if;
  update team_config set max_members = p_max_members, updated_at = now() where id = 1;
end $$;
revoke all on function public.set_team_config(int) from public, anon;
grant execute on function public.set_team_config(int) to authenticated;

select pg_temp.reemplazar('public.team_members_rules()', array[
  [E'>= 10 then\n      raise exception ''El equipo ya tiene 10 jugadores, el máximo'';',
   E'>= team_max_members() then\n      -- (replanteo 33) máximo configurable\n      raise exception ''El equipo ya tiene % jugadores, el máximo'', team_max_members() using errcode = ''V3402'';']
]);
select pg_temp.reemplazar('public.team_can_join(uuid, uuid)', array[
  [E'>= 10 then\n    raise exception ''El equipo ya tiene 10 jugadores, el máximo'';',
   E'>= team_max_members() then\n    -- (replanteo 33) máximo configurable\n    raise exception ''El equipo ya tiene % jugadores, el máximo'', team_max_members() using errcode = ''V3402'';']
]);

-- =====================================================================================================
-- 2. Estado en el roster e invitaciones
-- =====================================================================================================
alter table public.team_invites
  add column role text not null default 'player' constraint team_invites_role check (role in ('player', 'sub', 'coach')),
  add column message text constraint team_invites_message check (char_length(message) <= 200);
comment on column public.team_invites.role is 'Estado con el que entra el jugador al aceptar: player, sub o coach. Un pedido entra como player (replanteo 33)';
comment on column public.team_invites.message is 'Mensaje opcional de quien invita o pide entrar, hasta 200 caracteres (replanteo 33)';

-- Como en la 09, con el estado y el mensaje.
drop function public.team_invite(uuid, uuid, text);
create function public.team_invite(p_team uuid, p_player uuid default null, p_alias text default null,
                                   p_role text default 'player', p_message text default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare u uuid; pl players%rowtype; v uuid; v_role text := coalesce(p_role, 'player'); v_msg text := nullif(trim(p_message), '');
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform team_invites_expire();
  if not (is_admin() or exists (select 1 from teams where id = p_team and captain_id = auth.uid())) then
    raise exception 'Solo el capitán o un admin puede invitar jugadores' using errcode = '42501';
  end if;
  if v_role not in ('player', 'sub', 'coach') then raise exception 'El estado tiene que ser player, sub o coach'; end if;
  if char_length(v_msg) > 200 then raise exception 'El mensaje puede tener hasta 200 caracteres'; end if;
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
  insert into team_invites(team_id, player_id, kind, created_by, role, message)
  values (p_team, pl.id, 'invite', auth.uid(), v_role, v_msg) returning id into v;
  return v;
end $$;

drop function public.team_request_join(uuid);
create function public.team_request_join(p_team uuid, p_message text default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare pl players%rowtype; v uuid; v_msg text := nullif(trim(p_message), '');
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform team_invites_expire();
  if char_length(v_msg) > 200 then raise exception 'El mensaje puede tener hasta 200 caracteres'; end if;
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
  insert into team_invites(team_id, player_id, kind, created_by, message) values (p_team, pl.id, 'request', auth.uid(), v_msg) returning id into v;
  return v;
end $$;
revoke all on function public.team_invite(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.team_request_join(uuid, text) from public, anon;
grant execute on function public.team_invite(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.team_request_join(uuid, text) to authenticated;

select pg_temp.reemplazar('public.team_invite_answer(uuid, boolean)', array[
  ['insert into team_members(team_id, player_id, joined_at) values (i.team_id, i.player_id, now());',
   'insert into team_members(team_id, player_id, role, joined_at) values (i.team_id, i.player_id, i.role, now()); -- (replanteo 33) con su estado']
]);

-- El capitán (o un admin) cambia el estado de un miembro. El aviso al jugador sale del trigger notify_team_members.
create function public.team_set_member_role(p_team uuid, p_player uuid, p_role text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not (is_admin() or exists (select 1 from teams where id = p_team and captain_id = auth.uid())) then
    raise exception 'Solo el capitán o un admin puede cambiar el estado de un jugador' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('player', 'sub', 'coach') then raise exception 'El estado tiene que ser player, sub o coach'; end if;
  if not exists (select 1 from team_members where team_id = p_team and player_id = p_player and left_at is null) then
    raise exception 'Ese jugador no está en el plantel del equipo' using errcode = 'V3401';
  end if;
  update team_members set role = p_role where team_id = p_team and player_id = p_player and left_at is null and role is distinct from p_role;
end $$;
revoke all on function public.team_set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.team_set_member_role(uuid, uuid, text) to authenticated;

-- =====================================================================================================
-- 3. Equipos: logo, qué buscan y fundación
-- =====================================================================================================
alter table public.teams
  add column logo_url text,
  add column looking_for text[] not null default '{}' constraint teams_looking_for check (looking_for <@ array['player', 'sub', 'coach']),
  add column founded_at timestamptz default now();
comment on column public.teams.logo_url is 'Logo (URL pública del bucket photos: teams/<id>/ o la carpeta de la solicitud). null: se muestra la sigla (replanteo 33)';
comment on column public.teams.looking_for is 'Qué busca el equipo: player, sub o coach (vacío: no busca). Lo cambia el capitán (replanteo 33)';
comment on column public.teams.founded_at is 'Fecha de aprobación de la solicitud. En los equipos anteriores, el ingreso más antiguo del plantel (replanteo 33)';
update public.teams t set founded_at = (select min(m.joined_at) from team_members m where m.team_id = t.id);

alter table public.team_requests add column logo_url text;
comment on column public.team_requests.logo_url is 'Logo propuesto (bucket photos, carpeta team-requests/<user_id>/). Pasa al equipo al aprobar (replanteo 33)';

select pg_temp.reemplazar('public.approve_team_request(uuid)', array[
  ['insert into teams(name, tag, owner_id, captain_id, kind) values (r.name, r.tag, p_user, p_user, ''official'') returning id into tid;',
   E'-- (replanteo 33) con el logo de la solicitud y la fecha de fundación\n  insert into teams(name, tag, owner_id, captain_id, kind, logo_url, founded_at)\n  values (r.name, r.tag, p_user, p_user, ''official'', r.logo_url, now()) returning id into tid;']
]);

-- Lo que el capitán cambia de su equipo (el nombre y la sigla siguen siendo del admin).
create function public.team_update(p_team uuid, p_looking_for text[]) returns void
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

-- Logo (la API sube el archivo y guarda la URL). null lo quita.
create function public.team_set_logo(p_team uuid, p_url text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not (is_admin() or exists (select 1 from teams where id = p_team and captain_id = auth.uid() and kind = 'official')) then
    raise exception 'Solo el capitán o un admin puede cambiar el logo' using errcode = '42501';
  end if;
  if p_url is not null and position('/storage/v1/object/public/photos/' in p_url) = 0 then
    raise exception 'El logo tiene que estar en el almacenamiento de la web';
  end if;
  update teams set logo_url = p_url where id = p_team;
end $$;
revoke all on function public.team_update(uuid, text[]) from public, anon;
revoke all on function public.team_set_logo(uuid, text) from public, anon;
grant execute on function public.team_update(uuid, text[]) to authenticated;
grant execute on function public.team_set_logo(uuid, text) to authenticated;

-- Bucket photos: hasta ahora solo el admin escribía. El capitán, en teams/<equipo>/; quien pide un equipo, en
-- team-requests/<su id>/; el organizador, en events/<torneo>/. objects.name va calificado: dentro de las subconsultas,
-- name sería el de teams o events.
create policy "photos: capitán sube el logo" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(objects.name))[1] = 'teams'
              and exists (select 1 from public.teams t where t.id::text = (storage.foldername(objects.name))[2] and t.captain_id = auth.uid()));
create policy "photos: capitán borra el logo" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(objects.name))[1] = 'teams'
         and exists (select 1 from public.teams t where t.id::text = (storage.foldername(objects.name))[2] and t.captain_id = auth.uid()));
create policy "photos: logo de la solicitud" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(objects.name))[1] = 'team-requests' and (storage.foldername(objects.name))[2] = auth.uid()::text);
create policy "photos: borrar logo de la solicitud" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(objects.name))[1] = 'team-requests' and (storage.foldername(objects.name))[2] = auth.uid()::text);
create policy "photos: organizador sube el banner" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(objects.name))[1] = 'events'
              and exists (select 1 from public.events e where e.id::text = (storage.foldername(objects.name))[2] and public.can_manage_event(e.id)));
create policy "photos: organizador borra el banner" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(objects.name))[1] = 'events'
         and exists (select 1 from public.events e where e.id::text = (storage.foldername(objects.name))[2] and public.can_manage_event(e.id)));

-- =====================================================================================================
-- 4. Modos de juego
-- =====================================================================================================
create table public.game_modes (
  code             text primary key constraint game_modes_code check (code ~ '^[1-9]v[1-9]$'),
  name             text not null,
  players_per_team int not null constraint game_modes_players check (players_per_team between 1 and 5),
  active           boolean not null default true,
  sort             int not null default 0
);
comment on table public.game_modes is 'Modos de juego de los torneos (jugadores activos por equipo). El admin los habilita o deshabilita con set_game_mode_active (replanteo 33)';
insert into public.game_modes (code, name, players_per_team, sort) values
  ('1v1', '1 vs 1', 1, 1), ('2v2', '2 vs 2', 2, 2), ('3v3', '3 vs 3', 3, 3), ('5v5', '5 vs 5', 5, 4);
alter table public.game_modes enable row level security;
create policy game_modes_ver on public.game_modes for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.game_modes from anon, authenticated;

-- Un torneo que ya usa un modo lo conserva aunque se deshabilite; los nuevos no lo pueden elegir.
create function public.set_game_mode_active(p_code text, p_active boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar los modos de juego' using errcode = '42501'; end if;
  update game_modes set active = coalesce(p_active, false) where code = p_code;
  if not found then raise exception 'No existe el modo de juego %', p_code; end if;
  if not exists (select 1 from game_modes where active) then raise exception 'Tiene que quedar al menos un modo habilitado'; end if;
end $$;
revoke all on function public.set_game_mode_active(text, boolean) from public, anon;
grant execute on function public.set_game_mode_active(text, boolean) to authenticated;

-- =====================================================================================================
-- 5. Torneos: modo, suplentes, banner y cierre de inscripciones
-- =====================================================================================================
alter table public.events
  add column game_mode text not null default '5v5' references public.game_modes(code),
  add column subs_max int not null default 0 constraint events_subs_max check (subs_max between 0 and 4),
  add column banner_url text,
  add column registration_closes_at timestamptz;
comment on column public.events.game_mode is 'Modo de juego: los activos que inscribe cada equipo son sus jugadores por equipo (replanteo 33)';
comment on column public.events.subs_max is 'Suplentes que puede inscribir cada equipo, de 0 a 4; lo fija el organizador (replanteo 33)';
comment on column public.events.banner_url is 'Banner (URL pública del bucket photos, carpeta events/<id>/). null: patrón por defecto (replanteo 33)';
comment on column public.events.registration_closes_at is 'Después de esta hora solo el organizador o un admin cambian las inscripciones. null: hasta generar el fixture (replanteo 33)';

-- Los torneos de antes quedan en 5v5; los suplentes, lo que pasaba de 5 si da entre 0 y 4.
do $$
declare x record;
begin
  update public.events set subs_max = players_max - 5 where players_max - 5 between 0 and 4;
  for x in select id, name, players_min, players_max from public.events where players_min <> 5 or players_max - 5 not between 0 and 4 loop
    raise notice 'replanteo 33: el torneo % (%) inscribía entre % y % jugadores; queda en 5v5 con % suplentes',
      x.name, x.id, x.players_min, x.players_max, case when x.players_max - 5 between 0 and 4 then x.players_max - 5 else 0 end;
  end loop;
end $$;
alter table public.events drop column players_min, drop column players_max;

alter table public.tournament_registration_players
  add column role text not null default 'active' constraint tournament_registration_players_role check (role in ('active', 'sub'));
comment on column public.tournament_registration_players.role is 'active (cuenta para los jugadores del modo) o sub (suplente) (replanteo 33)';
do $$
declare x record;
begin
  for x in select e.name as torneo, t.name as equipo, count(*) filter (where tm.role = 'coach') as coaches, count(*) as n
             from public.tournament_registration_players r
             join public.events e on e.id = r.event_id and e.status in ('registration', 'in_progress')
             join public.teams t on t.id = r.team_id
             left join public.team_members tm on tm.team_id = r.team_id and tm.player_id = r.player_id and tm.left_at is null
            group by e.name, t.name
           having count(*) <> 5 or count(*) filter (where tm.role = 'coach') > 0 loop
    raise notice 'replanteo 33: % en %: % inscritos como activos (% coach): tiene que corregir su inscripción', x.equipo, x.torneo, x.n, x.coaches;
  end loop;
end $$;

-- Como en la 17, con el modo y los suplentes.
create or replace function public.events_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
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
end $$;

-- Como en la 10, con activos y suplentes, el coach afuera, todos los que no tienen SteamID juntos y el cierre.
-- Cambia solo lo que cambió (así los avisos a los jugadores son los reales).
drop function public.event_register(uuid, uuid, uuid[], int);
create function public.event_register(p_event uuid, p_team uuid, p_active uuid[], p_subs uuid[] default '{}',
                                      p_start_stage int default null) returns void
  language plpgsql security definer set search_path = public as $$
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
end $$;
revoke all on function public.event_register(uuid, uuid, uuid[], uuid[], int) from public, anon;
grant execute on function public.event_register(uuid, uuid, uuid[], uuid[], int) to authenticated;

select pg_temp.reemplazar('public.event_unregister(uuid, uuid)', array[
  ['  if e.status <> ''registration'' then raise exception ''El fixture ya está generado: el equipo no se puede dar de baja''; end if;',
   E'  if e.status <> ''registration'' then raise exception ''El fixture ya está generado: el equipo no se puede dar de baja''; end if;\n  -- (replanteo 33) cierre de inscripciones\n  if not can_manage_event(p_event) and e.registration_closes_at is not null and now() >= e.registration_closes_at then\n    raise exception ''Las inscripciones de este torneo ya cerraron: el equipo no se puede dar de baja'' using errcode = ''V3404'';\n  end if;']
]);

select pg_temp.reemplazar('public.event_generate(uuid)', array[
  [E'  for x in select t.name, (select count(*) from tournament_registration_players p where p.event_id = p_event and p.team_id = r.team_id) as n\n             from tournament_registrations r join teams t on t.id = r.team_id where r.event_id = p_event loop\n    if x.n < e.players_min then raise exception ''% tiene % jugadores inscritos (mínimo %)'', x.name, x.n, e.players_min; end if;\n  end loop;',
   E'  -- (replanteo 33) los activos del modo completos (alguno pudo salir del plantel después de inscribirse)\n  need := (select players_per_team from game_modes where code = e.game_mode);\n  for x in select t.name, (select count(*) from tournament_registration_players p where p.event_id = p_event and p.team_id = r.team_id and p.role = ''active'') as n\n             from tournament_registrations r join teams t on t.id = r.team_id where r.event_id = p_event loop\n    if x.n < need then raise exception ''% tiene % jugadores activos inscritos (hacen falta %)'', x.name, x.n, need; end if;\n  end loop;']
]);

select pg_temp.reemplazar('public.csstv_match_lookup(text, text)', array[
  ['e.players_min, -- (replanteo 10) inscritos y mínimo del torneo',
   '(select gm.players_per_team from game_modes gm where gm.code = e.game_mode) as players_min, -- (replanteo 33) activos del modo de juego']
]);

-- =====================================================================================================
-- 6. Aviso a los jugadores inscritos
-- =====================================================================================================
-- Como en la 32, con event_lineup.
create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered') then 'team'
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled', 'event_lineup') then 'tournament' -- (replanteo 33) event_lineup
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result') then 'pcw'
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted') then 'season'
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked') then 'account' -- (replanteo 32)
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed') then 'admin'
  end $$;

-- Al jugador que el equipo inscribe, cambia de activo a suplente (o al revés) o saca. Al capitán no (ya recibe
-- event_registration), ni con el torneo terminado, cancelado o borrado.
create function public.tg_notify_registration_players() returns trigger
  language plpgsql security definer set search_path = public as $$
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
end $$;
create trigger notify_registration_players after insert or delete or update of role on public.tournament_registration_players
  for each row execute function public.tg_notify_registration_players();

-- =====================================================================================================
-- 7. Listados e historial
-- =====================================================================================================
create or replace function public.team_ref(p_team uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', name, 'tag', tag, 'logo_url', logo_url) from teams where id = p_team $$;

select pg_temp.sumar_columnas('public.team_overview', $c$t.logo_url,
    t.founded_at,
        CASE
            WHEN t.kind = 'official'::text THEN team_max_members()
            ELSE NULL::integer
        END AS max_members,
    t.kind = 'official'::text AND (( SELECT count(*) AS count
           FROM team_members tm
          WHERE tm.team_id = t.id AND tm.left_at IS NULL)) < team_max_members() AS has_space,
        CASE
            WHEN (( SELECT count(*) AS count
               FROM team_members tm
              WHERE tm.team_id = t.id AND tm.left_at IS NULL)) >= team_max_members() THEN '{}'::text[]
            ELSE t.looking_for
        END AS looking_for,
    (( SELECT count(*) AS count
           FROM tournament_registrations r
             JOIN events e ON e.id = r.event_id
          WHERE r.team_id = t.id AND (e.status = ANY (ARRAY['in_progress'::text, 'finished'::text]))))::integer AS events_played$c$);

select pg_temp.sumar_columnas('public.team_members_view', $c$( SELECT d.game_role
           FROM profile_details d
          WHERE d.user_id = p.user_id) AS game_role,
    t.logo_url AS team_logo_url$c$);

select pg_temp.sumar_columnas('public.event_registrations_view', 't.logo_url');

select pg_temp.sumar_columnas('public.team_ranking', $c$( SELECT t.logo_url
           FROM teams t
          WHERE t.id = s.team_id) AS logo_url$c$);

select pg_temp.sumar_columnas('public.match_list', 't1.logo_url AS team1_logo_url,
    t2.logo_url AS team2_logo_url');

-- bo: el de las partidas comunes; bo_final: el de la final. Progreso y partida actual solo desde que hay fixture.
select pg_temp.sumar_columnas('public.event_list', $c$c.logo_url AS champion_logo_url,
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
        END AS current_match_id$c$);

-- Torneos de un equipo (sin los cancelados), del más reciente al más viejo, con hasta dónde llegó.
--   result: registered (inscripciones abiertas), in_progress (sigue en carrera), champion, runner_up (perdió la final o la
--   gran final), semifinal (perdió una semifinal, el 3.er puesto o la final del lower), quarterfinal, groups (no pasó de
--   grupos o del suizo) o eliminated (cualquier otra eliminación).
--   place: 1 y 2 en la final; 3 en semifinal (3 y 4 si se jugó el 3.er puesto); 5 en cuartos; null en el resto.
create function public.team_event_history(p_team uuid)
  returns table (event_id uuid, name text, template text, status text, starts_on date, ends_on date,
                 result text, place int, played int, won int, lost int)
  language sql stable set search_path = public as $$
  with ev as (
    select e.* from tournament_registrations r join events e on e.id = r.event_id
     where r.team_id = p_team and e.status <> 'cancelled'
  ), ultimas as (
    -- Última ronda de cada etapa del torneo (la llave se arma completa al generar los playoffs)
    select m.event_id, m.stage, max(m.round) as ultima from matches m join ev on ev.id = m.event_id group by m.event_id, m.stage
  ), ms as (
    select m.event_id, m.stage, m.round, m.status, m.winner, u.ultima,
           m.status = 'finished' and m.winner is not null and m.winner <> p_team as perdio
      from matches m join ev on ev.id = m.event_id
      join ultimas u on u.event_id = m.event_id and u.stage = m.stage
     where not m.bye and p_team in (m.team1, m.team2)
  ), x as (
    select ev.id, ev.name, ev.template, ev.status, ev.starts_on, ev.ends_on, ev.champion,
           count(*) filter (where ms.status = 'finished')::int as played,
           count(*) filter (where ms.status = 'finished' and ms.winner = p_team)::int as won,
           count(*) filter (where ms.perdio)::int as lost,
           bool_or(ms.perdio and ms.stage = 'grand') as perdio_gran_final,
           min(ms.ultima - ms.round) filter (where ms.perdio and ms.stage = 'ko') as ko_falta,
           bool_or(ms.stage = 'third' and ms.status = 'finished' and ms.winner = p_team) as gano_tercero,
           bool_or(ms.stage = 'third' and ms.perdio) as perdio_tercero,
           bool_or(ms.perdio and ms.stage = 'lower' and ms.round = ms.ultima) as perdio_final_lower,
           bool_or(ms.perdio and ms.stage = 'lower') as perdio_lower,
           bool_or(ms.stage in ('ko', 'third', 'upper', 'lower', 'grand')) as en_llave,
           exists (select 1 from matches k where k.event_id = ev.id and k.stage = 'ko') as hay_playoffs,
           exists (select 1 from event_standings s where s.event_id = ev.id and s.team_id = p_team and s.state = 'eliminated') as afuera
      from ev
      left join ms on ms.event_id = ev.id
     group by ev.id, ev.name, ev.template, ev.status, ev.starts_on, ev.ends_on, ev.champion
  ), r as (
    select x.*,
           case
             when x.status = 'registration' then 'registered'
             when x.champion = p_team then 'champion'
             when x.perdio_gran_final or x.ko_falta = 0 then 'runner_up'
             when x.gano_tercero or x.perdio_tercero or x.ko_falta = 1 or x.perdio_final_lower then 'semifinal'
             when x.ko_falta = 2 then 'quarterfinal'
             when x.ko_falta is not null or x.perdio_lower then 'eliminated'
             when x.template in ('groups', 'swiss', 'groups_double') and not x.en_llave
                  and (x.afuera or x.hay_playoffs or x.status = 'finished') then 'groups'
             when x.status = 'in_progress' then 'in_progress'
             else 'eliminated'
           end as result
      from x
  )
  select r.id, r.name, r.template, r.status, r.starts_on, r.ends_on, r.result,
         case r.result
           when 'champion' then 1
           when 'runner_up' then 2
           when 'semifinal' then case when r.perdio_tercero then 4 else 3 end
           when 'quarterfinal' then 5
         end,
         r.played, r.won, r.lost
    from r
   order by coalesce(r.starts_on, r.ends_on) desc nulls first, r.name
$$;
revoke all on function public.team_event_history(uuid) from public;
grant execute on function public.team_event_history(uuid) to anon, authenticated;

commit;

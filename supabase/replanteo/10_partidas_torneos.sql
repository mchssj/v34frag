-- Replanteo 10: partidas, torneos y PCW (plan docs/bitacora/2026-10-15-api-partidas-torneos-pcw).
--   1. Organizadores (profiles.role = 'organizer', events.organizer_id, can_manage_event).
--   2. Torneos con plantillas (single, double, groups, swiss) y el motor completo en la base: generar,
--      avanzar la llave, rondas del suizo, paso a playoffs y campeón. Funciona igual con !match.
--   3. Inscripción con jugadores (tournament_registration_players) entre players_min y players_max.
--   4. !match usa los inscritos en torneos y el mapa de ventaja (advantage_side).
--   5. Código de !match oculto, pool de mapas con versiones, veto validado y chat con permisos.
--   6. PCW "como equipo" (p_team), vencimiento a las 48 h y resultado del admin.
--   7. Se quitan los reportes de resultado de los capitanes (result_reports) y las columnas viejas de events.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.team_invites') is null then
    raise exception 'replanteo 10: falta team_invites (aplicar antes 09_jugadores_equipos.sql)';
  end if;
  if to_regclass('public.map_pool') is not null then
    raise exception 'replanteo 10: map_pool ya existe (¿ya se aplicó?)';
  end if;
  if exists (select 1 from public.profiles where role not in ('user', 'admin')) then
    raise exception 'replanteo 10: hay roles desconocidos en profiles.role';
  end if;
end $$;

-- =====================================================================================================
-- 1. Organizadores
-- =====================================================================================================
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'organizer', 'admin'));

create function public.is_organizer() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('organizer', 'admin'))
$$;

-- El admin cambia el rol de un usuario entre user y organizer (el rol admin se da en la base).
create function public.set_user_role(p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar roles' using errcode = '42501'; end if;
  if p_role not in ('user', 'organizer') then raise exception 'El rol tiene que ser user u organizer'; end if;
  if (select role from profiles where id = p_user) = 'admin' then raise exception 'El rol de un admin se cambia en la base'; end if;
  update profiles set role = p_role where id = p_user;
  if not found then raise exception 'No existe ese usuario'; end if;
end $$;
revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- =====================================================================================================
-- 2. Torneos: configuración
-- =====================================================================================================
alter table public.events
  add column organizer_id uuid references auth.users(id) on delete set null,
  add column template text not null default 'single',
  add column config jsonb not null default '{}',
  add column players_min int not null default 5,
  add column players_max int not null default 7,
  add column status text not null default 'registration',
  add column tie_pending jsonb,
  add constraint events_template_check check (template in ('single', 'double', 'groups', 'swiss')),
  add constraint events_status_check check (status in ('registration', 'in_progress', 'finished', 'cancelled')),
  add constraint events_players_check check (players_min between 1 and 10 and players_max between players_min and 10);
comment on column public.events.organizer_id is 'Quien creó el torneo (organizador o admin); lo gestiona junto con los admins';
comment on column public.events.template is 'Plantilla: single (eliminación directa), double, groups (grupos + playoffs) o swiss (suizo + playoffs)';
comment on column public.events.config is 'Números de la plantilla (BO de cada fase, grupos, suizo, 3.er puesto, mapa de ventaja, versiones de mapas decisivos). Lo normaliza event_config()';
comment on column public.events.tie_pending is 'Empate de grupos que los criterios no resolvieron: {grp, teams}. Lo resuelve el organizador con event_resolve_tie';

-- Lo que había en las columnas viejas pasa a la plantilla (en producción no hay torneos al 2026-10-15).
update public.events set
  template = case format when 'double' then 'double' when 'groups' then 'groups' else 'single' end,
  config = case format
    when 'double' then jsonb_build_object('bo', best_of, 'bo_upper_final', best_of, 'bo_lower_final', best_of, 'bo_grand_final', final_bo)
    when 'groups' then jsonb_build_object('groups', group_count, 'advance', advance, 'double_rr', double_rr, 'bo_group', best_of,
                                          'playoffs', jsonb_build_object('bo', best_of, 'bo_semi', best_of, 'bo_final', final_bo))
    else jsonb_build_object('bo', best_of, 'bo_semi', best_of, 'bo_final', final_bo) end,
  status = case when champion is not null then 'finished' when generated then 'in_progress' else 'registration' end;
-- Las inscripciones pasan a hacerse con event_register / event_unregister (las políticas viejas usaban events.stage).
drop policy "inscripciones: duenio o capitan inscribe" on public.tournament_registrations;
drop policy "inscripciones: duenio o capitan se da de baja" on public.tournament_registrations;
alter table public.events
  drop constraint events_format_check,
  drop column format, drop column stage, drop column best_of, drop column final_bo, drop column group_count,
  drop column advance, drop column double_rr, drop column generated;

alter table public.matches
  add column phase int,
  add column advantage_side smallint,
  add constraint matches_advantage_side_check check (advantage_side in (1, 2));
alter table public.matches drop constraint matches_end_reason_check;
alter table public.matches add constraint matches_end_reason_check check (end_reason is null or end_reason in ('surrender', 'walkover', 'crash'));   -- crash: migración 20261017120000_mixes_en_vivo
comment on column public.matches.phase is 'Torneos: fase (1 = primera; en suizo, la fase suiza; los playoffs van después)';
comment on column public.matches.advantage_side is 'Gran final con mapa de ventaja: bando que empieza 1-0';

alter table public.tournament_registrations
  add column start_stage int not null default 1,
  add constraint tournament_registrations_start_stage check (start_stage between 1 and 3);
comment on column public.tournament_registrations.start_stage is 'Suizo: fase en la que empieza el equipo (1 por defecto)';

-- Equipos de cada fase de grupos o suiza, con su siembra (y el orden que fija el organizador en un empate).
create table public.event_stage_teams (
  event_id    uuid not null references public.events(id) on delete cascade,
  stage       text not null check (stage in ('group', 'swiss')),
  phase       int not null,
  grp         int not null default 1,
  team_id     uuid not null references public.teams(id) on delete cascade,
  seed        int not null,
  manual_rank int,
  primary key (event_id, stage, phase, team_id)
);
alter table public.event_stage_teams enable row level security;
create policy event_stage_teams_ver on public.event_stage_teams for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.event_stage_teams from anon, authenticated;

-- Completa una configuración con sus valores por defecto (solo las claves conocidas).
create function public.event_config_pick(p_defaults jsonb, p_given jsonb) returns jsonb
  language sql immutable as $$
  select p_defaults || coalesce((select jsonb_object_agg(key, value) from jsonb_each(coalesce(p_given, '{}'))
                                  where p_defaults ? key and value <> 'null'::jsonb), '{}')
$$;

-- Normaliza y valida la configuración de una plantilla (completa los valores por defecto).
create function public.event_config(p_template text, p_config jsonb) returns jsonb
  language plpgsql immutable set search_path = public as $$
declare
  c   jsonb := coalesce(p_config, '{}');
  po  jsonb := '{"bo": 3, "bo_semi": 3, "bo_final": 3, "third_place": false, "bo_third": 3}';
  out jsonb;
  k   text;
  v   jsonb;
begin
  out := case p_template
    when 'single' then event_config_pick(po, c)
    when 'double' then event_config_pick('{"bo": 3, "bo_upper_final": 3, "bo_lower_final": 3, "bo_grand_final": 5, "advantage": false}', c)
    when 'groups' then event_config_pick('{"groups": 2, "advance": 2, "double_rr": false, "bo_group": 1}', c)
                       || jsonb_build_object('playoffs', event_config_pick(po, c->'playoffs'))
    when 'swiss' then event_config_pick('{"stages": 1, "size": 16, "wins": 3, "bo": 1, "bo_decisive": 3}', c)
                       || jsonb_build_object('playoffs', event_config_pick(po, c->'playoffs'))
  end;
  if out is null then raise exception 'La plantilla tiene que ser single, double, groups o swiss'; end if;
  out := out || jsonb_build_object('decider_versions', coalesce(c->'decider_versions', '{}'));
  if jsonb_typeof(out->'decider_versions') <> 'object' then raise exception 'decider_versions tiene que ser un objeto mapa → versión'; end if;
  -- Todos los BO tienen que ser 1, 3 o 5.
  for k, v in select key, value from jsonb_each(out) union all select 'playoffs.' || key, value from jsonb_each(coalesce(out->'playoffs', '{}')) loop
    if k ~ '(^|\.)bo' and v::text not in ('1', '3', '5') then
      raise exception 'Los formatos tienen que ser BO1, BO3 o BO5 (%)', k;
    end if;
    if k ~ '(third_place|advantage|double_rr)$' and jsonb_typeof(v) <> 'boolean' then raise exception '% tiene que ser true o false', k; end if;
  end loop;
  if p_template = 'groups' then
    if jsonb_typeof(out->'groups') <> 'number' or (out->>'groups')::int not between 1 and 16 then raise exception 'Los grupos tienen que ser entre 1 y 16'; end if;
    if jsonb_typeof(out->'advance') <> 'number' or (out->>'advance')::int not between 1 and 8 then raise exception 'Clasifican entre 1 y 8 equipos por grupo'; end if;
  end if;
  if p_template = 'swiss' then
    if (out->>'stages') not in ('1', '2', '3') then raise exception 'El suizo tiene entre 1 y 3 fases'; end if;
    if (out->>'size') not in ('8', '16') then raise exception 'Cada fase suiza tiene 8 o 16 equipos'; end if;
    if (out->>'wins') not in ('2', '3') then raise exception 'En el suizo se clasifica con 2 o 3 victorias (y se queda afuera con las mismas derrotas)'; end if;
  end if;
  return out;
end $$;

-- Quién gestiona un torneo: el admin, o el organizador que lo creó.
create function public.can_manage_event(p_event uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from events e join profiles p on p.id = e.organizer_id
     where e.id = p_event and e.organizer_id = auth.uid() and p.role = 'organizer')
$$;
grant execute on function public.can_manage_event(uuid) to anon, authenticated;

-- Las funciones del motor marcan la transacción para poder cambiar estado y campeón.
create function public.event_engine_on() returns void language sql as $$ select set_config('v34.engine', '1', true) $$;
revoke all on function public.event_engine_on() from public, anon, authenticated;

create function public.events_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
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
end $$;
create trigger events_guard before insert or update on public.events for each row execute function public.events_guard();

create function public.events_safe_delete() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from matches where event_id = old.id and status = 'finished' and not bye) then
    raise exception '% tiene partidas jugadas: no se puede borrar (se puede cancelar)', old.name;
  end if;
  return old;
end $$;
create trigger events_safe_delete before delete on public.events for each row execute function public.events_safe_delete();

drop policy "torneos: admin gestiona" on public.events;
create policy "torneos: crear" on public.events for insert to authenticated with check (is_organizer() and (organizer_id = auth.uid() or is_admin()));
create policy "torneos: gestionar" on public.events for update to authenticated using (can_manage_event(id)) with check (can_manage_event(id));
create policy "torneos: borrar" on public.events for delete to authenticated using (can_manage_event(id));

-- =====================================================================================================
-- 3. Inscripción con jugadores
-- =====================================================================================================
create table public.tournament_registration_players (
  event_id  uuid not null references public.events(id) on delete cascade,
  team_id   uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key (event_id, player_id)
);
create index tournament_registration_players_team on public.tournament_registration_players (event_id, team_id);
comment on table public.tournament_registration_players is 'Jugadores que inscribe cada equipo en un torneo. Un jugador, un equipo por torneo';
alter table public.tournament_registration_players enable row level security;
create policy trp_ver on public.tournament_registration_players for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.tournament_registration_players from anon, authenticated;

-- Las inscripciones se hacen solo con event_register / event_unregister.
drop trigger tournament_registrations_plantel on public.tournament_registrations;
drop function public.tournament_registrations_plantel();
drop trigger tournament_registrations_unicos on public.tournament_registrations;
drop function public.tournament_registrations_unicos();

-- Inscribir o cambiar los inscritos de un equipo. El capitán, mientras el torneo está en inscripciones;
-- el organizador o el admin, hasta que se genera el fixture (después, solo cambiar jugadores).
create function public.event_register(p_event uuid, p_team uuid, p_players uuid[], p_start_stage int default null) returns void
  language plpgsql security definer set search_path = public as $$
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
end $$;

create function public.event_unregister(p_event uuid, p_team uuid) returns void
  language plpgsql security definer set search_path = public as $$
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
end $$;
revoke all on function public.event_register(uuid, uuid, uuid[], int) from public, anon;
revoke all on function public.event_unregister(uuid, uuid) from public, anon;
grant execute on function public.event_register(uuid, uuid, uuid[], int) to authenticated;
grant execute on function public.event_unregister(uuid, uuid) to authenticated;

-- Quien sale de un equipo deja de estar inscrito en los torneos sin terminar.
create function public.team_members_unregister() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  delete from tournament_registration_players r using events e
   where r.event_id = e.id and e.status in ('registration', 'in_progress')
     and r.team_id = new.team_id and r.player_id = new.player_id;
  return null;
end $$;
create trigger team_members_unregister after update of left_at on public.team_members
  for each row when (old.left_at is null and new.left_at is not null) execute function public.team_members_unregister();

-- Jugadores que cuentan en el servidor para un equipo en una partida: en torneo, los inscritos;
-- en PCW, el roster del bando.
create function public.match_roster(p_match uuid, p_team uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
  select r.player_id from matches m join tournament_registration_players r on r.event_id = m.event_id and r.team_id = p_team
   where m.id = p_match and m.event_id is not null
  union
  select tm.player_id from matches m join team_members tm on tm.team_id = p_team and tm.left_at is null
   where m.id = p_match and m.event_id is null
$$;
revoke all on function public.match_roster(uuid, uuid) from public, anon, authenticated;

-- =====================================================================================================
-- 4. Motor de torneos
-- =====================================================================================================

-- Orden de siembra de una llave de S equipos (1 contra S, 2 contra S-1… repartidos por mitades).
create function public.event_seed_order(s int) returns int[]
  language plpgsql immutable as $$
declare o int[] := array[1, 2]; r int[]; n int; x int;
begin
  while cardinality(o) < s loop
    n := cardinality(o) * 2; r := '{}';
    foreach x in array o loop r := r || x || (n + 1 - x); end loop;
    o := r;
  end loop;
  return o[1:s];
end $$;

-- Marca como vacíos (dead) los lugares que nunca van a tener equipo, para resolver los byes.
create function public.event_propagate_dead(p_event uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int;
begin
  loop
    update matches t set dead1 = true from matches m
     where m.event_id = p_event and m.next_win = t.id and m.next_win_slot = 1 and m.dead1 and m.dead2 and not t.dead1;
    get diagnostics a = row_count;
    update matches t set dead2 = true from matches m
     where m.event_id = p_event and m.next_win = t.id and m.next_win_slot = 2 and m.dead1 and m.dead2 and not t.dead2;
    get diagnostics b = row_count;
    update matches t set dead1 = true from matches m
     where m.event_id = p_event and m.next_lose = t.id and m.next_lose_slot = 1 and (m.dead1 or m.dead2) and not t.dead1;
    get diagnostics c = row_count;
    update matches t set dead2 = true from matches m
     where m.event_id = p_event and m.next_lose = t.id and m.next_lose_slot = 2 and (m.dead1 or m.dead2) and not t.dead2;
    get diagnostics d = row_count;
    exit when a + b + c + d = 0;
  end loop;
end $$;

-- Llave de eliminación directa (playoffs) con byes y 3.er puesto opcional.
create function public.event_build_ko(p_event uuid, p_teams uuid[], p_phase int, p_cfg jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  n   int := cardinality(p_teams);
  s   int := 2;
  k   int := 1;
  r   int;
  i   int;
  ord int[];
  a   int;
  b   int;
  third uuid;
begin
  if n < 2 then raise exception 'Hacen falta al menos 2 equipos para la llave'; end if;
  while s < n loop s := s * 2; k := k + 1; end loop;
  for r in 1 .. k loop
    for i in 1 .. s / (2 ^ r)::int loop
      insert into matches(event_id, kind, stage, phase, round, pos, status, best_of)
      values (p_event, 'official', 'ko', p_phase, r, i, 'upcoming',
              case when r = k then (p_cfg->>'bo_final')::int when r = k - 1 then (p_cfg->>'bo_semi')::int else (p_cfg->>'bo')::int end);
    end loop;
  end loop;
  update matches m set next_win = t.id, next_win_slot = case when m.pos % 2 = 1 then 1 else 2 end
    from matches t
   where m.event_id = p_event and m.stage = 'ko' and m.phase = p_phase and m.round < k
     and t.event_id = p_event and t.stage = 'ko' and t.phase = p_phase and t.round = m.round + 1 and t.pos = (m.pos + 1) / 2;
  if coalesce((p_cfg->>'third_place')::boolean, false) and k >= 2 then
    insert into matches(event_id, kind, stage, phase, round, pos, status, best_of)
    values (p_event, 'official', 'third', p_phase, k, 1, 'upcoming', (p_cfg->>'bo_third')::int) returning id into third;
    update matches set next_lose = third, next_lose_slot = case when pos % 2 = 1 then 1 else 2 end
     where event_id = p_event and stage = 'ko' and phase = p_phase and round = k - 1;
  end if;
  ord := event_seed_order(s);
  for i in 1 .. s / 2 loop
    a := ord[2 * i - 1]; b := ord[2 * i];
    update matches set
      team1 = case when a <= n then p_teams[a] end, dead1 = a > n,
      team2 = case when b <= n then p_teams[b] end, dead2 = b > n
     where event_id = p_event and stage = 'ko' and phase = p_phase and round = 1 and pos = i;
  end loop;
  perform event_propagate_dead(p_event);
end $$;

-- Doble eliminación: upper, lower y gran final (sin reset; mapa de ventaja opcional).
create function public.event_build_double(p_event uuid, p_teams uuid[], p_cfg jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  n   int := cardinality(p_teams);
  s   int := 4;
  k   int := 2;
  r   int;
  i   int;
  c   int;
  ord int[];
  a   int;
  b   int;
  g   uuid;
  adv boolean := coalesce((p_cfg->>'advantage')::boolean, false) and (p_cfg->>'bo_grand_final')::int > 1;
begin
  if n < 2 then raise exception 'Hacen falta al menos 2 equipos para la llave'; end if;
  while s < n loop s := s * 2; k := k + 1; end loop;
  for r in 1 .. k loop
    for i in 1 .. s / (2 ^ r)::int loop
      insert into matches(event_id, kind, stage, phase, round, pos, status, best_of)
      values (p_event, 'official', 'upper', 1, r, i, 'upcoming', case when r = k then (p_cfg->>'bo_upper_final')::int else (p_cfg->>'bo')::int end);
    end loop;
  end loop;
  for r in 1 .. 2 * k - 2 loop
    c := s / (2 ^ (floor((r + 1) / 2.0)::int + 1))::int;
    for i in 1 .. c loop
      insert into matches(event_id, kind, stage, phase, round, pos, status, best_of)
      values (p_event, 'official', 'lower', 1, r, i, 'upcoming', case when r = 2 * k - 2 then (p_cfg->>'bo_lower_final')::int else (p_cfg->>'bo')::int end);
    end loop;
  end loop;
  insert into matches(event_id, kind, stage, phase, round, pos, status, best_of, advantage_side, score1, score2)
  values (p_event, 'official', 'grand', 1, 1, 1, 'upcoming', (p_cfg->>'bo_grand_final')::int,
          case when adv then 1 end, case when adv then 1 end, case when adv then 0 end)
  returning id into g;
  -- Upper: el ganador sube de ronda; la final del upper va a la gran final (lugar 1).
  update matches m set next_win = t.id, next_win_slot = case when m.pos % 2 = 1 then 1 else 2 end from matches t
   where m.event_id = p_event and m.stage = 'upper' and m.round < k
     and t.event_id = p_event and t.stage = 'upper' and t.round = m.round + 1 and t.pos = (m.pos + 1) / 2;
  update matches set next_win = g, next_win_slot = 1 where event_id = p_event and stage = 'upper' and round = k;
  -- Perdedores del upper: la ronda 1 llena la ronda 1 del lower; las demás, las rondas pares (lugar 2).
  update matches m set next_lose = t.id, next_lose_slot = case when m.pos % 2 = 1 then 1 else 2 end from matches t
   where m.event_id = p_event and m.stage = 'upper' and m.round = 1
     and t.event_id = p_event and t.stage = 'lower' and t.round = 1 and t.pos = (m.pos + 1) / 2;
  update matches m set next_lose = t.id, next_lose_slot = 2 from matches t
   where m.event_id = p_event and m.stage = 'upper' and m.round >= 2
     and t.event_id = p_event and t.stage = 'lower' and t.round = 2 * m.round - 2 and t.pos = m.pos;
  -- Lower: en las rondas impares el ganador pasa a la misma posición; en las pares se juntan de a dos.
  update matches m set next_win = t.id, next_win_slot = 1 from matches t
   where m.event_id = p_event and m.stage = 'lower' and m.round % 2 = 1 and m.round < 2 * k - 2
     and t.event_id = p_event and t.stage = 'lower' and t.round = m.round + 1 and t.pos = m.pos;
  update matches m set next_win = t.id, next_win_slot = case when m.pos % 2 = 1 then 1 else 2 end from matches t
   where m.event_id = p_event and m.stage = 'lower' and m.round % 2 = 0 and m.round < 2 * k - 2
     and t.event_id = p_event and t.stage = 'lower' and t.round = m.round + 1 and t.pos = (m.pos + 1) / 2;
  update matches set next_win = g, next_win_slot = 2 where event_id = p_event and stage = 'lower' and round = 2 * k - 2;
  ord := event_seed_order(s);
  for i in 1 .. s / 2 loop
    a := ord[2 * i - 1]; b := ord[2 * i];
    update matches set
      team1 = case when a <= n then p_teams[a] end, dead1 = a > n,
      team2 = case when b <= n then p_teams[b] end, dead2 = b > n
     where event_id = p_event and stage = 'upper' and round = 1 and pos = i;
  end loop;
  perform event_propagate_dead(p_event);
end $$;

-- Fase de grupos: reparto en serpentina por siembra y todos contra todos (método del círculo).
create function public.event_build_groups(p_event uuid, p_teams uuid[], p_cfg jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  g   int := (p_cfg->>'groups')::int;
  n   int := cardinality(p_teams);
  i   int;
  fila int;
  col int;
  gi  int;
  lista uuid[];
  m   int;
  r   int;
  j   int;
  nr  int;
  np  int;
  x   uuid;
  y   uuid;
begin
  if n < g * 2 then raise exception 'Con % grupos hacen falta al menos % equipos', g, g * 2; end if;
  for i in 1 .. n loop
    fila := (i - 1) / g; col := (i - 1) % g;
    gi := case when fila % 2 = 0 then col + 1 else g - col end;
    insert into event_stage_teams(event_id, stage, phase, grp, team_id, seed) values (p_event, 'group', 1, gi, p_teams[i], i);
  end loop;
  for gi in 1 .. g loop
    select array_agg(st.team_id order by st.seed) into lista from event_stage_teams st where st.event_id = p_event and st.stage = 'group' and st.grp = gi;
    if cardinality(lista) <= (p_cfg->>'advance')::int then
      raise exception 'Cada grupo necesita más equipos que clasificados (grupo con %)', cardinality(lista);
    end if;
    if cardinality(lista) % 2 = 1 then lista := lista || null::uuid; end if;
    m := cardinality(lista); nr := m - 1;
    for r in 1 .. nr loop
      np := 0;
      for j in 1 .. m / 2 loop
        x := lista[j]; y := lista[m + 1 - j];
        if x is not null and y is not null then
          np := np + 1;
          insert into matches(event_id, kind, stage, phase, grp, round, pos, status, best_of, team1, team2)
          values (p_event, 'official', 'group', 1, gi, r, np, 'upcoming', (p_cfg->>'bo_group')::int, x, y);
          if coalesce((p_cfg->>'double_rr')::boolean, false) then
            insert into matches(event_id, kind, stage, phase, grp, round, pos, status, best_of, team1, team2)
            values (p_event, 'official', 'group', 1, gi, nr + r, np, 'upcoming', (p_cfg->>'bo_group')::int, y, x);
          end if;
        end if;
      end loop;
      lista := lista[1:1] || lista[m:m] || lista[2:m - 1];
    end loop;
  end loop;
end $$;

-- Rondas de una partida (para la diferencia de rondas): suma de r1 y r2 de sus mapas.
create function public.match_rounds(p_maps jsonb) returns int[]
  language sql immutable as $$
  select array[coalesce(sum((e->>'r1')::int), 0)::int, coalesce(sum((e->>'r2')::int), 0)::int]
    from jsonb_array_elements(coalesce(p_maps, '[]')) e
$$;

-- Tabla de grupos: partidas terminadas de la fase de grupos.
create view public.event_group_standings with (security_invoker = true) as
with res as (
  select m.event_id, m.grp, m.team1 as team_id, m.team2 as rival, m.winner_side = 1 as gano, m.winner_side = 2 as perdio,
         (match_rounds(m.maps))[1] as rf, (match_rounds(m.maps))[2] as ra
    from matches m where m.stage = 'group' and m.status = 'finished' and not m.bye
  union all
  select m.event_id, m.grp, m.team2, m.team1, m.winner_side = 2, m.winner_side = 1,
         (match_rounds(m.maps))[2], (match_rounds(m.maps))[1]
    from matches m where m.stage = 'group' and m.status = 'finished' and not m.bye
)
select st.event_id, st.grp, st.team_id, st.seed, st.manual_rank,
       count(r.*)::int as played,
       count(r.*) filter (where r.gano)::int as won,
       count(r.*) filter (where r.perdio)::int as lost,
       (count(r.*) filter (where r.gano) * 3 + count(r.*) filter (where not r.gano and not r.perdio))::int as points,
       coalesce(sum(r.rf), 0)::int as rounds_for,
       coalesce(sum(r.ra), 0)::int as rounds_against,
       (coalesce(sum(r.rf), 0) - coalesce(sum(r.ra), 0))::int as rounds_diff
  from event_stage_teams st
  left join res r on r.event_id = st.event_id and r.grp = st.grp and r.team_id = st.team_id
 where st.stage = 'group'
 group by st.event_id, st.grp, st.team_id, st.seed, st.manual_rank;
grant select on public.event_group_standings to anon, authenticated;

-- Orden de un grupo: puntos, diferencia de rondas, resultado entre los empatados (mini tabla),
-- rondas ganadas y el orden que fijó el organizador. tied = empatado en todo con el de al lado.
create function public.event_group_order(p_event uuid, p_grp int) returns table (team_id uuid, place int, tied boolean)
  language sql stable security definer set search_path = public as $$
  with s as (select * from event_group_standings where event_id = p_event and grp = p_grp),
  h as (
    select s.team_id,
           coalesce((select sum(case when (m.team1 = s.team_id and m.winner_side = 1) or (m.team2 = s.team_id and m.winner_side = 2) then 3
                                     when m.winner_side is null then 1 else 0 end)
                       from matches m join s o on o.team_id = case when m.team1 = s.team_id then m.team2 else m.team1 end
                      where m.event_id = p_event and m.stage = 'group' and m.grp = p_grp and m.status = 'finished' and not m.bye
                        and s.team_id in (m.team1, m.team2) and o.team_id <> s.team_id
                        and o.points = s.points and o.rounds_diff = s.rounds_diff), 0) as h2h
      from s
  ),
  o as (
    select s.team_id, s.points, s.rounds_diff, h.h2h, s.rounds_for, s.manual_rank, s.seed,
           row_number() over (order by s.points desc, s.rounds_diff desc, h.h2h desc, s.rounds_for desc, s.manual_rank nulls last, s.seed) as pos
      from s join h using (team_id)
  )
  select o.team_id, o.pos::int,
         exists (select 1 from o o2 where o2.team_id <> o.team_id and abs(o2.pos - o.pos) = 1
                   and (o2.points, o2.rounds_diff, o2.h2h, o2.rounds_for) = (o.points, o.rounds_diff, o.h2h, o.rounds_for)
                   and (o.manual_rank is null or o2.manual_rank is null))
    from o order by o.pos
$$;
grant execute on function public.event_group_order(uuid, int) to anon, authenticated;

-- Tabla del suizo: récord, Buchholz (suma de victorias menos derrotas de los rivales) y rondas.
create view public.event_swiss_standings with (security_invoker = true) as
with res as (
  select m.event_id, m.phase, m.team1 as team_id, m.team2 as rival, m.winner_side = 1 as gano, m.winner_side = 2 as perdio,
         (match_rounds(m.maps))[1] as rf, (match_rounds(m.maps))[2] as ra
    from matches m where m.stage = 'swiss' and m.status = 'finished'
  union all
  select m.event_id, m.phase, m.team2, m.team1, m.winner_side = 2, m.winner_side = 1,
         (match_rounds(m.maps))[2], (match_rounds(m.maps))[1]
    from matches m where m.stage = 'swiss' and m.status = 'finished'
),
rec as (
  select st.event_id, st.phase, st.team_id, st.seed,
         count(r.*) filter (where r.gano)::int as wins,
         count(r.*) filter (where r.perdio)::int as losses,
         (coalesce(sum(r.rf), 0) - coalesce(sum(r.ra), 0))::int as rounds_diff
    from event_stage_teams st
    left join res r on r.event_id = st.event_id and r.phase = st.phase and r.team_id = st.team_id
   where st.stage = 'swiss'
   group by st.event_id, st.phase, st.team_id, st.seed
)
select rec.*,
       coalesce((select sum(o.wins - o.losses) from res r join rec o on o.event_id = r.event_id and o.phase = r.phase and o.team_id = r.rival
                  where r.event_id = rec.event_id and r.phase = rec.phase and r.team_id = rec.team_id), 0)::int as buchholz,
       case when rec.wins >= (e.config->>'wins')::int then 'qualified'
            when rec.losses >= (e.config->>'wins')::int then 'eliminated' else 'active' end as state
  from rec join events e on e.id = rec.event_id;
grant select on public.event_swiss_standings to anon, authenticated;

-- Empareja la ronda siguiente de una fase suiza: mismo récord, sin repetir rival, mejor Buchholz contra peor.
create function public.event_swiss_round(p_event uuid, p_phase int) returns void
  language plpgsql security definer set search_path = public as $$
declare
  cfg   jsonb := (select config from events where id = p_event);
  w     int := (cfg->>'wins')::int;
  r     int := coalesce((select max(mm.round) from matches mm where mm.event_id = p_event and mm.stage = 'swiss' and mm.phase = p_phase), 0) + 1;
  pool  record;
  lista uuid[];
  arrastre uuid[] := '{}';
  usado uuid[];
  i     int;
  j     int;
  elegido int;
  np    int := 0;
  a     uuid;
  b     uuid;
  wa    int; la int; wb int; lb int;
begin
  for pool in
    select ss.wins, ss.losses, array_agg(ss.team_id order by ss.buchholz desc, ss.rounds_diff desc, ss.seed) as equipos
      from event_swiss_standings ss where ss.event_id = p_event and ss.phase = p_phase and ss.state = 'active'
     group by ss.wins, ss.losses order by ss.wins desc, ss.losses
  loop
    lista := arrastre || pool.equipos;
    arrastre := '{}';
    usado := '{}';
    for i in 1 .. cardinality(lista) loop
      continue when lista[i] = any(usado);
      a := lista[i];
      elegido := null;
      -- El rival: el último disponible que no haya jugado contra a; si no hay, el último disponible.
      for j in reverse cardinality(lista) .. i + 1 loop
        continue when lista[j] = any(usado);
        if elegido is null then elegido := j; end if;
        if not exists (select 1 from matches m where m.event_id = p_event and m.stage = 'swiss' and m.phase = p_phase
                         and ((m.team1 = a and m.team2 = lista[j]) or (m.team1 = lista[j] and m.team2 = a))) then
          elegido := j; exit;
        end if;
      end loop;
      if elegido is null then
        arrastre := array[a];   -- impar: baja al grupo siguiente
        exit;
      end if;
      b := lista[elegido];
      usado := usado || a || b;
      select ss.wins, ss.losses into wa, la from event_swiss_standings ss where ss.event_id = p_event and ss.phase = p_phase and ss.team_id = a;
      select ss.wins, ss.losses into wb, lb from event_swiss_standings ss where ss.event_id = p_event and ss.phase = p_phase and ss.team_id = b;
      np := np + 1;
      insert into matches(event_id, kind, stage, phase, round, pos, status, best_of, team1, team2)
      values (p_event, 'official', 'swiss', p_phase, r, np, 'upcoming',
              case when greatest(wa, wb, la, lb) = w - 1 then (cfg->>'bo_decisive')::int else (cfg->>'bo')::int end, a, b);
    end loop;
  end loop;
end $$;

-- Arranca una fase suiza: inscritos que empiezan en ella más los clasificados de la anterior.
create function public.event_swiss_phase(p_event uuid, p_phase int) returns void
  language plpgsql security definer set search_path = public as $$
declare
  e      events%rowtype;
  equipos uuid[];
  directos uuid[];
  n      int;
  i      int;
  size   int;
begin
  select * into e from events where id = p_event;
  size := (e.config->>'size')::int;
  select coalesce(array_agg(r.team_id order by coalesce(array_position(e.seeds, r.team_id), 1000), r.created_at, t.name), '{}') into directos
    from tournament_registrations r join teams t on t.id = r.team_id where r.event_id = p_event and r.start_stage = p_phase;
  if p_phase = 1 then
    equipos := directos;
  else
    select directos || coalesce(array_agg(team_id order by wins desc, losses, buchholz desc, rounds_diff desc, seed), '{}') into equipos
      from event_swiss_standings where event_id = p_event and phase = p_phase - 1 and state = 'qualified';
  end if;
  n := cardinality(equipos);
  if n <> size then
    raise exception 'La fase suiza % necesita % equipos y tiene %', p_phase, size, n;
  end if;
  for i in 1 .. n loop
    insert into event_stage_teams(event_id, stage, phase, team_id, seed) values (p_event, 'swiss', p_phase, equipos[i], i);
  end loop;
  -- Primera ronda por siembra: 1 contra n/2+1, 2 contra n/2+2…
  for i in 1 .. n / 2 loop
    insert into matches(event_id, kind, stage, phase, round, pos, status, best_of, team1, team2)
    values (p_event, 'official', 'swiss', p_phase, 1, i, 'upcoming',
            case when (e.config->>'wins')::int = 1 then (e.config->>'bo_decisive')::int else (e.config->>'bo')::int end,
            equipos[i], equipos[i + n / 2]);
  end loop;
end $$;

-- Clasificados de los grupos, sembrados para que dos del mismo grupo no se crucen en la primera ronda.
create function public.event_group_qualifiers(p_event uuid) returns uuid[]
  language plpgsql security definer set search_path = public as $$
declare
  cfg  jsonb := (select config from events where id = p_event);
  g    int := (cfg->>'groups')::int;
  adv  int := (cfg->>'advance')::int;
  s1   uuid[] := '{}';
  s2   uuid[] := '{}';
  fila uuid[];
  p    int;
  grp  int;
  t    uuid;
begin
  for p in 1 .. adv loop
    fila := '{}';
    for grp in 1 .. g loop
      select o.team_id into t from event_group_order(p_event, grp) o where o.place = p;
      if t is not null then fila := fila || t; end if;
    end loop;
    s1 := s1 || fila;
    s2 := s2 || case when p % 2 = 0 then array(select fila[x] from generate_series(cardinality(fila), 1, -1) x) else fila end;
  end loop;
  return case when event_group_clashes(p_event, s2) < event_group_clashes(p_event, s1) then s2 else s1 end;
end $$;

create function public.event_group_clashes(p_event uuid, p_seeds uuid[]) returns int
  language plpgsql stable security definer set search_path = public as $$
declare s int := 2; o int[]; c int := 0; i int; a uuid; b uuid;
begin
  while s < cardinality(p_seeds) loop s := s * 2; end loop;
  o := event_seed_order(s);
  i := 1;
  while i < s loop
    a := case when o[i] <= cardinality(p_seeds) then p_seeds[o[i]] end;
    b := case when o[i + 1] <= cardinality(p_seeds) then p_seeds[o[i + 1]] end;
    if a is not null and b is not null and
       (select grp from event_stage_teams where event_id = p_event and stage = 'group' and team_id = a) =
       (select grp from event_stage_teams where event_id = p_event and stage = 'group' and team_id = b) then
      c := c + 1;
    end if;
    i := i + 2;
  end loop;
  return c;
end $$;

-- Avanza el torneo: lleva ganadores y perdedores, resuelve byes, arma rondas y fases nuevas y marca el campeón.
-- Es idempotente: se puede llamar cuantas veces haga falta.
create function public.event_progress(p_event uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  e     events%rowtype;
  n     int;
  total int;
  fase  int;
  champ uuid;
  fin   record;
  tie   record;
  q     uuid[];
begin
  perform event_engine_on();
  select * into e from events where id = p_event for update;
  if not found or e.status not in ('in_progress', 'finished') then return; end if;
  loop
    total := 0;
    -- Ganadores al lugar que les toca (solo en partidas que todavía no empezaron).
    update matches t set team1 = m.winner from matches m
     where m.event_id = p_event and m.status = 'finished' and m.winner is not null and m.next_win = t.id and m.next_win_slot = 1
       and t.status = 'upcoming' and t.team1 is distinct from m.winner;
    get diagnostics n = row_count; total := total + n;
    update matches t set team2 = m.winner from matches m
     where m.event_id = p_event and m.status = 'finished' and m.winner is not null and m.next_win = t.id and m.next_win_slot = 2
       and t.status = 'upcoming' and t.team2 is distinct from m.winner;
    get diagnostics n = row_count; total := total + n;
    -- Perdedores (doble eliminación y 3.er puesto).
    update matches t set team1 = case when m.winner = m.team1 then m.team2 else m.team1 end from matches m
     where m.event_id = p_event and m.status = 'finished' and not m.bye and m.winner is not null and m.next_lose = t.id and m.next_lose_slot = 1
       and t.status = 'upcoming' and t.team1 is distinct from case when m.winner = m.team1 then m.team2 else m.team1 end;
    get diagnostics n = row_count; total := total + n;
    update matches t set team2 = case when m.winner = m.team1 then m.team2 else m.team1 end from matches m
     where m.event_id = p_event and m.status = 'finished' and not m.bye and m.winner is not null and m.next_lose = t.id and m.next_lose_slot = 2
       and t.status = 'upcoming' and t.team2 is distinct from case when m.winner = m.team1 then m.team2 else m.team1 end;
    get diagnostics n = row_count; total := total + n;
    -- Byes: sin rival posible, pasa el que está (o nadie si los dos lugares están vacíos).
    update matches set status = 'finished', bye = true, winner = null
     where event_id = p_event and status = 'upcoming' and dead1 and dead2;
    get diagnostics n = row_count; total := total + n;
    update matches set status = 'finished', bye = true, winner = coalesce(team1, team2)
     where event_id = p_event and status = 'upcoming' and dead1 <> dead2
       and ((dead1 and team2 is not null) or (dead2 and team1 is not null));
    get diagnostics n = row_count; total := total + n;
    exit when total = 0;
  end loop;

  -- Grupos terminados: playoffs (salvo un empate que tenga que resolver el organizador).
  if e.template = 'groups' and not exists (select 1 from matches where event_id = p_event and stage = 'ko')
     and exists (select 1 from matches where event_id = p_event and stage = 'group')
     and not exists (select 1 from matches where event_id = p_event and stage = 'group' and status <> 'finished') then
    select o.team_id, g.gi into tie
      from generate_series(1, (e.config->>'groups')::int) g(gi), event_group_order(p_event, g.gi) o
     where o.tied and o.place <= (e.config->>'advance')::int + 1
     limit 1;
    if found then
      update events set tie_pending = jsonb_build_object('grp', tie.gi) where id = p_event and tie_pending is distinct from jsonb_build_object('grp', tie.gi);
      return;
    end if;
    update events set tie_pending = null where id = p_event and tie_pending is not null;
    q := event_group_qualifiers(p_event);
    if cardinality(q) = 1 then
      -- Un solo clasificado (un grupo que clasifica a uno, como una liga): es el campeón.
      update events set champion = q[1], status = 'finished' where id = p_event;
      return;
    end if;
    perform event_build_ko(p_event, q, 2, e.config->'playoffs');
    perform event_progress(p_event);
    return;
  end if;

  -- Suizo: ronda terminada → ronda siguiente, fase siguiente o playoffs.
  if e.template = 'swiss' and not exists (select 1 from matches where event_id = p_event and stage = 'ko') then
    fase := (select max(mm.phase) from matches mm where mm.event_id = p_event and mm.stage = 'swiss');
    if fase is not null and not exists (select 1 from matches where event_id = p_event and stage = 'swiss' and phase = fase and status <> 'finished') then
      if exists (select 1 from event_swiss_standings where event_id = p_event and phase = fase and state = 'active') then
        perform event_swiss_round(p_event, fase);
      elsif fase < (e.config->>'stages')::int then
        perform event_swiss_phase(p_event, fase + 1);
      else
        select array_agg(ss.team_id order by ss.wins desc, ss.losses, ss.buchholz desc, ss.rounds_diff desc, ss.seed) into q
          from event_swiss_standings ss where ss.event_id = p_event and ss.phase = fase and ss.state = 'qualified';
        perform event_build_ko(p_event, q, fase + 1, e.config->'playoffs');
      end if;
      perform event_progress(p_event);
      return;
    end if;
  end if;

  -- Campeón: la gran final (doble eliminación) o la final de los playoffs.
  if e.template = 'double' then
    select * into fin from matches where event_id = p_event and stage = 'grand';
  else
    select * into fin from matches where event_id = p_event and stage = 'ko' order by phase desc, round desc limit 1;
  end if;
  champ := case when fin.status = 'finished' then fin.winner end;
  if champ is distinct from e.champion or (case when champ is null then 'in_progress' else 'finished' end) <> e.status then
    update events set champion = champ, status = case when champ is null then 'in_progress' else 'finished' end where id = p_event;
  end if;
end $$;

-- Genera el fixture según la plantilla y la siembra.
create function public.event_generate(p_event uuid) returns void
  language plpgsql security definer set search_path = public as $$
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
end $$;

-- Borra el fixture si no se jugó ninguna partida.
create function public.event_reset(p_event uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not can_manage_event(p_event) then raise exception 'Solo el organizador del torneo o un admin puede reiniciarlo' using errcode = '42501'; end if;
  perform event_engine_on();
  if exists (select 1 from matches where event_id = p_event and (status = 'live' or (status = 'finished' and not bye))) then
    raise exception 'Ya se jugaron partidas: el fixture no se puede reiniciar';
  end if;
  delete from matches where event_id = p_event;
  delete from event_stage_teams where event_id = p_event;
  update events set status = 'registration', champion = null, tie_pending = null where id = p_event and status <> 'cancelled';
end $$;

-- Deshace el avance de una partida en las siguientes (y en los byes que se resolvieron por ella).
create function public.event_unroute(p_match uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; t matches%rowtype; dest record;
begin
  select * into m from matches where id = p_match;
  for dest in select m.next_win as id, m.next_win_slot as slot union all select m.next_lose, m.next_lose_slot loop
    continue when dest.id is null;
    select * into t from matches where id = dest.id;
    if t.status in ('live') or (t.status = 'finished' and not t.bye) then
      raise exception 'Ya se jugaron partidas que dependen de esta: corregí primero esas';
    end if;
    if t.status = 'finished' and t.bye and not (t.dead1 and t.dead2) then
      perform event_unroute(t.id);
      update matches set status = 'upcoming', bye = false, winner = null where id = t.id;
    end if;
    if dest.slot = 1 then update matches set team1 = null where id = t.id; else update matches set team2 = null where id = t.id; end if;
  end loop;
end $$;

-- Resultado a mano del organizador o del admin: mapas con rondas, W.O. o anular (p_clear).
create function public.event_set_result(p_match uuid, p_maps jsonb default null, p_walkover_winner uuid default null, p_clear boolean default false)
  returns void language plpgsql security definer set search_path = public as $$
declare
  m     matches%rowtype;
  e     record;
  w1    int := 0;
  w2    int := 0;
  hace  int;
  gan   uuid;
  x     jsonb;
begin
  select * into m from matches where id = p_match for update;
  if not found or m.kind <> 'official' or m.event_id is null then raise exception 'Esa partida no es de un torneo'; end if;
  if not can_manage_event(m.event_id) then raise exception 'Solo el organizador del torneo o un admin puede cargar resultados' using errcode = '42501'; end if;
  if m.bye or m.team1 is null or m.team2 is null then raise exception 'La partida todavía no tiene los dos equipos'; end if;
  perform event_engine_on();
  perform set_config('v34.no_progress', '1', true);
  -- No se corrige una partida de grupos o suiza si ya se armó lo que dependía de ella.
  if m.status = 'finished' and m.stage = 'group' and exists (select 1 from matches where event_id = m.event_id and stage = 'ko') then
    raise exception 'Ya se generaron los playoffs: no se puede cambiar un resultado de grupos';
  end if;
  if m.status = 'finished' and m.stage = 'swiss' and exists (
       select 1 from matches where event_id = m.event_id and ((stage = 'swiss' and (phase > m.phase or (phase = m.phase and round > m.round))) or stage = 'ko')) then
    raise exception 'Ya se armó la ronda siguiente: no se puede cambiar este resultado';
  end if;
  if m.status = 'finished' then perform event_unroute(p_match); end if;
  if p_clear then
    update matches set status = 'upcoming', winner = null, maps = null, map = null, end_reason = null,
      score1 = case when advantage_side = 1 then 1 when advantage_side = 2 then 0 end,
      score2 = case when advantage_side = 2 then 1 when advantage_side = 1 then 0 end
     where id = p_match;
  elsif p_walkover_winner is not null then
    if p_walkover_winner not in (m.team1, m.team2) then raise exception 'El ganador del W.O. tiene que ser uno de los dos equipos'; end if;
    update matches set status = 'finished', winner = p_walkover_winner, maps = null, map = null, score1 = null, score2 = null,
      end_reason = 'walkover' where id = p_match;
  else
    if jsonb_typeof(p_maps) <> 'array' or jsonb_array_length(p_maps) < 1 or jsonb_array_length(p_maps) > m.best_of then
      raise exception 'Cargá entre 1 y % mapas', m.best_of;
    end if;
    for x in select value from jsonb_array_elements(p_maps) loop
      if (x->>'r1') !~ '^\d{1,2}$' or (x->>'r2') !~ '^\d{1,2}$' then raise exception 'Cada mapa necesita las rondas de los dos equipos (0 a 99)'; end if;
      if (x->>'r1')::int = (x->>'r2')::int then raise exception 'Un mapa no puede terminar empatado (se juega overtime)'; end if;
      if (x->>'r1')::int > (x->>'r2')::int then w1 := w1 + 1; else w2 := w2 + 1; end if;
    end loop;
    w1 := w1 + case when m.advantage_side = 1 then 1 else 0 end;
    w2 := w2 + case when m.advantage_side = 2 then 1 else 0 end;
    hace := m.best_of / 2 + 1;
    if greatest(w1, w2) < hace or least(w1, w2) >= hace then raise exception 'Con esos mapas la serie no queda definida (BO%)', m.best_of; end if;
    gan := case when w1 > w2 then m.team1 else m.team2 end;
    update matches set status = 'finished', winner = gan, maps = p_maps, score1 = w1, score2 = w2, end_reason = null,
      map = (select string_agg(coalesce(nullif(y->>'map', ''), '?'), ', ') from jsonb_array_elements(p_maps) y)
     where id = p_match;
  end if;
  perform set_config('v34.no_progress', '', true);
  perform event_progress(m.event_id);
end $$;

-- El organizador fija el orden de equipos empatados en un grupo (los criterios no lo resolvieron).
create function public.event_resolve_tie(p_event uuid, p_grp int, p_order uuid[]) returns void
  language plpgsql security definer set search_path = public as $$
declare i int;
begin
  if not can_manage_event(p_event) then raise exception 'Solo el organizador del torneo o un admin resuelve empates' using errcode = '42501'; end if;
  if exists (select 1 from unnest(p_order) u where not exists (
       select 1 from event_stage_teams where event_id = p_event and stage = 'group' and grp = p_grp and team_id = u)) then
    raise exception 'Algún equipo no es de ese grupo';
  end if;
  update event_stage_teams set manual_rank = null where event_id = p_event and stage = 'group' and grp = p_grp;
  for i in 1 .. cardinality(p_order) loop
    update event_stage_teams set manual_rank = i where event_id = p_event and stage = 'group' and grp = p_grp and team_id = p_order[i];
  end loop;
  perform event_progress(p_event);
end $$;

-- Hora y servidor de una partida del torneo.
create function public.match_schedule(p_match uuid, p_starts_at timestamptz, p_server uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare m matches%rowtype;
begin
  select * into m from matches where id = p_match;
  if not found then raise exception 'No existe esa partida'; end if;
  if not (is_admin() or (m.event_id is not null and can_manage_event(m.event_id))) then
    raise exception 'Solo el organizador del torneo o un admin' using errcode = '42501';
  end if;
  if p_server is not null and not exists (select 1 from game_servers where id = p_server and active) then raise exception 'Ese servidor no existe o no está activo'; end if;
  update matches set starts_at = p_starts_at, server_id = p_server,
    server_ip = (select connect_address from game_servers where id = p_server) where id = p_match;
end $$;

revoke all on function public.event_generate(uuid) from public, anon;
revoke all on function public.event_reset(uuid) from public, anon;
revoke all on function public.event_set_result(uuid, jsonb, uuid, boolean) from public, anon;
revoke all on function public.event_resolve_tie(uuid, int, uuid[]) from public, anon;
revoke all on function public.match_schedule(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.event_generate(uuid) to authenticated;
grant execute on function public.event_reset(uuid) to authenticated;
grant execute on function public.event_set_result(uuid, jsonb, uuid, boolean) to authenticated;
grant execute on function public.event_resolve_tie(uuid, int, uuid[]) to authenticated;
grant execute on function public.match_schedule(uuid, timestamptz, uuid) to authenticated;
revoke all on function public.event_progress(uuid) from public, anon, authenticated;
revoke all on function public.event_unroute(uuid) from public, anon, authenticated;
revoke all on function public.event_build_ko(uuid, uuid[], int, jsonb) from public, anon, authenticated;
revoke all on function public.event_build_double(uuid, uuid[], jsonb) from public, anon, authenticated;
revoke all on function public.event_build_groups(uuid, uuid[], jsonb) from public, anon, authenticated;
revoke all on function public.event_swiss_round(uuid, int) from public, anon, authenticated;
revoke all on function public.event_swiss_phase(uuid, int) from public, anon, authenticated;
revoke all on function public.event_group_qualifiers(uuid) from public, anon, authenticated;
revoke all on function public.event_propagate_dead(uuid) from public, anon, authenticated;

-- Cuando termina (o cambia) una partida de torneo, el torneo avanza solo. También con !match.
create function public.matches_event_progress() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() = 1 and current_setting('v34.no_progress', true) is distinct from '1'
     and current_setting('v34.engine', true) is distinct from '1' then
    perform event_progress(new.event_id);
  end if;
  return null;
end $$;
create trigger matches_event_progress after update of status, winner on public.matches
  for each row when (new.event_id is not null and new.kind = 'official'
                     and (old.status is distinct from new.status or old.winner is distinct from new.winner))
  execute function public.matches_event_progress();

-- El ranking no cuenta los W.O.
create or replace view public.team_standings with (security_invoker = true) as
with jugadas as (
  select m.team1 as team_id, m.winner_side = 1 as gano, 'official' as tipo from matches m
   where m.kind = 'official' and m.status = 'finished' and not coalesce(m.bye, false) and m.winner_side is not null
     and m.team1 is not null and m.team2 is not null and m.end_reason is distinct from 'walkover'
     and not (coalesce(m.stage, '') <> '' and (m.event_id is null or not exists (select 1 from events e where e.id = m.event_id)))
  union all
  select m.team2, m.winner_side = 2, 'official' from matches m
   where m.kind = 'official' and m.status = 'finished' and not coalesce(m.bye, false) and m.winner_side is not null
     and m.team1 is not null and m.team2 is not null and m.end_reason is distinct from 'walkover'
     and not (coalesce(m.stage, '') <> '' and (m.event_id is null or not exists (select 1 from events e where e.id = m.event_id)))
  union all
  select s.parent_team_id, m.winner_side = 1, 'pcw' from matches m join teams s on s.id = m.team1
   where m.kind = 'pcw' and m.status = 'finished' and m.winner_side is not null and s.parent_team_id is not null
  union all
  select s.parent_team_id, m.winner_side = 2, 'pcw' from matches m join teams s on s.id = m.team2
   where m.kind = 'pcw' and m.status = 'finished' and m.winner_side is not null and s.parent_team_id is not null
)
select t.id as team_id, t.name, t.tag,
       count(j.*) filter (where j.tipo = 'official')::int                 as official_played,
       count(j.*) filter (where j.tipo = 'official' and j.gano)::int      as official_won,
       count(j.*) filter (where j.tipo = 'official' and not j.gano)::int  as official_lost,
       count(j.*) filter (where j.tipo = 'pcw')::int                      as pcw_played,
       count(j.*) filter (where j.tipo = 'pcw' and j.gano)::int           as pcw_won,
       count(j.*) filter (where j.tipo = 'pcw' and not j.gano)::int       as pcw_lost,
       (count(j.*) filter (where j.tipo = 'official' and j.gano) * c.win_official)::int as official_points,
       (count(j.*) filter (where j.tipo = 'pcw' and j.gano) * c.win_pcw)::int           as pcw_points
  from teams t
  cross join ranking_config c
  left join jugadas j on j.team_id = t.id
 where t.kind = 'official'
 group by t.id, t.name, t.tag, c.win_official, c.win_pcw;

-- =====================================================================================================
-- 5. Código de !match oculto, pool de mapas, veto y chat
-- =====================================================================================================
revoke select on public.matches from anon, authenticated;
do $$
begin
  execute 'grant select (' || (select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
                                 from information_schema.columns
                                where table_schema = 'public' and table_name = 'matches' and column_name <> 'link_code')
          || ') on public.matches to anon, authenticated';
end $$;

-- Servidores activos para elegir en una partida (nombre y dirección, que ya se muestran en cada partida).
create view public.game_servers_public as
select id, name, connect_address from game_servers where active;
grant select on public.game_servers_public to anon, authenticated;

-- Quién participa de una partida: plantel activo de los dos equipos (o del roster del bando de PCW) y sus capitanes.
create function public.is_match_participant(p_match uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches m join teams t on t.id in (m.team1, m.team2)
     where m.id = p_match and (t.captain_id = auth.uid() or t.owner_id = auth.uid()
       or exists (select 1 from team_members tm join players p on p.id = tm.player_id
                   where tm.team_id = t.id and tm.left_at is null and p.user_id = auth.uid())))
$$;
grant execute on function public.is_match_participant(uuid) to anon, authenticated;

create function public.match_link_code(p_match uuid) returns text
  language sql stable security definer set search_path = public as $$
  select m.link_code from matches m
   where m.id = p_match and m.kind <> 'mix'
     and (is_admin() or (m.event_id is not null and can_manage_event(m.event_id)) or is_match_participant(p_match))
$$;
revoke all on function public.match_link_code(uuid) from public, anon;
grant execute on function public.match_link_code(uuid) to authenticated;

create table public.map_pool (
  name     text primary key,
  versions text[] not null,
  position int not null default 0,
  active   boolean not null default true,
  constraint map_pool_versions check (cardinality(versions) between 1 and 5 and name = versions[1])
);
comment on table public.map_pool is 'Mapas del veto. versions: nombres de mapa del servidor (el primero es el nombre del mapa); Inferno tiene dos';
insert into public.map_pool(name, versions, position) values
  ('de_dust2_ob', '{de_dust2_ob}', 1), ('de_cache', '{de_cache}', 2), ('de_cbble', '{de_cbble}', 3),
  ('de_inferno', '{de_inferno,de_inferno_classic}', 4), ('de_mirage_rc1', '{de_mirage_rc1}', 5),
  ('de_nuke_old_blue', '{de_nuke_old_blue}', 6), ('de_season', '{de_season}', 7), ('de_tuscan', '{de_tuscan}', 8);
alter table public.map_pool enable row level security;
create policy map_pool_ver on public.map_pool for select to anon, authenticated using (true);
create policy map_pool_admin on public.map_pool for all to authenticated using (is_admin()) with check (is_admin());
revoke insert, update, delete, truncate on public.map_pool from anon;

alter table public.match_vetos add column version text;
comment on column public.match_vetos.version is 'Pick de un mapa con versiones: la versión elegida';
drop policy "vetos: capitan en su turno" on public.match_vetos;

-- Secuencia del veto (como la web vieja): BO3 y BO5 empiezan con dos bans; BO3 sigue con dos picks,
-- BO5 con cuatro; el resto se banea hasta que queda un mapa, que es el decisivo.
create function public.veto_sequence(p_bo int, p_maps int) returns text[]
  language plpgsql immutable as $$
declare a text[] := '{}';
begin
  if p_bo >= 3 then a := a || array['ban', 'ban']; end if;
  if p_bo = 3 then a := a || array['pick', 'pick']; end if;
  if p_bo >= 5 then a := a || array['pick', 'pick', 'pick', 'pick']; end if;
  while cardinality(a) < p_maps - 1 loop a := a || 'ban'::text; end loop;
  return a[1:p_maps - 1];
end $$;

create function public.veto_act(p_match uuid, p_map text, p_version text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare
  m      matches%rowtype;
  seq    text[];
  n      int;
  turno  uuid;
  mp     map_pool%rowtype;
  accion text;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into m from matches where id = p_match for update;
  if not found or m.kind = 'mix' then raise exception 'Esa partida no tiene veto'; end if;
  if m.status <> 'upcoming' or m.team1 is null or m.team2 is null then raise exception 'El veto se hace antes de empezar, con los dos equipos definidos'; end if;
  seq := veto_sequence(m.best_of, (select count(*)::int from map_pool where active));
  n := (select count(*) from match_vetos where match_id = p_match);
  if n >= cardinality(seq) then raise exception 'El veto ya terminó'; end if;
  turno := case when n % 2 = 0 then m.team1 else m.team2 end;
  if not exists (select 1 from teams where id = turno and captain_id = auth.uid()) then
    raise exception 'Es el turno del capitán de %', (select name from teams where id = turno) using errcode = '42501';
  end if;
  select * into mp from map_pool where name = p_map and active;
  if not found then raise exception 'Ese mapa no está en el pool'; end if;
  if exists (select 1 from match_vetos where match_id = p_match and map = p_map) then raise exception 'Ese mapa ya se vetó o se eligió'; end if;
  accion := seq[n + 1];
  if accion = 'pick' and cardinality(mp.versions) > 1 and (p_version is null or not (p_version = any(mp.versions))) then
    raise exception 'Elegí la versión del mapa: %', array_to_string(mp.versions, ' o ');
  end if;
  insert into match_vetos(match_id, seq, team_id, map, action, by_user, version)
  values (p_match, n + 1, turno, p_map, accion, auth.uid(), case when accion = 'pick' then coalesce(p_version, mp.versions[1]) end);
end $$;

create function public.veto_reset(p_match uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare m matches%rowtype;
begin
  select * into m from matches where id = p_match;
  if not found then raise exception 'No existe esa partida'; end if;
  if not (is_admin() or (m.event_id is not null and can_manage_event(m.event_id))) then
    raise exception 'Solo el organizador del torneo o un admin reinicia el veto' using errcode = '42501';
  end if;
  delete from match_vetos where match_id = p_match;
end $$;
revoke all on function public.veto_act(uuid, text, text) from public, anon;
revoke all on function public.veto_reset(uuid) from public, anon;
grant execute on function public.veto_act(uuid, text, text) to authenticated;
grant execute on function public.veto_reset(uuid) to authenticated;

-- Chat: en torneos y PCW escriben los participantes, el organizador y los admins; en los mixes, cualquiera con sesión.
create function public.match_chat_can_write(p_match uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from matches m where m.id = p_match
       and (m.kind = 'mix' or is_admin() or (m.event_id is not null and can_manage_event(m.event_id)) or is_match_participant(p_match)))
$$;
grant execute on function public.match_chat_can_write(uuid) to anon, authenticated;
drop policy "Usuarios autenticados pueden enviar mensajes" on public.match_chat;
create policy "chat: escribir" on public.match_chat for insert to authenticated
  with check (auth.uid() = user_id and match_chat_can_write(match_id));

-- Mensajes con el alias del autor (sin el email).
create view public.match_chat_public as
select c.id, c.match_id, c.user_id, coalesce(p.tag, c.tag, 'Usuario') as alias, c.message, c.created_at
  from match_chat c left join profiles p on p.id = c.user_id;
grant select on public.match_chat_public to anon, authenticated;

-- =====================================================================================================
-- 6. !match: inscritos en torneos y mapa de ventaja
-- =====================================================================================================
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 10: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.csstv_match_lookup(text, text)', array[
  ['x.link_code, x.team1, x.team2,', 'x.link_code, x.team1, x.team2, e.players_min, -- (replanteo 10) inscritos y mínimo del torneo' || E'\n        '],
  ['from team_members tm join players p on p.id = tm.player_id' || E'\n                        where tm.team_id = m.team1 and tm.left_at is null and p.steam_id is not null',
   'from match_roster(m.id, m.team1) r join players p on p.id = r' || E'\n                        where p.steam_id is not null'],
  ['from team_members tm join players p on p.id = tm.player_id' || E'\n                        where tm.team_id = m.team2 and tm.left_at is null and p.steam_id is not null',
   'from match_roster(m.id, m.team2) r join players p on p.id = r' || E'\n                        where p.steam_id is not null'],
  ['''min_roster='' || case when m.kind = ''pcw'' then 3 else 5 end,', '''min_roster='' || case when m.kind = ''pcw'' then 3 else coalesce(m.players_min, 5) end,']
]);

select pg_temp.reemplazar('public.csstv_link_game(uuid, text, integer)', array[
  ['select 1 from team_members tm where tm.team_id = ta and tm.player_id = s.player_id and tm.left_at is null',
   'select 1 from match_roster(par.id, ta) rr where rr = s.player_id'],
  ['select 1 from team_members tm where tm.team_id = tb and tm.player_id = s.player_id and tm.left_at is null',
   'select 1 from match_roster(par.id, tb) rr where rr = s.player_id'],
  ['    into w1, w2 from jsonb_array_elements(nuevos) e;',
   '    into w1, w2 from jsonb_array_elements(nuevos) e;' || E'\n  -- (replanteo 10) mapa de ventaja\n  w1 := w1 + case when par.advantage_side = 1 then 1 else 0 end;\n  w2 := w2 + case when par.advantage_side = 2 then 1 else 0 end;']
]);

-- Sale el control de torneos de la 09 (pasa a los inscritos).
select pg_temp.reemplazar('public.team_members_rules()', array[
  [E'  -- Un jugador no puede estar en dos equipos inscritos en el mismo torneo (sin campeón todavía).\n  select e.name as torneo, t2.name as equipo into x\n    from tournament_registrations r\n    join events e on e.id = r.event_id and e.champion is null\n    join tournament_registrations r2 on r2.event_id = r.event_id and r2.team_id <> r.team_id\n    join team_members m2 on m2.team_id = r2.team_id and m2.player_id = new.player_id and m2.left_at is null\n    join teams t2 on t2.id = r2.team_id\n   where r.team_id = new.team_id\n   limit 1;\n  if found then\n    raise exception ''% ya está inscrito en el torneo % con %'', pl.nick, x.torneo, x.equipo;\n  end if;\n',
   E'  -- (replanteo 10) el control de torneos pasa a los inscritos (tournament_registration_players)\n']
]);

-- =====================================================================================================
-- 7. PCW
-- =====================================================================================================
create function public.pcw_side_team(p_side uuid, p_team uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if p_team is null then return; end if;
  if not exists (select 1 from teams where id = p_team and kind = 'official'
                   and (captain_id = auth.uid() or owner_id = auth.uid() or is_admin())) then
    raise exception 'Solo el capitán o el dueño de un equipo oficial puede jugar como ese equipo' using errcode = '42501';
  end if;
  update teams set parent_team_id = p_team where id = p_side;
end $$;
revoke all on function public.pcw_side_team(uuid, uuid) from public, anon, authenticated;

drop function public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[]);
create function public.create_pcw_post(p_name text, p_best_of integer, p_maps text, p_starts_at timestamp with time zone,
                                       p_note text, p_players uuid[], p_guests text[], p_team uuid default null)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tid uuid; pid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform pcw_cleanup();
  if p_best_of not in (1, 3, 5) then raise exception 'El formato tiene que ser BO1, BO3 o BO5'; end if;
  -- (replanteo 08) solo los formatos que habilitó el admin
  if not exists (select 1 from pcw_config c where c.id = 1 and p_best_of = any(c.best_of)) then
    raise exception 'El formato BO% no está habilitado para las PCW', p_best_of;
  end if;
  if exists (select 1 from pcw_posts where by_user = auth.uid() and status = 'open') then
    raise exception 'Ya tenés un anuncio abierto. Cancelalo para publicar otro.';
  end if;
  if (select count(*) from pcw_posts where by_user = auth.uid() and created_at > now() - interval '1 day') >= 6 then
    raise exception 'Alcanzaste el límite de anuncios por día';
  end if;
  tid := pcw_make_side(p_name, p_players, p_guests);
  -- (replanteo 10) jugar como un equipo oficial
  perform pcw_side_team(tid, p_team);
  insert into pcw_posts(team_id, by_user, best_of, maps, starts_at, note, status)
  values (tid, auth.uid(), p_best_of, left(nullif(trim(p_maps), ''), 120), p_starts_at, left(nullif(trim(p_note), ''), 200), 'open')
  returning id into pid;
  return pid;
end $function$;

drop function public.accept_pcw(uuid, text, uuid[], text[]);
create function public.accept_pcw(p_post uuid, p_name text, p_players uuid[], p_guests text[], p_team uuid default null)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare po pcw_posts%rowtype; tid uuid; mid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into po from pcw_posts where id = p_post for update;
  if not found or po.status <> 'open' then raise exception 'Este anuncio ya no está disponible'; end if;
  if po.by_user = auth.uid() then raise exception 'No podés aceptar tu propio anuncio'; end if;
  tid := pcw_make_side(p_name, p_players, p_guests);
  -- (replanteo 10) jugar como un equipo oficial
  perform pcw_side_team(tid, p_team);
  if exists (select 1 from team_members a join team_members b on b.player_id = a.player_id where a.team_id = po.team_id and b.team_id = tid and a.left_at is null and b.left_at is null) then
    raise exception 'Hay jugadores que están en los dos rosters';
  end if;
  if exists (select 1 from teams a, teams b, unnest(a.guests) x, unnest(b.guests) y
             where a.id = po.team_id and b.id = tid and lower(x) = lower(y)) then
    raise exception 'Hay tags repetidos entre los dos rosters';
  end if;
  insert into matches(team1, team2, status, starts_at, best_of, kind)
  values (po.team_id, tid, 'upcoming', po.starts_at, po.best_of, 'pcw')
  returning id into mid;
  update pcw_posts set status = 'matched', match_id = mid where id = p_post;
  return mid;
end $function$;
revoke all on function public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid) from public, anon;
revoke all on function public.accept_pcw(uuid, text, uuid[], text[], uuid) from public, anon;
grant execute on function public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid) to authenticated;
grant execute on function public.accept_pcw(uuid, text, uuid[], text[], uuid) to authenticated;

-- Una PCW con mapas jugados no se cancela.
select pg_temp.reemplazar('public.cancel_pcw_match(uuid)', array[
  ['if m.status = ''finished'' then raise exception ''La práctica ya terminó''; end if;',
   'if m.status = ''finished'' then raise exception ''La práctica ya terminó''; end if;' || E'\n  -- (replanteo 10) con mapas jugados ya no se cancela\n  if exists (select 1 from matches c where c.parent_match_id = p_match) then raise exception ''Ya se jugaron mapas de esta práctica: no se puede cancelar''; end if;']
]);

-- PCW sin jugar a las 48 h de su hora (o de su publicación, si no tiene hora): se cancelan.
select pg_temp.reemplazar('public.pcw_cleanup()', array[
  [E'    and not exists (select 1 from matches m where m.team1 = t.id or m.team2 = t.id);\nend',
   E'    and not exists (select 1 from matches m where m.team1 = t.id or m.team2 = t.id);\n  -- (replanteo 10) PCW vencidas: 48 h después de su hora sin mapas jugados\n  with vencidas as (\n    select m.id from matches m join pcw_posts p on p.match_id = m.id\n     where m.kind = ''pcw'' and m.status = ''upcoming'' and coalesce(m.starts_at, p.created_at) < now() - interval ''48 hours''\n       and not exists (select 1 from matches c where c.parent_match_id = m.id)),\n  anuncios as (update pcw_posts set status = ''cancelled'' where match_id in (select id from vencidas))\n  delete from matches where id in (select id from vencidas);\n  delete from teams t where t.kind = ''pcw''\n    and not exists (select 1 from matches m where m.team1 = t.id or m.team2 = t.id)\n    and not exists (select 1 from pcw_posts p where p.team_id = t.id and p.status = ''open'');\nend']
]);

-- Resultado a mano de una PCW: solo el admin.
create function public.pcw_set_result(p_match uuid, p_maps jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; w1 int := 0; w2 int := 0; x jsonb;
begin
  if not is_admin() then raise exception 'Solo un admin carga el resultado de una PCW' using errcode = '42501'; end if;
  select * into m from matches where id = p_match for update;
  if not found or m.kind <> 'pcw' then raise exception 'Esa partida no es una PCW'; end if;
  if jsonb_typeof(p_maps) <> 'array' or jsonb_array_length(p_maps) < 1 or jsonb_array_length(p_maps) > m.best_of then
    raise exception 'Cargá entre 1 y % mapas', m.best_of;
  end if;
  for x in select value from jsonb_array_elements(p_maps) loop
    if (x->>'r1') !~ '^\d{1,2}$' or (x->>'r2') !~ '^\d{1,2}$' or (x->>'r1')::int = (x->>'r2')::int then
      raise exception 'Cada mapa necesita las rondas de los dos equipos, sin empate';
    end if;
    if (x->>'r1')::int > (x->>'r2')::int then w1 := w1 + 1; else w2 := w2 + 1; end if;
  end loop;
  if greatest(w1, w2) < m.best_of / 2 + 1 then raise exception 'Con esos mapas la serie no queda definida (BO%)', m.best_of; end if;
  update matches set status = 'finished', maps = p_maps, score1 = w1, score2 = w2,
    winner = case when w1 > w2 then m.team1 else m.team2 end,
    map = (select string_agg(coalesce(nullif(y->>'map', ''), '?'), ', ') from jsonb_array_elements(p_maps) y)
   where id = p_match;
end $$;
revoke all on function public.pcw_set_result(uuid, jsonb) from public, anon;
grant execute on function public.pcw_set_result(uuid, jsonb) to authenticated;

-- =====================================================================================================
-- 8. Se quitan los reportes de los capitanes
-- =====================================================================================================
drop table public.result_reports;
drop function public.validate_report();
drop function public.autoapply_pcw();
drop policy if exists "proofs: todos ven" on storage.objects;
drop policy if exists "proofs: el capitan sube" on storage.objects;
drop policy if exists "proofs: admin borra" on storage.objects;

commit;

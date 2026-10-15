-- Replanteo 05: tabla team_members en lugar del arreglo teams.members (plan, sección 2.2).
-- Clave foránea real (sin ids colgados), rol y fechas de alta y baja: el historial de equipos de un
-- jugador sale de acá. teams.guests (invitados sin jugador, en equipos PCW) se queda.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.team_members') is not null then
    raise exception 'replanteo 05: team_members ya existe (¿ya se aplicó?)';
  end if;
  if exists (select 1 from public.teams where kind = 'mix') then
    raise exception 'replanteo 05: quedan equipos mix (aplicar antes 04_mixes_bandos.sql)';
  end if;
end $$;

-- ---------- 1. tabla ----------
create table public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  role       text not null default 'player' check (role in ('player', 'sub', 'coach')),
  joined_at  timestamptz,            -- null = desconocida (miembros migrados del arreglo)
  left_at    timestamptz,            -- null = sigue en el equipo
  created_at timestamptz not null default now(),
  constraint team_members_fechas check (left_at is null or joined_at is null or left_at >= joined_at)
);
comment on table public.team_members is 'Plantel de cada equipo con historial: una fila por paso de un jugador por un equipo';
-- Un jugador figura activo una sola vez por equipo.
create unique index team_members_activo on public.team_members (team_id, player_id) where left_at is null;
create index team_members_player on public.team_members (player_id);

alter table public.team_members enable row level security;
create policy "miembros: todos ven" on public.team_members for select using (true);
create policy "miembros: admin gestiona" on public.team_members for all using (public.is_admin()) with check (public.is_admin());
grant all on table public.team_members to anon, authenticated, service_role;

-- ---------- 2. datos ----------
insert into public.team_members (team_id, player_id)
select distinct t.id, x.player_id
  from public.teams t
 cross join lateral unnest(t.members) as x(player_id)
 where exists (select 1 from public.players p where p.id = x.player_id);

do $$
declare colgados int;
begin
  select count(*) into colgados
    from public.teams t cross join lateral unnest(t.members) as x(player_id)
   where not exists (select 1 from public.players p where p.id = x.player_id);
  if colgados > 0 then
    raise notice 'replanteo 05: % ids de teams.members apuntaban a jugadores que ya no existen y no se migraron', colgados;
  end if;
end $$;

-- ---------- 3. funciones ----------
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 05: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Equipo PCW: el roster va a team_members.
select pg_temp.reemplazar('public.pcw_make_side(text, uuid[], text[])', array[
  [E'  insert into teams(name, tag, owner_id, captain_id, members, guests, kind)\n  values (nombre, ''PCW'', auth.uid(), auth.uid(), p_players, vistos, ''pcw'')\n  returning id into tid;',
   E'  insert into teams(name, tag, owner_id, captain_id, guests, kind)\n  values (nombre, ''PCW'', auth.uid(), auth.uid(), vistos, ''pcw'')\n  returning id into tid;\n  insert into team_members(team_id, player_id, joined_at) select tid, x, now() from unnest(p_players) x;']
]);

-- Aceptar una PCW: nadie puede estar en los dos rosters.
select pg_temp.reemplazar('public.accept_pcw(uuid, text, uuid[], text[])', array[
  ['if exists (select 1 from teams a, teams b where a.id = po.team_id and b.id = tid and a.members && b.members) then',
   'if exists (select 1 from team_members a join team_members b on b.player_id = a.player_id where a.team_id = po.team_id and b.team_id = tid and a.left_at is null and b.left_at is null) then']
]);

-- Cambiar de capitán: el nuevo tiene que estar en el plantel actual.
select pg_temp.reemplazar('public.set_team_captain(uuid, uuid)', array[
  [E'    select 1 from teams t join players p on p.id = any(t.members)\n    where t.id = p_team and p.user_id = p_user) then',
   E'    select 1 from team_members tm join players p on p.id = tm.player_id\n    where tm.team_id = p_team and tm.left_at is null and p.user_id = p_user) then']
]);

-- Reporte de resultado: la alineación sale del plantel actual.
select pg_temp.reemplazar('public.validate_report()', array[
  ['select coalesce(members, ''{}'') into roster from teams where id = new.team_id;',
   'select coalesce(array_agg(player_id), ''{}'') into roster from team_members where team_id = new.team_id and left_at is null;']
]);

do $$
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and prosrc ~* '\mmembers\M') then
    raise exception 'replanteo 05: todavía hay funciones que usan teams.members';
  end if;
end $$;

-- ---------- 4. sacar el arreglo ----------
alter table public.teams drop column members;

commit;

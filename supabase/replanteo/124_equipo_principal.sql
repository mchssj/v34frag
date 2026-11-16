-- Replanteo 124: el equipo principal del jugador (bitácora docs/bitacora/2026-11-16-equipo-principal).
-- Un jugador puede estar en varios equipos oficiales. Ahora elige cuál es el principal (players.primary_team_id);
-- si no eligió, o ya no está en ese equipo, el principal es el más antiguo. Las listas de equipos de un jugador
-- (player_overview y season_standings_list, y con ellas player_ranking y los widgets) ponen primero el principal
-- y después siguen por fecha de ingreso, como antes. No cambia ninguna regla de torneos, PCW ni ranking de equipos.
-- Va después de la 123.
begin;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'players' and column_name = 'primary_team_id') then
    raise exception 'replanteo 124: players ya tiene primary_team_id (¿ya se aplicó?)';
  end if;
  if position('tm.joined_at NULLS FIRST' in pg_get_viewdef('public.player_overview'::regclass, true)) = 0
     or position('tm.joined_at NULLS FIRST' in pg_get_viewdef('public.season_standings_list'::regclass, true)) = 0 then
    raise exception 'replanteo 124: player_overview o season_standings_list no ordenan los equipos por tm.joined_at NULLS FIRST';
  end if;
end $$;

-- ---------- 1. la columna ----------
alter table public.players add column primary_team_id uuid references public.teams(id) on delete set null;
comment on column public.players.primary_team_id is
  'Equipo oficial que el jugador marcó como principal (null = el más antiguo). Vuelve a null al salir de ese equipo (replanteo 124)';

-- ---------- 2. al salir del equipo, deja de ser el principal ----------
create function public.tg_team_members_primary_clear() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' or (new.left_at is not null and old.left_at is null) then
    update players set primary_team_id = null where id = old.player_id and primary_team_id = old.team_id;
  end if;
  return null;
end $$;
create trigger team_members_primary_clear after update of left_at or delete on public.team_members
  for each row execute function public.tg_team_members_primary_clear();

-- ---------- 3. el orden: 0 el principal, 1 los demás ----------
create function public.team_primary_order(p_player uuid, p_team uuid) returns int
  language sql stable set search_path = public as $$
  select case when exists (select 1 from players where id = p_player and primary_team_id = p_team) then 0 else 1 end
$$;
comment on function public.team_primary_order(uuid, uuid) is '0 si el equipo es el principal del jugador, 1 si no: para ordenar sus equipos (replanteo 124)';
grant execute on function public.team_primary_order(uuid, uuid) to anon, authenticated;

-- ---------- 4. marcar el principal ----------
create function public.set_my_primary_team(p_team uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select id into pid from players where user_id = auth.uid() limit 1;
  if pid is null then
    raise exception 'Tu cuenta no tiene un jugador vinculado' using errcode = 'V3901';
  end if;
  if p_team is not null and not exists (
    select 1 from team_members tm join teams t on t.id = tm.team_id
     where tm.player_id = pid and tm.team_id = p_team and tm.left_at is null
       and t.kind = 'official' and t.dissolved_at is null
  ) then
    raise exception 'Solo puedes marcar como principal un equipo en el que estás' using errcode = 'V3901';
  end if;
  update players set primary_team_id = p_team where id = pid;
  return p_team;
end $$;
comment on function public.set_my_primary_team(uuid) is 'El jugador de la sesión marca su equipo principal (null = el más antiguo) (replanteo 124)';
revoke all on function public.set_my_primary_team(uuid) from public, anon;
grant execute on function public.set_my_primary_team(uuid) to authenticated;

-- ---------- 5. las listas: primero el principal ----------
do $$
declare v text; d text;
begin
  foreach v in array array['public.player_overview', 'public.season_standings_list'] loop
    d := pg_get_viewdef(v::regclass, true);
    d := replace(d, 'ORDER BY tm.joined_at NULLS FIRST', 'ORDER BY (team_primary_order(tm.player_id, tm.team_id)), tm.joined_at NULLS FIRST');
    execute format('create or replace view %s with (security_invoker = true) as %s', v, d);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;

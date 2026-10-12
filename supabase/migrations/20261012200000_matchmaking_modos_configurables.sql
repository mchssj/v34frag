-- Matchmaking configurable por formato (1v1, 2v2, 3v3, 5v5).
-- Los modos alternativos quedan deshabilitados por defecto para que el admin los habilite desde el panel.

begin;

create table if not exists public.matchmaking_modes (
  mode text primary key check (mode in ('1v1','2v2','3v3','5v5')),
  players_per_team integer not null check (players_per_team in (1,2,3,5)),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.matchmaking_modes(mode, players_per_team, enabled)
values ('1v1',1,false),('2v2',2,false),('3v3',3,false),('5v5',5,true)
on conflict (mode) do nothing;
alter table public.matchmaking_modes enable row level security;
revoke all on public.matchmaking_modes from anon, authenticated;

alter table public.matchmaking_queue
  add column if not exists mode text not null default '5v5';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matchmaking_queue_mode_check') then
    alter table public.matchmaking_queue add constraint matchmaking_queue_mode_check
      check (mode in ('1v1','2v2','3v3','5v5'));
  end if;
end $$;
create index if not exists matchmaking_queue_waiting_mode_idx
  on public.matchmaking_queue(mode, joined_at) where status = 'waiting';

alter table public.matches add column if not exists matchmaking_mode text;
update public.matches m
set matchmaking_mode = coalesce(m.matchmaking_mode, '5v5')
where exists (select 1 from public.matchmaking_queue q where q.match_id = m.id);
alter table public.matches add constraint matches_matchmaking_mode_check
  check (matchmaking_mode is null or matchmaking_mode in ('1v1','2v2','3v3','5v5'));

-- Reemplaza la versión fija de 10 jugadores por una que procesa el primer modo
-- habilitado que tenga suficientes jugadores. Alterna por ELO descendente para
-- repartir jugadores fuertes entre ambos equipos.
create or replace function public.matchmaking_try_match_unchecked()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_mode text;
  team_size integer;
  total_slots integer;
  qids uuid[];
  pids uuid[];
  elos integer[];
  n integer := 0;
  i integer;
  t1 uuid[] := '{}';
  t2 uuid[] := '{}';
  srv record;
  mid uuid;
  tid1 uuid;
  tid2 uuid;
  shortid text;
begin
  select mm.mode, mm.players_per_team
    into chosen_mode, team_size
  from public.matchmaking_modes mm
  join public.matchmaking_queue q on q.mode = mm.mode and q.status = 'waiting'
  where mm.enabled
  group by mm.mode, mm.players_per_team
  having count(*) >= mm.players_per_team * 2
  order by min(q.joined_at), mm.players_per_team
  limit 1;

  if chosen_mode is null then return false; end if;
  total_slots := team_size * 2;

  select array_agg(x.id order by x.elo desc, x.joined_at),
         array_agg(x.player_id order by x.elo desc, x.joined_at),
         array_agg(x.elo order by x.elo desc, x.joined_at),
         count(*)::integer
    into qids, pids, elos, n
  from (
    select q.id, q.player_id, q.elo, q.joined_at
    from public.matchmaking_queue q
    where q.status = 'waiting' and q.mode = chosen_mode
    order by q.joined_at
    for update skip locked
    limit total_slots
  ) x;

  if coalesce(n, 0) < total_slots then return false; end if;

  select gs.id, gs.name, gs.connect_address
    into srv
  from public.game_servers gs
  where gs.active and gs.matchmaking_enabled and gs.connect_address is not null
    and not exists (
      select 1 from public.matches m
      where m.server_id = gs.id and m.status in ('upcoming','live')
    )
  order by gs.last_assigned_at nulls first, gs.created_at
  for update skip locked
  limit 1;
  if not found then return false; end if;

  for i in 1..total_slots loop
    if mod(floor((i - 1)::numeric / 2)::integer, 2) = 0 then
      if mod(i, 2) = 1 then t1 := array_append(t1, pids[i]);
      else t2 := array_append(t2, pids[i]); end if;
    else
      if mod(i, 2) = 1 then t2 := array_append(t2, pids[i]);
      else t1 := array_append(t1, pids[i]); end if;
    end if;
  end loop;

  mid := gen_random_uuid();
  tid1 := gen_random_uuid();
  tid2 := gen_random_uuid();
  shortid := substr(replace(mid::text, '-', ''), 1, 6);

  insert into public.teams(id, name, tag, members, kind)
  values (tid1, 'MM-'||shortid||'-A', 'MMA', t1, 'mix'),
         (tid2, 'MM-'||shortid||'-B', 'MMB', t2, 'mix');

  insert into public.matches(
    id, kind, team1, team2, status, starts_at, best_of, server_id, server_ip,
    lineup1, lineup2, matchmaking_mode
  )
  values (
    mid, 'mix', tid1, tid2, 'upcoming', now(), 1, srv.id, srv.connect_address,
    t1, t2, chosen_mode
  );

  update public.matchmaking_queue
  set status = 'matched', match_id = mid, matched_at = now()
  where id = any(qids);
  update public.game_servers set last_assigned_at = now() where id = srv.id;
  return true;
end;
$$;
revoke all on function public.matchmaking_try_match_unchecked() from public, anon, authenticated;

-- Mantener el cierre global existente, pero aplicarlo al nuevo matcher.
create or replace function public.matchmaking_try_match()
returns boolean language plpgsql security definer set search_path = public as $$
declare is_open boolean;
begin
  select queue_open into is_open from public.matchmaking_settings where id = true;
  if coalesce(is_open, true) = false then return false; end if;
  return public.matchmaking_try_match_unchecked();
end;
$$;
revoke all on function public.matchmaking_try_match() from public, anon, authenticated;

create or replace function public.matchmaking_queue_state()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'queue_open', coalesce((select queue_open from public.matchmaking_settings where id = true), true),
    'updated_at', (select updated_at from public.matchmaking_settings where id = true),
    'modes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mode', mm.mode,
        'enabled', mm.enabled,
        'players_per_team', mm.players_per_team,
        'queue_size', (select count(*)::integer from public.matchmaking_queue q where q.status='waiting' and q.mode=mm.mode)
      ) order by mm.players_per_team)
      from public.matchmaking_modes mm
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.matchmaking_queue_state() from public;
grant execute on function public.matchmaking_queue_state() to anon, authenticated;

create or replace function public.matchmaking_set_mode(p_mode text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id=uid and role='admin') then
    raise exception 'Solo un administrador puede configurar los formatos de matchmaking.' using errcode='42501';
  end if;
  if p_mode not in ('1v1','2v2','3v3','5v5') then
    raise exception 'Formato de matchmaking inválido.' using errcode='22023';
  end if;
  update public.matchmaking_modes
    set enabled = p_enabled, updated_at = now(), updated_by = uid
  where mode = p_mode;
  if not found then raise exception 'No existe el formato solicitado.' using errcode='22023'; end if;
  return public.matchmaking_queue_state();
end;
$$;
revoke all on function public.matchmaking_set_mode(text,boolean) from public, anon;
grant execute on function public.matchmaking_set_mode(text,boolean) to authenticated;

drop function if exists public.matchmaking_join();
create function public.matchmaking_join(p_mode text default '5v5')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.players%rowtype;
  elo_now integer;
  is_open boolean;
  mode_enabled boolean;
  existing_mode text;
begin
  if uid is null then
    raise exception 'Iniciá sesión para entrar a la cola.' using errcode='42501';
  end if;
  select queue_open into is_open from public.matchmaking_settings where id=true;
  if coalesce(is_open,true)=false then
    raise exception 'La queue está cerrada por administración.' using errcode='55000';
  end if;
  if p_mode not in ('1v1','2v2','3v3','5v5') then
    raise exception 'Formato de matchmaking inválido.' using errcode='22023';
  end if;
  select enabled into mode_enabled from public.matchmaking_modes where mode=p_mode;
  if coalesce(mode_enabled,false)=false then
    raise exception 'Ese formato está deshabilitado por administración.' using errcode='55000';
  end if;
  if exists (
    select 1 from public.matchmaking_queue q join public.matches m on m.id=q.match_id
    where q.user_id=uid and q.status='matched' and m.status in ('upcoming','live')
  ) then
    raise exception 'Ya tenés una partida de matchmaking activa.' using errcode='23505';
  end if;
  select q.mode into existing_mode
  from public.matchmaking_queue q
  where q.user_id=uid and q.status='waiting'
  order by q.joined_at desc limit 1;
  if existing_mode is not null and existing_mode <> p_mode then
    raise exception 'Ya estás en la cola %. Cancelá la búsqueda antes de cambiar de formato.', existing_mode using errcode='23505';
  end if;

  select * into p
  from public.players
  where user_id=uid and steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$'
  order by id limit 1;
  if not found then
    raise exception 'Necesitás vincular tu cuenta a un perfil de jugador con SteamID64 válido.' using errcode='22023';
  end if;

  select coalesce(pe.elo, ec.start_elo, 1000) into elo_now
  from (select 1) x
  left join public.player_elo pe on pe.steam_id=p.steam_id
  left join public.elo_config ec on ec.id=1;

  if existing_mode is null then
    insert into public.matchmaking_queue(user_id, player_id, steam_id, elo, mode)
    values (uid, p.id, p.steam_id, coalesce(elo_now,1000), p_mode);
  end if;

  perform public.matchmaking_try_match();
  return public.matchmaking_status();
end;
$$;
revoke all on function public.matchmaking_join(text) from public, anon;
grant execute on function public.matchmaking_join(text) to authenticated;

create or replace function public.matchmaking_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q public.matchmaking_queue%rowtype;
  waiting integer := 0;
  pos integer := null;
  st text := 'idle';
  mdata jsonb := null;
  mode_size integer := 5;
begin
  if uid is null then raise exception 'Iniciá sesión.' using errcode='42501'; end if;
  perform public.matchmaking_try_match();

  select * into q
  from public.matchmaking_queue x
  where x.user_id=uid and (
    x.status='waiting' or
    (x.status='matched' and exists (
      select 1 from public.matches mm where mm.id=x.match_id and mm.status in ('upcoming','live')
    ))
  )
  order by x.joined_at desc limit 1;

  if found then
    select players_per_team into mode_size from public.matchmaking_modes where mode=q.mode;
    select count(*)::integer into waiting from public.matchmaking_queue x where x.status='waiting' and x.mode=q.mode;
    if q.status='waiting' then
      st := 'waiting';
      select count(*)::integer+1 into pos from public.matchmaking_queue x
      where x.status='waiting' and x.mode=q.mode and x.joined_at<q.joined_at;
    else
      st := 'matched';
      select jsonb_build_object(
        'id',m.id,'status',m.status,'mode',coalesce(m.matchmaking_mode,q.mode),
        'server_name',gs.name,'connect_address',gs.connect_address,
        'server_password',(select d.server_password from public.matchmaking_dispatch d where d.match_id=m.id and d.dispatch_state in ('assigned','live')),
        'team1',t1.name,'team2',t2.name,'lineup1',m.lineup1,'lineup2',m.lineup2,
        'roster',coalesce((
          select jsonb_agg(jsonb_build_object(
            'player_id',p.id,'nick',p.nick,'elo',coalesce(pe.elo,q2.elo),
            'team',case when p.id=any(m.lineup1) then 1 else 2 end
          ) order by p.nick)
          from public.matchmaking_queue q2 join public.players p on p.id=q2.player_id
          left join public.player_elo pe on pe.steam_id=q2.steam_id
          where q2.match_id=m.id and q2.status='matched'
        ),'[]'::jsonb)
      )
      into mdata
      from public.matches m
      left join public.game_servers gs on gs.id=m.server_id
      left join public.teams t1 on t1.id=m.team1
      left join public.teams t2 on t2.id=m.team2
      where m.id=q.match_id;
    end if;
    return jsonb_build_object(
      'status',st,'queue_size',waiting,'position',pos,'mode',q.mode,
      'players_per_team',mode_size,'match',mdata
    );
  end if;
  return jsonb_build_object('status','idle','queue_size',0,'position',null,'mode',null,'players_per_team',null,'match',null);
end;
$$;
revoke all on function public.matchmaking_status() from public, anon;
grant execute on function public.matchmaking_status() to authenticated;

commit;

notify pgrst, 'reload schema';

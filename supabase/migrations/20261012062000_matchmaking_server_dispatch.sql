begin;

create table if not exists public.matchmaking_dispatch (
  match_id uuid primary key references public.matches(id) on delete cascade,
  server_id uuid not null references public.game_servers(id) on delete cascade,
  server_password text not null,
  dispatch_state text not null default 'assigned'
    check (dispatch_state in ('assigned','live','finished','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text
);
alter table public.matchmaking_dispatch enable row level security;
revoke all on public.matchmaking_dispatch from anon, authenticated;

create or replace function public.matchmaking_server_poll(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  mid uuid;
  pwd text;
  map_name text;
  steam_ids text;
  state text;
begin
  sid := public.csstv_auth(p_token);

  select d.match_id, d.server_password, d.dispatch_state, coalesce(nullif(m.map,''),'de_dust2')
    into mid, pwd, state, map_name
  from public.matchmaking_dispatch d
  join public.matches m on m.id = d.match_id
  where d.server_id = sid and d.dispatch_state in ('assigned','live')
    and m.status in ('upcoming','live')
  order by d.created_at desc
  limit 1;

  if mid is null then
    select m.id, coalesce(nullif(m.map,''),'de_dust2')
      into mid, map_name
    from public.matches m
    where m.server_id = sid and m.status in ('upcoming','live')
    order by m.starts_at desc nulls last
    limit 1;

    if mid is null then return 'IDLE'; end if;

    pwd := 'frag' || lpad(floor(random() * 10000)::integer::text, 4, '0');
    insert into public.matchmaking_dispatch(match_id, server_id, server_password)
    values (mid, sid, pwd)
    on conflict (match_id) do update set updated_at = now()
    returning server_password, dispatch_state into pwd, state;
  end if;

  select string_agg(
    'STEAM_0:' ||
    mod((p.steam_id::numeric - 76561197960265728)::bigint, 2)::text ||
    ':' ||
    floor((p.steam_id::numeric - 76561197960265728) / 2)::bigint::text,
    ','
    order by p.nick
  )
  into steam_ids
  from public.matchmaking_queue q
  join public.players p on p.id = q.player_id
  where q.match_id = mid and q.status = 'matched'
    and p.steam_id ~ '^7656119[0-9]{10}$';

  if coalesce(steam_ids,'') = '' then
    return 'ERROR|ROSTER_EMPTY';
  end if;

  update public.matchmaking_dispatch set updated_at = now()
  where match_id = mid;

  return mid::text || '|' || pwd || '|' || coalesce(map_name,'de_dust2') || '|' || steam_ids;
end;
$$;

revoke all on function public.matchmaking_server_poll(text) from public, authenticated;
grant execute on function public.matchmaking_server_poll(text) to anon;

create or replace function public.matchmaking_server_mark_live(p_token text, p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare sid uuid;
begin
  sid := public.csstv_auth(p_token);
  update public.matchmaking_dispatch
     set dispatch_state = 'live', updated_at = now()
   where match_id = p_match_id and server_id = sid
     and dispatch_state in ('assigned','live');
  return found;
end;
$$;
revoke all on function public.matchmaking_server_mark_live(text,uuid) from public, authenticated;
grant execute on function public.matchmaking_server_mark_live(text,uuid) to anon;

create or replace function public.matchmaking_admin_release_server(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id=uid and role='admin') then
    raise exception 'Solo un administrador puede liberar una partida.' using errcode='42501';
  end if;
  update public.matchmaking_dispatch set dispatch_state='finished', updated_at=now()
    where match_id=p_match_id;
  update public.matches set status='finished'
    where id=p_match_id and status in ('upcoming','live');
  update public.matchmaking_queue set status='cancelled'
    where match_id=p_match_id and status='matched';
  return found;
end;
$$;
revoke all on function public.matchmaking_admin_release_server(uuid) from public, anon;
grant execute on function public.matchmaking_admin_release_server(uuid) to authenticated;

commit;
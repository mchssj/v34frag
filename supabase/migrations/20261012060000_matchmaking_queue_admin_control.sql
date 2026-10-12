begin;

create table if not exists public.matchmaking_settings (
  id boolean primary key default true check (id),
  queue_open boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.matchmaking_settings(id, queue_open)
values (true, true)
on conflict (id) do nothing;
alter table public.matchmaking_settings enable row level security;
revoke all on public.matchmaking_settings from anon, authenticated;

alter function public.matchmaking_try_match() rename to matchmaking_try_match_unchecked;

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
    'updated_at', (select updated_at from public.matchmaking_settings where id = true)
  );
$$;
revoke all on function public.matchmaking_queue_state() from public;
grant execute on function public.matchmaking_queue_state() to anon, authenticated;

create or replace function public.matchmaking_set_queue_open(p_open boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'Solo un administrador puede cambiar el estado de la queue.' using errcode = '42501';
  end if;
  insert into public.matchmaking_settings(id, queue_open, updated_at, updated_by)
  values (true, p_open, now(), uid)
  on conflict (id) do update set queue_open = excluded.queue_open, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return public.matchmaking_queue_state();
end;
$$;
revoke all on function public.matchmaking_set_queue_open(boolean) from public, anon;
grant execute on function public.matchmaking_set_queue_open(boolean) to authenticated;

create or replace function public.matchmaking_join()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.players%rowtype; elo_now integer; is_open boolean;
begin
 if uid is null then raise exception 'Iniciá sesión para entrar a la cola.' using errcode='42501'; end if;
 select queue_open into is_open from public.matchmaking_settings where id = true;
 if coalesce(is_open, true) = false then raise exception 'La queue está cerrada por administración.' using errcode='55000'; end if;
 if exists(select 1 from public.matchmaking_queue q join public.matches m on m.id=q.match_id where q.user_id=uid and q.status='matched' and m.status in('upcoming','live')) then raise exception 'Ya tenés una partida de matchmaking activa.' using errcode='23505'; end if;
 select * into p from public.players where user_id=uid and steam_id ~ '^7656119[0-9]{10}$' order by id limit 1;
 if not found then raise exception 'Necesitás vincular tu perfil de jugador a tu cuenta y tener un SteamID64 válido.' using errcode='22023'; end if;
 select coalesce(pe.elo,ec.start_elo,1000) into elo_now from (select 1) x left join public.player_elo pe on pe.steam_id=p.steam_id left join public.elo_config ec on ec.id=1;
 if not exists(select 1 from public.matchmaking_queue where user_id=uid and status='waiting') then insert into public.matchmaking_queue(user_id,player_id,steam_id,elo) values(uid,p.id,p.steam_id,coalesce(elo_now,1000));end if;
 perform public.matchmaking_try_match();return public.matchmaking_status();
end;
$$;
revoke all on function public.matchmaking_join() from public, anon;
grant execute on function public.matchmaking_join() to authenticated;

commit;
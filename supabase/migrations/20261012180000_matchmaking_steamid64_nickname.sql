-- =============================================================================
-- Matchmaking: aceptar todos los formatos SteamID64 admitidos por CSSTV.
--
-- El helper csstv_steam64 ya admite 7656119 + 10 dígitos y 765612 + 11 dígitos,
-- pero matchmaking_join seguía aceptando únicamente el primer formato.
-- =============================================================================

begin;

create or replace function public.matchmaking_join()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.players%rowtype;
  elo_now integer;
begin
  if uid is null then
    raise exception 'Iniciá sesión para entrar a la cola.' using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.matchmaking_queue q
      join public.matches m on m.id = q.match_id
     where q.user_id = uid
       and q.status = 'matched'
       and m.status in ('upcoming', 'live')
  ) then
    raise exception 'Ya tenés una partida de matchmaking activa.' using errcode = '23505';
  end if;

  -- Debe ser un jugador asociado a esta cuenta y tener un SteamID64 válido.
  -- Admitir los dos formatos reconocidos por csstv_steam64 y por el sistema de ELO.
  select *
    into p
    from public.players
   where user_id = uid
     and steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$'
   order by id
   limit 1;

  if not found then
    raise exception 'Necesitás vincular tu cuenta a un perfil de jugador con SteamID64 válido. Revisá que el perfil tenga tu cuenta asociada, además del SteamID.' using errcode = '22023';
  end if;

  select coalesce(pe.elo, ec.start_elo, 1000)
    into elo_now
    from (select 1) x
    left join public.player_elo pe on pe.steam_id = p.steam_id
    left join public.elo_config ec on ec.id = 1;

  if not exists (
    select 1
      from public.matchmaking_queue
     where user_id = uid
       and status = 'waiting'
  ) then
    insert into public.matchmaking_queue(user_id, player_id, steam_id, elo)
    values (uid, p.id, p.steam_id, coalesce(elo_now, 1000));
  end if;

  perform public.matchmaking_try_match();
  return public.matchmaking_status();
end;
$$;

revoke all on function public.matchmaking_join() from public, anon;
grant execute on function public.matchmaking_join() to authenticated;

commit;

notify pgrst, 'reload schema';

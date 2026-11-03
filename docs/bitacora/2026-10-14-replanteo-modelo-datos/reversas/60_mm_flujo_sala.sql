-- Inversa del replanteo 60 (flujo de la sala): vuelve aceptar, rechazar, el tick, la cancelación, el armado de salas y
-- el estado liviano a como quedaron en la 59, y borra mm_queue.ready_at.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 60: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

create or replace function public.mm_accept() returns void
  language plpgsql security definer set search_path = public as $$
declare v_lobby uuid := mm_active_lobby(auth.uid());
begin
  if v_lobby is null or (select status from mm_lobbies where id = v_lobby) <> 'accepting' then raise exception 'No hay nada para aceptar'; end if;
  update mm_lobby_players set accepted_at = coalesce(accepted_at, now()) where lobby_id = v_lobby and user_id = auth.uid();
end $$;

create or replace function public.mm_decline() returns void
  language plpgsql security definer set search_path = public as $$
declare v_lobby uuid := mm_active_lobby(auth.uid());
begin
  if v_lobby is null or (select status from mm_lobbies where id = v_lobby) <> 'accepting' then raise exception 'No hay nada para rechazar'; end if;
  update mm_lobby_players set declined_at = now() where lobby_id = v_lobby and user_id = auth.uid();
  perform mm_penalize(auth.uid(), 'Rechazaste una partida');
  perform mm_cancel_lobby(v_lobby, 'Un jugador rechazó la partida', true);
end $$;

select pg_temp.reemplazar('public.mm_tick()', array[
  [$q$  -- (replanteo 60) Bloqueadas: un "Aceptar" que llega mientras tanto espera y ve la sala como quedó.
  for l in select * from mm_lobbies where status not in ('finished', 'cancelled') order by created_at for update loop$q$,
   $q$  for l in select * from mm_lobbies where status not in ('finished', 'cancelled') loop$q$]]);

select pg_temp.reemplazar('public.mm_cancel_lobby(uuid,text,boolean)', array[
  [$q$      -- (replanteo 60) Con su lugar, pero 3 s sin entrar en otra sala: alcanzan a ver por qué se canceló.
      insert into mm_queue (user_id, player_id, party_id, mode, region, elo, joined_at, ready_at)
        values (r.user_id, r.player_id, r.party_id, l.mode, r.region, r.elo, r.joined_at, now() + interval '3 seconds') on conflict (user_id) do nothing;$q$,
   $q$      insert into mm_queue (user_id, player_id, party_id, mode, region, elo, joined_at)
        values (r.user_id, r.player_id, r.party_id, l.mode, r.region, r.elo, r.joined_at) on conflict (user_id) do nothing;$q$],
  [$q$  perform mm_emit('lobby.cancelled', p_lobby, mm_lobby_users(p_lobby), jsonb_build_object('reason', p_reason, 'requeue', p_requeue));$q$,
   $q$  perform mm_emit('lobby.cancelled', p_lobby, mm_lobby_users(p_lobby));$q$]]);

select pg_temp.reemplazar('public.mm_try_build(text)', array[
  [$q$from mm_queue where mode = p_mode and (ready_at is null or ready_at <= now())$q$,
   $q$from mm_queue where mode = p_mode$q$]]);

select pg_temp.reemplazar('public.mm_my_live(boolean)', array[
  [$q$  v_lobby_json jsonb;
  v_last uuid;$q$,
   $q$  v_lobby_json jsonb;$q$],
  [$q$  -- (replanteo 60) `lobby` es la sala abierta; la última terminada va en `last_lobby` (la pestaña "Tu última partida").
  -- Con p_full (mm_my_state, la web ya desplegada) `lobby` sigue como antes: la abierta o la terminada en la última hora.
  v_lobby := mm_active_lobby(me);
  v_last := (select l.id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id
     where lp.user_id = me and l.status = 'finished' order by l.ended_at desc limit 1);
  if p_full and v_lobby is null then
    v_lobby := (select id from mm_lobbies where id = v_last and ended_at > now() - interval '1 hour');
  end if;$q$,
   $q$  v_lobby := coalesce(mm_active_lobby(me), (select l.id from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id
     where lp.user_id = me and l.status = 'finished' and l.ended_at > now() - interval '1 hour' order by l.ended_at desc limit 1));$q$],
  [$q$    'lobby', v_lobby_json,
    'last_lobby', mm_lobby_json(v_last, me) #- '{match,stats}',$q$,
   $q$    'lobby', v_lobby_json,$q$]]);

alter table public.mm_queue drop column ready_at;

notify pgrst, 'reload schema';

commit;

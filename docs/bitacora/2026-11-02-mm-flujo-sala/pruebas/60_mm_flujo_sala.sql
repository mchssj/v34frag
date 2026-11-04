-- Pruebas del replanteo 60 (flujo de la sala). Se corren con correr_local.sh, dentro de una transacción que se deshace.
-- mm_emit se reemplaza por una versión que anota los avisos; mm_free_server, por una que devuelve un servidor cualquiera
-- (armar una sala de verdad necesita un servidor que esté consultando).

create temp table avisos (t text, lobby uuid, users uuid[], d jsonb, n serial);
create or replace function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null) returns void
  language sql as $$ insert into avisos (t, lobby, users, d) values (p_type, p_lobby, p_users, p_data) $$;
create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;

do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  pa uuid; pb uuid;
  v_srv uuid := (select id from game_servers order by created_at limit 1);
  v_lobby uuid; v_old uuid; v_built uuid; v_match uuid;
  r jsonb; a avisos%rowtype;
  ok int := 0;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(array[ua, ub]) x;
  insert into players (nick, user_id, steam_id) values ('a60' || substr(md5(random()::text), 1, 8), ua, (76561197960265728 + floor(random() * 1e9)::bigint)::text) returning id into pa;
  insert into players (nick, user_id, steam_id) values ('b60' || substr(md5(random()::text), 1, 8), ub, (76561197960265728 + floor(random() * 1e9)::bigint)::text) returning id into pb;
  execute format('create or replace function public.mm_free_server(p_regions text[]) returns uuid language sql as %L', format('select %L::uuid', v_srv));

  -- 1. Aceptar: antes del plazo cuenta; después, error y no queda guardado.
  insert into matches (kind, status, best_of, side1_name, side2_name) values ('mm', 'upcoming', 1, 'team_a', 'team_b') returning id into v_match;
  insert into mm_lobbies (mode, status, match_id, password, accept_deadline)
    values ('1v1', 'accepting', v_match, 'clave60', now() + interval '15 seconds') returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at)
    values (v_lobby, ua, pa, 1, 1000, now() - interval '1 minute'), (v_lobby, ub, pb, 2, 1000, now());
  perform pg_temp.como(ua);
  perform mm_accept();
  if (select accepted_at from mm_lobby_players where lobby_id = v_lobby and user_id = ua) is null then raise exception 'FALLA 1a: no aceptó'; end if;
  update mm_lobbies set accept_deadline = now() - interval '1 second' where id = v_lobby;
  perform pg_temp.como(ub);
  begin
    perform mm_accept();
    raise exception 'FALLA 1b: aceptó después del plazo';
  exception when raise_exception then
    if sqlerrm <> 'Se terminó el tiempo para aceptar' then raise; end if;
  end;
  begin
    perform mm_decline();
    raise exception 'FALLA 1c: rechazó después del plazo';
  exception when raise_exception then
    if sqlerrm <> 'Se terminó el tiempo para aceptar' then raise; end if;
  end;
  if (select accepted_at from mm_lobby_players where lobby_id = v_lobby and user_id = ub) is not null then raise exception 'FALLA 1d: quedó guardado'; end if;
  ok := ok + 4;

  -- 2. El tick bloquea las salas que mira.
  if position('for update loop' in pg_get_functiondef('public.mm_tick()'::regprocedure)) = 0 then raise exception 'FALLA 2: el tick no bloquea'; end if;
  ok := ok + 1;

  -- 3. La cancelación por tiempo: el motivo en el aviso, quien aceptó vuelve a la cola con su lugar y 3 s de pausa.
  perform pg_temp.como(null);
  delete from avisos;
  perform mm_cancel_lobby(v_lobby, 'Un jugador no aceptó a tiempo', true);
  select * into a from avisos where t = 'lobby.cancelled';
  if a.lobby is distinct from v_lobby or a.d->>'reason' is distinct from 'Un jugador no aceptó a tiempo' or (a.d->>'requeue')::boolean is distinct from true then
    raise exception 'FALLA 3a: lobby.cancelled: %', to_jsonb(a);
  end if;
  if (select ready_at from mm_queue where user_id = ua) not between now() + interval '2.9 seconds' and now() + interval '3.1 seconds'
     or (select joined_at from mm_queue where user_id = ua) > now() - interval '59 seconds' then
    raise exception 'FALLA 3b: la vuelta a la cola: %', (select to_jsonb(q) from mm_queue q where user_id = ua);
  end if;
  if exists (select 1 from mm_queue where user_id = ub) then raise exception 'FALLA 3c: volvió a la cola quien no aceptó'; end if;
  ok := ok + 3;

  -- 4. Con la pausa no se arma sala; pasada, sí.
  insert into mm_queue (user_id, player_id, mode, elo, joined_at) values (ub, pb, '1v1', 1000, now());
  v_built := mm_try_build('1v1');
  if v_built is not null then raise exception 'FALLA 4a: armó la sala durante la pausa'; end if;
  update mm_queue set ready_at = now() - interval '1 second' where user_id = ua;
  v_built := mm_try_build('1v1');
  if v_built is null or (select count(*) from mm_lobby_players where lobby_id = v_built) <> 2 then raise exception 'FALLA 4b: no armó la sala después de la pausa'; end if;
  ok := ok + 2;

  -- 5. lobby es la sala abierta y last_lobby la última terminada; mm_my_state sigue como antes.
  v_old := v_lobby;
  update mm_lobbies set status = 'finished', ended_at = now() - interval '2 hours' where id = v_old;
  perform pg_temp.como(ua);
  r := mm_my_live();
  if r->'lobby'->>'id' is distinct from v_built::text or r->'last_lobby'->>'id' is distinct from v_old::text then
    raise exception 'FALLA 5a: lobby %, last_lobby %', r->'lobby'->>'id', r->'last_lobby'->>'id';
  end if;
  if coalesce(r->'last_lobby'->'match' ? 'stats', false) then raise exception 'FALLA 5b: last_lobby con estadísticas'; end if;
  perform pg_temp.como(null);
  update mm_lobbies set status = 'finished', ended_at = now() where id = v_built;
  perform pg_temp.como(ua);
  r := mm_my_live();
  if jsonb_typeof(r->'lobby') is distinct from 'null' and r->'lobby' is not null then raise exception 'FALLA 5c: sin sala abierta, lobby trae %', r->'lobby'->>'id'; end if;
  if r->'last_lobby'->>'id' is distinct from v_built::text then raise exception 'FALLA 5d: last_lobby no es la última terminada'; end if;
  if mm_my_state()->'lobby'->>'id' is distinct from v_built::text then raise exception 'FALLA 5e: mm_my_state cambió: %', mm_my_state()->'lobby'->>'id'; end if;
  perform pg_temp.como(null);
  update mm_lobbies set ended_at = now() - interval '2 hours' where id = v_built;
  perform pg_temp.como(ua);
  if jsonb_typeof(mm_my_state()->'lobby') is distinct from 'null' and mm_my_state()->'lobby' is not null then raise exception 'FALLA 5f: mm_my_state con una sala de hace 2 horas'; end if;
  if mm_my_state() <> mm_my_profile() || mm_my_live(true) then raise exception 'FALLA 5g: mm_my_state no es la suma'; end if;
  ok := ok + 7;

  perform pg_temp.como(null);
  raise notice 'OK: % comprobaciones del replanteo 60', ok;
end $$;

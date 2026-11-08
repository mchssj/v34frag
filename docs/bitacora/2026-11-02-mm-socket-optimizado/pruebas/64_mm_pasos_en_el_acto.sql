-- Pruebas del replanteo 64 (pasos en el acto). Se corren con correr_local.sh, dentro de una transacción que se deshace.
-- mm_emit anota los avisos; mm_free_server devuelve un servidor que responde. El tick no corre: todo tiene que pasar
-- por las acciones.

create temp table avisos (t text, lobby uuid, users uuid[], d jsonb, n serial);
create or replace function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null) returns void
  language sql as $$ insert into avisos (t, lobby, users, d) values (p_type, p_lobby, p_users, p_data) $$;
create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;

do $$
declare
  u uuid[] := array[gen_random_uuid(), gen_random_uuid()];
  v_srv uuid := (select id from game_servers order by created_at limit 1);
  v_lobby uuid;
  v_map text;
  ok int := 0;
  i int;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(u) x;
  for i in 1..2 loop
    insert into players (nick, user_id, steam_id) values ('p64' || i || substr(md5(random()::text), 1, 6), u[i], (76561197960265728 + floor(random() * 1e9)::bigint)::text);
  end loop;
  execute format('create or replace function public.mm_free_server(p_regions text[]) returns uuid language sql as %L', format('select %L::uuid', v_srv));
  insert into mm_server_state (server_id, last_poll_at) values (v_srv, now()) on conflict (server_id) do update set last_poll_at = now(), unavailable_until = null;
  update mm_config set open = true, require_anticheat = false where id = 1;
  update mm_mode_settings set enabled = true where mode = '1v1';
  delete from mm_queue where mode = '1v1';
  if (select count(*) from mm_mode_maps where mode = '1v1') < 2 then
    insert into mm_mode_maps (mode, map) select '1v1', name from map_pool where active order by name limit 3 on conflict do nothing;
  end if;

  -- 1. El segundo en entrar a la cola arma la sala en el acto, sin tick.
  perform pg_temp.como(u[1]);
  perform mm_join('1v1', null);
  if mm_active_lobby(u[1]) is not null then raise exception 'FALLA 1a: armó sala con uno solo'; end if;
  perform pg_temp.como(u[2]);
  delete from avisos;
  perform mm_join('1v1', null);
  v_lobby := mm_active_lobby(u[2]);
  if v_lobby is null or mm_active_lobby(u[1]) is distinct from v_lobby then raise exception 'FALLA 1b: no armó la sala al entrar'; end if;
  if not exists (select 1 from avisos where t = 'lobby.found' and lobby = v_lobby) then raise exception 'FALLA 1c: sin lobby.found'; end if;
  if exists (select 1 from mm_queue where user_id = any(u)) then raise exception 'FALLA 1d: siguen en la cola'; end if;
  ok := ok + 4;

  -- 2. El último en aceptar arranca el veto en el acto.
  perform pg_temp.como(u[1]);
  perform mm_accept();
  if (select status from mm_lobbies where id = v_lobby) <> 'accepting' then raise exception 'FALLA 2a: arrancó con uno solo'; end if;
  perform pg_temp.como(u[2]);
  perform mm_accept();
  if (select status from mm_lobbies where id = v_lobby) <> 'veto' then raise exception 'FALLA 2b: no arrancó el veto'; end if;
  ok := ok + 2;

  -- 3. El último ban asigna el servidor en el acto.
  delete from avisos;
  loop
    exit when (select status from mm_lobbies where id = v_lobby) <> 'veto';
    select m.map into v_map from mm_mode_maps m where m.mode = '1v1'
      and not exists (select 1 from match_vetos v where v.match_id = (select match_id from mm_lobbies where id = v_lobby) and v.map = m.map) limit 1;
    perform mm_ban_map(v_lobby, v_map, u[1]);
  end loop;
  if (select status from mm_lobbies where id = v_lobby) <> 'assigned' then raise exception 'FALLA 3a: quedó en %', (select status from mm_lobbies where id = v_lobby); end if;
  if (select server_id from mm_lobbies where id = v_lobby) is distinct from v_srv then raise exception 'FALLA 3b: servidor'; end if;
  if not exists (select 1 from avisos where t = 'lobby.server' and lobby = v_lobby) then raise exception 'FALLA 3c: sin lobby.server'; end if;
  ok := ok + 3;

  -- 4. Sin servidor que responda, el último ban deja la sala esperando (la toma el tick, como antes).
  perform pg_temp.como(null);
  update mm_lobbies set status = 'waiting_server', server_id = null where id = v_lobby;
  update mm_server_state set last_poll_at = now() - interval '1 hour' where server_id = v_srv;
  execute 'create or replace function public.mm_free_server(p_regions text[]) returns uuid language sql as $f$ select null::uuid $f$';
  if mm_assign_server(v_lobby) then raise exception 'FALLA 4a: asignó sin servidor'; end if;
  if (select status from mm_lobbies where id = v_lobby) <> 'waiting_server' then raise exception 'FALLA 4b: cambió el estado'; end if;
  ok := ok + 2;

  -- 5. Con la cola cerrada, entrar no arma nada aunque haya con quién.
  update mm_config set open = false where id = 1;
  if mm_try_build_now('1v1') <> 0 then raise exception 'FALLA 5: armó con la cola cerrada'; end if;
  update mm_config set open = true where id = 1;
  ok := ok + 1;

  -- 6. El armado bloquea las filas de la cola antes de crear la sala (cancelar al mismo tiempo ya no mete a nadie).
  if position('for update) x) <> cardinality(v_users) then continue' in pg_get_functiondef('public.mm_try_build(text)'::regprocedure)) = 0 then
    raise exception 'FALLA 6: mm_try_build no bloquea las filas';
  end if;
  ok := ok + 1;

  -- 7. Permisos: las funciones nuevas no son de los jugadores.
  if has_function_privilege('authenticated', 'public.mm_try_build_now(text)', 'execute')
     or has_function_privilege('authenticated', 'public.mm_assign_server(uuid)', 'execute') then raise exception 'FALLA 7: permisos'; end if;
  ok := ok + 1;

  raise notice 'OK: % comprobaciones del replanteo 64', ok;
end $$;

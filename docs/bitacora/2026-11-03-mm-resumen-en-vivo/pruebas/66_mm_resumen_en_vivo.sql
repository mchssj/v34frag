-- Pruebas del replanteo 66 (resumen al día). Se corren con correr_local.sh, dentro de una transacción que se deshace.
-- mm_emit anota los avisos.

create temp table avisos (t text, lobby uuid, users uuid[], d jsonb, n serial);
create or replace function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null) returns void
  language sql as $$ insert into avisos (t, lobby, users, d) values (p_type, p_lobby, p_users, p_data) $$;
create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;

do $$
declare
  u uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  p uuid[] := '{}';
  v_pid uuid;
  v_srv uuid;
  v_lobby uuid;
  s jsonb;
  base_activos int;
  base_vivo int;
  ok int := 0;
  i int;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(u) x;
  for i in 1..3 loop
    insert into players (nick, user_id, steam_id) values ('r66' || i || substr(md5(random()::text), 1, 6), u[i], (76561197960265728 + floor(random() * 1e9)::bigint)::text)
      returning id into v_pid;
    p := p || v_pid;
  end loop;
  -- Un servidor del matchmaking que responde y está libre: el único que cuenta en esta prueba.
  update game_servers set mm_enabled = false;
  v_srv := (select id from game_servers order by created_at limit 1);
  update game_servers set mm_enabled = true, active = true where id = v_srv;
  insert into mm_server_state (server_id, last_poll_at) values (v_srv, now()) on conflict (server_id) do update set last_poll_at = now(), unavailable_until = null;
  delete from mm_queue;
  s := mm_summary();
  base_activos := (s->>'active_players')::int;
  base_vivo := (s->>'live_matches')::int;
  if (s->'servers'->>'total')::int <> 1 or (s->'servers'->>'free')::int <> 1 then raise exception 'FALLA 0: servidores %', s->'servers'; end if;

  -- 1. Entrar a la cola: queue.changed trae el resumen completo (no solo el tamaño).
  delete from avisos;
  insert into mm_queue (user_id, player_id, mode, elo) values (u[1], p[1], '5v5', 1000);
  s := (select d from avisos where t = 'queue.changed' order by n desc limit 1);
  if s is null then raise exception 'FALLA 1a: sin aviso'; end if;
  if (s->>'size')::int <> 1 or (s->'by_mode'->>'5v5')::int <> 1 then raise exception 'FALLA 1b: tamaño %', s; end if;
  if (s->>'active_players')::int <> base_activos + 1 then raise exception 'FALLA 1c: activos %', s->>'active_players'; end if;
  if s->'servers' is null or s->'levels' is null or s->'live_matches' is null then raise exception 'FALLA 1d: faltan datos %', s; end if;
  if (select sum((x->>'count')::int) from jsonb_array_elements(s->'levels') x) <> 1 then raise exception 'FALLA 1e: niveles'; end if;
  ok := ok + 5;

  -- 2. Una sala en vivo en ese servidor: cuenta en activos y en vivo, y el servidor deja de estar libre.
  insert into mm_lobbies (mode, status, server_id, accept_deadline) values ('1v1', 'live', v_srv, now()) returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at) values (v_lobby, u[2], p[2], 1, 1000, now()), (v_lobby, u[3], p[3], 2, 1000, now());
  s := mm_summary();
  if (s->>'active_players')::int <> base_activos + 3 then raise exception 'FALLA 2a: activos %', s->>'active_players'; end if;
  if (s->>'live_matches')::int <> base_vivo + 1 then raise exception 'FALLA 2b: en vivo'; end if;
  if (s->'servers'->>'free')::int <> 0 then raise exception 'FALLA 2c: el servidor ocupado sigue libre'; end if;
  ok := ok + 3;

  -- 3. El tick avisa una vez cuando algo cambió y no vuelve a avisar si nada cambió.
  delete from avisos;
  perform mm_tick();
  if (select count(*) from avisos where t = 'queue.changed') <> 1 then raise exception 'FALLA 3a: el tick no avisó (o avisó de más)'; end if;
  delete from avisos;
  perform mm_tick();
  if exists (select 1 from avisos where t = 'queue.changed') then raise exception 'FALLA 3b: avisó sin cambios'; end if;
  -- La sala termina: el tick lo avisa con los activos y el servidor libre de nuevo.
  update mm_lobbies set status = 'finished', ended_at = now() where id = v_lobby;
  delete from avisos;
  perform mm_tick();
  s := (select d from avisos where t = 'queue.changed' order by n desc limit 1);
  if s is null or (s->'servers'->>'free')::int <> 1 or (s->>'active_players')::int <> base_activos + 1 then raise exception 'FALLA 3c: %', s; end if;
  ok := ok + 3;

  -- 4. Servidores libres de mm_my_live: descuenta el no disponible (antes contaba como libre).
  update mm_server_state set unavailable_until = now() + interval '10 minutes' where server_id = v_srv;
  perform pg_temp.como(u[1]);
  if (mm_my_live()->'servers'->>'free')::int <> 0 then raise exception 'FALLA 4a: cuenta como libre uno no disponible'; end if;
  if (mm_summary()->'servers'->>'free')::int <> 0 then raise exception 'FALLA 4b: el resumen también'; end if;
  perform pg_temp.como(null);
  ok := ok + 2;

  -- 5. Permisos: el resumen y su tabla no son de los jugadores (les llega por el socket y en mm_my_live).
  if has_function_privilege('authenticated', 'public.mm_summary()', 'execute') or has_table_privilege('authenticated', 'public.mm_summary_last', 'select') then
    raise exception 'FALLA 5: permisos';
  end if;
  ok := ok + 1;

  raise notice 'OK: % comprobaciones del replanteo 66', ok;
end $$;

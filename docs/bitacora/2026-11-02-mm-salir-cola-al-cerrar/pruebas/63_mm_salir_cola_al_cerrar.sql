-- Pruebas del replanteo 63 (salir de la cola al cerrar). Se corren con correr_local.sh, dentro de una transacción que
-- se deshace. mm_emit anota los avisos y mm_free_server devuelve un servidor cualquiera.

create temp table avisos (t text, lobby uuid, users uuid[], d jsonb, n serial);
create or replace function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null) returns void
  language sql as $$ insert into avisos (t, lobby, users, d) values (p_type, p_lobby, p_users, p_data) $$;
create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;

do $$
declare
  u uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  p uuid[] := '{}';
  v_pid uuid;
  v_party uuid;
  v_srv uuid := (select id from game_servers order by created_at limit 1);
  v_lobby uuid;
  r jsonb;
  ok int := 0;
  i int;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(u) x;
  for i in 1..4 loop
    insert into players (nick, user_id, steam_id) values ('q63' || i || substr(md5(random()::text), 1, 6), u[i], (76561197960265728 + floor(random() * 1e9)::bigint)::text)
      returning id into v_pid;
    p := p || v_pid;
  end loop;
  execute format('create or replace function public.mm_free_server(p_regions text[]) returns uuid language sql as %L', format('select %L::uuid', v_srv));
  delete from mm_queue where mode = '1v1';

  -- 1. En pausa no entra en una sala; al volver, sí, y conserva su lugar (joined_at).
  insert into mm_queue (user_id, player_id, mode, elo, joined_at) values
    (u[1], p[1], '1v1', 1000, now() - interval '2 minutes'), (u[2], p[2], '1v1', 1000, now() - interval '1 minute');
  if not mm_queue_away(u[1]) then raise exception 'FALLA 1a: no pausó'; end if;
  if mm_queue_away(u[1]) then raise exception 'FALLA 1b: pausó dos veces'; end if;
  if mm_try_build('1v1') is not null then raise exception 'FALLA 1c: armó sala con uno en pausa'; end if;
  if not mm_queue_back(u[1]) then raise exception 'FALLA 1d: no volvió'; end if;
  if (select joined_at from mm_queue where user_id = u[1]) > now() - interval '2 minutes' then raise exception 'FALLA 1e: perdió su lugar'; end if;
  v_lobby := mm_try_build('1v1');
  if v_lobby is null then raise exception 'FALLA 1f: no armó sala al volver'; end if;
  ok := ok + 6;

  -- 2. Dentro de la gracia no sale; pasada la gracia sale con disconnected y sin sanción.
  insert into mm_queue (user_id, player_id, mode, elo) values (u[3], p[3], '1v1', 1000);
  perform mm_queue_away(u[3]);
  if mm_queue_drop_away(u[3], 10) <> 0 then raise exception 'FALLA 2a: salió dentro de la gracia'; end if;
  update mm_queue set away_since = now() - interval '11 seconds' where user_id = u[3];
  if mm_queue_drop_away(u[3], 10) <> 1 then raise exception 'FALLA 2b: no salió'; end if;
  if exists (select 1 from mm_queue where user_id = u[3]) then raise exception 'FALLA 2c: sigue en la cola'; end if;
  if (select outcome from mm_queue_log where user_id = u[3] order by id desc limit 1) <> 'disconnected' then raise exception 'FALLA 2d: outcome'; end if;
  if exists (select 1 from mm_penalties where user_id = u[3] and until > now()) then raise exception 'FALLA 2e: lo sancionó'; end if;
  ok := ok + 5;

  -- 3. Jugar le dice por qué (queue_dropped_at) y deja de decirlo al volver a buscar.
  perform pg_temp.como(u[3]);
  r := mm_my_live();
  if r->>'queue_dropped_at' is null then raise exception 'FALLA 3a: sin queue_dropped_at'; end if;
  insert into mm_queue (user_id, player_id, mode, elo) values (u[3], p[3], '1v1', 1000);
  if mm_my_live()->>'queue_dropped_at' is not null then raise exception 'FALLA 3b: lo dice estando en la cola'; end if;
  perform pg_temp.como(null);
  delete from mm_queue where user_id = u[3];
  ok := ok + 2;

  -- 4. Grupo: si uno está en pausa el grupo queda en pausa; pasada la gracia sale el grupo y avisa al compañero.
  insert into mm_parties (leader_id) values (u[3]) returning id into v_party;
  insert into mm_party_members (party_id, user_id) values (v_party, u[3]), (v_party, u[4]);
  insert into mm_queue (user_id, player_id, party_id, mode, elo) values
    (u[3], p[3], v_party, '2v2', 1000), (u[4], p[4], v_party, '2v2', 1000);
  perform mm_queue_away(u[4]);
  if not mm_unit_away(v_party::text) then raise exception 'FALLA 4a: el grupo no quedó en pausa'; end if;
  update mm_queue set away_since = now() - interval '11 seconds' where user_id = u[4];
  delete from avisos;
  if mm_queue_drop_away(u[4], 10) <> 2 then raise exception 'FALLA 4b: no salió el grupo'; end if;
  if exists (select 1 from mm_queue where party_id = v_party) then raise exception 'FALLA 4c: quedó alguien del grupo'; end if;
  if (select outcome from mm_queue_log where user_id = u[3] order by id desc limit 1) <> 'left' then raise exception 'FALLA 4d: outcome del compañero'; end if;
  if not exists (select 1 from avisos where t = 'party.changed' and users = array[u[3]]) then raise exception 'FALLA 4e: sin aviso al compañero'; end if;
  ok := ok + 5;

  -- 5. La red de seguridad: los conectados vuelven, los demás quedan en pausa, los que pasaron la gracia salen.
  delete from mm_party_members where party_id = v_party;
  insert into mm_queue (user_id, player_id, mode, elo, away_since) values
    (u[3], p[3], '5v5', 1000, now() - interval '3 seconds'),
    (u[4], p[4], '5v5', 1000, null);
  if mm_queue_presence_sweep(array[u[3]], 10) <> 0 then raise exception 'FALLA 5a: sacó a alguien'; end if;
  if (select away_since from mm_queue where user_id = u[3]) is not null then raise exception 'FALLA 5b: el conectado no volvió'; end if;
  if (select away_since from mm_queue where user_id = u[4]) is null then raise exception 'FALLA 5c: el desconectado no quedó en pausa'; end if;
  update mm_queue set away_since = now() - interval '11 seconds' where user_id = u[4];
  if mm_queue_presence_sweep(array[u[3]], 10) <> 1 then raise exception 'FALLA 5d: no sacó al que pasó la gracia'; end if;
  ok := ok + 4;

  -- 6. Cerrar sesión: sale de la cola en el acto; a uno en una sala no lo toca ni lo sanciona.
  perform pg_temp.como(u[3]);
  perform mm_logout();
  if exists (select 1 from mm_queue where user_id = u[3]) then raise exception 'FALLA 6a: sigue en la cola'; end if;
  perform pg_temp.como(u[1]);  -- está en la sala del punto 1, aceptando
  perform mm_logout();
  if (select status from mm_lobbies where id = v_lobby) <> 'accepting' then raise exception 'FALLA 6b: tocó la sala'; end if;
  if exists (select 1 from mm_penalties where user_id = u[1] and until > now()) then raise exception 'FALLA 6c: lo sancionó'; end if;
  perform pg_temp.como(null);
  ok := ok + 3;

  -- 7. Permisos: los de presencia no son de los jugadores; mm_logout sí.
  if has_function_privilege('authenticated', 'public.mm_queue_drop_away(uuid, int)', 'execute')
     or has_function_privilege('anon', 'public.mm_queue_presence_sweep(uuid[], int)', 'execute')
     or has_function_privilege('authenticated', 'public.mm_queue_away(uuid)', 'execute') then raise exception 'FALLA 7a: permisos de presencia'; end if;
  if not has_function_privilege('authenticated', 'public.mm_logout()', 'execute') or has_function_privilege('anon', 'public.mm_logout()', 'execute') then
    raise exception 'FALLA 7b: permisos de mm_logout';
  end if;
  ok := ok + 2;

  raise notice 'OK: % comprobaciones del replanteo 63', ok;
end $$;

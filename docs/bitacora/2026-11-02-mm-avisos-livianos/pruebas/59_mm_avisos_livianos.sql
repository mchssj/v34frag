-- Pruebas del replanteo 59 (avisos con el dato y estado liviano). Se corren con correr_local.sh, dentro de una transacción
-- que se deshace: no dejan nada. Los NOTIFY salen recién al confirmar, así que acá mm_emit se reemplaza por una versión que
-- anota cada aviso en una tabla temporal (se deshace con todo lo demás).

create temp table avisos (t text, lobby uuid, users uuid[], d jsonb, n serial);
create or replace function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null) returns void
  language sql as $$ insert into avisos (t, lobby, users, d) values (p_type, p_lobby, p_users, p_data) $$;
create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;

do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uc uuid := gen_random_uuid();
  pa uuid; pb uuid;
  v_lobby uuid; v_match uuid;
  r jsonb; a avisos%rowtype;
  v_keys text[];
  v_map text;
  ok int := 0;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(array[ua, ub, uc]) x;
  insert into players (nick, user_id, steam_id) values ('a59' || substr(md5(random()::text), 1, 8), ua, (76561197960265728 + floor(random() * 1e9)::bigint)::text) returning id into pa;
  insert into players (nick, user_id, steam_id) values ('b59' || substr(md5(random()::text), 1, 8), ub, (76561197960265728 + floor(random() * 1e9)::bigint)::text) returning id into pb;

  -- 1. El estado completo sigue teniendo lo mismo, y es la suma de las dos partes.
  perform pg_temp.como(ua);
  select array_agg(k order by k) into v_keys from jsonb_object_keys(mm_my_state()) k;
  if v_keys <> array['active_players', 'anticheat', 'ban', 'block_reason', 'blocks', 'friends', 'invites', 'invites_pref', 'live_matches',
                     'lobby', 'max_party_size', 'me', 'modes', 'newcomer', 'open', 'party', 'penalty', 'queue', 'queue_activity', 'queue_size',
                     'regions', 'sanctions', 'season', 'servers', 'sounds'] then
    raise exception 'FALLA 1a: claves de mm_my_state: %', v_keys;
  end if;
  if mm_my_state() <> mm_my_profile() || mm_my_live(true) then raise exception 'FALLA 1b: no es la suma de las dos partes'; end if;
  if exists (select 1 from jsonb_object_keys(mm_my_profile()) k where k in (select jsonb_object_keys(mm_my_live()))) then
    raise exception 'FALLA 1c: una clave está en las dos partes';
  end if;
  if mm_my_live() ? 'friends' or mm_my_live() ? 'sounds' or not (mm_my_live() ? 'queue_activity') then raise exception 'FALLA 1d: reparto de claves'; end if;
  ok := ok + 4;

  -- 2. queue.changed trae los tamaños de la cola.
  perform pg_temp.como(null);
  delete from avisos;
  insert into mm_queue (user_id, player_id, mode, elo, joined_at) values (ua, pa, '5v5', 1000, now());
  select * into a from avisos where t = 'queue.changed' order by n desc limit 1;
  if a.t is null or (a.d->>'size')::int < 1 or (a.d->'by_mode'->>'5v5')::int < 1 or a.users is not null then
    raise exception 'FALLA 2: queue.changed: %', to_jsonb(a);
  end if;
  delete from mm_queue where user_id = ua;
  ok := ok + 1;

  -- 3. lobby.accept: quién aceptó y cuántos van; solo a los de la sala.
  insert into matches (kind, status, best_of, side1_name, side2_name) values ('mm', 'upcoming', 1, 'team_a', 'team_b') returning id into v_match;
  insert into mm_lobbies (mode, status, match_id, map, password, accept_deadline, veto_turn, veto_deadline)
    values ('5v5', 'accepting', v_match, null, 'clave59', now() + interval '15 seconds', 1, null) returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at)
    values (v_lobby, ua, pa, 1, 1000, now()), (v_lobby, ub, pb, 2, 1000, now());
  delete from avisos;
  update mm_lobby_players set accepted_at = now() where lobby_id = v_lobby and user_id = ua;
  select * into a from avisos where t = 'lobby.accept';
  if a.lobby <> v_lobby or (a.d->>'accepted')::int <> 1 or (a.d->>'total')::int <> 2 or a.d->>'user_id' <> ua::text
     or not (a.users @> array[ua, ub] and array[ua, ub] @> a.users) then
    raise exception 'FALLA 3: lobby.accept: %', to_jsonb(a);
  end if;
  ok := ok + 1;

  -- 4. lobby.veto: el mapa, quién lo baneó y el turno siguiente. Sin la contraseña de la sala.
  select map into v_map from mm_mode_maps where mode = '5v5' order by position limit 1;
  if v_map is null then
    raise notice 'Sin mapas del 5v5 en mm_mode_maps: se saltea la prueba del veto';
  else
    update mm_lobbies set status = 'veto', veto_turn = 1, veto_deadline = now() + interval '15 seconds' where id = v_lobby;
    delete from avisos;
    perform mm_ban_map(v_lobby, v_map, ua);
    select * into a from avisos where t = 'lobby.veto' order by n desc limit 1;
    if a.d->>'map' <> v_map or (a.d->>'side')::int <> 1 or (a.d->>'turn')::int is distinct from 2 and (a.d->>'done')::boolean is distinct from true then
      raise exception 'FALLA 4a: lobby.veto: %', to_jsonb(a);
    end if;
    ok := ok + 1;
  end if;
  if exists (select 1 from avisos where d::text like '%clave59%') then raise exception 'FALLA 4b: un aviso lleva la contraseña'; end if;
  ok := ok + 1;

  -- 5. lobby.found lleva el plazo (se revisa en la función: armar una sala real necesita cola y servidor).
  if position('accept_deadline' in pg_get_functiondef('public.mm_try_build(text)'::regprocedure)) = 0 then raise exception 'FALLA 5: lobby.found sin d'; end if;
  ok := ok + 1;

  -- 6. La partida de una sala: solo para quien la jugó.
  perform pg_temp.como(uc);
  begin
    perform mm_lobby_match(v_lobby);
    raise exception 'FALLA 6a: alguien de afuera vio la partida de la sala';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como(ua);
  perform mm_lobby_match(v_lobby);
  if (mm_my_live()->'lobby'->>'id') <> v_lobby::text then raise exception 'FALLA 6b: el estado liviano no trae la sala'; end if;
  ok := ok + 2;

  perform pg_temp.como(null);
  raise notice 'OK: % comprobaciones del replanteo 59', ok;
end $$;

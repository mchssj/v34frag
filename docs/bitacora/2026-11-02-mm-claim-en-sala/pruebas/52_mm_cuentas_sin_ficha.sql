-- Pruebas del replanteo 52 (cuentas sin ficha en el matchmaking). Se corren con correr_local.sh, dentro de una transacción
-- que se deshace. Pensadas para la base local con la copia de producción: usan una ficha vieja real (con SteamID, partidas
-- y sin cuenta) y un SteamID real que jugó y no tiene ficha.
--
--   A. Cuenta nueva sin ficha → mm_join le crea una → sala → !claim con el SteamID de una ficha vieja: se unen, la cuenta
--      queda con la ficha vieja (mismo ELO y partidas), la sala apunta a la vieja y el poll la reconoce.
--   B. Cuenta nueva sin ficha → mm_join → !claim con un SteamID que jugó y no tiene ficha: se vincula a la ficha creada
--      con sus partidas y su ELO.
--   C. Cuenta nueva sin ficha → mm_join → !claim con el SteamID de una ficha que ya tiene cuenta: rechazado.

do $$
declare
  v_token text := 'tok-' || md5(random()::text);
  v_srv uuid;
  f record;            -- ficha vieja sin cuenta
  s_libre text;        -- SteamID que jugó y no tiene ficha
  s_ajeno text;        -- SteamID de una ficha con cuenta
  u_a uuid := gen_random_uuid(); u_b uuid := gen_random_uuid(); u_c uuid := gen_random_uuid(); u_x uuid := gen_random_uuid();
  p_vacia uuid; p_x uuid; p uuid;
  v_lobby uuid; v_match uuid;
  v_code text; res jsonb; v_poll text;
  antes record; despues record;
  ok int := 0;
begin
  update mm_config set open = true, require_anticheat = false, min_mixes = 0, min_account_days = 0;
  update mm_mode_settings set enabled = true where mode = '5v5';

  select o.id, o.elo, o.maps, pl.steam_id, (select count(*) from player_matches m where m.player_id = o.id) as partidas into f
    from player_overview o join players pl on pl.id = o.id
   where pl.user_id is null and pl.steam_id is not null and csstv_steam64(csstv_steam2(pl.steam_id)) is not null
     and not exists (select 1 from player_extra_steam_ids x where x.player_id = pl.id)
   order by (o.elo is distinct from 1000) desc, o.maps desc nulls last limit 1;
  select steam_id into s_libre from steam_unlinked where csstv_steam64(csstv_steam2(steam_id)) is not null order by matches desc limit 1;
  select steam_id into s_ajeno from players where user_id is not null and steam_id is not null and csstv_steam64(csstv_steam2(steam_id)) is not null limit 1;
  if f.id is null or s_libre is null or s_ajeno is null then raise exception 'La base no tiene los datos que necesita la prueba'; end if;

  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now(), 'authenticated', 'authenticated' from unnest(array[u_a, u_b, u_c, u_x]) x;
  insert into profiles (id, tag) select x, 'mmp' || substr(md5(x::text), 1, 10) from unnest(array[u_a, u_b, u_c, u_x]) x
    on conflict (id) do update set tag = excluded.tag;
  insert into game_servers (name, token_hash, active, mm_enabled)
    values ('mm-prueba-' || substr(md5(random()::text), 1, 6), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), true, true)
    returning id into v_srv;

  -- 0. Una cuenta sin ficha ya no está bloqueada y mm_join le crea la ficha con su alias.
  if mm_block_reason(u_a) is not null then raise exception 'FALLA 0a: cuenta sin ficha bloqueada: %', mm_block_reason(u_a); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  perform mm_join('5v5', null);
  perform set_config('request.jwt.claims', '', true);
  select id into p_vacia from players where user_id = u_a;
  if p_vacia is null then raise exception 'FALLA 0b: mm_join no creó la ficha'; end if;
  if (select nick from players where id = p_vacia) <> (select tag from profiles where id = u_a) then raise exception 'FALLA 0c: la ficha no tiene el alias'; end if;
  if not exists (select 1 from mm_queue where user_id = u_a and player_id = p_vacia) then raise exception 'FALLA 0d: no quedó en la cola'; end if;
  ok := ok + 4;

  -- Sala 1v1 conectando, a mano: A (ficha vacía) contra X (vinculado).
  insert into players (nick, user_id, steam_id) values ('mmx' || substr(md5(random()::text), 1, 8), u_x, (76561197960265728 + floor(random() * 1e9)::bigint)::text)
    returning id into p_x;
  delete from mm_queue where user_id = u_a;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id, lineup1, lineup2)
    values ('mm', 'upcoming', 1, 'team_a', 'team_x', v_srv, array[p_vacia], array[p_x]) returning id into v_match;
  insert into mm_lobbies (mode, status, match_id, server_id, map, password, connect_deadline)
    values ('5v5', 'connecting', v_match, v_srv, 'de_dust2', 'pw1234', now() + interval '5 minutes') returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at)
    values (v_lobby, u_a, p_vacia, 1, 1000, now(), now()), (v_lobby, u_x, p_x, 2, 1000, now(), now());
  v_poll := csstv_mm_poll(v_token, '2.8.2');
  if v_poll !~ E'(^|\n)unlinked=1(\n|$)' then raise exception 'FALLA A1: unlinked no es 1: %', v_poll; end if;
  ok := ok + 1;

  -- A. !claim con el SteamID de la ficha vieja.
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  select code into v_code from create_claim_code();
  perform set_config('request.jwt.claims', '', true);
  res := claim_with_code(v_token, csstv_steam2(f.steam_id), v_code, 'x');
  if (res->>'ok')::boolean is distinct from true then raise exception 'FALLA A2: el !claim no unió las fichas: %', res; end if;
  if (select id from players where user_id = u_a) is distinct from f.id then raise exception 'FALLA A3: la cuenta no quedó con la ficha vieja'; end if;
  if exists (select 1 from players where id = p_vacia) then raise exception 'FALLA A4: la ficha vacía no se borró'; end if;
  select o.elo, o.maps, (select count(*) from player_matches m where m.player_id = o.id) as partidas into despues from player_overview o where o.id = f.id;
  if despues.elo is distinct from f.elo or despues.maps is distinct from f.maps or despues.partidas <> f.partidas then
    raise exception 'FALLA A5: cambió la historia: antes % / % / %, después % / % / %', f.elo, f.maps, f.partidas, despues.elo, despues.maps, despues.partidas;
  end if;
  if (select player_id from mm_lobby_players where lobby_id = v_lobby and user_id = u_a) is distinct from f.id then raise exception 'FALLA A6: la sala no apunta a la ficha vieja'; end if;
  if (select elo from mm_lobby_players where lobby_id = v_lobby and user_id = u_a) is distinct from mm_player_elo(f.id) then raise exception 'FALLA A7: el ELO de la sala no se actualizó'; end if;
  if not exists (select 1 from matches where id = v_match and f.id = any(lineup1) and not p_vacia = any(lineup1)) then
    raise exception 'FALLA A8: el plantel de la partida no cambió a la ficha vieja';
  end if;
  v_poll := csstv_mm_poll(v_token, '2.8.2');
  if v_poll !~ E'(^|\n)unlinked=0(\n|$)' or v_poll !~ (E'(^|\n)t1=' || csstv_steam2(f.steam_id) || E'(\n|$)') then raise exception 'FALLA A9: el poll no la reconoce: %', v_poll; end if;
  if not csstv_mm_report(v_token, v_lobby, 'connected', csstv_steam2(f.steam_id)) then raise exception 'FALLA A10: connected no la reconoce'; end if;
  ok := ok + 9;
  raise notice 'A: ficha vieja con % mixes, ELO % y % partidas: igual después de unirse', f.maps, f.elo, f.partidas;

  -- B. Cuenta nueva sin ficha y SteamID que jugó y no tiene ficha.
  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  perform mm_join('5v5', null);
  select code into v_code from create_claim_code();
  perform set_config('request.jwt.claims', '', true);
  res := claim_with_code(v_token, csstv_steam2(s_libre), v_code, 'x');
  select id into p from players where user_id = u_b;
  if (res->>'ok')::boolean is distinct from true or (select steam_id from players where id = p) is distinct from s_libre then raise exception 'FALLA B1: %', res; end if;
  if (select elo from player_overview where id = p) is distinct from (select elo from player_elo where steam_id = s_libre) then raise exception 'FALLA B2: el ELO no es el del SteamID'; end if;
  if (select count(*) from player_matches where player_id = p) = 0 then raise exception 'FALLA B3: no tiene sus partidas'; end if;
  if (select elo from mm_queue where user_id = u_b) is distinct from mm_player_elo(p) then raise exception 'FALLA B4: el ELO de la cola no se actualizó'; end if;
  ok := ok + 4;

  -- C. SteamID de una ficha que ya tiene cuenta: rechazado, y la ficha vacía queda.
  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  perform mm_join('5v5', null);
  select code into v_code from create_claim_code();
  perform set_config('request.jwt.claims', '', true);
  res := claim_with_code(v_token, csstv_steam2(s_ajeno), v_code, 'x');
  if (res->>'ok')::boolean or res->>'message' <> 'Ese SteamID pertenece a otra cuenta' then raise exception 'FALLA C1: %', res; end if;
  if not exists (select 1 from players where user_id = u_c and steam_id is null) then raise exception 'FALLA C2: la ficha vacía no quedó'; end if;
  ok := ok + 2;

  raise notice 'OK: % comprobaciones del replanteo 52', ok;
end $$;

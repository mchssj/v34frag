-- Pruebas del replanteo 49 (matchmaking sin SteamID vinculado). Se corren con correr_local.sh, dentro de una
-- transacción que se deshace al final: no dejan nada en la base.
--
-- Arma una sala 1v1 con un jugador vinculado y otro sin SteamID, y comprueba:
--   1. mm_block_reason ya no rechaza a la ficha sin SteamID (y sigue rechazando lo demás).
--   2. csstv_mm_poll manda n1, n2 y unlinked, y t1/t2 solo con los SteamID conocidos.
--   3. mm_player_card trae linked.
--   4. Después del !claim (claim_with_code), el poll trae el SteamID nuevo y unlinked=0, y "connected" lo reconoce.

do $$
declare
  u_a uuid := gen_random_uuid();
  u_b uuid := gen_random_uuid();
  p_a uuid;
  p_b uuid;
  v_srv uuid;
  v_token text := 'tok-mm-claim-' || substr(md5(random()::text), 1, 12);
  v_lobby uuid;
  v_match uuid;
  s_a text := (76561197960265728 + floor(random() * 1e9)::bigint)::text;
  s_b text := (76561197960265728 + floor(random() * 1e9)::bigint)::text;
  v_poll text;
  v_code text;
  v_res jsonb;
  v_card jsonb;
  ok int := 0;
begin
  -- Cuentas confirmadas y viejas, con ficha. A con SteamID, B sin.
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    values (u_a, u_a || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated'),
           (u_b, u_b || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated');
  insert into players (nick, user_id, steam_id) values ('mmA' || substr(md5(random()::text), 1, 8), u_a, s_a) returning id into p_a;
  insert into players (nick, user_id, steam_id) values ('mmB' || substr(md5(random()::text), 1, 8), u_b, null) returning id into p_b;
  update mm_config set require_anticheat = false, min_mixes = 0, min_account_days = 0, open = true;

  -- 1. La cola.
  if mm_block_reason(u_b) is not null then raise exception 'FALLA 1a: sin SteamID todavía bloquea: %', mm_block_reason(u_b); end if;
  ok := ok + 1;
  insert into mm_penalties (user_id, level, until) values (u_b, 1, now() + interval '5 minutes');
  if mm_block_reason(u_b) is distinct from 'Tenés una sanción vigente' then raise exception 'FALLA 1b: la sanción no bloquea: %', mm_block_reason(u_b); end if;
  delete from mm_penalties where user_id = u_b;
  ok := ok + 1;

  -- Servidor con token y una sala conectando, armada a mano (1v1).
  insert into game_servers (name, token_hash, active, mm_enabled)
    values ('mm-claim-prueba-' || substr(md5(random()::text), 1, 6), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), true, true)
    returning id into v_srv;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id) values ('mm', 'upcoming', 1, 'team_a', 'team_b', v_srv)
    returning id into v_match;
  insert into mm_lobbies (mode, status, match_id, server_id, map, password, connect_deadline)
    values ('5v5', 'connecting', v_match, v_srv, 'de_dust2', 'pw1234', now() + interval '5 minutes') returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at)
    values (v_lobby, u_a, p_a, 1, 1000, now(), now()), (v_lobby, u_b, p_b, 2, 1000, now(), now());

  -- 2. El poll con B sin vincular.
  v_poll := csstv_mm_poll(v_token, '2.8.2');
  if v_poll !~ E'(^|\n)n1=1(\n|$)' or v_poll !~ E'(^|\n)n2=1(\n|$)' then raise exception 'FALLA 2a: faltan n1/n2: %', v_poll; end if;
  if v_poll !~ E'(^|\n)unlinked=1(\n|$)' then raise exception 'FALLA 2b: unlinked no es 1: %', v_poll; end if;
  if v_poll !~ E'(^|\n)t2=(\n|$)' then raise exception 'FALLA 2c: t2 debería estar vacío: %', v_poll; end if;
  if v_poll !~ (E'(^|\n)t1=' || csstv_steam2(s_a) || E'(\n|$)') then raise exception 'FALLA 2d: t1 no trae a A: %', v_poll; end if;
  ok := ok + 4;

  -- 3. La tarjeta.
  v_card := mm_player_card(p_b, u_b);
  if (v_card->>'linked')::boolean is distinct from false then raise exception 'FALLA 3a: B debería figurar sin vincular: %', v_card->'linked'; end if;
  if (mm_player_card(p_a, u_b)->>'linked')::boolean is distinct from true then raise exception 'FALLA 3b: A debería figurar vinculado'; end if;
  ok := ok + 2;

  -- Antes del !claim, "connected" con el SteamID de B no encuentra a nadie.
  if csstv_mm_report(v_token, v_lobby, 'connected', csstv_steam2(s_b)) then raise exception 'FALLA 4a: connected reconoció un SteamID sin ficha'; end if;
  ok := ok + 1;

  -- 4. !claim de B: código como lo pide la web (auth.uid() = B) y el plugin lo usa con el token.
  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  select code into v_code from create_claim_code();
  perform set_config('request.jwt.claims', '', true);
  v_res := claim_with_code(v_token, csstv_steam2(s_b), v_code, 'jugadorB');
  if (v_res->>'ok')::boolean is distinct from true or (v_res->>'pending')::boolean then raise exception 'FALLA 4b: el !claim no vinculó: %', v_res; end if;
  ok := ok + 1;

  v_poll := csstv_mm_poll(v_token, '2.8.2');
  if v_poll !~ E'(^|\n)unlinked=0(\n|$)' then raise exception 'FALLA 4c: unlinked no bajó a 0: %', v_poll; end if;
  if v_poll !~ (E'(^|\n)t2=' || csstv_steam2(s_b) || E'(\n|$)') then raise exception 'FALLA 4d: t2 no trae a B: %', v_poll; end if;
  if (mm_player_card(p_b, u_b)->>'linked')::boolean is distinct from true then raise exception 'FALLA 4e: B debería figurar vinculado'; end if;
  ok := ok + 3;

  if not csstv_mm_report(v_token, v_lobby, 'connected', csstv_steam2(s_b)) then raise exception 'FALLA 4f: connected no reconoció a B'; end if;
  if (select connected_at from mm_lobby_players where lobby_id = v_lobby and user_id = u_b) is null then raise exception 'FALLA 4g: B no quedó conectado'; end if;
  ok := ok + 2;

  raise notice 'OK: % comprobaciones del replanteo 49', ok;
end $$;

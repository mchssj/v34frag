-- Pruebas del replanteo 77 (irse en la última ronda no es abandono). Las arma probar_77.sh: van entre el replanteo y su
-- inversa, dentro de una transacción que se deshace al final (no dejan nada en la base).
--
-- Partida 16-7 (23 rondas). Al terminar siguen desconectados:
--   u1 (equipo 1): jugó 22, se fue en la última ronda          → no es abandono
--   u2 (equipo 1): jugó 20, se fue 3 rondas antes del final    → abandono, como hoy
--   u3 (equipo 1): jugó 23, se fue en el marcador final        → no es abandono
--   u6 (equipo 2): jugó 22, se fue en la última ronda          → no es abandono
do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 10));
  p uuid[] := '{}';
  st text[] := '{}';
  srv uuid;
  v_match uuid; v_lobby uuid; v_game uuid;
  -- Código de 5 caracteres sin 0, 1, I ni O (matches_link_code_formato).
  v_code text := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 5));
  v_player uuid;
  i int;
  ok int := 0;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select z, z || '@prueba77.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(u) z;
  for i in 1 .. 10 loop
    st := st || (76561197960265728 + floor(random() * 1e9)::bigint)::text;
    insert into players (nick, user_id, steam_id) values ('a77_' || i || '|x', u[i], st[i]) returning id into v_player;
    p := p || v_player;
  end loop;
  insert into game_servers (name, token_hash, active, mm_enabled)
    values ('abandono77-' || substr(md5(random()::text), 1, 6), md5(random()::text), true, true) returning id into srv;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id, link_code)
    values ('mm', 'live', 1, 'team_a', 'team_b', srv, v_code) returning id into v_match;
  insert into mm_lobbies (mode, status, match_id, server_id, map, password)
    values ('5v5', 'live', v_match, srv, 'de_dust2', 'pw7777') returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at, connected_at)
    select v_lobby, u[n], p[n], case when n <= 5 then 1 else 2 end, 1000, now(), now(), now() from generate_series(1, 10) n;

  -- El juego que manda el servidor, con las rondas de cada uno.
  insert into matches (kind, status, map, score1, score2, winner_side, played_at, server_id)
    values ('mix', 'finished', 'de_dust2', 16, 7, 1, now(), srv) returning id into v_game;
  insert into match_player_stats (match_id, steam_id, player_id, team, nick, rounds, kills, deaths, k1)
    select v_game, st[n], p[n], case when n <= 5 then 1 else 2 end, 'a77_' || n,
           case n when 1 then 22 when 2 then 20 when 6 then 22 else 23 end, 10, 10, 0
      from generate_series(1, 10) n;
  update mm_lobby_players set left_at = now() where lobby_id = v_lobby and user_id in (u[1], u[2], u[3], u[6]);

  -- 1. La función
  if not mm_left_last_round(v_game, p[1]) or mm_left_last_round(v_game, p[2]) or not mm_left_last_round(v_game, p[3])
     or not mm_left_last_round(v_game, p[6]) or mm_left_last_round(v_game, gen_random_uuid()) then
    raise exception 'FALLA 1: mm_left_last_round';
  end if;
  ok := ok + 1;

  -- 2. Al vincular el resultado
  if not csstv_link_game(v_game, v_code, 1) then raise exception 'FALLA 2: no vinculó'; end if;
  if exists (select 1 from mm_lobby_players where lobby_id = v_lobby and user_id in (u[1], u[3], u[6]) and (abandoned or left_at is not null)) then
    raise exception 'FALLA 2a: los de la última ronda quedaron como abandono o desconectados';
  end if;
  if not (select abandoned from mm_lobby_players where lobby_id = v_lobby and user_id = u[2]) then
    raise exception 'FALLA 2b: el que se fue antes no abandonó';
  end if;
  ok := ok + 1;

  -- 3. Sanción solo para el que se fue antes
  if exists (select 1 from mm_penalty_log where user_id in (u[1], u[3], u[6]))
     or not exists (select 1 from mm_penalty_log where user_id = u[2] and reason = 'Abandonaste una partida') then
    raise exception 'FALLA 3: sanciones';
  end if;
  ok := ok + 1;

  -- 4. ELO: solo el que se fue antes cuenta como abandono
  if mm_elo_abandoned(v_game, elo_key(st[1])) or mm_elo_abandoned(v_game, elo_key(st[6]))
     or not mm_elo_abandoned(v_game, elo_key(st[2])) then
    raise exception 'FALLA 4: ELO de abandono';
  end if;
  ok := ok + 1;

  -- 5. La partida terminó normal
  if (select status from mm_lobbies where id = v_lobby) <> 'finished' or (select forfeit_team from mm_lobbies where id = v_lobby) is not null then
    raise exception 'FALLA 5: la sala';
  end if;
  ok := ok + 1;

  raise notice 'replanteo 77: % de 5 pruebas bien', ok;
end $$;

-- Pruebas del replanteo 78. Las arma probar_78.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final (no dejan nada en la base).

create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 3));   -- 1 abandona (equipo 1), 2 su compañero, 3 rival
  p uuid[] := '{}';
  st text[] := '{}';
  srv uuid; v_series uuid; v_game uuid; v_other uuid; v_lobby uuid; v_rep uuid;
  base int := coalesce((select base from elo_config where id = 1), 30);
  v_player uuid;
  v_tok text;
  j jsonb;
  d int;
  i int;
  ok int := 0;
begin
  update mm_config set abandon_win_min = 10, abandon_win_max = 15, abandon_loss_min = 15, abandon_loss_max = 20 where id = 1;
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select z, z || '@prueba78.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(u) z;
  for i in 1 .. 3 loop
    st := st || (76561197960265728 + floor(random() * 1e9)::bigint)::text;
    insert into players (nick, user_id, steam_id) values ('r78_' || i, u[i], st[i]) returning id into v_player;
    p := p || v_player;
  end loop;
  insert into game_servers (name, token_hash, active, mm_enabled)
    values ('prueba78-' || substr(md5(random()::text), 1, 6), md5(random()::text), true, true) returning id into srv;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id) values ('mm', 'finished', 1, 'team_a', 'team_b', srv)
    returning id into v_series;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id, parent_match_id, parent_side1, score1, score2)
    values ('mix', 'finished', 1, 'team_a', 'team_b', srv, v_series, 1, 16, 12) returning id into v_game;
  insert into mm_lobbies (mode, status, match_id, server_id, map, password)
    values ('5v5', 'finished', v_series, srv, 'de_dust2', 'pw7878') returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at, connected_at, abandoned)
    values (v_lobby, u[1], p[1], 1, 1000, now(), now(), now(), true),
           (v_lobby, u[2], p[2], 1, 1000, now(), now(), now(), false),
           (v_lobby, u[3], p[3], 2, 1000, now(), now(), now(), false);
  -- El que abandonó jugó 7 de 28 rondas: f = 0,75.
  insert into match_player_stats (match_id, steam_id, player_id, team, rounds)
    values (v_game, st[1], p[1], 1, 7), (v_game, st[2], p[2], 1, 28), (v_game, st[3], p[3], 2, 28);

  -- 1. Su equipo ganó: de 10 a 15 según la parte que no jugó. 10 + round(5 · 0,75) = 14.
  d := mm_elo_delta(v_game, elo_key(st[1]), 1, 1, 0.5, 20);
  if d <> -14 then raise exception 'FALLA 1: ganó y se fue temprano = % (esperaba -14)', d; end if;
  ok := ok + 1;

  -- 2. Perdió, equipos parejos: la derrota normal (2 · base · −0,5) es mayor que 15 a 20 y gana esa.
  d := mm_elo_delta(v_game, elo_key(st[1]), 1, 0, 0.5, -20);
  if d <> least(round(2 * base * (0 - 0.5))::int, -19) then raise exception 'FALLA 2: perdió = % (base %)', d, base; end if;
  if d > -19 then raise exception 'FALLA 2b: perdió y pierde menos que el rango: %', d; end if;
  ok := ok + 1;

  -- 3. Perdió siendo muy favorito el rival (la derrota normal es chica): pierde lo del rango, 15 + round(5 · 0,75) = 19.
  d := mm_elo_delta(v_game, elo_key(st[1]), 1, 0, 0.05, -3);
  if d <> least(round(2 * base * (0 - 0.05))::int, -19) then raise exception 'FALLA 3: perdió de punto = %', d; end if;
  if d > -19 then raise exception 'FALLA 3b: menos de 19: %', d; end if;
  ok := ok + 1;

  -- 4. Empate: como derrota.
  d := mm_elo_delta(v_game, elo_key(st[1]), 1, 0.5, 0.5, 0);
  if d <> least(round(2 * base * (0 - 0.5))::int, -19) then raise exception 'FALLA 4: empate = %', d; end if;
  ok := ok + 1;

  -- 5. Se fue cerca del final (27 de 28): el mínimo de cada rango.
  update match_player_stats set rounds = 27 where match_id = v_game and steam_id = st[1];
  d := mm_elo_delta(v_game, elo_key(st[1]), 1, 1, 0.5, 20);
  if d <> -10 then raise exception 'FALLA 5: ganó y se fue al final = %', d; end if;
  d := mm_elo_delta(v_game, elo_key(st[1]), 1, 0, 0.05, -3);
  if d <> least(round(2 * base * (0 - 0.05))::int, -15) then raise exception 'FALLA 5b: perdió y se fue al final = %', d; end if;
  -- Sin estadísticas suyas en el juego: el máximo.
  delete from match_player_stats where match_id = v_game and steam_id = st[1];
  d := mm_elo_delta(v_game, elo_key(st[1]), 1, 1, 0.5, 20);
  if d <> -15 then raise exception 'FALLA 5c: sin estadísticas = %', d; end if;
  insert into match_player_stats (match_id, steam_id, player_id, team, rounds) values (v_game, st[1], p[1], 1, 7);
  ok := ok + 1;

  -- 6. Los topes salen de la configuración y no se pueden cruzar.
  update mm_config set abandon_win_min = 2, abandon_win_max = 2 where id = 1;
  if mm_elo_delta(v_game, elo_key(st[1]), 1, 1, 0.5, 20) <> -2 then raise exception 'FALLA 6: tope de la configuración'; end if;
  begin
    update mm_config set abandon_loss_min = 21, abandon_loss_max = 20 where id = 1;
    raise exception 'FALLA 6b: aceptó min > max';
  exception when check_violation then null;
  end;
  update mm_config set abandon_win_min = 10, abandon_win_max = 15 where id = 1;
  ok := ok + 1;

  -- 7. El compañero que no abandonó sigue con su regla (gana más porque jugaron con uno menos): no es la del abandono.
  d := mm_elo_delta(v_game, elo_key(st[2]), 1, 1, 0.5, 20);
  if d is null or d <= 20 then raise exception 'FALLA 7: compañero = %', d; end if;
  ok := ok + 1;

  -- 8. Rondas del reemplazo: se pide en la 6 (3-2 en vivo) y entra en la 11 (5-5).
  insert into live_matches (uid, server_id, seq, map, score_a, score_b, max_rounds, payload, started_at)
    values ('live78-' || srv, srv, 1, 'de_dust2', 3, 2, 30, '{}', now());
  v_rep := mm_replace_open(v_lobby, 1::smallint, u[1], 'auto');
  if (select left_round from mm_replacements where id = v_rep) <> 6 then raise exception 'FALLA 8: left_round'; end if;
  select token into v_tok from mm_replacements where id = v_rep;
  ok := ok + 1;

  -- 9. La página del link: la sala en vista previa, sin el servidor ni lo privado; quién se fue y en qué ronda.
  update mm_lobbies set status = 'live' where id = v_lobby;
  perform pg_temp.como(u[3]);
  j := mm_replace_info(v_tok);
  if j->'room' is null or jsonb_array_length(j->'room'->'players') <> 3 or j->'room' ? 'server' or j->'room' ? 'reported'
     or j->'room' ? 'elo_stake' or j->>'replaced_nick' <> (select nick from players where id = p[1]) or (j->>'left_round')::int <> 6 then
    raise exception 'FALLA 9: %', j;
  end if;
  if jsonb_array_length(j->'room'->'replacements') <> 1 or j->'room'->'replacements'->0->>'status' <> 'open' then
    raise exception 'FALLA 9b: replacements = %', j->'room'->'replacements';
  end if;
  perform pg_temp.como(null);
  ok := ok + 1;

  -- 10. Tomado: el plazo para conectarse en la sala. Entra: la ronda y quién reemplaza a quién.
  update mm_replacements set status = 'taken', taken_by = u[2], token = null, connect_deadline = now() + interval '3 minutes' where id = v_rep;
  j := mm_lobby_replacements(v_lobby);
  if j->0->>'connect_deadline' is null or j->0->>'by_nick' <> (select nick from players where id = p[2]) then raise exception 'FALLA 10: tomado = %', j; end if;
  update live_matches set score_a = 5, score_b = 5, updated_at = now() where server_id = srv;
  perform mm_replace_arrived(v_lobby, u[2]);
  j := mm_lobby_json(v_lobby, u[3])->'replacements';
  if j->0->>'status' <> 'connected' or (j->0->>'joined_round')::int <> 11 or j->0->>'connect_deadline' is not null
     or j->0->>'replaced_nick' <> (select nick from players where id = p[1]) then
    raise exception 'FALLA 10b: entró = %', j;
  end if;
  ok := ok + 1;

  -- 11. La sala del detalle: cualquiera con sesión, solo terminada, sin el servidor; otra partida da null; sin sesión, no.
  update mm_lobbies set status = 'finished' where id = v_lobby;
  perform pg_temp.como(u[3]);
  j := mm_game_room(v_game);
  if j is null or j ? 'server' or j ? 'reported' or j->'match' is null or jsonb_array_length(j->'replacements') <> 1 then
    raise exception 'FALLA 11: %', j;
  end if;
  insert into matches (kind, status, best_of, side1_name, side2_name) values ('mix', 'finished', 1, 'a', 'b') returning id into v_other;
  if mm_game_room(v_other) is not null then raise exception 'FALLA 11b: un mix sin sala'; end if;
  if mm_game_room(v_series) is not null then raise exception 'FALLA 11c: la serie (no el juego)'; end if;
  perform pg_temp.como(null);
  begin
    perform mm_game_room(v_game);
    raise exception 'FALLA 11d: sin sesión';
  exception when insufficient_privilege then null;
  end;
  ok := ok + 1;

  -- 12. El manual y los permisos.
  if (manual_valores()->>'mm.abandono_perdido_max')::int <> 20 or (manual_valores()->>'mm.abandono_ganado_min')::int <> 10 then
    raise exception 'FALLA 12: manual_valores';
  end if;
  if has_function_privilege('anon', 'public.mm_game_room(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.mm_lobby_replacements(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.mm_replace_round(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.mm_game_room(uuid)', 'execute') then
    raise exception 'FALLA 12b: permisos';
  end if;
  ok := ok + 1;

  raise notice 'OK: % comprobaciones del replanteo 78', ok;
end $$;

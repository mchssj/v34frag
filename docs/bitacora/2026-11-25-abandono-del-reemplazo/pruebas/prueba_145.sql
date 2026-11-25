-- Pruebas del replanteo 145. Las arma probar_145.sh, entre el replanteo y su inversa, en una transacción que se deshace.
--
-- Copia del caso real (2026-11-25, 8-16, 24 rondas). Gana el equipo 2. Al terminar siguen desconectados:
--   u11 (equipo 1): reemplazo de u5, entró en la 16, jugó 8 (16 a 23)   → última ronda: no es abandono
--   u2  (equipo 1): jugó 23                                            → última ronda: no es abandono
--   u6  (equipo 2, el que gana): jugó 22                               → abandono, pierde de 10 a 15
-- Y, sobre la misma partida, u11 con 5 rondas (se fue en la 21): abandono de un reemplazo.
do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 11));
  p uuid[] := '{}';
  st text[] := '{}';
  srv uuid; v_match uuid; v_lobby uuid; v_game uuid; v_player uuid;
  v_code text := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 5));
  i int; d int; viejo int; e int;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select z, z || '@prueba145.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(u) z;
  for i in 1 .. 11 loop
    st := st || (76561197960265728 + floor(random() * 1e9)::bigint)::text;
    insert into players (nick, user_id, steam_id) values ('a145_' || i || '|x', u[i], st[i]) returning id into v_player;
    p := p || v_player;
  end loop;
  insert into game_servers (name, token_hash, active, mm_enabled)
    values ('abandono145-' || substr(md5(random()::text), 1, 6), md5(random()::text), true, true) returning id into srv;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id, link_code)
    values ('mm', 'live', 1, 'team_a', 'team_b', srv, v_code) returning id into v_match;
  insert into mm_lobbies (mode, status, match_id, server_id, map, password)
    values ('5v5', 'live', v_match, srv, 'de_tuscan', 'pw1455') returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at, connected_at)
    select v_lobby, u[n], p[n], case when n <= 5 or n = 11 then 1 else 2 end, 1000, now(), now(), now() from generate_series(1, 11) n;
  update mm_lobby_players set abandoned = true, replaced_by = u[11] where lobby_id = v_lobby and user_id = u[5];
  update mm_lobby_players set replaces_user_id = u[5] where lobby_id = v_lobby and user_id = u[11];
  insert into mm_replacements (lobby_id, team, replaced_user_id, source, status, token_hash, expires_at, taken_by, taken_at, connected_at, left_round, joined_round)
    values (v_lobby, 1, u[5], 'auto', 'connected', md5(random()::text), now(), u[11], now(), now(), 16, 16);

  insert into matches (kind, status, map, score1, score2, winner_side, played_at, server_id)
    values ('mix', 'finished', 'de_tuscan', 8, 16, 2, now(), srv) returning id into v_game;
  insert into match_player_stats (match_id, steam_id, player_id, team, nick, rounds, kills, deaths, k1, rating)
    select v_game, st[n], p[n], case when n <= 5 or n = 11 then 1 else 2 end, 'a145_' || n,
           case n when 2 then 23 when 5 then 13 when 6 then 22 when 11 then 8 else 24 end, 10, 10, 0, 1
      from generate_series(1, 11) n;
  update mm_lobby_players set left_at = now() where lobby_id = v_lobby and user_id in (u[2], u[6], u[11]);

  if not csstv_link_game(v_game, v_code, 1) then raise exception 'FALLA 0: no vinculó'; end if;

  -- 1. Última ronda
  if mm_rounds_before(v_game, p[11]) <> 15 or mm_rounds_before(v_game, p[2]) <> 0 then raise exception 'FALLA 1a: mm_rounds_before'; end if;
  if (select abandoned from mm_lobby_players where lobby_id = v_lobby and user_id = u[11])
     or exists (select 1 from mm_penalty_log where user_id in (u[2], u[11])) then raise exception 'FALLA 1b: el reemplazo quedó como abandono'; end if;
  if not (select abandoned from mm_lobby_players where lobby_id = v_lobby and user_id = u[6]) then raise exception 'FALLA 1c: u6 no abandonó'; end if;
  raise notice '1. ultima ronda del reemplazo: bien';

  -- 2. Los pasos de un punto a otro, con la partida entera (elo_apply_match)
  if not exists (select 1 from match_player_stats where match_id = v_game and elo_after is not null) then perform elo_apply_match(v_game); end if;
  if (select elo_delta from match_player_stats where match_id = v_game and player_id = p[11]) is not null then raise exception 'FALLA 2a: el reemplazo con 8 de 24 movió ELO'; end if;
  select elo_delta into d from match_player_stats where match_id = v_game and player_id = p[6];
  if d <> -10 then raise exception 'FALLA 2b: u6 (equipo que gana, jugó 22 de 24) debía perder 10 y perdió %', d; end if;
  select elo_delta into d from match_player_stats where match_id = v_game and player_id = p[5];
  if d not between -22 and -17 then raise exception 'FALLA 2c: u5 (abandonó perdiendo) %', d; end if;
  raise notice '2. elo_apply_match: reemplazo sin cambio, abandono con victoria -10, abandono con derrota %: bien', d;

  -- 3. El recálculo de una ficha da lo mismo que el original
  select elo_delta into d from match_player_stats where match_id = v_game and player_id = p[6];
  perform elo_recompute_player(st[6]);
  select elo_delta into e from match_player_stats where match_id = v_game and player_id = p[6];
  if d is distinct from e then raise exception 'FALLA 3: recalculado % y original %', e, d; end if;
  raise notice '3. elo_recompute_player igual: bien';

  -- 4. Reemplazo que abandona de verdad: jugó 5 (16 a 20) de 24; no jugó 4, no 19
  update match_player_stats set rounds = 5 where match_id = v_game and player_id = p[11];
  if mm_left_last_round(v_game, p[11]) then raise exception 'FALLA 4a: se fue 4 rondas antes'; end if;
  update mm_lobby_players set abandoned = true where lobby_id = v_lobby and user_id = u[11];
  d := mm_elo_delta(v_game, elo_key(st[11]), 1, 0, 0.2, -10);      -- 15 + 5 * 4/24 = 15.8
  if d <> -16 then raise exception 'FALLA 4b: esperaba -16 y dio %', d; end if;
  -- Con el equipo como favorito, nunca menos que la derrota normal
  if mm_elo_delta(v_game, elo_key(st[11]), 1, 0, 0.6, -10) <> -24 then raise exception 'FALLA 4c: derrota normal'; end if;
  raise notice '4. abandono de un reemplazo: bien';

  -- 5. Ajuste de los equipos con un solo abandono, el del reemplazo: 4 de 24 rondas al 50 % = 8,3 %
  update mm_lobby_players set abandoned = false where lobby_id = v_lobby and user_id = u[6];
  if mm_elo_delta(v_game, elo_key(st[7]), 2, 1, 0.5, 24) <> 22 or mm_elo_delta(v_game, elo_key(st[1]), 1, 0, 0.5, -24) <> -22 then
    raise exception 'FALLA 5: ajuste de los equipos (% y %)', mm_elo_delta(v_game, elo_key(st[7]), 2, 1, 0.5, 24), mm_elo_delta(v_game, elo_key(st[1]), 1, 0, 0.5, -24);
  end if;
  raise notice '5. ajuste de los equipos: bien';

  -- 6. Una partida anterior a la fecha de corte da lo de siempre
  update mm_lobby_players set abandoned = true where lobby_id = v_lobby and user_id = u[6];
  update mm_config set abandon_rules_from = now() + interval '1 hour' where true;
  viejo := mm_elo_delta(v_game, elo_key(st[6]), 2, 0, 0.5981, -24);
  if viejo <> -24 then raise exception 'FALLA 6a: abandono con victoria anterior al corte: %', viejo; end if;
  viejo := mm_elo_delta(v_game, elo_key(st[11]), 1, 0, 0.2, -10);  -- 15 + 5 * 19/24 = 18.96
  if viejo <> -19 then raise exception 'FALLA 6b: abandono del reemplazo anterior al corte: %', viejo; end if;
  raise notice '6. anteriores al corte, igual que antes: bien';
end $$;

-- 7. Las partidas reales con abandono dan el mismo ELO que tienen guardado, si se recalculan
do $$
declare n int; malas int;
begin
  select count(*), count(*) filter (where mm_elo_delta(m.id, elo_key(s.steam_id), s.team, 0, s.win_prob::double precision, 0) is distinct from s.elo_delta and s.elo_after > 100)
    into n, malas
    from matches m join match_player_stats s on s.match_id = m.id
   where m.kind = 'mix' and m.parent_match_id is not null and s.elo_delta is not null and s.win_prob is not null
     and s.nick not like 'a145_%' and mm_elo_abandoned(m.id, elo_key(s.steam_id)) and m.played_at >= (select formula_from from elo_config where id = 1) and m.end_reason is distinct from 'crash';
  raise notice '7. abandonos reales revisados: %, distintos de lo guardado: %', n, malas;
  if malas > 0 then raise exception 'FALLA 7'; end if;
end $$;

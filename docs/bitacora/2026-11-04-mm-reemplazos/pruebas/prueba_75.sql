-- Pruebas del replanteo 75 (reemplazos en el matchmaking). Las arma probar_75.sh: van entre el replanteo y su inversa, dentro
-- de una transacción que se deshace al final (no dejan nada en la base). Los dos clics a la vez se prueban aparte, con dos
-- sesiones: concurrencia_75.sh.

create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;
create or replace function pg_temp.campo(poll text, k text) returns text language sql as $$
  select substring(poll from '(?:^|\n)' || k || '=([^\n]*)') $$;
-- La vuelta de mm_tick, como si hubiera pasado el tiempo de cada plazo.
create or replace function pg_temp.tick() returns void language sql as $$ select mm_tick() $$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 14));   -- 1-10 la sala, 11-14 candidatos
  p uuid[] := '{}';
  st text[] := '{}';
  srv uuid;
  tok text := 'tok75-' || substr(md5(random()::text), 1, 12);
  v_match uuid; v_lobby uuid; v_lobby2 uuid;
  v_poll text;
  v_pend jsonb;
  v_info jsonb;
  v_token text;
  v_player uuid;
  x mm_replacements%rowtype;
  i int;
  ok int := 0;
  err text;
begin
  update mm_config set replace_enabled = true, require_anticheat = false, min_mixes = 0, min_account_days = 0,
                       reconnect_minutes = 3, replace_link_minutes = 10, replace_min_rounds_left = 4 where id = 1;
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select z, z || '@prueba75.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(u) z;
  for i in 1 .. 14 loop
    st := st || (76561197960265728 + floor(random() * 1e9)::bigint)::text;
    insert into players (nick, user_id, steam_id) values ('r75_' || i || '|x', u[i], st[i]) returning id into v_player;
    p := p || v_player;
  end loop;
  insert into game_servers (name, token_hash, active, mm_enabled)
    values ('reemplazo75-' || substr(md5(random()::text), 1, 6), encode(sha256(convert_to(tok, 'UTF8')), 'hex'), true, true) returning id into srv;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id) values ('mm', 'live', 1, 'team_a', 'team_b', srv)
    returning id into v_match;
  insert into mm_lobbies (mode, status, match_id, server_id, map, password)
    values ('5v5', 'live', v_match, srv, 'de_dust2', 'pw7575') returning id into v_lobby;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at, connected_at)
    select v_lobby, u[n], p[n], case when n <= 5 then 1 else 2 end, 1000, now(), now(), now() from generate_series(1, 10) n;
  insert into live_matches (uid, server_id, seq, map, score_a, score_b, max_rounds, payload, started_at)
    values ('live75-' || srv, srv, 1, 'de_dust2', 3, 2, 30, '{}', now());

  -- 1. En vivo, sin nadie afuera: se puede pedir en los dos equipos y no hay desconectados.
  v_poll := csstv_mm_poll(tok, '2.10.0');
  if pg_temp.campo(v_poll, 'replace') <> '1,1' or pg_temp.campo(v_poll, 'away') <> '' or pg_temp.campo(v_poll, 'abandons') <> '0,0'
     or pg_temp.campo(v_poll, 'replace_vote') <> (select replace_vote_pct || ',' || replace_vote_seconds || ',' || replace_vote_cooldown_s from mm_config) then
    raise exception 'FALLA 1: %', v_poll;
  end if;
  ok := ok + 1;

  -- 2. El 1 se desconecta: aparece en away (sin el | de su nick). Con los 3 minutos vencidos, abandona y se llama un reemplazo.
  update mm_lobby_players set left_at = now() - interval '10 minutes' where lobby_id = v_lobby and user_id = u[1];
  -- El nick de la ficha es el alias de la cuenta (players_nick_alias).
  update profiles set tag = 'r75_1|x' where id = u[1];
  update players set nick = 'r75_1|x' where id = p[1];
  if (select nick from players where id = p[1]) <> 'r75_1|x' then raise exception 'PREPARACIÓN: no se pudo poner el nick'; end if;
  v_poll := csstv_mm_poll(tok, '2.10.0');
  if pg_temp.campo(v_poll, 'away') <> csstv_steam2(st[1]) || '|1|r75_1x' then raise exception 'FALLA 2a: away = %', pg_temp.campo(v_poll, 'away'); end if;
  perform pg_temp.tick();
  select * into x from mm_replacements where lobby_id = v_lobby;
  if x.id is null or x.status <> 'open' or x.source <> 'auto' or x.team <> 1 or x.replaced_user_id <> u[1] or x.token is null
     or x.token_hash <> mm_replace_hash(x.token) or x.expires_at < now() + interval '9 minutes' then
    raise exception 'FALLA 2b: %', row_to_json(x);
  end if;
  if not (select abandoned from mm_lobby_players where lobby_id = v_lobby and user_id = u[1]) then raise exception 'FALLA 2c: no abandonó'; end if;
  v_poll := csstv_mm_poll(tok, '2.10.0');
  if pg_temp.campo(v_poll, 'abandons') <> '1,0' or pg_temp.campo(v_poll, 'replace') <> '0,1' then raise exception 'FALLA 2d: %', v_poll; end if;
  ok := ok + 4;

  -- 3. El worker lo publica: pending trae el token; al marcarlo, el token se borra y no queda nada pendiente.
  v_pend := mm_replace_pending() -> 0;
  if v_pend->>'id' <> x.id::text or v_pend->>'shown' <> 'open' or v_pend->>'token' <> x.token or v_pend->>'map' <> 'de_dust2'
     or (v_pend->'score'->>'a')::int <> 3 then
    raise exception 'FALLA 3a: %', v_pend;
  end if;
  v_token := x.token;
  perform mm_replace_mark(x.id, 'open', '111', true);
  if (select token from mm_replacements where id = x.id) is not null then raise exception 'FALLA 3b: el token quedó en claro'; end if;
  if jsonb_array_length(mm_replace_pending()) <> 0 then raise exception 'FALLA 3c: %', mm_replace_pending(); end if;
  ok := ok + 3;

  -- 4. La página del link: un candidato lo puede tomar; uno de la sala no.
  perform pg_temp.como(u[11]);
  v_info := mm_replace_info(v_token);
  if v_info->>'status' <> 'open' or v_info->>'reason' is not null or v_info->>'team_name' <> 'team_a' or (v_info->>'mine')::boolean then
    raise exception 'FALLA 4a: %', v_info;
  end if;
  perform pg_temp.como(u[2]);
  if mm_replace_info(v_token)->>'reason' <> 'Ya jugaste en esta partida' then raise exception 'FALLA 4b: %', mm_replace_info(v_token); end if;
  begin
    perform mm_replace_take(v_token);
    raise exception 'FALLA 4c: uno de la sala lo tomó';
  exception when raise_exception then
    get stacked diagnostics err = message_text;
    if err like 'FALLA%' then raise; end if;
  end;
  perform pg_temp.como(u[1]);
  if mm_replace_info(v_token)->>'reason' <> 'Ya jugaste en esta partida' then raise exception 'FALLA 4d: el que abandonó'; end if;
  begin
    perform mm_replace_info('no-existe');
    raise exception 'FALLA 4e: un token que no existe';
  exception when no_data_found then null;
  end;
  ok := ok + 5;

  -- 5. Lo toma el 11 (estaba en la cola: sale). El 12 llega tarde. El 11 otra vez: devuelve la sala.
  insert into mm_queue (user_id, player_id, mode, elo) values (u[11], p[11], '5v5', 1000);
  perform pg_temp.como(u[11]);
  if mm_replace_take(v_token) <> v_lobby then raise exception 'FALLA 5a: no devolvió la sala'; end if;
  if exists (select 1 from mm_queue where user_id = u[11]) then raise exception 'FALLA 5b: sigue en la cola'; end if;
  if not exists (select 1 from mm_lobby_players where lobby_id = v_lobby and user_id = u[11] and team = 1 and replaces_user_id = u[1]
                   and accepted_at is not null and connected_at is null) then
    raise exception 'FALLA 5c: no entró a la sala en el equipo 1';
  end if;
  if mm_replace_take(v_token) <> v_lobby then raise exception 'FALLA 5d: la segunda vez del mismo'; end if;
  perform pg_temp.como(u[12]);
  begin
    perform mm_replace_take(v_token);
    raise exception 'FALLA 5e: lo tomaron dos';
  exception when sqlstate 'V3901' then
    get stacked diagnostics err = message_text;
    if err <> 'Ya lo tomó otro jugador' then raise exception 'FALLA 5f: %', err; end if;
  end;
  if mm_replace_info(v_token)->>'status' <> 'taken' then raise exception 'FALLA 5g: %', mm_replace_info(v_token); end if;
  perform pg_temp.como(null);
  ok := ok + 7;

  -- 6. El plantel del servidor: sin el 1, con el 11. El abandono todavía no está cubierto. Discord: "encontrado".
  v_poll := csstv_mm_poll(tok, '2.10.0');
  if position(csstv_steam2(st[1]) in pg_temp.campo(v_poll, 't1')) > 0 or position(csstv_steam2(st[11]) in pg_temp.campo(v_poll, 't1')) = 0
     or pg_temp.campo(v_poll, 'n1') <> '5' or pg_temp.campo(v_poll, 'abandons') <> '1,0' then
    raise exception 'FALLA 6a: %', v_poll;
  end if;
  v_pend := mm_replace_pending() -> 0;
  if v_pend->>'shown' <> 'found' or v_pend->>'message_id' <> '111' or v_pend->>'token' is not null then raise exception 'FALLA 6b: %', v_pend; end if;
  perform mm_replace_mark(x.id, 'found', null, true);
  ok := ok + 2;

  -- 7. El 11 entra al servidor (en vivo llega como "back"): conectado y el abandono del 1 queda cubierto.
  if not csstv_mm_report(tok, v_lobby, 'back', csstv_steam2(st[11])) then raise exception 'FALLA 7a: back del reemplazo'; end if;
  if (select status from mm_replacements where id = x.id) <> 'connected'
     or (select replaced_by from mm_lobby_players where lobby_id = v_lobby and user_id = u[1]) <> u[11]
     or (select connected_at from mm_lobby_players where lobby_id = v_lobby and user_id = u[11]) is null then
    raise exception 'FALLA 7b: no quedó conectado ni cubierto';
  end if;
  v_poll := csstv_mm_poll(tok, '2.10.0');
  if pg_temp.campo(v_poll, 'abandons') <> '0,0' or pg_temp.campo(v_poll, 'replace') <> '1,1' then raise exception 'FALLA 7c: %', v_poll; end if;
  if not exists (select 1 from jsonb_array_elements(mm_lobby_json(v_lobby, u[2])->'players') c
                  where c->>'player_id' = p[11]::text and (c->>'replacement')::boolean) then
    raise exception 'FALLA 7d: la ficha no dice que es reemplazo';
  end if;
  ok := ok + 4;

  -- 8. Dos abandonos más en el equipo 1: se llama de a uno. Sin cubrir quedan 2: el equipo 1 pierde por abandono.
  update mm_lobby_players set left_at = now() - interval '10 minutes' where lobby_id = v_lobby and user_id in (u[2], u[3]);
  perform pg_temp.tick();
  if (select count(*) from mm_replacements where lobby_id = v_lobby and team = 1 and status = 'open') <> 1 then raise exception 'FALLA 8a: más de uno abierto'; end if;
  if (select forfeit_team from mm_lobbies where id = v_lobby) is distinct from 1 then raise exception 'FALLA 8b: no perdió el equipo 1'; end if;
  ok := ok + 2;

  -- 9. !callreplace: el 6 (equipo 2) recién se fue. El voto lo da por abandonado en el acto, con sanción. El 7 no se fue: no pasa nada.
  update mm_lobby_players set left_at = now() where lobby_id = v_lobby and user_id = u[6];
  if not csstv_mm_report(tok, v_lobby, 'callreplace', csstv_steam2(st[6])) then raise exception 'FALLA 9a: callreplace'; end if;
  if not (select abandoned from mm_lobby_players where lobby_id = v_lobby and user_id = u[6])
     or not exists (select 1 from mm_replacements where lobby_id = v_lobby and replaced_user_id = u[6] and source = 'vote' and status = 'open')
     or not exists (select 1 from mm_penalty_log where user_id = u[6] and reason like '%pidió un reemplazo%') then
    raise exception 'FALLA 9b: el voto no lo dio por abandonado';
  end if;
  if csstv_mm_report(tok, v_lobby, 'callreplace', csstv_steam2(st[7])) then raise exception 'FALLA 9c: callreplace de uno conectado'; end if;
  ok := ok + 3;

  -- 10. El 12 toma el del equipo 2 y no entra a tiempo: sale de la sala, se lo sanciona y se vuelve a llamar.
  select * into x from mm_replacements where lobby_id = v_lobby and replaced_user_id = u[6];
  perform pg_temp.como(u[12]);
  perform mm_replace_take(x.token);
  perform pg_temp.como(null);
  update mm_replacements set connect_deadline = now() - interval '1 second' where id = x.id;
  perform pg_temp.tick();
  if (select status from mm_replacements where id = x.id) <> 'cancelled' or exists (select 1 from mm_lobby_players where lobby_id = v_lobby and user_id = u[12])
     or not exists (select 1 from mm_penalty_log where user_id = u[12] and reason like 'No te conectaste%') then
    raise exception 'FALLA 10a: el que no entró';
  end if;
  if not exists (select 1 from mm_replacements where lobby_id = v_lobby and replaced_user_id = u[6] and status = 'open' and id <> x.id) then
    raise exception 'FALLA 10b: no se volvió a llamar';
  end if;
  ok := ok + 2;

  -- 11. El link vence: queda vencido (sin el token en claro) y no se vuelve a llamar por ese jugador.
  v_token := (select token from mm_replacements where lobby_id = v_lobby and replaced_user_id = u[6] and status = 'open');
  update mm_replacements set expires_at = now() - interval '1 second' where lobby_id = v_lobby and replaced_user_id = u[6] and status = 'open';
  perform pg_temp.tick();
  perform pg_temp.tick();
  if exists (select 1 from mm_replacements where lobby_id = v_lobby and replaced_user_id = u[6] and status = 'open')
     or not exists (select 1 from mm_replacements where lobby_id = v_lobby and replaced_user_id = u[6] and status = 'expired') then
    raise exception 'FALLA 11: vencimiento';
  end if;
  if exists (select 1 from mm_replacements where lobby_id = v_lobby and status in ('expired', 'cancelled') and token is not null) then
    raise exception 'FALLA 11a: quedó un token en claro';
  end if;
  perform pg_temp.como(u[13]);
  if mm_replace_info(v_token)->>'status' <> 'expired' then
    raise exception 'FALLA 11b: la página no dice vencido';
  end if;
  perform pg_temp.como(null);
  ok := ok + 3;

  -- 12. Cerca del final (13-10 en MR15: faltan 3 rondas como mínimo) no se llama; tampoco el voto.
  update live_matches set score_a = 13, score_b = 10, updated_at = now() where server_id = srv;
  if mm_replace_rounds_left(srv) <> 3 then raise exception 'FALLA 12a: rondas = %', mm_replace_rounds_left(srv); end if;
  update mm_lobby_players set left_at = now() where lobby_id = v_lobby and user_id = u[8];
  if csstv_mm_report(tok, v_lobby, 'callreplace', csstv_steam2(st[8])) then raise exception 'FALLA 12b: el voto cerca del final'; end if;
  if pg_temp.campo(csstv_mm_poll(tok, '2.10.0'), 'replace') <> '0,0' then raise exception 'FALLA 12c: replace'; end if;
  ok := ok + 3;

  -- 13. Apagado: no se llama a nadie.
  update live_matches set score_a = 3, score_b = 2, updated_at = now() where server_id = srv;
  update mm_config set replace_enabled = false where id = 1;
  if mm_replace_can_open(v_lobby, 2::smallint) then raise exception 'FALLA 13: apagado'; end if;
  update mm_config set replace_enabled = true where id = 1;
  ok := ok + 1;

  -- 14. La partida termina: lo abierto vence y el aviso pasa a "cerrado".
  update mm_lobbies set status = 'finished', ended_at = now() where id = v_lobby;
  perform pg_temp.tick();
  if exists (select 1 from mm_replacements where lobby_id = v_lobby and status in ('open', 'taken')) then raise exception 'FALLA 14a: quedó abierto'; end if;
  ok := ok + 1;

  -- 15. Configuración desde Administración.
  update profiles set role = 'admin' where id = u[14];
  perform pg_temp.como(u[14]);
  perform mm_set_config('{"replace_link_minutes": 7, "replace_vote_pct": 90, "replace_enabled": false}');
  perform pg_temp.como(null);
  if (select (replace_link_minutes, replace_vote_pct, replace_enabled) from mm_config) <> (7, 90, false) then raise exception 'FALLA 15'; end if;
  ok := ok + 1;

  -- 15b. El manual muestra los valores.
  if (select (manual_valores()->>'mm.reemplazo_link')::int) <> 7 or (select (manual_valores()->>'mm.reemplazo_voto')::int) <> 90
     or (select (manual_valores()->>'mm.reemplazo_rondas')::int) <> 4 then
    raise exception 'FALLA 15b: manual_valores';
  end if;
  ok := ok + 1;

  -- 16. Permisos: la web no ve la tabla ni las funciones del worker.
  if has_table_privilege('authenticated', 'public.mm_replacements', 'select') or has_function_privilege('authenticated', 'public.mm_replace_pending()', 'execute')
     or has_function_privilege('anon', 'public.mm_replace_take(text)', 'execute') or not has_function_privilege('authenticated', 'public.mm_replace_take(text)', 'execute') then
    raise exception 'FALLA 16: permisos';
  end if;
  ok := ok + 1;

  raise notice 'OK: % comprobaciones del replanteo 75', ok;
end $$;

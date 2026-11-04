-- Pruebas del replanteo 56 (iniciar partidas de torneo y PCW). Se corren con correr_local.sh, dentro de una transacción
-- que se deshace al final: no dejan nada en la base.

create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;
create or replace function pg_temp.campo(txt text, k text) returns text language sql as $$
  select substring(txt from '(?:^|\n)' || k || '=([^\n]*)') $$;
create or replace function pg_temp.esperar_error(q text, quiero text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'FALLA: se esperaba el error "%" y no hubo error en: %', quiero, q;
exception when others then
  if sqlerrm not like '%' || quiero || '%' and sqlstate <> quiero then
    raise exception 'FALLA: se esperaba "%" y salió "%" (%) en: %', quiero, sqlerrm, sqlstate, q;
  end if;
end $$;

do $$
declare
  sfx text := substr(md5(random()::text), 1, 6);
  u_org uuid := gen_random_uuid();
  u_out uuid := gen_random_uuid();
  ua uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  ub uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  pa uuid[] := '{}'; pb uuid[] := '{}';
  t_a uuid; t_b uuid; s_a uuid; s_b uuid;
  v_event uuid; v_match uuid; v_pcw uuid; v_pcw2 uuid; v_bo3 uuid;
  srv_t uuid; srv_p uuid;
  tok_t text := 'tok56t-' || substr(md5(random()::text), 1, 12);
  tok_p text := 'tok56p-' || substr(md5(random()::text), 1, 12);
  b match_bookings%rowtype;
  v_poll text;
  v_state jsonb;
  v_id uuid;
  v_ok boolean;
  v_until timestamptz;
  i int;
  u uuid;
  ok int := 0;
begin
  -- Mapas propios para que el veto sea corto (BO1 con 3 mapas: 2 bans y el decisivo).
  insert into map_pool (name, versions, active, position, veto_default)
    values ('de_t56a', array['de_t56a'], true, 900, false), ('de_t56b', array['de_t56b'], true, 901, false), ('de_t56c', array['de_t56c'], true, 902, false),
           ('de_t56d', array['de_t56d'], true, 903, false), ('de_t56e', array['de_t56e'], true, 904, false);

  -- Cuentas: organizador, alguien de afuera y dos planteles de 5.
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated'
      from unnest(array[u_org, u_out] || ua || ub) x;
  update profiles set role = 'organizer' where id = u_org;
  for i in 1..5 loop
    insert into players (nick, user_id, steam_id) values ('a' || i || sfx, ua[i], (76561197960265728 + floor(random() * 1e9)::bigint)::text) returning id into v_id;
    pa := pa || v_id;
    insert into players (nick, user_id, steam_id) values ('b' || i || sfx, ub[i], (76561197960265728 + floor(random() * 1e9)::bigint)::text) returning id into v_id;
    pb := pb || v_id;
  end loop;
  insert into teams (name, tag, owner_id, captain_id, kind) values ('Alfa' || sfx, 'ALF', ua[1], ua[1], 'official') returning id into t_a;
  insert into teams (name, tag, owner_id, captain_id, kind) values ('Beta' || sfx, 'BET', ub[1], ub[1], 'official') returning id into t_b;
  insert into team_members (team_id, player_id) select t_a, x from unnest(pa) x;
  insert into team_members (team_id, player_id) select t_b, x from unnest(pb) x;

  insert into events (name, organizer_id, status, map_pool, veto_turn_seconds)
    values ('Copa56 ' || sfx, u_org, 'in_progress', array['de_t56a', 'de_t56b', 'de_t56c'], 30) returning id into v_event;
  insert into tournament_registration_players (event_id, team_id, player_id)
    select v_event, t_a, x from unnest(pa) x union all select v_event, t_b, x from unnest(pb) x;
  insert into matches (event_id, kind, status, best_of, team1, team2) values (v_event, 'official', 'upcoming', 1, t_a, t_b) returning id into v_match;
  update matches set link_code = coalesce(link_code, 'TQ' || translate(upper(substr(md5(random()::text), 1, 3)), '01IO', '2345')) where id = v_match;

  -- Servidores: uno apto para torneos y otro para PCW, los dos en línea.
  insert into game_servers (name, token_hash, active, official_enabled, connect_address, region)
    values ('t56-torneo-' || sfx, encode(sha256(convert_to(tok_t, 'UTF8')), 'hex'), true, true, '1.2.3.4:27015', 'Sudamerica') returning id into srv_t;
  insert into game_servers (name, token_hash, active, pcw_enabled, connect_address, region)
    values ('t56-pcw-' || sfx, encode(sha256(convert_to(tok_p, 'UTF8')), 'hex'), true, true, '1.2.3.5:27015', 'Sudamerica') returning id into srv_p;
  perform csstv_mm_poll(tok_t, '2.9.0');
  perform csstv_mm_poll(tok_p, '2.9.0');

  -- 1. Aptitud.
  if not server_is_free(srv_t, 'official') or server_is_free(srv_t, 'pcw') or server_is_free(srv_t, 'mm') then
    raise exception 'FALLA 1: la aptitud del servidor de torneos no se respeta';
  end if;
  ok := ok + 1;

  -- 2. Quién puede iniciar y con qué servidor.
  perform pg_temp.como(u_out);
  perform pg_temp.esperar_error(format('select match_start(%L, %L, 10)', v_match, srv_t), '42501');
  perform pg_temp.como(u_org);
  perform pg_temp.esperar_error(format('select match_start(%L, %L, 10)', v_match, srv_p), 'V5602');
  perform pg_temp.esperar_error(format('select match_start(%L, %L, 21)', v_match, srv_t), 'La espera va de 1 a 20');
  ok := ok + 3;

  -- 3. Inicia: el servidor queda ocupado en el acto, aunque falte el veto.
  v_id := match_start(v_match, srv_t, 10);
  select * into b from match_bookings where id = v_id;
  if b.status <> 'veto' or b.veto_deadline is null or b.server_id <> srv_t then raise exception 'FALLA 3a: reserva %', to_jsonb(b); end if;
  if server_is_free(srv_t, 'official') then raise exception 'FALLA 3b: el servidor sigue libre después de iniciar'; end if;
  update game_servers set mm_enabled = true where id = srv_t;
  if mm_free_server(array['Sudamerica']) = srv_t then raise exception 'FALLA 3c: el matchmaking puede tomar un servidor reservado'; end if;
  update game_servers set mm_enabled = false where id = srv_t;
  perform pg_temp.esperar_error(format('select match_start(%L, %L, 10)', v_match, srv_t), 'ya está iniciada');
  ok := ok + 4;
  -- El !match manual de la serie reservada: no desde otro servidor, sí desde el reservado.
  if pg_temp.campo(csstv_match_lookup(tok_p, (select link_code from matches where id = v_match)), 'ok') <> '0' then
    raise exception 'FALLA 3e: otro servidor pudo vincular la serie reservada';
  end if;
  if pg_temp.campo(csstv_match_lookup(tok_t, (select link_code from matches where id = v_match)), 'ok') <> '1' then
    raise exception 'FALLA 3f: el servidor reservado no puede consultar la serie';
  end if;
  ok := ok + 2;

  -- Una segunda reserva abierta con el mismo servidor la rechaza la base aunque falle todo lo demás.
  begin
    insert into match_bookings (match_id, kind, status, server_id, wait_minutes) values (v_match, 'official', 'assigned', srv_t, 5);
    raise exception 'FALLA 3d: la base aceptó dos reservas abiertas con el mismo servidor';
  exception when unique_violation then null;
  end;
  ok := ok + 1;

  -- 4. Veto: el capitán banea (el reloj se reinicia); el turno siguiente vence y se elige al azar.
  perform pg_temp.como(ub[1]);
  if (match_booking(v_match)->>'can_veto')::boolean then raise exception 'FALLA 4z: no es el turno de B y figura que puede vetar'; end if;
  perform pg_temp.como(ua[1]);
  if not (match_booking(v_match)->>'can_veto')::boolean then raise exception 'FALLA 4y: el capitán de A no figura con el turno'; end if;
  perform veto_act(v_match, 'de_t56a');
  select * into b from match_bookings where id = v_id;
  if b.status <> 'veto' or b.veto_deadline < now() + interval '25 seconds' then raise exception 'FALLA 4a: el reloj del turno no se reinició'; end if;
  perform pg_temp.como(null);
  update match_bookings set veto_deadline = now() - interval '1 second' where id = v_id;
  perform mm_tick();
  select * into b from match_bookings where id = v_id;
  if b.status <> 'assigned' or b.password is null or b.wait_deadline is null then raise exception 'FALLA 4b: después del veto: %', to_jsonb(b); end if;
  if b.wait_deadline not between now() + interval '9 minutes' and now() + interval '11 minutes' then raise exception 'FALLA 4c: la espera no es de 10 minutos'; end if;
  if (select by_user from match_vetos where match_id = v_match and seq = 2) is not null then raise exception 'FALLA 4d: el veto automático tiene autor'; end if;
  if not exists (select 1 from notifications where user_id = ua[2] and type = 'match_server_ready') then raise exception 'FALLA 4e: no se avisó al plantel'; end if;
  ok := ok + 5;

  -- 5. Poll del servidor con la reserva.
  v_poll := csstv_mm_poll(tok_t, '2.9.0');
  if pg_temp.campo(v_poll, 'lobby') <> v_id::text or pg_temp.campo(v_poll, 'kind') <> 'official' or pg_temp.campo(v_poll, 'status') <> 'assigned'
     or pg_temp.campo(v_poll, 'map') <> (match_series_maps(v_match))[1] or pg_temp.campo(v_poll, 'min1') <> '5'
     or pg_temp.campo(v_poll, 'max_standins') <> '0' or pg_temp.campo(v_poll, 'auto_start') <> '0'
     or pg_temp.campo(v_poll, 'password') <> b.password then
    raise exception 'FALLA 5: poll %', v_poll;
  end if;
  if pg_temp.campo(v_poll, 't1') not like '%STEAM_0:%' then raise exception 'FALLA 5b: el poll no trae el plantel'; end if;
  ok := ok + 2;

  -- 6. Conexión: el plantel y el organizador la ven; alguien de afuera no.
  perform pg_temp.como(ua[3]);
  v_state := match_booking(v_match);
  if v_state->'booking'->'connection'->>'password' is distinct from b.password or (v_state->>'my_side')::int <> 1 then
    raise exception 'FALLA 6a: el plantel no ve la conexión: %', v_state;
  end if;
  perform pg_temp.como(u_out);
  if match_booking(v_match)->'booking'->'connection' <> 'null'::jsonb then raise exception 'FALLA 6b: alguien de afuera ve la conexión'; end if;
  insert into hud_streamers (user_id) values (u_out);
  if match_booking(v_match)->'booking'->'connection'->>'password' is null then raise exception 'FALLA 6c: el streamer no ve la conexión'; end if;
  perform pg_temp.como(u_org);
  if not (match_booking(v_match)->>'can_manage')::boolean then raise exception 'FALLA 6d: el organizador no puede gestionar'; end if;
  ok := ok + 4;

  -- 7. El servidor la toma; el organizador deja jugar con 4 a un equipo y extiende la espera.
  if not csstv_mm_report(tok_t, v_id, 'taken', null) then raise exception 'FALLA 7a: taken'; end if;
  perform match_booking_action(v_match, 'allow_four', 2);
  if pg_temp.campo(csstv_mm_poll(tok_t, '2.9.0'), 'min2') <> '4' then raise exception 'FALLA 7b: min2 no bajó a 4'; end if;
  update match_bookings set wait_started_at = now() - interval '15 minutes', wait_deadline = now() - interval '5 minutes' where id = v_id;
  perform pg_temp.como(null);
  perform booking_tick();
  if (select wait_expired_at from match_bookings where id = v_id) is null then raise exception 'FALLA 7c: no se marcó la espera vencida'; end if;
  if not exists (select 1 from notifications where user_id = u_org and type = 'booking_attention' and data->>'reason' = 'wait_expired') then
    raise exception 'FALLA 7d: no se avisó al organizador';
  end if;
  if (select status from match_bookings where id = v_id) <> 'assigned' then raise exception 'FALLA 7e: un torneo no se cancela solo'; end if;
  perform pg_temp.como(u_org);
  perform match_booking_action(v_match, 'extend', null, 10);
  select * into b from match_bookings where id = v_id;
  if b.wait_deadline > b.wait_started_at + interval '20 minutes' + interval '1 second' or b.wait_expired_at is not null then
    raise exception 'FALLA 7f: la extensión pasa los 20 minutos: %', to_jsonb(b);
  end if;
  ok := ok + 6;

  -- 8. En vivo: el servidor que no consulta no cuenta como caído; el mapa termina y la serie también.
  perform pg_temp.como(null);
  perform csstv_mm_report(tok_t, v_id, 'live', null);
  if (select status from matches where id = v_match) <> 'live' then raise exception 'FALLA 8a: la partida no pasó a en vivo'; end if;
  update mm_server_state set last_poll_at = now() - interval '5 minutes' where server_id = srv_t;
  perform booking_tick();
  if (select status from match_bookings where id = v_id) <> 'live' then raise exception 'FALLA 8b: un mapa en vivo se marcó como servidor caído'; end if;
  update matches set maps = '[{"map": "x", "r1": 13, "r2": 7}]', score1 = 1, score2 = 0, status = 'finished', winner = t_a where id = v_match;
  select * into b from match_bookings where id = v_id;
  if b.status <> 'finished' or b.end_reason <> 'series_end' then raise exception 'FALLA 8c: la serie terminó y la reserva no: %', to_jsonb(b); end if;
  update mm_server_state set last_poll_at = now() where server_id = srv_t;
  if not server_is_free(srv_t, 'official') then raise exception 'FALLA 8d: el servidor no quedó libre'; end if;
  ok := ok + 4;

  -- 9. BO3: entre mapas, el mapa siguiente del veto y una espera nueva; "mapover" vuelve a jugar el mismo.
  insert into events (name, organizer_id, status, map_pool)
    values ('Copa56 BO3 ' || sfx, u_org, 'in_progress', array['de_t56a', 'de_t56b', 'de_t56c', 'de_t56d', 'de_t56e']) returning id into v_event;
  insert into tournament_registration_players (event_id, team_id, player_id)
    select v_event, t_a, x from unnest(pa) x union all select v_event, t_b, x from unnest(pb) x;
  insert into matches (event_id, kind, status, best_of, team1, team2) values (v_event, 'official', 'upcoming', 3, t_a, t_b) returning id into v_bo3;
  perform pg_temp.como(u_org);
  v_id := match_start(v_bo3, srv_t, 5);
  perform pg_temp.como(null);
  for i in 1..4 loop
    update match_bookings set veto_deadline = now() - interval '1 second' where id = v_id;
    perform booking_tick();
  end loop;
  if cardinality(match_series_maps(v_bo3)) <> 3 then raise exception 'FALLA 9a: la BO3 no tiene 3 mapas: %', match_series_maps(v_bo3); end if;
  perform csstv_mm_report(tok_t, v_id, 'taken', null);
  perform csstv_mm_report(tok_t, v_id, 'live', null);
  update matches set maps = '[{"map": "x", "r1": 13, "r2": 7}]', score1 = 1, score2 = 0, status = 'live' where id = v_bo3;
  select * into b from match_bookings where id = v_id;
  if b.status <> 'between' or b.map_no <> 2 or b.wait_started_at < now() + interval '80 seconds' then raise exception 'FALLA 9b: entre mapas: %', to_jsonb(b); end if;
  v_poll := csstv_mm_poll(tok_t, '2.9.0');
  if pg_temp.campo(v_poll, 'map') <> (match_series_maps(v_bo3))[2] or pg_temp.campo(v_poll, 'map_no') <> '2' or pg_temp.campo(v_poll, 'score1') <> '1' then
    raise exception 'FALLA 9c: el poll no trae el mapa 2: %', v_poll;
  end if;
  perform csstv_mm_report(tok_t, v_id, 'live', null);
  perform csstv_mm_report(tok_t, v_id, 'mapover', null);
  select * into b from match_bookings where id = v_id;
  if b.status <> 'between' or b.map_no <> 2 then raise exception 'FALLA 9d: mapover: %', to_jsonb(b); end if;
  -- Servidor caído entre mapas: 3 min → lost; si vuelve, sigue; si no, a los 10 min se libera.
  update mm_server_state set last_poll_at = now() - interval '4 minutes' where server_id = srv_t;
  perform booking_tick();
  if (select status from match_bookings where id = v_id) <> 'lost' then raise exception 'FALLA 9e: no pasó a lost'; end if;
  perform csstv_mm_poll(tok_t, '2.9.0');
  if (select status from match_bookings where id = v_id) <> 'between' then raise exception 'FALLA 9f: al volver no retomó'; end if;
  update mm_server_state set last_poll_at = now() - interval '4 minutes' where server_id = srv_t;
  perform booking_tick();
  update match_bookings set lost_at = now() - interval '11 minutes' where id = v_id;
  perform booking_tick();
  select * into b from match_bookings where id = v_id;
  if b.status <> 'cancelled' or b.end_reason <> 'server_lost' then raise exception 'FALLA 9g: torneo con el servidor caído: %', to_jsonb(b); end if;
  if (select status from matches where id = v_bo3) <> 'live' then raise exception 'FALLA 9h: la serie perdió su estado'; end if;
  update mm_server_state set last_poll_at = now() where server_id = srv_t;
  perform pg_temp.como(u_org);
  v_id := match_start(v_bo3, srv_t, 5);
  if (select status || ':' || map_no from match_bookings where id = v_id) <> 'assigned:2' then raise exception 'FALLA 9i: reiniciar la serie no sigue en el mapa 2'; end if;
  perform match_booking_action(v_bo3, 'cancel');
  ok := ok + 9;

  -- 10. PCW: listos, veto con reloj, fila y servidor en el acto.
  perform pg_temp.como(null);
  insert into teams (name, tag, owner_id, captain_id, kind, parent_team_id) values ('PA' || sfx, 'PCW', ua[1], ua[1], 'pcw', t_a) returning id into s_a;
  insert into teams (name, tag, owner_id, captain_id, kind, parent_team_id) values ('PB' || sfx, 'PCW', ub[1], ub[1], 'pcw', t_b) returning id into s_b;
  insert into team_members (team_id, player_id) select s_a, x from unnest(pa[1:4]) x;
  insert into team_members (team_id, player_id) select s_b, x from unnest(pb[1:4]) x;
  insert into matches (kind, status, best_of, team1, team2) values ('pcw', 'upcoming', 1, s_a, s_b) returning id into v_pcw;
  insert into pcw_posts (team_id, by_user, best_of, status, match_id, map_pool) values (s_a, ua[1], 1, 'matched', v_pcw, array['de_t56a', 'de_t56b', 'de_t56c']);

  perform pg_temp.como(u_out);
  perform pg_temp.esperar_error(format('select pcw_ready(%L)', v_pcw), '42501');
  perform pg_temp.como(ua[2]);
  perform pcw_ready(v_pcw);
  if (select status from match_bookings where match_id = v_pcw and status <> 'cancelled') <> 'ready' then raise exception 'FALLA 10a: con un solo equipo no queda en ready'; end if;
  perform pg_temp.como(ub[3]);
  perform pcw_ready(v_pcw);
  select * into b from match_bookings where match_id = v_pcw and status not in ('cancelled', 'finished', 'abandoned');
  if b.status <> 'veto' or b.server_id is not null then raise exception 'FALLA 10b: con los dos listos: %', to_jsonb(b); end if;
  perform pg_temp.como(null);
  for i in 1..2 loop
    update match_bookings set veto_deadline = now() - interval '1 second' where id = b.id;
    perform booking_tick();
  end loop;
  select * into b from match_bookings where id = b.id;
  if b.status <> 'assigned' or b.server_id <> srv_p or b.queued_at is null then raise exception 'FALLA 10c: la PCW no tomó el servidor: %', to_jsonb(b); end if;
  if b.wait_deadline not between now() + interval '14 minutes' and now() + interval '16 minutes' then raise exception 'FALLA 10d: la espera de la PCW no es de 15 minutos'; end if;
  if not exists (select 1 from notifications where user_id = ub[4] and type = 'pcw_server_ready') then raise exception 'FALLA 10e: no se avisó a la PCW'; end if;
  v_poll := csstv_mm_poll(tok_p, '2.9.0');
  if pg_temp.campo(v_poll, 'kind') <> 'pcw' or pg_temp.campo(v_poll, 'min1') <> '3' or pg_temp.campo(v_poll, 'max_standins') <> '2' then
    raise exception 'FALLA 10f: poll de la PCW: %', v_poll;
  end if;
  ok := ok + 6;

  -- 11. Llegan los dos, nadie hace !ready y vence la espera: arranca solo.
  perform csstv_mm_report(tok_p, b.id, 'taken', null);
  perform csstv_mm_poll(tok_p, '2.9.0', '1,1,5,4');
  update match_bookings set wait_deadline = now() - interval '1 second' where id = b.id;
  perform booking_tick();
  if pg_temp.campo(csstv_mm_poll(tok_p, '2.9.0', '1,1,5,4'), 'auto_start') <> '1' then raise exception 'FALLA 11: no arrancó solo'; end if;
  ok := ok + 1;

  -- 12. Abandono durante el mapa: el equipo 2 con 3 jugadores 10 minutos seguidos (con 4 se puede seguir).
  perform csstv_mm_report(tok_p, b.id, 'live', null);
  perform csstv_mm_poll(tok_p, '2.9.0', '1,1,5,4');
  if (select short2_since from match_bookings where id = b.id) is not null then raise exception 'FALLA 12a: con 4 cuenta como abandono'; end if;
  perform csstv_mm_poll(tok_p, '2.9.0', '1,0,5,3');
  update match_bookings set short2_since = now() - interval '11 minutes' where id = b.id;
  perform booking_tick();
  select * into b from match_bookings where id = b.id;
  if b.status <> 'abandoned' or b.abandoned_side <> 2 then raise exception 'FALLA 12b: abandono en vivo: %', to_jsonb(b); end if;
  if (select status || ':' || cancel_reason from matches where id = v_pcw) <> 'cancelled:abandoned' or (select winner from matches where id = v_pcw) is not null then
    raise exception 'FALLA 12c: la PCW abandonada cuenta para alguien';
  end if;
  v_until := team_pcw_ban_until(t_b);
  if v_until is null or v_until not between now() + interval '71 hours' and now() + interval '73 hours' then raise exception 'FALLA 12d: sanción de 3 días al equipo: %', v_until; end if;
  if (select count(*) from pcw_bans where player_id = any(pb[1:4]) and until > now()) <> 4 then raise exception 'FALLA 12e: no se sancionó a los 4 jugadores'; end if;
  if team_pcw_ban_until(t_a) is not null then raise exception 'FALLA 12f: se sancionó al equipo que estaba'; end if;
  if not server_is_free(srv_p, 'pcw') then raise exception 'FALLA 12g: el servidor no quedó libre'; end if;
  if not exists (select 1 from notifications where user_id = ua[2] and type = 'pcw_abandoned' and data->>'banned' = 'false') then
    raise exception 'FALLA 12h: no se avisó al equipo que estaba';
  end if;
  ok := ok + 8;

  -- 13. La sanción impide publicar y aceptar; si se repite en 30 días son 7.
  perform pg_temp.como(ub[1]);
  perform pg_temp.esperar_error(format('insert into pcw_posts (team_id, by_user, best_of, status) values (%L, %L, 1, %L)', s_b, ub[1], 'open'), 'V5601');
  perform pg_temp.esperar_error(format('insert into matches (kind, status, best_of, team1, team2) values (%L, %L, 1, %L, %L)', 'pcw', 'upcoming', s_a, s_b), 'V5601');
  perform pg_temp.como(null);
  v_until := pcw_ban_side(v_pcw, 2);
  if v_until not between now() + interval '167 hours' and now() + interval '169 hours' then raise exception 'FALLA 13a: la segunda sanción no es de 7 días: %', v_until; end if;
  -- Lista del panel: solo moderadores; paginada, filtrada y ordenada. Levantar una sanción.
  perform pg_temp.como(u_org);
  perform pg_temp.esperar_error('select admin_pcw_bans()', '42501');
  update profiles set role = 'moderator' where id = u_org;
  v_state := admin_pcw_bans(true, 'beta' || sfx, 'until', 'desc', 1, 1);
  if (v_state->>'total')::int <> 2 or jsonb_array_length(v_state->'items') <> 1 or v_state->'items'->0->'team'->>'id' <> t_b::text then
    raise exception 'FALLA 13b: lista de sanciones: %', v_state;
  end if;
  perform pcw_ban_lift((v_state->'items'->0->>'id')::uuid);
  if (admin_pcw_bans(true, 'beta' || sfx)->>'total')::int <> 1 then raise exception 'FALLA 13c: levantar la sanción'; end if;
  update profiles set role = 'organizer' where id = u_org;
  perform pg_temp.como(null);
  ok := ok + 6;

  -- 14. No se presentan: vence la espera con un equipo incompleto → abandono de ese equipo.
  delete from pcw_bans where team_id = t_b or player_id = any(pb);
  insert into matches (kind, status, best_of, team1, team2) values ('pcw', 'upcoming', 1, s_a, s_b) returning id into v_pcw2;
  insert into pcw_posts (team_id, by_user, best_of, status, match_id, map_pool) values (s_a, ua[1], 1, 'matched', v_pcw2, array['de_t56a', 'de_t56b', 'de_t56c']);
  perform pg_temp.como(ua[1]); perform pcw_ready(v_pcw2);
  perform pg_temp.como(ub[1]); perform pcw_ready(v_pcw2);
  perform pg_temp.como(null);
  select * into b from match_bookings where match_id = v_pcw2 and status = 'veto';
  for i in 1..2 loop
    update match_bookings set veto_deadline = now() - interval '1 second' where id = b.id;
    perform booking_tick();
  end loop;
  perform csstv_mm_report(tok_p, b.id, 'taken', null);
  perform csstv_mm_poll(tok_p, '2.9.0', '0,1,1,5');
  update match_bookings set wait_deadline = now() - interval '1 second' where id = b.id;
  perform booking_tick();
  select * into b from match_bookings where id = b.id;
  if b.status <> 'abandoned' or b.abandoned_side <> 1 or b.end_reason <> 'no_show' then raise exception 'FALLA 14: no se presentaron: %', to_jsonb(b); end if;
  if team_pcw_ban_until(t_a) is null then raise exception 'FALLA 14b: no se sancionó al que no vino'; end if;
  ok := ok + 2;

  -- 15. Sin datos frescos del servidor no se sanciona; si el servidor nunca la tomó, vuelve a la fila primera.
  delete from pcw_bans where team_id in (t_a, t_b) or player_id = any(pa || pb);
  insert into matches (kind, status, best_of, team1, team2) values ('pcw', 'upcoming', 1, s_a, s_b) returning id into v_pcw2;
  perform pg_temp.como(ua[1]); perform pcw_ready(v_pcw2);
  perform pg_temp.como(ub[1]); perform pcw_ready(v_pcw2);
  perform pg_temp.como(null);
  select * into b from match_bookings where match_id = v_pcw2 and status = 'veto';
  while (select status from match_bookings where id = b.id) = 'veto' loop
    update match_bookings set veto_deadline = now() - interval '1 second' where id = b.id;
    perform booking_tick();
  end loop;
  if (select status from match_bookings where id = b.id) <> 'assigned' then raise exception 'FALLA 15a: sin asignar'; end if;
  update match_bookings set wait_deadline = now() - interval '1 second' where id = b.id;
  perform booking_tick();
  select * into b from match_bookings where id = b.id;
  if b.status not in ('queued', 'assigned') or b.queued_at <> 'epoch'::timestamptz or b.abandoned_side is not null then
    raise exception 'FALLA 15b: servidor que no la tomó: %', to_jsonb(b);
  end if;
  -- El servidor quedó no disponible 10 minutos: la PCW espera primera en la fila.
  if b.status <> 'queued' then raise exception 'FALLA 15c: tomó un servidor no disponible'; end if;
  -- Bajarse de la fila: sin sanción.
  perform pg_temp.como(ua[2]);
  perform pcw_ready(v_pcw2, false);
  if (select status from match_bookings where id = b.id) <> 'cancelled' or team_pcw_ban_until(t_a) is not null then raise exception 'FALLA 15d: bajarse de la fila'; end if;
  ok := ok + 4;

  -- 16. Marcas desde el panel: solo admins.
  perform pg_temp.como(u_org);
  perform pg_temp.esperar_error(format('select server_set_flags(%L, true, null, null)', srv_p), '42501');
  update profiles set role = 'admin' where id = u_out;
  perform pg_temp.como(u_out);
  perform server_set_flags(srv_p, true, true, false);
  if (select mm_enabled and official_enabled and not pcw_enabled from game_servers where id = srv_p) is distinct from true then raise exception 'FALLA 16: marcas'; end if;
  ok := ok + 2;

  perform pg_temp.como(null);
  raise notice 'OK: % comprobaciones del replanteo 56', ok;
end $$;

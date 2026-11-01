-- Pruebas del replanteo 42 (matchmaking). Siempre se deshacen al final: no dejan datos.
-- Se corren con la migración cargada, o dentro de la misma transacción.
set client_min_messages = warning;

create temp table t_u as
  select gen_random_uuid() as id, i, format('mmt%s', i) as nick, (1000 + i * 40) as elo, '765611980000' || lpad(i::text, 5, '0') as steam
    from generate_series(1, 11) i;
insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
  select id, nick || '@test.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from t_u;
insert into players (nick, user_id, steam_id) select nick, id, steam from t_u;

update mm_config set open = true, min_mixes = 0, min_account_days = 0, require_anticheat = false;
insert into game_servers (name, token_hash, mm_enabled, region, connect_address) values ('mmt-server', 'mmt-hash', true, 'Argentina', '1.2.3.4:27015');
insert into mm_server_state (server_id, last_poll_at) select id, now() from game_servers where name = 'mmt-server';

create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FALLÓ: %', p_msg; end if;
  raise warning 'ok: %', p_msg;
end $$;
create function pg_temp.fails(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FALLÓ (no dio error): %', p_msg;
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise warning 'ok: %', p_msg;
end $$;

-- Cola: con 9 no se arma, con 10 sí.
do $$
declare r record; v_lobby uuid; v_a numeric; v_b numeric;
begin
  for r in select * from t_u where i <= 9 loop perform pg_temp.as_user(r.id); perform mm_join('5v5', null); end loop;
  perform pg_temp.check(((mm_tick())->>'built')::int = 0, 'con 9 en cola no se arma sala');
  perform pg_temp.as_user((select id from t_u where i = 10));
  perform mm_join('5v5', null);
  perform pg_temp.check(((mm_tick())->>'built')::int = 1, 'con 10 se arma una sala');
  select id into v_lobby from mm_lobbies order by created_at desc limit 1;
  perform pg_temp.check((select count(*) from mm_lobby_players where lobby_id = v_lobby) = 10, 'la sala tiene 10');
  perform pg_temp.check((select count(*) from mm_queue) = 0, 'la cola quedó vacía');
  perform pg_temp.check((select count(*) filter (where team = 1) from mm_lobby_players where lobby_id = v_lobby) = 5, 'equipos de 5');
  select avg(elo) filter (where team = 1), avg(elo) filter (where team = 2) into v_a, v_b from mm_lobby_players where lobby_id = v_lobby;
  perform pg_temp.check(abs(v_a - v_b) <= 8, 'los equipos quedan parejos');

  -- Rechazo: sanción para el que rechaza; los demás vuelven con su lugar.
  perform pg_temp.as_user((select id from t_u where i = 1)); perform mm_accept();
  perform pg_temp.as_user((select id from t_u where i = 2)); perform mm_decline();
  perform pg_temp.check((select status from mm_lobbies where id = v_lobby) = 'cancelled', 'el rechazo cancela la sala');
  perform pg_temp.check(exists (select 1 from mm_penalties p join t_u u on u.id = p.user_id where u.i = 2 and p.until > now()), 'quien rechaza queda sancionado');
  perform pg_temp.check(exists (select 1 from mm_queue q join t_u u on u.id = q.user_id where u.i = 1), 'quien aceptó vuelve a la cola');
  perform pg_temp.check(not exists (select 1 from mm_queue q join t_u u on u.id = q.user_id where u.i = 3), 'quien no aceptó no vuelve');
  perform pg_temp.as_user((select id from t_u where i = 2));
  perform pg_temp.fails('select mm_join(''5v5'', null)', 'con sanción no entra a la cola');
end $$;

-- Dúo y bloqueo: el dúo va junto; el bloqueado, en contra.
do $$
declare r record; v_lobby uuid; v_inv uuid; v_u3 uuid := (select id from t_u where i = 3); v_u4 uuid := (select id from t_u where i = 4);
  v_match uuid; v_cap uuid; v_map text; n int := 0;
begin
  delete from mm_penalties; delete from mm_queue;
  perform pg_temp.as_user(v_u3);
  perform mm_party_invite((select id from players where user_id = v_u4));
  perform pg_temp.fails(format('select mm_party_respond(%L, true)', gen_random_uuid()), 'una invitación inexistente falla');
  perform pg_temp.as_user(v_u4);
  select id into v_inv from mm_party_invites where to_user = v_u4 and status = 'pending';
  perform mm_party_respond(v_inv, true);
  perform pg_temp.fails('select mm_join(''5v5'', null)', 'el que no es líder no entra a la cola');
  perform pg_temp.as_user(v_u3);
  perform mm_join('5v5', null);
  perform pg_temp.check((select count(*) from mm_queue) = 2, 'el líder entra por los dos');
  -- Bloqueo: sin VIP no se puede; con la regla apagada, sí.
  perform pg_temp.as_user((select id from t_u where i = 5));
  perform pg_temp.fails(format('select mm_block(%L)', (select id from players where user_id = (select id from t_u where i = 6))), 'el bloqueo es de VIP');
  update mm_config set blocks_vip_only = false;
  perform mm_block((select id from players where user_id = (select id from t_u where i = 6)));
  perform pg_temp.fails(format('select mm_block(%L)', (select id from players where user_id = (select id from t_u where i = 7))), 'un solo bloqueo');
  for r in select * from t_u where i in (1, 2, 5, 6, 7, 8, 9, 10) loop perform pg_temp.as_user(r.id); perform mm_join('5v5', null); end loop;
  perform mm_tick();
  select id into v_lobby from mm_lobbies where status = 'accepting';
  perform pg_temp.check(v_lobby is not null, 'se arma con dúo y bloqueo');
  perform pg_temp.check((select count(distinct team) from mm_lobby_players lp join t_u u on u.id = lp.user_id where lobby_id = v_lobby and u.i in (3, 4)) = 1, 'el dúo queda en el mismo equipo');
  perform pg_temp.check((select count(distinct team) from mm_lobby_players lp join t_u u on u.id = lp.user_id where lobby_id = v_lobby and u.i in (5, 6)) = 2, 'el bloqueado queda en contra');

  -- Aceptan todos: veto.
  update mm_lobby_players set accepted_at = now() where lobby_id = v_lobby;
  perform mm_tick();
  select match_id into v_match from mm_lobbies where id = v_lobby;
  perform pg_temp.check((select status from mm_lobbies where id = v_lobby) = 'veto' and (select kind from matches where id = v_match) = 'mm', 'aceptan todos: empieza el veto con su partida');
  perform pg_temp.check((select count(*) from mm_lobby_players where lobby_id = v_lobby and is_captain) = 2, 'dos capitanes');
  -- Quien no es capitán del turno no banea.
  select user_id into v_cap from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id where lp.lobby_id = v_lobby and is_captain and team <> l.veto_turn;
  perform pg_temp.as_user(v_cap);
  perform pg_temp.fails(format('select veto_act(%L, ''de_nuke'')', v_match), 'el capitán rival no banea fuera de su turno');
  -- Baneo por turnos hasta que queda uno.
  while (select status from mm_lobbies where id = v_lobby) = 'veto' loop
    select user_id into v_cap from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id where lp.lobby_id = v_lobby and is_captain and team = l.veto_turn;
    select m.map into v_map from mm_mode_maps m where m.mode = '5v5' and not exists (select 1 from match_vetos v where v.match_id = v_match and v.map = m.map) limit 1;
    perform pg_temp.as_user(v_cap);
    perform veto_act(v_match, v_map);
    n := n + 1;
  end loop;
  perform pg_temp.check(n = (select count(*) - 1 from mm_mode_maps where mode = '5v5'), 'se banea hasta que queda un mapa');
  perform pg_temp.check((select map from mm_lobbies where id = v_lobby) is not null and (select password from mm_lobbies where id = v_lobby) is not null, 'queda el mapa y la contraseña');
  perform mm_tick();
  perform pg_temp.check((select status from mm_lobbies where id = v_lobby) = 'assigned', 'se asigna el servidor');
end $$;

-- Plugin, estado y cierre por resultado.
do $$
declare v_lobby uuid := (select id from mm_lobbies where status = 'assigned'); v_tok text := 'mmt-token'; v_game uuid; v_code text; v_state jsonb; r record; v_other uuid;
begin
  update game_servers set token_hash = encode(extensions.digest(v_tok, 'sha256'), 'hex') where name = 'mmt-server';
  perform pg_temp.check(csstv_mm_poll(v_tok) like '%lobby=' || v_lobby || '%', 'el plugin recibe la sala');
  -- Los campos que lee csstv/mm.inc, en líneas clave=valor y con los planteles en STEAM_0.
  perform pg_temp.check(csstv_mm_poll(v_tok) ~ ('status=assigned' || E'\n' || 'map=\S+' || E'\n' || 'password=\S+' || E'\n' || 'code=\S+' || E'\n' || 'team1=.+' || E'\n' || 'team2=.+' || E'\n' || 't1=STEAM_0:[^\n]+' || E'\n' || 't2=STEAM_0:[^\n]+'), 'el poll trae lo que lee el plugin');
  perform pg_temp.check(csstv_mm_report(v_tok, v_lobby, 'taken'), 'el plugin toma la sala');
  perform pg_temp.check((select status from mm_lobbies where id = v_lobby) = 'connecting', 'pasa a conectando');
  for r in select csstv_steam2(p.steam_id) s from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = v_lobby loop
    perform csstv_mm_report(v_tok, v_lobby, 'connected', r.s);
  end loop;
  perform pg_temp.check(not exists (select 1 from mm_lobby_players where lobby_id = v_lobby and connected_at is null), 'el plugin marca a todos conectados por SteamID');
  perform csstv_mm_report(v_tok, v_lobby, 'live');
  perform pg_temp.check((select status from mm_lobbies where id = v_lobby) = 'live', 'la sala queda en vivo');
  perform csstv_mm_password(v_tok, 'uid-1', 'abcd', 'idle');
  perform csstv_mm_password(v_tok, 'uid-1', 'abcd', 'idle');
  perform pg_temp.check((select count(*) from mm_server_passwords where uid = 'uid-1') = 1, 'la contraseña no se duplica si la cola reenvía');

  select user_id into r from mm_lobby_players where lobby_id = v_lobby limit 1;
  perform pg_temp.as_user(r.user_id);
  v_state := mm_my_state();
  perform pg_temp.check(v_state->'lobby'->>'status' = 'live' and v_state->'lobby'->'server'->>'password' is not null, 'el estado trae la sala y la contraseña');
  perform pg_temp.check(jsonb_array_length(v_state->'lobby'->'players') = 10, 'el estado trae los 10');

  select link_code into v_code from matches where id = (select match_id from mm_lobbies where id = v_lobby);
  insert into matches (kind, status, score1, score2, map, played_at, side1_name, side2_name, winner_side) values ('mix', 'finished', 13, 7, 'de_nuke', now(), 'A', 'B', 1) returning id into v_game;
  perform pg_temp.check(csstv_link_game(v_game, v_code, 1), 'el resultado se vincula');
  perform pg_temp.check((select status from mm_lobbies where id = v_lobby) = 'finished' and (select winner_team from mm_lobbies where id = v_lobby) = 1, 'la sala termina con ganador');
  perform pg_temp.check(mm_free_server('{}') is not null, 'el servidor queda libre');

  select player_id into v_other from mm_lobby_players where lobby_id = v_lobby and user_id <> r.user_id limit 1;
  perform mm_commend(v_lobby, v_other);
  perform pg_temp.fails(format('select mm_commend(%L, %L)', v_lobby, v_other), 'un voto por partida');
end $$;

-- Permisos: las tablas no se leen directo.
set local role authenticated;
do $$
begin
  perform pg_temp.fails('select password from mm_lobbies', 'un usuario no lee las contraseñas');
end $$;
reset role;

do $$
declare v_m uuid; v_l uuid;
begin
  insert into matches (kind, status, best_of, side1_name, side2_name) values ('mm', 'upcoming', 1, 'a', 'b') returning id into v_m;
  insert into mm_lobbies (mode, status, map, match_id) values ('5v5', 'connecting', 'de_nuke', v_m) returning id into v_l;
  perform mm_cancel_lobby(v_l, 'No se conectaron todos a tiempo');
  perform pg_temp.check((select status from matches where id = v_m) = 'cancelled' and (select end_reason from mm_lobbies where id = v_l) = 'No se conectaron todos a tiempo', 'se cancela una sala con partida y motivo libre');
end $$;

do $$
declare v_l uuid; v_u uuid; v_s jsonb;
begin
  select lobby_id, user_id into v_l, v_u from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id where l.status = 'finished' order by l.created_at desc limit 1;
  v_s := mm_lobby_json(v_l, v_u);
  perform pg_temp.check(jsonb_typeof(v_s #> '{match,stats}') = 'array', 'la sala terminada trae las estadísticas');
  perform pg_temp.check(mm_elo_stake(v_l, v_u) ? 'win', 'se calcula el ELO en juego');
  perform pg_temp.check(mm_elo_stake(v_l, gen_random_uuid()) is null, 'quien no juega no tiene ELO en juego');
end $$;

select 'pruebas de 42 ok' as resultado;
rollback;

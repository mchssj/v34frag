-- Pruebas de supabase/replanteo/29_stats_partida.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119829' || lpad(n::text, 7, '0') $$;
create function pg_temp.m(n int) returns uuid language sql immutable as $$ select ('cccccccc-2900-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;

-- Un servidor, una ficha con dos SteamID (el principal y uno adicional) y otra con uno.
insert into public.game_servers(id, name, token_hash) values ('eeeeeeee-2900-4000-8000-000000000001', 'Server29', 'hash-prueba-29');
insert into public.players(id, nick, steam_id) values
  ('dddddddd-2900-4000-8000-000000000001', 'Doble29', pg_temp.s(1)),
  ('dddddddd-2900-4000-8000-000000000002', 'Uno29', pg_temp.s(3));
insert into public.player_extra_steam_ids(player_id, steam_id) values ('dddddddd-2900-4000-8000-000000000001', pg_temp.s(2));

-- Mix 1 (más viejo, sin jugadas) y mix 2 (con jugadas), del mismo servidor; mix 3 en otro servidor sin jugadas.
insert into public.matches(id, kind, status, map, server_id, played_at, score1, score2, winner_side) values
  (pg_temp.m(1), 'mix', 'finished', 'de_dust2', 'eeeeeeee-2900-4000-8000-000000000001', now() - interval '3 days', 13, 5, 1),
  (pg_temp.m(2), 'mix', 'finished', 'de_nuke', 'eeeeeeee-2900-4000-8000-000000000001', now() - interval '1 day', 13, 9, 2),
  (pg_temp.m(4), 'mix', 'finished', 'de_inferno', 'eeeeeeee-2900-4000-8000-000000000001', now(), 13, 11, 1),
  (pg_temp.m(3), 'mix', 'finished', 'de_train', null, now(), 13, 2, 1);
insert into public.match_player_stats(match_id, steam_id, player_id, team, nick, kills, deaths, rounds, k2, k3, k4, k5,
                                      first_kills, first_deaths, plants, defuses) values
  (pg_temp.m(1), pg_temp.s(1), 'dddddddd-2900-4000-8000-000000000001', 1, 'a', 20, 10, 18, 3, 1, 0, 0, 4, 2, 1, 0),
  (pg_temp.m(2), pg_temp.s(2), 'dddddddd-2900-4000-8000-000000000001', 2, 'a', 25, 15, 22, 4, 2, 1, 1, 5, 3, 0, 2);

select pg_temp.ok((select (k2, k3, k4, k5, first_kills, first_deaths, plants, defuses) = (7, 3, 1, 1, 9, 5, 1, 2)
                     from public.player_stats where player_id = 'dddddddd-2900-4000-8000-000000000001'),
  'player_stats suma k2–k5, entry, plantadas y defuses de todos los mixes de la ficha');

-- Jugadas del mix 2: dos clutches 1v2 ganados (uno con el SteamID adicional), un 1v3 perdido y un 3k sin clutch.
insert into public.match_clips(match_id, round, player_steamid, player_name, round_won, kill_ticks, clutch_vs, clutch_start_tick, end_tick) values
  (pg_temp.m(2), 3, pg_temp.s(2), 'a', true, array[1, 2], 2, 100, 200),
  (pg_temp.m(2), 7, pg_temp.s(1), 'a', true, array[1, 2], 2, 100, 200),
  (pg_temp.m(2), 9, pg_temp.s(2), 'a', false, array[1, 2, 3], 3, 100, 200),
  (pg_temp.m(2), 11, pg_temp.s(3), 'b', true, array[1, 2, 3], null, null, null);

select pg_temp.ok((select won from public.match_clutches where match_id = pg_temp.m(2) and steam_id = pg_temp.s(2) and vs = 2) = 1,
  'match_clutches: un clutch 1v2 ganado por ese SteamID');
select pg_temp.ok(not exists (select 1 from public.match_clutches where vs = 3 and match_id = pg_temp.m(2)),
  'un clutch perdido (round_won = false) no cuenta');
select pg_temp.ok(not exists (select 1 from public.match_clutches where steam_id = pg_temp.s(3) and match_id = pg_temp.m(2)),
  'una jugada sin clutch no cuenta');
select pg_temp.ok((select won from public.player_clutches where player_id = 'dddddddd-2900-4000-8000-000000000001' and vs = 2) = 2,
  'player_clutches junta los dos SteamID de la ficha');

select pg_temp.ok(not (select clutch_data from public.match_clutch_data where match_id = pg_temp.m(1)),
  'un mix anterior a que su servidor mandara jugadas: sin datos de clutch');
select pg_temp.ok((select clutch_data from public.match_clutch_data where match_id = pg_temp.m(2)), 'un mix con jugadas: con datos');
select pg_temp.ok((select clutch_data from public.match_clutch_data where match_id = pg_temp.m(4)),
  'un mix posterior sin jugadas, del mismo servidor: con datos (no hubo clutches)');
select pg_temp.ok(not (select clutch_data from public.match_clutch_data where match_id = pg_temp.m(3)),
  'un mix sin servidor y sin jugadas: sin datos');

-- Mix en vivo: la foto trae k2–k5 y entry.
insert into public.live_matches(uid, server_id, server_name, seq, map, score_a, score_b, max_rounds, payload, started_at, updated_at)
values ('live29', 'eeeeeeee-2900-4000-8000-000000000001', 'Server29', 1, 'de_dust2', 5, 3, 24,
        jsonb_build_object('players', jsonb_build_array(jsonb_build_object(
          'steamid', pg_temp.s(1), 'name', 'a', 'team', 'a', 'rounds', 8, 'kills', 9, 'deaths', 4, 'k2', 2, 'k3', 1,
          'first_kills', 3, 'first_deaths', 1, 'plants', 2, 'defuses', 0))), now(), now());
select pg_temp.ok((select (k2, k3, k4, first_kills, first_deaths, plants) = (2, 1, 0, 3, 1, 2)
                     from public.live_match_players where uid = 'live29'),
  'live_match_players lee k2–k5, entry y plantadas de la foto (0 si faltan)');

rollback;

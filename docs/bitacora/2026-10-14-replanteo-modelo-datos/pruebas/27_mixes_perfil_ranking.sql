-- Pruebas de supabase/replanteo/27_mixes_perfil_ranking.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119827' || lpad(n::text, 7, '0') $$;
create function pg_temp.f(n int) returns uuid language sql immutable as $$ select ('dddddddd-2700-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.m(n int) returns uuid language sql immutable as $$ select ('cccccccc-2700-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
create function pg_temp.elo(n int) returns integer language sql as $$ select elo from public.player_elo where steam_id = pg_temp.s(n) $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.s(int), pg_temp.f(int), pg_temp.m(int),
  pg_temp.error(text), pg_temp.elo(int) to authenticated, anon;

-- Sin mixes, ELO, ajustes, temporadas, torneos ni equipos de la base local (vuelven con el rollback).
delete from public.match_player_stats;
delete from public.match_crashes;
delete from public.live_matches;
delete from public.pcw_posts;
delete from public.matches;
delete from public.elo_adjustments;
delete from public.player_elo;
delete from public.player_medals where season_id is not null;
delete from public.seasons;
insert into public.elo_config(id) values (1) on conflict (id) do nothing;
update public.elo_config set start_elo = 1000, elo_floor = 100 where id = 1;

insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-2700-4000-8000-0000000000ad', 'admin27@test.local', '{"tag":"Admin27"}', 'x'),
  ('aaaaaaaa-2700-4000-8000-000000000001', 'u1-27@test.local', '{"tag":"Uno27"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-2700-4000-8000-0000000000ad';
-- Diez fichas con SteamID; la 1 es de la cuenta Uno27 (su nick pasa a ser el alias) y con perfil privado.
insert into public.players(id, nick, steam_id)
select pg_temp.f(n), 'Jug27_' || n, pg_temp.s(n) from generate_series(1, 10) n;
update public.players set user_id = 'aaaaaaaa-2700-4000-8000-000000000001', privacy = 'private' where id = pg_temp.f(1);
insert into public.profile_details(user_id, country) values ('aaaaaaaa-2700-4000-8000-000000000001', 'AR')
  on conflict (user_id) do update set country = excluded.country;

-- =====================================================================================================
-- Nick único
-- =====================================================================================================
select pg_temp.ok((select nick from public.players where id = pg_temp.f(1)) = 'Uno27', 'la ficha de una cuenta toma su alias');
select pg_temp.ok(pg_temp.error(format('insert into public.players(nick) values (%L)', ' jug27_2 ')) like 'Ese alias ya está en uso%',
  'otra ficha con el mismo nick (mayúsculas y espacios aparte) no se crea');
select pg_temp.ok(pg_temp.error(format('update public.players set nick = %L where id = %L', 'JUG27_3', pg_temp.f(2))) like 'Ese alias ya está en uso%',
  'ni se renombra a uno tomado');
select pg_temp.ok(pg_temp.error(format('update public.players set nick = %L where id = %L', 'Jug27_2', pg_temp.f(2))) is null,
  'conservar el propio nick sí');
set local role authenticated;
select pg_temp.como('aaaaaaaa-2700-4000-8000-000000000001');
select pg_temp.ok(public.alias_check('jug27_4') = 'taken', 'el nick de una ficha sin cuenta cuenta como alias tomado');
select pg_temp.ok(public.alias_check('UNO27') = 'ok', 'el propio alias no');
select pg_temp.ok(pg_temp.error(format('select public.set_my_tag(%L)', 'Jug27_5')) like 'Ese alias ya está en uso%',
  'un usuario no toma como alias el nick de otra ficha');
reset role;

-- =====================================================================================================
-- Puerto de SourceTV
-- =====================================================================================================
insert into public.game_servers(id, name, token_hash, active, connect_address, tv_port)
values ('eeeeeeee-2700-4000-8000-000000000001', 'Server27', 'x27', true, '1.2.3.4:27015', 27020);
select pg_temp.ok(pg_temp.error('update public.game_servers set tv_port = 70000 where name = ''Server27''') like '%game_servers_tv_port_check%',
  'tv_port fuera de rango no');
select pg_temp.ok((select tv_port from public.game_servers_public where name = 'Server27') = 27020, 'game_servers_public trae tv_port');
set local role authenticated;
select pg_temp.como('aaaaaaaa-2700-4000-8000-0000000000ad');
select pg_temp.ok((select count(*) from public.admin_create_server('Server27b', '5.6.7.8:27015', null, null, null, null, null, 27025)) = 1,
  'admin_create_server acepta p_tv_port');
select pg_temp.ok((select tv_port from public.admin_server_list where name = 'Server27b') = 27025, 'admin_server_list trae tv_port');
reset role;

-- =====================================================================================================
-- Mixes: dos terminados (fichas 1-5 contra 6-10), uno cancelado y uno en vivo
-- =====================================================================================================
insert into public.matches(id, kind, status, map, score1, score2, winner_side, starts_at, played_at, server_id, side1_name, side2_name) values
  (pg_temp.m(1), 'mix', 'finished', 'de_dust2', 13, 7, 1, now() - interval '3 days 1 hour', now() - interval '3 days', 'eeeeeeee-2700-4000-8000-000000000001', 'Mix de A', 'Mix de B'),
  (pg_temp.m(2), 'mix', 'finished', 'de_inferno', 5, 13, 2, now() - interval '2 days 1 hour', now() - interval '2 days', 'eeeeeeee-2700-4000-8000-000000000001', 'Mix de A', 'Mix de B'),
  (pg_temp.m(3), 'mix', 'cancelled', 'de_dust2', 2, 1, null, now() - interval '1 day 1 hour', now() - interval '1 day', 'eeeeeeee-2700-4000-8000-000000000001', 'Mix de A', 'Mix de B');
update public.matches set cancel_reason = 'admin' where id = pg_temp.m(3);
insert into public.match_player_stats(match_id, steam_id, player_id, team, nick, kills, deaths, assists, headshots, damage, rounds, rating)
select mm.id, pg_temp.s(n), pg_temp.f(n), case when n <= 5 then 1 else 2 end, 'g' || n, 10 + n, 10, 2, 5, 1500, mm.score1 + mm.score2,
       case when n = 3 then 1.9 else 1.0 + n / 100.0 end
  from generate_series(1, 10) n cross join (select id, score1, score2 from public.matches where id in (pg_temp.m(1), pg_temp.m(2))) mm;
select public.elo_recompute_all();

insert into public.live_matches(uid, server_id, server_name, seq, map, score_a, score_b, max_rounds, payload, started_at)
values ('live27', 'eeeeeeee-2700-4000-8000-000000000001', 'Server27', 5, 'de_nuke', 3, 2, 24,
        jsonb_build_object('players', jsonb_build_array(
          jsonb_build_object('steamid', pg_temp.s(4), 'name', 'vivo4', 'team', 'a', 'kills', 9, 'deaths', 1, 'rounds', 5),
          jsonb_build_object('steamid', pg_temp.s(7), 'name', 'vivo7', 'team', 'b', 'kills', 2, 'deaths', 5, 'rounds', 5))),
        now() - interval '20 minutes');

select pg_temp.ok((select count(*) from public.mix_list) = 4, 'mix_list: los tres mixes y el en vivo');
select pg_temp.ok((select status = 'live' and match_id is null and current_round = 6 and tv_host = '1.2.3.4' and tv_port = 27020
                     and mvp_player_id = pg_temp.f(4) and mvp_game_nick = 'vivo4' and live_rank = 1
                     from public.mix_list where live_uid = 'live27'), 'en vivo: ronda actual, TV, MVP parcial y primero');
select pg_temp.ok((select mvp_player_id = pg_temp.f(3) and mvp_alias = 'Jug27_3' and mvp_elo is not null and tv_port is null
                     and ended_at is not null and pg_temp.f(1) = any(player_ids) and server_name = 'Server27'
                     from public.mix_list where match_id = pg_temp.m(1)), 'terminado: MVP por rating, sin TV, con jugadores y servidor');
select pg_temp.ok((select search like '%g7%' from public.mix_list where match_id = pg_temp.m(2)), 'la búsqueda incluye el nombre del juego');
select pg_temp.ok((select cancel_reason = 'admin' from public.mix_list where match_id = pg_temp.m(3)), 'cancelado con su motivo');
select pg_temp.ok((select live_now = 1 and players_recent = 10 and top_map in ('de_dust2', 'de_inferno') and avg_rounds = 19 and window_days = 30
                     from public.mix_stats), 'mix_stats: en vivo, jugadores, mapa y promedio de rondas');
select set_config('request.jwt.claims', '', true);
set local role anon;
select pg_temp.ok((select count(*) from public.mix_list) = 4, 'mix_list es pública');
select pg_temp.ok((select live_now from public.mix_stats) = 1, 'mix_stats también');
reset role;

-- =====================================================================================================
-- Perfil: historial de ELO y partidas con torneo
-- =====================================================================================================
select pg_temp.ok((select count(*) from public.player_elo_history where player_id = pg_temp.f(1)) = 2, 'historial: un punto por mix con ELO');
select pg_temp.ok((select match_id from public.player_elo_history where player_id = pg_temp.f(1) and n = 1) = pg_temp.m(2), 'n = 1 es el más reciente');
select pg_temp.ok((select elo_after from public.player_elo_history where player_id = pg_temp.f(1) and n = 1) = pg_temp.elo(1), 'el último elo_after es el ELO actual');

-- =====================================================================================================
-- Ranking de jugadores
-- =====================================================================================================
select pg_temp.ok((select count(*) from public.player_ranking where id in (select pg_temp.f(n) from generate_series(1, 10) n)) = 10, 'ranking: las fichas con ELO');
select pg_temp.ok((select position from public.player_ranking where id = pg_temp.f(6)) = 1, 'el que más ELO tiene es el 1');
select pg_temp.ok((select position from public.player_ranking where id = pg_temp.f(6) and nick ilike '%jug27_6%') = 1,
  'la posición no cambia al filtrar');
select set_config('request.jwt.claims', '', true);
set local role anon;
select pg_temp.ok((select country from public.player_ranking where id = pg_temp.f(1)) is null, 'país oculto si el perfil es privado');
reset role;
select pg_temp.ok((select country from public.player_ranking where id = pg_temp.f(1)) = 'AR', 'el dueño de la base sí lo ve');
-- Comparador: 1 y 2 jugaron juntos los dos mixes (bando 1) y ganaron uno; 1 y 6 fueron rivales y 1 ganó uno.
select pg_temp.ok((select same_matches = 2 and same_wins = 1 and against_matches = 0 from public.players_together(pg_temp.f(1), pg_temp.f(2))),
  'juntos: mismo bando y cuántos ganaron');
select pg_temp.ok((select same_matches = 0 and against_matches = 2 and a_wins = 1 from public.players_together(pg_temp.f(1), pg_temp.f(6))),
  'rivales: cuántos ganó A');
select pg_temp.ok((select against_matches = 2 and a_wins = 1 from public.players_together(pg_temp.f(6), pg_temp.f(1))), 'y al revés');
select pg_temp.ok((select same_matches + against_matches from public.players_together(pg_temp.f(1), pg_temp.f(1))) = 0, 'consigo mismo, nada');

-- =====================================================================================================
-- Borrar un mix
-- =====================================================================================================
create temp table antes as select steam_id, elo from public.player_elo;
grant select on antes to authenticated;
set local role authenticated;
select pg_temp.como('aaaaaaaa-2700-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error(format('select public.admin_delete_mix(%L, %L)', pg_temp.m(1), 'keep')) like 'Solo un admin%', 'un usuario no borra mixes');
select pg_temp.como('aaaaaaaa-2700-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error(format('select public.admin_delete_mix(%L, %L)', pg_temp.m(1), 'x')) like 'Elige qué pasa con el ELO%', 'modo inválido');
select pg_temp.ok(pg_temp.error(format('select public.admin_delete_mix(%L, %L)', 'cccccccc-2700-4000-8000-000000000099', 'keep')) = 'No existe ese mix', 'mix que no existe');
reset role;

-- Revertir el último (m2): cada uno pierde lo que le dio, y un recálculo da lo mismo.
set local role authenticated;
select pg_temp.como('aaaaaaaa-2700-4000-8000-0000000000ad');
select pg_temp.ok((public.admin_delete_mix(pg_temp.m(2), 'revert'))->>'elo_mode' = 'revert', 'revertir: borra el mix');
reset role;
select pg_temp.ok(not exists (select 1 from public.matches where id = pg_temp.m(2)), 'el mix ya no está');
select pg_temp.ok(not exists (select 1 from public.match_player_stats where match_id = pg_temp.m(2)), 'ni sus stats');
create temp table revertido as select steam_id, elo, matches from public.player_elo;
select public.elo_recompute_all();
select pg_temp.ok(not exists (select 1 from public.player_elo e join revertido r using (steam_id) where e.elo <> r.elo or e.matches <> r.matches),
  'revertir el último mix da lo mismo que un recálculo');
select pg_temp.ok((select count(*) from public.elo_adjustments) = 0, 'revertir no guarda ajustes');

-- Mantener el que queda (m1): el ELO no cambia, ni después de un recálculo.
create temp table con_m1 as select steam_id, elo from public.player_elo;
set local role authenticated;
select pg_temp.como('aaaaaaaa-2700-4000-8000-0000000000ad');
select pg_temp.ok((public.admin_delete_mix(pg_temp.m(1), 'keep'))->>'players' = '10', 'mantener: borra el mix');
reset role;
select pg_temp.ok(not exists (select 1 from public.player_elo e join con_m1 c using (steam_id) where e.elo <> c.elo), 'mantener: el ELO no cambia');
select pg_temp.ok((select count(*) from public.elo_adjustments where source = 'mix_kept') = 10, 'un ajuste mix_kept por jugador');
select public.elo_recompute_all();
select pg_temp.ok(not exists (select 1 from public.player_elo e join con_m1 c using (steam_id) where e.elo <> c.elo),
  'mantener: un recálculo después da el mismo ELO');
select pg_temp.ok(not exists (select 1 from public.player_elo_adjustment_list where player_id = pg_temp.f(1)), 'el jugador no ve el ajuste del mix');
set local role authenticated;
select pg_temp.como('aaaaaaaa-2700-4000-8000-0000000000ad');
select pg_temp.ok((select count(*) from public.admin_elo_adjustment_list where source = 'mix_kept') = 10, 'el admin sí');
select pg_temp.ok((select count(*) from public.mix_deletions) = 2 and (select elo_mode from public.mix_deletions where match_id = pg_temp.m(1)) = 'keep',
  'mix_deletions registra los dos borrados');
-- El cancelado no movió el ELO: no hay nada que mantener ni revertir.
select pg_temp.ok((public.admin_delete_mix(pg_temp.m(3), 'keep'))->>'elo_mode' = 'none', 'un mix sin ELO se borra sin ajustes');
select pg_temp.como('aaaaaaaa-2700-4000-8000-000000000001');
select pg_temp.ok((select count(*) from public.mix_deletions) = 0, 'un usuario no ve mix_deletions');
reset role;

-- =====================================================================================================
-- Torneo: palmarés y partidas con torneo; ranking de equipos con tendencia y forma
-- =====================================================================================================
-- Como admin (events_guard pide un organizador o un admin).
select pg_temp.como('aaaaaaaa-2700-4000-8000-0000000000ad');
insert into public.teams(id, name, tag, kind) values
  ('bbbbbbbb-2700-4000-8000-000000000001', 'Alfa27', 'A27', 'official'),
  ('bbbbbbbb-2700-4000-8000-000000000002', 'Beta27', 'B27', 'official');
insert into public.events(id, name, template, config, status, players_min, players_max)
values ('ffffffff-2700-4000-8000-000000000001', 'Copa27', 'single', '{}'::jsonb, 'in_progress', 1, 10);
insert into public.tournament_registrations(event_id, team_id) values
  ('ffffffff-2700-4000-8000-000000000001', 'bbbbbbbb-2700-4000-8000-000000000001'),
  ('ffffffff-2700-4000-8000-000000000001', 'bbbbbbbb-2700-4000-8000-000000000002');
insert into public.tournament_registration_players(event_id, team_id, player_id) values
  ('ffffffff-2700-4000-8000-000000000001', 'bbbbbbbb-2700-4000-8000-000000000001', pg_temp.f(1)),
  ('ffffffff-2700-4000-8000-000000000001', 'bbbbbbbb-2700-4000-8000-000000000002', pg_temp.f(6));
-- Una partida de torneo de hace 40 días que ganó Beta y la final de ayer que ganó Alfa (con un mapa jugado con !match).
-- En torneo manda winner (el equipo): el trigger matches_winner_side calcula winner_side.
insert into public.matches(id, kind, status, event_id, stage, phase, round, team1, team2, score1, score2, winner, best_of, starts_at, played_at) values
  (pg_temp.m(10), 'official', 'finished', null, null, null, null, 'bbbbbbbb-2700-4000-8000-000000000001', 'bbbbbbbb-2700-4000-8000-000000000002', 0, 1, 'bbbbbbbb-2700-4000-8000-000000000002', 1,
   now() - interval '40 days', now() - interval '40 days'),
  (pg_temp.m(11), 'official', 'finished', 'ffffffff-2700-4000-8000-000000000001', 'ko', 1, 1, 'bbbbbbbb-2700-4000-8000-000000000001', 'bbbbbbbb-2700-4000-8000-000000000002', 1, 0, 'bbbbbbbb-2700-4000-8000-000000000001', 1,
   now() - interval '1 day', now() - interval '1 day');
insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at, parent_match_id, parent_side1) values
  (pg_temp.m(12), 'mix', 'finished', 'de_train', 13, 4, 1, now() - interval '1 day', pg_temp.m(11), 1);
insert into public.match_player_stats(match_id, steam_id, player_id, team, nick, kills, deaths, rounds, rating)
values (pg_temp.m(12), pg_temp.s(1), pg_temp.f(1), 1, 'g1', 20, 5, 17, 1.5);
-- El motor del torneo (v34.engine) es el único que fija el campeón.
select set_config('v34.engine', '1', true);
update public.events set champion = 'bbbbbbbb-2700-4000-8000-000000000001', status = 'finished' where id = 'ffffffff-2700-4000-8000-000000000001';
select set_config('v34.engine', '', true);

select pg_temp.ok((select result = 'champion' and team_name = 'Alfa27' and event_name = 'Copa27' and at is not null
                     from public.player_titles where player_id = pg_temp.f(1)), 'palmarés: campeón con su equipo y la fecha de la final');
select pg_temp.ok((select result = 'runner_up' and team_name = 'Beta27' from public.player_titles where player_id = pg_temp.f(6)), 'y el subcampeón');
select pg_temp.ok(not exists (select 1 from public.player_titles where player_id = pg_temp.f(2)), 'quien no estaba inscrito no tiene el título');
select pg_temp.ok((select event_name = 'Copa27' and stage = 'ko' and round = 1 and last_round = 1
                     from public.player_matches where match_id = pg_temp.m(12)), 'un mapa jugado con !match trae el torneo y la fase de su partida');

select pg_temp.ok((select official_played = 2 and official_won = 1 from public.team_standings where team_id = 'bbbbbbbb-2700-4000-8000-000000000001'),
  'team_standings sigue contando igual');
select pg_temp.ok((select official_played = 1 and official_won = 0 from public.team_standings_at(now() - interval '30 days')
                    where team_id = 'bbbbbbbb-2700-4000-8000-000000000001'), 'team_standings_at: hace 30 días solo la vieja');
-- La posición se cuenta entre todos los equipos oficiales (como la actual): puede haber otros en la base local.
select pg_temp.ok((select official_position_prev > 1 and official_position = 1 and form_official = array['L', 'W']
                     from public.team_ranking where team_id = 'bbbbbbbb-2700-4000-8000-000000000001'), 'Alfa: estaba más abajo y ahora es primero; forma L, W');
select pg_temp.ok((select official_position_prev = 1 and form_official = array['W', 'L']
                     from public.team_ranking where team_id = 'bbbbbbbb-2700-4000-8000-000000000002'), 'Beta: era primero; forma W, L');

-- Todo lo nuevo se lee sin sesión (las vistas no pueden tocar matches.link_code).
select set_config('request.jwt.claims', '', true);
set local role anon;
select pg_temp.ok((select count(*) from public.team_ranking where team_id = 'bbbbbbbb-2700-4000-8000-000000000001') = 1, 'anon: team_ranking');
select pg_temp.ok((select count(*) from public.team_standings_at(now())) >= 2, 'anon: team_standings_at');
select pg_temp.ok((select count(*) from public.player_titles where player_id = pg_temp.f(1)) = 1, 'anon: player_titles');
select pg_temp.ok((select count(*) from public.player_matches where match_id = pg_temp.m(12)) = 1, 'anon: player_matches');
select pg_temp.ok((select count(*) from public.player_elo_history) >= 0, 'anon: player_elo_history');
select pg_temp.ok((select count(*) from public.player_ranking) >= 0, 'anon: player_ranking');
select pg_temp.ok((select count(*) from public.players_together(pg_temp.f(1), pg_temp.f(6))) = 1, 'anon: players_together');
reset role;

rollback;

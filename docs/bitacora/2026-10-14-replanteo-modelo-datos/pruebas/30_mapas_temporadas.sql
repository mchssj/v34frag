-- Pruebas de supabase/replanteo/30_mapas_temporadas.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119830' || lpad(n::text, 7, '0') $$;
create function pg_temp.m(n int) returns uuid language sql immutable as $$ select ('cccccccc-3000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
-- Mensaje del error de una sentencia, o null si no falla.
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.s(int), pg_temp.m(int), pg_temp.error(text)
  to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3000-4000-8000-0000000000ad', 'admin30@test.local', '{"tag":"Admin30"}', 'x'),
  ('aaaaaaaa-3000-4000-8000-000000000001', 'u1-30@test.local', '{"tag":"Uno30"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-3000-4000-8000-0000000000ad';

-- =====================================================================================================
-- 1. Catálogo de mapas
-- =====================================================================================================
select pg_temp.ok((select bool_and(mixes = active and veto_default = active) from public.map_pool),
  'migración: los activos quedan en Mixes y en el pool por defecto, los inactivos sin marcas');
select pg_temp.ok(pg_temp.error($q$update public.map_pool set active = false, veto_default = true$q$) like '%map_pool_veto_default%',
  'un mapa retirado no puede estar en el pool por defecto');

-- Catálogo de la prueba: a, b, c y e en el pool por defecto (4), d disponible fuera del pool y r retirado.
delete from public.map_pool;
insert into public.map_pool(name, versions, position, active, mixes, veto_default) values
  ('de_a30', '{de_a30}', 1, true, true, true), ('de_b30', '{de_b30}', 2, true, true, true),
  ('de_c30', '{de_c30}', 3, true, false, true), ('de_e30', '{de_e30}', 4, true, false, true),
  ('de_d30', '{de_d30}', 5, true, false, false), ('de_r30', '{de_r30}', 6, false, false, false);

select pg_temp.ok(public.event_max_bo('{"bo": 1, "bo_final": 3}') = 3 and public.event_max_bo('{}') = 1
                  and public.event_max_bo('{"bo_group": 1, "playoffs": {"bo": 3, "bo_final": 5}}') = 5,
  'event_max_bo: el BO más alto, también dentro de playoffs');

-- =====================================================================================================
-- 2. Pool del torneo y de la PCW
-- =====================================================================================================
-- Torneo eliminación simple con BO3 en todas las fases (lo completa event_config).
select pg_temp.ok(pg_temp.error($q$insert into public.events(name, template, config, map_pool) values ('T30x', 'single', '{"bo": 3}', '{de_a30,de_d30}')$q$)
                  like 'El pool de mapas necesita al menos 3 mapas%', 'pool del torneo: al menos el BO más alto');
select pg_temp.ok(pg_temp.error($q$insert into public.events(name, template, config, map_pool) values ('T30x', 'single', '{"bo": 3}', '{de_a30,de_d30,de_a30}')$q$)
                  = 'El pool de mapas tiene mapas repetidos', 'pool del torneo: sin repetidos');
select pg_temp.ok(pg_temp.error($q$insert into public.events(name, template, config, map_pool) values ('T30x', 'single', '{"bo": 3}', '{de_a30,de_d30,de_r30}')$q$)
                  = 'El mapa de_r30 no está disponible', 'pool del torneo: un mapa retirado no entra');
select pg_temp.ok(pg_temp.error($q$insert into public.events(name, template, config, map_pool) values ('T30x', 'single', '{"bo": 3}', '{de_a30,de_d30,de_x30}')$q$)
                  = 'El mapa de_x30 no está disponible', 'pool del torneo: un mapa que no existe no entra');
insert into public.events(id, name, template, config, map_pool) values
  ('eeeeeeee-3000-4000-8000-000000000001', 'T30a', 'single', '{"bo": 3}', '{de_a30,de_d30,de_b30}'),
  ('eeeeeeee-3000-4000-8000-000000000002', 'T30b', 'single', '{"bo": 3}', '{de_a30,de_d30,de_b30}'),
  ('eeeeeeee-3000-4000-8000-000000000003', 'T30c', 'single', '{"bo": 3}', null);
select pg_temp.ok(pg_temp.error($q$update public.events set config = '{"bo": 5}' where id = 'eeeeeeee-3000-4000-8000-000000000002'$q$)
                  like 'El pool de mapas necesita al menos 5 mapas%', 'subir el BO por encima del pool: rechazado');

-- Un mapa retirado que ya estaba en el pool se conserva; uno nuevo retirado no entra.
update public.map_pool set active = false, mixes = false where name = 'de_d30';
update public.events set map_pool = '{de_a30,de_d30,de_b30,de_c30}' where id = 'eeeeeeee-3000-4000-8000-000000000002';
select pg_temp.ok((select map_pool = '{de_a30,de_d30,de_b30,de_c30}' from public.events where id = 'eeeeeeee-3000-4000-8000-000000000002'),
  'un mapa retirado que ya estaba en el pool del torneo se conserva');
select pg_temp.ok(pg_temp.error($q$update public.events set map_pool = '{de_a30,de_b30,de_c30,de_r30}' where id = 'eeeeeeee-3000-4000-8000-000000000002'$q$)
                  = 'El mapa de_r30 no está disponible', 'un mapa retirado nuevo no entra');
update public.map_pool set active = true where name = 'de_d30';

-- Dos capitanes con sus equipos oficiales.
insert into public.teams(id, name, tag, kind, captain_id) values
  ('bbbbbbbb-3000-4000-8000-000000000011', 'Equipo30A', 'A30', 'official', 'aaaaaaaa-3000-4000-8000-0000000000ad'),
  ('bbbbbbbb-3000-4000-8000-000000000012', 'Equipo30B', 'B30', 'official', 'aaaaaaaa-3000-4000-8000-000000000001');

-- PCW: el pool del anuncio, con al menos su BO.
select pg_temp.ok(pg_temp.error($q$insert into public.pcw_posts(team_id, by_user, best_of, map_pool, status)
                                  values ('bbbbbbbb-3000-4000-8000-000000000011', 'aaaaaaaa-3000-4000-8000-0000000000ad', 3, '{de_a30,de_d30}', 'open')$q$)
                  like 'El pool de mapas necesita al menos 3 mapas%', 'pool de la PCW: al menos su BO');
select pg_temp.ok(to_regprocedure('public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid, text[])') is not null
                  and to_regprocedure('public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid)') is null,
  'create_pcw_post recibe el pool');

-- =====================================================================================================
-- 3. Pool del veto de cada partida
-- =====================================================================================================
insert into public.matches(id, kind, status, best_of, team1, team2, event_id) values
  (pg_temp.m(11), 'official', 'upcoming', 3, 'bbbbbbbb-3000-4000-8000-000000000011', 'bbbbbbbb-3000-4000-8000-000000000012', 'eeeeeeee-3000-4000-8000-000000000001'),
  (pg_temp.m(12), 'official', 'upcoming', 3, 'bbbbbbbb-3000-4000-8000-000000000011', 'bbbbbbbb-3000-4000-8000-000000000012', 'eeeeeeee-3000-4000-8000-000000000003'),
  (pg_temp.m(13), 'pcw', 'upcoming', 1, 'bbbbbbbb-3000-4000-8000-000000000011', 'bbbbbbbb-3000-4000-8000-000000000012', null);
insert into public.pcw_posts(team_id, by_user, best_of, map_pool, status, match_id)
values ('bbbbbbbb-3000-4000-8000-000000000011', 'aaaaaaaa-3000-4000-8000-0000000000ad', 1, '{de_d30,de_c30}', 'matched', pg_temp.m(13));

select pg_temp.ok((select array_agg(name) from public.match_map_pool(pg_temp.m(11))) = '{de_a30,de_b30,de_d30}',
  'partida de un torneo con pool: el del torneo, en el orden del catálogo');
select pg_temp.ok((select array_agg(name) from public.match_map_pool(pg_temp.m(12))) = '{de_a30,de_b30,de_c30,de_e30}',
  'partida de un torneo sin pool: el pool por defecto');
select pg_temp.ok((select array_agg(name) from public.match_map_pool(pg_temp.m(13))) = '{de_c30,de_d30}',
  'PCW con pool: el del anuncio');

-- Veto BO3 con el pool del torneo (3 mapas): dos bans y queda el decisivo. Con el pool por defecto (4) habría un pick.
set local role authenticated;
select pg_temp.como('aaaaaaaa-3000-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error($q$select public.veto_act(pg_temp.m(11), 'de_c30')$q$) = 'Ese mapa no está en el pool',
  'veto: un mapa del pool por defecto que no está en el del torneo se rechaza');
select public.veto_act(pg_temp.m(11), 'de_d30');
select pg_temp.como('aaaaaaaa-3000-4000-8000-000000000001');
select public.veto_act(pg_temp.m(11), 'de_a30');
select pg_temp.ok(pg_temp.error($q$select public.veto_act(pg_temp.m(11), 'de_b30')$q$) = 'El veto ya terminó',
  'veto: la secuencia sale de la cantidad de mapas del pool del torneo');
reset role;
select pg_temp.ok(exists (select 1 from public.notifications where user_id = 'aaaaaaaa-3000-4000-8000-000000000001' and type = 'veto_turn'
                            and (data->>'match_id')::uuid = pg_temp.m(11) and data->>'action' = 'ban'),
  'aviso de turno con la secuencia del pool del torneo');
select pg_temp.ok((select count(*) from public.notifications where user_id = 'aaaaaaaa-3000-4000-8000-0000000000ad' and type = 'veto_turn'
                      and (data->>'match_id')::uuid = pg_temp.m(11)) = 1,
  'después de los dos bans no hay otro turno (solo el aviso del comienzo)');
select pg_temp.ok(pg_temp.error($q$update public.events set map_pool = '{de_a30,de_b30,de_c30}' where id = 'eeeeeeee-3000-4000-8000-000000000001'$q$)
                  = 'El pool de mapas del torneo no se cambia después del primer veto', 'el pool del torneo no cambia después del primer veto');

-- =====================================================================================================
-- 4. Rating, K/D y equipos en el ranking de una temporada
-- =====================================================================================================
-- Sin las temporadas ni los mixes de la base local (vuelven con el rollback).
delete from public.player_medals where season_id is not null;
delete from public.seasons;
delete from public.match_player_stats;
delete from public.match_crashes;
delete from public.matches where kind = 'mix';

-- Ficha 1 con dos SteamID (el 1 y el 3), ficha 2 en un equipo oficial y ficha 3 sin mixes.
insert into public.players(id, nick, steam_id) values
  ('dddddddd-3000-4000-8000-000000000001', 'Alfa30', pg_temp.s(1)),
  ('dddddddd-3000-4000-8000-000000000002', 'Beta30', pg_temp.s(2)),
  ('dddddddd-3000-4000-8000-000000000003', 'Gama30', pg_temp.s(4));
insert into public.player_extra_steam_ids(steam_id, player_id) values (pg_temp.s(3), 'dddddddd-3000-4000-8000-000000000001');
insert into public.player_elo(steam_id, elo, peak_elo, matches) values
  (pg_temp.s(1), 1500, 1500, 3), (pg_temp.s(2), 1200, 1200, 1), (pg_temp.s(4), 1000, 1000, 0)
on conflict (steam_id) do update set elo = excluded.elo, peak_elo = excluded.peak_elo, matches = excluded.matches;
insert into public.teams(id, name, tag, kind) values ('bbbbbbbb-3000-4000-8000-000000000001', 'Equipo30', 'E30', 'official');
insert into public.team_members(team_id, player_id, role) values ('bbbbbbbb-3000-4000-8000-000000000001', 'dddddddd-3000-4000-8000-000000000002', 'player');

insert into public.seasons(id, number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers)
select 'ffffffff-3000-4000-8000-000000000001', 1, 'T30', now() - interval '10 days', now() + interval '20 days', 20, 1, 10, 2001, tiers
  from public.season_config;

-- Mix 1 antes de la temporada (no cuenta), 2 y 3 dentro (el 3 con el SteamID adicional), 4 dentro sin ELO aplicado.
insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at) values
  (pg_temp.m(1), 'mix', 'finished', 'de_dust2', 13, 0, 1, now() - interval '20 days'),
  (pg_temp.m(2), 'mix', 'finished', 'de_dust2', 13, 7, 1, now() - interval '5 days'),
  (pg_temp.m(3), 'mix', 'finished', 'de_nuke', 13, 9, 1, now() - interval '3 days'),
  (pg_temp.m(4), 'mix', 'finished', 'de_nuke', 13, 2, 1, now() - interval '2 days');
insert into public.match_player_stats(match_id, steam_id, team, nick, kills, deaths, rounds, k1, k2, k3, k4, k5, elo_before, elo_after, elo_delta) values
  (pg_temp.m(1), pg_temp.s(1), 1, 'a', 90, 1, 13, 0, 0, 0, 0, 18, 1000, 1100, 100),
  (pg_temp.m(2), pg_temp.s(1), 1, 'a', 20, 10, 20, 10, 5, 0, 0, 0, 1100, 1120, 20),
  (pg_temp.m(2), pg_temp.s(2), 2, 'b', 10, 20, 20, 6, 2, 0, 0, 0, 1220, 1200, -20),
  (pg_temp.m(3), pg_temp.s(3), 1, 'a', 10, 10, 22, 6, 2, 0, 0, 0, 1120, 1140, 20),
  (pg_temp.m(4), pg_temp.s(1), 1, 'a', 50, 0, 15, 0, 0, 0, 0, 10, null, null, null);

select pg_temp.ok((select kd = 1.5 and rating = public.csstv_rating(30, 20, 42, 16, 7, 0, 0, 0)
                     from public.season_player_stats(now() - interval '10 days', now()) where player_id = 'dddddddd-3000-4000-8000-000000000001'),
  'season_player_stats: solo los mixes del período con ELO aplicado, con los dos SteamID de la ficha');

select pg_temp.ok((select kd = 1.5 and rating = public.csstv_rating(30, 20, 42, 16, 7, 0, 0, 0) and teams = '[]'::jsonb
                     from public.season_standings_list where player_id = 'dddddddd-3000-4000-8000-000000000001'),
  'temporada activa: rating y K/D de la temporada');
select pg_temp.ok((select kd = 0.5 and teams = '[{"id":"bbbbbbbb-3000-4000-8000-000000000001","name":"Equipo30","tag":"E30"}]'::jsonb
                     from public.season_standings_list where player_id = 'dddddddd-3000-4000-8000-000000000002'),
  'temporada activa: los equipos oficiales actuales');
select pg_temp.ok((select rating is null and kd is null
                     from public.season_standings_list where player_id = 'dddddddd-3000-4000-8000-000000000003'),
  'una ficha sin mixes en la temporada: rating y K/D en null');

set local role anon;
select pg_temp.ok((select count(*) from public.season_standings_list where season_id = 'ffffffff-3000-4000-8000-000000000001'
                      and player_id::text like 'dddddddd-3000-%') = 3,
  'un anónimo lee el ranking de la temporada');
reset role;

select public.season_close_run('ffffffff-3000-4000-8000-000000000001', null);
select pg_temp.ok((select kd = 1.5 and rating = public.csstv_rating(30, 20, 42, 16, 7, 0, 0, 0)
                     from public.season_standings where season_id = 'ffffffff-3000-4000-8000-000000000001'
                      and player_id = 'dddddddd-3000-4000-8000-000000000001'),
  'al cerrar, el rating y el K/D quedan en la foto');

-- Un mix que llega después con fecha dentro de la temporada cerrada no cambia la foto.
insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at)
values (pg_temp.m(5), 'mix', 'finished', 'de_dust2', 13, 0, 1, now() - interval '4 days');
insert into public.match_player_stats(match_id, steam_id, team, nick, kills, deaths, rounds, elo_before, elo_after, elo_delta)
values (pg_temp.m(5), pg_temp.s(1), 1, 'a', 0, 30, 13, 1100, 1080, -20);
select pg_temp.ok((select kd = 1.5 from public.season_standings_list
                    where season_id = 'ffffffff-3000-4000-8000-000000000001' and player_id = 'dddddddd-3000-4000-8000-000000000001'),
  'la foto del cierre no cambia con un mix posterior');
select pg_temp.ok((select rating is null and kd is null from public.season_standings_list s join public.seasons x on x.id = s.season_id
                    where x.status = 'active' and s.player_id = 'dddddddd-3000-4000-8000-000000000001'),
  'la temporada siguiente sale en vivo, todavía sin mixes');

rollback;

-- Pruebas del replanteo 92 (repetición 2D y mapa de calor). Siempre se deshacen al final: no dejan datos.
-- Se corren con la migración cargada.
set client_min_messages = warning;
begin;

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

-- Un jugador con un SteamID principal y uno adicional, dos partidas en de_dust2 y una en de_nuke.
insert into players (id, nick, steam_id) values ('00000000-0000-4000-8000-000000009201', 'heat92', '76561198000092001');
insert into player_extra_steam_ids (player_id, steam_id) values ('00000000-0000-4000-8000-000000009201', '76561198000092002');
insert into matches (id, external_id, kind, status, map, played_at) values
  ('00000000-0000-4000-8000-00000000920a', 'srv1-t92-a', 'mix', 'finished', 'de_dust2', now() - interval '2 days'),
  ('00000000-0000-4000-8000-00000000920b', 'srv1-t92-b', 'mix', 'finished', 'de_dust2', now() - interval '1 day'),
  ('00000000-0000-4000-8000-00000000920c', 'srv1-t92-c', 'mix', 'finished', 'de_nuke', now());

-- 1. Ingesta: kill_pos con SteamID viejo (STEAM_0) y de 64 bits, un suicidio y dos registros malos.
select csstv_after_ingest('00000000-0000-4000-8000-00000000920a', jsonb_build_object('match_uid', 'srv1-t92-a', 'kill_pos', jsonb_build_array(
  jsonb_build_array(1, 'STEAM_0:1:19913136', '76561198000000001', 'ak47', 1, 100, 200, 300, 400),
  jsonb_build_array(2, '', '76561198000092001', 'world', 0, 0, 0, -50, -60),
  jsonb_build_array(2, '76561198000092002', '76561198000000002', 'awp', 0, 10, 20, 30, 40),
  jsonb_build_array(3, 'x'),
  jsonb_build_array(3, '76561198000092001', '', 'awp', 0, 1, 2, 3, 4))), 'test');
select pg_temp.check((select count(*) from match_kills where match_id = '00000000-0000-4000-8000-00000000920a') = 3,
  'guarda 3 kills y descarta las 2 malas');
select pg_temp.check((select killer_steam from match_kills where weapon = 'ak47') = '76561198000092001',
  'pasa STEAM_0:1:19913136 a 64 bits');
select pg_temp.check((select kx is null and killer_steam is null and vx = -50 from match_kills where weapon = 'world'),
  'suicidio: sin el que mata ni su posición');

-- 2. Reenviar el resultado reemplaza las kills; uno sin kill_pos (plugin viejo) no toca nada.
select csstv_after_ingest('00000000-0000-4000-8000-00000000920a', jsonb_build_object('match_uid', 'srv1-t92-a', 'kill_pos', jsonb_build_array(
  jsonb_build_array(1, '76561198000092001', '76561198000000001', 'ak47', 1, 100, 200, 300, 400))), 'test');
select pg_temp.check((select count(*) from match_kills where match_id = '00000000-0000-4000-8000-00000000920a') = 1,
  'el reenvío reemplaza');
select csstv_after_ingest('00000000-0000-4000-8000-00000000920a', jsonb_build_object('match_uid', 'srv1-t92-a'), 'test');
select pg_temp.check((select count(*) from match_kills where match_id = '00000000-0000-4000-8000-00000000920a') = 1,
  'un resultado sin kill_pos no borra nada');

-- 3. Mapa de calor: principal + adicional, por mapa, kills o muertes.
select csstv_kills_save('00000000-0000-4000-8000-00000000920b', jsonb_build_object('kill_pos', jsonb_build_array(
  jsonb_build_array(1, '76561198000092002', '76561198000000003', 'm4a1', 0, 500, 600, 700, 800),
  jsonb_build_array(2, '76561198000000003', '76561198000092001', 'deagle', 1, 1, 1, 900, 950))));
select csstv_kills_save('00000000-0000-4000-8000-00000000920c', jsonb_build_object('kill_pos', jsonb_build_array(
  jsonb_build_array(1, '76561198000092001', '76561198000000003', 'm4a1', 0, 5, 6, 7, 8))));
select pg_temp.check((select count(*) from player_heatmap('00000000-0000-4000-8000-000000009201', 'de_dust2', 'kills')) = 2,
  'kills en dust2 con los dos SteamID');
select pg_temp.check((select array_agg(x order by x) from player_heatmap('00000000-0000-4000-8000-000000009201', 'de_dust2', 'kills')) = '{100,500}',
  'desde dónde mató');
select pg_temp.check((select array_agg(x) from player_heatmap('00000000-0000-4000-8000-000000009201', 'de_dust2', 'deaths')) = '{900}',
  'dónde murió');
select pg_temp.check((select count(*) from player_heatmap('00000000-0000-4000-8000-000000009201', 'de_dust2', 'kills', 1)) = 1,
  'solo la última partida');
select pg_temp.check((select count(*) from player_heatmap('00000000-0000-4000-8000-000000009201', 'de_nuke', 'kills')) = 1,
  'otro mapa aparte');
select pg_temp.fails($$select * from player_heatmap('00000000-0000-4000-8000-000000009201', 'de_dust2', 'otra')$$, 'tipo inválido');

-- 4. track_mark: con el token del Worker y una ruta válida.
insert into demo_workers (name, token_hash) values ('t92', encode(sha256(convert_to('t92-token', 'UTF8')), 'hex'));
select pg_temp.check(track_mark('t92-token', 'srv1-t92-a', 'tracks/2026/11/srv1-t92-a.trk') = 'tracks/2026/11/srv1-t92-a.trk',
  'track_mark guarda la ruta');
select pg_temp.fails($$select track_mark('otro', 'srv1-t92-a', 'tracks/2026/11/srv1-t92-a.trk')$$, 'token inválido');
select pg_temp.fails($$select track_mark('t92-token', 'srv1-t92-a', 'demos/2026/11/srv1-t92-a.dem')$$, 'ruta que no es de tracks/');
select pg_temp.fails($$select track_mark('t92-token', 'no-existe-92', 'tracks/2026/11/no-existe-92.trk')$$, 'partida que no existe');

-- 5. Permisos: anon lee las kills y el mapa de calor, pero no guarda.
set local role anon;
select pg_temp.check((select count(*) from match_kills where match_id = '00000000-0000-4000-8000-00000000920b') = 2, 'anon lee match_kills');
select pg_temp.check((select count(*) from player_heatmap('00000000-0000-4000-8000-000000009201', 'de_nuke', 'kills')) = 1, 'anon ve el mapa de calor');
select pg_temp.check((select track_key from matches where id = '00000000-0000-4000-8000-00000000920a') = 'tracks/2026/11/srv1-t92-a.trk', 'anon lee matches.track_key');
select pg_temp.fails($$select csstv_kills_save('00000000-0000-4000-8000-00000000920b', '{}')$$, 'anon no guarda kills');
select pg_temp.fails($$insert into match_kills (match_id, round, victim_steam, vx, vy) values ('00000000-0000-4000-8000-00000000920b', 1, 'x', 0, 0)$$, 'anon no inserta');
reset role;

rollback;

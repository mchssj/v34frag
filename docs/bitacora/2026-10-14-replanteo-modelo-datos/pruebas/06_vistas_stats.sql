-- Pruebas de supabase/replanteo/06_vistas_stats.sql (correr con la migración aplicada). Todo con rollback.
begin;

insert into public.game_servers (id, name, token_hash) values ('cccccccc-0000-4000-8000-000000000061', 'srv 06', 'hash-prueba-06');
insert into public.players (id, nick, steam_id) values
  ('dddddddd-0000-4000-8000-000000000061', 'Uno06', '76561198000000611'),
  ('dddddddd-0000-4000-8000-000000000062', 'Dos06', '76561198000000622'),
  ('dddddddd-0000-4000-8000-000000000063', 'Tres06', null);
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-0000000006ad', 'admin06@test.local');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-0000000006ad';

do $$
declare s record;
begin
  assert to_regclass('public.player_stats') is not null and to_regclass('public.player_map_stats') is not null, 'faltan las vistas';
  assert (select relkind from pg_class where oid = 'public.player_map_stats'::regclass) = 'v', 'player_map_stats no es una vista';
  assert not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players'
                     and column_name in ('rating', 'kd', 'hs', 'adr', 'maps', 'wins', 'losses', 'stats_auto')),
    'quedan columnas de stats manuales en players';
  assert not exists (select 1 from pg_proc where proname = 'recompute_player_stats'), 'recompute_player_stats sigue existiendo';

  -- Dos mixes en dust2 e inferno: Uno06 gana los dos, Dos06 pierde los dos.
  perform public.csstv_ingest('cccccccc-0000-4000-8000-000000000061', jsonb_build_object(
    'schema', '1', 'match_uid', 'prueba06a', 'status', 'finished', 'map', 'de_dust2', 'score', jsonb_build_object('a', 13, 'b', 7),
    'players', jsonb_build_array(
      jsonb_build_object('team', 'a', 'name', 'Uno06', 'steamid', '76561198000000611', 'rounds', 20, 'kills', 20, 'deaths', 10, 'headshots', 10, 'damage', 2000),
      jsonb_build_object('team', 'b', 'name', 'Dos06', 'steamid', '76561198000000622', 'rounds', 20, 'kills', 10, 'deaths', 20, 'headshots', 2, 'damage', 1000),
      jsonb_build_object('team', 'b', 'name', 'Tres06', 'steamid', '76561198000000633', 'rounds', 20, 'kills', 5, 'deaths', 5))));
  perform public.csstv_ingest('cccccccc-0000-4000-8000-000000000061', jsonb_build_object(
    'schema', '1', 'match_uid', 'prueba06b', 'status', 'finished', 'map', 'de_inferno', 'score', jsonb_build_object('a', 16, 'b', 14),
    'players', jsonb_build_array(
      jsonb_build_object('team', 'a', 'name', 'Uno06', 'steamid', '76561198000000611', 'rounds', 30, 'kills', 30, 'deaths', 20, 'headshots', 15, 'damage', 3000),
      jsonb_build_object('team', 'b', 'name', 'Dos06', 'steamid', '76561198000000622', 'rounds', 30, 'kills', 20, 'deaths', 30, 'headshots', 4, 'damage', 2000))));

  -- Las vistas reflejan los mixes sin recalcular nada.
  select * into s from public.player_stats where player_id = 'dddddddd-0000-4000-8000-000000000061';
  assert s.maps = 2 and s.wins = 2 and s.losses = 0, format('Uno06: %s mapas %s-%s', s.maps, s.wins, s.losses);
  assert s.kills = 50 and s.deaths = 30 and s.kd = 1.67, format('Uno06 K/D: %s', s.kd);
  assert s.hs = 50.0 and s.adr = 100.0, format('Uno06 HS %s ADR %s', s.hs, s.adr);
  assert s.rating is not null, 'Uno06 sin rating';
  select * into s from public.player_stats where player_id = 'dddddddd-0000-4000-8000-000000000062';
  assert s.maps = 2 and s.wins = 0 and s.losses = 2, format('Dos06: %s mapas %s-%s', s.maps, s.wins, s.losses);
  assert (select count(*) from public.player_map_stats where player_id = 'dddddddd-0000-4000-8000-000000000061') = 2, 'Uno06 debería tener 2 mapas';
  assert (select wins from public.player_map_stats where player_id = 'dddddddd-0000-4000-8000-000000000061' and map_name = 'dust2') = 1,
    'Uno06 en dust2';
  -- Tres06 todavía no tiene SteamID vinculado: no aparece.
  assert not exists (select 1 from public.player_stats where player_id = 'dddddddd-0000-4000-8000-000000000063'), 'Tres06 no tiene SteamID';
end $$;

-- Un anónimo puede leer las vistas.
set local role anon;
do $$ begin
  assert (select count(*) from public.player_stats where player_id = 'dddddddd-0000-4000-8000-000000000061') = 1, 'anon no lee player_stats';
  assert (select count(*) from public.player_map_stats where player_id = 'dddddddd-0000-4000-8000-000000000061') = 2, 'anon no lee player_map_stats';
end $$;
reset role;

-- Vincular el SteamID de Tres06 (como admin): sus stats aparecen sin recalcular.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000006ad","role":"authenticated"}', true);
select public.link_steam_id('76561198000000633', 'dddddddd-0000-4000-8000-000000000063');
reset role;
do $$ begin
  assert (select maps from public.player_stats where player_id = 'dddddddd-0000-4000-8000-000000000063') = 1, 'Tres06 no tiene su mix al vincularlo';
  assert (select losses from public.player_stats where player_id = 'dddddddd-0000-4000-8000-000000000063') = 1, 'Tres06 perdió su mix';
  raise notice 'replanteo 06: ok';
end $$;

rollback;

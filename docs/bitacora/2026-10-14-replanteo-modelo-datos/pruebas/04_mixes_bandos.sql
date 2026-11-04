-- Pruebas de supabase/replanteo/04_mixes_bandos.sql (correr con la migración aplicada). Todo con rollback.
begin;

-- Datos de prueba: un servidor, dos jugadores con SteamID, un admin.
insert into public.game_servers (id, name, token_hash) values ('cccccccc-0000-4000-8000-000000000001', 'srv prueba', 'hash-prueba-04');
insert into public.players (id, nick, steam_id) values
  ('dddddddd-0000-4000-8000-000000000001', 'Rojo1', '76561198000000101'),
  ('dddddddd-0000-4000-8000-000000000002', 'Azul1', '76561198000000202'),
  ('dddddddd-0000-4000-8000-000000000003', 'SinMixes', null);
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-0000000000ad', 'admin04@test.local');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-0000000000ad';

do $$
declare equipos_antes int := (select count(*) from public.teams);
        v_id uuid;
        m public.matches;
begin
  -- Reglas: un mix no puede tener equipos y no existen equipos 'mix'.
  assert not exists (select 1 from public.teams where kind = 'mix'), 'quedan equipos mix';
  assert not exists (select 1 from public.matches where kind = 'mix' and (team1 is not null or side1_name is null)),
    'hay mixes con equipos o sin bandos';
  begin
    insert into public.teams (name, kind) values ('x', 'mix');
    assert false, 'se pudo crear un equipo mix';
  exception when check_violation then null;
  end;

  -- Ingesta de un mix: bandos con jugadores vinculados e invitados, ganador por bando, sin crear equipos.
  v_id := public.csstv_ingest('cccccccc-0000-4000-8000-000000000001', jsonb_build_object(
    'schema', '1', 'match_uid', 'prueba04mix', 'status', 'finished', 'map', 'de_dust2',
    'score', jsonb_build_object('a', 13, 'b', 7), 'team_names', jsonb_build_object('a', 'Rojo', 'b', ''),
    'players', jsonb_build_array(
      jsonb_build_object('team', 'a', 'name', 'Rojo1', 'steamid', '76561198000000101', 'rounds', 20, 'kills', 20),
      jsonb_build_object('team', 'a', 'name', 'Invitado', 'steamid', '76561198000000303', 'rounds', 20, 'kills', 5),
      jsonb_build_object('team', 'b', 'name', 'Azul1', 'steamid', '76561198000000202', 'rounds', 20, 'kills', 9))));
  select * into m from public.matches where id = v_id;
  assert m.kind = 'mix' and m.team1 is null and m.team2 is null and m.winner is null, 'el mix nuevo tiene equipos';
  assert m.side1_name = 'Equipo Rojo', format('nombre del bando 1: %s', m.side1_name);
  assert m.side2_name = 'Mix de Azul1', format('nombre del bando 2: %s', m.side2_name);
  assert m.lineup1 = array['dddddddd-0000-4000-8000-000000000001'::uuid] and m.side1_guests = array['Invitado'],
    'plantel del bando 1 mal armado';
  assert m.lineup2 = array['dddddddd-0000-4000-8000-000000000002'::uuid] and m.side2_guests = '{}', 'plantel del bando 2 mal armado';
  assert m.winner_side = 1, 'winner_side del mix';
  assert (select count(*) from public.teams) = equipos_antes, 'la ingesta creó equipos';
  assert (select count(*) from public.match_player_stats where match_id = v_id) = 3, 'faltan filas de stats';

  -- Victorias y derrotas salen de winner_side.
  assert (select wins from public.players where id = 'dddddddd-0000-4000-8000-000000000001') = 1, 'Rojo1 tendría que tener 1 victoria';
  assert (select losses from public.players where id = 'dddddddd-0000-4000-8000-000000000002') = 1, 'Azul1 tendría que tener 1 derrota';

  -- Partidas con equipos: winner_side lo mantiene el trigger.
  insert into public.teams (id, name, kind) values
    ('eeeeeeee-0000-4000-8000-000000000001', 'Equipo A', 'official'), ('eeeeeeee-0000-4000-8000-000000000002', 'Equipo B', 'official');
  insert into public.matches (id, team1, team2, kind, status, winner) values
    ('ffffffff-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000002',
     'official', 'finished', 'eeeeeeee-0000-4000-8000-000000000002');
  assert (select winner_side from public.matches where id = 'ffffffff-0000-4000-8000-000000000001') = 2, 'trigger: winner = team2';
  update public.matches set winner = null where id = 'ffffffff-0000-4000-8000-000000000001';
  assert (select winner_side from public.matches where id = 'ffffffff-0000-4000-8000-000000000001') is null, 'trigger: sin ganador';
  begin
    insert into public.matches (team1, team2, kind) values ('eeeeeeee-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000002', 'mix');
    assert false, 'se pudo crear un mix con equipos';
  exception when check_violation then null;
  end;
end $$;

-- Vincular y desvincular un SteamID (como admin): el invitado pasa al plantel del bando y vuelve.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000ad","role":"authenticated"}', true);
select public.link_steam_id('76561198000000303', 'dddddddd-0000-4000-8000-000000000003');
reset role;
do $$
declare m public.matches;
begin
  select * into m from public.matches where external_id = 'prueba04mix';
  assert 'dddddddd-0000-4000-8000-000000000003'::uuid = any(m.lineup1) and m.side1_guests = '{}',
    'al vincular, el invitado no pasó al plantel';
  assert m.lineup2 = array['dddddddd-0000-4000-8000-000000000002'::uuid], 'al vincular se tocó el otro bando';
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000ad","role":"authenticated"}', true);
select public.link_steam_id('76561198000000303', null);
reset role;
do $$
declare m public.matches;
begin
  select * into m from public.matches where external_id = 'prueba04mix';
  assert not ('dddddddd-0000-4000-8000-000000000003'::uuid = any(m.lineup1)) and m.side1_guests = array['Invitado'],
    'al desvincular, el jugador no volvió a invitado';
  raise notice 'replanteo 04: ok';
end $$;

rollback;

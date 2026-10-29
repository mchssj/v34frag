-- Pruebas de widget_player. Se corren sobre stub_supabase.sql + todas las migraciones
-- (receta en la GUIA_IMPLEMENTACION.md de esta bitácora).
\set ON_ERROR_STOP 1
set client_min_messages = notice;
insert into game_servers(name, token_hash) values ('test', encode(sha256('tok'::bytea), 'hex'));

-- Mix 5v5: equipo a = SteamID base+1..5, b = base+6..10. ts = started_at (ended_at = ts + 1800).
create function t_payload(uid text, a int, b int, ts int, base bigint default 76561198000000000) returns jsonb language sql as $$
  select jsonb_build_object('schema','1','match_uid',uid,'map','de_dust2','started_at',ts,'ended_at',ts+1800,
    'score', jsonb_build_object('a',a,'b',b),
    'players', (select jsonb_agg(jsonb_build_object('team', case when i<=5 then 'a' else 'b' end, 'name','p'||i,
       'steamid', (base+i)::text, 'rounds', a+b, 'kills', 10+i, 'deaths', 15-i, 'assists',3,'headshots',5,'damage',2000,
       'k1',6,'k2',2,'k3',0,'k4',0,'k5',0)) from generate_series(1,10) i))
$$;

-- A juega en el equipo a (team 1) y tiene ficha antes de los mixes; B (equipo b) no tiene ficha.
insert into players(id, nick, steam_id, kd, rating) values
  ('00000000-0000-0000-0000-00000000000a', 'Alfa', '76561198000000001', null, null),
  ('00000000-0000-0000-0000-00000000000c', 'SinMixes', null, null, null);
insert into teams(name, tag, members, kind) values ('Los Alfa', 'ALF', '{00000000-0000-0000-0000-00000000000a}', 'official');

select ingest_server_match('tok', t_payload('widget-1', 16, 10, 1000));   -- A gana
select ingest_server_match('tok', t_payload('widget-2', 10, 16, 5000));   -- A pierde
select ingest_server_match('tok', t_payload('widget-3', 15, 15, 9000));   -- empate

-- W1: todo el historial
do $$ declare j jsonb := widget_player('00000000-0000-0000-0000-00000000000a', to_timestamp(0)); begin
  if j->>'nick' <> 'Alfa' or j->>'team_tag' <> 'ALF' then raise exception 'W1 nick/tag: %', j; end if;
  if (j->'hoy'->>'v')::int <> 1 or (j->'hoy'->>'d')::int <> 1 or (j->'hoy'->>'e')::int <> 1 then raise exception 'W1 V/D/E: %', j->'hoy'; end if;
  if (j->'hoy'->>'kills')::int <> 33 or (j->'hoy'->>'deaths')::int <> 42 then raise exception 'W1 K/D: %', j->'hoy'; end if;
  if (j->>'elo')::int <> (select elo from player_elo where steam_id = '76561198000000001') then raise exception 'W1 elo: %', j; end if;
  if (j->'hoy'->>'elo')::int <> (select elo - 1000 from player_elo where steam_id = '76561198000000001') then raise exception 'W1 ±ELO: %', j; end if;
  if (select string_agg(x->>'r', '' order by o) from jsonb_array_elements(j->'ultimos') with ordinality t(x, o)) <> 'EDV' then
    raise exception 'W1 últimos: %', j->'ultimos'; end if;
  if (j->>'matches')::int <> 3 or (j->>'kd')::numeric is distinct from (select kd from players where nick = 'Alfa') then raise exception 'W1 totales: %', j; end if;
  raise notice 'W1 OK: %', j;
end $$;

-- W2: "hoy" desde un momento entre el mix 1 y el 2
do $$ declare j jsonb := widget_player('00000000-0000-0000-0000-00000000000a', to_timestamp(4000)); begin
  if j->'hoy'->>'v' <> '0' or j->'hoy'->>'d' <> '1' or j->'hoy'->>'e' <> '1' then raise exception 'W2: %', j->'hoy'; end if;
  if jsonb_array_length(j->'ultimos') <> 3 then raise exception 'W2 últimos: %', j->'ultimos'; end if;
  raise notice 'W2 OK: %', j->'hoy';
end $$;

-- W3: jugador sin mixes ni SteamID
do $$ declare j jsonb := widget_player('00000000-0000-0000-0000-00000000000c'); begin
  if (j->>'elo')::int <> (select start_elo from elo_config where id = 1) or (j->>'matches')::int <> 0
     or j->'hoy'->>'v' <> '0' or j->'hoy'->>'elo' <> '0' or j->'ultimos' <> '[]'::jsonb or j->'team_tag' <> 'null'::jsonb then
    raise exception 'W3: %', j; end if;
  raise notice 'W3 OK: %', j;
end $$;

-- W4: jugador que no existe
do $$ begin
  if widget_player('00000000-0000-0000-0000-0000000000ff') is not null then raise exception 'W4'; end if;
  raise notice 'W4 OK: null';
end $$;

-- W5: fila vieja solo con steam_id (sin player_id) también cuenta
update match_player_stats set player_id = null where steam_id = '76561198000000001';
do $$ declare j jsonb := widget_player('00000000-0000-0000-0000-00000000000a', to_timestamp(0)); begin
  if jsonb_array_length(j->'ultimos') <> 3 or j->'hoy'->>'v' <> '1' then raise exception 'W5: %', j; end if;
  raise notice 'W5 OK';
end $$;

-- W6: anon puede llamarla. En Supabase anon ya tiene select sobre las tablas de public
-- (lo filtra RLS); el stub no, así que se le da acá.
grant select on all tables in schema public to anon;
set role anon;
select widget_player('00000000-0000-0000-0000-00000000000a') is not null as anon_ok;
reset role;

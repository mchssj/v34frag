-- Pruebas de 20261013140000_rendicion_y_nombres.sql (PostgreSQL local con el stub de Supabase).
-- Cada prueba imprime "ok R<n>" o lanza una excepción.
\set ON_ERROR_STOP 1

insert into game_servers(id, name, token_hash) values ('00000000-0000-0000-0000-000000000001', 'prueba', 'x')
on conflict do nothing;

create or replace function pg_temp.payload(p_uid text, p_extra jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'schema', 1, 'match_uid', p_uid, 'map', 'de_dust2', 'started_at', 1791921727, 'ended_at', 1791921861,
    'status', 'finished', 'score', jsonb_build_object('a', 13, 'b', 4), 'winner', 'a',
    'players', jsonb_build_array(
      jsonb_build_object('steamid', 'STEAM_0:0:111', 'name', 'daniloev', 'team', 'a', 'rounds', 17, 'kills', 20, 'deaths', 8),
      jsonb_build_object('steamid', 'STEAM_0:0:222', 'name', 'juanchi',  'team', 'a', 'rounds', 17, 'kills', 15, 'deaths', 9),
      jsonb_build_object('steamid', 'STEAM_0:0:333', 'name', 'pepe',     'team', 'b', 'rounds', 17, 'kills', 9,  'deaths', 18),
      jsonb_build_object('steamid', 'STEAM_0:0:444', 'name', 'tito',     'team', 'b', 'rounds', 17, 'kills', 8,  'deaths', 18))
  ) || p_extra
$$;

-- R1: rendición con nombres de equipo
do $$
declare v uuid; m record;
begin
  v := csstv_ingest('00000000-0000-0000-0000-000000000001',
         pg_temp.payload('test-gg-0001', '{"end_reason":"surrender","team_names":{"a":"daniloev","b":"pepe"}}'));
  select status, end_reason, winner = team1 as gana_a,
         (select name from teams where id = team1) as n1, (select name from teams where id = team2) as n2
    into m from matches where id = v;
  if m.status <> 'finished' or m.end_reason is distinct from 'surrender' or not m.gana_a
     or m.n1 <> 'Equipo daniloev' or m.n2 <> 'Equipo pepe' then
    raise exception 'R1 falló: %', row_to_json(m);
  end if;
  raise notice 'ok R1 (%, %, %)', m.end_reason, m.n1, m.n2;
end $$;

-- R2: ELO de la partida rendida (se aplica como en cualquier finished)
do $$
declare v uuid; n int;
begin
  select id into v from matches where external_id = 'test-gg-0001';
  perform elo_apply_match(v);
  select count(*) into n from match_player_stats where match_id = v and elo_delta is not null and elo_delta <> 0;
  if n <> 4 then raise exception 'R2 falló: % jugadores con ELO', n; end if;
  raise notice 'ok R2 (4 jugadores con cambio de ELO)';
end $$;

-- R3: plugin anterior (sin team_names ni end_reason): "Mix de <top fragger>" y end_reason null
do $$
declare v uuid; m record;
begin
  v := csstv_ingest('00000000-0000-0000-0000-000000000001', pg_temp.payload('test-old-0001', '{}'));
  select end_reason, (select name from teams where id = team1) as n1, (select name from teams where id = team2) as n2
    into m from matches where id = v;
  if m.end_reason is not null or m.n1 <> 'Mix de daniloev' or m.n2 <> 'Mix de pepe' then
    raise exception 'R3 falló: %', row_to_json(m);
  end if;
  raise notice 'ok R3 (%, %)', m.n1, m.n2;
end $$;

-- R4: nombres vacíos, end_reason desconocido y cancelada con end_reason: se ignoran
do $$
declare v uuid; w uuid; m record; c record;
begin
  v := csstv_ingest('00000000-0000-0000-0000-000000000001',
         pg_temp.payload('test-raro-0001', '{"end_reason":"otra","team_names":{"a":"  ","b":""}}'));
  select end_reason, (select name from teams where id = team1) as n1 into m from matches where id = v;
  w := csstv_ingest('00000000-0000-0000-0000-000000000001',
         pg_temp.payload('test-canc-0001', '{"status":"cancelled","cancel_reason":"admin","end_reason":"surrender"}'));
  select status, end_reason into c from matches where id = w;
  if m.end_reason is not null or m.n1 <> 'Mix de daniloev' or c.status <> 'cancelled' or c.end_reason is not null then
    raise exception 'R4 falló: % / %', row_to_json(m), row_to_json(c);
  end if;
  raise notice 'ok R4';
end $$;

-- R5: nombre largo se corta a 20 caracteres
do $$
declare v uuid; n text;
begin
  v := csstv_ingest('00000000-0000-0000-0000-000000000001',
         pg_temp.payload('test-largo-0001', '{"team_names":{"a":"abcdefghijklmnopqrstuvwxyz","b":"x"}}'));
  select name into n from teams where id = (select team1 from matches where id = v);
  if n <> 'Equipo abcdefghijklmnopqrst' then raise exception 'R5 falló: %', n; end if;
  raise notice 'ok R5 (%)', n;
end $$;

-- R6: la restricción no deja guardar otro motivo
do $$
begin
  begin
    update matches set end_reason = 'otro' where external_id = 'test-gg-0001';
    raise exception 'R6 falló: aceptó end_reason = otro';
  exception when check_violation then
    raise notice 'ok R6';
  end;
end $$;

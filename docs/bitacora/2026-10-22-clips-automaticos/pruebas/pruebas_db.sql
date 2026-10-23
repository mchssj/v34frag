-- Pruebas de la migración 20261023120000_clips.sql en la Supabase LOCAL (nunca en producción).
-- Esquema de producción sin el replanteo:  cd web/backend && REPLANTEO=0 pnpm db:reset
-- Correr:  docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 < pruebas_db.sql
-- Todo va en una transacción que se deshace al final. Cada caso imprime "OK: …"; el primer fallo aborta.

begin;
set local client_min_messages = notice;

insert into game_servers (id, name, token_hash)
values ('aaaaaaaa-2310-4000-8000-000000000001', 'servidor de prueba',
        encode(sha256(convert_to('tok-prueba-clips', 'UTF8')), 'hex'));
insert into players (id, nick, steam_id)
select ('bbbbbbbb-2310-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'J' || i, (76561199900000000 + i)::text
  from generate_series(1, 4) i;

-- Resultado o foto de un mix 2v2 con J1, J2 (a) y J3, J4 (b), con los campos extra que se pasen.
create function pg_temp.payload(p_uid text, p_status text, p_a integer, p_b integer, p_extra jsonb default '{}',
                                p_seq integer default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schema', 1, 'plugin_version', '2.5.0', 'server_tag', 'srv1', 'match_uid', p_uid, 'map', 'de_dust2',
    'started_at', 1792000000, 'ended_at', 1792003600, 'max_rounds', 24, 'overtimes', 0,
    'status', p_status, 'team_names', jsonb_build_object('a', '', 'b', ''), 'demo', true,
    'score', jsonb_build_object('a', p_a, 'b', p_b), 'winner', null, 'rounds', '[]'::jsonb,
    'players', (select jsonb_agg(jsonb_build_object('steamid', (76561199900000000 + i)::text, 'name', 'J' || i,
                                                    'team', case when i <= 2 then 'a' else 'b' end,
                                                    'rounds', p_a + p_b, 'kills', 10 + i, 'deaths', 8))
                  from generate_series(1, 4) i))
  || p_extra
  || case when p_seq is null then '{}'::jsonb else jsonb_build_object('live_seq', p_seq) end
$$;

-- Un registro de clip como lo manda el plugin.
create function pg_temp.clip(p_round integer, p_jugador integer, p_ticks integer[], p_won boolean default true,
                             p_vs integer default null)
returns jsonb language sql as $$
  select jsonb_build_object('round', p_round, 'steamid', (76561199900000000 + p_jugador)::text, 'name', 'J' || p_jugador,
                            'round_seconds', 30, 'round_won', p_won, 'kill_ticks', to_jsonb(p_ticks))
      || case when p_vs is null then '{}'::jsonb
              else jsonb_build_object('clutch_vs', p_vs, 'clutch_start_tick', 1000 * p_round, 'end_tick', 1000 * p_round + 900) end
$$;

-- Lo manda como el plugin: base64 en partes de 1400 caracteres a ingest_server_chunk.
create function pg_temp.send(p_uid text, p jsonb) returns uuid language plpgsql as $$
declare
  b64 text := replace(encode(convert_to(p::text, 'UTF8'), 'base64'), E'\n', '');
  n   integer := (length(b64) + 1399) / 1400;
  r   uuid;
begin
  for i in 1..n loop
    r := ingest_server_chunk('tok-prueba-clips', p_uid, i, n, substr(b64, (i - 1) * 1400 + 1, 1400));
  end loop;
  return r;
end $$;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;

-- Espera un error con ese texto.
create function pg_temp.err(sql text, txt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if position(txt in sqlerrm) > 0 then raise notice 'OK: % (%)', msg, sqlerrm; return; end if;
    raise exception 'FALLA: % — error distinto: %', msg, sqlerrm;
  end;
  raise exception 'FALLA: % — no dio error', msg;
end $$;

do $$
declare
  v_id  uuid;
  v_id2 uuid;
  r     record;
  prio  jsonb := (select priorities from clip_config where id = 1);
begin
  -- 1. Clasificación: el tipo de mayor prioridad entre las kills y el clutch (ganado).
  perform pg_temp.ok(clip_type(5, null, true, prio) = 'ace', '5 kills: ace');
  perform pg_temp.ok(clip_type(4, null, false, prio) = '4k', '4 kills en ronda perdida: 4k');
  perform pg_temp.ok(clip_type(3, 3::smallint, true, prio) = 'clutch_3', '3k en un 1v3 ganado: clutch 1v3 (4) gana al 3k (5)');
  perform pg_temp.ok(clip_type(3, 2::smallint, true, prio) = '3k', '3k en un 1v2 ganado: 3k (5) gana al 1v2 (6)');
  perform pg_temp.ok(clip_type(4, 4::smallint, true, prio) = 'clutch_4', '4k en un 1v4 ganado: clutch 1v4 (2) gana al 4k (3)');
  perform pg_temp.ok(clip_type(0, 1::smallint, true, prio) = 'clutch_1', '1v1 ganado sin kills (defuse): clutch 1v1');
  perform pg_temp.ok(clip_type(3, 2::smallint, false, prio) = '3k', 'clutch perdido no cuenta: queda el 3k');

  -- 2. Resultado con clips y tickrate.
  v_id := pg_temp.send('srv1-clips-0001', pg_temp.payload('srv1-clips-0001', 'finished', 13, 5, jsonb_build_object(
            'tickrate', 100,
            'clips', jsonb_build_array(
              pg_temp.clip(3, 1, array[300100, 300400, 301000, 301500, 302000]),           -- ace
              pg_temp.clip(7, 3, array[700100, 700300, 700900], false),                   -- 3k, ronda perdida
              pg_temp.clip(9, 2, array[900200], true, 2),                                 -- 1v2 ganado
              pg_temp.clip(11, 4, '{}', true, 1)                                          -- 1v1 ganado sin kills
            ))));
  perform pg_temp.ok((select tickrate from matches where id = v_id) = 100, 'tickrate guardado');
  perform pg_temp.ok((select count(*) from match_clips where match_id = v_id) = 4, 'cuatro registros guardados');
  select * into r from match_clips where match_id = v_id and round = 3;
  perform pg_temp.ok(r.player_steamid = '76561199900000001' and r.kill_ticks = array[300100, 300400, 301000, 301500, 302000]
                     and r.round_won and r.clutch_vs is null, 'ticks de cada kill guardados en orden');
  select * into r from match_clip_list where match_id = v_id and round = 3;
  perform pg_temp.ok(r.type = 'ace' and r.position = 1 and r.kills = 5 and r.tickrate = 100
                     and r.player_id = 'bbbbbbbb-2310-4000-8000-000000000001' and r.player_name = 'J1', 'listado: ace primero, con su ficha');
  perform pg_temp.ok((select array_agg(type order by position) from match_clip_list where match_id = v_id)
                     = array['ace', '3k', 'clutch_2', 'clutch_1'], 'listado ordenado por prioridad');

  -- 3. SteamID en formato STEAM_0: se guarda como steam64 y encuentra la ficha.
  perform csstv_clips_save(v_id, jsonb_build_object('clips', jsonb_build_array(
            pg_temp.clip(3, 1, array[1, 2, 3]) || '{"steamid": "STEAM_0:1:969867136"}')));
  perform pg_temp.ok((select player_steamid from match_clips where match_id = v_id) = '76561199900000001'
                     and (select player_id from match_clip_list where match_id = v_id) = 'bbbbbbbb-2310-4000-8000-000000000001',
                     'STEAM_0 pasa a steam64');

  -- 4. Reenvío del mismo resultado: reemplaza, no duplica.
  perform pg_temp.ok(pg_temp.send('srv1-clips-0001', pg_temp.payload('srv1-clips-0001', 'finished', 13, 5, jsonb_build_object(
            'tickrate', 100, 'clips', jsonb_build_array(pg_temp.clip(3, 1, array[300100, 300400, 301000, 301500, 302000]))))) = v_id,
                     'reenvío devuelve la misma partida');
  perform pg_temp.ok((select count(*) from match_clips where match_id = v_id) <= 1, 'reenvío sin duplicados');

  -- 5. Resultado sin clips ni tickrate (plugin viejo): se guarda como siempre.
  v_id2 := pg_temp.send('srv1-clips-0002', pg_temp.payload('srv1-clips-0002', 'finished', 13, 2));
  perform pg_temp.ok(v_id2 is not null and (select tickrate from matches where id = v_id2) is null
                     and not exists (select 1 from match_clips where match_id = v_id2), 'sin clips: partida normal');

  -- 6. Registros inválidos: se descartan sin tirar la ingesta.
  v_id2 := pg_temp.send('srv1-clips-0003', pg_temp.payload('srv1-clips-0003', 'finished', 13, 3, jsonb_build_object(
            'tickrate', 5,                                                                  -- fuera de rango: no se guarda
            'clips', jsonb_build_array(
              pg_temp.clip(4, 1, array[1, 2, 3]),                                           -- válido
              pg_temp.clip(0, 1, array[1, 2, 3]),                                           -- ronda 0
              pg_temp.clip(5, 1, array[1, 2, 3, 4, 5, 6]),                                  -- 6 kills
              pg_temp.clip(6, 1, array[1, 2]),                                              -- 2k sin clutch
              pg_temp.clip(7, 1, array[1], false, 2),                                       -- clutch perdido con 1 kill
              pg_temp.clip(8, 1, array[1, 2, 3]) || '{"clutch_vs": 2}',                     -- clutch incompleto
              pg_temp.clip(9, 1, array[1, 2, 3]) || '{"kill_ticks": ["a", "b", "c"]}',      -- ticks que no son números
              pg_temp.clip(10, 1, array[1, 2, 3]) || '{"clutch_vs": 7, "clutch_start_tick": 1, "end_tick": 2}', -- 1v7
              pg_temp.clip(11, 1, array[-5, 2, 3]),                                         -- tick negativo
              pg_temp.clip(12, 1, array[1, 2, 3]) || '{"steamid": ""}',                     -- sin SteamID
              '"basura"'::jsonb,
              pg_temp.clip(4, 1, array[7, 8, 9])                                            -- repetido: queda el primero
            ))));
  perform pg_temp.ok(v_id2 is not null and (select status from matches where id = v_id2) = 'finished', 'inválidos: la partida se guarda');
  perform pg_temp.ok((select tickrate from matches where id = v_id2) is null, 'tickrate fuera de rango ignorado');
  perform pg_temp.ok((select count(*) from match_clips where match_id = v_id2) = 1
                     and (select kill_ticks from match_clips where match_id = v_id2) = array[1, 2, 3], 'solo queda el registro válido');

  -- 7. Topes: 2 por jugador y 10 por partida; desempate por ronda ganada y después la más tardía.
  v_id2 := pg_temp.send('srv1-clips-0004', pg_temp.payload('srv1-clips-0004', 'finished', 16, 14, jsonb_build_object(
            'tickrate', 66,
            'clips', (select jsonb_agg(pg_temp.clip(i, 1 + (i - 1) % 4, array[i * 10, i * 10 + 1, i * 10 + 2], i % 3 <> 0))
                        from generate_series(1, 20) i))));
  perform pg_temp.ok((select count(*) from match_clips where match_id = v_id2) = 20, 'topes: guarda todos los registros');
  perform pg_temp.ok((select count(*) from match_clip_list where match_id = v_id2) = 8, 'topes: 2 por jugador (4 jugadores = 8)');
  perform pg_temp.ok((select bool_and(n = 2) from (select count(*) n from match_clip_list where match_id = v_id2 group by player_steamid) x),
                     'topes: cada jugador con 2');
  -- J1 tiene las rondas 1, 5, 9, 13 y 17; la 9 es perdida (9 % 3 = 0). Quedan las ganadas más tardías: 17 y 13.
  perform pg_temp.ok((select array_agg(round order by round) from match_clip_list
                       where match_id = v_id2 and player_steamid = '76561199900000001') = array[13, 17], 'desempate: ganadas y más tardías');
  perform clip_set_config(prio, 10, 10, 8, 3, 2);
  perform pg_temp.ok((select count(*) from match_clip_list where match_id = v_id2) = 10, 'topes: 10 por partida');
  perform pg_temp.ok((select bool_and(round_won) from match_clip_list where match_id = v_id2), 'topes: las ganadas primero');

  -- 8. La escala se cambia sin tocar los datos: el 3k pasa a ser lo más valioso.
  perform csstv_clips_save(v_id, jsonb_build_object('clips', jsonb_build_array(
            pg_temp.clip(3, 1, array[1, 2, 3, 4, 5]), pg_temp.clip(4, 2, array[6, 7, 8]))));
  perform pg_temp.ok((select type from match_clip_list where match_id = v_id and position = 1) = 'ace', 'escala de fábrica: ace primero');
  perform clip_set_config(prio || '{"3k": 1, "ace": 9}', 2, 10, 8, 3, 2);
  perform pg_temp.ok((select type from match_clip_list where match_id = v_id and position = 1) = '3k', 'escala nueva aplicada al listado');
  perform clip_set_config(prio, 2, 10, 8, 3, 2);
  perform pg_temp.err(format('select clip_set_config(%L, 2, 10, 8, 3, 2)', prio - 'ace'), 'prioridad de ace', 'escala sin un tipo rechazada');
  perform pg_temp.err(format('select clip_set_config(%L, 2, 10, 8, 3, 2)', prio || '{"5k": 1}'), 'no existen', 'escala con un tipo de más rechazada');
  perform pg_temp.err(format('select clip_set_config(%L, 2, 10, 8, 3, 2)', prio || '{"ace": 1.5}'), 'entero', 'prioridad no entera rechazada');
  perform pg_temp.err(format('select clip_set_config(%L, 0, 10, 8, 3, 2)', prio), 'por jugador', 'tope por jugador 0 rechazado');
  perform pg_temp.err(format('select clip_set_config(%L, 2, 10, 8, 20, 2)', prio), 'márgenes', 'margen de 20 s rechazado');

  -- 9. Caída: los clips de la foto en vivo llegan con el cierre del admin, y se muestran.
  perform pg_temp.send('srv1-clips-0005_v6', pg_temp.payload('srv1-clips-0005', 'live', 4, 2, jsonb_build_object(
            'tickrate', 100, 'clips', jsonb_build_array(pg_temp.clip(5, 2, array[5001, 5002, 5003, 5004]))), 6));
  update live_matches set updated_at = now() - interval '11 minutes' where uid = 'srv1-clips-0005';
  v_id2 := live_match_close('srv1-clips-0005');
  perform pg_temp.ok((select status from matches where id = v_id2) = 'cancelled'
                     and (select type from match_clip_list where match_id = v_id2) = '4k'
                     and (select match_status from match_clip_list where match_id = v_id2) = 'cancelled', 'caída cerrada por el admin: conserva y muestra sus clips');

  -- 10. Caída que manda el plugin al volver (cancelada por crash), con clips.
  v_id2 := pg_temp.send('srv1-clips-0006', pg_temp.payload('srv1-clips-0006', 'cancelled', 3, 3, jsonb_build_object(
            'cancel_reason', 'crash', 'cancelled_by', '', 'tickrate', 100,
            'clips', jsonb_build_array(pg_temp.clip(2, 3, array[1, 2, 3, 4, 5])))));
  perform pg_temp.ok((select source from match_crashes where match_id = v_id2) = 'plugin'
                     and (select type from match_clip_list where match_id = v_id2) = 'ace', 'caída del plugin: marca de caída y clips');

  -- 11. Borrar la partida borra sus clips.
  delete from matches where id = v_id2;
  perform pg_temp.ok(not exists (select 1 from match_clips where match_id = v_id2), 'borrar la partida borra sus clips');
end $$;

-- 12. Permisos: el público lee, pero no escribe ni guarda clips ni cambia la configuración.
set local role anon;
do $$
begin
  perform pg_temp.ok((select count(*) from match_clip_list) > 0 and (select count(*) from clip_config) = 1, 'anon lee el listado y la configuración');
  -- Sin política de escritura: falla por RLS o por falta de permiso, según los grants.
  perform pg_temp.err($q$insert into match_clips(match_id, round, player_steamid, round_won, kill_ticks)
                         select id, 1, 'x', true, '{1,2,3}' from matches limit 1$q$, '', 'anon no inserta clips');
  -- Un update sin política no da error (no ve filas); se comprueba abajo que no cambió.
  begin
    update clip_config set per_match = 50;
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.err($q$select csstv_clips_save(null, '{}')$q$, 'permission denied', 'anon no llama a csstv_clips_save');
  perform pg_temp.err($q$select clip_set_config('{}', 2, 10, 8, 3, 2)$q$, 'permission denied', 'anon no llama a clip_set_config');
end $$;
reset role;
do $$
begin
  perform pg_temp.ok((select per_match from clip_config where id = 1) = 10, 'la configuración no cambió');
end $$;

rollback;

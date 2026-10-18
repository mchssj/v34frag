-- Pruebas de la migración 20261017120000_mixes_en_vivo.sql en la Supabase LOCAL (nunca en producción).
-- Esquema de producción sin el replanteo:  cd web/backend && REPLANTEO=0 pnpm db:reset
-- Correr:  docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 < pruebas_db.sql
-- Todo va en una transacción que se deshace al final. Cada caso imprime "OK: …"; el primer fallo aborta.

begin;
set local client_min_messages = notice;

insert into game_servers (id, name, token_hash)
values ('aaaaaaaa-7000-4000-8000-000000000001', 'servidor de prueba',
        encode(sha256(convert_to('tok-prueba-vivo', 'UTF8')), 'hex'));
insert into players (id, nick, steam_id)
select ('bbbbbbbb-7000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'J' || i, (76561199900000000 + i)::text
  from generate_series(1, 4) i;

-- Arma la foto o el resultado de un mix 2v2 con J1, J2 (a) y J3, J4 (b).
create function pg_temp.payload(p_uid text, p_status text, p_a integer, p_b integer, p_seq integer default null,
                                p_max integer default 24)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schema', 1, 'plugin_version', '2.1.0', 'server_tag', 'srv1', 'match_uid', p_uid, 'map', 'de_dust2',
    'started_at', 1792000000, 'ended_at', 1792003600, 'max_rounds', p_max, 'overtimes', 0,
    'status', p_status, 'team_names', jsonb_build_object('a', '', 'b', ''), 'demo', false,
    'score', jsonb_build_object('a', p_a, 'b', p_b), 'winner', null, 'rounds', '[]'::jsonb,
    'players', (select jsonb_agg(jsonb_build_object('steamid', (76561199900000000 + i)::text, 'name', 'J' || i,
                                                    'team', case when i <= 2 then 'a' else 'b' end,
                                                    'rounds', p_a + p_b, 'kills', 10 + i, 'deaths', 8))
                  from generate_series(1, 4) i))
  || case when p_seq is null then '{}'::jsonb else jsonb_build_object('live_seq', p_seq) end
$$;

-- Lo manda como el plugin: base64 en partes de 1400 caracteres a ingest_server_chunk.
create function pg_temp.send(p_uid text, p jsonb) returns uuid language plpgsql as $$
declare
  b64 text := replace(encode(convert_to(p::text, 'UTF8'), 'base64'), E'\n', '');
  n   integer := (length(b64) + 1399) / 1400;
  r   uuid;
begin
  for i in 1..n loop
    r := ingest_server_chunk('tok-prueba-vivo', p_uid, i, n, substr(b64, (i - 1) * 1400 + 1, 1400));
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
  v_id uuid;
  v_id2 uuid;
  r record;
begin
  -- 1. Fotos en vivo: se guardan, se actualizan y una vieja no pisa a una nueva.
  perform pg_temp.ok(pg_temp.send('srv1-vivo-0001_v1', pg_temp.payload('srv1-vivo-0001', 'live', 1, 0, 1)) is null, 'la foto no devuelve partida');
  select * into r from live_matches where uid = 'srv1-vivo-0001';
  perform pg_temp.ok(r.seq = 1 and r.score_a = 1 and r.map = 'dust2' and r.server_name = 'servidor de prueba' and r.max_rounds = 24, 'foto 1 guardada');
  perform pg_temp.send('srv1-vivo-0001_v3', pg_temp.payload('srv1-vivo-0001', 'live', 2, 1, 3));
  perform pg_temp.send('srv1-vivo-0001_v2', pg_temp.payload('srv1-vivo-0001', 'live', 9, 9, 2));
  select * into r from live_matches where uid = 'srv1-vivo-0001';
  perform pg_temp.ok(r.seq = 3 and r.score_a = 2 and r.score_b = 1, 'la foto 2 (vieja) no pisa a la 3');
  perform pg_temp.ok(not exists (select 1 from ingest_chunks where uid like 'srv1-vivo-0001%'), 'no quedan partes de las fotos');
  perform pg_temp.ok(not exists (select 1 from matches where external_id like 'srv1-vivo-0001%'), 'una foto no crea partidas');

  -- 2. El uid de las partes tiene que ser <match_uid>_v<seq>.
  perform pg_temp.err($q$select pg_temp.send('srv1-vivo-0001', pg_temp.payload('srv1-vivo-0001', 'live', 3, 1, 4))$q$,
                      'El uid no coincide', 'foto sin _v<seq> rechazada');
  perform pg_temp.err($q$select pg_temp.send('srv1-vivo-0001_v9', pg_temp.payload('srv1-vivo-0001', 'live', 3, 1, 4))$q$,
                      'El uid no coincide', 'foto con otro seq rechazada');

  -- 3. Resultado final: crea la partida, borra la foto y aplica el ELO.
  v_id := pg_temp.send('srv1-vivo-0001', pg_temp.payload('srv1-vivo-0001', 'finished', 13, 5));
  perform pg_temp.ok(v_id is not null and (select status from matches where id = v_id) = 'finished', 'resultado final guardado');
  perform pg_temp.ok(not exists (select 1 from live_matches where uid = 'srv1-vivo-0001'), 'el final borra la foto');
  perform pg_temp.ok((select count(*) from match_player_stats where match_id = v_id and elo_after is not null) = 4, 'el final tiene ELO');
  perform pg_temp.ok(not exists (select 1 from match_crashes where match_id = v_id), 'un final no es caída');

  -- 4. Una foto que llega tarde no revive el mix.
  perform pg_temp.send('srv1-vivo-0001_v20', pg_temp.payload('srv1-vivo-0001', 'live', 13, 5, 20));
  perform pg_temp.ok(not exists (select 1 from live_matches where uid = 'srv1-vivo-0001'), 'foto tardía ignorada');

  -- 5. Caída: el plugin vuelve y manda la última foto como cancelada por "crash".
  perform pg_temp.send('srv1-caida-0002_v1', pg_temp.payload('srv1-caida-0002', 'live', 5, 3, 1));
  v_id := pg_temp.send('srv1-caida-0002',
            pg_temp.payload('srv1-caida-0002', 'cancelled', 5, 3) || '{"cancel_reason":"crash","cancelled_by":""}');
  select * into r from matches where id = v_id;
  perform pg_temp.ok(r.status = 'cancelled' and r.cancel_reason = 'crash' and r.cancelled_by is null, 'caída guardada como cancelada por crash');
  perform pg_temp.ok((select source from match_crashes where match_id = v_id) = 'plugin', 'caída pendiente de revisión (plugin)');
  perform pg_temp.ok(not exists (select 1 from match_player_stats where match_id = v_id and elo_after is not null), 'la caída no da ELO sola');
  perform pg_temp.ok(not exists (select 1 from live_matches where uid = 'srv1-caida-0002'), 'la caída borra la foto');
  -- Un reenvío devuelve la misma partida.
  perform pg_temp.ok(pg_temp.send('srv1-caida-0002',
            pg_temp.payload('srv1-caida-0002', 'cancelled', 5, 3) || '{"cancel_reason":"crash"}') = v_id, 'reenvío idempotente');

  -- 6. Aplicar el ELO: 8 de 24 rondas no llega al 35 % (hacen falta 9).
  perform pg_temp.ok(crash_min_rounds(24) = 9 and crash_min_rounds(30) = 11 and crash_min_rounds(6) = 3, 'mínimo de rondas (35 %, hacia arriba)');
  perform pg_temp.err(format('select elo_crash_apply(%L)', v_id), 'hacen falta 9', '8 de 24 rondas rechazado');

  -- Empate con 10 rondas.
  v_id2 := pg_temp.send('srv1-caida-0003', pg_temp.payload('srv1-caida-0003', 'cancelled', 5, 5) || '{"cancel_reason":"crash"}');
  perform pg_temp.err(format('select elo_crash_apply(%L)', v_id2), 'empatados', 'empate rechazado');

  -- 9 de 24 (5-4): se aplica.
  v_id2 := pg_temp.send('srv1-caida-0004', pg_temp.payload('srv1-caida-0004', 'cancelled', 4, 5) || '{"cancel_reason":"crash"}');
  perform elo_crash_apply(v_id2);
  select * into r from matches where id = v_id2;
  perform pg_temp.ok(r.status = 'finished' and r.end_reason = 'crash' and r.cancel_reason is null and r.winner = r.team2,
                     'aprobado: terminado por caída, gana el que iba adelante');
  perform pg_temp.ok((select count(*) from match_player_stats where match_id = v_id2 and elo_after is not null) = 4, 'aprobado: tiene ELO');
  perform pg_temp.ok((select bool_and(elo_delta > 0) from match_player_stats where match_id = v_id2 and team = 2), 'aprobado: el equipo que iba ganando suma');
  perform pg_temp.ok((select decision from match_crashes where match_id = v_id2) = 'applied', 'aprobado: revisión registrada');
  perform pg_temp.err(format('select elo_crash_apply(%L)', v_id2), 'no está interrumpido', 'no se aplica dos veces');

  -- 7. Descartar.
  perform elo_crash_discard(v_id);
  perform pg_temp.ok((select decision from match_crashes where match_id = v_id) = 'discarded'
                     and (select status from matches where id = v_id) = 'cancelled', 'descartado: sigue cancelado');
  perform pg_temp.err(format('select elo_crash_discard(%L)', v_id), 'no está pendiente', 'no se descarta dos veces');
  perform pg_temp.err(format('select elo_crash_apply(%L)', v_id), 'ya se revisó', 'descartado no se puede aplicar');

  -- 8. El servidor no vuelve: un admin cierra la foto (solo sin novedades hace 10 minutos).
  perform pg_temp.send('srv1-colgado-0005_v7', pg_temp.payload('srv1-colgado-0005', 'live', 7, 4, 7));
  perform pg_temp.err($q$select live_match_close('srv1-colgado-0005')$q$, 'sigue mandando datos', 'no se cierra un mix que sigue vivo');
  update live_matches set updated_at = now() - interval '11 minutes' where uid = 'srv1-colgado-0005';
  v_id := live_match_close('srv1-colgado-0005');
  select * into r from matches where id = v_id;
  perform pg_temp.ok(r.status = 'cancelled' and r.cancel_reason = 'crash' and r.score1 = 7 and r.score2 = 4
                     and (select source from match_crashes where match_id = v_id) = 'admin', 'cerrado por el admin como caída');
  perform pg_temp.ok(not exists (select 1 from live_matches where uid = 'srv1-colgado-0005'), 'cerrar borra la foto');
  -- Si después el servidor vuelve y manda la caída, es la misma partida.
  perform pg_temp.ok(pg_temp.send('srv1-colgado-0005',
            pg_temp.payload('srv1-colgado-0005', 'cancelled', 7, 4) || '{"cancel_reason":"crash"}') = v_id, 'la caída del plugin después del cierre no duplica');
  perform pg_temp.err($q$select live_match_close('srv1-colgado-0005')$q$, 'ya no está en vivo', 'cerrar algo que no está en vivo');

  -- 9. El recálculo completo incluye el mix aprobado con el mismo resultado.
  create temp table antes on commit drop as select steam_id, elo from player_elo;
  perform elo_recompute_all();
  perform pg_temp.ok(not exists (select 1 from player_elo e join antes a using (steam_id) where a.elo <> e.elo)
                     and (select count(*) from match_player_stats where match_id = v_id2 and elo_after is not null) = 4,
                     'el recálculo da lo mismo e incluye el aprobado');

  -- 10. Las cancelaciones de siempre no cambian.
  v_id := pg_temp.send('srv1-admin-0006', pg_temp.payload('srv1-admin-0006', 'cancelled', 2, 1) || '{"cancel_reason":"admin","cancelled_by":"Daniel"}');
  perform pg_temp.ok((select cancel_reason from matches where id = v_id) = 'admin'
                     and not exists (select 1 from match_crashes where match_id = v_id), 'cancelada por admin sigue igual');

  -- 11. csstv_uploader.py (ingest_server_match): la caída y la foto se tratan igual.
  perform pg_temp.send('srv1-uploader-0007_v2', pg_temp.payload('srv1-uploader-0007', 'live', 3, 3, 2));
  v_id := ingest_server_match('tok-prueba-vivo', pg_temp.payload('srv1-uploader-0007', 'cancelled', 3, 3) || '{"cancel_reason":"crash"}');
  perform pg_temp.ok((select cancel_reason from matches where id = v_id) = 'crash'
                     and exists (select 1 from match_crashes where match_id = v_id and source = 'plugin')
                     and not exists (select 1 from live_matches where uid = 'srv1-uploader-0007'), 'caída por el uploader');
end $$;

-- 12. Permisos: anon solo lee; un usuario sin rol de admin no puede revisar ni cerrar.
set local role anon;
do $$ begin
  perform pg_temp.ok((select count(*) from live_matches) >= 0 and (select count(*) from match_crashes) > 0, 'anon lee live_matches y match_crashes');
end $$;
do $$ begin
  perform pg_temp.err($q$select elo_crash_apply(gen_random_uuid())$q$, 'permission denied', 'anon no puede aplicar ELO');
  perform pg_temp.err($q$select live_match_close('x')$q$, 'permission denied', 'anon no puede cerrar');
  perform pg_temp.err($q$select csstv_live_upsert(gen_random_uuid(), 'x', '{}')$q$, 'permission denied', 'anon no llama a la interna');
  perform pg_temp.err($q$insert into live_matches(uid, server_id, seq, score_a, score_b, payload) values ('x', gen_random_uuid(), 1, 0, 0, '{}')$q$,
                      'permission denied', 'anon no escribe live_matches');
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-7000-4000-8000-000000000009","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform pg_temp.err($q$select elo_crash_apply(gen_random_uuid())$q$, 'Solo un admin', 'usuario común no puede aplicar ELO');
  perform pg_temp.err($q$select elo_crash_discard(gen_random_uuid())$q$, 'Solo un admin', 'usuario común no puede descartar');
  perform pg_temp.err($q$select live_match_close('x')$q$, 'Solo un admin', 'usuario común no puede cerrar');
end $$;
reset role;

rollback;

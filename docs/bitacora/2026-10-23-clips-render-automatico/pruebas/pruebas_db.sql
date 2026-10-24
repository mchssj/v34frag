-- Pruebas de la migración 20261023180000_clips_video.sql en la Supabase LOCAL (nunca en producción).
-- Esquema de producción sin el replanteo:  cd web/backend && REPLANTEO=0 pnpm db:reset
-- Correr:  docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 < pruebas_db.sql
-- También con el replanteo completo (pnpm db:reset). Todo va en una transacción que se deshace al final.
-- Cada caso imprime "OK: …"; el primer fallo aborta.

begin;
set local client_min_messages = notice;

insert into game_servers (id, name, token_hash)
values ('aaaaaaaa-2318-4000-8000-000000000001', 'servidor de prueba',
        encode(sha256(convert_to('tok-prueba-video', 'UTF8')), 'hex'));
insert into players (id, nick, steam_id)
select ('bbbbbbbb-2318-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'V' || i, (76561199800000000 + i)::text
  from generate_series(1, 4) i;
insert into render_workers (name, token_hash) values
  ('render-prueba', encode(sha256(convert_to('tok-render', 'UTF8')), 'hex')),
  ('render-inactivo', encode(sha256(convert_to('tok-render-off', 'UTF8')), 'hex'));
update render_workers set active = false where name = 'render-inactivo';

-- Resultado de un mix 2v2 con V1, V2 (a) y V3, V4 (b), con los clips que se pasen.
create function pg_temp.payload(p_uid text, p_status text, p_clips jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schema', 1, 'plugin_version', '2.5.0', 'server_tag', 'srv1', 'match_uid', p_uid, 'map', 'de_tuscan',
    'started_at', 1792000000, 'ended_at', 1792003600, 'max_rounds', 24, 'overtimes', 0,
    'status', p_status, 'team_names', jsonb_build_object('a', '', 'b', ''), 'demo', true,
    'score', jsonb_build_object('a', 13, 'b', 5), 'winner', null, 'rounds', '[]'::jsonb, 'tickrate', 100,
    'players', (select jsonb_agg(jsonb_build_object('steamid', (76561199800000000 + i)::text, 'name', 'V' || i,
                                                    'team', case when i <= 2 then 'a' else 'b' end,
                                                    'rounds', 18, 'kills', 10 + i, 'deaths', 8))
                  from generate_series(1, 4) i),
    'clips', p_clips)
$$;

create function pg_temp.clip(p_round integer, p_jugador integer, p_ticks integer[], p_won boolean default true,
                             p_vs integer default null, p_name text default null)
returns jsonb language sql as $$
  select jsonb_build_object('round', p_round, 'steamid', (76561199800000000 + p_jugador)::text,
                            'name', coalesce(p_name, 'V' || p_jugador),
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
    r := ingest_server_chunk('tok-prueba-video', p_uid, i, n, substr(b64, (i - 1) * 1400 + 1, 1400));
  end loop;
  return r;
end $$;

-- La demo de la partida ya está en R2, con la fecha que se pase (para el orden de la cola).
create function pg_temp.demo_subida(p_match uuid, p_played timestamptz) returns void language sql as $$
  update matches set demo_status = 'uploaded', demo_key = 'demos/2026/10/' || external_id || '.dem', demo_size = 42000000,
                     played_at = p_played where id = p_match
$$;

create function pg_temp.clave(p_clip uuid, p_sufijo text default 'a1b2c3') returns text language sql as $$
  select 'clips/' || match_id || '/' || id || '-' || p_sufijo || '.mp4' from match_clips where id = p_clip
$$;

create function pg_temp.id_clip(p_match uuid, p_round integer) returns uuid language sql as $$
  select id from match_clips where match_id = p_match and round = p_round
$$;

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
  v_a    uuid;  -- partida vieja, terminada
  v_b    uuid;  -- partida nueva, cancelada
  v_c    uuid;  -- partida con la demo pendiente
  v_id   uuid;
  v_id2  uuid;
  j      jsonb;
  r      record;
  n      integer;
begin
  -- 1. Token.
  perform pg_temp.err($q$select clip_render_claim('otro')$q$, 'Token de render inválido', 'token desconocido rechazado');
  perform pg_temp.err($q$select clip_render_claim('tok-render-off')$q$, 'Token de render inválido', 'token desactivado rechazado');
  perform pg_temp.ok(clip_render_claim('tok-render') is null, 'cola vacía: null');
  perform pg_temp.ok((select last_seen_at from render_workers where name = 'render-prueba') is not null, 'el token anota last_seen_at');

  -- 2. Partidas: A (vieja, terminada, 5 jugadas de V1 y una de V2), B (nueva, cancelada) y C (demo sin subir).
  v_a := pg_temp.send('srv1-video-000a', pg_temp.payload('srv1-video-000a', 'finished', jsonb_build_array(
           pg_temp.clip(9, 1, array[90300, 90400, 90500]),
           pg_temp.clip(3, 1, array[30100, 30200, 30300, 30400, 30500]),       -- ace
           pg_temp.clip(5, 1, array[50100, 50200, 50300]),
           pg_temp.clip(7, 2, '{}', true, 2),                                  -- 1v2 ganado, sin kills
           pg_temp.clip(1, 1, array[10100, 10200, 10300]))));
  v_b := pg_temp.send('srv1-video-000b', pg_temp.payload('srv1-video-000b', 'cancelled', jsonb_build_array(
           pg_temp.clip(2, 3, array[20100, 20200, 20300, 20400]))));
  v_c := pg_temp.send('srv1-video-000c', pg_temp.payload('srv1-video-000c', 'finished', jsonb_build_array(
           pg_temp.clip(4, 4, array[40100, 40200, 40300]))));
  perform pg_temp.ok((select count(*) from match_clips where match_id in (v_a, v_b, v_c)) = 7, 'partidas de prueba guardadas');
  perform pg_temp.ok(clip_render_claim('tok-render') is null, 'demos sin subir: nada para grabar');

  perform pg_temp.demo_subida(v_a, now() - interval '2 days');
  perform pg_temp.demo_subida(v_b, now() - interval '1 day');

  -- 3. Toma la partida más vieja, solo con las jugadas visibles (V1 tiene 4; se ven 2), ordenadas por tick.
  j := clip_render_claim('tok-render');
  perform pg_temp.ok(j->'match'->>'id' = v_a::text and j->'match'->>'external_id' = 'srv1-video-000a'
                     and (j->'match'->>'tickrate')::int = 100 and (j->'match'->>'demo_size')::bigint = 42000000,
                     'claim: la partida más vieja, con external_id, tickrate y tamaño de la demo');
  perform pg_temp.ok((j->'config'->>'pre_seconds')::int = 3 and (j->'config'->>'post_seconds')::int = 2
                     and (j->'config'->>'split_gap_seconds')::int = 8, 'claim: márgenes de clip_config');
  perform pg_temp.ok((select array_agg((x->>'round')::int) from jsonb_array_elements(j->'clips') x) = array[7, 3, 9],
                     'claim: solo las visibles (2 de V1 y la de V2), ordenadas por su primer tick (el clutch empieza en 7000)');
  perform pg_temp.ok((select bool_and((x->>'attempt')::int = 1) from jsonb_array_elements(j->'clips') x)
                     and (select x->>'type' from jsonb_array_elements(j->'clips') x where (x->>'round')::int = 3) = 'ace'
                     and (select (x->>'clutch_start_tick')::int from jsonb_array_elements(j->'clips') x where (x->>'round')::int = 7) = 7000,
                     'claim: intento 1, tipo y ticks del clutch');
  perform pg_temp.ok((select count(*) from match_clips where match_id = v_a and video_status = 'processing') = 3
                     and (select count(*) from match_clips where match_id = v_a and video_status is null) = 2,
                     'claim: las visibles quedan processing, las ocultas no');

  -- 4. La siguiente toma es la otra partida (la cancelada); la de la demo pendiente no.
  j := clip_render_claim('tok-render');
  perform pg_temp.ok(j->'match'->>'id' = v_b::text and jsonb_array_length(j->'clips') = 1, 'claim: después, la partida cancelada');
  perform pg_temp.ok(clip_render_claim('tok-render') is null, 'claim: no queda nada (la demo de C no está en R2)');

  -- 5. Video listo.
  v_id := pg_temp.id_clip(v_a, 3);
  perform pg_temp.err(format('select clip_render_done(%L, %L, %L, 9000000, 12.2)', 'tok-render', v_id, 'clips/x/' || v_id || '.mp4'),
                      'Clave de R2 inválida', 'done: clave sin partida ni sufijo rechazada');
  perform pg_temp.err(format('select clip_render_done(%L, %L, %L, 9000000, 12.2)', 'tok-render', v_id,
                             pg_temp.clave(pg_temp.id_clip(v_a, 7))), 'Clave de R2 inválida', 'done: clave de otra jugada rechazada');
  perform pg_temp.err(format('select clip_render_done(%L, %L, %L, 0, 12.2)', 'tok-render', v_id, pg_temp.clave(v_id)),
                      'Tamaño inválido', 'done: tamaño 0 rechazado');
  perform pg_temp.err(format('select clip_render_done(%L, %L, %L, 9000000, 0)', 'tok-render', v_id, pg_temp.clave(v_id)),
                      'Duración inválida', 'done: duración 0 rechazada');
  perform pg_temp.err(format('select clip_render_done(%L, %L, %L, 9000000, 12.2, %L)', 'tok-render', v_id, pg_temp.clave(v_id), 'a/b'),
                      'Id de Drive inválido', 'done: id de Drive inválido rechazado');
  -- Clave con el id de la jugada pero otra partida: no la marca y va a la papelera.
  perform pg_temp.ok(not clip_render_done('tok-render', v_id, replace(pg_temp.clave(v_id), v_a::text, v_b::text), 9000000, 12.2),
                     'done: clave de otra partida no marca la jugada');
  perform pg_temp.ok((select video_status from match_clips where id = v_id) = 'processing'
                     and exists (select 1 from clip_video_trash where video_key like 'clips/' || v_b || '/%'),
                     'done: esa clave va a la papelera');
  delete from clip_video_trash;

  perform pg_temp.ok(clip_render_done('tok-render', v_id, pg_temp.clave(v_id), 9000000, 12.234, '1AbCdEfGhIjKlMnOp_q-r'),
                     'done: marca la jugada');
  select * into r from match_clip_list where id = v_id;
  perform pg_temp.ok(r.video_status = 'done' and r.video_key = pg_temp.clave(v_id) and r.video_seconds = 12.23
                     and r.video_drive_id = '1AbCdEfGhIjKlMnOp_q-r' and r.video_in_r2, 'listado: el video, en R2 y en Drive');
  perform pg_temp.ok(not clip_render_done('tok-render', v_id, pg_temp.clave(v_id, 'otro1'), 9000000, 12.2),
                     'done repetido: no pisa el video');
  perform pg_temp.ok((select video_key from match_clips where id = v_id) = pg_temp.clave(v_id)
                     and (select count(*) from clip_video_trash where video_key = pg_temp.clave(v_id, 'otro1')) = 1,
                     'done repetido: el segundo archivo va a la papelera');
  delete from clip_video_trash;

  -- 6. Fallos: vuelve a la cola hasta el tercer intento; p_final la deja skipped.
  v_id2 := pg_temp.id_clip(v_a, 7);
  perform pg_temp.ok(clip_render_fail('tok-render', v_id2, 'el juego se colgó') = 'pending', 'fail 1: vuelve a la cola');
  perform pg_temp.ok((select video_error from match_clips where id = v_id2) = 'el juego se colgó', 'fail: guarda el error');
  j := clip_render_claim('tok-render');
  perform pg_temp.ok(jsonb_array_length(j->'clips') = 1 and (j->'clips'->0->>'attempt')::int = 2, 'claim: solo la pendiente, intento 2');
  perform pg_temp.ok(clip_render_fail('tok-render', v_id2, 'otra vez') = 'pending', 'fail 2: vuelve a la cola');
  perform clip_render_claim('tok-render');
  perform pg_temp.ok(clip_render_fail('tok-render', v_id2, 'tercera') = 'failed', 'fail 3: queda failed');
  perform pg_temp.ok(clip_render_claim('tok-render') is null, 'failed no vuelve a la cola');
  perform pg_temp.ok(clip_render_fail('tok-render', v_id2, 'tarde') = 'failed', 'fail sobre una failed: no cambia nada');
  perform pg_temp.ok(clip_render_fail('tok-render', gen_random_uuid(), 'x') = 'gone', 'fail de una jugada que no existe: gone');

  v_id2 := pg_temp.id_clip(v_a, 9);
  perform pg_temp.ok(clip_render_fail('tok-render', v_id2, 'nombre con comillas', true) = 'skipped', 'fail final: skipped');

  -- 7. Una jugada que quedó en processing más de 30 minutos vuelve a la cola; al tercer intento, failed.
  update match_clips set video_status = null, video_attempts = 0 where id = v_id2;
  perform clip_render_claim('tok-render');
  update match_clips set video_claimed_at = now() - interval '31 minutes' where id = v_id2;
  j := clip_render_claim('tok-render');
  perform pg_temp.ok((j->'clips'->0->>'id')::uuid = v_id2 and (j->'clips'->0->>'attempt')::int = 2,
                     'processing vencida: vuelve a la cola');
  update match_clips set video_claimed_at = now() - interval '31 minutes', video_attempts = 3 where id = v_id2;
  j := clip_render_claim('tok-render');  -- aparte: una subconsulta en la misma expresión no ve lo que cambió el claim
  perform pg_temp.ok(j is null and (select video_status from match_clips where id = v_id2) = 'failed',
                     'processing vencida al tercer intento: failed');

  -- 8. Volver a guardar los clips (la ingesta no reprocesa un resultado repetido, así que se llama directo):
  --    la jugada conserva su id y su video; un cambio de nombre no lo toca.
  perform csstv_clips_save(v_a, pg_temp.payload('srv1-video-000a', 'finished', jsonb_build_array(
           pg_temp.clip(9, 1, array[90300, 90400, 90500]),
           pg_temp.clip(3, 1, array[30100, 30200, 30300, 30400, 30500], true, null, 'V1 nuevo'),
           pg_temp.clip(5, 1, array[50100, 50200, 50300]),
           pg_temp.clip(7, 2, '{}', true, 2),
           pg_temp.clip(1, 1, array[10100, 10200, 10300]))));
  perform pg_temp.ok(pg_temp.id_clip(v_a, 3) = v_id and (select video_status from match_clips where id = v_id) = 'done'
                     and (select player_name from match_clips where id = v_id) = 'V1 nuevo',
                     'guardar otra vez: mismo id, video conservado y nombre al día');
  perform pg_temp.ok(not exists (select 1 from clip_video_trash), 'guardar otra vez igual: nada a la papelera');

  -- 9. Otros ticks para la misma jugada: el video va a la papelera y la jugada vuelve a la cola.
  perform csstv_clips_save(v_a, pg_temp.payload('srv1-video-000a', 'finished', jsonb_build_array(
           pg_temp.clip(9, 1, array[90300, 90400, 90500]),
           pg_temp.clip(3, 1, array[31100, 31200, 31300, 31400, 31500]),
           pg_temp.clip(5, 1, array[50100, 50200, 50300]),
           pg_temp.clip(1, 1, array[10100, 10200, 10300]))));
  select * into r from match_clips where id = v_id;
  perform pg_temp.ok(r.kill_ticks[1] = 31100 and r.video_status is null and r.video_key is null and r.video_drive_id is null
                     and r.video_attempts = 0, 'ticks nuevos: la jugada vuelve a estar sin video');
  perform pg_temp.ok((select count(*) from clip_video_trash where video_key = pg_temp.clave(v_id)
                        and video_drive_id = '1AbCdEfGhIjKlMnOp_q-r') = 1, 'ticks nuevos: el video viejo va a la papelera');
  perform pg_temp.ok(pg_temp.id_clip(v_a, 7) is null, 'jugada que no vino: se borra');

  -- 10. Cambian los ticks mientras se graba: done devuelve false y el archivo va a la papelera.
  delete from clip_video_trash;
  j := clip_render_claim('tok-render');
  perform pg_temp.ok((j->'clips'->0->>'id')::uuid = v_id, 'claim: la jugada con ticks nuevos');
  perform csstv_clips_save(v_a, jsonb_build_object('clips', jsonb_build_array(
            pg_temp.clip(9, 1, array[90300, 90400, 90500]),
            pg_temp.clip(3, 1, array[32100, 32200, 32300, 32400, 32500]),
            pg_temp.clip(5, 1, array[50100, 50200, 50300]),
            pg_temp.clip(1, 1, array[10100, 10200, 10300]))));
  perform pg_temp.ok(not clip_render_done('tok-render', v_id, pg_temp.clave(v_id, 'viejo1'), 9000000, 12.2, '1ZyXwVuTsRqPoNm'),
                     'ticks cambiados durante la grabación: done devuelve false');
  perform pg_temp.ok((select count(*) from clip_video_trash where video_key = pg_temp.clave(v_id, 'viejo1')
                        and video_drive_id = '1ZyXwVuTsRqPoNm') = 1, 'ticks cambiados durante la grabación: el archivo va a la papelera');

  -- 11. Archivo de los 15 días: solo los que están en Drive.
  j := clip_render_claim('tok-render');
  perform clip_render_done('tok-render', v_id, pg_temp.clave(v_id, 'nuevo1'), 9000000, 12.2, '1DriveDelNuevo');
  v_id2 := (select id from match_clips where match_id = v_b);
  perform clip_render_done('tok-render', v_id2, pg_temp.clave(v_id2), 5000000, 8);       -- sin Drive
  perform pg_temp.ok(not exists (select 1 from clip_archive_due('tok-render')), 'archivo: nada antes de los 15 días');
  update match_clips set video_rendered_at = now() - interval '16 days' where id in (v_id, v_id2);
  perform pg_temp.ok((select array_agg(clip_id) from clip_archive_due('tok-render')) = array[v_id],
                     'archivo: a los 15 días, solo el que ya está en Drive');
  perform pg_temp.ok(not exists (select 1 from clip_archive_due('tok-render', 30)), 'archivo: con 30 días, nada');
  perform pg_temp.err($q$select * from clip_archive_due('tok-render', 0)$q$, 'Días inválidos', 'archivo: 0 días rechazado');
  perform pg_temp.ok(clip_archive_mark('tok-render', v_id) and not clip_archive_mark('tok-render', v_id)
                     and not clip_archive_mark('tok-render', v_id2), 'archivo: marca una vez, y nunca uno sin Drive');
  perform pg_temp.ok(not (select video_in_r2 from match_clip_list where id = v_id)
                     and (select video_drive_id from match_clip_list where id = v_id) = '1DriveDelNuevo',
                     'listado: ya no en R2, sigue en Drive');
  perform pg_temp.ok(not exists (select 1 from clip_archive_due('tok-render')), 'archivo: no lo devuelve otra vez');

  -- 12. Borrar la partida: los videos van a la papelera (de uno archivado, solo el de Drive).
  delete from clip_video_trash;
  delete from matches where id = v_a;
  perform pg_temp.ok((select count(*) from clip_video_trash) = 1
                      and (select video_key is null and video_drive_id = '1DriveDelNuevo' from clip_video_trash),
                     'partida borrada: el video archivado va a la papelera solo con su id de Drive');
  delete from matches where id = v_b;
  perform pg_temp.ok((select count(*) from clip_video_trash where video_key = pg_temp.clave(v_id2) or video_key like '%' || v_id2 || '%') = 1,
                     'partida borrada: el video en R2 va a la papelera con su clave');

  -- 13. Papelera.
  n := (select count(*) from clip_trash_list('tok-render'));
  perform pg_temp.ok(n = 2, 'papelera: lista los dos');
  perform pg_temp.ok(clip_trash_done('tok-render', (select min(id) from clip_trash_list('tok-render')))
                     and (select count(*) from clip_trash_list('tok-render')) = 1, 'papelera: borra uno');
  perform pg_temp.ok(not clip_trash_done('tok-render', -1), 'papelera: id inexistente da false');
end $$;

-- 14. Permisos: anon llama a las funciones del render (con el token), pero no ve los tokens ni la papelera.
set local role anon;
do $$
begin
  perform pg_temp.ok(clip_render_claim('tok-render') is null, 'anon con token: claim');
  perform pg_temp.err($q$select clip_render_claim('nada')$q$, 'Token de render inválido', 'anon sin token: rechazado');
  perform pg_temp.ok((select count(*) from render_workers) = 0, 'anon no ve los tokens');
  perform pg_temp.err($q$select count(*) from clip_video_trash$q$, 'permission denied', 'anon no lee la papelera');
  perform pg_temp.err($q$select render_auth('tok-render')$q$, 'permission denied', 'anon no llama a render_auth');
  perform pg_temp.err($q$select create_render_worker_token('x')$q$, 'permission denied', 'anon no crea tokens');
  perform pg_temp.ok((select count(*) from match_clip_list where video_status is not null) >= 0, 'anon lee el video en el listado');
end $$;
reset role;

rollback;

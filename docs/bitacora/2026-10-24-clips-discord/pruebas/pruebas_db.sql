-- Pruebas de la migración 20261024120000_clips_discord.sql en la Supabase LOCAL (nunca en producción).
-- Correr:  docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 < pruebas_db.sql
-- Sirve con el esquema de producción (REPLANTEO=0 pnpm db:reset) y con el replanteo completo.
-- Todo va en una transacción que se deshace al final. Cada caso imprime "OK: …"; el primer fallo aborta.

begin;
set local client_min_messages = notice;

insert into render_workers (name, token_hash) values
  ('render-discord', encode(sha256(convert_to('tok-discord', 'UTF8')), 'hex'));
update clip_config set per_player = 2, per_match = 5 where id = 1;

-- Tres partidas: A (vieja, todo grabado), B (más nueva, una de sus 5 mejores todavía en cola) y C (en vivo).
insert into matches (id, kind, status, map, score1, score2, played_at, external_id, demo_status) values
  ('d15c0000-2410-4000-8000-00000000000a', 'mix', 'finished',  'cbble', 16, 13, now() - interval '2 days', 'srv1-disc-a', 'uploaded'),
  ('d15c0000-2410-4000-8000-00000000000b', 'mix', 'cancelled', 'dust2', 10,  8, now() - interval '1 day',  'srv1-disc-b', 'uploaded'),
  ('d15c0000-2410-4000-8000-00000000000c', 'mix', 'live',      'nuke',   3,  2, now(),                     'srv1-disc-c', 'none');

-- Una jugada (ronda r, jugador j, n kills) con o sin video.
create function pg_temp.jugada(p_match text, p_round integer, p_jugador integer, p_kills integer, p_video text)
returns uuid language sql as $$
  insert into match_clips (match_id, round, player_steamid, player_name, round_won, kill_ticks,
                           video_status, video_key, video_bytes, video_seconds, video_drive_id, video_rendered_at)
  select ('d15c0000-2410-4000-8000-00000000000' || p_match)::uuid, p_round, (76561199700000000 + p_jugador)::text, 'J' || p_jugador, true,
         (select array_agg(p_round * 1000 + k) from generate_series(1, p_kills) k),
         case p_video when 'done' then 'done' when 'processing' then 'processing' when 'failed' then 'failed' end,
         case when p_video = 'done' then 'clips/x/' || p_round || '-abcd.mp4' end,
         case when p_video = 'done' then 5000000 end,
         case when p_video = 'done' then 12.5 end,
         case when p_video = 'done' then '1DriveId' || p_round end,
         case when p_video = 'done' then now() end
  returning id
$$;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;

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

-- Las rondas (r) en orden de puesto: 5 kills es ace (mejor), 4 es 4k, 3 es 3k.
do $$
declare
  j  jsonb;
  ids uuid[];
begin
  -- A: siete jugadas con video; se ven 5 (tope por partida) y una falló (no frena).
  perform pg_temp.jugada('a', 1, 1, 5, 'done');      -- ace de J1: puesto 1
  perform pg_temp.jugada('a', 2, 2, 4, 'done');      -- 4k: puesto 3 (empata con la de la ronda 3, más tardía)
  perform pg_temp.jugada('a', 3, 3, 4, 'failed');    -- 4k sin video: puesto 2
  perform pg_temp.jugada('a', 4, 4, 3, 'done');      -- fuera del top 5
  perform pg_temp.jugada('a', 5, 5, 3, 'done');      -- fuera del top 5
  perform pg_temp.jugada('a', 6, 6, 3, 'done');      -- 3k: puesto 5
  perform pg_temp.jugada('a', 7, 7, 3, 'done');      -- 3k: puesto 4
  -- B: su puesto 1 todavía en cola.
  perform pg_temp.jugada('b', 1, 1, 5, null);
  perform pg_temp.jugada('b', 2, 2, 4, 'done');
  -- C: en vivo, con video (no debería pasar, pero no se publica).
  perform pg_temp.jugada('c', 1, 1, 5, 'done');

  perform pg_temp.err($q$select clip_discord_pending('otro')$q$, 'Token de render inválido', 'token desconocido rechazado');
  perform pg_temp.err($q$select clip_discord_pending('tok-discord', 0)$q$, 'Tope inválido', 'tope 0 rechazado');

  j := clip_discord_pending('tok-discord');
  perform pg_temp.ok(jsonb_array_length(j) = 4, 'pendientes: las 4 con video del top 5 de A (la que falló no)');
  perform pg_temp.ok((select array_agg((x->>'position')::int) from jsonb_array_elements(j) x) = array[1, 3, 4, 5],
                     'en orden de puesto');
  perform pg_temp.ok((select bool_and(x->>'external_id' = 'srv1-disc-a') from jsonb_array_elements(j) x),
                     'B espera a su jugada en cola; C está en vivo');
  perform pg_temp.ok(j->0->>'type' = 'ace' and j->0->>'player_name' = 'J1' and (j->0->>'round')::int = 1
                     and j->0->>'map' = 'cbble' and (j->0->>'score1')::int = 16 and (j->0->>'video_seconds')::numeric = 12.5
                     and j->0->>'video_drive_id' = '1DriveId1' and (j->0->>'video_in_r2')::boolean,
                     'datos para el mensaje y para conseguir el video');
  perform pg_temp.ok(jsonb_array_length(clip_discord_pending('tok-discord', 2)) = 1, 'con tope 2: solo el puesto 1 (el 2 no tiene video)');
  perform pg_temp.ok(jsonb_array_length(clip_discord_pending('tok-discord', 5, 1)) = 1, 'p_limit');

  -- Marcar.
  perform pg_temp.err(format('select clip_discord_mark(%L, %L, %L)', 'tok-discord', (j->0->>'clip_id'), 'abc'),
                      'Id de mensaje inválido', 'id de mensaje inválido rechazado');
  perform pg_temp.ok(clip_discord_mark('tok-discord', (j->0->>'clip_id')::uuid, '1563435066783301696'), 'marca la publicada');
  perform pg_temp.ok(not clip_discord_mark('tok-discord', (j->0->>'clip_id')::uuid, '1563435066783301697'), 'marcar otra vez: false');
  perform pg_temp.ok((select discord_message_id from match_clips where id = (j->0->>'clip_id')::uuid) = '1563435066783301696',
                     'la segunda marca no pisa el id del mensaje');
  perform pg_temp.ok(not clip_discord_mark('tok-discord', gen_random_uuid(), '1563435066783301696'), 'jugada que no existe: false');
  perform pg_temp.ok((select array_agg((x->>'position')::int) from jsonb_array_elements(clip_discord_pending('tok-discord')) x)
                     = array[3, 4, 5], 'la publicada ya no aparece');

  -- B: cuando su jugada en cola se graba, sale después de A.
  update match_clips set video_status = 'done', video_key = 'clips/x/b1-abcd.mp4', video_bytes = 1, video_seconds = 5,
                         video_rendered_at = now()
   where match_id = 'd15c0000-2410-4000-8000-00000000000b' and round = 1;
  j := clip_discord_pending('tok-discord');
  perform pg_temp.ok((select array_agg(x->>'external_id' || ':' || (x->>'position')) from jsonb_array_elements(j) x)
                     = array['srv1-disc-a:3', 'srv1-disc-a:4', 'srv1-disc-a:5', 'srv1-disc-b:1', 'srv1-disc-b:2'],
                     'B entra cuando no le queda nada en cola, después de A');

  -- Una grabándose también frena a su partida.
  update match_clips set video_status = 'processing' where match_id = 'd15c0000-2410-4000-8000-00000000000b' and round = 2;
  perform pg_temp.ok(not exists (select 1 from jsonb_array_elements(clip_discord_pending('tok-discord')) x
                                  where x->>'external_id' = 'srv1-disc-b'), 'una grabándose también la frena');
  perform pg_temp.ok(clip_discord_pending('tok-discord') is not null, 'nada pendiente devuelve un arreglo, no null');
end $$;

-- Permisos: anon llama con el token, pero no escribe las columnas a mano.
set local role anon;
do $$
begin
  perform pg_temp.ok(jsonb_typeof(clip_discord_pending('tok-discord')) = 'array', 'anon con token: pendientes');
  perform pg_temp.err($q$select clip_discord_pending('nada')$q$, 'Token de render inválido', 'anon sin token: rechazado');
  begin
    update match_clips set discord_posted_at = now();
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  perform pg_temp.ok((select count(*) from match_clips where discord_posted_at is not null) = 1, 'anon no marcó nada a mano');
end $$;

rollback;

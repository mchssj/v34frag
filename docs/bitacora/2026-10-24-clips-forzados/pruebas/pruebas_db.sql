-- Pruebas de la migración 20261024180000_clips_forzados.sql en la Supabase LOCAL (nunca en producción).
-- Correr:  docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 < pruebas_db.sql
-- Sirve con el esquema de producción (REPLANTEO=0 pnpm db:reset) y con el replanteo completo.
-- Todo va en una transacción que se deshace al final. Cada caso imprime "OK: …"; el primer fallo aborta.

begin;
set local client_min_messages = notice;

insert into render_workers (name, token_hash) values
  ('render-forzados', encode(sha256(convert_to('tok-forzados', 'UTF8')), 'hex'));
update clip_config set per_player = 2, per_match = 5 where id = 1;

insert into matches (id, kind, status, map, score1, score2, played_at, external_id, demo_status) values
  ('f0c00000-2410-4000-8000-0000000000a1', 'mix', 'finished', 'season', 9, 16, now() - interval '1 day', 'srv1-forz-a', 'uploaded');

-- Una jugada (ronda r, jugador j, n kills, clutch vs) con video listo o sin video.
create function pg_temp.jugada(p_round integer, p_jugador integer, p_kills integer, p_vs integer, p_done boolean)
returns uuid language sql as $$
  insert into match_clips (match_id, round, player_steamid, player_name, round_won, kill_ticks,
                           clutch_vs, clutch_start_tick, end_tick,
                           video_status, video_key, video_bytes, video_seconds, video_drive_id, video_rendered_at)
  select 'f0c00000-2410-4000-8000-0000000000a1', p_round, (76561199600000000 + p_jugador)::text, 'J' || p_jugador, true,
         coalesce((select array_agg(p_round * 1000 + k) from generate_series(1, p_kills) k), '{}'),
         p_vs, case when p_vs is not null then p_round * 1000 end, case when p_vs is not null then p_round * 1000 + 900 end,
         case when p_done then 'done' end, case when p_done then 'clips/x/' || p_round || '-abcd.mp4' end,
         case when p_done then 1 end, case when p_done then 10 end, case when p_done then '1Drive' || p_round end,
         case when p_done then now() end
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

do $$
declare
  c1v2 uuid;   -- 1v2 ganado con 2 kills: fuera del top
  c3k1 uuid;   -- 3k de la ronda 1: fuera del top
  j    jsonb;
begin
  -- Top 5 ya grabado y publicado: tres 4k y dos 3k (jugadores distintos).
  perform pg_temp.jugada(23, 1, 4, null, true);
  perform pg_temp.jugada(20, 2, 4, null, true);
  perform pg_temp.jugada(11, 3, 4, null, true);
  perform pg_temp.jugada(24, 2, 3, null, true);
  perform pg_temp.jugada(22, 6, 3, null, true);
  update match_clips set discord_posted_at = now(), discord_message_id = '1'
   where match_id = 'f0c00000-2410-4000-8000-0000000000a1';
  c3k1 := pg_temp.jugada(1, 6, 3, null, false);
  c1v2 := pg_temp.jugada(5, 6, 2, 2, false);

  perform pg_temp.ok((select count(*) from match_clip_list where match_id = 'f0c00000-2410-4000-8000-0000000000a1') = 5,
                     'antes: se ven las 5 del top');
  perform pg_temp.ok(not exists (select 1 from match_clip_list where forced), 'antes: ninguna forzada');
  perform pg_temp.ok(clip_render_claim('tok-forzados') is null, 'antes: la cola no tiene nada (las de afuera no se graban)');

  -- Forzar el 1v2 (desde el SQL Editor no hay usuario: se permite).
  perform pg_temp.ok(clip_force(c1v2) = 'pending', 'forzar: queda en cola');
  perform pg_temp.ok((select video_forced and video_forced_at is not null and video_forced_by is null from match_clips where id = c1v2),
                     'forzar: marca, fecha y sin autor desde el SQL Editor');
  perform pg_temp.ok((select position = 6 and forced and type = 'clutch_2' from match_clip_list where id = c1v2),
                     'la lista la muestra después del top, puesto 6, forced');
  perform pg_temp.ok((select array_agg(position order by position) from match_clip_list
                       where match_id = 'f0c00000-2410-4000-8000-0000000000a1') = array[1, 2, 3, 4, 5, 6],
                     'el top no cambia');
  perform pg_temp.ok((select bool_and(not forced) from match_clip_list where id <> c1v2), 'las del top no son forced');

  -- La cola la toma.
  j := clip_render_claim('tok-forzados');
  perform pg_temp.ok(jsonb_array_length(j->'clips') = 1 and (j->'clips'->0->>'id')::uuid = c1v2,
                     'la cola toma solo la forzada');
  perform pg_temp.ok(clip_render_done('tok-forzados', c1v2,
                                      'clips/f0c00000-2410-4000-8000-0000000000a1/' || c1v2 || '-abcd1.mp4', 100, 12, '1DriveForzada'),
                     'se graba como cualquier otra');

  -- Discord: sale, con forced.
  j := clip_discord_pending('tok-forzados');
  perform pg_temp.ok(jsonb_array_length(j) = 1 and (j->0->>'clip_id')::uuid = c1v2 and (j->0->>'forced')::boolean
                     and (j->0->>'position')::int = 6, 'Discord: la forzada, con forced y puesto 6');

  -- Forzar una que falló: vuelve a la cola con los intentos en 0.
  update match_clips set video_status = 'failed', video_attempts = 3, video_error = 'x' where id = c3k1;
  perform pg_temp.ok(clip_force(c3k1) = 'pending', 'forzar una failed: vuelve a la cola');
  perform pg_temp.ok((select video_attempts = 0 and video_error is null from match_clips where id = c3k1), 'con los intentos en 0');
  perform pg_temp.ok((select position from match_clip_list where id = c3k1) = 6
                     and (select position from match_clip_list where id = c1v2) = 7,
                     'dos forzadas: el 3k (vale más) en el 6 y el 1v2 en el 7');
  perform pg_temp.ok(not exists (select 1 from jsonb_array_elements(clip_discord_pending('tok-forzados')) x
                                  where (x->>'clip_id')::uuid = c1v2),
                     'Discord espera mientras otra forzada de la partida está en cola');

  -- Forzar una que ya está en el top: sigue en su lugar.
  perform pg_temp.ok(clip_force((select id from match_clip_list where position = 1
                                   and match_id = 'f0c00000-2410-4000-8000-0000000000a1')) = 'done',
                     'forzar una del top: ya tenía video');
  perform pg_temp.ok((select count(*) from match_clip_list where match_id = 'f0c00000-2410-4000-8000-0000000000a1') = 7,
                     'no se duplica');

  -- Desforzar.
  perform pg_temp.ok(clip_unforce(c3k1) and not clip_unforce(c3k1), 'desforzar una vez');
  perform pg_temp.ok(not exists (select 1 from match_clip_list where id = c3k1), 'desforzada: deja de verse');
  perform pg_temp.err(format('select clip_force(%L)', gen_random_uuid()), 'no existe', 'jugada que no existe');
end $$;

-- Permisos: anon no puede; un usuario logueado que no es admin, tampoco.
set local role anon;
do $$
begin
  perform pg_temp.err($q$select clip_force(gen_random_uuid())$q$, 'permission denied', 'anon no fuerza');
  perform pg_temp.err($q$select clip_unforce(gen_random_uuid())$q$, 'permission denied', 'anon no desfuerza');
  perform pg_temp.ok((select count(*) from match_clip_list where forced) >= 1, 'anon ve la marca en la lista');
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "f0c00000-2410-4000-8000-0000000000ff", "role": "authenticated"}';
do $$
begin
  perform pg_temp.err($q$select clip_force(gen_random_uuid())$q$, 'Solo un admin', 'un usuario común no fuerza');
end $$;
reset role;

rollback;

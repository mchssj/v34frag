-- Pruebas del replanteo 83. Las arma probar_83.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final (no dejan nada en la base).

do $$
declare
  u uuid := gen_random_uuid();
  st_a text := (76561197960265728 + floor(random() * 1e9)::bigint)::text;
  st_b text := (76561197960265728 + floor(random() * 1e9)::bigint)::text;
  srv uuid; v_match uuid; v_clip uuid;
  n int; j jsonb; c record;
  ok int := 0;
  payload jsonb;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    values (u, u || '@prueba83.local', now(), now() - interval '30 days', 'authenticated', 'authenticated');
  insert into players (nick, user_id, steam_id) values ('p83_a', u, st_a);
  insert into players (nick, steam_id) values ('p83_b', st_b);   -- sin cuenta: no recibe nada
  insert into game_servers (name, token_hash, active) values ('Prueba83 ' || substr(md5(random()::text), 1, 6), md5(random()::text), true)
    returning id into srv;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id, map, score1, score2, played_at)
    values ('mix', 'finished', 1, 'a', 'b', srv, 'de_mirage_rc1', 16, 10, now()) returning id into v_match;

  -- 1. Dos jugadas del mismo jugador (4 kills y un clutch 1v2 ganado) y una de otro sin cuenta: un solo aviso.
  payload := jsonb_build_object('clips', jsonb_build_array(
    jsonb_build_object('round', 3, 'steamid', st_a, 'name', 'p83_a', 'round_won', true, 'kill_ticks', jsonb_build_array(100, 200, 300, 400)),
    jsonb_build_object('round', 7, 'steamid', st_a, 'name', 'p83_a', 'round_won', true, 'kill_ticks', jsonb_build_array(100, 200), 'clutch_vs', 2, 'clutch_start_tick', 50, 'end_tick', 500),
    jsonb_build_object('round', 9, 'steamid', st_b, 'name', 'p83_b', 'round_won', true, 'kill_ticks', jsonb_build_array(100, 200, 300))));
  perform csstv_clips_save(v_match, payload);
  select count(*) into n from notifications where user_id = u;
  if n <> 1 then raise exception 'FALLA 1: % notificaciones (esperaba 1)', n; end if;
  select data into j from notifications where user_id = u and type = 'clips_detected' and ref = 'clips:' || v_match || ':' || st_a;
  if j is null then raise exception 'FALLA 1: no hay clips_detected con su ref'; end if;
  if (j->>'count')::int <> 2 or j->'kills' <> '[4]'::jsonb or j->'clutches' <> '[2]'::jsonb or j->>'map' <> 'de_mirage_rc1'
     or j->>'match_id' <> v_match::text then
    raise exception 'FALLA 1: datos %', j;
  end if;
  if (select category from notifications where user_id = u) <> 'elo' then raise exception 'FALLA 1: categoría'; end if;
  ok := ok + 1;

  -- 2. Una reingesta del mismo resultado no repite el aviso.
  perform csstv_clips_save(v_match, payload);
  select count(*) into n from notifications where user_id = u;
  if n <> 1 then raise exception 'FALLA 2: la reingesta dejó % notificaciones', n; end if;
  ok := ok + 1;

  -- 3. El video terminado ya no avisa.
  select id into v_clip from match_clips where match_id = v_match and player_steamid = st_a and round = 3;
  update match_clips set video_status = 'done', video_key = 'clips/p83.mp4', video_bytes = 1000, video_seconds = 12, video_rendered_at = now() where id = v_clip;
  select count(*) into n from notifications where user_id = u and type = 'clip_ready';
  if n <> 0 then raise exception 'FALLA 3: el video terminado avisó (% clip_ready)', n; end if;
  ok := ok + 1;

  -- 4. El clip reprocesado que aprueba un admin sí avisa.
  update match_clips set video_review = 'pending' where id = v_clip;
  update match_clips set video_review = 'approved' where id = v_clip;
  select count(*) into n from notifications where user_id = u and type = 'clip_ready';
  if n <> 1 then raise exception 'FALLA 4: el clip aprobado dejó % clip_ready (esperaba 1)', n; end if;
  ok := ok + 1;

  -- 5. Una partida sin jugadas visibles no avisa.
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id, map, played_at)
    values ('mix', 'finished', 1, 'a', 'b', srv, 'de_dust2', now()) returning id into v_match;
  perform csstv_clips_save(v_match, jsonb_build_object('clips', '[]'::jsonb));
  select count(*) into n from notifications where user_id = u and type = 'clips_detected';
  if n <> 1 then raise exception 'FALLA 5: una partida sin jugadas avisó'; end if;
  ok := ok + 1;

  -- 6. Servidores: el nombre interno se copió del de hoy, salen en el inicio por defecto y las vistas los muestran.
  if (select internal_name from game_servers where id = srv) is not null then
    raise exception 'FALLA 6: un servidor nuevo no debería traer nombre interno';
  end if;
  if exists (select 1 from game_servers where internal_name is null and created_at < now() - interval '1 second') then
    raise exception 'FALLA 6: quedó un servidor de antes sin nombre interno';
  end if;
  if not (select listed from game_servers_public where id = srv) then raise exception 'FALLA 6: listed por defecto'; end if;
  update game_servers set internal_name = 'flowinterno83', listed = false where id = srv;
  if (select listed from game_servers_public where id = srv) then raise exception 'FALLA 6: la vista pública no ve listed'; end if;
  if not exists (select 1 from admin_server_list where id = srv and internal_name = 'flowinterno83' and search like '%flowinterno83%') then
    raise exception 'FALLA 6: admin_server_list no muestra ni busca el nombre interno';
  end if;
  begin
    insert into game_servers (name, token_hash, active, internal_name) values ('Otro83 ' || md5(random()::text), md5(random()::text), true, 'FLOWINTERNO83');
    raise exception 'FALLA 6: aceptó un nombre interno repetido';
  exception when unique_violation then null;
  end;
  ok := ok + 1;

  -- 7. La cola en números, también para anon.
  delete from mm_queue;
  insert into mm_queue (user_id, player_id, mode, elo) select u, id, '5v5', 1000 from players where user_id = u;
  j := mm_public_counts();
  if (j->>'in_queue')::int <> 1 or j->'open' is null then raise exception 'FALLA 7: %', j; end if;
  if not has_function_privilege('anon', 'public.mm_public_counts()', 'execute') then raise exception 'FALLA 7: anon no la puede usar'; end if;
  if has_function_privilege('anon', 'public.clips_notify_detected(uuid)', 'execute') then raise exception 'FALLA 7: anon puede avisar jugadas'; end if;
  ok := ok + 1;

  -- 8. El armado con más peso del rating.
  select * into c from mm_config where id = 1;
  if (c.balance_rating_weight, c.balance_rating_cap, c.balance_rating_prior_maps) <> (400, 200, 3) then
    raise exception 'FALLA 8: mm_config quedó en %, %, %', c.balance_rating_weight, c.balance_rating_cap, c.balance_rating_prior_maps;
  end if;
  if (select column_default from information_schema.columns where table_name = 'mm_config' and column_name = 'balance_rating_weight') <> '400' then
    raise exception 'FALLA 8: el valor por defecto';
  end if;
  ok := ok + 1;

  raise notice 'prueba 83: % de 8 comprobaciones bien', ok;
end $$;

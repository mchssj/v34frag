-- Pruebas del replanteo 76 (clips destacados y rechazo). Las arma probar_76.sh: van entre el replanteo y su inversa, dentro
-- de una transacción que se deshace al final. Usan la copia de producción de la base local: el jugador con más clips con
-- video y una cuenta de prueba atada a su ficha (si la ficha ya tiene cuenta, se usa esa: nada queda guardado).

create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;

do $$
declare
  v_player uuid; v_user uuid; v_admin uuid := gen_random_uuid(); v_otro uuid := gen_random_uuid();
  v_tok text := 'tok76-' || substr(md5(random()::text), 1, 10);
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; ajeno uuid;
  r jsonb; err text; n int; pos_antes int; v_match uuid;
  ok int := 0;
begin
  select l.player_id into v_player from match_clip_list l join players p on p.id = l.player_id
   where l.video_status = 'done' and l.review is distinct from 'pending'
   group by l.player_id having count(*) >= 5 order by count(*) desc limit 1;
  if v_player is null then raise exception 'PREPARACIÓN: no hay un jugador con 5 clips con video'; end if;
  select user_id into v_user from players where id = v_player;
  if v_user is null then
    v_user := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
      values (v_user, v_user || '@prueba76.local', now(), now(), 'authenticated', 'authenticated');
    update players set user_id = v_user where id = v_player;
  end if;
  delete from vip_memberships where user_id = v_user;   -- sin VIP: tope 3
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select z, z || '@prueba76.local', now(), now(), 'authenticated', 'authenticated' from unnest(array[v_admin, v_otro]) z;
  update profiles set role = 'admin' where id = v_admin;
  update clip_config set featured_max = 3, featured_max_vip = 10 where id = 1;
  -- Los clips del jugador, en el orden del modo automático.
  select (array_agg(l.id order by l.priority, l.created_at desc, l.id))[1], (array_agg(l.id order by l.priority, l.created_at desc, l.id))[2],
         (array_agg(l.id order by l.priority, l.created_at desc, l.id))[3], (array_agg(l.id order by l.priority, l.created_at desc, l.id))[4]
    into c1, c2, c3, c4
    from match_clip_list l where l.player_id = v_player and l.video_status = 'done' and l.review is distinct from 'pending';
  select l.id into ajeno from match_clip_list l where l.player_id is distinct from v_player and l.video_status = 'done' limit 1;

  -- 1. Automático (sin preferencia): los 3 mejores, en el orden de la escala.
  perform pg_temp.como(v_user);
  r := clip_my_featured();
  if r->>'mode' <> 'auto' or (r->>'max')::int <> 3 or (r->>'vip')::boolean or r->'shown' <> jsonb_build_array(c1, c2, c3) or r->'picked' <> '[]' then
    raise exception 'FALLA 1: %', r;
  end if;
  if array(select player_featured_clips_list(v_player)) <> array[c1, c2, c3] then raise exception 'FALLA 1b: la ficha'; end if;
  ok := ok + 2;

  -- 2. Manual: los elegidos, en su orden.
  r := clip_featured_set('manual', array[c4, c1]);
  if r->>'mode' <> 'manual' or r->'shown' <> jsonb_build_array(c4, c1) or r->'picked' <> jsonb_build_array(c4, c1) then raise exception 'FALLA 2: %', r; end if;
  if array(select player_featured_clips_list(v_player)) <> array[c4, c1] then raise exception 'FALLA 2b: la ficha'; end if;
  ok := ok + 2;

  -- 3. Las reglas: el tope (V3901), un clip ajeno, uno repetido.
  begin perform clip_featured_set('manual', array[c1, c2, c3, c4]); raise exception 'FALLA 3a: pasó el tope';
  exception when sqlstate 'V3901' then null; end;
  begin perform clip_featured_set('manual', array[ajeno]); raise exception 'FALLA 3b: un clip ajeno';
  exception when raise_exception then get stacked diagnostics err = message_text; if err like 'FALLA%' then raise; end if; end;
  begin perform clip_featured_set('manual', array[c1, c1]); raise exception 'FALLA 3c: repetido';
  exception when invalid_parameter_value then null; end;
  ok := ok + 3;

  -- 4. Con VIP el tope es 10; sin VIP otra vez, se ven los 3 primeros (no se borra nada).
  insert into vip_memberships (user_id, starts_at, ends_at, source) values (v_user, now() - interval '1 day', now() + interval '30 days', 'manual');
  r := clip_featured_set('manual', array[c1, c2, c3, c4]);
  if (r->>'max')::int <> 10 or jsonb_array_length(r->'shown') <> 4 then raise exception 'FALLA 4a: %', r; end if;
  delete from vip_memberships where user_id = v_user;
  r := clip_my_featured();
  if jsonb_array_length(r->'picked') <> 4 or r->'shown' <> jsonb_build_array(c1, c2, c3) then raise exception 'FALLA 4b: %', r; end if;
  ok := ok + 2;

  -- 5. El archivo de la noche no se lleva un destacado (y sí uno que no lo es).
  perform pg_temp.como(null);
  insert into render_workers (name, token_hash) values ('prueba76', encode(sha256(convert_to(v_tok, 'UTF8')), 'hex'));
  update match_clips set video_rendered_at = now() - interval '400 days', video_r2_deleted_at = null, video_drive_id = coalesce(video_drive_id, 'drive76')
   where id in (c1, c4);
  if exists (select 1 from clip_archive_due(v_tok, 15, 500) d where d.clip_id = c1) then raise exception 'FALLA 5a: archiva un destacado'; end if;
  perform pg_temp.como(v_user);
  perform clip_featured_set('manual', array[c1]);
  perform pg_temp.como(null);
  if not exists (select 1 from clip_archive_due(v_tok, 15, 500) d where d.clip_id = c4) then raise exception 'FALLA 5b: no archiva uno que dejó de ser destacado'; end if;
  ok := ok + 2;

  -- 6. Rechazar: solo un admin; sale de la lista, el ranking no cambia, el video a la papelera y deja de ser destacado.
  perform pg_temp.como(v_otro);
  begin perform clip_reject(c1); raise exception 'FALLA 6a: rechazó uno que no es admin';
  exception when insufficient_privilege then null; end;
  select l.match_id, l.position into v_match, pos_antes from match_clip_list l where l.id = c1;
  create temp table t_pos as select id, position from match_clip_list where match_id = v_match and id <> c1;
  select count(*) into n from clip_video_trash;
  perform pg_temp.como(v_admin);
  if clip_reject(c1, '  la cámara no lo sigue ') <> 'rejected' then raise exception 'FALLA 6b'; end if;
  if exists (select 1 from match_clip_list where id = c1) then raise exception 'FALLA 6c: sigue en la lista'; end if;
  if (select position from match_clip_ranked where id = c1) <> pos_antes then raise exception 'FALLA 6d: cambió su puesto en el ranking'; end if;
  if exists (select 1 from t_pos t join match_clip_list l on l.id = t.id where l.position <> t.position)
     or (select count(*) from match_clip_list where match_id = v_match) <> (select count(*) from t_pos) then
    raise exception 'FALLA 6e: los demás clips de la partida cambiaron (entró otro en su lugar)';
  end if;
  if (select count(*) from clip_video_trash) <> n + 1 then raise exception 'FALLA 6f: el video no fue a la papelera'; end if;
  if (select (video_review, video_status, video_reject_reason, video_rejected_by) from match_clips where id = c1)
     is distinct from ('rejected'::text, null::text, 'la cámara no lo sigue'::text, v_admin) then
    raise exception 'FALLA 6g: %', (select row(video_review, video_status, video_reject_reason) from match_clips where id = c1);
  end if;
  if exists (select 1 from player_featured_clips where clip_id = c1) or exists (select 1 from featured_clips_shown where clip_id = c1) then
    raise exception 'FALLA 6h: sigue destacado';
  end if;
  begin perform clip_reprocess(c1); raise exception 'FALLA 6i: se pudo reprocesar un rechazado';
  exception when raise_exception then get stacked diagnostics err = message_text; if err like 'FALLA%' then raise; end if; end;
  begin perform clip_reject(c1); raise exception 'FALLA 6j: rechazó dos veces';
  exception when raise_exception then get stacked diagnostics err = message_text; if err like 'FALLA%' then raise; end if; end;
  ok := ok + 10;

  -- 7. El render no lo toma ni sale en Discord.
  perform pg_temp.como(null);
  if exists (select 1 from jsonb_array_elements(coalesce(clip_discord_pending(v_tok, 50, 100), '[]')) e where (e->>'clip_id')::uuid = c1) then
    raise exception 'FALLA 7: está para Discord';
  end if;
  ok := ok + 1;

  -- 8. Recuperar: vuelve a la lista para grabar y revisar. Sin la demo, no se puede.
  perform pg_temp.como(v_admin);
  update matches set demo_status = 'expired' where id = v_match;
  begin perform clip_unreject(c1); raise exception 'FALLA 8a: recuperó sin demo';
  exception when raise_exception then get stacked diagnostics err = message_text; if err like 'FALLA%' then raise; end if; end;
  update matches set demo_status = 'uploaded' where id = v_match;
  if clip_unreject(c1) <> 'pending' then raise exception 'FALLA 8b'; end if;
  if not exists (select 1 from match_clip_list where id = c1 and video_status is null and review = 'pending' and position = pos_antes) then
    raise exception 'FALLA 8c: no volvió a la lista para grabar';
  end if;
  if (select video_rejected_at from match_clips where id = c1) is not null then raise exception 'FALLA 8d'; end if;
  ok := ok + 4;

  -- 9. Configuración: solo un admin, entre 1 y 50.
  perform clip_set_featured(5, 12);
  if (select (featured_max, featured_max_vip) from clip_config where id = 1) <> (5::smallint, 12::smallint) then raise exception 'FALLA 9a'; end if;
  begin perform clip_set_featured(0, 12); raise exception 'FALLA 9b';
  exception when invalid_parameter_value then null; end;
  perform pg_temp.como(v_otro);
  begin perform clip_set_featured(3, 10); raise exception 'FALLA 9c';
  exception when insufficient_privilege then null; end;
  ok := ok + 3;

  -- 9b. El manual muestra los topes.
  if (manual_valores()->>'clips.destacados')::int <> 5 or (manual_valores()->>'clips.destacados_vip')::int <> 12 then
    raise exception 'FALLA 9d: manual_valores';
  end if;
  ok := ok + 1;

  -- 10. Permisos: la web no ve las tablas ni la vista nueva sin sesión.
  if has_table_privilege('anon', 'public.match_clip_ranked', 'select') or has_table_privilege('authenticated', 'public.player_featured_clips', 'select')
     or not has_function_privilege('anon', 'public.player_featured_clips_list(uuid)', 'execute')
     or has_function_privilege('anon', 'public.clip_reject(uuid,text)', 'execute') then
    raise exception 'FALLA 10: permisos';
  end if;
  ok := ok + 1;

  perform pg_temp.como(null);
  raise notice 'OK: % comprobaciones del replanteo 76', ok;
end $$;

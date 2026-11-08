-- Pruebas del replanteo 61 (sanciones de la cola en Administración). Se corren con correr_local.sh, dentro de una
-- transacción que se deshace. mm_emit se reemplaza por una versión que anota los avisos.

create temp table avisos (t text, lobby uuid, users uuid[], d jsonb, n serial);
create or replace function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null) returns void
  language sql as $$ insert into avisos (t, lobby, users, d) values (p_type, p_lobby, p_users, p_data) $$;
create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;

do $$
declare
  ua uuid := gen_random_uuid();  -- sancionado
  ub uuid := gen_random_uuid();  -- sanción vencida
  um uuid := gen_random_uuid();  -- moderador
  pa uuid;
  r jsonb; fila jsonb;
  ok int := 0;
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(array[ua, ub, um]) x;
  insert into profiles (id, role) values (um, 'moderator') on conflict (id) do update set role = 'moderator';
  insert into players (nick, user_id, steam_id) values ('a61' || substr(md5(random()::text), 1, 8), ua, (76561197960265728 + floor(random() * 1e9)::bigint)::text) returning id into pa;
  update mm_config set penalty_ladder = '{5,15,60,1440}' where id = 1;

  -- ua: dos faltas seguidas (nivel 2, 15 min). ub: una falta que ya venció.
  perform mm_penalize(ua, 'No aceptaste una partida');
  perform mm_penalize(ua, 'Rechazaste una partida');
  perform mm_penalize(ub, 'Abandonaste una partida');
  update mm_penalties set until = now() - interval '1 minute' where user_id = ub;
  if (select level from mm_penalties where user_id = ua) <> 2 then raise exception 'FALLA 0: nivel de partida'; end if;

  -- 1. La lista: solo las vigentes, con el motivo de la última falta, el nivel y el largo de la escalera.
  perform pg_temp.como(um);
  r := mm_admin_lists('penalties');
  if exists (select 1 from jsonb_array_elements(r) x where x->>'user_id' = ub::text) then raise exception 'FALLA 1a: lista una vencida'; end if;
  select x into fila from jsonb_array_elements(r) x where x->>'user_id' = ua::text;
  if fila is null then raise exception 'FALLA 1b: no lista la vigente'; end if;
  if fila->>'reason' <> 'Rechazaste una partida' then raise exception 'FALLA 1c: motivo %', fila->>'reason'; end if;
  if (fila->>'level')::int <> 2 or (fila->>'max_level')::int <> 4 then raise exception 'FALLA 1d: nivel %', fila; end if;
  if (fila->>'player_id')::uuid <> pa or fila->>'nick' is null or fila->>'since' is null or fila->>'until' is null then raise exception 'FALLA 1e: datos %', fila; end if;
  ok := ok + 5;

  -- 2. Un jugador común no lista ni levanta.
  perform pg_temp.como(ub);
  begin
    perform mm_admin_lists('penalties');
    raise exception 'FALLA 2a: un jugador listó';
  exception when insufficient_privilege then null;
  end;
  begin
    perform mm_admin_lift_penalty(ua, 'Se cayó Steam');
    raise exception 'FALLA 2b: un jugador levantó';
  exception when insufficient_privilege then null;
  end;
  ok := ok + 2;

  -- 3. Sin motivo, no.
  perform pg_temp.como(um);
  begin
    perform mm_admin_lift_penalty(ua, '  ');
    raise exception 'FALLA 3: levantó sin motivo';
  exception when raise_exception then
    if sqlerrm not like 'El motivo%' then raise; end if;
  end;
  ok := ok + 1;

  -- 4. Levantar: sin espera, un nivel menos, la falta anotada, el aviso al jugador y puede volver a la cola.
  if mm_block_reason(ua) is distinct from 'Tenés una sanción vigente' then raise exception 'FALLA 4a: no estaba bloqueado (%)', mm_block_reason(ua); end if;
  delete from avisos;
  perform mm_admin_lift_penalty(ua, '  Se cayó Steam  ');
  if (select until > now() from mm_penalties where user_id = ua) then raise exception 'FALLA 4b: sigue la espera'; end if;
  if (select level from mm_penalties where user_id = ua) <> 1 then raise exception 'FALLA 4c: nivel %', (select level from mm_penalties where user_id = ua); end if;
  if not exists (select 1 from mm_penalty_log where user_id = ua and reason = 'Rechazaste una partida' and lifted_at is not null and lifted_by = um and lift_reason = 'Se cayó Steam') then
    raise exception 'FALLA 4d: no quedó anotada';
  end if;
  if exists (select 1 from mm_penalty_log where user_id = ua and reason = 'No aceptaste una partida' and lifted_at is not null) then raise exception 'FALLA 4e: anotó otra falta'; end if;
  if not exists (select 1 from avisos where t = 'penalty.lifted' and users = array[ua]) then raise exception 'FALLA 4f: sin aviso'; end if;
  if mm_block_reason(ua) is not distinct from 'Tenés una sanción vigente' then raise exception 'FALLA 4g: sigue bloqueado'; end if;
  if exists (select 1 from jsonb_array_elements(mm_admin_lists('penalties')) x where x->>'user_id' = ua::text) then raise exception 'FALLA 4h: sigue en la lista'; end if;
  ok := ok + 8;

  -- 5. La próxima falta sube desde el nivel que quedó (1 → 2), no desde el de antes.
  perform mm_penalize(ua, 'No aceptaste una partida');
  if (select level from mm_penalties where user_id = ua) <> 2 then raise exception 'FALLA 5: nivel %', (select level from mm_penalties where user_id = ua); end if;
  ok := ok + 1;

  -- 6. Sin sanción vigente: 404 (P0002).
  begin
    perform mm_admin_lift_penalty(ub, 'Ya venció');
    raise exception 'FALLA 6: levantó una vencida';
  exception when no_data_found then null;
  end;
  ok := ok + 1;

  -- 7. Un admin también puede; el nivel no baja de 0.
  update mm_penalties set level = 0, until = now() + interval '5 minutes' where user_id = ua;
  update profiles set role = 'admin' where id = um;
  perform mm_admin_lift_penalty(ua, 'Prueba de admin');
  if (select level from mm_penalties where user_id = ua) <> 0 then raise exception 'FALLA 7: nivel negativo'; end if;
  ok := ok + 1;

  -- 8. Permisos: anon no puede ejecutarla.
  if has_function_privilege('anon', 'public.mm_admin_lift_penalty(uuid, text)', 'execute') then raise exception 'FALLA 8: anon puede'; end if;
  ok := ok + 1;

  perform pg_temp.como(null);
  raise notice 'OK: % comprobaciones del replanteo 61', ok;
end $$;

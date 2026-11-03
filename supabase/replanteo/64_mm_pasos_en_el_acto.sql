-- Replanteo 64: el matchmaking sin esperar al tick y sin la carrera de cancelar mientras se arma la sala
-- (plan docs/bitacora/2026-11-02-mm-socket-optimizado, error 4 y mejora A; aprobado por Daniel).
--   1. mm_try_build bloquea las filas de la cola de los jugadores antes de crear la sala. Si alguien canceló mientras
--      tanto, esa combinación no va (antes quedaba en la sala igual y, al no aceptar, lo sancionaban).
--   2. mm_try_build_now(modo): arma las salas que pueda en el acto. Lo llama mm_join.
--   3. mm_accept: si fue el último en aceptar, arranca el veto en el acto.
--   4. mm_assign_server(sala): la rama waiting_server del tick (sin el plazo). La llama mm_ban_map con el último mapa.
--   Las acciones usan candados no bloqueantes (mm_tick y server_alloc): si el tick los tiene, no esperan y el tick lo
--   hace a los 2 s. Así una acción con la sala bloqueada nunca espera un candado que tiene el tick (que espera la sala).
-- Se aplica después de la 63. NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.mm_try_build_now(text)') is not null then
    raise exception 'replanteo 64: mm_try_build_now ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    -- Sin \r: con el archivo en CRLF (autocrlf), los textos de varias líneas no coincidirían con la función.
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 64: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. Cancelar mientras se arma la sala ----------

select pg_temp.reemplazar('public.mm_try_build(text)', array[
  ['    v_server := mm_free_server(v_regions);',
   '    -- (replanteo 64) Las filas de todos, bloqueadas: si alguien canceló mientras tanto, esta combinación no va.' || E'\n' ||
   '    if (select count(*) from (select 1 from mm_queue where user_id = any(v_users) for update) x) <> cardinality(v_users) then continue; end if;' || E'\n' ||
   '    v_server := mm_free_server(v_regions);']
]);

-- ---------- 2. Armar la sala al entrar a la cola ----------

create function public.mm_try_build_now(p_mode text) returns int
  language plpgsql security definer set search_path = public as $$
declare
  c mm_config%rowtype;
  v_ends timestamptz;
  n int := 0;
begin
  -- Si el tick está corriendo (o elige servidor otra cosa), no se espera: el tick arma la sala a los 2 s.
  if not pg_try_advisory_xact_lock(hashtext('mm_tick')) then return 0; end if;
  if not pg_try_advisory_xact_lock(hashtext('server_alloc')) then return 0; end if;
  select * into c from mm_config;
  if not c.open or not exists (select 1 from mm_mode_settings where mode = p_mode and enabled) then return 0; end if;
  select ends_at into v_ends from seasons where status = 'active' limit 1;
  if v_ends is not null and v_ends <= now() + make_interval(mins => c.season_queue_close_minutes) then return 0; end if;
  while mm_try_build(p_mode) is not null loop n := n + 1; end loop;
  return n;
end $$;

select pg_temp.reemplazar('public.mm_join(text, text)', array[
  ['    on conflict (user_id) do nothing;' || E'\n' || 'end',
   '    on conflict (user_id) do nothing;' || E'\n' ||
   '  -- (replanteo 64) Si con este completa una sala, se arma ahora y no en el próximo tick.' || E'\n' ||
   '  perform mm_try_build_now(p_mode);' || E'\n' || 'end']
]);

-- ---------- 3. El veto apenas acepta el último ----------

select pg_temp.reemplazar('public.mm_accept()', array[
  ['  update mm_lobby_players set accepted_at = coalesce(accepted_at, now()) where lobby_id = v_lobby and user_id = auth.uid();',
   '  update mm_lobby_players set accepted_at = coalesce(accepted_at, now()) where lobby_id = v_lobby and user_id = auth.uid();' || E'\n' ||
   '  -- (replanteo 64) El último en aceptar arranca el veto (la sala está bloqueada: el tick espera y la ve en veto).' || E'\n' ||
   '  if not exists (select 1 from mm_lobby_players where lobby_id = v_lobby and accepted_at is null) then perform mm_start_veto(v_lobby); end if;']
]);

-- ---------- 4. El servidor apenas termina el veto ----------

create function public.mm_assign_server(p_lobby uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  l mm_lobbies%rowtype;
  v_server uuid;
begin
  -- Si otro está eligiendo servidor, no se espera: lo hace el tick (el que llama tiene la sala bloqueada).
  if not pg_try_advisory_xact_lock(hashtext('server_alloc')) then return false; end if;
  select * into l from mm_lobbies where id = p_lobby;
  if l.status is distinct from 'waiting_server' then return false; end if;
  -- Lo mismo que el tick: el servidor que se eligió al armar la sala si sigue respondiendo, o uno libre.
  v_server := case when l.server_id is not null and exists (select 1 from mm_server_state s where s.server_id = l.server_id and s.last_poll_at > now() - interval '30 seconds'
                             and (s.unavailable_until is null or s.unavailable_until < now())) then l.server_id
                   else mm_free_server(array(select region from mm_lobby_players where lobby_id = l.id)) end;
  if v_server is null then return false; end if;
  update mm_lobbies set server_id = v_server, status = 'assigned', assign_deadline = now() + interval '30 seconds' where id = l.id;
  update matches set server_id = v_server where id = l.match_id;
  perform mm_emit('lobby.server', l.id, mm_lobby_users(l.id));
  return true;
end $$;

select pg_temp.reemplazar('public.mm_ban_map(uuid, text, uuid)', array[
  ['from mm_lobbies x where x.id = p_lobby));',
   'from mm_lobbies x where x.id = p_lobby));' || E'\n' ||
   '  -- (replanteo 64) Con el último mapa, el servidor en el acto y no en el próximo tick.' || E'\n' ||
   '  if v_count = 1 then perform mm_assign_server(p_lobby); end if;']
]);

revoke all on function public.mm_try_build_now(text), public.mm_assign_server(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;

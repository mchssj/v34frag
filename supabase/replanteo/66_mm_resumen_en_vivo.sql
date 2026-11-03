-- Replanteo 66: el resumen del matchmaking al día por el socket (plan docs/bitacora/2026-11-03-mm-resumen-en-vivo).
--   1. mm_summary(): lo que la barra de Jugar muestra a todos (cuántos buscan, jugadores activos, partidas en vivo,
--      servidores libres y niveles). queue.changed lo lleva entero, en lugar de solo el tamaño de la cola.
--   2. El tick manda el resumen si cambió desde el último que mandó (mm_summary_last): salas que se arman, terminan o se
--      cancelan, reservas y servidores que dejan de responder no pasan por la cola.
--   3. Servidores libres con server_is_free (replanteo 56): descuenta las reservas de torneo y PCW y los no disponibles.
-- Se aplica después de la 64. NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.mm_summary()') is not null then
    raise exception 'replanteo 66: mm_summary ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    -- Sin \r: con el archivo en CRLF (autocrlf), los textos de varias líneas no coincidirían con la función.
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 66: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. El resumen ----------

-- Sin la lista de quiénes buscan: con 50 jugadores pasaría el límite de 8000 bytes de pg_notify. La web la pide al abrirla.
create function public.mm_summary() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'size', (select count(*) from mm_queue),
    'by_mode', coalesce((select jsonb_object_agg(mode, n) from (select mode, count(*) n from mm_queue group by mode) x), '{}'),
    'active_players', (select count(distinct x.user_id) from (select user_id from mm_queue union all select lp.user_id from mm_lobby_players lp
        join mm_lobbies l on l.id = lp.lobby_id where l.status not in ('finished', 'cancelled')) x),
    'live_matches', (select count(*) from mm_lobbies where status = 'live'),
    'servers', jsonb_build_object(
        'total', (select count(*) from game_servers where mm_enabled and active),
        'free', (select count(*) from game_servers s where server_is_free(s.id, 'mm'))),
    'levels', jsonb_build_array(
        jsonb_build_object('label', 'Nivel 1 a 3', 'count', (select count(*) from mm_queue where elo_level(elo) between 1 and 3)),
        jsonb_build_object('label', 'Nivel 4 a 7', 'count', (select count(*) from mm_queue where elo_level(elo) between 4 and 7)),
        jsonb_build_object('label', 'Nivel 8 a 10', 'count', (select count(*) from mm_queue where elo_level(elo) >= 8)))) $$;

select pg_temp.reemplazar('public.mm_trg_notify()', array[
  ['mm_emit(''queue.changed'', null, null, mm_queue_sizes());', 'mm_emit(''queue.changed'', null, null, mm_summary());']
]);

-- ---------- 2. Lo que no pasa por la cola: el tick ----------

-- Solo la escribe el tick (que corre de a uno): el trigger de la cola no escribe nada y no hay bloqueos entre los que entran.
create table public.mm_summary_last (
  id integer primary key default 1 check (id = 1),
  summary jsonb not null default '{}'
);
insert into public.mm_summary_last (id) values (1);
alter table public.mm_summary_last enable row level security;
revoke all on table public.mm_summary_last from anon, authenticated;

select pg_temp.reemplazar('public.mm_tick()', array[
  ['  return jsonb_build_object(''built'', built);',
   '  -- (replanteo 66) Si cambió lo que la barra de Jugar muestra a todos (salas, servidores, reservas), se avisa.' || E'\n' ||
   '  v_summary := mm_summary();' || E'\n' ||
   '  if v_summary is distinct from (select summary from mm_summary_last where id = 1) then' || E'\n' ||
   '    update mm_summary_last set summary = v_summary where id = 1;' || E'\n' ||
   '    perform mm_emit(''queue.changed'', null, null, v_summary);' || E'\n' ||
   '  end if;' || E'\n' ||
   '  return jsonb_build_object(''built'', built);'],
  ['  v_ends timestamptz;', '  v_ends timestamptz;' || E'\n' || '  v_summary jsonb;']
]);

-- ---------- 3. Servidores libres con la misma definición que al elegir uno ----------

select pg_temp.reemplazar('public.mm_my_live(boolean)', array[
  ['        ''free'', (select count(*) from game_servers s join mm_server_state st on st.server_id = s.id where s.mm_enabled and s.active and st.last_poll_at > now() - interval ''30 seconds''' || E'\n' ||
   '                   and not exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in (''finished'', ''cancelled'')))),',
   '        ''free'', (select count(*) from game_servers s where server_is_free(s.id, ''mm''))),']
]);

revoke all on function public.mm_summary() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;

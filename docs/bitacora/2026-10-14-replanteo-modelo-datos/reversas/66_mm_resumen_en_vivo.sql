-- Inversa del replanteo 66: queue.changed vuelve a llevar solo el tamaño de la cola, el tick deja de mandar el resumen
-- y servidores libres vuelve a la cuenta de la 59.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 66: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_trg_notify()', array[
  ['mm_emit(''queue.changed'', null, null, mm_summary());', 'mm_emit(''queue.changed'', null, null, mm_queue_sizes());']
]);

select pg_temp.reemplazar('public.mm_tick()', array[
  ['  -- (replanteo 66) Si cambió lo que la barra de Jugar muestra a todos (salas, servidores, reservas), se avisa.' || E'\n' ||
   '  v_summary := mm_summary();' || E'\n' ||
   '  if v_summary is distinct from (select summary from mm_summary_last where id = 1) then' || E'\n' ||
   '    update mm_summary_last set summary = v_summary where id = 1;' || E'\n' ||
   '    perform mm_emit(''queue.changed'', null, null, v_summary);' || E'\n' ||
   '  end if;' || E'\n', ''],
  ['  v_ends timestamptz;' || E'\n' || '  v_summary jsonb;', '  v_ends timestamptz;']
]);

select pg_temp.reemplazar('public.mm_my_live(boolean)', array[
  ['        ''free'', (select count(*) from game_servers s where server_is_free(s.id, ''mm''))),',
   '        ''free'', (select count(*) from game_servers s join mm_server_state st on st.server_id = s.id where s.mm_enabled and s.active and st.last_poll_at > now() - interval ''30 seconds''' || E'\n' ||
   '                   and not exists (select 1 from mm_lobbies l where l.server_id = s.id and l.status not in (''finished'', ''cancelled'')))),']
]);

drop table public.mm_summary_last;
drop function public.mm_summary();

notify pgrst, 'reload schema';

commit;

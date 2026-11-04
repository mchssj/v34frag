-- Inversa del replanteo 63 (salir de la cola al cerrar la web o la sesión): vuelve mm_try_build y mm_my_live como en la
-- 62 y borra la pausa y sus funciones. Las salidas 'disconnected' de mm_queue_log se pasan a 'left'.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 63: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_try_build(text)', array[
  ['and (ready_at is null or ready_at <= now()) and not mm_unit_away(coalesce(party_id::text, user_id::text))',
   'and (ready_at is null or ready_at <= now())']
]);

select pg_temp.reemplazar('public.mm_my_live(boolean)', array[
  ['    ''queue_dropped_at'', (select l.left_at from mm_queue_log l where l.user_id = me and not exists (select 1 from mm_queue where user_id = me)' || E'\n' ||
   '        and l.id = (select max(id) from mm_queue_log where user_id = me) and l.outcome = ''disconnected'' and l.left_at > now() - interval ''10 minutes''),' || E'\n',
   '']
]);

drop function public.mm_logout(), public.mm_queue_presence_sweep(uuid[], int), public.mm_queue_drop_away(uuid, int),
  public.mm_queue_back(uuid), public.mm_queue_away(uuid), public.mm_unit_away(text);

update mm_queue_log set outcome = 'left' where outcome = 'disconnected';
alter table public.mm_queue_log drop constraint mm_queue_log_outcome_check;
alter table public.mm_queue_log add constraint mm_queue_log_outcome_check check (outcome in ('matched', 'left', 'cancelled', 'closed'));
alter table public.mm_queue drop column away_since;

notify pgrst, 'reload schema';

commit;

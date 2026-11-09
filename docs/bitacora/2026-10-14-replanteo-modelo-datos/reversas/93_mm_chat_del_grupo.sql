-- Inversa del replanteo 93 (chat del grupo y denunciar desde ese chat):
--   - se borran las denuncias sin sala (las del chat del grupo), la columna message y su constraint, y lobby_id vuelve a
--     ser obligatorio;
--   - se borran el chat del grupo y sus funciones;
--   - mm_admin_lists vuelve a como estaba.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 93: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_admin_lists(text, text)', array[
  array[$q$'id', r.id, 'lobby_id', r.lobby_id, 'reason', r.reason, 'note', r.note, 'message', r.message,$q$,
        $q$'id', r.id, 'lobby_id', r.lobby_id, 'reason', r.reason, 'note', r.note,$q$]]);

drop function public.mm_report_from_chat(bigint, text, text);
delete from public.mm_reports where lobby_id is null;
alter table public.mm_reports drop constraint mm_reports_sala_o_mensaje;
alter table public.mm_reports drop column message;
alter table public.mm_reports alter column lobby_id set not null;

drop function public.mm_party_chat_send(text);
drop function public.mm_party_chat_list(bigint);
drop table public.mm_party_chat;
drop function public.mm_party_of(uuid);

commit;

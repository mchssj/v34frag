-- Inversa de la 104: el bloqueo vuelve a ser una regla dura y sin límite semanal. Se pierden el historial de bloqueos
-- y el registro de los bloqueos ignorados.
-- Restaura mm_set_config y mm_tick enteras desde el respaldo: si la 105 (grupo máximo) se aplicó después, deshacer
-- primero la 105, o se pierden sus cambios en esas dos funciones.

begin;

-- Los avisos que ya se mandaron: sin su tipo, el check de notifications los rechazaría.
delete from public.notifications where type = 'mm_block_ignored';

do $$
declare r record;
begin
  if (select count(*) from public.replanteo104_funciones) <> 9 then
    raise exception 'inversa 104: falta el respaldo de alguna función';
  end if;
  for r in select nombre, def from public.replanteo104_funciones loop
    execute r.def;
  end loop;
end $$;

drop function public.mm_block_changes(uuid);
drop function public.mm_best_split_ex(uuid[], integer[], uuid[], integer);
drop table public.mm_lobby_block_ignored;
drop table public.mm_block_log;
alter table public.mm_config drop column block_margin, drop column block_changes_week;
drop table public.replanteo104_funciones;

commit;

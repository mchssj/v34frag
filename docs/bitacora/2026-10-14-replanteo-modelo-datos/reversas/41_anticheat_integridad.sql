-- Inversa de supabase/replanteo/41_anticheat_integridad.sql. Borra la cadena y los registros de integridad.
begin;

do $$
begin
  if to_regclass('public.ac_evidence') is null then
    raise exception 'inversa 41: no existe ac_evidence (¿no se aplicó la 41?)';
  end if;
end $$;

drop function public.ac_retention_delete(uuid);
drop function public.ac_retention_paths(uuid);
drop function public.ac_retention_due(integer);
drop function public.ac_admin_hold(uuid, boolean);
drop function public.ac_admin_record_integrity(uuid, text, jsonb);
drop function public.ac_admin_chain(uuid);
drop function public.ac_integrity_reject(text, text, uuid, text);
drop function public.ac_evidence_append(text, text, uuid, integer, text, text, text, text, text, text, text, uuid);
drop function public.ac_device_key(text, text);
drop function public.ac_device_set_key(text, text, text);

drop table public.ac_integrity_logs;
drop table public.ac_evidence;

alter table public.ac_sessions drop column held;
alter table public.ac_devices drop column public_key;

notify pgrst, 'reload schema';

commit;

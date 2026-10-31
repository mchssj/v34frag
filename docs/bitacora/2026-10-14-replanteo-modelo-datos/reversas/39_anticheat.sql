-- Inversa de supabase/replanteo/39_anticheat.sql. Borra las sesiones y los equipos vinculados.
begin;

do $$
begin
  if to_regclass('public.ac_config') is null then
    raise exception 'inversa 39: no existe ac_config (¿no se aplicó la 39?)';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'ac-evidence') then
    raise exception 'inversa 39: ac-evidence tiene archivos; revisarlos antes de borrar';
  end if;
end $$;

drop policy "ac-evidence: solo quien revisa" on storage.objects;
-- Supabase protege el borrado directo; arriba ya se comprobó que el bucket está vacío.
set local storage.allow_delete_query = 'true';
delete from storage.buckets where id = 'ac-evidence';

drop function public.ac_set_open(integer);
drop function public.ac_admin_sessions(text, integer, integer);
drop function public.ac_public_status(uuid);
drop function public.ac_device_revoke(uuid);
drop function public.ac_bridge_end(text, text, text);
drop function public.ac_bridge_player(text, text, text, boolean, text);
drop function public.ac_heartbeat(text, text, text, text);
drop function public.ac_token_refresh(text, text);
drop function public.ac_link_claim(text, text);
drop function public.ac_link_approve(text);
drop function public.ac_link_start(text, text, text);

drop table public.ac_admin_actions;
drop table public.ac_sessions;
drop table public.ac_link_requests;
drop table public.ac_devices;
drop table public.ac_server_policy;
drop table public.ac_config;

drop function public.ac_require_api(text);
drop function public.ac_user_code();
drop function public.ac_token(text);
drop function public.ac_hash(text);
drop function public.ac_can_review();

notify pgrst, 'reload schema';

commit;

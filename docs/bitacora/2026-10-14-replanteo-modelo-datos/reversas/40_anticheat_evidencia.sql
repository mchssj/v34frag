-- Inversa de supabase/replanteo/40_anticheat_evidencia.sql. Borra procesos, capturas y solicitudes.
-- Los archivos de ac-evidence hay que borrarlos antes con la API de Storage.
begin;

do $$
begin
  if to_regclass('public.ac_screenshots') is null then
    raise exception 'inversa 40: no existe ac_screenshots (¿no se aplicó la 40?)';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'ac-evidence') then
    raise exception 'inversa 40: ac-evidence tiene archivos; revisarlos antes de borrar';
  end if;
end $$;

drop function public.ac_admin_session_evidence(uuid);
drop function public.ac_admin_request_capture(uuid, text);
drop function public.ac_capture_result(text, text, uuid, text);
drop function public.ac_screenshot_stored(text, text, uuid);
drop function public.ac_screenshot_register(text, text, uuid, text, text, integer, integer, integer, text, text, timestamptz, uuid);
drop function public.ac_ingest_processes(text, text, uuid, jsonb);
drop function public.ac_session_accepts(uuid, uuid, timestamptz);
drop function public.ac_device_of(text, text);

drop table public.ac_screenshots;
drop table public.ac_capture_requests;
drop table public.ac_process_events;

alter table public.ac_config drop constraint ac_config_capture_rango, drop column capture_min_s, drop column capture_max_s;

-- El latido de la 39.
create or replace function public.ac_heartbeat(p_secret text, p_access text, p_ip text, p_version text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  d ac_devices%rowtype;
  s ac_sessions%rowtype;
begin
  perform ac_require_api(p_secret);
  update ac_devices
     set last_seen_at = now(), last_ip = p_ip, agent_version = coalesce(p_version, agent_version)
   where access_hash = ac_hash(p_access) and access_expires_at > now() and revoked_at is null
   returning * into d;
  if d.id is null then return null; end if;
  update ac_sessions set last_contact_at = now() where device_id = d.id and status = 'open' returning * into s;
  return jsonb_build_object('session', case when s.id is null then null
    else jsonb_build_object('id', s.id, 'server_id', s.server_id, 'match_uid', s.match_uid, 'started_at', s.started_at) end);
end $$;

notify pgrst, 'reload schema';

commit;

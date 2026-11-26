-- Inversa del replanteo 150 (excepciones de los baneos por IP). Vuelve request_ip_banned, admin_ban_ips y
-- admin_ip_range_accounts a como las dejó el 149 (volver a correr esas tres del 149 después de esto).
begin;
drop function if exists public.admin_ban_ip_exception_remove(uuid);
drop function if exists public.admin_ban_ip_exception_add(uuid, uuid, uuid);
drop function if exists public.admin_ban_ip_add(uuid, text, uuid[], uuid[]);
create or replace function public.request_ip_banned() returns boolean
  language sql stable security definer set search_path = public as $$ select ip_banned(request_ip()) $$;
drop function if exists public.ip_banned_for(inet, uuid);
drop table if exists public.ban_ip_exceptions;
notify pgrst, 'reload schema';
commit;

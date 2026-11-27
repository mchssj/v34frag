-- Inversa del replanteo 151. Borra los baneos por IP sin ficha. Vuelve ip_banned e ip_banned_for a como los dejaron
-- el 149 y el 150 (volver a correr esas dos de ahí).
begin;
drop function if exists public.admin_ban_ips_loose();
drop function if exists public.csstv_ban_ips_compact(text);
drop function if exists public.csstv_bans_compact(text);
drop function if exists public.csstv_ban_ip_lift(text, text, text, text);
drop function if exists public.csstv_ban_ip_add(text, text, integer, text, text, text, uuid);
drop function if exists public.csstv_ban_ips_active(text);
drop function if exists public.csstv_ban_check_ip(text, text, text);
delete from public.ban_ips where ban_id is null;
alter table public.ban_ips drop constraint if exists ban_ips_ban_or_reason;
alter table public.ban_ips alter column ban_id set not null;
alter table public.ban_ips drop column reason, drop column created_by_steam, drop column created_by_name,
  drop column server_id, drop column source, drop column lifted_by_steam, drop column lifted_by_name;
-- ip_banned e ip_banned_for usan ip_ban_match: reemplazarlas antes de borrarla.
drop function if exists public.ip_ban_match(inet, uuid, uuid) cascade;
notify pgrst, 'reload schema';
commit;

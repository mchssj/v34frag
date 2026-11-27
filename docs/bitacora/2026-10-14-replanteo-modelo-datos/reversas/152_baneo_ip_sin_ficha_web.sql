-- Inversa del replanteo 152. Los baneos por IP sin ficha hechos desde la web quedan (se levantan desde la web).
begin;
drop function if exists public.admin_ban_ip_add_loose(text, text, integer, uuid[], uuid[]);
notify pgrst, 'reload schema';
commit;

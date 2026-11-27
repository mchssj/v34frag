-- Inversa del replanteo 153: vuelve admin_ban_ip_add (sin p_full) y el tope de 30 días sin ficha. Los baneos
-- permanentes ya puestos quedan; se levantan desde la web. Después de correr esto, volver a correr la definición de
-- admin_ban_ip_add del 150 y la de admin_ban_ip_add_loose del 152 (y admin_ban_ips del 150).
begin;
drop function if exists public.admin_ban_ip_add(uuid, text, uuid[], uuid[], boolean);
notify pgrst, 'reload schema';
commit;
